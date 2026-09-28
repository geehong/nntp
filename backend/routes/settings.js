import express from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database.js';

const router = express.Router();

// GET /api/directories
router.get('/directories', (req, res) => {
  const targetPath = req.query.path || process.cwd();
  try {
    const resolvedPath = path.resolve(targetPath);
    const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const directories = items.filter(item => item.isDirectory()).map(item => item.name).sort();
    const parentPath = path.dirname(resolvedPath);
    res.json({ currentPath: resolvedPath, parentPath: parentPath !== resolvedPath ? parentPath : null, directories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM metadata WHERE key IN (?, ?)').all('rawTemp', 'rawResult');
    const settings = { rawTemp: '', rawResult: '' };
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings
router.post('/settings', (req, res) => {
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

export default router;
