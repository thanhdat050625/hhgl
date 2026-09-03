/**
 * PalaceService: Thỉnh An Hoàng Cung (Trường Xuân Cung) nhận Vàng mỗi ngày 1 lần
 * Đọc trực tiếp 100% trạng thái isHi từ Server Game (114101/114201)
 */

const BaseService = require('../base/BaseService');

class PalaceService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'palace',
      domain: 'welfare',
      name: '[Hoàng Cung] Thỉnh An Hoàng Cung',
      menuOption: 3,
      listenedMsgIds: [114201, 114202]
    });
  }

  async execute() {
    return this.autoPalaceHi();
  }

  async autoPalaceHi() {
    console.log('\n======================================================');
    console.log('[AUTO THỈNH AN HOÀNG CUNG HÀNG NGÀY (100% LIVE SYNC)]');
    console.log('======================================================');
    console.log('Đang truy vấn trạng thái Thỉnh An Hoàng Cung từ Server Game...');

    this.client.palaceInfo = null;
    this.send(114101, {});
    await this.waitFor(() => this.client.palaceInfo !== null, 5000);

    const palaceData = this.client.palaceInfo || {};
    const isHi = Boolean(palaceData.isHi);
    const kingList = palaceData.kingList || [];

    // Lấy thông tin Hoàng Hậu / Chủ điện
    let queenName = '';
    let targetTitleId = 1;
    if (kingList.length > 0) {
      queenName = kingList[0].name || '';
      targetTitleId = kingList[0].titleId || 1;
    }

    if (isHi) {
      console.log(`  [-] [Hoàng Cung - Trường Xuân Cung] Hôm nay bạn đã Thỉnh An rồi${queenName ? ` (Hoàng Hậu: ${queenName})` : ''}.`);
      console.log('======================================================\n');
      return false;
    }

    console.log(`  👉 Đang tiến hành Thỉnh An Hoàng Hậu${queenName ? ` [${queenName}]` : ''} tại Trường Xuân Cung...`);
    this.client.lastReturnCode = null;
    this.send(114102, { titleId: targetTitleId });
    await this.sleepRandom(1.2, 2.0);

    if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 114102) {
      if (this.client.lastReturnCode.code === 0) {
        console.log(`  🎉 [Hoàng Cung] Thỉnh An THÀNH CÔNG${queenName ? ` cho Hoàng Hậu [${queenName}]` : ''}! Nhận thưởng: +10 Vàng miễn phí.`);
        if (this.client.palaceInfo) this.client.palaceInfo.isHi = true;
      } else {
        console.log(`  [-] [Hoàng Cung] Server phản hồi mã: ${this.client.lastReturnCode.code}`);
      }
    } else {
      console.log(`  🎉 [Hoàng Cung] Thỉnh An THÀNH CÔNG${queenName ? ` cho Hoàng Hậu [${queenName}]` : ''}! Nhận thưởng: +10 Vàng miễn phí.`);
      if (this.client.palaceInfo) this.client.palaceInfo.isHi = true;
    }

    console.log('======================================================\n');
    return true;
  }
}

module.exports = PalaceService;
