require('dotenv').config();

const { MultiAccountManager } = require('./core');
const DashboardServer = require('./server/DashboardServer');

// Khởi chạy bot multi-account đồng bộ Web Note
async function main() {
  const port = parseInt(process.env.PORT, 10);
  if (isNaN(port)) throw new Error('[CONFIG ERROR] Biến môi trường PORT bắt buộc phải được khai báo trong .env!');
  DashboardServer.start(port);

  const pollIntervalMs = process.env.NOTE_POLL_INTERVAL_MS ? parseInt(process.env.NOTE_POLL_INTERVAL_MS, 10) : 10000;
  const manager = new MultiAccountManager({
    pollIntervalMs
  });

  DashboardServer.setMultiManager(manager);

  const handleExit = async () => {
    console.log('\n[-] Nhận tín hiệu dừng, đang ngắt an toàn toàn bộ tài khoản...');
    await manager.stopAll();
    process.exit(0);
  };
  process.once('SIGINT', handleExit);
  process.once('SIGTERM', handleExit);

  await manager.start();
}

if (require.main === module) {
  main().catch(err => {
    console.error('\n[X] Đã xảy ra lỗi khởi động hệ thống:', err.message || err);
    process.exit(1);
  });
}

module.exports = main;
