import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();



// GET /api/newsgroups
router.get('/newsgroups', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.max(1, parseInt(req.query.pageSize || '25', 10));
  const search = (req.query.search || '').trim().toLowerCase();
  const sort = req.query.sort || 'name';
  const order = (req.query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const favoriteOnly = req.query.favoriteOnly === 'true';

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

    const sortColumnMap = {
      article_count: 'num_article_count',
      high: 'num_high',
      low: 'num_low',
      count: 'num_count',
      status: 'status',
      is_favorite: 'is_favorite',
      name: 'name',
    };

    const orderExpression = sortColumnMap[sort] || 'name';

    const row = db.prepare(`SELECT COUNT(*) as cnt FROM newsgroups ${whereSql}`).get(queryParams);
    const totalCount = row ? row.cnt : 0;

    const totalGroupsRow = db.prepare('SELECT COUNT(*) as cnt FROM newsgroups WHERE server_id = ?').get(serverId);
    const totalGroupsCount = totalGroupsRow ? totalGroupsRow.cnt : 0;

    const favRow = db.prepare('SELECT COUNT(*) as cnt FROM newsgroups WHERE server_id = ? AND is_favorite = 1').get(serverId);
    const totalFavoritesCount = favRow ? favRow.cnt : 0;

    const offset = (page - 1) * pageSize;
    const items = db.prepare(`
      SELECT server_id, name, high, low, status, count, article_count, rawNNTPLine, is_favorite
      FROM newsgroups
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
      totalFavoritesCount,
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

// GET /api/favorites
router.get('/favorites', (req, res) => {
  let serverId = req.query.serverId;
  if (!serverId) {
    const primaryRow = db.prepare('SELECT id FROM nntp_servers WHERE isPrimary = 1 LIMIT 1').get();
    serverId = primaryRow ? primaryRow.id : 'server-viper';
  }

  try {
    const rows = db.prepare('SELECT name, high, low, status, count, article_count FROM newsgroups WHERE server_id = ? AND is_favorite = 1').all(serverId);
    return res.json({ favorites: rows.map((r) => r.name), favoriteObjects: rows, serverId });
  } catch (e) {
    return res.json({ favorites: [], favoriteObjects: [] });
  }
});

// POST /api/favorites/toggle
router.post('/favorites/toggle', (req, res) => {
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

    const favRows = db.prepare('SELECT name FROM newsgroups WHERE server_id = ? AND is_favorite = 1').all(serverId);
    return res.json({ success: true, isFavorite: newFav === 1, favorites: favRows.map((r) => r.name) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/favorites/batch
router.post('/favorites/batch', (req, res) => {
  const { names, serverId: reqServerId, action } = req.body;
  if (!Array.isArray(names) || names.length === 0) return res.status(400).json({ error: 'Names array is required' });

  let serverId = reqServerId;
  if (!serverId) {
    const primaryRow = db.prepare('SELECT id FROM nntp_servers WHERE isPrimary = 1 LIMIT 1').get();
    serverId = primaryRow ? primaryRow.id : 'server-viper';
  }

  const isFavorite = action === 'add' ? 1 : 0;
  try {
    const updateStmt = db.prepare('UPDATE newsgroups SET is_favorite = ? WHERE server_id = ? AND name = ?');
    const insertStmt = db.prepare('INSERT INTO newsgroups (server_id, name, is_favorite) VALUES (?, ?, ?)');
    
    const transaction = db.transaction(() => {
      for (const name of names) {
        const row = db.prepare('SELECT 1 FROM newsgroups WHERE server_id = ? AND name = ?').get(serverId, name);
        if (row) {
          updateStmt.run(isFavorite, serverId, name);
        } else {
          insertStmt.run(serverId, name, isFavorite);
        }
      }
    });
    transaction();

    const favRows = db.prepare('SELECT name FROM newsgroups WHERE server_id = ? AND is_favorite = 1').all(serverId);
    return res.json({ success: true, favorites: favRows.map((r) => r.name) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/newsgroups/update-counts
router.post('/newsgroups/update-counts', (req, res) => {
  return res.json({ success: true });
});

export default router;
