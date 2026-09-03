/**
 * Stage Service: Vượt Ải Cốt Truyện, So Tài Y Phục & Diệt Boss PVE
 */

const BaseService = require('../base/BaseService');
const { formatAwards } = require('../../core/protocol');
const { getHelperName } = require('../../config');

class StageService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'stage',
      domain: 'combat',
      name: '[Vượt Ải] Vượt Ải Cốt Truyện & Boss',
      menuOption: 4,
      listenedMsgIds: [112201, 112202, 112203, 112209]
    });
    this.usedBossHelpers = new Set();
  }

  async execute() {
    return this.autoBattleContinuous(30);
  }

  async autoBattleContinuous(maxFights = 30) {
    console.log(`\n[Auto Vượt Ải] Bước 1: Kiểm tra thông tin Ải & Binh lực (Binh lực hiện có: ${Number(this.playerData.soldier || 0).toLocaleString()})...`);
    this.client.sceneInfo = null;
    this.send(112101, {});
    await this.waitFor(() => this.client.sceneInfo !== null);

    if (this.client.sceneInfo) {
      console.log(`  [-] Đang ở Ải: Chương ${this.client.sceneInfo.chapterId || 101} - Đợt ${this.client.sceneInfo.roundId || 1}`);
    }

    const allHelpers = (this.client.helperInfoList && this.client.helperInfoList.length > 0)
      ? this.client.helperInfoList
      : [{ helperId: 10001 }, { helperId: 10002 }, { helperId: 10004 }];

    let wins = 0;
    for (let i = 1; i <= maxFights; i++) {
      this.client.lastFightResult = null;
      this.client.lastReturnCode = null;
      this.client.lastClothesFightResult = null;

      // 0. Kiểm tra nếu là Ải So Tài Trang Phục (Máu quái = 0)
      if (this.client.sceneInfo && (this.client.sceneInfo.life === '0' || this.client.sceneInfo.life === 0)) {
        const clothesSvc = this.client.services ? this.client.services.get('clothes') : this.client.clothesService;
        const outfit = clothesSvc ? clothesSvc.getBestOutfit() : [60010008, 30310008, 10010008];
        console.log(`  [+] [Ải Thời Trang] Đang xuất chiến So Tài Y Phục với trang phục [${outfit.join(', ')}]...`);
        this.client.lastClothesFightResult = null;
        this.send(112109, { wearing: outfit });
        await this.sleepRandom(2.0, 3.0);
        if (this.client.lastClothesFightResult) {
          if (this.client.lastClothesFightResult.sceneInfo) {
            this.client.sceneInfo = this.client.lastClothesFightResult.sceneInfo;
          }
          const cAwards = this.client.lastClothesFightResult.awardInfo && this.client.lastClothesFightResult.awardInfo.awardList
            ? formatAwards(this.client.lastClothesFightResult.awardInfo.awardList)
            : '';
          console.log(`  [Ải Trang Phục] Chiến thắng! ${cAwards}`);
          wins++;
          continue;
        }
      }

      // 1. Thử đánh ải thường 112102
      this.send(112102, {});
      await this.sleepRandom(1.5, 2.5);

      // Nếu gặp mã lỗi 130001 (Không thể đánh thường -> kiểm tra xem là ải trang phục hay ải Boss)
      if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 112102 && this.client.lastReturnCode.code === 130001) {
        console.log(`  [-] Ải yêu cầu hình thức đặc biệt (So tài y phục / Trảm Boss / Đối thoại)...`);

        // Thử ải trang phục
        const clothesSvc = this.client.services ? this.client.services.get('clothes') : this.client.clothesService;
        if (clothesSvc) {
          const outfit = clothesSvc.getBestOutfit();
          if (outfit && outfit.length > 0) {
            console.log(`  [+] Đang thử xuất chiến Ải So Tài Y Phục với outfit [${outfit.join(', ')}]...`);
            this.send(112109, { wearing: outfit });
            await this.sleepRandom(2.0, 3.0);
            if (this.client.lastClothesFightResult) {
              if (this.client.lastClothesFightResult.sceneInfo) {
                this.client.sceneInfo = this.client.lastClothesFightResult.sceneInfo;
              }
              const cAwards = this.client.lastClothesFightResult.awardInfo && this.client.lastClothesFightResult.awardInfo.awardList
                ? formatAwards(this.client.lastClothesFightResult.awardInfo.awardList)
                : '';
              console.log(`  [Ải Trang Phục] Chiến thắng! ${cAwards}`);
              wins++;
              continue;
            }
          }
        }

        // Thử ải Boss - Tìm Tùy Tùng chưa xuất chiến
        let bossWon = false;
        for (const h of allHelpers) {
          const hid = Number(h.helperId);
          if (this.usedBossHelpers.has(hid)) continue;

          const hName = getHelperName(hid);
          console.log(`  [+] Gặp Boss ải! Đang xuất chiến Tùy Tùng ${hName} đánh Boss...`);
          this.client.lastBossFightResult = null;
          this.client.lastReturnCode = null;
          this.send(112103, { helperId: hid });
          await this.sleepRandom(1.5, 2.5);

          if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 112103 && this.client.lastReturnCode.code === 146052) {
            this.usedBossHelpers.add(hid);
          }

          if (this.client.lastBossFightResult) {
            if (this.client.lastBossFightResult.sceneInfo) {
              this.client.sceneInfo = this.client.lastBossFightResult.sceneInfo;
            }
            const bossAwards = this.client.lastBossFightResult.awardInfo && this.client.lastBossFightResult.awardInfo.awardList
              ? formatAwards(this.client.lastBossFightResult.awardInfo.awardList)
              : '';
            console.log(`  ĐÁNH TRẢM BOSS THÀNH CÔNG! ${bossAwards}`);
            wins++;
            bossWon = true;
            break;
          }
        }

        if (bossWon) {
          continue;
        }

        // Đối thoại cốt truyện phân nhánh -> Dùng AI suy luận phương án tối ưu
        if (this.client.ai) {
          const sceneName = `Chương ${this.client.sceneInfo?.chapterId || 101} - Đợt ${this.client.sceneInfo?.roundId || 1}`;
          const aiDecision = await this.client.ai.solveDialogue(sceneName, 'Chọn nhánh phát triển cốt truyện tối ưu', [1, 2], this.client.playerData);
          console.log(`  [AI] Chọn phương án đối thoại: Phương án ${aiDecision.chooseId} | Lý do: ${aiDecision.reason}`);
          this.send(112105, { chooseId: aiDecision.chooseId });
        } else {
          this.send(112105, { chooseId: 1 });
        }
        await this.sleepRandom(1.0, 2.0);
        break;
      }

      if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 112102 && this.client.lastReturnCode.code !== 0) {
        console.log(`  [-] Dừng vượt ải: Không đủ điều kiện hoặc cạn Binh lực (Binh lực còn: ${Number(this.playerData.soldier || 0).toLocaleString()}).`);
        break;
      }

      if (!this.client.lastFightResult) {
        break;
      }

      if (!this.client.lastFightResult.isWin) {
        console.log(`  [!] Trận đấu thất bại hoặc cạn binh lực! (Binh lực còn: ${Number(this.playerData.soldier || 0).toLocaleString()})`);
        break;
      }

      wins++;
      const awardsStr = this.client.lastFightResult.awardInfo && this.client.lastFightResult.awardInfo.awardList
        ? formatAwards(this.client.lastFightResult.awardInfo.awardList)
        : 'Không có quà thêm';

      console.log(`  [Trận ${wins}] Thắng trận! Binh lực ta còn: ${Number(this.playerData.soldier || 0).toLocaleString()} (Lính địch còn: ${Number(this.client.lastFightResult.npcSoldier || 0).toLocaleString()}) | Quà: ${awardsStr}`);

      // Nếu diệt sạch lính -> Thử đánh Boss chương
      if (this.client.lastFightResult.npcSoldier === '0' || this.client.lastFightResult.npcSoldier === 0) {
        const nextFollower = allHelpers.find(h => !this.usedBossHelpers.has(Number(h.helperId)));
        if (nextFollower) {
          const hid = Number(nextFollower.helperId);
          const hName = getHelperName(hid);
          console.log(`  [+] Gặp Boss ải! Đang xuất chiến Tùy Tùng ${hName} đánh Boss...`);
          await this.sleepRandom(1.5, 2.5);
          this.client.lastBossFightResult = null;
          this.send(112103, { helperId: hid, type: 1 });
          await this.sleepRandom(2.0, 3.5);

          if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 112103 && this.client.lastReturnCode.code === 146052) {
            this.usedBossHelpers.add(hid);
          }

          if (this.client.lastBossFightResult) {
            const bossAwards = this.client.lastBossFightResult.awardInfo && this.client.lastBossFightResult.awardInfo.awardList
              ? formatAwards(this.client.lastBossFightResult.awardInfo.awardList)
              : '';
            console.log(`  Diệt Boss thành công! ${bossAwards}`);
          }
        }
      }
    }

    if (wins === 0) {
      console.log(`[-] [Auto Vượt Ải] Hiện tại chưa thể vượt ải tiếp (Cần thêm Binh lực hoặc chờ hồi lượt Tùy Tùng đánh Boss).`);
    } else {
      console.log(`[Auto Vượt Ải] Hoàn tất vượt ải! (Thắng: ${wins} trận | Binh lực còn: ${Number(this.playerData.soldier || 0).toLocaleString()})`);
    }
  }
}

module.exports = StageService;
