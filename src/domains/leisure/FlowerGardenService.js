/**
 * FlowerGardenService: Tự Động Vườn Hoa, Thu Hoạch Bong Bóng Hoa, Thêu Hoa & Trộm Hoa Bạn Bè
 * 100% Đọc trực tiếp từ Server Game qua Module embroideryMessage (153101 -> 153217)
 */

const BaseService = require('../base/BaseService');

class FlowerGardenService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'flower',
      domain: 'leisure',
      name: '[Vườn Hoa] Vườn Hoa & Trộm Hoa',
      menuOption: 7,
      listenedMsgIds: [153201, 153202, 153203, 153213, 153217]
    });
  }

  async execute() {
    return this.autoGardenAll();
  }

  async autoGardenAll() {
    console.log('\n[Auto Vườn Hoa & Thêu Hoa] BẮT ĐẦU CHĂM SÓC VƯỜN HOA...');

    // 1. Vào Vườn Thêu Hoa của bản thân
    console.log('  [-] Đang kiểm tra trạng thái Vườn Hoa Cung Đình từ Server...');
    this.client.gardenInfo = null;
    this.client.lastReturnCode = null;
    this.send(153101, {});
    await this.waitFor(() => this.client.gardenInfo !== null || this.client.lastReturnCode !== null);

    // Kiểm tra xem tính năng đã mở khóa chưa
    if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 153101 && this.client.lastReturnCode.code !== 0) {
      console.log('  [-] [Vườn Hoa] Tính năng Vườn Hoa & Thêu Hoa chưa mở khóa.\n');
      return;
    }

    if (!this.client.gardenInfo) {
      console.log('  [-] [Vườn Hoa] Chưa thể kết nối vào Vườn Hoa lúc này.');
      return;
    }

    // 2. Thu hoạch bong bóng hoa / nguyên liệu thêu
    console.log('  [+] Đang thu hoạch bong bóng hoa & giọt sương...');
    this.client.lastReturnCode = null;
    this.send(153103, {});
    await this.sleepRandom(0.8, 1.5);

    if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 153103 && this.client.lastReturnCode.code === 0) {
      console.log('    Thu hoạch bong bóng hoa THÀNH CÔNG!');
    } else {
      console.log('    [-] Hiện tại chưa có bong bóng hoa mới để thu hoạch.');
    }

    // 3. Kiểm tra tiến độ thêu hoa & nhận thưởng nếu hoàn thành
    this.client.lastReturnCode = null;
    this.send(153111, {});
    await this.sleepRandom(1.0, 1.5);

    if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 153111 && this.client.lastReturnCode.code === 0) {
      console.log('    Nhận thưởng hoàn thành Thêu Hoa THÀNH CÔNG!');
    }

    // Gửi lệnh thêu hoa
    this.send(153110, {});
    await this.sleepRandom(1.0, 1.5);

    // 4. Quét danh sách Bạn Bè & Bảng Xếp Hạng để Hái / Trộm Hoa & Hỗ Trợ
    console.log('  [-] Đang quét danh sách Bạn bè để tìm hoa có thể hái trộm & chăm sóc hộ...');
    this.client.flowerRankList = null;
    this.send(153113, { friendRank: true });
    await this.sleepRandom(1.2, 2.0);

    const rankData = this.client.flowerRankList || {};
    const canStealIds = rankData.canStealIds || [];
    const canAssistIds = rankData.canAssistantIds || [];

    let stolenCount = 0;
    if (canStealIds.length > 0) {
      console.log(`  [+] Tìm thấy ${canStealIds.length} Vườn Hoa bạn bè có thể hái trộm hoa! Bắt đầu hái...`);
      for (const targetId of canStealIds) {
        console.log(`    -> Đang ghé thăm & hái hoa Vườn Bạn Bè...`);
        this.send(153102, { targetPlayerId: targetId });
        await this.sleepRandom(1.0, 1.8);
        this.send(153103, {});
        await this.sleepRandom(0.8, 1.2);
        stolenCount++;
      }
      console.log(`  Đã hái trộm hoa THÀNH CÔNG từ ${stolenCount} khu vườn bạn bè!`);
    } else {
      console.log('  [-] Hiện tại bạn bè chưa có hoa chín để hái trộm.');
    }

    let assistCount = 0;
    if (canAssistIds.length > 0) {
      console.log(`  [+] Tìm thấy ${canAssistIds.length} Vườn Hoa cần chăm sóc hộ...`);
      for (const targetId of canAssistIds) {
        this.send(153107, { friendPlayerId: targetId });
        await this.sleepRandom(0.8, 1.5);
        assistCount++;
      }
      console.log(`  Đã chăm sóc giúp ${assistCount} bạn bè!`);
    }

    // 5. Rời khỏi Vườn Hoa
    this.send(153112, {});
    console.log('[Auto Vườn Hoa] Hoàn tất toàn bộ công việc chăm sóc & thu hoạch hoa!');
  }
}

module.exports = FlowerGardenService;
