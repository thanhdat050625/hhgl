/**
 * AcademyService: Tự Động Thư Viện / Học Viện Cung Đình (Cho Tùy Tùng Đọc Sách Nhận EXP & Điểm Kỹ Năng)
 * 100% Đọc trực tiếp từ Server qua Module academyMessage (217101 -> 217210)
 */

const BaseService = require('../base/BaseService');
const { getHelperName } = require('../../config');

class AcademyService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'academy',
      domain: 'leisure',
      name: '[Thư Viện] Thư Viện / Học Viện (Cho Tùy Tùng đọc sách nhận EXP & Kỹ năng)',
      menuOption: 3,
      listenedMsgIds: [217207, 217208]
    });
  }

  async execute() {
    return this.autoStudy();
  }

  async autoStudy(isLoop = false) {
    if (!isLoop) {
      console.log('\n[Auto Thư Viện / Học Viện] Đang kiểm tra Phòng Học Tùy Tùng...');
    }

    // 1. Vào Học Viện & quét thông tin hiện tại từ Server
    this.send(217107, { flag: 1 });
    this.client.academyInfo = null;
    this.send(217108, {});
    await this.waitFor(() => this.client.academyInfo !== null);

    const STUDY_DURATION = 10800; // 3 tiếng (10.800 giây) theo AcademyRoomConfig
    const beginTime = Number(this.client.academyInfo && this.client.academyInfo.beginTime) || 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const elapsed = nowSec - beginTime;
    const remainingSec = beginTime > 0 ? Math.max(0, STUDY_DURATION - elapsed) : 0;

    // Nếu đang trong buổi học và chưa đến giờ tốt nghiệp
    if (beginTime > 0 && remainingSec > 0) {
      this.client.academyNextReadyTime = Date.now() + remainingSec * 1000;
      const remMin = Math.floor(remainingSec / 60);
      const remSec = remainingSec % 60;
      if (!isLoop) {
        console.log(`  [-] [Học Viện] Tùy Tùng đang trong giờ đọc sách. Còn ${remMin} phút ${remSec}s nữa mới tốt nghiệp.`);
        console.log(`  [*] Đã hẹn giờ Realtime: Tự động thu hoạch lúc ${new Date(this.client.academyNextReadyTime).toLocaleTimeString('vi-VN')} (0 giây trễ)!\n`);
      }
      return;
    }

    // 2. Nhận thưởng buổi học đã hoàn thành
    this.send(217105, {});
    await this.sleepRandom(0.8, 1.2);

    // 3. Cho Tùy Tùng mạnh nhất vào học buổi mới
    const helperName = getHelperName(10001);
    if (!isLoop) {
      console.log(`  [+] Đang sắp xếp Tùy Tùng ${helperName} vào học tập đọc sách...`);
    }
    this.send(217104, { studyType: 1, playerId: 10001 });
    await this.sleepRandom(0.8, 1.2);

    // Đặt mốc thu hoạch kế tiếp đúng 3 tiếng sau
    this.client.academyNextReadyTime = Date.now() + STUDY_DURATION * 1000;
    const nextTimeStr = new Date(this.client.academyNextReadyTime).toLocaleTimeString('vi-VN');

    const timeStr = new Date().toLocaleTimeString('vi-VN');
    if (isLoop) {
      console.log(`[${timeStr}] [Học Viện] Thu hoạch EXP & đã xếp Tùy Tùng ${helperName} vào học buổi mới (3 tiếng - xong lúc ${nextTimeStr})!`);
    } else {
      console.log(`[Auto Học Viện] Đã sắp xếp Tùy Tùng học tập xong! Buổi học kế tiếp hoàn thành lúc: ${nextTimeStr}\n`);
    }
  }
}

module.exports = AcademyService;
