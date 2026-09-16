import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import tls from 'tls';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

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
  const adminUser = process.env.ADMIN_USERNAME || 'geehong';
  const adminPass = process.env.ADMIN_PASSWORD || 'Power@6740';

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const creds = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
    const [user, pass] = creds.split(':');
    if (user === adminUser && pass === adminPass) {
      return next();
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="NNTP Web Client"');
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
db.pragma('journal_mode = WAL');

// Create Tables & Indexes
db.exec(`
  CREATE TABLE IF NOT EXISTS newsgroups (
    name TEXT PRIMARY KEY,
    high TEXT,
    low TEXT,
    status TEXT,
    count TEXT,
    article_count TEXT,
    rawNNTPLine TEXT,
    is_favorite INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_newsgroups_name ON newsgroups(name);
  CREATE INDEX IF NOT EXISTS idx_newsgroups_fav ON newsgroups(is_favorite);

  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Auto Migration from legacy JSON files if DB is empty
const groupCountRow = db.prepare('SELECT COUNT(*) as cnt FROM newsgroups').get();
if (groupCountRow.cnt === 0 && fs.existsSync(JSON_CACHE_FILE)) {
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
      INSERT OR REPLACE INTO newsgroups (name, high, low, status, count, article_count, rawNNTPLine, is_favorite)
      VALUES (@name, @high, @low, @status, @count, @article_count, @rawNNTPLine, @is_favorite)
    `);

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        const high = item.high !== undefined ? item.high.toString() : (item.count !== undefined ? item.count.toString() : '0');
        const low = item.low !== undefined ? item.low.toString() : '1';
        const status = item.status || 'y';
        const count = item.count !== undefined ? item.count.toString() : high;
        const article_count = item.article_count !== undefined ? item.article_count.toString() : '0';
        const rawNNTPLine = item.rawNNTPLine || `${item.name} ${high.replace(/,/g, '')} ${low.replace(/,/g, '')} ${status}`;
        const is_favorite = favSet.has(item.name) ? 1 : 0;

        insertStmt.run({
          name: item.name,
          high,
          low,
          status,
          count,
          article_count,
          rawNNTPLine,
          is_favorite,
        });
      }
    });

    insertMany(rawArray);
    db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('lastUpdated', lastUpdated);
    console.log(`✅ Successfully migrated ${rawArray.length.toLocaleString()} items to SQLite DB!`);
  } catch (e) {
    console.error('Failed legacy migration to SQLite:', e);
  }
}

// --- API: Get Paginated & Filtered Newsgroups (Ultra-Fast SQLite Indexing) ---
app.get('/api/newsgroups', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.max(1, parseInt(req.query.pageSize || '25', 10));
  const search = (req.query.search || '').trim().toLowerCase();
  const sort = req.query.sort || 'name';
  const order = (req.query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const favoriteOnly = req.query.favoriteOnly === 'true';

  try {
    let whereClauses = [];
    let queryParams = {};

    if (search) {
      whereClauses.push('name LIKE @search');
      queryParams.search = `%${search}%`;
    }
    if (favoriteOnly) {
      whereClauses.push('is_favorite = 1');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Sanitize and handle numeric casting for SQLite sorting
    const numericCols = ['high', 'low', 'count', 'article_count'];
    let orderExpression = 'name';
    if (numericCols.includes(sort)) {
      orderExpression = `CAST(REPLACE(REPLACE(IFNULL(${sort}, '0'), ',', ''), ' articles', '') AS INTEGER)`;
    } else if (['status', 'is_favorite', 'name'].includes(sort)) {
      orderExpression = sort;
    }

    // Count Total Matching Rows
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM newsgroups ${whereSql}`).get(queryParams);
    const totalCount = countRow.cnt;

    // Total Groups in Database
    const totalGroupsRow = db.prepare('SELECT COUNT(*) as cnt FROM newsgroups').get();
    const totalGroupsCount = totalGroupsRow.cnt;

    // Total Favorites Count
    const favCountRow = db.prepare('SELECT COUNT(*) as cnt FROM newsgroups WHERE is_favorite = 1').get();

    // Query Paginated Slice
    const offset = (page - 1) * pageSize;
    const items = db.prepare(`
      SELECT name, high, low, status, count, article_count, rawNNTPLine, is_favorite
      FROM newsgroups
      ${whereSql}
      ORDER BY ${orderExpression} ${order}
      LIMIT @pageSize OFFSET @offset
    `).all({ ...queryParams, pageSize, offset });

    const lastUpdatedRow = db.prepare("SELECT value FROM metadata WHERE key = 'lastUpdated'").get();

    return res.json({
      hasCache: totalGroupsCount > 0,
      groups: items,
      totalCount,
      totalGroupsCount,
      totalFavoritesCount: favCountRow.cnt,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize) || 1,
      lastUpdated: lastUpdatedRow ? lastUpdatedRow.value : null,
    });
  } catch (e) {
    console.error('SQLite Query Error:', e);
    return res.json({ hasCache: false, groups: [], totalCount: 0, page: 1, totalPages: 1, lastUpdated: null });
  }
});

// --- API: Get Favorites List Only ---
app.get('/api/favorites', (req, res) => {
  try {
    const rows = db.prepare('SELECT name, high, low, status, count, article_count FROM newsgroups WHERE is_favorite = 1').all();
    const favNames = rows.map((r) => r.name);
    return res.json({ favorites: favNames, favoriteObjects: rows });
  } catch (e) {
    return res.json({ favorites: [], favoriteObjects: [] });
  }
});

// --- API: Toggle Single Favorite ---
app.post('/api/favorites/toggle', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const row = db.prepare('SELECT is_favorite FROM newsgroups WHERE name = ?').get(name);
    let newFav = 1;
    if (row) {
      newFav = row.is_favorite === 1 ? 0 : 1;
      db.prepare('UPDATE newsgroups SET is_favorite = ? WHERE name = ?').run(newFav, name);
    } else {
      db.prepare('INSERT INTO newsgroups (name, is_favorite) VALUES (?, 1)').run(name);
    }

    const favRows = db.prepare('SELECT name FROM newsgroups WHERE is_favorite = 1').all();
    return res.json({ success: true, isFavorite: newFav === 1, favorites: favRows.map((r) => r.name) });
  } catch (e) {
    console.error('Failed to toggle favorite:', e);
    return res.status(500).json({ error: e.message });
  }
});

// --- API: Batch Save Favorites ---
app.post('/api/favorites/batch', (req, res) => {
  const { names } = req.body;
  if (!Array.isArray(names)) return res.status(400).json({ error: 'Names array required' });

  try {
    const updateStmt = db.prepare('UPDATE newsgroups SET is_favorite = 1 WHERE name = ?');
    const batchTx = db.transaction((groupNames) => {
      for (const name of groupNames) {
        updateStmt.run(name);
      }
    });
    batchTx(names);

    const favRows = db.prepare('SELECT name FROM newsgroups WHERE is_favorite = 1').all();
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

    return res.json({ success: true, updatedCount: names.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// --- yEnc decoding (binary-safe) ---
// yEnc maps each raw byte to a printable char via (byte + 42) mod 256, with
// '=' (0x3D) as an escape marker for a following further-shifted byte. It's
// applied per decoded NNTP line (after undoing NNTP's leading-dot stuffing),
// so this operates on raw Buffers end-to-end — never through a UTF-8 string,
// which would corrupt the high-bit byte values yEnc deliberately produces.
function decodeYencLine(lineBuf, out) {
  for (let i = 0; i < lineBuf.length; i++) {
    let b = lineBuf[i];
    if (b === 0x3d) {
      i++;
      if (i >= lineBuf.length) break;
      b = lineBuf[i];
      out.push((b - 64 - 42) & 0xff);
    } else {
      out.push((b - 42) & 0xff);
    }
  }
}

// Parses a raw (binary) NNTP BODY response — CRLF-delimited lines, terminated
// by a lone "." line, with ".."-prefixed lines un-dot-stuffed — into the
// decoded image bytes plus the filename declared in the =ybegin header.
function decodeYencArticle(rawBuf) {
  const CRLF = Buffer.from('\r\n');
  let start = 0;
  let filename = null;
  let inData = false;
  const outBytes = [];

  while (start <= rawBuf.length) {
    const idx = rawBuf.indexOf(CRLF, start);
    const end = idx === -1 ? rawBuf.length : idx;
    let line = rawBuf.subarray(start, end);
    start = idx === -1 ? rawBuf.length + 1 : idx + 2;

    if (line.length === 1 && line[0] === 0x2e) break; // lone "."
    if (line.length > 0 && line[0] === 0x2e) line = line.subarray(1); // dot-stuffing

    const asciiPrefix = line.subarray(0, 8).toString('latin1');
    if (asciiPrefix.startsWith('=ybegin')) {
      const text = line.toString('latin1');
      const m = text.match(/\bname=(.+)$/);
      filename = m ? m[1].trim() : null;
      inData = true;
      continue;
    }
    if (asciiPrefix.startsWith('=ypart')) continue;
    if (asciiPrefix.startsWith('=yend')) break;

    if (inData && line.length > 0) decodeYencLine(line, outBytes);
    if (idx === -1) break;
  }

  return { filename, buffer: Buffer.from(outBytes) };
}

// Opens a fresh, short-lived NNTP TLS connection to fetch one article body as
// raw bytes (never decoded through a text encoding) so yEnc/binary payloads
// survive intact.
function fetchArticleBodyRaw(group, articleId) {
  return new Promise((resolve, reject) => {
    const host = process.env.NNTP_HOST || 'news.usenet.farm';
    const port = parseInt(process.env.NNTP_PORT || '563', 10);
    const user = (process.env.NNTP_USER || '').split('#')[0].trim();
    const pass = (process.env.NNTP_PASS || '').split('#')[0].trim();

    const socket = tls.connect({ host, port, rejectUnauthorized: false });
    let authStep = 0;
    let buffered = Buffer.alloc(0);
    let bodyStarted = false;
    const CRLF = Buffer.from('\r\n');

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('NNTP request timed out'));
    }, 20000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.destroy();
    };

    socket.on('error', (err) => {
      cleanup();
      reject(err);
    });

    socket.on('data', (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);

      if (bodyStarted) {
        // Look for the terminating CRLF.CRLF sequence to know when the
        // dot-stuffed body is complete before handing it to the decoder.
        const termIdx = buffered.indexOf(Buffer.from('\r\n.\r\n'));
        if (termIdx !== -1) {
          const body = buffered.subarray(0, termIdx + 2); // keep trailing CRLF, drop "."+"\r\n"... handled by decodeYencArticle's "." line check
          cleanup();
          resolve(body);
        }
        return;
      }

      let idx;
      while ((idx = buffered.indexOf(CRLF)) !== -1) {
        const line = buffered.subarray(0, idx).toString('latin1');
        buffered = buffered.subarray(idx + 2);

        if (authStep === 0 && (line.startsWith('200') || line.startsWith('201'))) {
          authStep = 1;
          socket.write(`AUTHINFO USER ${user}\r\n`);
        } else if (authStep === 1 && line.startsWith('381')) {
          authStep = 2;
          socket.write(`AUTHINFO PASS ${pass}\r\n`);
        } else if (authStep === 2 && line.startsWith('281')) {
          authStep = 3;
          socket.write(`GROUP ${group}\r\n`);
        } else if (authStep === 3 && line.startsWith('211')) {
          authStep = 4;
          socket.write(`BODY ${articleId}\r\n`);
        } else if (authStep === 4 && (line.startsWith('420') || line.startsWith('423') || line.startsWith('430'))) {
          cleanup();
          reject(new Error(`Article not found: ${line}`));
          return;
        } else if (authStep === 4 && (line.startsWith('220') || line.startsWith('222'))) {
          authStep = 5;
          bodyStarted = true;
          // Whatever's left in `buffered` after this header line is already
          // body data — don't drop it.
          break;
        } else if (authStep >= 3 && /^4\d\d/.test(line)) {
          cleanup();
          reject(new Error(`NNTP error: ${line}`));
          return;
        }
      }

      // The whole body (or the remainder after the status line just parsed
      // above) may already be sitting in `buffered` within this same chunk —
      // check for the terminator now rather than waiting for another 'data'
      // event that might never come.
      if (bodyStarted) {
        const termIdx = buffered.indexOf(Buffer.from('\r\n.\r\n'));
        if (termIdx !== -1) {
          const body = buffered.subarray(0, termIdx + 2);
          cleanup();
          resolve(body);
        }
      }
    });
  });
}

app.get('/api/article-image', async (req, res) => {
  const { group, id } = req.query;
  if (!group || !id) return res.status(400).json({ error: 'group and id are required' });

  try {
    const rawBody = await fetchArticleBodyRaw(group, id);
    const { filename, buffer } = decodeYencArticle(rawBody);

    if (!buffer || buffer.length === 0) {
      return res.status(422).json({ error: 'No yEnc-encoded data found in article' });
    }

    const ext = (filename || '').toLowerCase().split('.').pop();
    const mimeMap = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (e) {
    console.error('Failed to fetch/decode article image:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// WebSocket Server & NNTP Bridge
wss.on('connection', (ws) => {
  console.log('🌐 Frontend WebSocket Connected');

  let nntpSocket = null;
  let authStep = 0;
  let isDownloadingGroups = false;
  let downloadedGroups = [];

  let isFetchingBody = false;
  let bodyArticleId = null;
  let bodyLines = [];

  let isFetchingPage = false;
  let pageLines = [];

  const host = process.env.NNTP_HOST || 'news.usenet.farm';
  const port = parseInt(process.env.NNTP_PORT || '563', 10);
  const user = (process.env.NNTP_USER || '').split('#')[0].trim();
  const pass = (process.env.NNTP_PASS || '').split('#')[0].trim();

  const safeWrite = (msg) => {
    if (nntpSocket && !nntpSocket.destroyed && nntpSocket.writable) {
      nntpSocket.write(msg);
    } else {
      console.warn('⚠️ NNTP socket not writable, skipping command:', msg.trim());
    }
  };

  nntpSocket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
    console.log('🔒 Connected to Usenet.Farm NNTP TLS');
    ws.send(JSON.stringify({ type: 'STATUS', message: 'Connected to Usenet.Farm SSL' }));
  });

  nntpSocket.on('error', (err) => {
    console.error('⚠️ NNTP TLS Socket Error:', err.message);
  });

  let incomingBuffer = '';

  nntpSocket.on('data', (data) => {
    incomingBuffer += data.toString('utf-8');
    const lines = incomingBuffer.split('\r\n');
    incomingBuffer = lines.pop();

    for (const line of lines) {
      if (!line) continue;

      if (authStep === 0 && (line.startsWith('200') || line.startsWith('201'))) {
        authStep = 1;
        safeWrite(`AUTHINFO USER ${user}\r\n`);
      } else if (authStep === 1 && line.startsWith('381')) {
        authStep = 2;
        safeWrite(`AUTHINFO PASS ${pass}\r\n`);
      } else if (authStep === 2 && line.startsWith('281')) {
        authStep = 3;
        console.log('🎉 NNTP AUTH SUCCESSFUL!');
        ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', user }));
      } else if (isDownloadingGroups) {
        if (line === '.') {
          isDownloadingGroups = false;
          const lastUpdated = new Date().toISOString();

          console.log(`✅ Downloaded ${downloadedGroups.length.toLocaleString()} newsgroups. Saving into SQLite DB...`);
          try {
            const upsertStmt = db.prepare(`
              INSERT INTO newsgroups (name, high, low, status, count, article_count, rawNNTPLine)
              VALUES (@name, @high, @low, @status, @count, @article_count, @rawNNTPLine)
              ON CONFLICT(name) DO UPDATE SET
                high = excluded.high,
                low = excluded.low,
                status = excluded.status,
                count = excluded.count,
                article_count = excluded.article_count,
                rawNNTPLine = excluded.rawNNTPLine
            `);

            const insertBatch = db.transaction((items) => {
              for (const item of items) {
                upsertStmt.run(item);
              }
            });
            insertBatch(downloadedGroups);

            db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('lastUpdated', lastUpdated);
            console.log('💾 SQLite DB successfully updated!');

            ws.send(JSON.stringify({ type: 'FETCH_GROUPS_SUCCESS', count: downloadedGroups.length, lastUpdated }));
          } catch (err) {
            console.error('Failed to save newsgroups into SQLite DB:', err);
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
              downloadedGroups.push({
                name: groupName,
                count: high.toLocaleString(),
                high: high.toLocaleString(),
                low: low.toLocaleString(),
                status: parts[3] || 'y',
                article_count: realCount.toLocaleString(),
                rawNNTPLine: line.trim(),
              });

              if (downloadedGroups.length % 100000 === 0) {
                console.log(`📥 Progress: Downloaded ${downloadedGroups.length.toLocaleString()} groups...`);
                ws.send(JSON.stringify({ type: 'FETCH_GROUPS_PROGRESS', count: downloadedGroups.length }));
              }
            }
          }
        }
      } else if (isFetchingBody) {
        if (line === '.') {
          isFetchingBody = false;
          ws.send(
            JSON.stringify({
              type: 'ARTICLE_BODY_SUCCESS',
              articleId: bodyArticleId,
              body: bodyLines.join('\n'),
            })
          );
          bodyLines = [];
        } else if (line.startsWith('220 ') || line.startsWith('222 ') || line.startsWith('221 ')) {
          console.log(`📄 BODY response header: ${line}`);
        } else if (line.startsWith('430 ') || line.startsWith('423 ')) {
          isFetchingBody = false;
          ws.send(
            JSON.stringify({
              type: 'ARTICLE_BODY_ERROR',
              articleId: bodyArticleId,
              message: `Failed to fetch article body from server: ${line}`,
            })
          );
          bodyLines = [];
        } else {
          bodyLines.push(line);
        }
      } else if (isFetchingPage) {
        if (line === '.') {
          isFetchingPage = false;
          ws.send(JSON.stringify({ type: 'PAGE_FETCH_COMPLETE', lines: pageLines }));
          pageLines = [];
        } else if (line.startsWith('224')) {
          console.log('📰 XOVER response receiving...');
        } else if (!line.includes('\t') && /^4\d\d(\s|$)/.test(line)) {
          // A real NNTP error status line is "CODE<space>reason" with no
          // tabs. Overview data lines are tab-separated and start with the
          // article NUMBER — e.g. article #45968 starts with "459", which
          // the old bare `/^4\d\d/` check misfired on as if it were a 4xx
          // error, silently discarding every article whose number happened
          // to start with 4 (very common: any group with articles numbered
          // in the 40000s-49999xx range, 400000s, etc. loses ALL of them).
          isFetchingPage = false;
          ws.send(JSON.stringify({ type: 'PAGE_FETCH_COMPLETE', empty: true, lines: pageLines }));
          pageLines = [];
        } else {
          // Buffer instead of sending one WS message per line — with tens of
          // thousands of overview lines, per-line messages (and the resulting
          // per-line React state updates) were the actual bottleneck.
          pageLines.push(line);
        }
      } else if (line.startsWith('211 ')) {
        const parts = line.trim().split(/\s+/);
        const count = parts[1];
        const low = parts[2];
        const high = parts[3];
        const groupName = parts[4];
        console.log(`>>> GROUP response: count=${count} low=${low} high=${high} group=${groupName}`);

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

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'FETCH_SERVER_NEWSGROUPS' && nntpSocket && authStep === 3) {
        console.log('>>> FETCHING FULL NEWSGROUPS FROM SERVER (LIST)');
        isDownloadingGroups = true;
        downloadedGroups = [];
        safeWrite('LIST\r\n');
      } else if (data.type === 'FETCH_ARTICLE_BODY' && nntpSocket && authStep === 3) {
        console.log(`>>> FETCH ARTICLE BODY FOR: ${data.articleId} IN ${data.group}`);
        isFetchingBody = true;
        bodyArticleId = data.articleId;
        bodyLines = [];
        if (data.group) {
          safeWrite(`GROUP ${data.group}\r\n`);
        }
        safeWrite(`BODY ${data.articleId}\r\n`);
      } else if (data.type === 'SAVE_FAVORITES') {
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
      } else if (data.type === 'SELECT_GROUP' && nntpSocket && authStep === 3) {
        console.log(`>>> GROUP ${data.group}`);
        safeWrite(`GROUP ${data.group}\r\n`);
      } else if (data.type === 'FETCH_PAGE' && nntpSocket && authStep === 3) {
        const { low, high, page = 1, limit = 20 } = data;
        const end = Math.max(parseInt(low, 10), parseInt(high, 10) - (page - 1) * limit);
        const start = Math.max(parseInt(low, 10), end - limit + 1);

        console.log(`>>> FETCH PAGE ${page}: XOVER ${start}-${end}`);
        isFetchingPage = true;
        safeWrite(`XOVER ${start}-${end}\r\n`);
      } else if (data.type === 'REFRESH' && nntpSocket && authStep === 3) {
        if (data.group) {
          console.log(`>>> REFRESH GROUP ${data.group}`);
          safeWrite(`GROUP ${data.group}\r\n`);
        }
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    if (nntpSocket) nntpSocket.end();
  });
});

server.listen(PORT, () => {
  console.log(`🚀 NNTP Bridge Server with SQLite DB running on http://localhost:${PORT}`);
});
