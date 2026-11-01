// StageService: Tự động vượt ải cốt truyện & khiêu chiến boss (PVE)

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
    this.stageBlockedToday = false;
    this.lastBlockedDate = '';
  }

  resetDaily() {
    this.stageBlockedToday = false;
    this.lastBlockedDate = '';
    this.usedBossHelpers.clear();
  }

  async execute() {
    return this.autoBattleContinuous(10);
  }

  // Phối đồ tối ưu theo thông tin ải từ Server
  calculateBestOutfit(fightInfo, wardrobe) {
    const hintList = (fightInfo && Array.isArray(fightInfo.hintList)) ? fightInfo.hintList : [];
    const styleNeed = (fightInfo && Array.isArray(fightInfo.styleNeed)) ? fightInfo.styleNeed : [];
    const tagId = (fightInfo && fightInfo.tagId) ? Number(fightInfo.tagId) : 0;
    const haveClothesList = (wardrobe && Array.isArray(wardrobe.haveClothesList)) ? wardrobe.haveClothesList : [];
    const wearingIds = (wardrobe && Array.isArray(wardrobe.wearingIds)) ? wardrobe.wearingIds : [];

    const ownedIds = new Set();
    const clothesByPart = new Map();

    for (const item of haveClothesList) {
      const uId = item.simClothesInfo?.unitId;
      if (!uId) continue;
      ownedIds.add(Number(uId));

      const part = item.partId ? Math.floor(Number(item.partId) / 100) * 100 : 100;
      if (!clothesByPart.has(part)) {
        clothesByPart.set(part, []);
      }
      clothesByPart.get(part).push(item);
    }

    const chosenOutfit = new Set();
    const chosenParts = new Set();

    // 1. Ưu tiên 1: Đồ trong danh sách hintList của Server mà người chơi sở hữu
    for (const hint of hintList) {
      const hId = Number(hint.clothesId);
      if (ownedIds.has(hId)) {
        chosenOutfit.add(hId);
        for (const [part, items] of clothesByPart.entries()) {
          if (items.some(it => Number(it.simClothesInfo?.unitId) === hId)) {
            chosenParts.add(part);
            break;
          }
        }
      }
    }

    // 2. Ưu tiên 2: Phối thêm các vị trí còn thiếu khớp tag, styleNeed và sao cao nhất
    for (const [part, items] of clothesByPart.entries()) {
      if (chosenParts.has(part)) continue;

      let bestItem = null;
      let bestScore = -1;

      for (const it of items) {
        const uId = Number(it.simClothesInfo?.unitId);
        if (chosenOutfit.has(uId)) continue;

        let score = (it.simClothesInfo?.star || 1) * 10;
        const tags = (it.simClothesInfo?.tag || []).map(Number);
        if (tagId > 0 && tags.includes(tagId)) {
          score += 2000;
        }

        const styles = (it.simClothesInfo?.style || []).map(Number);
        for (const s of styleNeed) {
          if (styles.includes(Number(s))) {
            score += 1000;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestItem = uId;
        }
      }

      if (bestItem) {
        chosenOutfit.add(bestItem);
        chosenParts.add(part);
      }
    }

    // 3. Fallback: Nếu không có đồ tính được, dùng đồ đang mặc
    if (chosenOutfit.size === 0) {
      for (const wId of wearingIds) {
        chosenOutfit.add(Number(wId));
      }
    }

    if (chosenOutfit.size === 0) {
      chosenOutfit.add(60010008);
      chosenOutfit.add(30310008);
      chosenOutfit.add(10010008);
    }

    return Array.from(chosenOutfit);
  }

  // Thực thi Ải So Tài Y Phục
  async tryClothesFight(chTitle, roundTitle) {
    this.client.fightInfo = null;
    this.client.lastClothesFightResult = null;
    this.client.lastReturnCode = null;

    if (!this.client.wardrobe || !this.client.wardrobe.haveClothesList || this.client.wardrobe.haveClothesList.length === 0) {
      this.send(129101, { scenes: 0 });
      await this.sleepRandom(0.8, 1.2);
    }

    // Gửi 112102 để kích hoạt 112208 ResFightInfo của ải thay đồ
    this.send(112102, {});
    await this.waitFor(() => this.client.fightInfo !== null || this.client.lastReturnCode !== null, 3000);

    const outfit = this.calculateBestOutfit(this.client.fightInfo, this.client.wardrobe);
    console.log(`  👗 [${chTitle} - ${roundTitle}] Đang phối ${outfit.length} món trang phục tối ưu xuất chiến...`);

    this.client.lastClothesFightResult = null;
    this.send(112109, { wearing: outfit });
    await this.waitFor(() => this.client.lastClothesFightResult !== null || this.client.lastReturnCode !== null, 5000);

    const res = this.client.lastClothesFightResult;
    if (res) {
      const isWin = (res.awardInfo && res.awardInfo.awardList && res.awardInfo.awardList.length > 0) ||
                    (res.level !== undefined && res.level !== 4) ||
                    (res.sceneInfo && (res.sceneInfo.roundId !== this.client.sceneInfo?.roundId || res.sceneInfo.chapterId !== this.client.sceneInfo?.chapterId));

      if (isWin) {
        if (res.sceneInfo) {
          this.client.sceneInfo = res.sceneInfo;
        }
        const awards = res.awardInfo && res.awardInfo.awardList ? formatAwards(res.awardInfo.awardList) : '';
        console.log(`  🎉 [Ải Thay Đồ] So tài y phục CHIẾN THẮNG! Quà: ${awards}`);
        return true;
      }

      const styles = (this.client.fightInfo?.styleNeed || []).join(', ');
      console.log(`  [-] [Ải Thay Đồ] Điểm số y phục chưa đạt yêu cầu qua ải (Yêu cầu phong cách: [${styles}]).`);
      return false;
    }

    return false;
  }

  async autoBattleContinuous(maxBattles = 10, isLoop = false) {
    const todayStr = new Date().toLocaleDateString('vi-VN');
    if (this.lastBlockedDate === todayStr && this.stageBlockedToday) {
      if (!isLoop) {
        console.log('\n[TỰ ĐỘNG VƯỢT ẢI CỐT TRUYỆN & KHIÊU CHIẾN BOSS]');
        console.log('ℹ️ Hôm nay đã vượt ải không qua, tạm dừng đến mai.\n');
      }
      return 0;
    }

    const initialSoldier = Number(this.playerData.soldier || (this.playerData.attrMap ? this.playerData.attrMap[104] : 0) || 0);
    if (isLoop && initialSoldier <= 0) {
      return 0;
    }

    if (!isLoop) {
      console.log('\n[TỰ ĐỘNG VƯỢT ẢI CỐT TRUYỆN & KHIÊU CHIẾN BOSS]');
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

      // Nếu là ải thay đồ (sceneType = 3 hoặc máu quái = 0)
      if (scene.sceneType === 3 || scene.life === 0 || scene.life === '0') {
        const clothesWon = await this.tryClothesFight(chTitle, roundTitle);
        if (clothesWon) {
          wins++;
          continue;
        } else {
          this.stageBlockedToday = true;
          this.lastBlockedDate = todayStr;
          break;
        }
      }

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
        const clothesWon = await this.tryClothesFight(chTitle, roundTitle);
        if (clothesWon) {
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

    if (wins === 0) {
      // Đánh không qua bất kỳ ải nào -> Đánh dấu dừng hôm nay, để mai vượt tiếp
      this.stageBlockedToday = true;
      this.lastBlockedDate = todayStr;
      if (isLoop) {
        const timeStr = new Date().toLocaleTimeString('vi-VN');
        console.log(`[${timeStr}] ⚔️ [Vượt Ải] Vượt ải chưa thành công -> Tạm dừng hôm nay, để mai (00:00) vượt tiếp (không cố chấp)!`);
      } else {
        console.log('\nℹ️ [Vượt Ải] Vượt ải chưa thành công -> Đã dừng vượt ải hôm nay, để mai (00:00) vượt tiếp!');
      }
    } else {
      if (!isLoop) {
        console.log(`\n🎉 [Vượt Ải] Hoàn tất đợt xuất chiến! Đã vượt qua thành công ${wins} ải.\n`);
      }
    }

    return wins;
  }
}

module.exports = StageService;
