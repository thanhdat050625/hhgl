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

  async autoLevelUp(isLoop = false) {
    const { getLevelInfo } = require('../../config');
    const curLv = this.playerData.lv || 1;
    const curExp = this.playerData.exp || 0;
    const lvlInfo = getLevelInfo(curLv);
    const needExp = lvlInfo ? lvlInfo.maxExp : Infinity;

    // Nếu chưa đủ EXP, bỏ qua ngay lập tức không gửi request thừa
    if (curExp < needExp) {
      if (!isLoop) {
        console.log(`  [-] [Thăng Chức] Cung Vận hiện tại (${curExp}/${needExp} EXP) chưa đủ để thăng chức.`);
      }
      return false;
    }

    this.client.lastReturnCode = null;
    this.send(102104, {});
    await this.sleepRandom(1, 2);

    const timeStr = new Date().toLocaleTimeString('vi-VN');
    if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 102104) {
      if (this.client.lastReturnCode.code === 0) {
        const nextLvlInfo = getLevelInfo(curLv + 1);
        const rankName = nextLvlInfo ? nextLvlInfo.name : `Lv.${curLv + 1}`;
        console.log(`[${timeStr}] [Thăng Chức] 🎉 Chúc mừng! Bạn đã THĂNG CHỨC TƯỚC VỊ thành công lên [${rankName}] (Lv.${curLv + 1})!`);
        this.playerData.lv += 1;
        this.playerData.exp = Math.max(0, curExp - needExp);

        if (global.dashboardServer) {
          global.dashboardServer.broadcastSSE('player_state', global.dashboardServer.getPlayerState());
        }
        return true;
      } else if (this.client.lastReturnCode.code === 127002) {
        return false;
      }
    }
    return false;
  }
}

module.exports = LevelService;
