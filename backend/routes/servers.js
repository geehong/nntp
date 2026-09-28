import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

const mapServerRow = (s) => ({
  ...s,
  useSSL: !!s.useSSL,
  isPrimary: !!s.isPrimary,
  showInSidebar: s.showInSidebar !== undefined ? !!s.showInSidebar : true,
  sortOrder: s.sortOrder !== undefined ? parseInt(s.sortOrder, 10) : 0,
});

// GET /api/servers
router.get('/servers', (req, res) => {
  try {
    const servers = db.prepare('SELECT * FROM nntp_servers ORDER BY sortOrder ASC, id ASC').all();
    const formatted = servers.map(mapServerRow);
    return res.json({ success: true, servers: formatted });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/servers/save
router.post('/servers/save', (req, res) => {
  const { id, name, host, port, useSSL, username, password, maxConnections, isPrimary, default_article_count, showInSidebar, sortOrder, expireDate } = req.body;
  if (!name || !host || !port) {
    return res.status(400).json({ error: 'Name, host, and port are required' });
  }

  try {
    if (isPrimary) {
      db.prepare('UPDATE nntp_servers SET isPrimary = 0').run();
    }

    const serverId = id || `server-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO nntp_servers 
      (id, name, host, port, useSSL, username, password, maxConnections, status, retention, syncedGroups, isPrimary, default_article_count, showInSidebar, sortOrder, expireDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        host = excluded.host,
        port = excluded.port,
        useSSL = excluded.useSSL,
        username = excluded.username,
        password = excluded.password,
        maxConnections = excluded.maxConnections,
        isPrimary = excluded.isPrimary,
        default_article_count = excluded.default_article_count,
        showInSidebar = excluded.showInSidebar,
        sortOrder = excluded.sortOrder,
        expireDate = excluded.expireDate
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
      default_article_count !== undefined ? parseInt(default_article_count, 10) : 300,
      showInSidebar !== undefined ? (showInSidebar ? 1 : 0) : 1,
      sortOrder !== undefined ? parseInt(sortOrder, 10) : 0,
      expireDate || null
    );

    const servers = db.prepare('SELECT * FROM nntp_servers ORDER BY sortOrder ASC, id ASC').all().map(mapServerRow);
    return res.json({ success: true, servers });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/servers/batch-save
router.post('/servers/batch-save', (req, res) => {
  const { servers } = req.body;
  if (!Array.isArray(servers)) {
    return res.status(400).json({ error: 'servers array is required' });
  }

  try {
    const updateStmt = db.prepare(`
      UPDATE nntp_servers
      SET default_article_count = ?,
          showInSidebar = ?,
          sortOrder = ?
      WHERE id = ?
    `);

    db.transaction(() => {
      for (const s of servers) {
        updateStmt.run(
          s.default_article_count !== undefined ? parseInt(s.default_article_count, 10) : 300,
          s.showInSidebar ? 1 : 0,
          s.sortOrder !== undefined ? parseInt(s.sortOrder, 10) : 0,
          s.id
        );
      }
    })();

    const updatedServers = db.prepare('SELECT * FROM nntp_servers ORDER BY sortOrder ASC, id ASC').all().map(mapServerRow);
    return res.json({ success: true, servers: updatedServers });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// DELETE /api/servers/:id
router.delete('/servers/:id', (req, res) => {
  const { id } = req.params;
  try {
    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM nntp_servers').get();
    if (countRow.cnt <= 1) {
      return res.status(400).json({ error: '최소 1개의 서버는 등록되어 있어야 합니다.' });
    }
    db.prepare('DELETE FROM nntp_servers WHERE id = ?').run(id);
    const servers = db.prepare('SELECT * FROM nntp_servers ORDER BY sortOrder ASC, id ASC').all().map(mapServerRow);
    return res.json({ success: true, servers });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
