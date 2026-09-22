// MultiAccountManager: Điều phối đa tài khoản và đồng bộ với Web Note

const { CONFIG } = require('../config');
const NoteManager = require('./NoteManager');
const AccountWorker = require('./AccountWorker');

class MultiAccountManager {
  constructor(options = {}) {
    this.noteManager = new NoteManager(options);
    this.workers = new Map();
    this.accountOrder = [];
    this.pollIntervalMs = options.pollIntervalMs || (process.env.NOTE_POLL_INTERVAL_MS ? parseInt(process.env.NOTE_POLL_INTERVAL_MS, 10) : 10000);
    this.pollTimer = null;
    this.isSyncing = false;
    this.lastSyncTime = 0;
    this.lastSyncStatus = 'CHƯA ĐỒNG BỘ';
  }

  // Đồng bộ trạng thái tài khoản với Web Note
  async syncWithNote() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const accounts = await this.noteManager.getAccounts();
      this.lastSyncTime = Date.now();
      this.lastSyncStatus = `Thành công (${accounts.length} tài khoản)`;
      this.accountOrder = accounts.map(a => a.email.toLowerCase());

      const noteEmails = new Set(accounts.map(a => a.email.toLowerCase()));

      for (const acc of accounts) {
        const key = acc.email.toLowerCase();
        let worker = this.workers.get(key);

        if (!worker) {
          worker = new AccountWorker(acc, this);
          this.workers.set(key, worker);
        } else {
          const credsChanged = worker.updateAccount(acc);
          if (credsChanged && worker.isRunning) {
            console.log(`[Sync] [${acc.email}] Phát hiện thay đổi mật khẩu/server -> Khởi động lại worker...`);
            worker.stop();
          }
        }

        if (acc.enabled) {
          if (worker.state === 'STOPPED') {
            console.log(`[Sync] [${acc.email}] Trạng thái Note là ON -> Kích hoạt chạy bot...`);
            worker.start().catch(err => {
              console.error(`[Sync] [${acc.email}] Lỗi khởi chạy:`, err.message);
            });
          } else if (worker.state === 'ERROR') {
            // Nếu bị lỗi, thử lại sau ít nhất 60s
            const now = Date.now();
            if (!worker.lastRetryTime || now - worker.lastRetryTime >= 60000) {
              worker.lastRetryTime = now;
              console.log(`[Sync] [${acc.email}] Đang thử lại khởi chạy sau lỗi...`);
              worker.start().catch(err => {
                console.error(`[Sync] [${acc.email}] Lỗi retry:`, err.message);
              });
            }
          }
        } else {
          // Trạng thái Note là OFF
          if (worker.isRunning || worker.state === 'STARTING') {
            console.log(`[Sync] [${acc.email}] Trạng thái Note chuyển sang OFF -> Dừng ngay lập tức!`);
            worker.stop();
          }
        }
      }

      for (const [key, worker] of this.workers.entries()) {
        if (!noteEmails.has(key)) {
          console.log(`[Sync] [${worker.email}] Đã bị xóa khỏi Web Note -> Dừng hoạt động và giải phóng...`);
          worker.stop();
          this.workers.delete(key);
        }
      }

      if (global.dashboardServer) {
        global.dashboardServer.broadcastAccountsUpdate();
      }

    } catch (err) {
      this.lastSyncStatus = `Lỗi: ${err.message}`;
      console.warn(`[MultiAccountManager] Không thể lấy dữ liệu Note (sẽ thử lại sau 10s): ${err.message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  // Bật/Tắt tài khoản thủ công từ Web UI
  async manualToggle(email, explicitStatus = null) {
    console.log(`[User Action] Yêu cầu chuyển trạng thái tài khoản: ${email} -> ${explicitStatus || 'Toggle'}`);
    
    const { account, allAccounts } = await this.noteManager.toggleAccount(email, explicitStatus);
    if (allAccounts) {
      this.accountOrder = allAccounts.map(a => a.email.toLowerCase());
    }

    const key = email.toLowerCase();
    let worker = this.workers.get(key);

    if (!worker) {
      worker = new AccountWorker(account, this);
      this.workers.set(key, worker);
    } else {
      worker.updateAccount(account);
    }

    if (account.enabled) {
      if (worker.state === 'STOPPED' || worker.state === 'ERROR') {
        console.log(`[User Action] BẬT tài khoản ${email} ngay lập tức!`);
        worker.start().catch(e => console.error(`[X] [${email}] Lỗi:`, e.message));
      }
    } else {
      if (worker.isRunning || worker.state === 'STARTING') {
        console.log(`[User Action] TẮT tài khoản ${email} ngay lập tức!`);
        worker.stop();
      }
    }

    if (global.dashboardServer) {
      global.dashboardServer.broadcastAccountsUpdate();
    }

    return this.getAllAccountsSummary();
  }

  // Thêm tài khoản mới từ Web UI
  async manualAdd(email, password, status = 'on', serverId = null) {
    await this.noteManager.addAccount(email, password, status, serverId);
    await this.syncWithNote();
    return this.getAllAccountsSummary();
  }

  // Xóa tài khoản từ Web UI
  async manualDelete(email) {
    const key = email.toLowerCase();
    const worker = this.workers.get(key);
    if (worker) {
      worker.stop();
      this.workers.delete(key);
    }

    const remaining = await this.noteManager.deleteAccount(email);
    if (remaining) {
      this.accountOrder = remaining.map(a => a.email.toLowerCase());
    }
    if (global.dashboardServer) {
      global.dashboardServer.broadcastAccountsUpdate();
    }
    return this.getAllAccountsSummary();
  }

  // Bắt đầu tiến trình quản lý và vòng lặp đồng bộ định kỳ
  async start() {
    console.log(`\n[MultiAccountManager] Khởi động hệ thống (Quét: ${this.pollIntervalMs / 1000}s/lần)`);

    await this.syncWithNote();

    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(async () => {
      await this.syncWithNote();
    }, this.pollIntervalMs);
  }

  // Dừng toàn bộ hệ thống
  async stopAll() {
    console.log('\n[-] Đang dừng toàn bộ hệ thống Multi-Account...');
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    for (const worker of this.workers.values()) {
      worker.stop();
    }

    console.log('[-] Đã dừng an toàn toàn bộ tài khoản.');
  }

  // Lấy tóm tắt toàn bộ tài khoản theo thứ tự Web Note
  getAllAccountsSummary() {
    const list = [];
    const orderMap = new Map();
    const orderedEmails = (this.accountOrder && this.accountOrder.length > 0)
      ? this.accountOrder
      : (this.noteManager?.lastFetchedAccounts || []).map(a => a.email.toLowerCase());

    orderedEmails.forEach((email, idx) => {
      orderMap.set(email.toLowerCase(), idx);
    });

    for (const worker of this.workers.values()) {
      const summary = worker.getSummary ? worker.getSummary() : (worker.toStatusDTO ? worker.toStatusDTO() : {});
      list.push(summary);
    }

    // Đảm bảo tài khoản trong Note chưa khởi tạo worker cũng hiển thị đầy đủ
    const existingEmails = new Set(list.map(a => (a.email || '').toLowerCase()));
    if (this.noteManager?.lastFetchedAccounts) {
      for (const acc of this.noteManager.lastFetchedAccounts) {
        const key = (acc.email || '').toLowerCase();
        if (!existingEmails.has(key)) {
          list.push({
            email: acc.email,
            status: acc.status || 'off',
            enabled: acc.enabled || false,
            state: 'STOPPED',
            isReady: false,
            serverName: '--',
            serverId: acc.serverId || CONFIG.DEFAULT_SERVER_ID,
            playerName: '--',
            playerLv: 0,
            power: 0,
            gold: 0,
            silver: 0,
            food: 0,
            soldier: 0,
            exp: 0
          });
          existingEmails.add(key);
        }
      }
    }

    // Sắp xếp danh sách tài khoản theo đúng thứ tự xuất hiện trong Web Note
    list.sort((a, b) => {
      const emailA = (a.email || '').toLowerCase();
      const emailB = (b.email || '').toLowerCase();
      const idxA = orderMap.has(emailA) ? orderMap.get(emailA) : 999999;
      const idxB = orderMap.has(emailB) ? orderMap.get(emailB) : 999999;
      return idxA - idxB;
    });

    // Đánh số noteIndex chuẩn
    list.forEach((acc, idx) => {
      acc.noteIndex = idx;
    });

    return list;
  }
}

module.exports = MultiAccountManager;
