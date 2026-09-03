/**
 * StageService: Tự Động Vượt Ải Cốt Truyện & Khiêu Chiến Boss (PVE)
 * Nhận diện 100% thời gian thực từ Server: Ải Thường, Ải Thay Đồ, Khiêu Chiến Boss & Đối Thoại
 */

const fs = require('fs');
const path = require('path');
const BaseService = require('../base/BaseService');
const { getHelperName } = require('../../config');
const { formatAwards } = require('../../core/protocol');

let sceneCfgCache = null;
let chapterCfgCache = null;

function loadSceneConfigs() {
  if (!sceneCfgCache) {
    try {
      const p = path.join(__dirname, '../../../_source_game/config_tables/SceneConfig_json.json');
      if (fs.existsSync(p)) sceneCfgCache = JSON.parse(fs.readFileSync(p, 'utf8')).list || {};
    } catch (e) {
      sceneCfgCache = {};
    }
  }
  if (!chapterCfgCache) {
    try {
      const p = path.join(__dirname, '../../../_source_game/config_tables/SceneChapterConfig_json.json');
      if (fs.existsSync(p)) chapterCfgCache = JSON.parse(fs.readFileSync(p, 'utf8')).list || {};
    } catch (e) {
      chapterCfgCache = {};
    }
  }
}

function getSceneTitle(chapterId, roundId) {
  loadSceneConfigs();
  let chTitle = `Chương ${chapterId}`;
  let roundTitle = `Màn ${roundId}`;

  const cKey = chapterId.toString();
  if (sceneCfgCache && sceneCfgCache[cKey] && sceneCfgCache[cKey][0]) {
    chTitle = sceneCfgCache[cKey][0];
  }

  const rKey = (chapterId * 100 + roundId).toString();
  if (chapterCfgCache && chapterCfgCache[rKey] && chapterCfgCache[rKey][3]) {
    roundTitle = chapterCfgCache[rKey][3];
  }

  return { chTitle, roundTitle };
}

class StageService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'stage',
      domain: 'combat',
      name: '[Vượt Ải] Cốt Truyện & Khiêu Chiến Boss',
      menuOption: 2,
      listenedMsgIds: [112201, 112202, 112203, 112205, 112209]
    });
    this.usedBossHelpers = new Set();
  }

  async execute() {
    return this.autoBattleContinuous(10);
  }

  getBestOutfit() {
    const wearing = (this.client.wardrobe && this.client.wardrobe.wearingIds && this.client.wardrobe.wearingIds.length > 0)
      ? this.client.wardrobe.wearingIds
      : [60010008, 30310008, 10010008];
    return wearing;
  }

  async autoBattleContinuous(maxBattles = 10, isLoop = false) {
    const initialSoldier = Number(this.playerData.soldier || (this.playerData.attrMap ? this.playerData.attrMap[104] : 0) || 0);
    if (isLoop && initialSoldier <= 0) {
      return 0;
    }

    if (!isLoop) {
      console.log('\n======================================================');
      console.log('[TỰ ĐỘNG VƯỢT ẢI CỐT TRUYỆN & KHIÊU CHIẾN BOSS]');
      console.log('======================================================');
      console.log('Đang kiểm tra tiến độ Cốt truyện hiện tại từ Server...');
    }

    this.client.sceneInfo = null;
    this.send(112101, {});
    await this.waitFor(() => this.client.sceneInfo !== null, 5000);

    if (!this.client.sceneInfo) {
      console.log('[-] [Vượt Ải] Không thể lấy thông tin tiến độ ải từ Server.');
      return 0;
    }

    let wins = 0;
    for (let i = 1; i <= maxBattles; i++) {
      const scene = this.client.sceneInfo || {};
      const chapterId = Number(scene.chapterId) || 1;
      const roundId = Number(scene.roundId) || 1;
      const { chTitle, roundTitle } = getSceneTitle(chapterId, roundId);

      // Kiểm tra Binh Lực hiện có
      const curSoldier = Number(this.playerData.soldier || (this.playerData.attrMap ? this.playerData.attrMap[104] : 0) || 0);
      if (curSoldier <= 0) {
        console.log(`\n[-] [Vượt Ải] Đã hết Binh Lực (Binh lực còn: 0). Vui lòng thu hoạch Bổ Khí tại Nội Vụ để hồi quân.`);
        break;
      }

      this.client.lastFightResult = null;
      this.client.lastReturnCode = null;
      this.client.lastClothesFightResult = null;
      this.client.lastBossFightResult = null;

      // 1. Nếu máu quái = 0 hoặc là Ải Thay Đồ
      if (scene.life === 0 || scene.life === '0') {
        const outfit = this.getBestOutfit();
        console.log(`  👗 [${chTitle} - ${roundTitle}] Phát hiện Ải Thay Đồ! Đang phối trang phục xuất chiến...`);
        this.send(112109, { wearing: outfit });
        await this.sleepRandom(1.5, 2.5);

        if (this.client.lastClothesFightResult) {
          if (this.client.lastClothesFightResult.sceneInfo) {
            this.client.sceneInfo = this.client.lastClothesFightResult.sceneInfo;
          }
          const awards = this.client.lastClothesFightResult.awardInfo && this.client.lastClothesFightResult.awardInfo.awardList
            ? formatAwards(this.client.lastClothesFightResult.awardInfo.awardList)
            : '';
          console.log(`  🎉 [Ải Thay Đồ] So tài y phục CHIẾN THẮNG! Quà: ${awards}`);
          wins++;
          continue;
        }
      }

      // 2. Thử đánh ải thường
      console.log(`  👉 Đang tiến đánh [${chTitle} - ${roundTitle}] (Binh lực hiện có: ${curSoldier.toLocaleString()})...`);
      this.send(112102, {});
      await this.sleepRandom(1.2, 2.0);

      // Nếu gặp mã lỗi 130001 (Không thể đánh thường -> Ải Boss hoặc Thay đồ hoặc Đối thoại)
      if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 112102 && this.client.lastReturnCode.code === 130001) {
        // Thử Khiêu Chiến Boss bằng Tùy Tùng mạnh nhất chưa xuất chiến
        const helpers = (this.client.helperInfoList || []).slice().sort((a, b) => (Number(b.lv || 0) - Number(a.lv || 0)));
        let bossFought = false;

        for (const h of helpers) {
          const hid = Number(h.helperId);
          if (this.usedBossHelpers.has(hid)) continue;

          const hName = getHelperName(hid);
          console.log(`  ⚔️ Gặp Boss ải! Xuất chiến Tùy Tùng [${hName}] (Lv.${h.lv}) khiêu chiến Boss...`);
          this.client.lastBossFightResult = null;
          this.client.lastReturnCode = null;
          this.send(112103, { helperId: hid, type: 1 });
          await this.sleepRandom(1.5, 2.5);

          if (this.client.lastReturnCode && this.client.lastReturnCode.code === 146052) {
            this.usedBossHelpers.add(hid);
            continue;
          }

          if (this.client.lastBossFightResult) {
            this.usedBossHelpers.add(hid);
            if (this.client.lastBossFightResult.sceneInfo) {
              this.client.sceneInfo = this.client.lastBossFightResult.sceneInfo;
            }
            const bAwards = this.client.lastBossFightResult.awardInfo && this.client.lastBossFightResult.awardInfo.awardList
              ? formatAwards(this.client.lastBossFightResult.awardInfo.awardList)
              : '';
            console.log(`  🎉 ĐÁNH TRẢM BOSS THÀNH CÔNG! Quà: ${bAwards}`);
            wins++;
            bossFought = true;
            break;
          }
        }

        if (bossFought) continue;

        // Thử Ải Thay Đồ
        const outfit = this.getBestOutfit();
        console.log(`  👗 Thử xuất chiến Ải So Tài Y Phục...`);
        this.send(112109, { wearing: outfit });
        await this.sleepRandom(1.5, 2.5);
        if (this.client.lastClothesFightResult) {
          if (this.client.lastClothesFightResult.sceneInfo) {
            this.client.sceneInfo = this.client.lastClothesFightResult.sceneInfo;
          }
          wins++;
          continue;
        }

        // Thử đối thoại phân nhánh
        this.send(112105, { chooseId: 1 });
        await this.sleepRandom(1.0, 1.8);
        break;
      }

      // Nếu gặp mã lỗi hết quân hoặc không đủ điều kiện
      if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 112102 && this.client.lastReturnCode.code !== 0) {
        console.log(`  [-] Dừng vượt ải: Không đủ điều kiện hoặc thiếu Binh Lực (Mã phản hồi: ${this.client.lastReturnCode.code}).`);
        break;
      }

      // Kiểm tra kết quả trận đánh thường
      if (this.client.lastFightResult) {
        if (this.client.lastFightResult.isWin) {
          wins++;
          const remainingSoldier = Number(this.client.lastFightResult.playerSoldier || 0);
          const awardsStr = this.client.lastFightResult.awardInfo && this.client.lastFightResult.awardInfo.awardList
            ? formatAwards(this.client.lastFightResult.awardInfo.awardList)
            : '';
          console.log(`  🎉 [${chTitle} - ${roundTitle}] Thắng trận! Binh lực còn: ${remainingSoldier.toLocaleString()} | Quà: ${awardsStr}`);

          if (this.client.lastFightResult.sceneInfo) {
            this.client.sceneInfo = this.client.lastFightResult.sceneInfo;
          }

          // Cập nhật lại Binh lực trong playerData
          if (this.client.lastFightResult.playerSoldier !== undefined) {
            this.playerData.soldier = remainingSoldier;
            if (this.playerData.attrMap) this.playerData.attrMap[104] = remainingSoldier;
          }

          // Nếu diệt sạch lính địch (npcSoldier = 0), khiêu chiến Boss ngay!
          if (this.client.lastFightResult.npcSoldier === 0 || this.client.lastFightResult.npcSoldier === '0') {
            const helpers = (this.client.helperInfoList || []).slice().sort((a, b) => (Number(b.lv || 0) - Number(a.lv || 0)));
            const bestHelper = helpers.find(h => !this.usedBossHelpers.has(Number(h.helperId)));
            if (bestHelper) {
              const hid = Number(bestHelper.helperId);
              const hName = getHelperName(hid);
              console.log(`  ⚔️ Diệt sạch lính! Xuất chiến [${hName}] (Lv.${bestHelper.lv}) khiêu chiến Boss chương...`);
              this.client.lastBossFightResult = null;
              this.send(112103, { helperId: hid, type: 1 });
              await this.sleepRandom(1.5, 2.5);

              if (this.client.lastBossFightResult) {
                this.usedBossHelpers.add(hid);
                if (this.client.lastBossFightResult.sceneInfo) {
                  this.client.sceneInfo = this.client.lastBossFightResult.sceneInfo;
                }
                const bAwards = this.client.lastBossFightResult.awardInfo && this.client.lastBossFightResult.awardInfo.awardList
                  ? formatAwards(this.client.lastBossFightResult.awardInfo.awardList)
                  : '';
                console.log(`  🎉 TRẢM BOSS CHƯƠNG THÀNH CÔNG! Quà: ${bAwards}`);
              }
            }
          }
        } else {
          console.log(`  [-] Trận đấu thất bại hoặc thiếu Binh lực.`);
          break;
        }
      } else {
        break;
      }
    }

    if (!isLoop) {
      if (wins === 0) {
        console.log('\n[-] [Vượt Ải] Tạm dừng: Cần hồi thêm Binh Lực hoặc nâng cấp Tùy Tùng để vượt ải tiếp.');
      } else {
        console.log(`\n🎉 [Vượt Ải] Hoàn tất đợt xuất chiến! Đã vượt qua thành công ${wins} ải.`);
      }
      console.log('======================================================\n');
    }

    return wins;
  }
}

module.exports = StageService;
