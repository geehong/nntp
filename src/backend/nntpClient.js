import tls from 'tls';

// Opens a fresh, short-lived NNTP TLS connection to fetch one article body as
// raw bytes (never decoded through a text encoding) so yEnc/binary payloads
// survive intact.
export function fetchArticleBodyRaw(group, articleId, serverConfig = {}, idleSocket = null) {
  return new Promise((resolve, reject) => {
    const host = serverConfig.host || process.env.NNTP_HOST || 'news.usenet.farm';
    const port = serverConfig.port || parseInt(process.env.NNTP_PORT || '563', 10);
    const user = serverConfig.user || (process.env.NNTP_USER || '').split('#')[0].trim();
    const pass = serverConfig.pass || (process.env.NNTP_PASS || '').split('#')[0].trim();

    const socket = idleSocket || tls.connect({ host, port, rejectUnauthorized: false, family: 4 });
    let authStep = idleSocket ? 3 : 0; // 재사용 시 AUTH 단계를 건너뛰고 바로 GROUP 명령어로 시작
    let buffered = Buffer.alloc(0);
    let bodyStarted = false;
    const CRLF = Buffer.from('\r\n');

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('NNTP request timed out'));
    }, 20000);

    const cleanupAndReject = (err) => {
      clearTimeout(timeout);
      socket.removeAllListeners('data');
      socket.removeAllListeners('error');
      if (socket.writable && !socket.destroyed) {
        socket.write('QUIT\r\n');
        setTimeout(() => socket.destroy(), 50);
      } else {
        socket.destroy();
      }
      reject(err);
    };

    const resolveWithSocket = (buf) => {
      clearTimeout(timeout);
      // 이벤트 리스너를 제거하여 소켓을 깨끗한 상태로 반환 (다음 요청에서 재사용)
      socket.removeAllListeners('data');
      socket.removeAllListeners('error');
      resolve({ buffer: buf, socket });
    };

    socket.on('error', (err) => {
      cleanupAndReject(err);
    });

    socket.on('data', (chunk) => {
      // Record server usage if global tracker exists
      if (global.recordServerUsage && serverConfig.id) {
        global.recordServerUsage(serverConfig.id, chunk.length);
      }
      buffered = Buffer.concat([buffered, chunk]);

      if (!bodyStarted) {
        let idx;
        while ((idx = buffered.indexOf(CRLF)) !== -1) {
          const line = buffered.subarray(0, idx).toString('latin1');
          buffered = buffered.subarray(idx + 2);

          if (line.startsWith('5') || (authStep < 4 && line.startsWith('4'))) {
            console.error(`[FetchRaw] Server error: ${line}`);
            cleanupAndReject(new Error(`NNTP error: ${line}`));
            return;
          }

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
          } else if (authStep === 4 && line.startsWith('222')) {
            bodyStarted = true;
            break; 
          }
        }
      }

      // If body started, check if the lone "." is in the buffered data
      if (bodyStarted) {
        const endSeq = Buffer.from('\r\n.\r\n');
        const endIdx = buffered.indexOf(endSeq);
        if (endIdx !== -1) {
          const finalBuf = buffered.subarray(0, endIdx + 2);
          resolveWithSocket(finalBuf);
        }
      }
    });

    if (idleSocket) {
      // 이미 인증된 재사용 소켓이면 바로 GROUP 전송
      socket.write(`GROUP ${group}\r\n`);
    }
  });
}

// Queue system to prevent exceeding max connections
const serverQueues = {};

export function closeAllIdleSockets() {
  console.log('\n[NNTP] Closing all idle sockets and clearing queues by user request...');
  for (const srv of Object.values(serverQueues)) {
    srv.disconnecting = true;
    
    // Clear pending tasks so no new sockets are created
    if (srv.pending) {
      while (srv.pending.length > 0) {
        const next = srv.pending.shift();
        // We can't easily reject the promise from here without modifying the queue logic,
        // but clearing the array stops them from executing.
      }
    }
    
    if (srv.idleSockets) {
      for (const socket of srv.idleSockets) {
        if (socket && socket.writable && !socket.destroyed) {
          socket.write('QUIT\r\n');
          setTimeout(() => socket.destroy(), 50);
        }
      }
      srv.idleSockets = [];
    }
  }
}

// 터미널 강제 종료(Ctrl+C) 시 서버에 QUIT 신호를 보내어 좀비 커넥션을 방지하는 안전장치
process.on('SIGINT', () => {
  console.log('\n[NNTP] Shutting down gracefully, closing idle sockets...');
  closeAllIdleSockets();
  setTimeout(() => process.exit(0), 200);
});

export async function queueFetchArticleBodyRaw(group, articleId, serverConfig, serverId) {
  if (!serverQueues[serverId]) {
    // Leave 1 connection free for the main WebSocket
    let max = serverConfig.maxConnections ? parseInt(serverConfig.maxConnections, 10) - 1 : 4;
    if (max < 1) max = 1;
    serverQueues[serverId] = { active: 0, max, pending: [], idleSockets: [], disconnecting: false };
  }
  
  const q = serverQueues[serverId];
  q.disconnecting = false;
  
  return new Promise((resolve, reject) => {
    const task = async () => {
      console.log(`[Queue] Starting fetch for article ${articleId}. Active: ${q.active}/${q.max}, Pending: ${q.pending.length}`);
      
      // 풀링된 잉여 소켓이 있다면 꺼내서 재사용하고, 없으면 새로 생성하도록 null 전달
      let idleSocket = q.idleSockets.pop() || null;
      
      try {
        let retries = 15; // 502 에러가 완전히 풀릴 때까지 넉넉하게 최대 15번 끈질기게 재시도
        while (retries > 0) {
          try {
            // 풀링된 소켓 전달
            const startTime = Date.now();
            const res = await fetchArticleBodyRaw(group, articleId, serverConfig, idleSocket);
            const durationMs = Date.now() - startTime;
            const sizeBytes = res.buffer.length;
            const speedMbps = ((sizeBytes * 8) / (durationMs / 1000) / 1024 / 1024).toFixed(2);
            const speedKBps = (sizeBytes / (durationMs / 1000) / 1024).toFixed(2);
            
            console.log(`[Queue] Success for article ${articleId}. Size: ${(sizeBytes/1024).toFixed(1)} KB, Time: ${durationMs}ms, Speed: ${speedMbps} Mbps (${speedKBps} KB/s)`);
            resolve(res.buffer);
            
            // 다운로드를 무사히 마친 싱싱한 소켓은 파기하지 않고 풀(Pool)에 다시 보관
            if (res.socket && !res.socket.destroyed) {
              if (q.disconnecting) {
                res.socket.write('QUIT\r\n');
                setTimeout(() => res.socket.destroy(), 50);
              } else {
                q.idleSockets.push(res.socket);
              }
            }
            break; // 성공 시 루프 탈출
          } catch (err) {
            retries--;
            const errMsg = err.message || '';
            console.error(`[Queue] Error for article ${articleId} (Retries left: ${retries}):`, errMsg);
            
            // 기존 풀링 소켓이 오염되어 에러를 뿜었을 수 있으므로 폐기하고, 
            // 다음 재시도에서는 무조건 새 소켓을 맺도록 null 처리
            idleSocket = null;

            if (retries === 0) {
              reject(err);
              break;
            }
            
            // 502 Connection limit 에러인 경우 특별 조치
            if (errMsg.includes('502') || errMsg.includes('connection limit')) {
              // 동시 접속 수를 줄이지 않고(4개 유지), 랜덤 대기(Jitter)만으로 좀비 연결 해제를 기다림
              const jitter = Math.floor(Math.random() * 3000);
              await new Promise(r => setTimeout(r, 5000 + jitter));
            } else {
              // 일반 에러는 1초 ~ 2초 사이 랜덤 대기
              const jitter = Math.floor(Math.random() * 1000);
              await new Promise(r => setTimeout(r, 1000 + jitter));
            }
          }
        }
      } finally {
        q.active--;
        if (q.pending.length > 0) {
          const next = q.pending.shift();
          q.active++;
          next();
        }
      }
    };

    if (q.active < q.max) {
      q.active++;
      task();
    } else {
      console.log(`[Queue] Reached max connections (${q.max}). Queuing article ${articleId}. Pending: ${q.pending.length + 1}`);
      q.pending.push(task);
    }
  });
}

