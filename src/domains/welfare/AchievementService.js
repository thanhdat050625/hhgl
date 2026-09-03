/**
 * AchievementService: Tự động quét & nhận thưởng Thành Tựu Cung Đình
 * Hiển thị rõ ràng Thành công & Chi tiết phần thưởng Vàng/EXP/Bạc nhận được
 */

const BaseService = require('../base/BaseService');
const { formatAwards, formatPropName } = require('../../core/protocol');
const { getAchievementName } = require('../../config');

class AchievementService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'achievement',
      domain: 'welfare',
      name: '[Thành Tựu] Thành Tựu Cung Đình',
      menuOption: 1,
      listenedMsgIds: [125202, 125203]
    });
    this.claimedAchievements = new Set();
  }

  async execute() {
    return this.claimAllAchievements();
  }

  async claimAllAchievements(isLoop = false) {
    if (!isLoop) {
      console.log('\n[Auto Thành Tựu] Kiểm tra danh mục Thành Tựu Cung Đình...');
    }
    this.client.achievementList = null;
    this.send(125102, {});
    await this.waitFor(() => this.client.achievementList !== null);

    const list = this.client.achievementList || [];
    const readyAchievements = list.filter(a => a.state === 1 && !this.claimedAchievements.has(a.achievementId));

    if (readyAchievements.length === 0) {
      if (!isLoop) {
        console.log('  [-] [Thành Tựu] Server xác nhận: Chưa có mốc thành tựu mới nào đạt điều kiện.\n');
      }
      return 0;
    }

    if (!isLoop) {
      console.log(`  [+] [Thành Tựu] Tìm thấy ${readyAchievements.length} mốc thành tựu đủ điều kiện nhận! Bắt đầu nhận thưởng...`);
    }
    let count = 0;

    for (const a of readyAchievements) {
      this.claimedAchievements.add(a.achievementId);
      this.client.lastAchievementAward = null;
      this.client.recentProps = [];
      this.client.lastReturnCode = null;

      const achName = getAchievementName(a.achievementId, a.targetId);
      if (!isLoop) {
        console.log(`  -> Đang nhận: [${achName}]...`);
      }
      this.send(125103, { achievement: a.achievementId });
      await this.sleepRandom(1.0, 1.8);

      const timeStr = new Date().toLocaleTimeString('vi-VN');
      // Hiển thị quà nhận được
      if (this.client.lastAchievementAward && this.client.lastAchievementAward.goodsList && this.client.lastAchievementAward.goodsList.length > 0) {
        const awards = formatAwards(this.client.lastAchievementAward.goodsList);
        console.log(isLoop ? `[${timeStr}] [Thành Tựu] [${achName}] Nhận THÀNH CÔNG: ${awards}` : `    [OK] [${achName}] Nhận THÀNH CÔNG: ${awards}`);
      } else if (this.client.recentProps && this.client.recentProps.length > 0) {
        const propsStr = this.client.recentProps.map(p => `+${p.num || p.propNum || 1} ${formatPropName(p.configId || p.propId)}`).join(', ');
        console.log(isLoop ? `[${timeStr}] [Thành Tựu] [${achName}] Nhận THÀNH CÔNG: ${propsStr}` : `    [OK] [${achName}] Nhận THÀNH CÔNG: ${propsStr}`);
      } else if (this.client.lastReturnCode && this.client.lastReturnCode.code !== 0) {
        console.log(`    [-] [${achName}] Server phản hồi mã: ${this.client.lastReturnCode.code}`);
      } else {
        console.log(isLoop ? `[${timeStr}] [Thành Tựu] [${achName}] Nhận thưởng THÀNH CÔNG!` : `    [OK] [${achName}] Nhận thưởng THÀNH CÔNG! Đã cộng vào tài khoản.`);
      }

      count++;
    }

    if (!isLoop) {
      console.log(`[OK] [Auto Thành Tựu] Đã hoàn tất nhận ${count} mốc thành tựu!`);
    }
    return count;
  }
}

module.exports = AchievementService;
