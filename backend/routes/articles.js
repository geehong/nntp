import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/database.js';
import { NNTPClient, decodeYenc } from '../nntp/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper to fetch article body from primary server
async function fetchBodyFromNNTP(group, articleId, serverId) {
  let srv = null;
  if (serverId) {
    srv = db.prepare('SELECT * FROM nntp_servers WHERE id = ?').get(serverId);
  }
  if (!srv) {
    srv = db.prepare('SELECT * FROM nntp_servers WHERE isPrimary = 1 LIMIT 1').get();
  }
  if (!srv) {
    srv = db.prepare("SELECT * FROM nntp_servers WHERE id = 'server-block' LIMIT 1").get();
  }
  if (!srv) {
    srv = db.prepare('SELECT * FROM nntp_servers LIMIT 1').get();
  }
  if (!srv) {
    throw new Error('No NNTP server configured in database');
  }

  const client = new NNTPClient({
    host: srv.host,
    port: srv.port,
    useSSL: !!srv.useSSL,
    username: srv.username,
    password: srv.password,
    useCompression: false
  });

  await client.connect();
  await client.selectGroup(group);
  const res = await client.sendCommand(`BODY ${articleId}`, true);
  await client.disconnect();

  if (res.code !== 222) {
    throw new Error(`Failed to fetch article body: ${res.message}`);
  }

  const rawText = (res.lines || []).join('\r\n');
  return rawText;
}

// GET /api/article-body?group=alt.binaries.test&id=12345
router.get('/article-body', async (req, res) => {
  const { group, id, serverId } = req.query;
  if (!group || !id) {
    return res.status(400).json({ error: 'Missing group or id' });
  }

  try {
    const body = await fetchBodyFromNNTP(group, id, serverId);
    res.json({ success: true, body });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

import { decodeYencArticle, assembleYencParts } from '../nntp/yencDecoder.js';

function isSupportedImageBuffer(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true;
  // WEBP: RIFF....WEBP
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
  return false;
}

// GET /api/article-image?group=alt.binaries.test&id=12345&ids=1,2,3
router.get('/article-image', async (req, res) => {
  const { group, ids, id, serverId } = req.query;
  const articleIds = ids ? ids.split(',') : (id ? [id] : []);
  if (!group || articleIds.length === 0) {
    console.error(`[NNTP:IMAGE_DECODE_ERROR] Missing group or id(s). group=${group}, ids=${ids}, id=${id}`);
    return res.status(400).send('Missing group or id(s)');
  }

  try {
    const decodedParts = [];
    const errors = [];
    for (const artId of articleIds) {
      try {
        const rawText = await fetchBodyFromNNTP(group, artId.trim(), serverId);
        if (!rawText) {
          errors.push(`Article #${artId}: Empty body response from NNTP server`);
          continue;
        }
        const decoded = decodeYencArticle(rawText);
        if (decoded && decoded.buffer && decoded.buffer.length > 0) {
          decodedParts.push(decoded);
        } else {
          errors.push(`Article #${artId}: yEnc/UUEncode header missing or decoded 0 bytes`);
        }
      } catch (fErr) {
        console.error(`[NNTP:IMAGE_DECODE_ERROR] Failed fetching part ${artId}:`, fErr.message);
        errors.push(`Article #${artId}: ${fErr.message}`);
      }
    }

    const assembled = assembleYencParts(decodedParts);
    if (!assembled || !assembled.buffer || assembled.buffer.length === 0) {
      const errReason = errors.length > 0 ? errors.join('; ') : 'yEnc decoding produced empty image buffer';
      console.error(`[NNTP:IMAGE_DECODE_ERROR] group=${group} id=${id}: ${errReason}`);
      res.set('Content-Type', 'text/plain; charset=utf-8');
      return res.status(500).send(`Decoding failed: ${errReason}`);
    }

    const { filename, buffer } = assembled;

    if (!isSupportedImageBuffer(buffer)) {
      const headerHex = buffer.subarray(0, 8).toString('hex').toUpperCase();
      const errReason = `Decoded payload is an archive/data file (header 0x${headerHex}), not a displayable image file (JPEG/PNG/GIF/WEBP).`;
      console.error(`[NNTP:IMAGE_DECODE_ERROR] group=${group} id=${id}: ${errReason}`);
      res.set('Content-Type', 'text/plain; charset=utf-8');
      return res.status(400).send(errReason);
    }

    const ext = filename ? filename.split('.').pop().toLowerCase() : 'jpg';
    let mime = 'image/jpeg';
    if (ext === 'png') mime = 'image/png';
    else if (ext === 'gif') mime = 'image/gif';
    else if (ext === 'webp') mime = 'image/webp';

    res.set('Content-Type', mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    console.error(`[NNTP:IMAGE_DECODE_ERROR] Internal error:`, err);
    res.status(500).send('Failed to generate image: ' + err.message);
  }
});

// POST /api/download (Background NZB & File Download)
router.post('/download', async (req, res) => {
  const { type, group, filename, ids, nzbData } = req.body;
  if (!group || !filename) {
    return res.status(400).json({ error: 'Missing group or filename' });
  }

  try {
    const targetDir = path.join(__dirname, '..', '..', 'downloads', group.replace(/[\\/:*?"<>|]/g, '_'));
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const safeFilename = filename.replace(/[\\/:*?"<>|]/g, '_');
    const targetFile = path.join(targetDir, safeFilename);

    if (type === 'nzb' && nzbData) {
      fs.writeFileSync(targetFile, nzbData, 'utf-8');
      return res.json({ success: true, message: `NZB saved to ${targetFile}` });
    }

    res.json({ success: true, message: `Download initiated for ${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
