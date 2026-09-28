import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usePostgres = !!process.env.DB_HOSTNAME_PG || !!process.env.PGHOST;

// SQLite Fallback
const DB_FILE = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'nntp.db');
let sqliteDb = null;

if (!usePostgres) {
  const dbDir = path.dirname(DB_FILE);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  console.log(`🗄️ Initializing SQLite Database at: ${DB_FILE}`);
  sqliteDb = new Database(DB_FILE);
  try { sqliteDb.pragma('journal_mode = WAL'); } catch (e) { sqliteDb.pragma('journal_mode = DELETE'); }
}

// PostgreSQL Pool setup
let pgPool = null;
if (usePostgres) {
  const host = process.env.DB_HOSTNAME_PG || process.env.PGHOST || 'db_postgres';
  const port = parseInt(process.env.DB_PORT_PG || process.env.PGPORT || '5432', 10);
  const database = process.env.DB_DATABASE_PG || process.env.PGDATABASE || 'nntp';
  const user = process.env.DB_USERNAME_PG || process.env.PGUSER || 'geehong';
  const password = process.env.DB_PASSWORD_PG || process.env.PGPASSWORD || 'Power6100';

  console.log(`🐘 Initializing PostgreSQL Client Pool (${user}@${host}:${port}/${database})`);
  pgPool = new pg.Pool({
    host,
    port,
    database,
    user,
    password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

/**
 * Unified Database Interface Adapter supporting both synchronous SQLite API style
 * and async PostgreSQL Pool operations.
 */
export const db = {
  isPostgres: usePostgres,
  pgPool,
  sqliteDb,

  prepare(sql) {
    if (!usePostgres) {
      return sqliteDb.prepare(sql);
    }

    // Convert SQLite param placeholders (@param, ?) to PostgreSQL $1, $2... format
    const convertSql = (origSql, paramsObj = null, paramsArr = null) => {
      let paramCount = 0;
      const values = [];

      if (paramsObj && typeof paramsObj === 'object' && !Array.isArray(paramsObj)) {
        let text = origSql.replace(/@([a-zA-Z0-9_]+)/g, (match, key) => {
          paramCount++;
          values.push(paramsObj[key]);
          return `$${paramCount}`;
        });
        return { text, values };
      }

      if (paramsArr && Array.isArray(paramsArr)) {
        let text = origSql.replace(/\?/g, () => {
          paramCount++;
          return `$${paramCount}`;
        });
        return { text: text.replace(/@([a-zA-Z0-9_]+)/g, () => `$${++paramCount}`), values: paramsArr };
      }

      let text = origSql.replace(/\?/g, () => `$${++paramCount}`);
      return { text, values: [] };
    };

    return {
      get(...args) {
        if (!usePostgres) return sqliteDb.prepare(sql).get(...args);
        
        // Synchronous fallback wrapper using node async-deasync or returning sync cached/promisified state
        // For node express routes using async/await, we provide sync-compatible or async query
        let queryObj;
        if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
          queryObj = convertSql(sql, args[0]);
        } else {
          queryObj = convertSql(sql, null, args);
        }

        // Return a Promise-compatible result or sync wrapper
        return pgPool.query(queryObj.text, queryObj.values).then(res => res.rows[0] || null);
      },

      all(...args) {
        if (!usePostgres) return sqliteDb.prepare(sql).all(...args);
        let queryObj;
        if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
          queryObj = convertSql(sql, args[0]);
        } else {
          queryObj = convertSql(sql, null, args);
        }
        return pgPool.query(queryObj.text, queryObj.values).then(res => res.rows || []);
      },

      run(...args) {
        if (!usePostgres) return sqliteDb.prepare(sql).run(...args);
        let queryObj;
        if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
          queryObj = convertSql(sql, args[0]);
        } else {
          queryObj = convertSql(sql, null, args);
        }
        return pgPool.query(queryObj.text, queryObj.values);
      }
    };
  },

  exec(sql) {
    if (!usePostgres) return sqliteDb.exec(sql);
    return pgPool.query(sql);
  },

  transaction(fn) {
    if (!usePostgres) return sqliteDb.transaction(fn);
    return async (...args) => {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const res = await fn(...args);
        await client.query('COMMIT');
        return res;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    };
  }
};

// Usage tracker buffering
const usageBuffer = {};
export const recordServerUsage = (serverId, bytes) => {
  if (!serverId || !bytes) return;
  const date = new Date().toISOString().split('T')[0];
  const key = `${serverId}|${date}`;
  usageBuffer[key] = (usageBuffer[key] || 0) + bytes;
};

setInterval(async () => {
  if (Object.keys(usageBuffer).length === 0) return;
  const flushData = { ...usageBuffer };
  for (const key in usageBuffer) delete usageBuffer[key];

  try {
    for (const key in flushData) {
      const [serverId, date] = key.split('|');
      const bytes = flushData[key];
      if (usePostgres) {
        await pgPool.query(`
          INSERT INTO server_usage (server_id, date, bytes_downloaded)
          VALUES ($1, $2, $3)
          ON CONFLICT(server_id, date) DO UPDATE SET bytes_downloaded = server_usage.bytes_downloaded + $3
        `, [serverId, date, bytes]);
      } else {
        sqliteDb.prepare(`
          INSERT INTO server_usage (server_id, date, bytes_downloaded)
          VALUES (?, ?, ?)
          ON CONFLICT(server_id, date) DO UPDATE SET bytes_downloaded = bytes_downloaded + ?
        `).run(serverId, date, bytes, bytes);
      }
    }
  } catch (err) {
    console.error('Failed to flush server usage to DB:', err);
  }
}, 5000);

// Default Servers Setup for PostgreSQL / SQLite
async function initDefaultServers() {
  if (usePostgres) {
    try {
      const srvs = [
        ['server-easynews', 'Easynews Server', process.env.EASYNEWS_HOST || 'news.easynews.com', parseInt(process.env.EASYNEWS_PORT || '563', 10), process.env.EASYNEWS_SSL !== 'false' ? 1 : 0, (process.env.EASYNEWS_USER || 'nynatphksg').split('#')[0].trim(), (process.env.EASYNEWS_PASS || 'xiqe-nhjf-pogb').split('#')[0].trim(), parseInt(process.env.EASYNEWS_MAX_CONNECTIONS || '60', 10), 'Connected', '5800+ Days', 1289531, 1, 30000, 0, '2027-09-28'],
        ['server-block', 'BlockNews Server (Asia)', process.env.BLOCK_HOST || 'asnews.blocknews.net', parseInt(process.env.BLOCK_PORT || '563', 10), process.env.BLOCK_SSL !== 'false' ? 1 : 0, (process.env.BLOCK_USER || 'geecgpia').split('#')[0].trim(), (process.env.BLOCK_PASS || 'jogizowizykyh').split('#')[0].trim(), parseInt(process.env.BLOCK_MAX_CONNECTIONS || '50', 10), 'Connected', '5878+ Days', 1289531, 0, 30000, 1, null],
        ['server-viper', 'ViperNews Server', process.env.VIPER_HOST || 'news.vipernews.com', parseInt(process.env.VIPER_PORT || '563', 10), process.env.VIPER_SSL !== 'false' ? 1 : 0, (process.env.VIPER_USER || 'geecgpia@gmail.com').split('#')[0].trim(), (process.env.VIPER_PASS || 'Power@6100').split('#')[0].trim(), parseInt(process.env.VIPER_MAX_CONNECTIONS || '5', 10), 'Connected', '3000+ Days', 1289531, 0, 30000, 2, null],
        ['server-farm', 'Usenet.Farm Server', process.env.NNTP_HOST || 'news.usenet.farm', parseInt(process.env.NNTP_PORT || '563', 10), process.env.NNTP_SSL !== 'false' ? 1 : 0, (process.env.NNTP_USER || 'ufadh3njs4xtxy0e').split('#')[0].trim(), (process.env.NNTP_PASS || 'c35y18s53qglwx5e').split('#')[0].trim(), parseInt(process.env.NNTP_MAX_CONNECTIONS || '10', 10), 'Connected', '3000+ Days', 1289531, 0, 30000, 3, null],
      ];

      for (const s of srvs) {
        await pgPool.query(`
          INSERT INTO nntp_servers (id, name, host, port, use_ssl, username, password, max_connections, status, retention, synced_groups, is_primary, default_article_count, sort_order, expire_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT(id) DO UPDATE SET
            name = EXCLUDED.name, host = EXCLUDED.host, port = EXCLUDED.port, use_ssl = EXCLUDED.use_ssl,
            username = EXCLUDED.username, password = EXCLUDED.password, max_connections = EXCLUDED.max_connections,
            is_primary = EXCLUDED.is_primary, default_article_count = EXCLUDED.default_article_count, sort_order = EXCLUDED.sort_order
        `, s);
      }
      console.log('✅ PostgreSQL Default Servers Synchronized Successfully.');
    } catch (e) {
      console.error('Failed initializing default servers in PostgreSQL:', e);
    }
  } else {
    // SQLite Fallback setup
    const upsertSrv = sqliteDb.prepare(`
      INSERT INTO nntp_servers (id, name, host, port, useSSL, username, password, maxConnections, status, retention, syncedGroups, isPrimary, default_article_count, sortOrder, expireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, host = excluded.host, port = excluded.port, useSSL = excluded.useSSL,
        username = excluded.username, password = excluded.password, maxConnections = excluded.maxConnections,
        isPrimary = excluded.isPrimary, default_article_count = excluded.default_article_count, sortOrder = excluded.sortOrder
    `);

    upsertSrv.run('server-easynews', 'Easynews Server', process.env.EASYNEWS_HOST || 'news.easynews.com', parseInt(process.env.EASYNEWS_PORT || '563', 10), process.env.EASYNEWS_SSL !== 'false' ? 1 : 0, (process.env.EASYNEWS_USER || 'nynatphksg').split('#')[0].trim(), (process.env.EASYNEWS_PASS || 'xiqe-nhjf-pogb').split('#')[0].trim(), parseInt(process.env.EASYNEWS_MAX_CONNECTIONS || '60', 10), 'Connected', '5800+ Days', 1289531, 1, 30000, 0, '2027-09-28');
    upsertSrv.run('server-block', 'BlockNews Server (Asia)', process.env.BLOCK_HOST || 'asnews.blocknews.net', parseInt(process.env.BLOCK_PORT || '563', 10), process.env.BLOCK_SSL !== 'false' ? 1 : 0, (process.env.BLOCK_USER || 'geecgpia').split('#')[0].trim(), (process.env.BLOCK_PASS || 'jogizowizykyh').split('#')[0].trim(), parseInt(process.env.BLOCK_MAX_CONNECTIONS || '50', 10), 'Connected', '5878+ Days', 1289531, 0, 30000, 1, null);
    upsertSrv.run('server-viper', 'ViperNews Server', process.env.VIPER_HOST || 'news.vipernews.com', parseInt(process.env.VIPER_PORT || '563', 10), process.env.VIPER_SSL !== 'false' ? 1 : 0, (process.env.VIPER_USER || 'geecgpia@gmail.com').split('#')[0].trim(), (process.env.VIPER_PASS || 'Power@6100').split('#')[0].trim(), parseInt(process.env.VIPER_MAX_CONNECTIONS || '5', 10), 'Connected', '3000+ Days', 1289531, 0, 30000, 2, null);
    upsertSrv.run('server-farm', 'Usenet.Farm Server', process.env.NNTP_HOST || 'news.usenet.farm', parseInt(process.env.NNTP_PORT || '563', 10), process.env.NNTP_SSL !== 'false' ? 1 : 0, (process.env.NNTP_USER || 'ufadh3njs4xtxy0e').split('#')[0].trim(), (process.env.NNTP_PASS || 'c35y18s53qglwx5e').split('#')[0].trim(), parseInt(process.env.NNTP_MAX_CONNECTIONS || '10', 10), 'Connected', '3000+ Days', 1289531, 0, 30000, 3, null);
  }
}

initDefaultServers();
