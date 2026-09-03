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

    // 1. Vào Học Viện & quét thông tin
    this.send(217107, { flag: 1 });
    this.client.academyInfo = null;
    this.send(217108, {});
    await this.waitFor(() => this.client.academyInfo !== null);

    // 2. Nhận thưởng buổi học đã hoàn thành nếu có
    this.send(217105, {});
    await this.sleepRandom(0.8, 1.2);

    // 3. Cho Tùy Tùng mạnh nhất vào học
    const helperName = getHelperName(10001);
    if (!isLoop) {
      console.log(`  [+] Đang sắp xếp Tùy Tùng ${helperName} vào học tập đọc sách...`);
    }
    this.send(217104, { studyType: 1, playerId: 10001 });
    await this.sleepRandom(0.8, 1.2);

    if (!isLoop) {
      console.log('[OK] [Auto Học Viện] Đã sắp xếp Tùy Tùng học tập xong!\n');
    }
  }
}

module.exports = AcademyService;
