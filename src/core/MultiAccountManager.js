/**
 * Core Service: MultiAccountManager
 * Điều phối đa tài khoản và đồng bộ thời gian thực mỗi 10s với Web Note
 */

const NoteManager = require('./NoteManager');
const AccountWorker = require('./AccountWorker');

class MultiAccountManager {
  constructor(options = {}) {
    this.noteManager = new NoteManager(options);
    this.workers = new Map(); // Map<email.toLowerCase(), AccountWorker>
    this.pollIntervalMs = options.pollIntervalMs || 10000; // 10 giây
    this.pollTimer = null;
    this.isSyncing = false;
    this.lastSyncTime = 0;
    this.lastSyncStatus = 'CHƯA ĐỒNG BỘ';
  }

  /**
   * Đồng bộ hóa trạng thái tài khoản với Web Note
   */
  async syncWithNote() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const accounts = await this.noteManager.getAccounts();
      this.lastSyncTime = Date.now();
      this.lastSyncStatus = `Thành công (${accounts.length} tài khoản)`;

      const noteEmails = new Set(accounts.map(a => a.email.toLowerCase()));

      // 1. Kiểm tra từng tài khoản trong Note
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

        // Đồng bộ trạng thái ON / OFF
        if (acc.enabled) {
          // Trạng thái Note là ON
          if (worker.state === 'STOPPED') {
            console.log(`[Sync] [${acc.email}] Trạng thái Note là ON -> Kích hoạt chạy bot...`);
            // Chạy bất đồng bộ, không chờ blocking
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

      // 2. Kiểm tra các tài khoản đã bị xóa khỏi Note
      for (const [key, worker] of this.workers.entries()) {
        if (!noteEmails.has(key)) {
          console.log(`[Sync] [${worker.email}] Đã bị xóa khỏi Web Note -> Dừng hoạt động và giải phóng...`);
          worker.stop();
          this.workers.delete(key);
        }
      }

      // Cập nhật lên Web Dashboard
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

  /**
   * Bật/Tắt tài khoản thủ công từ Web UI (Cập nhật tức thì vào Note và Worker)
   */
  async manualToggle(email, explicitStatus = null) {
    console.log(`[User Action] Yêu cầu chuyển trạng thái tài khoản: ${email} -> ${explicitStatus || 'Toggle'}`);
    
    // 1. Cập nhật lên Web Note trên Render
    const { account } = await this.noteManager.toggleAccount(email, explicitStatus);

    // 2. Áp dụng ngay lập tức vào Worker
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

  /**
   * Thêm tài khoản mới từ Web UI
   */
  async manualAdd(email, password, status = 'on', serverId = null) {
    await this.noteManager.addAccount(email, password, status, serverId);
    await this.syncWithNote();
    return this.getAllAccountsSummary();
  }

  /**
   * Xóa tài khoản từ Web UI
   */
  async manualDelete(email) {
    const key = email.toLowerCase();
    const worker = this.workers.get(key);
    if (worker) {
      worker.stop();
      this.workers.delete(key);
    }

    await this.noteManager.deleteAccount(email);
    if (global.dashboardServer) {
      global.dashboardServer.broadcastAccountsUpdate();
    }
    return this.getAllAccountsSummary();
  }

  /**
   * Bắt đầu tiến trình quản lý và vòng lặp đồng bộ định kỳ 10s
   */
  async start() {
    console.log('\n================================================================');
    console.log('--- KHỞI ĐỘNG HỆ THỐNG MULTI-ACCOUNT 24/7 (ĐỒNG BỘ WEB NOTE) ---');
    console.log(`[*] Nguồn dữ liệu Note : ${this.noteManager.noteUrl}`);
    console.log(`[*] Chu kỳ quét Note   : ${this.pollIntervalMs / 1000} giây/lần`);
    console.log('================================================================\n');

    // Đồng bộ đợt đầu tiên ngay lập tức
    await this.syncWithNote();

    // Thiết lập định kỳ mỗi 10 giây
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(async () => {
      await this.syncWithNote();
    }, this.pollIntervalMs);
  }

  /**
   * Dừng toàn bộ hệ thống và tất cả các tài khoản
   */
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

  /**
   * Lấy danh sách tóm tắt toàn bộ tài khoản
   */
  getAllAccountsSummary() {
    const list = [];
    for (const worker of this.workers.values()) {
      list.push(worker.getSummary());
    }
    return list;
  }
}

module.exports = MultiAccountManager;
