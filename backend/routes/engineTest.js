import express from 'express';
import { NNTPBaseClient, NNTPClient, decodeYenc, parseNZBXml } from '../nntp/index.js';
import { db } from '../db/database.js';

const router = express.Router();

// GET /api/nntp-engine/test
router.get('/nntp-engine/test', async (req, res) => {
  try {
    // BlockNews primary server settings from DB or env
    const srv = db.prepare("SELECT * FROM nntp_servers WHERE id = 'server-block' OR isPrimary = 1 LIMIT 1").get();
    
    const host = srv?.host || process.env.BLOCK_HOST || 'asnews.blocknews.net';
    const port = srv?.port || parseInt(process.env.BLOCK_PORT || '563', 10);
    const useSSL = srv ? !!srv.useSSL : process.env.BLOCK_SSL !== 'false';
    const username = srv?.username || process.env.BLOCK_USER || 'geecgpia';
    const password = srv?.password || process.env.BLOCK_PASS || 'jogizowizykyh';

    const testGroup = 'alt.binaries.test';
    const targetArticleCount = 300; // Fast response range

    // 1. NNTPBaseClient Test
    const baseClient = new NNTPBaseClient({ host, port, useSSL, username, password, timeout: 15000 });
    let baseStatus = {
      className: 'NNTPBaseClient',
      host: baseClient.config.host,
      port: baseClient.config.port,
      isConnected: false,
      reconnectAttempts: baseClient.reconnectAttempts,
    };

    try {
      await baseClient.connect();
      baseStatus.isConnected = baseClient.isConnected;
      await baseClient.disconnect();
    } catch (bErr) {
      baseStatus.error = bErr.message;
    }

    // 2. NNTPClient Test (Connect, Select Group, Fetch latest articles overview)
    const advClient = new NNTPClient({ host, port, useSSL, username, password, useCompression: true, timeout: 15000 });
    let clientStatus = {
      className: 'NNTPClient',
      server: 'BlockNews Server (Asia)',
      host,
      port,
      group: testGroup,
      useCompression: advClient.useCompression,
      compressionEnabled: advClient.compressionEnabled,
      fetchedArticleCount: 0,
      range: null,
    };

    try {
      await advClient.connect();
      const groupInfo = await advClient.selectGroup(testGroup);
      
      const high = groupInfo.high;
      const low = Math.max(groupInfo.low, high - targetArticleCount + 1);
      
      clientStatus.groupInfo = groupInfo;
      clientStatus.requestedRange = { start: low, end: high, count: high - low + 1 };

      const xoverRes = await advClient.fetchXOver(`${low}-${high}`);
      const articles = xoverRes.headers || [];
      clientStatus.fetchedArticleCount = articles.length;
      clientStatus.range = { start: low, end: high };
      
      await advClient.disconnect();
    } catch (cErr) {
      clientStatus.error = cErr.message;
    }

    // 3. yencDecoder Test
    const sampleYencText = `=ybegin line=128 size=16 name=test.txt\r\n\x62\x63\x64\x65\r\n=yend size=4 crc32=6e01a88e\r\n`;
    const yencResult = decodeYenc(sampleYencText);
    const yencStatus = {
      className: 'yencDecoder',
      isYenc: yencResult.isYenc,
      filename: yencResult.filename,
      crcValid: yencResult.crcValid,
    };

    // 4. nzbParser Test
    const sampleNzbXml = `<?xml version="1.0" encoding="UTF-8"?>
      <nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">
        <file poster="TestPoster" date="1700000000" subject="Sample Linux ISO (1/2)">
          <groups><group>alt.binaries.test</group></groups>
          <segments>
            <segment bytes="524288" number="1">sample_msg_id_1@usenet</segment>
            <segment bytes="524288" number="2">sample_msg_id_2@usenet</segment>
          </segments>
        </file>
      </nzb>`;
    const nzbResult = parseNZBXml(sampleNzbXml);
    const nzbStatus = {
      className: 'nzbParser',
      filesCount: nzbResult.filesCount,
      sampleSubject: nzbResult.files[0]?.subject,
    };

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      server: `BlockNews (${host}:${port})`,
      testGroup,
      requestedCount: targetArticleCount,
      modules: [baseStatus, clientStatus, yencStatus, nzbStatus],
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
