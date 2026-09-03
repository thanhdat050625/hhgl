/**
 * PrisonService: Quản Lý & Tự Động Giáo Huấn Kẻ Thù Tại Đại Lý Tự
 * Tiêu hao Uy Danh (Prestige) trừng phạt phạm nhân để nhận Bạc, Nguyên Khí, Dược Thảo & Đan Dược
 */

const fs = require('fs');
const path = require('path');
const BaseService = require('../base/BaseService');
const { formatAwards } = require('../../core/protocol');

let prisonConfigCache = null;

function loadPrisonConfig() {
  if (!prisonConfigCache) {
    try {
      const p = path.join(__dirname, '../../../_source_game/config_tables/PrisonConfig_json.json');
      if (fs.existsSync(p)) {
        prisonConfigCache = JSON.parse(fs.readFileSync(p, 'utf8')).list || {};
      }
    } catch (e) {
      prisonConfigCache = {};
    }
  }
}

function getPrisonerName(prisonId) {
  loadPrisonConfig();
  const idStr = prisonId.toString();
  if (prisonConfigCache && prisonConfigCache[idStr] && prisonConfigCache[idStr][6]) {
    return prisonConfigCache[idStr][6];
  }
  return `Kẻ thù #${prisonId}`;
}

function getPrisonerCost(prisonId) {
  loadPrisonConfig();
  const idStr = prisonId.toString();
  if (prisonConfigCache && prisonConfigCache[idStr] && prisonConfigCache[idStr][10]) {
    return Number(prisonConfigCache[idStr][10]) || 10;
  }
  return 10;
}

class PrisonService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'prison',
      domain: 'daily',
      name: '[Đại Lý Tự] Tự Động Giáo Huấn Kẻ Thù',
      menuOption: 3,
      listenedMsgIds: [110201, 110202]
    });
  }

  async execute() {
    return this.autoHitAllPrisoners();
  }

  async autoHitAllPrisoners(isLoop = false) {
    const curFame = Number((this.playerData.attrMap ? this.playerData.attrMap[105] : 0) || 0);
    if (isLoop && curFame <= 0) {
      return 0;
    }

    if (!isLoop) {
      console.log('\n======================================================');
      console.log('[TỰ ĐỘNG GIÁO HUẤN KẺ THÙ - ĐẠI LÝ TỰ (LIVE SYNC)]');
      console.log('======================================================');
      console.log('Đang kiểm tra thông tin Kẻ thù và Uy Danh từ Server...');
    }

    this.client.prisonInfo = null;
    this.send(110101, {});
    await this.waitFor(() => this.client.prisonInfo !== null, 5000);

    if (!this.client.prisonInfo || !this.client.prisonInfo.prisonFuncDataInfo) {
      console.log('[-] [Đại Lý Tự] Không thể lấy thông tin kẻ thù từ Server.');
      return 0;
    }

    const pData = this.client.prisonInfo.prisonFuncDataInfo;
    let dailyFame = Number(pData.dailyFame !== undefined ? pData.dailyFame : (this.playerData.attrMap ? this.playerData.attrMap[105] : 0)) || 0;
    const fameMax = Number(pData.fameMax || 400);
    const prisonerList = pData.prisonerList || [];

    console.log(`👉 Uy Danh hiện tại: ${dailyFame}/${fameMax} (Đang giam giữ ${prisonerList.length} Kẻ Thù)`);

    if (dailyFame <= 0) {
      console.log('[-] [Đại Lý Tự] Đã hết Uy Danh hôm nay. Hãy vượt Ải Cốt Truyện hoặc chờ 00:00 ngày mới để hồi 200 Uy Danh.');
      console.log('======================================================\n');
      return 0;
    }

    let totalHits = 0;

    // 1. Thử Giáo huấn nhanh toàn bộ (type: 3)
    this.client.lastHitPrisoner = null;
    this.client.lastReturnCode = null;
    this.send(110102, { type: 3 });
    await this.sleepRandom(1.2, 2.0);

    if (this.client.lastHitPrisoner && this.client.lastHitPrisoner.goodsList && this.client.lastHitPrisoner.goodsList.length > 0) {
      const awards = formatAwards(this.client.lastHitPrisoner.goodsList);
      console.log(`🎉 [Giáo Huấn Nhanh Toàn Bộ] THÀNH CÔNG! Quà: ${awards}`);
      totalHits++;
    } else {
      // 2. Giáo huấn từng kẻ thù (duyệt danh sách)
      for (const p of prisonerList) {
        const pId = Number(p.prisonId);
        let remNum = Number(p.num || 0);
        const pName = getPrisonerName(pId);
        const cost = getPrisonerCost(pId);

        if (remNum <= 0) {
          console.log(`  [-] [${pName}] Đã giáo huấn xong trong ngày.`);
          continue;
        }

        if (dailyFame < cost) {
          console.log(`  [-] [${pName}] Không đủ Uy Danh để giáo huấn (Cần: ${cost} Uy Danh, Hiện có: ${dailyFame}).`);
          break;
        }

        console.log(`  👉 Đang tiến hành giáo huấn [${pName}] (Còn ${remNum} lượt, Tiêu hao: ${cost} Uy Danh/lần)...`);

        // Thử giáo huấn nhanh 1 kẻ thù (type: 2)
        this.client.lastHitPrisoner = null;
        this.client.lastReturnCode = null;
        this.send(110102, { type: 2, prisonId: pId });
        await this.sleepRandom(1.2, 2.0);

        if (this.client.lastHitPrisoner && this.client.lastHitPrisoner.goodsList && this.client.lastHitPrisoner.goodsList.length > 0) {
          const awards = formatAwards(this.client.lastHitPrisoner.goodsList);
          console.log(`  🎉 [${pName}] Giáo huấn nhanh THÀNH CÔNG! Quà: ${awards}`);
          totalHits++;
          dailyFame = Math.max(0, dailyFame - (remNum * cost));
          continue;
        }

        // Nếu Server chưa mở khóa giáo huấn nhanh -> Giáo huấn từng lần (type: 1)
        while (remNum > 0 && dailyFame >= cost) {
          this.client.lastHitPrisoner = null;
          this.client.lastReturnCode = null;
          this.send(110102, { type: 1, prisonId: pId });
          await this.sleepRandom(0.8, 1.5);

          if (this.client.lastReturnCode && this.client.lastReturnCode.code !== 0) {
            break;
          }

          if (this.client.lastHitPrisoner && this.client.lastHitPrisoner.goodsList) {
            const awards = formatAwards(this.client.lastHitPrisoner.goodsList);
            console.log(`  🎉 [${pName}] Giáo huấn đòn ${remNum}: ${awards}`);
            totalHits++;
            dailyFame -= cost;
            remNum--;
          } else {
            break;
          }
        }
      }
    }

    if (totalHits === 0) {
      console.log('\n[-] [Đại Lý Tự] Không có kẻ thù nào cần giáo huấn hoặc đã hết Uy Danh.');
    } else {
      console.log(`\n🎉 [Đại Lý Tự] Hoàn tất giáo huấn kẻ thù! Uy Danh còn lại: ${dailyFame}`);
    }
    console.log('======================================================\n');
    return totalHits;
  }
}

module.exports = PrisonService;
