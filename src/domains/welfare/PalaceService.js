/**
 * Palace Service: Thỉnh An Hoàng Cung Bái Kiến Nhận Vàng Mỗi Ngày
 * Đọc trực tiếp 100% trạng thái isHi từ Server Game (114101/114201)
 */

const BaseService = require('../base/BaseService');

class PalaceService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'palace',
      domain: 'welfare',
      name: '[Hoàng Cung] Thỉnh An Hoàng Cung',
      menuOption: 5,
      listenedMsgIds: [114201, 114202]
    });
  }

  async execute() {
    return this.autoPalaceHi();
  }

  async autoPalaceHi() {
    console.log('\n[Auto Hoàng Cung] Đang kiểm tra trạng thái Thỉnh an từ Server...');
    this.client.palaceInfo = null;
    this.client.lastReturnCode = null;
    this.send(114101, {});
    await this.waitFor(() => this.client.palaceInfo !== null);

    if (this.client.palaceInfo && this.client.palaceInfo.isHi) {
      console.log('  [-] [Hoàng Cung] Server xác nhận: Hôm nay bạn đã thỉnh an Hoàng Cung rồi.\n');
      return;
    }

    console.log('  [+] Đang gửi lệnh Thỉnh an Hoàng Cung nhận thưởng Vàng...');
    this.client.lastReturnCode = null;
    this.send(114102, { palaceId: 1 });
    await this.sleepRandom(1.0, 1.8);

    if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 114102 && this.client.lastReturnCode.code === 0) {
      console.log('  [OK] [Hoàng Cung] Thỉnh an THÀNH CÔNG! Đã nhận thưởng +10 Vàng miễn phí.');
    } else if (this.client.lastReturnCode && this.client.lastReturnCode.code !== 0) {
      console.log(`  [-] [Hoàng Cung] Server phản hồi mã: ${this.client.lastReturnCode.code}`);
    } else {
      console.log('  [OK] [Hoàng Cung] Thỉnh an THÀNH CÔNG! Đã nhận thưởng Vàng từ Hoàng Thượng.');
    }
  }
}

module.exports = PalaceService;
