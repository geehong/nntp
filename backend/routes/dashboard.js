import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

// GET /api/dashboard/stats
router.get('/dashboard/stats', (req, res) => {
  try {
    const servers = db.prepare('SELECT * FROM nntp_servers ORDER BY sortOrder ASC, id ASC').all();
    
    const usageRows = db.prepare(`
      SELECT server_id, date, bytes_downloaded 
      FROM server_usage 
      WHERE date >= date('now', '-30 days')
      ORDER BY date ASC
    `).all();

    const totalUsageByServer = db.prepare(`
      SELECT server_id, SUM(bytes_downloaded) as total_bytes
      FROM server_usage
      GROUP BY server_id
    `).all().reduce((acc, row) => {
      acc[row.server_id] = row.total_bytes || 0;
      return acc;
    }, {});

    const groupCountsByServer = db.prepare(`
      SELECT server_id, COUNT(*) as cnt, SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as fav_cnt
      FROM newsgroups
      GROUP BY server_id
    `).all().reduce((acc, row) => {
      acc[row.server_id] = { count: row.cnt || 0, favCount: row.fav_cnt || 0 };
      return acc;
    }, {});

    const lastUpdatedMeta = db.prepare("SELECT value FROM metadata WHERE key = 'last_newsgroups_update'").get()?.value || null;

    const serverStats = servers.map(srv => {
      const gInfo = groupCountsByServer[srv.id] || { count: 0, favCount: 0 };
      return {
        id: srv.id,
        name: srv.name,
        host: srv.host,
        port: srv.port,
        useSSL: !!srv.useSSL,
        isPrimary: !!srv.isPrimary,
        syncedGroups: gInfo.count || srv.syncedGroups || 0,
        favGroups: gInfo.favCount || 0,
        bytesDownloaded: totalUsageByServer[srv.id] || 0,
        maxConnections: srv.maxConnections || 10,
        status: srv.status || 'Connected',
        retention: srv.retention || '3000+ Days',
        default_article_count: srv.default_article_count || 300,
        showInSidebar: srv.showInSidebar !== undefined ? !!srv.showInSidebar : true,
        sortOrder: srv.sortOrder || 0,
      };
    });

    const totalGroups = db.prepare("SELECT COUNT(*) as count FROM newsgroups").get()?.count || 0;
    const favGroups = db.prepare("SELECT COUNT(*) as count FROM newsgroups WHERE is_favorite = 1").get()?.count || 0;
    const totalBytesAll = Object.values(totalUsageByServer).reduce((a, b) => a + b, 0);

    res.json({
      success: true,
      usage: usageRows,
      totalGroups,
      favGroups,
      totalBytesAll,
      lastUpdated: lastUpdatedMeta,
      servers: serverStats,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
