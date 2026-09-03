/**
 * Prison Service: Khảo Vấn Thiên Lao Trừng Phạt Phạm Nhân
 */

const BaseService = require('../base/BaseService');

class PrisonService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'prison',
      domain: 'daily',
      name: '[Thiên Lao] Khảo Vấn Thiên Lao',
      menuOption: null,
      listenedMsgIds: [110201, 110202]
    });
  }

  async execute() {
    return this.autoPrisonHit();
  }

  async autoPrisonHit() {
    this.client.prisonInfo = null;
    this.send(110101, {});
    await this.sleepRandom(1, 2);

    const pData = this.client.prisonInfo ? this.client.prisonInfo.prisonFuncDataInfo : null;
    const prisoners = pData ? pData.prisonerList || [] : [];
    if (prisoners.length === 0) return;

    console.log(`\n[Auto Thiên Lao] Tìm thấy ${prisoners.length} phạm nhân đang giam giữ...`);
    for (const p of prisoners) {
      if (p.hp > 0) {
        this.send(110102, { prisonerId: p.id || 1 });
        await this.sleepRandom(1, 2);
      }
    }
  }
}

module.exports = PrisonService;
