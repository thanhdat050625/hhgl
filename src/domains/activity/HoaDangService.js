const BaseService = require('../base/BaseService');
const { formatAwards } = require('../../core/protocol');

/**
 * HoaDangService: Tự Động Thực Hiện Hoạt Động "Hoa Đăng Chúc Phúc" (ID 30202)
 * Protocol:
 * - 140101: ReqEventActivityInfo (Lấy danh sách đèn đang có & thông tin sự kiện)
 * - 140201: ResEventActivityInfo (activityItemBeanList)
 * - 140110: ReqBuyEventActivityGoods (Tự động mua Bảo Liên Đăng bằng Bạc trong Shop)
 * - 140210: ResBuyEventActivityGoods
 * - 140104: ReqEventActivityItemUse (Thả đèn tích lũy điểm & nhận quà ngẫu nhiên)
 * - 140204: ResEventActivityItemUse
 * - 140105: ReqEventActivityExchangeInfo (Xem điểm đổi & danh sách quà đổi)
 * - 140205: ResEventActivityExchangeInfo
 * - 140106: ReqEventActivityExchange (Đổi vật phẩm bằng điểm thả đèn)
 * - 140107 / 140108: Nhận thưởng xếp hạng sự kiện
 */
class HoaDangService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'hoadang',
      domain: 'activity',
      name: '[Hoa Đăng Chúc Phúc] Thả Đèn & Nhận Quà Sự Kiện',
      menuOption: 4,
      listenedMsgIds: [140201, 140204, 140205, 140207, 140208, 140210]
    });
    this.activityId = 30202;
    this.lastBoughtDate = '';
    this.boughtToday = false;
  }

  resetDaily() {
    this.boughtToday = false;
    this.lastBoughtDate = '';
  }

  getLanternName(itemId) {
    const names = {
      100021: 'Bảo Liên Đăng (Bạc)',
      100022: 'Đèn Múa Lửa',
      100023: 'Nguyệt Quang Đăng',
      100024: 'Đèn Cầu An',
      100009: 'Bảo Liên Đăng',
      100010: 'Đèn Múa Lửa',
      100011: 'Nguyệt Quang Đăng',
      100012: 'Đèn Cầu An'
    };
    return names[itemId] || `Hoa Đăng #${itemId}`;
  }

  async execute() {
    return this.autoPlayHoaDang();
  }

  async autoPlayHoaDang(isLoop = false) {
    if (!isLoop) {
      console.log('\n======================================================');
      console.log('[TỰ ĐỘNG CHƠI SỰ KIỆN "HOA ĐĂNG CHÚC PHÚC" (ID 30202)]');
      console.log('======================================================');
    }

    // 1. Kiểm tra sự kiện có đang mở trên Server không
    this.client.eventActivityInfo = null;
    this.send(140101, { activityId: this.activityId });
    await this.waitFor(() => this.client.eventActivityInfo !== null, 5000);

    const actInfo = this.client.eventActivityInfo;
    if (!actInfo || actInfo.activityId !== this.activityId) {
      if (!isLoop) console.log('[-] Sự kiện "Hoa Đăng Chúc Phúc" hiện không mở trên máy chủ này.');
      return 0;
    }

    const actName = actInfo.name || 'Hoa Đăng Chúc Phúc';
    console.log(`👉 Đang tham gia sự kiện: "${actName}"`);

    // 2. Mua Bảo Liên Đăng bằng Bạc trong Shop sự kiện (GoodsId 501: 2,000 Bạc/chiếc, tối đa 20 cái/ngày)
    await this.buySilverLanterns(isLoop);

    // 3. Quét lại túi và thả toàn bộ các loại Hoa Đăng đang có
    const releasedCount = await this.releaseAllLanterns();

    // 4. Kiểm tra điểm tích lũy và đổi vật phẩm giá trị
    await this.exchangeRewards();

    // 5. Kiểm tra và nhận thưởng xếp hạng sự kiện (nếu có mốc)
    await this.claimRankReward();

    if (!isLoop) {
      console.log('------------------------------------------------------');
      console.log(`[Hoàn tất] Đã hoàn thành chu trình "Hoa Đăng Chúc Phúc" (${releasedCount} đèn đã thả).`);
      console.log('======================================================\n');
    }

    return releasedCount;
  }

  /**
   * Tự động mua Bảo Liên Đăng bằng Bạc (tiết kiệm Vàng, giá 2,000 Bạc/cái, tối đa 20 cái/ngày)
   */
  async buySilverLanterns(isLoop = false) {
    const todayStr = new Date().toLocaleDateString('vi-VN');
    if (this.lastBoughtDate === todayStr && this.boughtToday) {
      if (!isLoop) console.log('\n👉 [Bước 1/4] Hôm nay đã mua tối đa 20 Bảo Liên Đăng bằng Bạc (chờ 00:00 reset).');
      return 0;
    }

    if (!isLoop) console.log('\n👉 [Bước 1/4] Kiểm tra mua Bảo Liên Đăng bằng Bạc (Shop ID 501, tối đa 20 cái/ngày)...');
    let bought = 0;
    // Thử mua tối đa 20 chiếc nếu còn lượt
    for (let i = 0; i < 20; i++) {
      this.client.lastBuyEventActivityGoods = null;
      this.client.lastReturnCode = null;

      this.send(140110, { activityId: this.activityId, goodsId: 501, num: 1 });
      await this.sleepRandom(0.8, 1.2);

      if (this.client.lastBuyEventActivityGoods && this.client.lastBuyEventActivityGoods.awardBean) {
        bought++;
      } else if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 140110) {
        // Hết lượt mua hoặc thiếu bạc
        break;
      } else {
        break;
      }
    }

    this.lastBoughtDate = todayStr;
    this.boughtToday = true;

    if (bought > 0) {
      console.log(`  🎉 Đã mua THÀNH CÔNG ${bought} chiếc Bảo Liên Đăng bằng Bạc!`);
    } else {
      if (!isLoop) console.log('  ℹ️ Đã đạt giới hạn mua bằng Bạc trong ngày (20/20) hoặc đã mua hết.');
    }
    return bought;
  }

  /**
   * Tự động thả toàn bộ Hoa Đăng có trong túi sự kiện
   */
  async releaseAllLanterns() {
    console.log('\n👉 [Bước 2/4] Kiểm tra túi đèn và tiến hành Thả Đèn Chúc Phúc...');
    
    // Đồng bộ lại danh sách đèn từ Server
    this.client.eventActivityInfo = null;
    this.send(140101, { activityId: this.activityId });
    await this.waitFor(() => this.client.eventActivityInfo !== null, 5000);

    const items = (this.client.eventActivityInfo && this.client.eventActivityInfo.activityItemBeanList) || [];
    let totalReleased = 0;

    for (const it of items) {
      let count = it.num || 0;
      const itemId = it.id;
      const itName = this.getLanternName(itemId);

      if (count <= 0) continue;
      console.log(`  🏮 Đang có ${count} chiếc [${itName}]. Bắt đầu thả...`);

      while (count > 0) {
        this.client.lastEventActivityItemUse = null;
        this.client.lastReturnCode = null;

        // Thả từng đợt tối đa 1 chiếc
        this.send(140104, { activityId: this.activityId, itemId: itemId, num: 1 });
        await this.sleepRandom(1.0, 1.5);

        if (this.client.lastEventActivityItemUse && this.client.lastEventActivityItemUse.score !== undefined) {
          const res = this.client.lastEventActivityItemUse;
          const awards = res.awardBeans && res.awardBeans.length > 0 ? formatAwards(res.awardBeans) : 'Không có quà rơi';
          const wish = res.imageContent ? `"${res.imageContent.trim()}"` : '';
          console.log(`  ✨ [Thả Đèn] ${wish} | Điểm: +${res.point || 3} (Tổng: ${res.score}) | Quà: ${awards}`);
          totalReleased++;
          count--;
        } else {
          break;
        }
      }
    }

    if (totalReleased === 0) {
      console.log('  [-] Hiện tại không có chiếc Hoa Đăng nào trong túi để thả.');
    }

    return totalReleased;
  }

  /**
   * Kiểm tra điểm tích lũy và đổi vật phẩm (Đan dược, Sách hoặc Bạc)
   */
  async exchangeRewards() {
    console.log('\n👉 [Bước 3/4] Kiểm tra điểm đổi thưởng Tiệm Hoa Đăng (Gói 140105)...');
    this.client.eventActivityExchangeInfo = null;
    this.send(140105, { activityId: this.activityId });
    await this.sleepRandom(1.0, 1.5);

    const exInfo = this.client.eventActivityExchangeInfo;
    const currentPoint = exInfo ? (exInfo.point || 0) : 0;
    console.log(`  📊 Điểm tích lũy hiện có: ${currentPoint} Điểm.`);

    // Nếu điểm >= 20: Tự động đổi Đan Dược Cung Vận (Exchange ID 503: 20 điểm)
    if (currentPoint >= 20) {
      const times = Math.min(5, Math.floor(currentPoint / 20));
      console.log(`  👉 Đang đổi ${times} gói [Đan Dược Cung Vận] (ID 503, tốn ${times * 20} Điểm)...`);
      this.send(140106, { activityId: this.activityId, id: 503, num: times });
      await this.sleepRandom(1.2, 1.8);
      console.log('  🎉 Đổi thưởng hoàn tất!');
    }
  }

  /**
   * Nhận thưởng xếp hạng sự kiện nếu có
   */
  async claimRankReward() {
    console.log('\n👉 [Bước 4/4] Kiểm tra trạng thái thưởng Xếp Hạng Sự Kiện (Gói 140107)...');
    this.client.eventActivityRankRewardInfo = null;
    this.send(140107, { activityId: this.activityId });
    await this.sleepRandom(1.0, 1.5);

    const rInfo = this.client.eventActivityRankRewardInfo;
    if (rInfo && rInfo.isCollect === 0 && rInfo.rank > 0) {
      console.log(`  👉 Thứ hạng hiện tại: Hạng ${rInfo.rank}. Đang gửi lệnh nhận thưởng...`);
      this.send(140108, { activityId: this.activityId });
      await this.sleepRandom(1.2, 1.8);
    } else {
      console.log(`  ℹ️ Thứ hạng: ${rInfo && rInfo.rank > 0 ? `Hạng ${rInfo.rank}` : 'Chưa vào bảng'} | Trạng thái: ${rInfo && rInfo.isCollect === 1 ? 'Đã nhận thưởng' : 'Chưa đến kỳ kết toán'}.`);
    }
  }
}

module.exports = HoaDangService;
