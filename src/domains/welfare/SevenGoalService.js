/**
 * SevenGoalService: Tự động quét & nhận thưởng Sự Kiện 7 Ngày Vui Vẻ
 * 100% Đọc trực tiếp trạng thái targetList, score & rewardList từ Game Server (162101/162201)
 */

const fs = require('fs');
const path = require('path');
const BaseService = require('../base/BaseService');
const { formatAwards, formatPropName } = require('../../core/protocol');
const { getSevenGoalTargetName } = require('../../config');

function getTargetUnlockedDay(targetId) {
  const prefix = String(targetId).slice(0, 5);
  const map = {
    '10001': 1, '10002': 1, '10003': 1, '10004': 1,
    '10005': 2, '10006': 2, '10007': 2, '10008': 2,
    '10009': 3, '10010': 3, '10011': 3, '10012': 3,
    '10013': 4, '10014': 4, '10015': 4, '10016': 4,
    '10017': 5, '10018': 5, '10019': 5, '10020': 5,
    '10021': 6, '10022': 6, '10023': 6,
    '10024': 7, '10025': 7, '10026': 7
  };
  return map[prefix] || 1;
}

class SevenGoalService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'sevengoal',
      domain: 'welfare',
      name: '[7 Ngày] 7 Ngày Vui Vẻ',
      menuOption: 1,
      listenedMsgIds: [162201, 162202, 162204]
    });
    this.claimedGoals = new Set();
    this.scoreConfig = null;
  }

  getScoreRewardsConfig() {
    if (!this.scoreConfig) {
      try {
        const p = path.join(__dirname, '../../../_source_game/config_tables/SevenDayScoreRewardConfig_json.json');
        if (fs.existsSync(p)) {
          this.scoreConfig = JSON.parse(fs.readFileSync(p, 'utf8'));
        }
      } catch (e) {}
    }
    return this.scoreConfig;
  }

  async execute() {
    return this.claimAllSevenGoals();
  }

  async claimAllSevenGoals() {
    console.log('\n======================================================');
    console.log('[7 Ngày Vui Vẻ] BẮT ĐẦU QUÉT & NHẬN THƯỞNG 7 NGÀY VUI VẺ');
    console.log('======================================================');
    console.log('[*] Kiểm tra tiến độ 7 Ngày Vui Vẻ từ Server...');
    this.client.sevenGoalTargets = null;
    this.send(162101, {});
    await this.waitFor(() => this.client.sevenGoalTargets !== null);

    const curDay = Number(this.client.sevenDayDay) || 1;
    const targets = this.client.sevenGoalTargets || [];
    const serverClaimedSet = new Set(this.client.sevenGoalRewardList || []);

    const allFinishedTargets = targets.filter(t => 
      t.status === 1 && 
      !serverClaimedSet.has(t.id) &&
      !this.claimedGoals.has(t.id)
    );

    const readyTargets = allFinishedTargets.filter(t => getTargetUnlockedDay(t.id) <= curDay);
    const futureTargets = allFinishedTargets.filter(t => getTargetUnlockedDay(t.id) > curDay);

    if (readyTargets.length === 0) {
      console.log(`  [-] [7 Ngày Vui Vẻ] Không có nhiệm vụ nào thuộc Ngày 1..${curDay} còn quà chưa nhận.`);
    } else {
      console.log(`  [+] [7 Ngày Vui Vẻ] Tìm thấy ${readyTargets.length} nhiệm vụ đã hoàn thành (Ngày 1..${curDay})! Bắt đầu nhận quà...`);
      let claimedCount = 0;

      for (const t of readyTargets) {
        this.claimedGoals.add(t.id);
        this.client.recentProps = [];
        this.client.lastSevenGoalReward = null;
        this.client.lastReturnCode = null;

        const targetName = getSevenGoalTargetName(t.id);
        console.log(`  -> Đang nhận: [${targetName}]...`);
        // Lệnh nhận nhiệm vụ 7 Ngày là 162104 (ReqGetSevenGoalScore)
        this.send(162104, { id: t.id });
        await this.sleepRandom(1.2, 2.0);

        // Hiển thị kết quả & chi tiết quà nhận được
        if (this.client.lastSevenGoalReward && this.client.lastSevenGoalReward.reward && this.client.lastSevenGoalReward.reward.length > 0) {
          const awards = formatAwards(this.client.lastSevenGoalReward.reward);
          console.log(`    [OK] [${targetName}] Nhận THÀNH CÔNG: ${awards}`);
        } else if (this.client.recentProps && this.client.recentProps.length > 0) {
          const propsStr = this.client.recentProps.map(p => `+${p.num || p.propNum || 1} ${formatPropName(p.configId || p.propId || p.id)}`).join(', ');
          console.log(`    [OK] [${targetName}] Nhận THÀNH CÔNG: ${propsStr}`);
        } else if (this.client.lastReturnCode && this.client.lastReturnCode.code !== 0) {
          console.log(`    [-] [${targetName}] Server phản hồi mã: ${this.client.lastReturnCode.code}`);
        } else {
          console.log(`    [OK] [${targetName}] Nhận thưởng THÀNH CÔNG!`);
        }

        claimedCount++;
      }
      console.log(`[OK] [7 Ngày Vui Vẻ] Đã hoàn thành nhận ${claimedCount} nhiệm vụ!`);
    }

    if (futureTargets.length > 0) {
      console.log(`  [-] [Nhiệm vụ các ngày tiếp theo]: Có ${futureTargets.length} nhiệm vụ đã đạt điều kiện trước (thuộc Ngày ${curDay + 1}..7) và sẽ tự động mở nhận quà khi tới ngày tương ứng.`);
    }

    // Kiểm tra và nhận các mốc rương tích điểm (Stage Score Rewards)
    const currentScore = this.client.sevenGoalScore || 0;
    console.log(`\n[-] Điểm tích lũy 7 Ngày hiện tại: ${currentScore} điểm.`);
    
    const cfg = this.getScoreRewardsConfig();
    if (cfg && cfg.list) {
      for (const [stageIdStr, stageData] of Object.entries(cfg.list)) {
        const stageId = Number(stageIdStr);
        const needScore = stageData[1];
        if (currentScore >= needScore && !serverClaimedSet.has(stageId)) {
          console.log(`  [+] Đạt mốc ${needScore} điểm! Đang nhận quà Mốc Tích Điểm...`);
          this.client.lastSevenGoalStageReward = null;
          this.send(162102, { id: stageId });
          await this.sleepRandom(1.2, 2.0);

          if (this.client.lastSevenGoalStageReward && this.client.lastSevenGoalStageReward.reward) {
            const awards = formatAwards(this.client.lastSevenGoalStageReward.reward);
            console.log(`    [OK] [Mốc ${needScore} Điểm] Nhận THÀNH CÔNG: ${awards}`);
          }
        }
      }
    }

    console.log('[OK] [7 Ngày Vui Vẻ] Hoàn tất toàn bộ hoạt động 7 Ngày Vui Vẻ!\n');
    return true;
  }
}

module.exports = SevenGoalService;
