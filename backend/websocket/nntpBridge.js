import { db } from '../db/database.js';
import { NNTPClient } from '../nntp/index.js';

/**
 * Helper: safely send a JSON message over WebSocket
 */
function wsSend(ws, obj) {
  try {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify(obj));
    }
  } catch (e) {
    // ignore closed socket
  }
}

/**
 * Attach NNTP client log events → forward to browser via WebSocket
 * so backend NNTP logs appear in browser DevTools Console
 */
function attachClientLogging(client, ws) {
  client.on('log', (logObj) => {
    // logObj: { level, category, message, details, timestamp }
    const entry = typeof logObj === 'object' ? logObj : { level: 'info', category: 'NNTP', message: String(logObj) };
    wsSend(ws, {
      type: 'NNTP_LOG',
      level: entry.level || 'info',
      category: entry.category || 'NNTP',
      message: entry.message || '',
      details: entry.details || null,
      timestamp: entry.timestamp || new Date().toISOString(),
    });
  });
}

export const setupWebSocket = (wss) => {
  wss.on('connection', (ws) => {
    console.log('🌐 Frontend WebSocket Connected');
    let activeClient = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log(`[${new Date().toISOString()}] [WS:MSG] Received action: ${data.type}`);

        if (data.type === 'CONNECT_AND_FETCH_PAGE' || data.type === 'FETCH_PAGE') {
          // Frontend sends: { group, serverId, low, high, limit, start, end }
          const { group, serverId } = data;
          const groupHigh = parseInt(data.high, 10);
          const groupLow = parseInt(data.low, 10);
          const limit = parseInt(data.limit, 10) || 300;
          
          let start = data.start ? parseInt(data.start, 10) : null;
          let end = data.end ? parseInt(data.end, 10) : groupHigh;

          if (!start || isNaN(start)) {
            start = Math.max(groupLow, end - limit + 1);
          }
          if (isNaN(end) || !end) {
            end = groupHigh;
          }
          console.log(`[${new Date().toISOString()}] [WS:FETCH] group='${group}' range=${start}~${end} (limit=${limit})`);

          let srv = null;
          if (serverId) {
            srv = db.prepare('SELECT * FROM nntp_servers WHERE id = ?').get(serverId);
          }
          if (!srv) {
            srv = db.prepare('SELECT * FROM nntp_servers WHERE isPrimary = 1 LIMIT 1').get();
          }

          if (!srv) {
            console.warn(`[${new Date().toISOString()}] [WS:WARN] No primary NNTP server configured!`);
            return wsSend(ws, { type: 'PAGE_FETCH_COMPLETE', group, empty: true, lines: [] });
          }

          if (isNaN(start) || isNaN(end) || end < start) {
            console.warn(`[${new Date().toISOString()}] [WS:WARN] Invalid XOVER range: ${start}~${end} (low=${data.low}, high=${data.high})`);
            return wsSend(ws, { type: 'PAGE_FETCH_COMPLETE', group, empty: true, lines: [] });
          }

          // 10-Minute Caching Check
          const cacheTTL = 10 * 60 * 1000; // 10 minutes
          const rangeKey = `${start}_${end}_${limit}`;
          const effectiveServerId = srv.id;

          const cachedRow = db.prepare(`
            SELECT lines, updated_at FROM article_cache
            WHERE server_id = ? AND group_name = ? AND range_key = ?
          `).get(effectiveServerId, group, rangeKey);

          if (cachedRow && (Date.now() - cachedRow.updated_at) < cacheTTL) {
            try {
              const cachedLines = JSON.parse(cachedRow.lines);
              console.log(`[${new Date().toISOString()}] [WS:CACHE_HIT] Returned ${cachedLines.length} cached articles for '${group}' (Server: ${effectiveServerId})`);
              return wsSend(ws, {
                type: 'PAGE_FETCH_COMPLETE',
                group,
                empty: cachedLines.length === 0,
                lines: cachedLines,
                fromCache: true,
              });
            } catch (jsonErr) {
              // Cache parse error fallback to NNTP fetch
            }
          }

          // Always use a fresh connection — avoids stale GZIP/compression state from prior sessions
          if (activeClient) {
            activeClient.removeAllListeners('log');
            try { await activeClient.disconnect(); } catch (e) { /* ignore */ }
            activeClient = null;
          }
          activeClient = new NNTPClient({
            host: srv.host,
            port: srv.port,
            useSSL: !!srv.useSSL,
            username: srv.username,
            password: srv.password,
            useCompression: false,  // GZIP 압축 응답은 현재 파서가 처리 불가
          });
          // Forward all NNTP client logs to browser console
          attachClientLogging(activeClient, ws);
          await activeClient.connect();

          const groupInfo = await activeClient.selectGroup(group);
          // Re-check range against real server info
          const realHigh = groupInfo.high;
          const realLow = groupInfo.low;
          const safeEnd = Math.min(end, realHigh);
          const safeStart = Math.max(start, realLow);
          const targetTotal = Math.max(1, safeEnd - safeStart + 1);
          const onProgress = (prog) => {
            wsSend(ws, {
              type: 'PAGE_FETCH_PROGRESS',
              current: prog.current,
              total: targetTotal,
            });
          };
          activeClient.on('progress', onProgress);

          const articles = await activeClient.fetchOverview(safeStart, safeEnd);
          activeClient.removeListener('progress', onProgress);
          console.log(`[${new Date().toISOString()}] [WS:SUCCESS] Fetched ${articles.length} articles for '${group}'`);

          const formattedLines = articles.map(a => `${a.id}\t${a.subject}\t${a.poster}\t${a.date}\t${a.msgId}\t${a.references}\t${a.bytes}\t${a.lines}`);

          // Save to SQLite Cache
          try {
            db.prepare(`
              INSERT INTO article_cache (server_id, group_name, range_key, lines, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(server_id, group_name, range_key) DO UPDATE SET
                lines = excluded.lines,
                updated_at = excluded.updated_at
            `).run(effectiveServerId, group, rangeKey, JSON.stringify(formattedLines), Date.now());
          } catch (cacheWriteErr) {
            console.error('Failed to write article cache:', cacheWriteErr.message);
          }

          wsSend(ws, {
            type: 'PAGE_FETCH_COMPLETE',
            group,
            empty: articles.length === 0,
            lines: formattedLines,
            fromCache: false,
          });

          // Disconnect after each request (stateless per-fetch mode)
          activeClient.removeAllListeners('log');
          try { await activeClient.disconnect(); } catch (e) { /* ignore */ }
          activeClient = null;

        } else if (data.type === 'SELECT_GROUP' || data.type === 'REFRESH') {
          // SELECT_GROUP / REFRESH: select group and return stats
          const { group, serverId } = data;
          let srv = serverId
            ? db.prepare('SELECT * FROM nntp_servers WHERE id = ?').get(serverId)
            : db.prepare('SELECT * FROM nntp_servers WHERE isPrimary = 1 LIMIT 1').get();

          if (!srv) {
            return wsSend(ws, { type: 'GROUP_ERROR', message: 'No server configured' });
          }

          if (!activeClient || activeClient.config.host !== srv.host) {
            if (activeClient) {
              activeClient.removeAllListeners('log');
              try { await activeClient.disconnect(); } catch (e) { /* ignore */ }
            }
            activeClient = new NNTPClient({
              host: srv.host,
              port: srv.port,
              useSSL: !!srv.useSSL,
              username: srv.username,
              password: srv.password,
              useCompression: false,
            });
            attachClientLogging(activeClient, ws);
            await activeClient.connect();
          } else {
            activeClient.removeAllListeners('log');
            attachClientLogging(activeClient, ws);
          }

          const info = await activeClient.selectGroup(group);
          wsSend(ws, {
            type: 'GROUP_SUCCESS',
            group,
            count: info.count,
            low: info.low,
            high: info.high,
          });
        } else if (data.type === 'FETCH_SERVER_NEWSGROUPS') {
          const { serverId } = data;
          let srv = serverId
            ? db.prepare('SELECT * FROM nntp_servers WHERE id = ?').get(serverId)
            : db.prepare('SELECT * FROM nntp_servers WHERE isPrimary = 1 LIMIT 1').get();

          if (!srv) {
            return wsSend(ws, { type: 'FETCH_GROUPS_ERROR', message: 'No server configured' });
          }

          let client = new NNTPClient({
            host: srv.host,
            port: srv.port,
            useSSL: !!srv.useSSL,
            username: srv.username,
            password: srv.password,
            useCompression: false,
          });
          
          attachClientLogging(client, ws);
          await client.connect();

          const groups = await client.fetchGroups();
          try { await client.disconnect(); } catch(e) {}

          if (groups && groups.length > 0) {
            wsSend(ws, { type: 'FETCH_GROUPS_PROGRESS', count: groups.length });
            const insertStmt = db.prepare(`
              INSERT INTO newsgroups (server_id, name, high, low, status, count, num_high, num_low, num_count)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(server_id, name) DO UPDATE SET
                high = excluded.high,
                low = excluded.low,
                status = excluded.status,
                count = excluded.count,
                num_high = excluded.num_high,
                num_low = excluded.num_low,
                num_count = excluded.num_count
            `);
            const tx = db.transaction((groupsList) => {
              for (const g of groupsList) {
                const count = Math.max(0, g.high - g.low + 1);
                insertStmt.run(
                  srv.id, g.name, String(g.high), String(g.low), g.status, String(count),
                  g.high, g.low, count
                );
              }
            });
            tx(groups);
            wsSend(ws, { type: 'FETCH_GROUPS_SUCCESS', count: groups.length, lastUpdated: new Date().toISOString() });
          } else {
            wsSend(ws, { type: 'FETCH_GROUPS_ERROR', message: 'Received 0 groups from server' });
          }
        }

      } catch (err) {
        console.error(`[${new Date().toISOString()}] [WS:ERROR] ${err.stack || err.message}`);
        wsSend(ws, { type: 'ERROR', error: err.message });
      }
    });

    ws.on('close', () => {
      console.log('🔌 Frontend WebSocket Disconnected');
      if (activeClient) {
        activeClient.removeAllListeners('log');
        activeClient.disconnect();
        activeClient = null;
      }
    });
  });
};
