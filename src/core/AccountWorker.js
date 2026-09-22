// AccountWorker: Quản lý vòng đời hoạt động của tài khoản Game

const { EncryptHelper } = require('./crypto');
const { loginGame, authenticateSdk, getGatewayAuth } = require('./auth');
const { GameClient } = require('../bot');
const { CONFIG } = require('../config/constants');
const { runWithAccount } = require('./accountContext');

class AccountWorker {
  constructor(account, multiManager) {
    this.account = account;
    this.multiManager = multiManager;
    this.encryptHelper = new EncryptHelper();
    this.client = null;
    this.state = 'STOPPED';
    this.lastError = null;
    this.startedAt = null;
    this.retryCount = 0;
    this.lastRetryTime = 0;
    this.isStopping = false;
  }

  get email() {
    return this.account.email;
  }

  get isRunning() {
    return this.state === 'RUNNING';
  }

  // Cập nhật thông tin tài khoản
  updateAccount(newAccount) {
    const credsChanged = this.account.password !== newAccount.password ||
                         this.account.serverId !== newAccount.serverId;
    this.account = newAccount;
    return credsChanged;
  }

  // Bắt đầu phiên làm việc
  async start() {
    if (this.state === 'RUNNING' || this.state === 'STARTING') {
      return;
    }
    return runWithAccount(this.email, async () => {
      await this._executeStart();
    });
  }

  async _executeStart() {
    this.isStopping = false;
    this.state = 'STARTING';
    this.lastError = null;

    console.log(`\n[+] [${this.email}] Bắt đầu khởi chạy tài khoản...`);

    try {
      console.log(`[${this.email}] [1/4] Đang xác thực tài khoản Portal...`);
      const loginUrl = await loginGame(this.account.email, this.account.password);

      if (this.isStopping) return;

      console.log(`[${this.email}] [2/4] Đang xác thực SDK Game...`);
      const sdkAuth = await authenticateSdk(loginUrl);

      if (this.isStopping) return;

      console.log(`[${this.email}] [3/4] Đang kết nối Gateway lấy danh sách server...`);
      const { gateId, rcode, serverList, myServerList } = await getGatewayAuth(sdkAuth, this.encryptHelper);

      if (this.isStopping) return;

      let chosenServer = null;
      if (this.account.serverId) {
        chosenServer = serverList.find(s => s.serverId === this.account.serverId) ||
                       myServerList.find(s => s.serverId === this.account.serverId);
      }

      if (!chosenServer) {
        if (myServerList && myServerList.length > 0) {
          chosenServer = myServerList[0];
        } else {
          const targetSId = CONFIG.DEFAULT_SERVER_ID;
          chosenServer = serverList.find(s => s.serverId === targetSId) || serverList[0];
        }
      }

      if (!chosenServer) {
        throw new Error(`Không tìm thấy thông tin Server phù hợp cho tài khoản ${this.email}`);
      }

      console.log(`[${this.email}] [4/4] Chọn Server: ${chosenServer.serverId} - ${chosenServer.serverName || chosenServer.name || ''}`);

      this.client = new GameClient(chosenServer, rcode, gateId, this.encryptHelper);
      this.client.accountEmail = this.email;

      if (global.dashboardServer) {
        global.dashboardServer.registerWorker(this);
      }

      await this.client.connect();

      let waitCount = 0;
      while (!this.client.isReady && !this.client.isManualClosed) {
        await new Promise(r => setTimeout(r, 200));
        waitCount++;
        if (waitCount > 100) {
          throw new Error('Hết thời gian chờ đồng bộ dữ liệu ban đầu từ Game Server.');
        }
      }

      if (this.client.isManualClosed || this.isStopping) {
        this.state = 'STOPPED';
        return;
      }

      this.state = 'RUNNING';
      this.startedAt = Date.now();
      this.retryCount = 0;

      const pName = this.client.playerData?.name || 'Chưa đặt tên';
      const pLv = this.client.playerData?.lv || 1;
      console.log(`[✓] [${this.email}] Đăng nhập thành công! Nhân vật: ${pName} (Cấp ${pLv}) tại Server ${chosenServer.serverId}`);

      if (global.dashboardServer) {
        global.dashboardServer.broadcastAccountsUpdate();
      }

      this.runAutoLoop();

    } catch (err) {
      this.state = 'ERROR';
      this.lastError = err.message || String(err);
      console.error(`[X] [${this.email}] Lỗi khởi chạy:`, this.lastError);

      if (this.client) {
        try { this.client.close(); } catch (_) {}
      }

      if (global.dashboardServer) {
        global.dashboardServer.broadcastAccountsUpdate();
      }
    }
  }

  // Vòng lặp Auto 24/7 của tài khoản
  async runAutoLoop() {
    return runWithAccount(this.email, async () => {
      try {
        if (this.client && this.client.trade) {
          await this.client.trade.autoDailyLoopContinuous();
        }
      } catch (err) {
        if (!this.isStopping && !this.client?.isManualClosed) {
          console.error(`[X] [${this.email}] Lỗi trong vòng lặp auto:`, err.message);
        }
      } finally {
        if (this.state === 'RUNNING') {
          this.state = 'STOPPED';
        }
        if (global.dashboardServer) {
          global.dashboardServer.broadcastAccountsUpdate();
        }
      }
    });
  }

  // Dừng an toàn tài khoản
  stop() {
    return runWithAccount(this.email, () => {
      if (this.state === 'STOPPED' && !this.client) {
        return;
      }

      this.isStopping = true;
      this.state = 'STOPPED';

      console.log(`[-] [${this.email}] Đang ngắt kết nối an toàn...`);

      if (this.client) {
        try {
          this.client.close();
        } catch (e) {
          console.error(`[!] [${this.email}] Lỗi khi đóng client:`, e.message);
        }
        this.client = null;
      }

      console.log(`[-] [${this.email}] Đã dừng hoạt động thành công.`);

      if (global.dashboardServer) {
        global.dashboardServer.broadcastAccountsUpdate();
      }
    });
  }

  // Lấy dữ liệu tóm tắt tài khoản
  getSummary() {
    const isReady = this.client ? this.client.isReady : false;
    const pData = this.client?.playerData;
    const sInfo = this.client?.serverInfo;

    return {
      email: this.email,
      passwordMasked: this.account.password ? (this.account.password.substring(0, 2) + '****') : '',
      status: this.account.status,
      enabled: this.account.enabled,
      state: this.state,
      isReady: isReady,
      serverName: sInfo ? (sInfo.serverName || sInfo.name) : (this.account.serverId ? `Server ${this.account.serverId}` : '--'),
      serverId: sInfo ? sInfo.serverId : (this.account.serverId || '--'),
      playerName: pData?.name || (this.state === 'RUNNING' ? 'Đang tải...' : '--'),
      playerLv: pData?.lv || 0,
      power: pData?.power || 0,
      gold: pData?.gold || 0,
      silver: pData?.silver || 0,
      food: pData?.food || 0,
      soldier: pData?.soldier || 0,
      exp: pData?.exp || 0,
      lastError: this.lastError,
      startedAt: this.startedAt
    };
  }
}

module.exports = AccountWorker;
