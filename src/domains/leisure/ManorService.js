/**
 * ManorService: Tự Động Trang Viên Nông Trại (Trồng Trọt 1-Chạm & Thu Hoạch Nông Sản)
 * 100% Đọc trực tiếp từ Server qua Module manorMessage (142101 -> 142211)
 */

const BaseService = require('../base/BaseService');

class ManorService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'manor',
      domain: 'leisure',
      name: '[Trang Viên] Trang Viên Nông Trại',
      menuOption: 8,
      listenedMsgIds: [142201, 142202, 142205, 142210]
    });
  }

  async execute() {
    return this.autoFarm();
  }

  async autoFarm() {
    console.log('\n[Auto Trang Viên] Đang kiểm tra đất trồng & nông sản...');

    // 1. Quét thông tin nông trại
    this.client.manorInfo = null;
    this.send(142101, {});
    await this.waitFor(() => this.client.manorInfo !== null);

    // 2. Thu hoạch nông sản chín
    console.log('  [+] Đang thu hoạch toàn bộ hoa màu & nông sản chín...');
    for (let plotId = 1; plotId <= 8; plotId++) {
      this.send(142105, { type: 1, plotId });
      await this.sleepRandom(0.4, 0.8);
    }

    // 3. Trồng hạt giống mới (1-chạm)
    console.log('  [+] Đang gieo hạt giống mới vào các ô đất...');
    this.send(142110, { seedIds: [1, 2, 3, 4, 5] });
    await this.sleepRandom(1.0, 1.5);

    console.log('[Auto Trang Viên] Hoàn tất thu hoạch & gieo hạt nông trại!');
  }
}

module.exports = ManorService;
