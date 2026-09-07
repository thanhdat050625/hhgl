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

const readJsonBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
};

class DashboardServer {
  constructor() {
    this.server = null;
    this.port = 10000;
    this.client = null; // Single-client fallback
    this.multiManager = null;
    this.workers = new Map(); // email.toLowerCase() -> AccountWorker
    this.selectedEmail = null;
    this.sseClients = new Set();
    
    this.logBuffer = [];
    this.MAX_LOGS = 300;
    
    this.statusMessage = '';
    this.BUILD_ID = Date.now().toString();
    
    this.setupLogInterceptor();
  }

  setMultiManager(manager) {
    this.multiManager = manager;
  }

  registerWorker(worker) {
    if (!worker || !worker.email) return;
    this.workers.set(worker.email.toLowerCase(), worker);
    if (!this.selectedEmail) {
      this.selectedEmail = worker.email;
    }
  }

  setupLogInterceptor() {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      originalLog.apply(console, args);
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (!msg || msg.trim() === '') return;
      this.addLogEntry(msg, 'info');
    };

    console.error = (...args) => {
      originalError.apply(console, args);
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (!msg || msg.trim() === '') return;
      this.addLogEntry(msg, 'error');
    };
  }

  addLogEntry(text, type = 'info') {
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
      text: text,
      type: type
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

  getAllAccounts() {
    if (this.multiManager) {
      return this.multiManager.getAllAccountsSummary();
    }
    if (this.workers.size > 0) {
      return Array.from(this.workers.values()).map(w => w.getSummary());
    }
    if (this.client) {
      const p = this.client.playerData;
      return [{
        email: this.client.accountEmail || 'Single Account',
        status: 'on',
        enabled: true,
        state: this.client.isReady ? 'RUNNING' : 'STARTING',
        isReady: this.client.isReady,
        serverName: this.client.serverInfo?.serverName || '--',
        serverId: this.client.serverInfo?.serverId || '--',
        playerName: p?.name || '--',
        playerLv: p?.lv || 0,
        power: p?.power || 0,
        gold: p?.gold || 0,
        silver: p?.silver || 0,
        food: p?.food || 0,
        soldier: p?.soldier || 0,
        exp: p?.exp || 0
      }];
    }
    return [];
  }

  getPlayerState(targetEmail = null) {
    let client = null;
    let email = targetEmail || this.selectedEmail;

    if (email) {
      const worker = this.workers.get(email.toLowerCase());
      if (worker && worker.client) {
        client = worker.client;
      }
    }

    // Nếu chưa có, lấy worker đầu tiên đang chạy
    if (!client && this.workers.size > 0) {
      for (const [wEmail, worker] of this.workers.entries()) {
        if (worker.client && worker.client.isReady) {
          client = worker.client;
          email = worker.email;
          this.selectedEmail = worker.email;
          break;
        }
      }
      if (!client) {
        const firstWorker = this.workers.values().next().value;
        if (firstWorker) {
          client = firstWorker.client;
          email = firstWorker.email;
          this.selectedEmail = firstWorker.email;
        }
      }
    }

    if (!client) {
      client = this.client;
    }

    if (!client) return { isReady: false, email: email || '' };
    
    let nexp = 0;
    let rankName = '';
    if (client.playerData) {
      try {
        const { getLevelInfo } = require('../config');
        const lvlInfo = getLevelInfo(client.playerData.lv || 1);
        nexp = lvlInfo.maxExp || 0;
        rankName = lvlInfo.name || `Cấp ${client.playerData.lv}`;
      } catch (e) {}
    }

    return {
      isReady: client.isReady,
      email: email || client.accountEmail || '',
      serverName: client.serverInfo ? (client.serverInfo.serverName || client.serverInfo.name) : 'Unknown',
      serverId: client.serverInfo ? client.serverInfo.serverId : '',
      rankName: rankName,
      playerData: client.playerData || null,
      resources: client.playerData ? {
        gold: client.playerData.gold,
        silver: client.playerData.silver,
        food: client.playerData.food,
        soldier: client.playerData.soldier,
        exp: client.playerData.exp,
        nexp: nexp
      } : null,
      cooldowns: {
        trade: client.tradeInfoList || [],
        affair: client.affair ? client.affair.workList : []
      }
    };
  }

  broadcastAccountsUpdate() {
    this.broadcastSSE('accounts_update', {
      accounts: this.getAllAccounts(),
      selectedEmail: this.selectedEmail,
      playerState: this.getPlayerState(this.selectedEmail),
      syncStatus: this.multiManager?.lastSyncStatus || 'Hoạt động'
    });
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
    
    this.server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const urlParts = req.url.split('?');
      const reqPath = urlParts[0];

      // 1. SSE Realtime Stream
      if (req.method === 'GET' && reqPath === '/events') {
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
          accounts: this.getAllAccounts(),
          selectedEmail: this.selectedEmail,
          playerState: this.getPlayerState(this.selectedEmail),
          syncStatus: this.multiManager?.lastSyncStatus || 'Hoạt động',
          noteUrl: this.multiManager?.noteManager?.noteUrl || process.env.NOTE_URL || '',
          noteTitle: this.multiManager?.noteManager?.noteTitle || process.env.NOTE_TITLE || ''
        })}\n\n`);

        const pingInterval = setInterval(() => {
          try {
            res.write(':\n\n'); 
            res.write(`event: player_state\ndata: ${JSON.stringify(this.getPlayerState(this.selectedEmail))}\n\n`);
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

      // 2. API: Lấy trạng thái tóm tắt
      if (req.method === 'GET' && reqPath === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          accounts: this.getAllAccounts(),
          selectedEmail: this.selectedEmail,
          playerState: this.getPlayerState(this.selectedEmail),
          syncStatus: this.multiManager?.lastSyncStatus,
          noteUrl: this.multiManager?.noteManager?.noteUrl || process.env.NOTE_URL || '',
          noteTitle: this.multiManager?.noteManager?.noteTitle || process.env.NOTE_TITLE || ''
        }));
        return;
      }

      // 3. API: Danh sách tài khoản
      if (req.method === 'GET' && reqPath === '/api/accounts') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          accounts: this.getAllAccounts(),
          selectedEmail: this.selectedEmail,
          syncStatus: this.multiManager?.lastSyncStatus
        }));
        return;
      }

      // 4. API: Bật/Tắt tài khoản và lưu lên Note
      if (req.method === 'POST' && reqPath === '/api/accounts/toggle') {
        try {
          const body = await readJsonBody(req);
          if (!body.email) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Thiếu email tài khoản' }));
            return;
          }

          if (this.multiManager) {
            const accounts = await this.multiManager.manualToggle(body.email, body.status);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, accounts: accounts }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'MultiAccountManager chưa sẵn sàng' }));
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // 5. API: Chọn tài khoản xem chi tiết trên giao diện
      if (req.method === 'POST' && reqPath === '/api/accounts/select') {
        try {
          const body = await readJsonBody(req);
          if (body.email) {
            this.selectedEmail = body.email;
            this.broadcastSSE('player_state', this.getPlayerState(body.email));
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, playerState: this.getPlayerState(this.selectedEmail) }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // 6. API: Thêm tài khoản mới
      if (req.method === 'POST' && reqPath === '/api/accounts/add') {
        try {
          const body = await readJsonBody(req);
          if (!body.email || !body.password) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Thiếu email hoặc mật khẩu' }));
            return;
          }

          if (this.multiManager) {
            const accounts = await this.multiManager.manualAdd(body.email, body.password, body.status || 'on', body.serverId);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, accounts: accounts }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'MultiAccountManager chưa sẵn sàng' }));
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // 7. API: Xóa tài khoản
      if (req.method === 'POST' && reqPath === '/api/accounts/delete') {
        try {
          const body = await readJsonBody(req);
          if (!body.email) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Thiếu email' }));
            return;
          }

          if (this.multiManager) {
            const accounts = await this.multiManager.manualDelete(body.email);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, accounts: accounts }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'MultiAccountManager chưa sẵn sàng' }));
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // 8. API: Ép đồng bộ tức thì với Note
      if (req.method === 'POST' && reqPath === '/api/sync') {
        try {
          if (this.multiManager) {
            await this.multiManager.syncWithNote();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, accounts: this.getAllAccounts() }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'MultiAccountManager chưa sẵn sàng' }));
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // 9. Static Files (HTML, CSS, JS)
      let staticPath = reqPath;
      if (staticPath === '/' || staticPath === '') staticPath = '/index.html';
      if (staticPath === '/config' || staticPath === '/config/') staticPath = '/config.html';

      const safePath = path.normalize(staticPath).replace(/^(\.\.[\/\\])+/, '');
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
