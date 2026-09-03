const BaseService = require('../base/BaseService');
const { formatAwards } = require('../../core/protocol');

/**
 * WifeService: Tự Động Vấn An Tri Kỷ (Hậu Cung), Nâng Kỹ Năng & Nhận Thưởng Thân Mật
 * Protocol:
 * - 106101: ReqCallWife { type: 1 } (Vấn An Ngẫu Nhiên)
 * - 106204: ResCallWife (Danh sách Tri Kỷ được vấn an & EXP nhận được)
 * - 106202: ResWifeEnergy (Số lượt vấn an còn lại và thời gian hồi)
 * - 106110: ReqRewardNearLv { wifeId } (Nhận Vàng mốc Thân Mật)
 * - 106210: ResRewardNearLv
 * - 106104: ReqWifeSkillUp { wifeId, skillId } (Nâng cấp kỹ năng Tri Kỷ)
 */
class WifeService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'wife',
      domain: 'daily',
      name: '[Hậu Cung] Vấn An Tri Kỷ & Nhận Thưởng Thân Mật',
      menuOption: 2,
      listenedMsgIds: [106202, 106204, 106210]
    });
  }

  getWifeName(wifeId) {
    const wifeMap = {
      10001: 'Liễu Nguyệt Mai',
      10002: 'Mộc Vân Nhu',
      10003: 'Thẩm Tuyết',
      10004: 'Doãn Tư Nghi',
      10005: 'Phó Hằng',
      10006: 'Tề Mặc',
      10007: 'Hồng Lịch',
      10008: 'A Lợi Cổn'
    };
    return wifeMap[wifeId] || `Tri Kỷ #${wifeId}`;
  }

  async execute() {
    return this.autoCallAllWives();
  }

  async autoCallAllWives(isLoop = false) {
    if (!isLoop) {
      console.log('\n======================================================');
      console.log('[TỰ ĐỘNG VẤN AN TRI KỶ & HẬU CUNG (LIVE SYNC)]');
      console.log('======================================================');
      console.log('Đang kiểm tra lượt vấn an và trạng thái Hậu Cung từ Server...');
    }

    let callsMade = 0;
    let maxLoops = 10;

    // Vòng lặp vấn an cho tới khi hết thể lực (hoặc gặp mã hết lượt)
    while (maxLoops > 0) {
      maxLoops--;
      this.client.lastCallWife = null;
      this.client.lastReturnCode = null;

      this.send(106101, { type: 1 });
      await this.sleepRandom(1.2, 1.8);

      // Nếu gặp mã lỗi hết lượt vấn an hoặc chưa mở
      if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 106101) {
        const code = this.client.lastReturnCode.code;
        if (code === 114008 || code === 114024 || code === 114002) {
          if (!isLoop && callsMade === 0) {
            console.log('[-] [Hậu Cung] Đã hết lượt Vấn An hôm nay. Đang chờ thể lực hồi phục.');
          }
          break;
        }
      }

      // Nếu vấn an thành công (Server trả về 106204)
      if (this.client.lastCallWife && this.client.lastCallWife.callWifeList) {
        const callList = this.client.lastCallWife.callWifeList;
        for (const item of callList) {
          const wName = this.getWifeName(item.wifeId);
          const expGain = item.exp || 30;
          console.log(`  💕 [Vấn An] Gặp gỡ Tri Kỷ [${wName}] (+${expGain} EXP Hậu Cung)!`);
          callsMade++;

          // Kiểm tra nhận thưởng Vàng cấp thân mật nếu có mốc mới
          await this.checkAndClaimNearReward(item.wifeId, isLoop);
        }
      } else {
        // Không nhận được phản hồi tiếp theo -> dừng vòng lặp an toàn
        break;
      }
    }

    if (!isLoop) {
      console.log('------------------------------------------------------');
      console.log(`[Hoàn tất] Đã thực hiện ${callsMade} lượt vấn an Tri Kỷ.`);
      console.log('======================================================\n');
    }

    return callsMade;
  }

  /**
   * Tự động kiểm tra và nhận thưởng Vàng mốc cấp Thân Mật (Gói 106110)
   */
  async checkAndClaimNearReward(wifeId, isLoop = false) {
    this.client.lastWifeNearReward = null;
    this.client.lastReturnCode = null;

    this.send(106110, { wifeId });
    await this.sleepRandom(0.8, 1.2);

    if (this.client.lastWifeNearReward && this.client.lastWifeNearReward.goodsList && this.client.lastWifeNearReward.goodsList.length > 0) {
      const awards = formatAwards(this.client.lastWifeNearReward.goodsList);
      const wName = this.getWifeName(wifeId);
      console.log(`  🎉 [Thân Mật ${wName}] Nhận THÀNH CÔNG quà mốc: ${awards}`);
    }
  }
}

module.exports = WifeService;
