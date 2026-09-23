const tls = require('tls');
const fs = require('fs');
const path = require('path');

// ViperNews credentials
const HOST = 'news.vipernews.com';
const PORT = 563;
const USERNAME = process.env.NNTP_USERNAME || 'geecgpia@gmail.com';
const PASSWORD = process.env.NNTP_PASSWORD || 'Power@6100';

const GROUP = 'alt.binaries.pictures.fashion.youth';
const CHUNK_SIZE = 30000;

let step = 0;
let groupHigh = 0;
let startTime = 0;
let linesReceived = 0;

console.log(`Connecting to ${HOST}:${PORT} ...`);

const socket = tls.connect(PORT, HOST, { rejectUnauthorized: false }, () => {
    console.log('Connected! Waiting for welcome message...');
});

let buffer = '';

socket.on('data', (data) => {
    buffer += data.toString('utf8');
    let lines = buffer.split('\r\n');
    buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
        if (!line) continue;

        if (step === 0 && line.startsWith('200')) {
            console.log('<-', line);
            console.log(`-> AUTHINFO USER ${USERNAME}`);
            socket.write(`AUTHINFO USER ${USERNAME}\r\n`);
            step = 1;
        } else if (step === 1 && line.startsWith('381')) {
            console.log('<-', line);
            console.log(`-> AUTHINFO PASS ***`);
            socket.write(`AUTHINFO PASS ${PASSWORD}\r\n`);
            step = 2;
        } else if (step === 2 && line.startsWith('281')) {
            console.log('<-', line);
            console.log(`-> GROUP ${GROUP}`);
            socket.write(`GROUP ${GROUP}\r\n`);
            step = 3;
        } else if (step === 3 && line.startsWith('211')) {
            console.log('<-', line);
            // 211 count low high group
            const parts = line.split(' ');
            groupHigh = parseInt(parts[3], 10);
            
            const end = groupHigh;
            const start = Math.max(1, end - CHUNK_SIZE + 1);
            
            console.log(`-> XOVER ${start}-${end}`);
            startTime = Date.now();
            socket.write(`XOVER ${start}-${end}\r\n`);
            step = 4;
        } else if (step === 4) {
            if (line.startsWith('224')) {
                console.log('<-', line);
            } else if (line === '.') {
                const duration = Date.now() - startTime;
                console.log(`\n✅ Finished receiving ${linesReceived} lines in ${duration}ms.`);
                console.log(`Speed: ${Math.round(linesReceived / (duration / 1000))} lines/sec`);
                socket.end();
            } else if (line.startsWith('4') || line.startsWith('5')) {
                 console.log('<- ERROR:', line);
                 socket.end();
            } else {
                linesReceived++;
                if (linesReceived % 100 === 0) {
                    process.stdout.write(`\rReceived ${linesReceived} lines...`);
                }
            }
        }
    }
});

socket.on('error', (err) => {
    console.error('\nSocket error:', err);
});

socket.on('close', () => {
    console.log('\nConnection closed.');
});

socket.setTimeout(60000);
socket.on('timeout', () => {
    console.error('\nSocket timed out due to 60s inactivity!');
    socket.destroy();
});
