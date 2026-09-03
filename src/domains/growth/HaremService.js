/**
 * Harem Service: Vấn an Hậu Cung / Tri Kỷ, Nâng cấp Kỹ năng Lam Nhan & Nhận thưởng Thân Mật
 */

const BaseService = require('../base/BaseService');
const { getWifeName } = require('../../config');

class HaremService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'harem',
      domain: 'growth',
      name: '[Hậu Cung] Hậu Cung & Vấn An Tri Kỷ',
      menuOption: 6,
      listenedMsgIds: [106201, 106204, 106211, 106219]
    });
    this.claimedIntimacyMilestones = new Set();
  }

  async execute() {
    return this.autoHaremContinuous(15);
  }

  async autoHaremContinuous(maxTries = 15) {
    const maxEnergy = 3;
    console.log('\n[Auto Hậu Cung] Bước 1: Kiểm tra danh sách Tri Kỷ & Thể lực Hậu Cung...');
    this.client.wifeInfoList = null;
    this.client.lastReturnCode = null;
    this.send(106111, {});
    await this.waitFor(() => this.client.wifeInfoList !== null || this.client.lastReturnCode !== null);

    if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 106111 && this.client.lastReturnCode.code !== 0) {
      console.log(`  [-] [Hậu Cung] Tính năng Hậu Cung chưa mở khóa (Mã lỗi: ${this.client.lastReturnCode.code}).`);
      return;
    }

    const wives = this.client.wifeInfoList || [];
    if (wives.length === 0) {
      console.log('  [-] [Hậu Cung] Hiện tại bạn chưa mở khóa Lam Nhan / Tri Kỷ nào trong Hậu Cung (Hãy vượt ải Cốt Truyện hoặc Xuất Du để kết duyên).');
      return;
    }

    // Nhận thưởng Thân Mật và Nâng Kỹ Năng (chỉ thử 1 lần mỗi session nếu chưa claim)
    for (const w of wives) {
      const wifeKey = `WIFE_${w.wifeId}`;
      if (!this.claimedIntimacyMilestones.has(wifeKey)) {
        this.claimedIntimacyMilestones.add(wifeKey);
        this.send(106110, { nearType: 1, manId: w.wifeId });
        this.send(106110, { nearType: 2, manId: w.wifeId });
      }

      // Nâng kỹ năng Tri Kỷ nếu có EXP
      if (w.exp && w.exp >= 100 && w.skillList && w.skillList.length > 0) {
        for (const skill of w.skillList) {
          this.send(106104, { wifeId: w.wifeId, skillId: skill.skillId, upNum: 1 });
          await this.sleepRandom(0.5, 1.0);
        }
      }
    }

    this.client.wifeEnergyInfo = null;
    this.send(106119, {});
    await this.sleepRandom(1.0, 1.8);

    let currentEnergy = (this.client.wifeEnergyInfo && this.client.wifeEnergyInfo.num !== undefined)
      ? Number(this.client.wifeEnergyInfo.num)
      : 0;

    if (currentEnergy <= 0) {
      console.log(`  [-] [Hậu Cung] Hiện tại đã hết Thể lực vấn an Hậu Cung (0/${maxEnergy} lượt).`);
      return;
    }

    console.log(`  [+] Đang có ${wives.length} Tri Kỷ | Thể lực vấn an: ${currentEnergy}/${maxEnergy} lượt.`);

    let calls = 0;
    while (currentEnergy > 0) {
      this.client.lastReturnCode = null;
      this.client.lastCallWife = null;
      this.send(106101, { type: 1 });
      await this.sleepRandom(1.2, 2.5);

      if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 106101 && this.client.lastReturnCode.code !== 0) {
        if (calls === 0) console.log(`  [-] [Hậu Cung] Hết Thể lực hoặc không thể vấn an lúc này (Mã: ${this.client.lastReturnCode.code}).`);
        break;
      }

      calls++;
      currentEnergy = Math.max(0, currentEnergy - 1);
      if (this.client.lastCallWife && this.client.lastCallWife.callWifeList && this.client.lastCallWife.callWifeList.length > 0) {
        this.client.lastCallWife.callWifeList.forEach(w => {
          const wName = getWifeName(w.wifeId);
          console.log(`  [+] [Lượt ${calls}] Vấn an Tri Kỷ ${wName}: +${w.exp} EXP Tri Kỷ, Sinh con: ${w.childNum} | Thể lực còn: ${currentEnergy}/${maxEnergy}`);
        });
      } else {
        console.log(`  [+] [Lượt ${calls}] Vấn an Tri Kỷ thành công! Thể lực còn lại: ${currentEnergy}/${maxEnergy}`);
      }
      await this.sleepRandom(1.0, 1.8);
    }

    if (calls > 0) {
      console.log(`[OK] [Auto Hậu Cung] Hoàn tất vấn an hậu cung! (Tổng: ${calls} lần | Thể lực còn lại: ${currentEnergy}/${maxEnergy})`);
    }
  }
}

module.exports = HaremService;
