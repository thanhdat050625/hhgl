/**
 * Core Service: AccountWorker
 * Quản lý vòng đời hoạt động độc lập của một tài khoản Game
 */

const { EncryptHelper, loginGame, authenticateSdk, getGatewayAuth } = require('./auth');
const { GameClient } = require('../bot');

class AccountWorker {
  constructor(account, multiManager) {
    this.account = account; // { email, password, status, enabled, serverId }
    this.multiManager = multiManager;
    this.encryptHelper = new EncryptHelper();
    this.client = null;
    this.state = 'STOPPED'; // 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR'
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

  /**
   * Cập nhật thông tin tài khoản (nếu có thay đổi mật khẩu hoặc server từ Note)
   */
  updateAccount(newAccount) {
    const credsChanged = this.account.password !== newAccount.password ||
                         this.account.serverId !== newAccount.serverId;
    this.account = newAccount;
    return credsChanged;
  }

  /**
   * Bắt đầu phiên làm việc của tài khoản
   */
  async start() {
    if (this.state === 'RUNNING' || this.state === 'STARTING') {
      return;
    }

    this.isStopping = false;
    this.state = 'STARTING';
    this.lastError = null;

    console.log(`\n================================================================`);
    console.log(`[+] [${this.email}] Bắt đầu tiến trình khởi chạy tài khoản...`);
    console.log(`================================================================`);

    try {
      // 1. Đăng nhập H5
      console.log(`[${this.email}] [1/4] Đang xác thực tài khoản Portal...`);
      const loginUrl = await loginGame(this.account.email, this.account.password);

      if (this.isStopping) return;

      // 2. Xác thực SDK
      console.log(`[${this.email}] [2/4] Đang xác thực SDK Game...`);
      const sdkAuth = await authenticateSdk(loginUrl);

      if (this.isStopping) return;

      // 3. Kết nối Gateway
      console.log(`[${this.email}] [3/4] Đang kết nối Gateway lấy danh sách server...`);
      const { gateId, rcode, serverList, myServerList } = await getGatewayAuth(sdkAuth, this.encryptHelper);

      if (this.isStopping) return;

      // 4. Lựa chọn Server
      let chosenServer = null;
      if (this.account.serverId) {
        chosenServer = serverList.find(s => s.serverId === this.account.serverId) ||
                       myServerList.find(s => s.serverId === this.account.serverId);
      }

      if (!chosenServer) {
        if (myServerList && myServerList.length > 0) {
          chosenServer = myServerList[0]; // Server đã chơi gần nhất
        } else if (process.env.GAME_SERVER_ID) {
          const envSId = parseInt(process.env.GAME_SERVER_ID);
          chosenServer = serverList.find(s => s.serverId === envSId) || serverList[0];
        } else {
          chosenServer = serverList.find(s => s.serverId === 1105) || serverList[0];
        }
      }

      if (!chosenServer) {
        throw new Error(`Không tìm thấy thông tin Server phù hợp cho tài khoản ${this.email}`);
      }

      console.log(`[${this.email}] [4/4] Chọn Server: ${chosenServer.serverId} - ${chosenServer.serverName || chosenServer.name || ''}`);

      // 5. Khởi tạo GameClient
      this.client = new GameClient(chosenServer, rcode, gateId, this.encryptHelper);
      this.client.accountEmail = this.email;

      // Đồng bộ vào Dashboard Server
      if (global.dashboardServer) {
        global.dashboardServer.registerWorker(this);
      }

      // Kết nối WebSocket Game
      await this.client.connect();

      // Chờ Client đồng bộ đủ dữ liệu
      let waitCount = 0;
      while (!this.client.isReady && !this.client.isManualClosed) {
        await new Promise(r => setTimeout(r, 200));
        waitCount++;
        if (waitCount > 100) { // Quá 20s không sync xong
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

      // 6. Chạy vòng lặp Auto 24/7 (Không chặn luồng chính)
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

  /**
   * Vòng lặp Auto 24/7 của tài khoản
   */
  async runAutoLoop() {
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
  }

  /**
   * Dừng an toàn tài khoản
   */
  stop() {
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
  }

  /**
   * Lấy dữ liệu tóm tắt phục vụ Dashboard và API
   */
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
