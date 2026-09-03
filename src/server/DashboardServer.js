const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

class DashboardServer {
  constructor() {
    this.server = null;
    this.port = 10000;
    this.client = null;
    this.sseClients = new Set();
    
    this.logBuffer = [];
    this.MAX_LOGS = 200;
    
    this.statusMessage = '';
    this.BUILD_ID = Date.now().toString();
    
    this.setupLogInterceptor();
  }

  setupLogInterceptor() {
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog.apply(console, args);
      
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (!msg || msg.trim() === '') return;
      
      this.addLogEntry(msg);
    };
  }

  addLogEntry(text) {
    let timestamp = '';
    const timeMatch = text.match(/^\[(\d{2}:\d{2}:\d{2})\]/);
    if (timeMatch) {
      timestamp = timeMatch[1];
      text = text.substring(timeMatch[0].length).trim();
    } else {
      const now = new Date();
      timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    }

    text = text.replace(/\r/g, '');

    const logEntry = {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      time: timestamp,
      text: text
    };

    this.logBuffer.push(logEntry);
    while (this.logBuffer.length > this.MAX_LOGS) {
      this.logBuffer.shift();
    }

    this.broadcastSSE('log', logEntry);
  }

  updateStatus(statusStr) {
    this.statusMessage = statusStr;
    this.broadcastSSE('status_msg', { text: statusStr });
  }

  setClient(client) {
    this.client = client;
    this.broadcastSSE('player_state', this.getPlayerState());
  }

  getPlayerState() {
    if (!this.client) return { isReady: false };
    
    let nexp = 0;
    let rankName = '';
    if (this.client.playerData) {
      try {
        const { getLevelInfo } = require('../config');
        const lvlInfo = getLevelInfo(this.client.playerData.lv || 1);
        nexp = lvlInfo.maxExp || 0;
        rankName = lvlInfo.name || `Cấp ${this.client.playerData.lv}`;
      } catch (e) {}
    }

    return {
      isReady: this.client.isReady,
      serverName: this.client.serverInfo ? (this.client.serverInfo.serverName || this.client.serverInfo.name) : 'Unknown',
      serverId: this.client.serverInfo ? this.client.serverInfo.serverId : '',
      rankName: rankName,
      playerData: this.client.playerData || null,
      resources: this.client.playerData ? {
        gold: this.client.playerData.gold,
        silver: this.client.playerData.silver,
        food: this.client.playerData.food,
        soldier: this.client.playerData.soldier,
        exp: this.client.playerData.exp,
        nexp: nexp
      } : null,
      cooldowns: {
        trade: this.client.tradeInfoList || [],
        affair: this.client.affair ? this.client.affair.workList : []
      }
    };
  }

  broadcastSSE(type, data) {
    const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of this.sseClients) {
      try {
        res.write(message);
      } catch (err) {
        this.sseClients.delete(res);
      }
    }
  }

  start(port) {
    this.port = port || process.env.PORT || 10000;
    
    this.server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');

      // 1. SSE Realtime Stream
      if (req.method === 'GET' && req.url === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        res.write('\n');

        this.sseClients.add(res);

        res.write(`event: init\ndata: ${JSON.stringify({
          buildId: this.BUILD_ID,
          logs: this.logBuffer,
          statusMsg: this.statusMessage,
          playerState: this.getPlayerState()
        })}\n\n`);

        const pingInterval = setInterval(() => {
          try {
            res.write(':\n\n'); 
            res.write(`event: player_state\ndata: ${JSON.stringify(this.getPlayerState())}\n\n`);
          } catch(err) {
            clearInterval(pingInterval);
          }
        }, 15000);

        req.on('close', () => {
          clearInterval(pingInterval);
          this.sseClients.delete(res);
        });
        return;
      }

      // 2. API Status
      if (req.method === 'GET' && req.url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(this.getPlayerState()));
        return;
      }

      // 3. Static Files (HTML, CSS, JS)
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

      const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
      const fullPath = path.join(PUBLIC_DIR, safePath);

      if (fullPath.startsWith(PUBLIC_DIR) && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    });

    this.server.listen(this.port, () => {
      console.log(`[Dashboard] Web Server đang chạy tại http://localhost:${this.port}`);
    });
    
    global.dashboardServer = this;
  }
}

module.exports = new DashboardServer();
