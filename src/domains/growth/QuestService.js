/**
 * Quest Service: Tự Động Giải Quyết 688 Nhiệm Vụ Chính Tuyến, Nhiệm Vụ Ngày & Nhiệm Vụ Tước Vị
 */

const BaseService = require('../base/BaseService');
const { formatAwards, getMainTaskInfo } = require('../../core/protocol');
const { getItemName } = require('../../config');

class QuestService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'quest',
      domain: 'growth',
      name: '[Nhiệm Vụ] Tự Động Giải & Nhận Nhiệm Vụ',
      menuOption: 9,
      listenedMsgIds: [124201, 124202, 124203, 124207, 124208, 124210]
    });
  }

  async execute() {
    return this.autoClaimAll(true);
  }

  async autoClaimAll(autoSolve = true) {
    console.log('\n[Nhiệm Vụ Chính] Bước 1: Phân tích & Giải quyết Nhiệm vụ Chính Tuyến...');
    this.client.mainQuestInfo = null;
    this.send(124101, {});
    await this.waitFor(() => this.client.mainQuestInfo !== null);

    let mainClaimed = 0;
    let consecutiveSolves = 0;

    while (this.client.mainQuestInfo && this.client.mainQuestInfo.questId && consecutiveSolves < 25) {
      const qId = this.client.mainQuestInfo.questId;
      let isFinish = !!this.client.mainQuestInfo.isFinish;
      let targetVal = this.client.mainQuestInfo.targetValue || 0;
      const tInfo = getMainTaskInfo(qId);
      const taskName = tInfo ? tInfo.name : `Nhiệm vụ #${qId}`;
      const taskTarget = tInfo ? tInfo.target : '';
      const targetType = tInfo ? tInfo.targetType : 0;

      if (!isFinish && autoSolve) {
        console.log(`\n[Nhiệm Vụ] Đang xử lý Quest #${qId} [${taskName}]: "${taskTarget}" (Loại: ${targetType})...`);
        const didAction = await this.solveQuestByType(targetType, tInfo);
        if (didAction) {
          await this.sleepRandom(1.5, 2.5);
          // Cập nhật lại thông tin quest sau khi thực hiện hành động
          this.client.mainQuestInfo = null;
          this.send(124101, {});
          await this.sleepRandom(1.2, 2.0);
          if (this.client.mainQuestInfo) {
            isFinish = !!this.client.mainQuestInfo.isFinish;
            targetVal = this.client.mainQuestInfo.targetValue || 0;
          }
        }
      }

      if (isFinish) {
        console.log(`  [+] Nhiệm vụ chính [${taskName}]: ${taskTarget} - ĐÃ XONG! Nhận thưởng...`);
        this.client.lastMainAward = null;
        this.send(124102, {});
        await this.sleepRandom(1.5, 3.0);

        if (this.client.lastMainAward && this.client.lastMainAward.goodsList && this.client.lastMainAward.goodsList.length > 0) {
          const awards = formatAwards(this.client.lastMainAward.goodsList);
          console.log(`  Đã nhận thưởng [${taskName}]: ${awards}`);
          mainClaimed++;
          consecutiveSolves++;
        } else {
          console.log(`  Đã nhận thưởng [${taskName}] thành công!`);
          mainClaimed++;
          consecutiveSolves++;
        }

        if (this.client.lastMainAward && this.client.lastMainAward.nextQuestId) {
          this.client.mainQuestInfo = {
            questId: this.client.lastMainAward.nextQuestId,
            targetValue: this.client.lastMainAward.targetValue,
            isFinish: this.client.lastMainAward.isFinish
          };
          continue;
        } else {
          break;
        }
      } else {
        console.log(`  [-] Nhiệm vụ chính hiện tại [${taskName}]: ${taskTarget} (Tiến độ: ${targetVal}). Chưa đủ điều kiện.`);
        break;
      }
    }

    console.log('\n[Auto Nhiệm Vụ] Bước 2: Kiểm tra & Nhận toàn bộ Nhiệm vụ Hàng Ngày...');
    this.client.everydayQuestInfo = null;
    this.send(124103, {});
    await this.sleepRandom(1.0, 2.0);

    let everydayClaimed = 0;
    this.client.lastQuestAllAward = null;
    this.send(124110, {});
    await this.sleepRandom(1.5, 3.0);

    if (this.client.lastQuestAllAward && this.client.lastQuestAllAward.awardBeans && this.client.lastQuestAllAward.awardBeans.length > 0) {
      const qIds = this.client.lastQuestAllAward.questIds || [];
      const actIds = this.client.lastQuestAllAward.activeIds || [];
      const awards = formatAwards(this.client.lastQuestAllAward.awardBeans);
      everydayClaimed = qIds.length + actIds.length;
      console.log(`  [Nhiệm Vụ Ngày] Đã nhận nhanh ${qIds.length} nhiệm vụ & ${actIds.length} rương năng động: ${awards}`);
    } else {
      console.log('  [-] [Nhiệm Vụ Ngày] Chưa có thêm nhiệm vụ ngày hoặc rương năng động nào đạt điều kiện nhận.');
    }

    const posClaimed = await this.autoClaimPositionQuests();

    if (mainClaimed === 0 && everydayClaimed === 0 && posClaimed === 0) {
      console.log('\n[-] [Auto Nhiệm Vụ] Hiện tại không có nhiệm vụ nào đủ điều kiện nhận thưởng.');
    } else {
      console.log(`\n[Auto Nhiệm Vụ] Hoàn tất nhận thưởng nhiệm vụ! (Chính tuyến: ${mainClaimed}, Hàng ngày/Rương: ${everydayClaimed}, Tước vị: ${posClaimed})`);
    }
  }

  /**
   * Tự động kiểm tra & nhận thưởng Nhiệm Vụ Tước Vị (Tab 2: N.V Tước Vị)
   */
  async autoClaimPositionQuests() {
    console.log('\n[Nhiệm Vụ Tước Vị] Bước 3: Kiểm tra Nhiệm vụ Tước Vị (Tab 2)...');
    this.client.positionQuestInfo = null;
    this.send(124107, {});
    await this.waitFor(() => this.client.positionQuestInfo !== null);

    const posData = this.client.positionQuestInfo && this.client.positionQuestInfo.positionQuestFuncDataInfo;
    if (!posData) {
      console.log('  [-] [Nhiệm Vụ Tước Vị] Không có dữ liệu nhiệm vụ tước vị.');
      return 0;
    }

    const questList = posData.questList || [];
    let claimed = 0;

    for (const q of questList) {
      if (q.status === 1) {
        const qId = q.questId;
        console.log(`  [+] Đang nhận thưởng Nhiệm vụ Tước Vị #${qId}...`);
        this.client.lastPositionQuestAward = null;
        this.send(124108, { positionId: qId });
        await this.sleepRandom(1.0, 1.8);

        if (this.client.lastPositionQuestAward && this.client.lastPositionQuestAward.goodsList) {
          const awards = formatAwards(this.client.lastPositionQuestAward.goodsList);
          console.log(`    [N.V Tước Vị #${qId}] Nhận thưởng thành công: ${awards}`);
        } else {
          console.log(`    [N.V Tước Vị #${qId}] Nhận thưởng thành công!`);
        }
        claimed++;
      }
    }

    if (posData.questStatus === 1) {
      console.log('  [+] Đang nhận Thưởng Lớn Hoàn Thành Tước Vị...');
      this.client.lastPositionQuestAward = null;
      this.send(124108, { positionId: 0 });
      await this.sleepRandom(1.0, 1.8);
      if (this.client.lastPositionQuestAward && this.client.lastPositionQuestAward.goodsList) {
        const awards = formatAwards(this.client.lastPositionQuestAward.goodsList);
        console.log(`    [Thưởng Lớn Tước Vị] Nhận thành công: ${awards}`);
      }
      claimed++;
    }

    if (claimed === 0) {
      console.log('  [-] [Nhiệm Vụ Tước Vị] Không có mốc nhiệm vụ tước vị nào mới đủ điều kiện nhận.');
    }

    return claimed;
  }

  async solveQuestByType(targetType, tInfo) {
    switch (targetType) {
      case 32: // Tăng cấp Tùy Tùng
      case 82: // Đề bạt Tùy Tùng
      case 98: // Bồi dưỡng Tùy Tùng
        console.log('  -> [Tự Động] Thực hiện tăng cấp Tùy tùng...');
        const helperSvc = this.client.services ? this.client.services.get('helper') : this.client.helper;
        if (helperSvc) {
          const reqLv = tInfo ? (Number(tInfo.targetValue) || 0) : 0;
          await helperSvc.autoLevelUpHelpers(reqLv);
          return true;
        }
        return false;

      case 23: // Thăng chức / Tăng cấp tước vị
        console.log('  -> [Tự Động] Thực hiện thăng chức tước vị...');
        const levelSvc = this.client.services ? this.client.services.get('level') : this.client.level;
        if (levelSvc) {
          return await levelSvc.autoLevelUp();
        }
        return false;

      case 1: // Bán từ thiện
        console.log('  -> [Tự Động] Thực hiện thu hoạch Bán từ thiện...');
        this.send(102101, { type: 1 });
        return true;

      case 2: // Vườn thuốc
        console.log('  -> [Tự Động] Thực hiện chăm sóc Vườn thuốc...');
        this.send(102101, { type: 2 });
        return true;

      case 3: // Bổ khí
        console.log('  -> [Tự Động] Thực hiện Huyết Yến Bổ Khí...');
        this.send(102101, { type: 3 });
        return true;

      case 4: // Xử lý cung vụ
        console.log('  -> [Tự Động] Thực hiện xử lý Cung vụ (Ưu tiên nhận Cung Vận)...');
        const affairSvc = this.client.services ? this.client.services.get('affair') : this.client.affair;
        if (affairSvc) {
          await affairSvc.autoHandleAffairs();
          return true;
        }
        return false;

      case 9:  // Thắng chiến đấu cốt truyện
      case 43: // Vượt ải cốt truyện
        console.log('  -> [Tự Động] Thực hiện vượt ải Cốt truyện PVE...');
        const stageSvc = this.client.services ? this.client.services.get('stage') : this.client.stage;
        if (stageSvc) {
          await stageSvc.autoBattleContinuous(5);
          return true;
        }
        return false;

      case 80: // Chúc phúc Cây Cầu Nguyện
        console.log('  -> [Tự Động] Thực hiện Cầu nguyện Cây ước nguyện...');
        this.send(128101, { LotteryType: 1, NumType: 1 });
        return true;

      case 11: // Thỉnh an trong cung
        console.log('  -> [Tự Động] Thực hiện Thỉnh an Hoàng Cung...');
        const palaceSvc = this.client.services ? this.client.services.get('palace') : this.client.palace;
        if (palaceSvc) {
          await palaceSvc.autoPalaceHi();
          return true;
        }
        return false;

      case 7: // Dạy dỗ phạm nhân Thiên Lao
        console.log('  -> [Tự Động] Thực hiện Khảo vấn Thiên Lao...');
        const prisonSvc = this.client.services ? this.client.services.get('prison') : this.client.prison;
        if (prisonSvc) {
          await prisonSvc.autoPrisonHit();
          return true;
        }
        return false;

      case 14: // Vấn an Lam Nhan
        console.log('  -> [Tự Động] Thực hiện Vấn an Hậu Cung...');
        const haremSvc = this.client.services ? this.client.services.get('harem') : this.client.harem;
        if (haremSvc) {
          await haremSvc.autoHaremContinuous(2);
          return true;
        }
        return false;

      case 10: // Tặng quà Lam Nhan (Tri Kỷ)
      case 58: // Tặng quà Lam Nhan (Tri Kỷ)
        console.log('  -> [Tự Động] Thực hiện Tặng quà Lam Nhan / Tri Kỷ...');
        this.send(104102, {});
        await this.sleepRandom(1.0, 1.8);
        const giftItems = (this.client.propList || []).filter(p => [14001, 14002, 14003, 14004, 14005, 14006].includes(p.configId) && p.num > 0);
        if (giftItems.length > 0) {
          const giftName = getItemName(giftItems[0].configId);
          console.log(`  [+] [Nhiệm Vụ] Tìm thấy quà tặng: ${giftName}. Đang tặng cho Tri Kỷ A Lý Cổn...`);
          this.send(106103, { wifeId: 10001, propId: giftItems[0].configId, num: 1 });
          await this.sleepRandom(1.5, 2.5);
          return true;
        } else {
          console.log('  [-] [Nhiệm Vụ] Trong túi chưa có quà tặng Lam Nhan.');
        }
        return false;

      case 90: // Vân Trung Cẩm Thư (Trò chuyện thư từ Tri Kỷ)
        console.log('  -> [Tự Động] Thực hiện Vân Trung Cẩm Thư...');
        this.send(106107, {});
        await this.sleepRandom(1.0, 1.8);
        this.send(106109, { manId: 10001 });
        await this.sleepRandom(1.5, 2.5);
        return true;

      case 35: // Điểm danh nhập cung
        console.log('  -> [Tự Động] Thực hiện Điểm danh nhập cung...');
        this.send(102103, {});
        return true;

      default:
        return false;
    }
  }
}

module.exports = QuestService;
