/**
 * Level Service: Tự Động Thăng Chức / Tăng Cấp Tước Vị Nhân Vật
 */

const BaseService = require('../base/BaseService');

class LevelService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'level',
      domain: 'growth',
      name: '[Quan Phẩm] Thăng Chức Quan Phẩm',
      menuOption: null,
      listenedMsgIds: [102204, 102215]
    });
  }

  async execute() {
    return this.autoLevelUp();
  }

  async autoLevelUp() {
    this.client.lastReturnCode = null;
    this.send(102104, {});
    await this.sleepRandom(1, 2);

    if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 102104) {
      if (this.client.lastReturnCode.code === 0) {
        console.log(`  [Thăng Chức] Chúc mừng! Bạn đã thăng chức tước vị thành công lên Lv.${this.playerData.lv + 1}!`);
        this.playerData.lv += 1;
        return true;
      } else if (this.client.lastReturnCode.code === 127002) {
        // Chưa đủ Uy vọng
        return false;
      }
    }
    return false;
  }
}

module.exports = LevelService;
