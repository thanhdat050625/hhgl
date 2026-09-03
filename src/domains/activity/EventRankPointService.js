const BaseService = require('../base/BaseService');
const { formatAwards } = require('../../core/protocol');

/**
 * EventRankPointService: Tự Động Kiểm Tra & Nhận Quà Sự Kiện Tích Điểm Hạn Giờ (EventRankPoint & ActivityLimit)
 * Protocol:
 * - 127111: ReqNewActivityInfoList (Lấy danh sách sự kiện đang mở)
 * - 127211: ResNewActivityInfoList
 * - 140101: ReqEventActivityInfo (Chi tiết sự kiện tích điểm)
 * - 140201: ResEventActivityInfo
 * - 140107: ReqEventActivityRankRewardInfo (Thông tin thưởng xếp hạng/tích điểm)
 * - 140207: ResEventActivityRankRewardInfo
 * - 140108: ReqEventActivityRankReward (Nhận thưởng xếp hạng sự kiện)
 * - 140208: ResEventActivityRankReward
 */
class EventRankPointService extends BaseService {
  constructor(client) {
    super(client);
  }

  async autoClaimAllEventRewards(isLoop = false) {
    if (!isLoop) {
      console.log('\n======================================================');
      console.log('[TỰ ĐỘNG NHẬN QUÀ SỰ KIỆN TÍCH ĐIỂM HẠN GIỜ (LIVE SYNC)]');
      console.log('======================================================');
      console.log('Đang đồng bộ danh sách sự kiện đang mở từ Server (Gói 127111)...');
    }

    // 1. Lấy danh sách sự kiện từ Server
    this.client.newActivityList = null;
    this.send(127111, {});
    await this.waitFor(() => this.client.newActivityList !== null, 5000);

    const actList = this.client.newActivityList || [];
    if (actList.length === 0) {
      if (!isLoop) console.log('[-] Không tìm thấy sự kiện nào đang hoạt động trên Server.');
      return 0;
    }

    // Tiền lọc các sự kiện thuộc phân hệ Tích Điểm (EventRankPoint: 30202 hoặc 30xxx)
    const rankActs = actList.filter(a => {
      const id = Number(a.activityId);
      return id === 30202 || (id >= 30000 && id < 40000);
    });

    if (!isLoop) {
      console.log(`👉 Server đang mở ${actList.length} sự kiện (Phát hiện ${rankActs.length} Sự Kiện Tích Điểm Hạn Giờ)...`);
    }

    let totalClaimed = 0;

    for (const act of rankActs) {
      const actId = act.activityId;
      if (!actId) continue;

      // 2. Truy vấn xem sự kiện có thuộc phân hệ Tích Điểm (140101) không
      this.client.eventActivityInfo = null;
      this.client.lastReturnCode = null;

      this.send(140101, { activityId: actId });
      await this.sleepRandom(0.8, 1.2);

      // Nếu là sự kiện tích điểm hợp lệ (Server trả về 140201)
      if (this.client.eventActivityInfo && this.client.eventActivityInfo.activityId === actId) {
        const info = this.client.eventActivityInfo;
        const actName = info.name || `Sự Kiện ${actId}`;
        const actDesc = info.content || '';

        console.log(`\n🏮 [Sự Kiện Tích Điểm]: "${actName}" (ID: ${actId})`);
        if (actDesc) console.log(`   📝 "${actDesc}"`);

        // 3. Truy vấn thông tin thưởng xếp hạng & tích điểm (140107)
        this.client.eventActivityRankRewardInfo = null;
        this.send(140107, { activityId: actId });
        await this.sleepRandom(1.0, 1.5);

        const rInfo = this.client.eventActivityRankRewardInfo;
        if (rInfo) {
          const rank = rInfo.rank !== undefined ? rInfo.rank : -1;
          const isCollect = rInfo.isCollect; // 1: đã nhận, 0: chưa nhận
          console.log(`   📊 Hạng hiện tại: ${rank > 0 ? `Hạng ${rank}` : 'Chưa xếp hạng'} | Trạng thái nhận: ${isCollect === 1 ? 'Đã nhận thưởng' : 'Chưa nhận'}`);

          // 4. Nếu chưa nhận, thử gửi lệnh nhận thưởng (140108)
          if (isCollect === 0) {
            console.log(`   👉 Đang gửi lệnh nhận thưởng Sự kiện "${actName}" (Gói 140108)...`);
            this.client.lastEventActivityRankReward = null;
            this.client.lastReturnCode = null;

            this.send(140108, { activityId: actId });
            await this.sleepRandom(1.2, 1.8);

            if (this.client.lastEventActivityRankReward && this.client.lastEventActivityRankReward.goodsList && this.client.lastEventActivityRankReward.goodsList.length > 0) {
              const awards = formatAwards(this.client.lastEventActivityRankReward.goodsList);
              console.log(`   🎉 [${actName}] Nhận THÀNH CÔNG: ${awards}`);
              totalClaimed++;
            } else if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 140108) {
              const code = this.client.lastReturnCode.code;
              if (code === 129003) {
                console.log(`   ℹ️ [${actName}] Chưa đạt mốc điểm nhận thưởng hoặc sự kiện chưa tới kỳ kết toán.`);
              } else {
                console.log(`   ℹ️ [${actName}] Phản hồi từ Server: Mã ${code}.`);
              }
            } else {
              console.log(`   ℹ️ [${actName}] Đã kiểm tra xong.`);
            }
          }
        }
      }
    }

    if (!isLoop) {
      console.log('\n------------------------------------------------------');
      console.log(`[Hoàn tất] Quét xong toàn bộ sự kiện tích điểm (${totalClaimed} phần thưởng đã nhận).`);
      console.log('======================================================\n');
    }

    return totalClaimed;
  }
}

module.exports = EventRankPointService;
