/**
 * Mail Service: Quản lý hộp thư (Kiểm tra, nhận nhanh toàn bộ quà, dọn dẹp thư đã nhận)
 */

const BaseService = require('../base/BaseService');
const { formatAwards } = require('../../core/protocol');

class MailService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'mail',
      domain: 'daily',
      name: '[Hộp Thư] Nhận toàn bộ Thư & Xóa thư rác',
      menuOption: 1,
      listenedMsgIds: [117202, 117203, 117205, 117206]
    });
  }

  async execute() {
    return this.autoClaimAndClean();
  }

  async autoClaimAndClean(isLoop = false) {
    if (!isLoop) {
      console.log('\n======================================================');
      console.log('[Auto Thư] BẮT ĐẦU KIỂM TRA & NHẬN QUÀ HỘP THƯ');
      console.log('======================================================');
      console.log('[Auto Thư] Bước 1: Đang kiểm tra danh sách thư từ Server...');
    }
    this.client.mailList = null;
    this.send(117105, { serialNum: 0 });
    await this.waitFor(() => this.client.mailList !== null);

    if (!this.client.mailList || this.client.mailList.length === 0) {
      if (!isLoop) {
        console.log('[-] [Auto Thư] Hộp thư của bạn hiện đang trống.\n');
      }
      return;
    }

    const totalMails = this.client.mailList.length;
    const uncollectedMails = this.client.mailList.filter(m => !m.isGet && m.AwardBeans && m.AwardBeans.length > 0);

    if (uncollectedMails.length === 0) {
      if (!isLoop) {
        console.log(`[-] [Auto Thư] Bạn có ${totalMails} thư nhưng không có thư nào còn quà chưa nhận.`);
        console.log('[-] [Auto Thư] Đang dọn dẹp các thư đã đọc/đã nhận...');
        this.send(117103, { mailId: '0', allDel: true });
        await this.sleepRandom(0.8, 1.2);
        console.log('[OK] [Auto Thư] Hoàn tất dọn dẹp hộp thư!\n');
      }
      return;
    }

    if (!isLoop) {
      console.log(`[+] [Auto Thư] Tìm thấy ${uncollectedMails.length}/${totalMails} thư có quà đính kèm:`);
      uncollectedMails.forEach((m, idx) => {
        const title = m.title || `Thư ${m.mailId}`;
        const awards = formatAwards(m.AwardBeans);
        console.log(`  - [${idx + 1}] "${title}": ${awards}`);
      });
      console.log('\n[+] [Auto Thư] Bước 2: Đang gửi lệnh NHẬN NHANH TOÀN BỘ QUÀ THƯ...');
    }

    this.client.lastMailAward = null;
    this.send(117102, { mailId: '0', allReward: true });
    await this.sleepRandom(1.0, 1.8);

    const timeStr = new Date().toLocaleTimeString('vi-VN');
    if (this.client.lastMailAward && this.client.lastMailAward.awardList && this.client.lastMailAward.awardList.length > 0) {
      const awards = formatAwards(this.client.lastMailAward.awardList);
      console.log(isLoop ? `[${timeStr}] [Hộp Thư] ĐÃ NHẬN THÀNH CÔNG QUÀ THƯ: ${awards}` : `[OK] [Auto Thư] ĐÃ NHẬN THÀNH CÔNG TẤT CẢ QUÀ: ${awards}`);
    } else {
      console.log(isLoop ? `[${timeStr}] [Hộp Thư] Nhận nhanh quà thư hoàn tất!` : '[OK] [Auto Thư] Nhận nhanh quà thư hoàn tất!');
    }

    // Bước 3: Xóa nhanh các thư đã nhận
    this.send(117103, { mailId: '0', allDel: true });
    await this.sleepRandom(0.8, 1.2);
    if (!isLoop) {
      console.log('[OK] [Auto Thư] Đã xóa dọn dẹp sạch sẽ hộp thư!\n');
    }
  }
}

module.exports = MailService;
