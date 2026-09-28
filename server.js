import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import Database & WebSocket Handler
import { db } from './backend/db/database.js';
import { setupWebSocket } from './backend/websocket/nntpBridge.js';

// Import API Routers
import newsgroupsRouter from './backend/routes/newsgroups.js';
import serversRouter from './backend/routes/servers.js';
import dashboardRouter from './backend/routes/dashboard.js';
import settingsRouter from './backend/routes/settings.js';
import engineTestRouter from './backend/routes/engineTest.js';
import articlesRouter from './backend/routes/articles.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

app.use(express.json());

// Favicon 204
app.get('/favicon.ico', (req, res) => res.status(204).end());

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Basic Auth Middleware
app.use((req, res, next) => {
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    return next();
  }
  const adminUser = (process.env.ADMIN_USERNAME || 'geehong').trim();
  const adminPass = (process.env.ADMIN_PASSWORD || 'Power@6740').trim();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const creds = Buffer.from(authHeader.substring(6).trim(), 'base64').toString('utf-8');
      const colonIndex = creds.indexOf(':');
      if (colonIndex !== -1) {
        const user = creds.substring(0, colonIndex).trim();
        const pass = creds.substring(colonIndex + 1).trim();
        if (user === adminUser && pass === adminPass) return next();
      }
    } catch (e) {
      console.error('Auth parse error:', e);
    }
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="NNTP Web Client", charset="UTF-8"');
  return res.status(401).send('Authentication Required');
});

// Static Frontend Hosting
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log(`📦 Serving static frontend files from: ${distPath}`);
  app.use(express.static(distPath));
}

// Mount Routers
app.use('/api', newsgroupsRouter);
app.use('/api', serversRouter);
app.use('/api', dashboardRouter);
app.use('/api', settingsRouter);
app.use('/api', engineTestRouter);
app.use('/api', articlesRouter);

// Initialize WebSocket Bridge
setupWebSocket(wss);

server.listen(PORT, () => {
  console.log(`🚀 Modularized NNTP Server running on http://localhost:${PORT}`);
});
