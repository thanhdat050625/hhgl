/**
 * Affair Service: Xử Lý Cung Vụ & Sự Vụ Triều Đình
 * Ưu tiên 100% lựa chọn nhận Cung Vận để thăng tước vị
 */

const BaseService = require('../base/BaseService');
const { getWorkDetails, getLevelInfo } = require('../../config');
const { formatAwards, formatPropName, formatDuration } = require('../../core/protocol');

function isCungVan(award) {
  if (!award) return false;
  // Trong game, type 2 = Resource, id 1 = Cung Vận (EXP Tước Vị)
  return Number(award.type) === 2 && Number(award.id) === 1;
}

function formatAwardChoice(award) {
  if (!award) return 'Không có thưởng';
  const num = Number(award.num || 1);
  if (Number(award.type) === 2) {
    if (Number(award.id) === 1) return `+${num} Cung Vận (EXP Tước Vị)`;
    if (Number(award.id) === 2) return `+${num.toLocaleString()} Bạc`;
    if (Number(award.id) === 3) return `+${num.toLocaleString()} Lương Thực`;
    if (Number(award.id) === 4) return `+${num.toLocaleString()} Binh Lực`;
    return `+${num} Tài nguyên #${award.id}`;
  }
  return `+${num} ${formatPropName(award.id || award.propId || award.configId)}`;
}

class AffairService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'affair',
      domain: 'daily',
      name: '[Cung Vụ] Cung Vụ / Sự Vụ Triều Đình',
      menuOption: 2,
      listenedMsgIds: [105201, 105203, 104202, 102207]
    });
  }

  async execute() {
    return this.autoHandleAffairs();
  }

  /**
   * Tự động kiểm tra túi đồ và sử dụng Cung Vụ Lệnh (ID 10002)
   * QUY TẮC: CHỈ DÙNG KHI đã xử lý hết sạch toàn bộ cung vụ tự nhiên miễn phí (workList = 0)
   * và đang ở thời gian chờ hồi phục cooldown để không bao giờ bị lãng phí 1 lượt tự nhiên nào.
   */
  async useCungVuLenhIfAvailable(isLoop = false) {
    const currentWorks = (this.client.workList || []).length;
    if (currentWorks > 0) {
      // Vẫn còn sự vụ miễn phí tự nhiên chưa phê duyệt -> KHÔNG DÙNG LỆNH
      return 0;
    }

    this.client.propList = null;
    this.send(104102, {});
    await this.waitFor(() => this.client.propList !== null, 3000);

    const propList = this.client.propList || [];
    const cvl = propList.find(p => p.configId === 10002 && p.num > 0);
    if (!cvl || cvl.num <= 0) return 0;

    const maxWork = Math.min(30, Math.max(3, 2 + this.playerData.lv * 2));
    const canAdd = Math.max(0, maxWork - currentWorks);
    if (canAdd <= 0) return 0;

    const numToUse = Math.min(canAdd, cvl.num);
    if (numToUse <= 0) return 0;

    if (!isLoop) {
      console.log(`\n  📜 [Cung Vụ Lệnh] Đã làm hết cung vụ miễn phí! Phát hiện x${cvl.num} Cung Vụ Lệnh trong túi.`);
      console.log(`     👉 Đang dùng x${numToUse} lệnh trong thời gian chờ cooldown để hồi phục cung vụ...`);
    } else {
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      console.log(`[${timeStr}] 📜 [Cung Vụ Lệnh] Hết cung vụ tự nhiên -> Dùng x${numToUse} Cung Vụ Lệnh trong thời gian chờ...`);
    }

    this.client.lastReturnCode = null;
    this.send(104101, {
      propId: cvl.propId,
      num: numToUse
    });
    cvl.num -= numToUse;
    await this.sleepRandom(1.2, 1.8);

    return numToUse;
  }

  async autoHandleAffairs(isLoop = false) {
    const maxWork = Math.min(30, Math.max(3, 2 + this.playerData.lv * 2));
    let handledCount = 0;
    let totalCungVanGain = 0;

    // GIAI ĐOẠN 1: XỬ LÝ HẾT SẠCH CUNG VỤ TỰ NHIÊN MIỄN PHÍ HIỆN CÓ
    while (true) {
      let availableWorks = (this.client.workList || []).slice();
      if (availableWorks.length === 0) break;

      if (!isLoop && handledCount === 0) {
        console.log(`\n[Cung Vụ] Đang có ${availableWorks.length}/${maxWork} sự vụ tự nhiên (miễn phí) cần phê duyệt:`);
      }

      for (const work of availableWorks) {
        this.client.lastReturnCode = null;
        const details = getWorkDetails(work.workId);

        const rew1Str = formatAwardChoice(work.award1);
        const rew2Str = formatAwardChoice(work.award2);

        let chooseType = 2;
        let expectedReward = rew2Str;
        let chosenOptName = details.option2;

        if (isCungVan(work.award1)) {
          chooseType = 1;
          expectedReward = rew1Str;
          chosenOptName = details.option1;
        } else if (isCungVan(work.award2)) {
          chooseType = 2;
          expectedReward = rew2Str;
          chosenOptName = details.option2;
        }

        const chosenAward = chooseType === 1 ? work.award1 : work.award2;
        if (isCungVan(chosenAward)) {
          totalCungVanGain += Number(chosenAward.num || 0);
        }

        this.send(102102, { workId: work.workId, type: chooseType });
        await this.sleepRandom(1.0, 1.5);

        if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 102102 && this.client.lastReturnCode.code !== 0) {
          if (!isLoop) console.log(`    [!] Server phản hồi mã: ${this.client.lastReturnCode.code}`);
          continue;
        }

        handledCount++;
        const lvlInfo = getLevelInfo(this.playerData.lv);
        const curExp = Number(this.playerData.exp) || 0;
        const expProgressStr = lvlInfo.maxExp > 0 ? ` (Tiến độ: ${curExp}/${lvlInfo.maxExp} EXP)` : ` (EXP: ${curExp})`;

        if (isLoop) {
          const timeStr = new Date().toLocaleTimeString('vi-VN');
          console.log(`[${timeStr}] [Cung Vụ Tự Nhiên] "${details.description.substring(0, 40)}..." -> [Chọn: "${chosenOptName}"] -> Nhận: ${expectedReward}${expProgressStr}`);
        } else {
          console.log(`  - "${details.description}"`);
          console.log(`    -> [Chọn: "${chosenOptName}"] -> Nhận: ${expectedReward}${expProgressStr}`);
        }
      }
    }

    // GIAI ĐOẠN 2: CHỈ KHI HẾT SẠCH CUNG VỤ TỰ NHIÊN (Ở THỜI GIAN CHỜ COOLDOWN), MỚI DÙNG CUNG VỤ LỆNH
    while (true) {
      const usedLenh = await this.useCungVuLenhIfAvailable(isLoop);
      if (usedLenh <= 0) {
        // Không còn Cung Vụ Lệnh hoặc đã đầy -> Thoát
        break;
      }

      await this.sleepRandom(1.0, 1.5);

      // Xử lý ngay các sự vụ vừa được hồi phục từ Cung Vụ Lệnh
      let newWorks = (this.client.workList || []).slice();
      if (newWorks.length === 0) break;

      for (const work of newWorks) {
        this.client.lastReturnCode = null;
        const details = getWorkDetails(work.workId);

        const rew1Str = formatAwardChoice(work.award1);
        const rew2Str = formatAwardChoice(work.award2);

        let chooseType = 2;
        let expectedReward = rew2Str;
        let chosenOptName = details.option2;

        if (isCungVan(work.award1)) {
          chooseType = 1;
          expectedReward = rew1Str;
          chosenOptName = details.option1;
        } else if (isCungVan(work.award2)) {
          chooseType = 2;
          expectedReward = rew2Str;
          chosenOptName = details.option2;
        }

        const chosenAward = chooseType === 1 ? work.award1 : work.award2;
        if (isCungVan(chosenAward)) {
          totalCungVanGain += Number(chosenAward.num || 0);
        }

        this.send(102102, { workId: work.workId, type: chooseType });
        await this.sleepRandom(1.0, 1.5);

        if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 102102 && this.client.lastReturnCode.code !== 0) {
          if (!isLoop) console.log(`    [!] Server phản hồi mã: ${this.client.lastReturnCode.code}`);
          continue;
        }

        handledCount++;
        const lvlInfo = getLevelInfo(this.playerData.lv);
        const curExp = Number(this.playerData.exp) || 0;
        const expProgressStr = lvlInfo.maxExp > 0 ? ` (Tiến độ: ${curExp}/${lvlInfo.maxExp} EXP)` : ` (EXP: ${curExp})`;

        if (isLoop) {
          const timeStr = new Date().toLocaleTimeString('vi-VN');
          console.log(`[${timeStr}] [Cung Vụ Lệnh] "${details.description.substring(0, 40)}..." -> [Chọn: "${chosenOptName}"] -> Nhận: ${expectedReward}${expProgressStr}`);
        } else {
          console.log(`  - [Cung Vụ Lệnh] "${details.description}"`);
          console.log(`    -> [Chọn: "${chosenOptName}"] -> Nhận: ${expectedReward}${expProgressStr}`);
        }
      }
    }

    if (handledCount === 0) {
      let rawTime = this.client.workRefreshTime || 0;
      let diff = rawTime > 10000000 ? Math.max(0, Math.floor(rawTime - Date.now() / 1000)) : rawTime;
      if (diff <= 0) {
        this.client.workRefreshTime = Math.floor(Date.now() / 1000) + 1800;
        diff = 1800;
      }
      const cdStr = formatDuration(diff);
      if (!isLoop) {
        console.log(`\n[Cung Vụ] Đã hết sự vụ (0/${maxWork}) & không còn Cung Vụ Lệnh | Hồi sự vụ mới sau: ${cdStr}`);
      }
      return { handledCount: 0, totalCungVanGain: 0, workCdStr: cdStr };
    }

    return { handledCount, totalCungVanGain };
  }
}

module.exports = AffairService;
