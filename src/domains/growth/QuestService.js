/**
 * QuestService: Tự Động Nhận Thưởng Nhiệm Vụ (N.V Chính & N.V Tước Vị)
 * Đọc trực tiếp 100% trạng thái hoàn thành từ Server Game (124101, 124107)
 */

const BaseService = require('../base/BaseService');
const { formatAwards, getMainTaskInfo } = require('../../core/protocol');

class QuestService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'quest',
      domain: 'growth',
      name: '[Nhiệm Vụ] Nhận Thưởng N.V Chính & N.V Tước Vị',
      menuOption: 4,
      listenedMsgIds: [124201, 124202, 124207, 124208]
    });
  }

  async execute() {
    return this.autoClaimAll();
  }

  async autoClaimAll() {
    console.log('\n======================================================');
    console.log('[NHẬN THƯỞNG NHIỆM VỤ CHÍNH TUYẾN & TƯỚC VỊ (LIVE SYNC)]');
    console.log('======================================================');

    const mainClaimed = await this.claimMainQuests();
    const posClaimed = await this.claimPositionQuests();

    const total = mainClaimed + posClaimed;
    if (total === 0) {
      console.log('[-] [Nhiệm Vụ] Chưa có nhiệm vụ Chính Tuyến hay Tước Vị nào đủ điều kiện nhận.');
    } else {
      console.log(`\n🎉 [Nhiệm Vụ] Đã nhận xong ${total} phần quà (Chính tuyến: ${mainClaimed}, Tước vị: ${posClaimed})!`);
    }
    console.log('======================================================\n');
    return total;
  }

  /**
   * Tab 1: N.V Chính (Nhiệm Vụ Chính Tuyến)
   */
  async claimMainQuests() {
    console.log('👉 [Tab 1: N.V Chính] Đang kiểm tra Nhiệm Vụ Chính Tuyến...');
    this.client.mainQuestInfo = null;
    this.send(124101, {});
    await this.waitFor(() => this.client.mainQuestInfo !== null, 5000);

    let claimed = 0;
    let loopCount = 0;

    while (this.client.mainQuestInfo && this.client.mainQuestInfo.questId && loopCount < 15) {
      loopCount++;
      const qId = this.client.mainQuestInfo.questId;
      const isFinish = Boolean(this.client.mainQuestInfo.isFinish);
      const targetVal = this.client.mainQuestInfo.targetValue || 0;
      const tInfo = getMainTaskInfo(qId);
      const taskName = tInfo ? tInfo.name : `Nhiệm vụ #${qId}`;
      const taskTarget = tInfo ? tInfo.target : '';

      if (isFinish) {
        console.log(`  👉 Phát hiện [${taskName}] ĐÃ HOÀN THÀNH (${taskTarget})! Đang nhận thưởng...`);
        this.client.lastMainAward = null;
        this.send(124102, {});
        await this.sleepRandom(1.2, 2.0);

        if (this.client.lastMainAward && this.client.lastMainAward.goodsList && this.client.lastMainAward.goodsList.length > 0) {
          const awards = formatAwards(this.client.lastMainAward.goodsList);
          console.log(`  🎉 [N.V Chính] Nhận THÀNH CÔNG [${taskName}]: ${awards}`);
          claimed++;
        } else {
          console.log(`  🎉 [N.V Chính] Nhận THÀNH CÔNG [${taskName}]!`);
          claimed++;
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
        console.log(`  [-] [N.V Chính] Hiện tại: [${taskName}] - "${taskTarget}" (Tiến độ: ${targetVal}). Chưa đủ điều kiện nhận.`);
        break;
      }
    }

    return claimed;
  }

  /**
   * Tab 2: N.V Tước Vị (Nhiệm Vụ Tước Vị)
   */
  async claimPositionQuests() {
    console.log('\n👉 [Tab 2: N.V Tước Vị] Đang kiểm tra Nhiệm Vụ Tước Vị...');
    this.client.positionQuestInfo = null;
    this.send(124107, {});
    await this.waitFor(() => this.client.positionQuestInfo !== null, 5000);

    const posData = this.client.positionQuestInfo && this.client.positionQuestInfo.positionQuestFuncDataInfo;
    if (!posData) {
      console.log('  [-] [N.V Tước Vị] Không có dữ liệu nhiệm vụ tước vị từ Server.');
      return 0;
    }

    const questList = posData.questList || [];
    let claimed = 0;

    for (const q of questList) {
      if (q.status === 1) {
        const qId = q.questId;
        console.log(`  👉 Đang nhận thưởng Nhiệm Vụ Tước Vị #${qId}...`);
        this.client.lastPositionQuestAward = null;
        this.send(124108, { positionId: qId });
        await this.sleepRandom(1.2, 2.0);

        if (this.client.lastPositionQuestAward && this.client.lastPositionQuestAward.goodsList) {
          const awards = formatAwards(this.client.lastPositionQuestAward.goodsList);
          console.log(`  🎉 [N.V Tước Vị #${qId}] Nhận THÀNH CÔNG: ${awards}`);
        } else {
          console.log(`  🎉 [N.V Tước Vị #${qId}] Nhận THÀNH CÔNG!`);
        }
        claimed++;
      }
    }

    // Nhận Thưởng Lớn hoàn thành toàn bộ mốc tước vị nếu đạt
    if (posData.questStatus === 1) {
      console.log('  👉 Đang nhận Thưởng Lớn Hoàn Thành Tước Vị...');
      this.client.lastPositionQuestAward = null;
      this.send(124108, { positionId: 0 });
      await this.sleepRandom(1.2, 2.0);

      if (this.client.lastPositionQuestAward && this.client.lastPositionQuestAward.goodsList) {
        const awards = formatAwards(this.client.lastPositionQuestAward.goodsList);
        console.log(`  🎉 [Thưởng Lớn Tước Vị] Nhận THÀNH CÔNG: ${awards}`);
      }
      claimed++;
    }

    if (claimed === 0) {
      console.log('  [-] [N.V Tước Vị] Chưa có mốc nhiệm vụ tước vị nào mới đủ điều kiện nhận.');
    }

    return claimed;
  }
}

module.exports = QuestService;
