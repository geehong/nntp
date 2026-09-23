import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import tls from 'tls';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { decodeYencArticle, assembleYencParts } from './src/backend/yencDecoder.js';
import { fetchArticleBodyRaw, queueFetchArticleBodyRaw, closeAllIdleSockets } from './src/backend/nntpClient.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const DB_FILE = path.join(__dirname, 'src', 'data', 'nntp.db');
const JSON_CACHE_FILE = path.join(__dirname, 'src', 'data', 'newsgroups.json');
const JSON_FAVORITES_FILE = path.join(__dirname, 'src', 'data', 'favorites.json');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3001;

app.use(express.json());

// Handle favicon.ico to prevent 404/400 console errors
app.get('/favicon.ico', (req, res) => res.status(204).end());

// CORS Headers Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Basic Auth Middleware (Requires login to access entire site, matching blog-news-bot)
app.use((req, res, next) => {
  // Allow WebSocket Upgrade requests to pass through to WebSocket server
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    return next();
  }

  const adminUser = (process.env.ADMIN_USERNAME || 'geehong').trim();
  const adminPass = (process.env.ADMIN_PASSWORD || 'Power@6740').trim();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const creds = Buffer.from(authHeader.substring(6).trim(), 'base64').toString('utf-8');
      const colonIndex = creds.indexOf(':');
      if (colonIndex !== -1) {
        const user = creds.substring(0, colonIndex).trim();
        const pass = creds.substring(colonIndex + 1).trim();
        if (user === adminUser && pass === adminPass) {
          return next();
        }
      }
    } catch (e) {
      console.error('Auth parse error:', e);
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="NNTP Web Client", charset="UTF-8"');
  return res.status(401).send('Authentication Required');
});

// Serve built frontend static files if dist exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log(`📦 Serving static frontend files from: ${distPath}`);
  app.use(express.static(distPath));
}

// --- Initialize SQLite Database ---
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
console.log(`🗄️ Initializing SQLite Database at: ${DB_FILE}`);
const db = new Database(DB_FILE);
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
`);

try {
  const pkCols = db.prepare("PRAGMA table_info(newsgroups)").all().filter(col => col.pk > 0);
  const isOldSchema = pkCols.length === 1 && pkCols[0].name === 'name';
  if (isOldSchema) {
    console.log('🔄 Rebuilding newsgroups table to fix primary key constraint to (server_id, name)...');
    db.exec(`
      CREATE TABLE newsgroups_new (
        server_id TEXT DEFAULT 'server-block',
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
      INSERT OR IGNORE INTO newsgroups_new (server_id, name, high, low, status, count, article_count, rawNNTPLine, is_favorite, num_high, num_low, num_count, num_article_count)
      SELECT IFNULL(server_id, 'server-block'), name, high, low, status, count, article_count, rawNNTPLine, is_favorite, IFNULL(num_high, 0), IFNULL(num_low, 0), IFNULL(num_count, 0), IFNULL(num_article_count, 0)
      FROM newsgroups;
      DROP TABLE newsgroups;
      ALTER TABLE newsgroups_new RENAME TO newsgroups;
    `);
    console.log('✅ newsgroups table migration complete!');
  }
} catch (mErr) {
  console.error('Migration notice:', mErr.message);
}

// Global function to track usage
global.recordServerUsage = (serverId, bytes) => {
  if (!serverId || !bytes) return;
  const date = new Date().toISOString().split('T')[0];
  try {
    db.prepare(`
      INSERT INTO server_usage (server_id, date, bytes_downloaded) 
      VALUES (?, ?, ?) 
      ON CONFLICT(server_id, date) 
      DO UPDATE SET bytes_downloaded = bytes_downloaded + ?
    `).run(serverId, date, bytes, bytes);
  } catch (err) {
    console.error('Error recording server usage:', err);
  }
};

db.exec(`
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
  CREATE INDEX IF NOT EXISTS idx_fav_artcnt ON newsgroups(server_id, is_favorite, num_article_count DESC);
  CREATE INDEX IF NOT EXISTS idx_fav_high ON newsgroups(server_id, is_favorite, num_high DESC);
  CREATE INDEX IF NOT EXISTS idx_fav_count ON newsgroups(server_id, is_favorite, num_count DESC);

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
    default_article_count INTEGER DEFAULT 300
  );

  CREATE TABLE IF NOT EXISTS article_cache (
    server_id TEXT,
    group_name TEXT,
    article_id INTEGER,
    raw_line TEXT,
    fetched_at INTEGER,
    PRIMARY KEY (server_id, group_name, article_id)
  );

  CREATE TABLE IF NOT EXISTS fetch_history (
    server_id TEXT,
    group_name TEXT,
    start_id INTEGER,
    end_id INTEGER,
    fetched_at INTEGER,
    PRIMARY KEY (server_id, group_name, start_id, end_id)
  );

  CREATE TABLE IF NOT EXISTS server_usage (
    server_id TEXT,
    date TEXT,
    bytes_downloaded INTEGER DEFAULT 0,
    PRIMARY KEY (server_id, date)
  );

  CREATE INDEX IF NOT EXISTS idx_article_cache_time ON article_cache(fetched_at);
  CREATE INDEX IF NOT EXISTS idx_fetch_history_time ON fetch_history(fetched_at);
`);

// Migration for existing databases
try {
  db.prepare("ALTER TABLE nntp_servers ADD COLUMN default_article_count INTEGER DEFAULT 300").run();
} catch (e) {
  console.log('Skipping index migration:', e.message);
}

// --- Server Usage Tracking ---
const usageBuffer = {};

global.recordServerUsage = (serverId, bytes) => {
  if (!serverId) return;
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

// Ensure default servers exist or update BlockNews as primary server
const upsertSrv = db.prepare(`
  INSERT INTO nntp_servers (id, name, host, port, useSSL, username, password, maxConnections, status, retention, syncedGroups, isPrimary, default_article_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    host = excluded.host,
    port = excluded.port,
    useSSL = excluded.useSSL,
    username = excluded.username,
    password = excluded.password,
    maxConnections = excluded.maxConnections,
    retention = excluded.retention
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
  300
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
  300
);

// Set BlockNews as Primary Server
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
  300
);

// Auto Migration from legacy JSON files if DB is empty (Disabled to prevent stale group count mismatch)
const groupCountRow = db.prepare('SELECT COUNT(*) as cnt FROM newsgroups').get();
if (false && groupCountRow.cnt === 0 && fs.existsSync(JSON_CACHE_FILE)) {
  console.log('📦 Migrating legacy JSON newsgroups data into SQLite DB...');
  try {
    const raw = JSON.parse(fs.readFileSync(JSON_CACHE_FILE, 'utf-8'));
    const rawArray = Array.isArray(raw) ? raw : (raw.groups || []);
    const lastUpdated = Array.isArray(raw) ? new Date().toISOString() : (raw.lastUpdated || new Date().toISOString());

    let legacyFavs = [];
    if (fs.existsSync(JSON_FAVORITES_FILE)) {
      try {
        legacyFavs = JSON.parse(fs.readFileSync(JSON_FAVORITES_FILE, 'utf-8'));
      } catch (e) {}
    }
    const favSet = new Set(legacyFavs);

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO newsgroups (server_id, name, high, low, status, count, article_count, rawNNTPLine, is_favorite, num_high, num_low, num_count, num_article_count)
      VALUES (@server_id, @name, @high, @low, @status, @count, @article_count, @rawNNTPLine, @is_favorite, @num_high, @num_low, @num_count, @num_article_count)
    `);

    const insertBatch = db.transaction((chunk) => {
      for (const item of chunk) {
        const high = item.high !== undefined ? item.high.toString() : (item.count !== undefined ? item.count.toString() : '0');
        const low = item.low !== undefined ? item.low.toString() : '1';
        const status = item.status || 'y';
        const count = item.count !== undefined ? item.count.toString() : high;
        const article_count = item.article_count !== undefined ? item.article_count.toString() : '0';
        const rawNNTPLine = item.rawNNTPLine || `${item.name} ${high.replace(/,/g, '')} ${low.replace(/,/g, '')} ${status}`;
        const is_favorite = favSet.has(item.name) ? 1 : 0;

        const parseNum = (str) => {
          if (!str) return 0;
          const clean = str.toString().replace(/,/g, '').replace(/\s*articles/gi, '').trim();
          return parseInt(clean, 10) || 0;
        };

        insertStmt.run({
          server_id: 'server-block',
          name: item.name,
          high,
          low,
          status,
          count,
          article_count,
          rawNNTPLine,
          is_favorite,
          num_high: parseNum(high),
          num_low: parseNum(low),
          num_count: parseNum(count),
          num_article_count: parseNum(article_count),
        });
      }
    });

    const batchSize = 20000;
    for (let i = 0; i < rawArray.length; i += batchSize) {
      const chunk = rawArray.slice(i, i + batchSize);
      insertBatch(chunk);
      console.log(`📥 Migrated ${Math.min(i + batchSize, rawArray.length).toLocaleString()} / ${rawArray.length.toLocaleString()} items to SQLite...`);
    }

    db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('lastUpdated', lastUpdated);
    console.log(`✅ Successfully migrated ${rawArray.length.toLocaleString()} items to SQLite DB!`);
  } catch (e) {
    console.error('Failed legacy migration to SQLite:', e);
  }
}

// --- In-Memory Count Cache for Instant Query Performance ---
const countCache = new Map();
const getCachedCount = (key, fetchFn) => {
  if (countCache.has(key)) return countCache.get(key);
  const result = fetchFn();
  if (countCache.size > 500) countCache.clear();
  countCache.set(key, result);
  return result;
};

// --- API: Get Paginated & Filtered Newsgroups (Filtered by Server ID) ---
app.get('/api/newsgroups', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.max(1, parseInt(req.query.pageSize || '25', 10));
  const search = (req.query.search || '').trim().toLowerCase();
  const sort = req.query.sort || 'name';
  const order = (req.query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const favoriteOnly = req.query.favoriteOnly === 'true';

  // Get primary server ID if serverId not specified
  let serverId = req.query.serverId;
  if (!serverId) {
    const primaryRow = db.prepare('SELECT id FROM nntp_servers WHERE isPrimary = 1 LIMIT 1').get();
    serverId = primaryRow ? primaryRow.id : 'server-viper';
  }

  try {
    let whereClauses = ['server_id = @serverId'];
    let queryParams = { serverId };

    if (search) {
      whereClauses.push('name LIKE @search');
      queryParams.search = search.includes('%') ? search : `%${search}%`;
    }
    if (favoriteOnly) {
      whereClauses.push('is_favorite = 1');
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    // Fast indexed sort column mapping & index hints
    const sortColumnMap = {
      article_count: 'num_article_count',
      high: 'num_high',
      low: 'num_low',
      count: 'num_count',
      status: 'status',
      is_favorite: 'is_favorite',
      name: 'name',
    };

    const indexHintMap = {
      article_count: 'INDEXED BY idx_artcnt_name',
      high: 'INDEXED BY idx_high_name',
      count: 'INDEXED BY idx_count_name',
      name: 'INDEXED BY idx_newsgroups_srv_name',
    };

    const favIndexHintMap = {
      article_count: 'INDEXED BY idx_fav_artcnt',
      high: 'INDEXED BY idx_fav_high',
      count: 'INDEXED BY idx_fav_count',
      name: 'INDEXED BY idx_fav_name',
    };

    const orderExpression = sortColumnMap[sort] || 'name';
    // Only use index hints when NOT doing a contains-search (LIKE %x%).
    // Contains-style LIKE queries cannot use B-tree column indexes efficiently;
    // forcing INDEXED BY would cause wrong results or query errors.
    const indexHint = favoriteOnly && !search
      ? (favIndexHintMap[sort] || 'INDEXED BY idx_fav_name')
      : (!search && indexHintMap[sort] ? indexHintMap[sort] : '');

    // Fast Cached Total Matching Rows
    const searchCountKey = `searchCount:${serverId}:${queryParams.search || ''}:${favoriteOnly}`;
    const totalCount = getCachedCount(searchCountKey, () => {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM newsgroups ${whereSql}`).get(queryParams);
      return row ? row.cnt : 0;
    });

    // Fast Cached Total Groups in Database for this server
    const totalGroupsCount = getCachedCount(`totalGroups:${serverId}`, () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM newsgroups WHERE server_id = ?').get(serverId);
      return row ? row.cnt : 0;
    });

    // Fast Cached Total Favorites Count for this server
    const totalFavoritesCount = getCachedCount(`totalFavs:${serverId}`, () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM newsgroups WHERE server_id = ? AND is_favorite = 1').get(serverId);
      return row ? row.cnt : 0;
    });

    // Query Paginated Slice with Index Hint for Instant Response (0.4ms)
    const offset = (page - 1) * pageSize;
    const items = db.prepare(`
      SELECT server_id, name, high, low, status, count, article_count, rawNNTPLine, is_favorite
      FROM newsgroups ${indexHint}
      ${whereSql}
      ORDER BY ${orderExpression} ${order}
      LIMIT @pageSize OFFSET @offset
    `).all({ ...queryParams, pageSize, offset });

    const lastUpdatedRow = db.prepare("SELECT value FROM metadata WHERE key = ?").get(`lastUpdated_${serverId}`) || db.prepare("SELECT value FROM metadata WHERE key = 'lastUpdated'").get();

    return res.json({
      hasCache: totalGroupsCount > 0,
      groups: items,
      totalCount,
      totalGroupsCount,
      totalFavoritesCount: totalFavoritesCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize) || 1,
      lastUpdated: lastUpdatedRow ? lastUpdatedRow.value : null,
      serverId,
    });
  } catch (e) {
    console.error('SQLite Query Error:', e);
    return res.json({ hasCache: false, groups: [], totalCount: 0, page: 1, totalPages: 1, lastUpdated: null });
  }
});

// --- API: Get Favorites List Only (Filtered by serverId) ---
app.get('/api/favorites', (req, res) => {
  let serverId = req.query.serverId;
  if (!serverId) {
    const primaryRow = db.prepare('SELECT id FROM nntp_servers WHERE isPrimary = 1 LIMIT 1').get();
    serverId = primaryRow ? primaryRow.id : 'server-viper';
  }

  try {
    const rows = db.prepare('SELECT name, high, low, status, count, article_count FROM newsgroups WHERE server_id = ? AND is_favorite = 1').all(serverId);
    const favNames = rows.map((r) => r.name);
    return res.json({ favorites: favNames, favoriteObjects: rows, serverId });
  } catch (e) {
    return res.json({ favorites: [], favoriteObjects: [] });
  }
});

// --- API: Toggle Single Favorite ---
app.post('/api/favorites/toggle', (req, res) => {
  const { name, serverId: reqServerId } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  let serverId = reqServerId;
  if (!serverId) {
    const primaryRow = db.prepare('SELECT id FROM nntp_servers WHERE isPrimary = 1 LIMIT 1').get();
    serverId = primaryRow ? primaryRow.id : 'server-viper';
  }

  try {
    const row = db.prepare('SELECT is_favorite FROM newsgroups WHERE server_id = ? AND name = ?').get(serverId, name);
    let newFav = 1;
    if (row) {
      newFav = row.is_favorite === 1 ? 0 : 1;
      db.prepare('UPDATE newsgroups SET is_favorite = ? WHERE server_id = ? AND name = ?').run(newFav, serverId, name);
    } else {
      db.prepare('INSERT INTO newsgroups (server_id, name, is_favorite) VALUES (?, ?, 1)').run(serverId, name);
    }

    countCache.clear();
    const favRows = db.prepare('SELECT name FROM newsgroups WHERE server_id = ? AND is_favorite = 1').all(serverId);
    return res.json({ success: true, isFavorite: newFav === 1, favorites: favRows.map((r) => r.name) });
  } catch (e) {
    console.error('Failed to toggle favorite:', e);
    return res.status(500).json({ error: e.message });
  }
});

// --- API: Batch Save / Remove Favorites ---
app.post('/api/favorites/batch', (req, res) => {
  const { names, serverId: reqServerId, action = 'add' } = req.body;
  if (!Array.isArray(names)) return res.status(400).json({ error: 'Names array required' });

  let serverId = reqServerId;
  if (!serverId) {
    const primaryRow = db.prepare('SELECT id FROM nntp_servers WHERE isPrimary = 1 LIMIT 1').get();
    serverId = primaryRow ? primaryRow.id : 'server-viper';
  }

  try {
    let updateStmt;
    if (action === 'remove') {
      updateStmt = db.prepare('UPDATE newsgroups SET is_favorite = 0 WHERE server_id = ? AND name = ?');
    } else if (action === 'toggle') {
      updateStmt = db.prepare('UPDATE newsgroups SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE server_id = ? AND name = ?');
    } else {
      updateStmt = db.prepare('UPDATE newsgroups SET is_favorite = 1 WHERE server_id = ? AND name = ?');
    }

    const batchTx = db.transaction((groupNames) => {
      for (const name of groupNames) {
        updateStmt.run(serverId, name);
      }
    });
    batchTx(names);

    countCache.clear();
    const favRows = db.prepare('SELECT name FROM newsgroups WHERE server_id = ? AND is_favorite = 1').all(serverId);
    return res.json({ success: true, favorites: favRows.map((r) => r.name) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// --- API: Update Selected Groups Article Count ---
app.post('/api/newsgroups/update-counts', (req, res) => {
  const { names } = req.body;
  if (!Array.isArray(names)) return res.status(400).json({ error: 'Names array required' });

  try {
    const getStmt = db.prepare('SELECT high, low FROM newsgroups WHERE name = ?');
    const updateStmt = db.prepare('UPDATE newsgroups SET article_count = ? WHERE name = ?');

    const updateTx = db.transaction((groupNames) => {
      for (const name of groupNames) {
        const row = getStmt.get(name);
        if (row) {
          const high = parseInt((row.high || '0').replace(/,/g, ''), 10) || 0;
          const low = parseInt((row.low || '0').replace(/,/g, ''), 10) || 0;
          const realCount = (high >= low && low > 0) ? (high - low + 1) : 0;
          const formatted = `${realCount.toLocaleString()} articles`;
          updateStmt.run(formatted, name);
        }
      }
    });
    updateTx(names);

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// --- API: Get Servers List ---
app.get('/api/servers', (req, res) => {
  try {
    const servers = db.prepare('SELECT * FROM nntp_servers').all();
    const formatted = servers.map(s => ({
      ...s,
      useSSL: !!s.useSSL,
      isPrimary: !!s.isPrimary
    }));
    return res.json({ success: true, servers: formatted });
  } catch (e) {
    console.error('Failed to fetch servers:', e);
    return res.status(500).json({ error: e.message });
  }
});

// --- API: Save / Update Server ---
app.post('/api/servers/save', (req, res) => {
  const { id, name, host, port, useSSL, username, password, maxConnections, isPrimary, default_article_count } = req.body;
  if (!name || !host || !port) {
    return res.status(400).json({ error: 'Name, host, and port are required' });
  }

  try {
    if (isPrimary) {
      db.prepare('UPDATE nntp_servers SET isPrimary = 0').run();
    }

    const serverId = id || `server-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO nntp_servers 
      (id, name, host, port, useSSL, username, password, maxConnections, status, retention, syncedGroups, isPrimary, default_article_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      serverId,
      name,
      host,
      parseInt(port, 10),
      useSSL ? 1 : 0,
      username || '',
      password || '',
      parseInt(maxConnections || '10', 10),
      'Connected',
      '3000+ Days',
      0,
      isPrimary ? 1 : 0,
      default_article_count !== undefined ? parseInt(default_article_count, 10) : 300
    );

    const servers = db.prepare('SELECT * FROM nntp_servers').all().map(s => ({
      ...s,
      useSSL: !!s.useSSL,
      isPrimary: !!s.isPrimary
    }));

    return res.json({ success: true, servers });
  } catch (e) {
    console.error('Failed to save server:', e);
    return res.status(500).json({ error: e.message });
  }
});

// --- API: Delete Server ---
app.delete('/api/servers/:id', (req, res) => {
  const { id } = req.params;
  try {
    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM nntp_servers').get();
    if (countRow.cnt <= 1) {
      return res.status(400).json({ error: '최소 1개의 서버는 등록되어 있어야 합니다.' });
    }

    db.prepare('DELETE FROM nntp_servers WHERE id = ?').run(id);

    const servers = db.prepare('SELECT * FROM nntp_servers').all().map(s => ({
      ...s,
      useSSL: !!s.useSSL,
      isPrimary: !!s.isPrimary
    }));

    return res.json({ success: true, servers });
  } catch (e) {
    console.error('Failed to delete server:', e);
    return res.status(500).json({ error: e.message });
  }
});

// --- NEW API: Status Dashboard Stats ---
app.get('/api/dashboard/stats', (req, res) => {
  try {
    // Get server usage over the last 30 days
    const rows = db.prepare(`
      SELECT server_id, date, bytes_downloaded 
      FROM server_usage 
      WHERE date >= date('now', '-30 days')
      ORDER BY date ASC
    `).all();

    // Get total groups in DB
    const totalGroups = db.prepare("SELECT COUNT(*) as count FROM newsgroups").get().count;
    // Get total favorites
    const favGroups = db.prepare("SELECT COUNT(*) as count FROM newsgroups WHERE is_favorite = 1").get().count;

    res.json({ usage: rows, totalGroups, favGroups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard/favorites', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT n.server_id, n.name, n.num_article_count, n.num_high, n.num_low, 
             f.start_id, f.end_id, f.fetched_at
      FROM newsgroups n
      LEFT JOIN fetch_history f ON n.name = f.group_name AND n.server_id = f.server_id
      WHERE n.is_favorite = 1
      ORDER BY f.fetched_at DESC
    `).all();
    
    // Group by group name to show progress correctly
    const grouped = rows.reduce((acc, row) => {
      const key = `${row.server_id}|${row.name}`;
      if (!acc[key]) {
        acc[key] = {
          server_id: row.server_id,
          name: row.name,
          total_articles: row.num_article_count,
          low: row.num_low,
          high: row.num_high,
          ranges: []
        };
      }
      if (row.start_id && row.end_id) {
        acc[key].ranges.push({ start: row.start_id, end: row.end_id, fetched_at: row.fetched_at });
      }
      return acc;
    }, {});

    res.json(Object.values(grouped));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/favorites/toggle', express.json(), (req, res) => {
  try {
    const { serverId, name } = req.body;
    
    // get current favorite status
    const row = db.prepare('SELECT is_favorite FROM newsgroups WHERE server_id = ? AND name = ?').get(serverId, name);
    const newFav = row && row.is_favorite === 1 ? 0 : 1;
    
    db.prepare('UPDATE newsgroups SET is_favorite = ? WHERE server_id = ? AND name = ?').run(
      newFav, serverId, name
    );
    
    // Also return favorites to match frontend expectation
    const favs = db.prepare('SELECT name FROM newsgroups WHERE server_id = ? AND is_favorite = 1').all(serverId).map(r => r.name);
    res.json({ success: true, isFavorite: newFav === 1, favorites: favs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------
// DIRECTORY BROWSER API (For UI Folder Picker)
// ---------------------------------------------------------
app.get('/api/directories', (req, res) => {
  const targetPath = req.query.path || process.cwd();
  try {
    const resolvedPath = path.resolve(targetPath);
    const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const directories = items
      .filter(item => item.isDirectory())
      .map(item => item.name)
      .sort(); // Sort alphabetically
      
    // Get parent directory unless we are at root
    const parentPath = path.dirname(resolvedPath);
    
    res.json({
      currentPath: resolvedPath,
      parentPath: parentPath !== resolvedPath ? parentPath : null,
      directories
    });
  } catch (error) {
    console.error('Directory read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- yEnc decoding (binary-safe) ---
// Extracted to src/backend/yencDecoder.js and nntpClient.js

// --- Settings API (Global paths) ---
app.get('/api/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM metadata WHERE key IN (?, ?)').all('rawTemp', 'rawResult');
    const settings = { rawTemp: '', rawResult: '' };
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  const { rawTemp, rawResult } = req.body;
  try {
    const stmt = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    if (rawTemp !== undefined) stmt.run('rawTemp', rawTemp);
    if (rawResult !== undefined) stmt.run('rawResult', rawResult);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Download API (Server-side Save) ---
app.post('/api/download', async (req, res) => {
  const { type, group, filename, ids, serverId, nzbData } = req.body;
  if (!group || !filename) {
    return res.status(400).json({ error: 'Missing group or filename' });
  }

  // Create a tracking ID based on the first article ID
  const articleIds = (ids && (type === 'image' || type === 'file')) ? (Array.isArray(ids) ? ids : String(ids).split(',')) : [];
  const downloadId = articleIds.length > 0 ? articleIds[0].trim() : filename;

  // Immediately respond to avoid browser timeout
  res.json({ success: true, downloadId, message: 'Download started in background' });

  // Run in background
  (async () => {
    try {
      const row = db.prepare('SELECT value FROM metadata WHERE key = ?').get('rawResult');
      const rawResultPath = row && row.value ? row.value : path.join(__dirname, 'rawResult');
      
      const tempRow = db.prepare('SELECT value FROM metadata WHERE key = ?').get('rawTemp');
      const rawTempPath = tempRow && tempRow.value ? tempRow.value : path.join(__dirname, 'temp');

      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const folderName = `${yy}-${mm}-${dd}_${hh}-${min}_${group}`;
      const targetDir = path.join(rawResultPath, folderName);
      
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // 대책: 임시 폴더(Temp)는 이어받기(Cache)를 위해 시간(Time)에 종속되지 않도록 파일 고유 ID로 영구 고정
      const safeDownloadId = String(downloadId).replace(/[\\/:*?"<>|]/g, '_');
      const tempTargetDir = path.join(rawTempPath, `${group}_${safeDownloadId}`);
      if (!fs.existsSync(tempTargetDir)) {
        fs.mkdirSync(tempTargetDir, { recursive: true });
      }

      const targetFile = path.join(targetDir, filename);

      const broadcast = (msg) => {
        wss.clients.forEach((client) => {
          if (client.readyState === 1 /* WebSocket.OPEN */) {
            client.send(JSON.stringify(msg));
          }
        });
      };

      if (type === 'nzb' && nzbData) {
        fs.writeFileSync(targetFile, nzbData, 'utf-8');
        broadcast({ type: 'DOWNLOAD_COMPLETE', downloadId, success: true });
        return;
      } 
      else if ((type === 'image' || type === 'file') && articleIds.length > 0) {
        let serverConfig = {};
        if (serverId) {
          const srv = db.prepare('SELECT * FROM nntp_servers WHERE id = ?').get(serverId);
          if (srv) {
            serverConfig = { host: srv.host, port: srv.port, user: srv.username, pass: srv.password, maxConnections: srv.maxConnections };
          }
        }

        const decodedParts = [];
        const total = articleIds.length;
        
        // Broadcast initial state
        broadcast({ type: 'DOWNLOAD_PROGRESS', downloadId, current: 0, total });

        let completedCount = 0;
        const fetchPromises = articleIds.map(async (artId) => {
          const cleanArtId = artId.trim();
          // Create temp file path for caching inside the specific tempTargetDir
          const tempFilePath = path.join(tempTargetDir, `${cleanArtId.replace(/[\\/:*?"<>|]/g, '_')}.part`);
          
          try {
            let decoded;
            const metaPath = tempFilePath + '.meta';

            if (fs.existsSync(tempFilePath)) {
              // Cache hit: Already downloaded this chunk!
              let meta = {};
              if (fs.existsSync(metaPath)) {
                 meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
              }
              decoded = { 
                 buffer: null, 
                 tempFilePath, 
                 filename: meta.filename, 
                 part: meta.part, 
                 begin: meta.begin 
              }; 
            } else {
              // Fetch from server
              const rawBuf = await queueFetchArticleBodyRaw(group, cleanArtId, serverConfig, serverId || 'default');
              decoded = decodeYencArticle(rawBuf);
              
              if (decoded.buffer && decoded.buffer.length > 0) {
                // Save to temp cache!
                fs.writeFileSync(tempFilePath, decoded.buffer);
                
                // 파일명, 파트 번호 등 메타데이터도 같이 캐싱하여 나중에 이어받을 때 파일명을 까먹지 않게 함
                fs.writeFileSync(metaPath, JSON.stringify({
                  filename: decoded.filename,
                  part: decoded.part,
                  begin: decoded.begin
                }));

                decoded.tempFilePath = tempFilePath;
                // Free memory immediately
                decoded.buffer = null; 
              }
            }

            if (decoded) {
              decodedParts.push({
                 tempFilePath,
                 metaPath,
                 filename: decoded.filename,
                 part: decoded.part,
                 begin: decoded.begin,
                 originalOrder: articleIds.indexOf(artId) // Fallback for sorting
              });
            }
          } catch (err) {
            console.error(`Failed to fetch part ${cleanArtId}:`, err);
          } finally {
            completedCount++;
            broadcast({ type: 'DOWNLOAD_PROGRESS', downloadId, current: completedCount, total });
          }
        });

        // 병렬 다운로드 진행
        await Promise.all(fetchPromises);

        // 조립(Assemble) 시작 - 모든 파트가 정상적으로 받아졌는지 검증
        if (decodedParts.length === 0) {
           broadcast({ type: 'DOWNLOAD_COMPLETE', downloadId, success: false, error: 'No parts downloaded' });
           return;
        }
        
        if (decodedParts.length !== total) {
           console.error(`[Download Error] Missing parts detected. Expected: ${total}, Got: ${decodedParts.length}`);
           broadcast({ type: 'DOWNLOAD_COMPLETE', downloadId, success: false, error: `Missing parts (${total - decodedParts.length}). Please retry to resume.` });
           return;
        }

        // 진짜 파일명(filename)을 기준으로 조각들을 그룹화(Grouping)하여 짬뽕되는 것을 방지합니다.
        const filesGrouped = {};
        for (const p of decodedParts) {
           let pName = (p.filename && p.filename.trim() !== '') ? p.filename : filename;
           pName = pName.replace(/[\\/:*?"<>|]/g, '_').trim();
           if (!filesGrouped[pName]) filesGrouped[pName] = [];
           filesGrouped[pName].push(p);
        }

        // 그룹(파일)별로 정렬 및 개별 조립을 수행합니다.
        for (const [fName, parts] of Object.entries(filesGrouped)) {
           // 정렬: begin이 있으면 begin 기준, 없으면 part 기준, 둘 다 없으면 원본 리스트 순서 기준
           parts.sort((a, b) => {
             if (a.begin && b.begin) return a.begin - b.begin;
             if (a.part && b.part) return a.part - b.part;
             return a.originalOrder - b.originalOrder;
           });

           const finalTargetFile = path.join(targetDir, fName);
           
           // 메모리에 몽땅 올리지 않고 스트림 쓰기로 조립 (RAM 절약)
           const fd = fs.openSync(finalTargetFile, 'w');
           for (const p of parts) {
              if (fs.existsSync(p.tempFilePath)) {
                 const buf = fs.readFileSync(p.tempFilePath);
                 fs.writeSync(fd, buf);
                 // 조립이 끝난 임시 파일 및 메타데이터는 즉시 삭제
                 fs.unlinkSync(p.tempFilePath);
                 if (p.metaPath && fs.existsSync(p.metaPath)) {
                    fs.unlinkSync(p.metaPath);
                 }
              }
           }
           fs.closeSync(fd);
        }

        // 안의 조각들이 모두 지워졌으므로 껍데기만 남은 temp 하위 폴더도 삭제 (실패할 수 있으므로 try-catch)
        try {
           fs.rmdirSync(tempTargetDir);
        } catch(e) {
           // 비어있지 않거나 권한이 없으면 무시
        }

        broadcast({ type: 'DOWNLOAD_COMPLETE', downloadId, success: true });
      }
    } catch (err) {
      console.error('Background download error:', err);
      wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify({ type: 'DOWNLOAD_COMPLETE', downloadId, success: false, error: err.message }));
      });
    }
  })();
});

// Serves a multi-part yEnc article as a stitched image directly to an <img> tag.
app.get('/api/article-image', async (req, res) => {
  const { group, ids, id, serverId } = req.query;
  const articleIds = ids ? ids.split(',') : (id ? [id] : []);
  if (!group || articleIds.length === 0) {
    return res.status(400).send('Missing group or id(s)');
  }

  try {
    let serverConfig = {};
    if (serverId) {
      const srv = db.prepare('SELECT * FROM nntp_servers WHERE id = ?').get(serverId);
      if (srv) {
        serverConfig = { host: srv.host, port: srv.port, user: srv.username, pass: srv.password, maxConnections: srv.maxConnections };
        console.log(`📡 /api/article-image: using server [${serverId}] host=${srv.host}`);
      }
    }

    const decodedParts = [];
    
    // Fetch and decode parts in parallel (queue system will manage connection limits)
    const fetchPromises = articleIds.map(async (artId) => {
      try {
        const rawBuf = await queueFetchArticleBodyRaw(group, artId.trim(), serverConfig, serverId || 'default');
        const decoded = decodeYencArticle(rawBuf);
        if (decoded.buffer && decoded.buffer.length > 0) {
          decodedParts.push(decoded);
        } else {
          console.error(`[API Image] decodeYencArticle returned empty buffer for article ${artId}`);
        }
      } catch (err) {
        console.error(`[API Image] Failed to fetch or decode article ${artId}:`, err.message);
      }
    });

    await Promise.all(fetchPromises);

    const assembled = assembleYencParts(decodedParts);
    if (!assembled || !assembled.buffer || assembled.buffer.length === 0) {
       return res.status(500).send('yEnc assembly failed or empty buffer');
    }

    const { filename, buffer } = assembled;
    const ext = filename ? filename.split('.').pop().toLowerCase() : 'jpg';
    let mime = 'image/jpeg';
    if (ext === 'png') mime = 'image/png';
    else if (ext === 'gif') mime = 'image/gif';
    else if (ext === 'webp') mime = 'image/webp';

    res.set('Content-Type', mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);

  } catch (err) {
    console.error('Error fetching image:', err);
    res.status(500).send('Failed to fetch image: ' + err.message);
  }
});

app.post('/api/disconnect', (req, res) => {
  console.log('\n[API] /api/disconnect called by user. Closing all NNTP bridge sessions.');
  closeAllIdleSockets();
  for (const session of allActiveSessions) {
    if (session.socket && !session.socket.destroyed && session.socket.writable) {
      try {
        session.socket.write('QUIT\r\n');
        setTimeout(() => session.socket.destroy(), 50);
      } catch (e) {}
    }
  }
  res.json({ success: true, message: 'All NNTP connections closed.' });
});

// Track all active sessions globally to ensure clean shutdown on Ctrl+C
const allActiveSessions = new Set();

process.on('SIGINT', () => {
  console.log('\n[SERVER] Shutting down gracefully... Closing NNTP bridge sessions.');
  for (const session of allActiveSessions) {
    if (session.socket && !session.socket.destroyed && session.socket.writable) {
      try {
        session.socket.write('QUIT\r\n');
        setTimeout(() => session.socket.destroy(), 50);
      } catch (e) {}
    }
  }
  // nntpClient.js also has a SIGINT handler that will process.exit(0)
});

// WebSocket Server & NNTP Bridge
wss.on('connection', (ws) => {
  console.log('🌐 Frontend WebSocket Connected');

  // Map of serverId -> NNTP session object
  const sessions = new Map();

  const safeWrite = (session, msg) => {
    if (session.socket && !session.socket.destroyed && session.socket.writable) {
      session.socket.write(msg);
    } else {
      console.warn(`⚠️ NNTP socket [${session.serverId}] not writable, skipping command:`, msg.trim());
    }
  };

  const getOrCreateSession = async (serverId) => {
    if (!serverId) throw new Error('serverId is required');
    if (sessions.has(serverId)) {
      const existing = sessions.get(serverId);
      if (existing.socket && !existing.socket.destroyed && existing.socket.writable) {
        return existing;
      }
      console.log(`🔄 Re-establishing closed NNTP socket session for [${serverId}]...`);
      sessions.delete(serverId);
      allActiveSessions.delete(existing);
    }

    const srvRow = db.prepare('SELECT host, port, useSSL, username, password FROM nntp_servers WHERE id = ?').get(serverId);
    if (!srvRow) throw new Error(`Server ${serverId} not found in DB`);

    const session = {
      serverId,
      socket: null,
      authStep: 0,
      isDownloadingGroups: false,
      downloadedGroups: [],
      isFetchingBody: false,
      bodyArticleId: null,
      bodyLines: [],
      pendingBodyAfterGroup: null,
      pendingXoverAfterGroup: null,
      pageTimeoutId: null,
      isFetchingPage: false,
      pageLines: [],
      incomingBuffer: '',
    };
    sessions.set(serverId, session);
    allActiveSessions.add(session);

    return new Promise((resolve, reject) => {
      const socket = tls.connect({ host: srvRow.host, port: srvRow.port, rejectUnauthorized: false, family: 4 }, () => {
        console.log(`🔒 Connected to ${srvRow.host} NNTP TLS [${serverId}]`);
        ws.send(JSON.stringify({ type: 'STATUS', message: `Connected to ${srvRow.host} SSL` }));
      });
      session.socket = socket;

      socket.on('error', (err) => {
        console.error(`⚠️ NNTP TLS Socket Error [${serverId}]:`, err.message);
        sessions.delete(serverId);
        allActiveSessions.delete(session);
      });

      socket.on('close', () => {
        console.log(`🔌 NNTP TLS Socket Closed [${serverId}]`);
        sessions.delete(serverId);
        allActiveSessions.delete(session);
      });

      socket.on('data', (data) => {
        global.recordServerUsage(serverId, data.length);
        session.incomingBuffer += data.toString('utf-8');
        const lines = session.incomingBuffer.split('\r\n');
        session.incomingBuffer = lines.pop();

        for (const line of lines) {
          if (!line) continue;

          if (line.startsWith('5') || (session.authStep < 4 && line.startsWith('4'))) {
             if (session.authStep < 3) {
                 reject(new Error(`NNTP Auth failed: ${line}`));
             }
          }

          if (session.authStep === 0 && (line.startsWith('200') || line.startsWith('201'))) {
            session.authStep = 1;
            safeWrite(session, `AUTHINFO USER ${srvRow.username}\r\n`);
          } else if (session.authStep === 1 && line.startsWith('381')) {
            session.authStep = 2;
            safeWrite(session, `AUTHINFO PASS ${srvRow.password}\r\n`);
          } else if (session.authStep === 2 && line.startsWith('281')) {
            session.authStep = 3;
            console.log(`🎉 NNTP AUTH SUCCESSFUL! [${serverId}]`);
            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', user: srvRow.username, serverId }));
            resolve(session);
          } else if (session.isDownloadingGroups) {
            if (line === '.') {
              session.isDownloadingGroups = false;
              const lastUpdated = new Date().toISOString();

              console.log(`✅ Downloaded ${session.downloadedGroups.length.toLocaleString()} newsgroups for server [${serverId}]. Saving into SQLite DB...`);
              try {
                const upsertStmt = db.prepare(`
                  INSERT INTO newsgroups (server_id, name, high, low, status, count, article_count, rawNNTPLine, num_high, num_low, num_count, num_article_count)
                  VALUES (@server_id, @name, @high, @low, @status, @count, @article_count, @rawNNTPLine, @num_high, @num_low, @num_count, @num_article_count)
                  ON CONFLICT(server_id, name) DO UPDATE SET
                    high = excluded.high,
                    low = excluded.low,
                    status = excluded.status,
                    count = excluded.count,
                    article_count = excluded.article_count,
                    rawNNTPLine = excluded.rawNNTPLine,
                    num_high = excluded.num_high,
                    num_low = excluded.num_low,
                    num_count = excluded.num_count,
                    num_article_count = excluded.num_article_count
                `);

                const insertBatch = db.transaction((items) => {
                  db.prepare('DELETE FROM newsgroups WHERE server_id = ? AND is_favorite = 0').run(serverId);
                  for (const item of items) {
                    upsertStmt.run(item);
                  }
                  db.prepare('UPDATE nntp_servers SET syncedGroups = ? WHERE id = ?').run(items.length, serverId);
                });
                insertBatch(session.downloadedGroups);

                countCache.clear();

                db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run(`lastUpdated_${serverId}`, lastUpdated);
                db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('lastUpdated', lastUpdated);
                console.log(`💾 SQLite DB successfully updated with ${session.downloadedGroups.length.toLocaleString()} groups for [${serverId}]!`);

                ws.send(JSON.stringify({ type: 'FETCH_GROUPS_SUCCESS', count: session.downloadedGroups.length, lastUpdated, serverId }));
              } catch (err) {
                console.error('Failed to save newsgroups into SQLite DB:', err);
                ws.send(JSON.stringify({ type: 'FETCH_GROUPS_ERROR', message: err.message }));
              }
            } else if (line.startsWith('215')) {
              console.log('📋 LIST response receiving...');
            } else {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 3) {
                const groupName = parts[0];
                const high = parseInt(parts[1], 10) || 0;
                const low = parseInt(parts[2], 10) || 0;
                const realCount = (high >= low && low > 0) ? (high - low + 1) : 0;
                if (groupName && !groupName.startsWith('215')) {
                  session.downloadedGroups.push({
                    server_id: serverId,
                    name: groupName,
                    count: high.toLocaleString(),
                    high: high.toLocaleString(),
                    low: low.toLocaleString(),
                    status: parts[3] || 'y',
                    article_count: realCount.toLocaleString(),
                    rawNNTPLine: line.trim(),
                    num_high: high,
                    num_low: low,
                    num_count: high,
                    num_article_count: realCount,
                  });

                  if (session.downloadedGroups.length % 100000 === 0) {
                    console.log(`📥 Progress: Downloaded ${session.downloadedGroups.length.toLocaleString()} groups...`);
                    ws.send(JSON.stringify({ type: 'FETCH_GROUPS_PROGRESS', count: session.downloadedGroups.length }));
                  }
                }
              }
            }
          } else if (session.isFetchingBody) {
            if (line === '.') {
              session.isFetchingBody = false;
              ws.send(
                JSON.stringify({
                  type: 'ARTICLE_BODY_SUCCESS',
                  articleId: session.bodyArticleId,
                  body: session.bodyLines.join('\n'),
                })
              );
              session.bodyLines = [];
            } else if (line.startsWith('220 ') || line.startsWith('222 ') || line.startsWith('221 ')) {
              console.log(`📄 BODY response header: ${line}`);
            } else if (line.startsWith('430 ') || line.startsWith('423 ')) {
              session.isFetchingBody = false;
              ws.send(
                JSON.stringify({
                  type: 'ARTICLE_BODY_ERROR',
                  articleId: session.bodyArticleId,
                  message: `Failed to fetch article body from server: ${line}`,
                })
              );
              session.bodyLines = [];
            } else {
              session.bodyLines.push(line);
            }
          } else if (session.isFetchingPage) {
            if (line === '.') {
              session.isFetchingPage = false;
              if (session.pageTimeoutId) {
                clearTimeout(session.pageTimeoutId);
                session.pageTimeoutId = null;
              }
              
              if (session.fetchPageGroup && session.fetchPageStart && session.fetchPageEnd) {
                try {
                  const now = Date.now();
                  const insertArticle = db.prepare('INSERT OR REPLACE INTO article_cache (server_id, group_name, article_id, raw_line, fetched_at) VALUES (?, ?, ?, ?, ?)');
                  const insertBatch = db.transaction((linesToSave) => {
                    for (const l of linesToSave) {
                      const idStr = l.split('\t')[0];
                      const articleId = parseInt(idStr, 10);
                      if (!isNaN(articleId)) {
                        insertArticle.run(serverId, session.fetchPageGroup, articleId, l, now);
                      }
                    }
                  });
                  insertBatch(session.pageLines);
                  
                  db.prepare('INSERT OR REPLACE INTO fetch_history (server_id, group_name, start_id, end_id, fetched_at) VALUES (?, ?, ?, ?, ?)')
                    .run(serverId, session.fetchPageGroup, session.fetchPageStart, session.fetchPageEnd, now);
                  console.log(`💾 Cached ${session.pageLines.length} articles for ${session.fetchPageGroup} (${session.fetchPageStart}-${session.fetchPageEnd})`);
                } catch (e) {
                  console.error('Cache save error:', e);
                }
              }

              ws.send(JSON.stringify({ type: 'PAGE_FETCH_COMPLETE', group: session.fetchPageGroup, lines: session.pageLines }));
              session.pageLines = [];
            } else if (line.startsWith('224')) {
              console.log('📰 XOVER response receiving...');
              if (session.pageTimeoutId) {
                clearTimeout(session.pageTimeoutId);
                session.pageTimeoutId = null;
              }
              if (session.fetchPageEnd && session.fetchPageStart) {
                const totalExpected = session.fetchPageEnd - session.fetchPageStart + 1;
                ws.send(JSON.stringify({ 
                  type: 'PAGE_FETCH_PROGRESS', 
                  current: 0, 
                  total: totalExpected 
                }));
              }
            } else if (!line.includes('\t') && /^4\d\d(\s|$)/.test(line)) {
              session.isFetchingPage = false;
              if (session.pageTimeoutId) {
                clearTimeout(session.pageTimeoutId);
                session.pageTimeoutId = null;
              }
              ws.send(JSON.stringify({ type: 'PAGE_FETCH_COMPLETE', group: session.fetchPageGroup, empty: true, lines: session.pageLines }));
              session.pageLines = [];
            } else {
              session.pageLines.push(line);
              const now = Date.now();
              if ((!session.lastProgressTime || now - session.lastProgressTime > 250 || session.pageLines.length % 1000 === 0) && session.fetchPageEnd && session.fetchPageStart) {
                session.lastProgressTime = now;
                const totalExpected = session.fetchPageEnd - session.fetchPageStart + 1;
                console.log(`[Progress] Sent PAGE_FETCH_PROGRESS: ${session.pageLines.length} / ${totalExpected}`);
                ws.send(JSON.stringify({ 
                  type: 'PAGE_FETCH_PROGRESS', 
                  current: session.pageLines.length, 
                  total: totalExpected 
                }));
              }
            }
          } else if (line.startsWith('211 ')) {
            const parts = line.trim().split(/\s+/);
            const count = parts[1];
            const low = parts[2];
            const high = parts[3];
            const groupName = parts[4];
            console.log(`>>> GROUP response: count=${count} low=${low} high=${high} group=${groupName} [${serverId}]`);

            if (session.pendingBodyAfterGroup) {
              const pendingId = session.pendingBodyAfterGroup;
              session.pendingBodyAfterGroup = null;
              console.log(`>>> GROUP confirmed — now sending BODY ${pendingId}`);
              session.isFetchingBody = true;
              session.bodyArticleId = pendingId;
              session.bodyLines = [];
              safeWrite(session, `BODY ${pendingId}\r\n`);
              return;
            }

            if (session.pendingXoverAfterGroup) {
              const { start, end } = session.pendingXoverAfterGroup;
              session.pendingXoverAfterGroup = null;
              console.log(`>>> GROUP confirmed — now sending XOVER ${start}-${end}`);
              session.isFetchingPage = true;
              safeWrite(session, `XOVER ${start}-${end}\r\n`);
              return;
            }

            ws.send(
              JSON.stringify({
                type: 'GROUP_SUCCESS',
                group: groupName,
                count,
                low,
                high,
              })
            );
          } else if (line.startsWith('411')) {
            ws.send(JSON.stringify({ type: 'GROUP_ERROR', message: 'No such newsgroup' }));
          } else {
            ws.send(JSON.stringify({ type: 'NNTP_LINE', line }));
          }
        }
      });
    });
  };

  // Send initial WebSocket status without consuming NNTP sockets
  ws.send(JSON.stringify({ type: 'STATUS', message: 'Ready' }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'SAVE_FAVORITES') {
        if (Array.isArray(data.favorites)) {
          const resetStmt = db.prepare('UPDATE newsgroups SET is_favorite = 0');
          const setStmt = db.prepare('UPDATE newsgroups SET is_favorite = 1 WHERE name = ?');
          const tx = db.transaction((favList) => {
            resetStmt.run();
            for (const name of favList) {
              setStmt.run(name);
            }
          });
          tx(data.favorites);
          console.log(`⭐ Saved ${data.favorites.length} favorites to SQLite DB!`);
        }
        return;
      }

      const serverId = data.serverId;
      if (!serverId && data.type !== 'STATUS') {
        console.warn(`⚠️ No serverId provided in WS message [${data.type}]. Some features may fail if not initialized.`);
        return;
      }

      let session;
      if (serverId) {
        try {
          session = await getOrCreateSession(serverId);
        } catch (err) {
          console.error(`Failed to get NNTP session for ${serverId}:`, err);
          return;
        }
      }

      if (data.type === 'FETCH_SERVER_NEWSGROUPS' && session && session.authStep === 3) {
        console.log(`>>> FETCHING FULL NEWSGROUPS FROM SERVER (LIST) FOR [${serverId}]`);
        session.isDownloadingGroups = true;
        session.downloadedGroups = [];
        safeWrite(session, 'LIST\r\n');
      } else if (data.type === 'FETCH_ARTICLE_BODY' && session && session.authStep === 3) {
        console.log(`>>> FETCH ARTICLE BODY FOR: ${data.articleId} IN ${data.group} [${serverId}]`);
        if (data.group) {
          session.pendingBodyAfterGroup = data.articleId;
          safeWrite(session, `GROUP ${data.group}\r\n`);
        } else {
          session.isFetchingBody = true;
          session.bodyArticleId = data.articleId;
          session.bodyLines = [];
          safeWrite(session, `BODY ${data.articleId}\r\n`);
        }
      } else if (data.type === 'SELECT_GROUP' && session && session.authStep === 3) {
        console.log(`>>> GROUP ${data.group} [${serverId}]`);
        safeWrite(session, `GROUP ${data.group}\r\n`);
      } else if (data.type === 'FETCH_PAGE' && session && session.authStep === 3) {
        const { group, low, high, page = 1, limit = 20, forceRefresh = false } = data;
        const end = Math.max(parseInt(low, 10), parseInt(high, 10) - (page - 1) * limit);
        const start = Math.max(parseInt(low, 10), end - limit + 1);

        console.log(`>>> FETCH PAGE ${page}: XOVER ${start}-${end} [${serverId}]`);

        let cacheHit = false;
        if (!forceRefresh && group) {
          try {
            const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
            const history = db.prepare('SELECT 1 FROM fetch_history WHERE server_id = ? AND group_name = ? AND start_id <= ? AND end_id >= ? AND fetched_at > ? LIMIT 1')
              .get(serverId, group, start, end, twentyFourHoursAgo);
            
            if (history) {
              const cachedArticles = db.prepare('SELECT raw_line FROM article_cache WHERE server_id = ? AND group_name = ? AND article_id BETWEEN ? AND ? ORDER BY article_id ASC')
                .all(serverId, group, start, end);
              
              const lines = cachedArticles.map(a => a.raw_line);
              console.log(`⚡ CACHE HIT for ${group} (${start}-${end}): Returned ${lines.length} articles instantly.`);
              ws.send(JSON.stringify({ type: 'PAGE_FETCH_COMPLETE', group, lines, fromCache: true }));
              cacheHit = true;
            }
          } catch (e) {
            console.error('Cache read error:', e);
          }
        }

        if (!cacheHit) {
          session.fetchPageGroup = group;
          session.fetchPageStart = start;
          session.fetchPageEnd = end;
          
          if (session.pageTimeoutId) clearTimeout(session.pageTimeoutId);
          session.pageTimeoutId = setTimeout(() => {
            if (session.isFetchingPage || session.pendingXoverAfterGroup) {
              console.warn(`[!] FETCH_PAGE timeout for ${start}-${end}`);
              session.isFetchingPage = false;
              session.pendingXoverAfterGroup = null;
              session.pageTimeoutId = null;
              ws.send(JSON.stringify({ type: 'PAGE_FETCH_COMPLETE', group: session.fetchPageGroup, empty: true, lines: [] }));
              if (session.socket && !session.socket.destroyed) {
                session.socket.destroy();
              }
            }
          }, 60000);

          session.pendingXoverAfterGroup = { start, end };
          safeWrite(session, `GROUP ${group}\r\n`);
        }
      } else if (data.type === 'REFRESH' && session && session.authStep === 3) {
        if (data.group) {
          console.log(`>>> REFRESH GROUP ${data.group} [${serverId}]`);
          safeWrite(session, `GROUP ${data.group}\r\n`);
        }
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    for (const session of sessions.values()) {
      if (session.socket) {
        session.socket.end();
      }
      allActiveSessions.delete(session);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 NNTP Bridge Server with SQLite DB running on http://localhost:${PORT}`);
});
