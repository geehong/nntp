import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'nntp.db');

const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`🗄️ Initializing SQLite Database at: ${DB_FILE}`);
export const db = new Database(DB_FILE);

try {
  db.pragma('journal_mode = WAL');
} catch (e) {
  console.warn('⚠️ WAL journal mode not supported on volume mount, falling back to DELETE mode:', e.message);
  db.pragma('journal_mode = DELETE');
}

// Create Tables & Indexes
db.exec(`
  CREATE TABLE IF NOT EXISTS newsgroups (
    server_id TEXT DEFAULT 'server-farm',
    name TEXT,
    high TEXT,
    low TEXT,
    status TEXT,
    count TEXT,
    article_count TEXT,
    rawNNTPLine TEXT,
    is_favorite INTEGER DEFAULT 0,
    num_high INTEGER DEFAULT 0,
    num_low INTEGER DEFAULT 0,
    num_count INTEGER DEFAULT 0,
    num_article_count INTEGER DEFAULT 0,
    PRIMARY KEY (server_id, name)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_newsgroups_srv_name_unique ON newsgroups(server_id, name);
  CREATE INDEX IF NOT EXISTS idx_newsgroups_srv_fav ON newsgroups(server_id, is_favorite);
  CREATE INDEX IF NOT EXISTS idx_newsgroups_srv_name ON newsgroups(server_id, name);
  CREATE INDEX IF NOT EXISTS idx_newsgroups_srv_artcnt ON newsgroups(server_id, num_article_count DESC);
  CREATE INDEX IF NOT EXISTS idx_newsgroups_srv_high ON newsgroups(server_id, num_high DESC);
  CREATE INDEX IF NOT EXISTS idx_newsgroups_srv_count ON newsgroups(server_id, num_count DESC);
  CREATE INDEX IF NOT EXISTS idx_artcnt_name ON newsgroups(server_id, num_article_count DESC, name);
  CREATE INDEX IF NOT EXISTS idx_high_name ON newsgroups(server_id, num_high DESC, name);
  CREATE INDEX IF NOT EXISTS idx_count_name ON newsgroups(server_id, num_count DESC, name);
  CREATE INDEX IF NOT EXISTS idx_fav_name ON newsgroups(server_id, is_favorite, name);

  CREATE TABLE IF NOT EXISTS article_cache (
    server_id TEXT,
    group_name TEXT,
    range_key TEXT,
    lines TEXT,
    updated_at INTEGER,
    PRIMARY KEY (server_id, group_name, range_key)
  );

  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS nntp_servers (
    id TEXT PRIMARY KEY,
    name TEXT,
    host TEXT,
    port INTEGER,
    useSSL INTEGER,
    username TEXT,
    password TEXT,
    maxConnections INTEGER,
    status TEXT,
    retention TEXT,
    syncedGroups INTEGER,
    isPrimary INTEGER DEFAULT 0,
    default_article_count INTEGER DEFAULT 300,
    showInSidebar INTEGER DEFAULT 1,
    sortOrder INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS server_usage (
    server_id TEXT,
    date TEXT,
    bytes_downloaded INTEGER DEFAULT 0,
    PRIMARY KEY (server_id, date)
  );
`);

try { db.exec('ALTER TABLE nntp_servers ADD COLUMN showInSidebar INTEGER DEFAULT 1'); } catch (e) {}
try { db.exec('ALTER TABLE nntp_servers ADD COLUMN sortOrder INTEGER DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE nntp_servers ADD COLUMN expireDate TEXT'); } catch (e) {}

// Safe migration for article_cache table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS article_cache (
      server_id TEXT,
      group_name TEXT,
      range_key TEXT,
      lines TEXT,
      updated_at INTEGER,
      PRIMARY KEY (server_id, group_name, range_key)
    );
  `);
} catch (e) {}
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_artcache_lookup ON article_cache(server_id, group_name, range_key)');
} catch (e) {}

// Server usage tracker
const usageBuffer = {};
export const recordServerUsage = (serverId, bytes) => {
  if (!serverId || !bytes) return;
  const date = new Date().toISOString().split('T')[0];
  const key = `${serverId}|${date}`;
  usageBuffer[key] = (usageBuffer[key] || 0) + bytes;
};

setInterval(() => {
  if (Object.keys(usageBuffer).length === 0) return;
  const stmt = db.prepare(`
    INSERT INTO server_usage (server_id, date, bytes_downloaded)
    VALUES (?, ?, ?)
    ON CONFLICT(server_id, date) DO UPDATE SET bytes_downloaded = bytes_downloaded + ?
  `);
  const flushData = { ...usageBuffer };
  for (const key in usageBuffer) delete usageBuffer[key];
  try {
    db.transaction(() => {
      for (const key in flushData) {
        const [serverId, date] = key.split('|');
        const bytes = flushData[key];
        stmt.run(serverId, date, bytes, bytes);
      }
    })();
  } catch (err) {
    console.error('Failed to flush server usage to DB:', err);
  }
}, 5000);

// Default Servers Setup
const upsertSrv = db.prepare(`
  INSERT INTO nntp_servers (id, name, host, port, useSSL, username, password, maxConnections, status, retention, syncedGroups, isPrimary, default_article_count, expireDate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    host = excluded.host,
    port = excluded.port,
    useSSL = excluded.useSSL,
    username = excluded.username,
    password = excluded.password,
    maxConnections = excluded.maxConnections,
    retention = excluded.retention,
    isPrimary = excluded.isPrimary,
    expireDate = excluded.expireDate
`);

upsertSrv.run(
  'server-farm',
  'Usenet.Farm Server',
  process.env.NNTP_HOST || 'news.usenet.farm',
  parseInt(process.env.NNTP_PORT || '563', 10),
  process.env.NNTP_SSL !== 'false' ? 1 : 0,
  (process.env.NNTP_USER || 'ufadh3njs4xtxy0e').split('#')[0].trim(),
  (process.env.NNTP_PASS || 'c35y18s53qglwx5e').split('#')[0].trim(),
  parseInt(process.env.NNTP_MAX_CONNECTIONS || '10', 10),
  'Connected',
  '3000+ Days',
  1289531,
  0,
  300,
  process.env.NNTP_EXPIRE_DATE || null
);

upsertSrv.run(
  'server-viper',
  'ViperNews Server',
  process.env.VIPER_HOST || 'news.vipernews.com',
  parseInt(process.env.VIPER_PORT || '563', 10),
  process.env.VIPER_SSL !== 'false' ? 1 : 0,
  (process.env.VIPER_USER || 'geecgpia@gmail.com').split('#')[0].trim(),
  (process.env.VIPER_PASS || 'Power@6740').split('#')[0].trim(),
  parseInt(process.env.VIPER_MAX_CONNECTIONS || '5', 10),
  'Connected',
  '3000+ Days',
  1289531,
  0,
  300,
  process.env.VIPER_EXPIRE_DATE || null
);

db.prepare('UPDATE nntp_servers SET isPrimary = 0').run();
upsertSrv.run(
  'server-block',
  'BlockNews Server (Asia)',
  process.env.BLOCK_HOST || 'asnews.blocknews.net',
  parseInt(process.env.BLOCK_PORT || '563', 10),
  process.env.BLOCK_SSL !== 'false' ? 1 : 0,
  (process.env.BLOCK_USER || 'geecgpia').split('#')[0].trim(),
  (process.env.BLOCK_PASS || 'jogizowizykyh').split('#')[0].trim(),
  parseInt(process.env.BLOCK_MAX_CONNECTIONS || '50', 10),
  'Connected',
  '5878+ Days',
  1289531,
  1,
  300,
  process.env.BLOCK_EXPIRE_DATE || null
);

upsertSrv.run(
  'server-easynews',
  'Easynews Server',
  process.env.EASYNEWS_HOST || 'news.easynews.com',
  parseInt(process.env.EASYNEWS_PORT || '563', 10),
  process.env.EASYNEWS_SSL !== 'false' ? 1 : 0,
  (process.env.EASYNEWS_USER || 'nynatphksg').split('#')[0].trim(),
  (process.env.EASYNEWS_PASS || 'xiqe-nhjf-pogb').split('#')[0].trim(),
  parseInt(process.env.EASYNEWS_MAX_CONNECTIONS || '60', 10),
  'Connected',
  '5800+ Days',
  1289531,
  0,
  300,
  process.env.EASYNEWS_EXPIRE_DATE || '2027-09-28'
);

