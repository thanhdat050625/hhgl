require('dotenv').config();

const { MultiAccountManager } = require('./core');
const DashboardServer = require('./server/DashboardServer');

/**
 * Điểm khởi chạy chính của Bot Hoàng Hậu Cát Tường
 * Chạy chế độ Multi-Account tự động đồng bộ 2 chiều với Web Note
 */
async function main() {
  // 1. Khởi động Web Dashboard Server
  const port = process.env.PORT || 10000;
  DashboardServer.start(port);

  // 2. Khởi tạo MultiAccountManager
  const pollIntervalMs = process.env.NOTE_POLL_INTERVAL_MS ? parseInt(process.env.NOTE_POLL_INTERVAL_MS, 10) : 10000;
  const manager = new MultiAccountManager({
    pollIntervalMs
  });

  DashboardServer.setMultiManager(manager);

  // 3. Xử lý ngắt tiến trình an toàn (Ctrl + C / SIGINT / SIGTERM)
  const handleExit = async () => {
    console.log('\n[-] Nhận tín hiệu dừng, đang ngắt an toàn toàn bộ tài khoản...');
    await manager.stopAll();
    process.exit(0);
  };
  process.once('SIGINT', handleExit);
  process.once('SIGTERM', handleExit);

  // 4. Bắt đầu vòng lặp đồng bộ Note và điều phối các worker tài khoản
  await manager.start();
}

if (require.main === module) {
  main().catch(err => {
    console.error('\n[X] Đã xảy ra lỗi khởi động hệ thống:', err.message || err);
    process.exit(1);
  });
}

module.exports = main;
