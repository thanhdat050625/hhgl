/**
 * Welfare Service: Quản lý toàn bộ 5 Tab Phúc Lợi
 * Tab 1: Báo danh 7 ngày (102103 { type: 0 })
 * Tab 2: Thưởng Online (151101 -> 151102 { id: -1 })
 * Tab 3: Đăng nhập 7 ngày (152101 -> 152102 { id: day - 1 })
 * Tab 4: Điểm danh tích lũy & VIP (211101 -> 211102 & 102103 { type: 1, vipLv })
 * Tab 5: Cây Cầu Nguyện Miễn Phí (128102 -> 128101)
 */

const BaseService = require('../base/BaseService');
const { formatAwards, formatPropName } = require('../../core/protocol');

class WelfareService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'welfare',
      domain: 'welfare',
      name: '[Phúc Lợi] Nhận Phúc Lợi 5 Tab & Điểm danh hàng ngày',
      menuOption: 1,
      listenedMsgIds: [151201, 151202, 152201, 152202, 211201, 211202, 128201, 128202]
    });
  }

  async execute() {
    return this.autoClaimAll();
  }

  async autoClaimAll() {
    console.log('\n======================================================');
    console.log('[Auto Phúc Lợi] BẮT ĐẦU NHẬN TẤT CẢ CÁC MỤC PHÚC LỢI');
    console.log('======================================================');

    // TAB 1: Báo danh hàng ngày
    console.log('[Tab 1: Báo Danh] Kiểm tra trạng thái báo danh hôm nay...');
    if (this.playerData.isSigned === 1) {
      console.log('  [-] [Quà Báo Danh] Hôm nay bạn đã báo danh rồi.');
    } else {
      console.log('  [+] Đang gửi lệnh nhận Quà Báo Danh...');
      this.client.recentProps = [];
      this.send(102103, { type: 0 });
      await this.sleepRandom(1.0, 1.8);
      if (this.client.recentProps.length > 0) {
        const propsStr = this.client.recentProps.map(p => `+${p.propNum} ${formatPropName(p.propId)}`).join(', ');
        console.log(`  [OK] [Quà Báo Danh] Nhận thành công: ${propsStr}`);
      } else {
        console.log('  [OK] [Quà Báo Danh] Đã điểm danh thành công!');
      }
      this.playerData.isSigned = 1;
    }

    // TAB 2: Thưởng Online
    console.log('\n[Tab 2: Thưởng Online] Kiểm tra thời gian online & mốc quà...');
    this.client.onlineInfo = null;
    this.send(151101, {});
    await this.waitFor(() => this.client.onlineInfo !== null);

    if (this.client.onlineInfo) {
      const onlineSec = Number(this.client.onlineInfo.sec) || 0;
      const onlineMin = Math.floor(onlineSec / 60);
      const onlineRemSec = onlineSec % 60;
      console.log(`  [-] Thời gian online tích lũy: ${onlineMin} phút ${onlineRemSec}s (${onlineSec}s)`);

      const claimedList = this.client.onlineInfo.rewardList || [];
      const ONLINE_MILESTONES = [
        { idx: 0, time: 300, name: '5 phút' },
        { idx: 1, time: 600, name: '10 phút' },
        { idx: 2, time: 1800, name: '30 phút' },
        { idx: 3, time: 3600, name: '60 phút' },
        { idx: 4, time: 5400, name: '90 phút' },
        { idx: 5, time: 7200, name: '120 phút' }
      ];

      const readyMilestones = ONLINE_MILESTONES.filter(m => onlineSec >= m.time && !claimedList.includes(m.idx));

      if (readyMilestones.length > 0) {
        console.log(`  [+] Đang gửi lệnh nhận nhanh ${readyMilestones.length} mốc quà online đã đạt...`);
        this.client.recentProps = [];
        this.client.lastOnlineReward = null;
        this.send(151102, { id: -1 });
        await this.sleepRandom(1.0, 1.8);

        if (this.client.lastOnlineReward && this.client.lastOnlineReward.awardInfo && this.client.lastOnlineReward.awardInfo.awardList) {
          const awards = formatAwards(this.client.lastOnlineReward.awardInfo.awardList);
          console.log(`  [OK] [Thưởng Online] Đã nhận thành công: ${awards}`);
        } else if (this.client.recentProps.length > 0) {
          const propsStr = this.client.recentProps.map(p => `+${p.num || p.propNum || 1} ${formatPropName(p.configId || p.propId)}`).join(', ');
          console.log(`  [OK] [Thưởng Online] Đã nhận: ${propsStr}`);
        } else {
          console.log('  [OK] [Thưởng Online] Nhận quà online thành công!');
        }
      }

      // Thông báo mốc tiếp theo
      const nextMilestone = ONLINE_MILESTONES.find(m => !claimedList.includes(m.idx) && !readyMilestones.includes(m));
      if (nextMilestone) {
        const waitSec = Math.max(0, nextMilestone.time - onlineSec);
        const waitMin = Math.floor(waitSec / 60);
        const waitRemSec = waitSec % 60;
        console.log(`  [-] [Thưởng Online] Mốc tiếp theo [${nextMilestone.name}]: Cần online thêm ${waitMin} phút ${waitRemSec}s (${waitSec}s) để nhận.`);
      } else if (readyMilestones.length === 0) {
        console.log('  [OK] [Thưởng Online] Bạn đã nhận toàn bộ các mốc thưởng online của ngày hôm nay!');
      }
    }

    // TAB 3: Đăng nhập 7 ngày
    console.log('\n[Tab 3: Đăng Nhập 7 Ngày] Kiểm tra tiến độ 7 ngày...');
    this.client.sevenDayInfo = null;
    this.send(152101, {});
    await this.waitFor(() => this.client.sevenDayInfo !== null);

    if (this.client.sevenDayInfo) {
      const curDay = Number(this.client.sevenDayInfo.day) || 1;
      const gotIds = this.client.sevenDayInfo.rewardList || [];
      console.log(`  [-] Đang ở Ngày ${curDay} của chu kỳ 7 ngày.`);

      const targetId = curDay - 1;
      if (gotIds.includes(targetId)) {
        console.log(`  [-] [Đăng Nhập 7 Ngày] Quà Ngày ${curDay} hôm nay bạn đã nhận rồi. Hãy quay lại vào ngày mai.`);
      } else {
        console.log(`  [+] Đang gửi lệnh nhận thưởng Ngày ${curDay}...`);
        this.client.recentProps = [];
        this.client.lastSevenDayReward = null;
        this.send(152102, { id: targetId });
        await this.sleepRandom(1.0, 1.8);

        if (this.client.lastSevenDayReward && this.client.lastSevenDayReward.awardInfo && this.client.lastSevenDayReward.awardInfo.awardList) {
          const awards = formatAwards(this.client.lastSevenDayReward.awardInfo.awardList);
          console.log(`  [OK] [Đăng Nhập 7 Ngày] Đã nhận quà Ngày ${curDay}: ${awards}`);
        } else if (this.client.recentProps.length > 0) {
          const propsStr = this.client.recentProps.map(p => `+${p.num || p.propNum || 1} ${formatPropName(p.configId || p.propId)}`).join(', ');
          console.log(`  [OK] [Đăng Nhập 7 Ngày] Đã nhận: ${propsStr}`);
        } else {
          console.log(`  [OK] [Đăng Nhập 7 Ngày] Nhận thưởng Ngày ${curDay} hoàn tất!`);
        }
      }
    }

    // TAB 4: Điểm danh tích lũy & VIP
    console.log('\n[Tab 4: Phúc Lợi Khác] Kiểm tra Điểm danh tích lũy & VIP...');
    this.client.signInfo = null;
    this.send(211101, {});
    await this.waitFor(() => this.client.signInfo !== null);

    if (this.client.signInfo) {
      const signDays = this.client.signInfo.totalSignDay || 0;
      console.log(`  [-] Tổng số ngày tích lũy: ${signDays} ngày.`);

      const claimedSids = this.client.signInfo.rewardSidList || [];
      const CUMULATIVE_MILESTONES = [
        { sid: 1, days: 10 },
        { sid: 2, days: 20 },
        { sid: 3, days: 50 },
        { sid: 4, days: 100 },
        { sid: 5, days: 200 },
        { sid: 6, days: 365 }
      ];

      let claimedCount = 0;
      for (const m of CUMULATIVE_MILESTONES) {
        if (signDays >= m.days && !claimedSids.includes(m.sid)) {
          console.log(`  [+] Đang nhận mốc tích lũy ${m.days} ngày...`);
          this.client.recentProps = [];
          this.send(211102, { rewardSid: m.sid });
          claimedCount++;
          await this.sleepRandom(1.0, 1.8);
        }
      }

      const nextMilestone = CUMULATIVE_MILESTONES.find(m => !claimedSids.includes(m.sid) && signDays < m.days);
      if (nextMilestone) {
        console.log(`  [-] [Điểm Danh Tích Lũy] Mốc tiếp theo [${nextMilestone.days} ngày]: Cần tích lũy thêm ${nextMilestone.days - signDays} ngày.`);
      } else if (claimedCount === 0) {
        console.log('  [-] [Điểm Danh Tích Lũy] Bạn đã nhận hết các mốc tích lũy hiện tại.');
      }
    }

    // VIP Daily Welfare check
    const vipLv = this.playerData.vip || 0;
    if (vipLv <= 0) {
      console.log('  [-] [Phúc Lợi VIP] Cấp VIP hiện tại là 0, không có quà VIP hàng ngày.');
    } else {
      const hasReceivedVip = this.playerData.hasReceivedVip || 0;
      const isClaimed = ((hasReceivedVip >> (vipLv - 1)) & 1) === 1;
      if (isClaimed) {
        console.log(`  [-] [Phúc Lợi VIP] Hôm nay bạn đã nhận phúc lợi VIP ${vipLv} rồi.`);
      } else {
        console.log(`  [+] Đang gửi lệnh nhận phúc lợi VIP ${vipLv}...`);
        this.client.lastReturnCode = null;
        this.client.recentProps = [];
        this.send(102103, { type: 1, vipLv: vipLv });
        await this.sleepRandom(1.0, 1.8);

        if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 102103 && this.client.lastReturnCode.code !== 0) {
          console.log(`  [-] [Phúc Lợi VIP] Hôm nay bạn đã nhận phúc lợi VIP ${vipLv} rồi.`);
        } else if (this.client.recentProps.length > 0) {
          const propsStr = this.client.recentProps.map(p => `+${p.num || p.propNum || 1} ${formatPropName(p.configId || p.propId)}`).join(', ');
          console.log(`  [OK] [Phúc Lợi VIP] Nhận thành công: ${propsStr}`);
        } else {
          console.log(`  [OK] [Phúc Lợi VIP] Nhận phúc lợi VIP ${vipLv} thành công!`);
        }
        this.playerData.hasReceivedVip = hasReceivedVip | (1 << (vipLv - 1));
      }
    }

    // TAB 5: Cây Ước Nguyện / Cầu Nguyện Miễn Phí
    console.log('\n[Tab 5: Cây Cầu Nguyện] Kiểm tra lượt Cầu Nguyện miễn phí...');
    this.client.lotteryCdInfo = null;
    this.send(128102, {});
    await this.waitFor(() => this.client.lotteryCdInfo !== null);

    if (this.client.lotteryCdInfo) {
      const cdTime = Number(this.client.lotteryCdInfo.YBCdTime) || 0;
      if (cdTime === 0) {
        console.log('  [+] Có lượt Cầu Nguyện miễn phí! Đang gửi lệnh cầu nguyện...');
        this.client.lastLotteryReward = null;
        this.send(128101, { LotteryType: 1, NumType: 1 });
        await this.sleepRandom(1.0, 1.8);

        if (this.client.lastLotteryReward && this.client.lastLotteryReward.rewardList && this.client.lastLotteryReward.rewardList.length > 0) {
          const awards = formatAwards(this.client.lastLotteryReward.rewardList);
          console.log(`  [OK] [Cầu Nguyện] Cầu nguyện thành công: ${awards}`);
        } else {
          console.log('  [OK] [Cầu Nguyện] Cầu nguyện thành công!');
        }
      } else {
        console.log('  [-] [Cầu Nguyện] Hôm nay đã dùng lượt Cầu Nguyện miễn phí.');
      }
    }

    console.log('\n[OK] [Auto Phúc Lợi] Hoàn tất nhận toàn bộ các mục phúc lợi!\n');
  }
}

module.exports = WelfareService;
