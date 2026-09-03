/**
 * Helper Service: Quản lý & Tự Động Bồi Dưỡng Tùy Tùng (Helpers)
 * - Đọc & nhận quà Thư Tùy Tùng (xóa sạch dấu hoa hồng trên Tùy Tùng)
 * - Tự động Nghiên Cứu / Tăng Cấp Tư Chất Tùy Tùng (105102 - ReqHelperUpAptitudeLv)
 * - Tự động Đề Bạt Tước Vị Tùy Tùng (105104 - ReqHelperUpNobility)
 * - Nâng cấp Tùy Tùng (105101 - ReqHelperUpLv) với Tên Tiếng Việt rõ ràng
 */

const path = require('path');
const fs = require('fs');
const BaseService = require('../base/BaseService');
const { getHelperName, getAptitudeName, getItemName } = require('../../config');
const { formatAwards } = require('../../core/protocol');

class HelperService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'helper',
      domain: 'growth',
      name: '[Tùy Tùng] Tùy Tùng & Bồi Dưỡng Lực Chiến',
      menuOption: null,
      listenedMsgIds: [105201, 105202, 105203, 105204, 105205, 105206, 105208, 105209]
    });
    this.aptConfig = null;
  }

  getAptitudeConfig() {
    if (!this.aptConfig) {
      try {
        const p = path.join(__dirname, '../../../_source_game/config_tables/HelperAptitudeConfig_json.json');
        if (fs.existsSync(p)) {
          this.aptConfig = JSON.parse(fs.readFileSync(p, 'utf8'));
        }
      } catch (e) {}
    }
    return this.aptConfig;
  }

  async execute() {
    await this.readAllHelperLetters();
    await this.autoUpgradeAptitudes();
    await this.autoPromoteHelpers();
    return this.autoLevelUpHelpers();
  }

  /**
   * Đọc và nhận toàn bộ Thư Tùy Tùng (Xóa dấu hoa hồng trên Tùy Tùng)
   */
  async readAllHelperLetters() {
    console.log('\n[Thư Tùy Tùng] Đang kiểm tra thư thăm hỏi & hoa hồng của Tùy Tùng...');
    this.client.helperLetters = null;
    this.send(105108, {});
    await this.waitFor(() => this.client.helperLetters !== null);

    const letters = (this.client.helperLetters || []).slice();
    if (letters.length === 0) {
      console.log('  [-] [Thư Tùy Tùng] Không có thư nào mới cần xử lý.');
      return;
    }

    console.log(`  [+] [Thư Tùy Tùng] Tìm thấy ${letters.length} thư của Tùy Tùng! Đang đọc và nhận quà...`);
    for (const letId of letters) {
      this.client.lastHelperLetterAward = null;
      this.send(105109, { letterId: Number(letId) });
      await this.sleepRandom(1.0, 1.8);

      if (this.client.lastHelperLetterAward && this.client.lastHelperLetterAward.awardBeanList) {
        const awards = formatAwards(this.client.lastHelperLetterAward.awardBeanList);
        console.log(`    [Thư #${letId}] Đã hồi âm & Nhận quà: ${awards}`);
      } else {
        console.log(`    [Thư #${letId}] Đã hồi âm thành công! (Dấu hoa hồng đã được xóa)`);
      }
    }
  }

  /**
   * Tự động Nghiên Cứu / Nâng Cấp Tư Chất Tùy Tùng khi có Đạo cụ (Quyển tư chất)
   */
  async autoUpgradeAptitudes() {
    console.log('\n[Nghiên Cứu Tư Chất] Đang kiểm tra đạo cụ & nghiên cứu Tư Chất Tùy Tùng...');
    
    // Đảm bảo dữ liệu túi đồ mới nhất
    if (!this.client.propList) {
      this.send(104102, {});
      await this.sleepRandom(1.0, 1.5);
    }

    const propList = this.client.propList || [];
    const bookIds = [11001, 11002, 11003, 11004];
    const availableBooks = propList.filter(p => bookIds.includes(Number(p.configId)) && Number(p.num) > 0);

    if (availableBooks.length === 0) {
      console.log('  [-] [Nghiên Cứu Tư Chất] Túi đồ hiện không có Quyển Tư Chất nào để Nghiên Cứu.');
      return 0;
    }

    const helpers = (this.client.helperInfoList || []).slice();
    if (helpers.length === 0) return 0;

    // Ưu tiên nghiên cứu cho Tùy Tùng có chiến lực/tư chất cao nhất
    helpers.sort((a, b) => Number(b.fightValue || 0) - Number(a.fightValue || 0));
    const aptCfg = this.getAptitudeConfig();

    let totalUpgrades = 0;
    for (const book of availableBooks) {
      const bId = Number(book.configId);
      let count = Number(book.num) || 0;
      const bName = getItemName(bId);

      console.log(`  [+] [Quyển Tư Chất] Đang dùng ${count}x ${bName} để Nghiên Cứu...`);

      for (const helper of helpers) {
        if (count <= 0) break;
        const hId = helper.helpId;
        const helperName = getHelperName(hId);
        const apList = (helper.apInfo || []).slice();

        for (const ap of apList) {
          if (count <= 0) break;
          const aptId = ap.id;
          const aptRow = aptCfg && aptCfg.list ? aptCfg.list[String(aptId)] : null;
          const reqPropId = aptRow && aptRow[4] ? aptRow[4][1] : null;

          if (reqPropId === bId) {
            while (count > 0) {
              const aptName = getAptitudeName(aptId);
              this.client.lastReturnCode = null;
              this.client.lastAptitudeUp = null;

              this.send(105102, { helpId: hId, apId: aptId, type: 1 });
              await this.sleepRandom(1.0, 1.8);

              if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 105102 && this.client.lastReturnCode.code !== 0) {
                break;
              }

              if (this.client.lastAptitudeUp && this.client.lastAptitudeUp.isSucceed) {
                const newLv = (this.client.lastAptitudeUp.apInfo && this.client.lastAptitudeUp.apInfo.lv)
                  ? this.client.lastAptitudeUp.apInfo.lv
                  : ((ap.lv || 1) + 1);
                console.log(`    [Nghiên Cứu] Tùy Tùng [${helperName}] Nghiên Cứu thành công [${aptName}] lên Cấp ${newLv}! (+${this.client.lastAptitudeUp.apValue || 1} Tư Chất)`);
                ap.lv = newLv;
                count--;
                totalUpgrades++;
              } else {
                break;
              }
            }
          }
        }
      }
    }

    if (totalUpgrades > 0) {
      console.log(`  [Nghiên Cứu Tư Chất] Đã hoàn thành ${totalUpgrades} lần Nghiên Cứu Tư Chất cho Tùy Tùng.`);
    }

    return totalUpgrades;
  }

  /**
   * Tự động Đề Bạt Tước Vị Tùy Tùng khi đủ điều kiện
   */
  async autoPromoteHelpers(isLoop = false) {
    const helpers = (this.client.helperInfoList || []).slice();
    if (helpers.length === 0) return;

    for (const helper of helpers) {
      const hId = helper.helpId;
      const helperName = getHelperName(hId);
      this.client.lastReturnCode = null;
      this.send(105104, { helpId: hId });
      await this.sleepRandom(0.8, 1.5);

      if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 105104 && this.client.lastReturnCode.code === 0) {
        if (isLoop) {
          const timeStr = new Date().toLocaleTimeString('vi-VN');
          console.log(`[${timeStr}] [Tùy Tùng] [${helperName}] Đề Bạt Tước Vị thành công!`);
        } else {
          console.log(`  [Đề Bạt] Tùy Tùng [${helperName}] đã được Đề Bạt Tước Vị thành công!`);
        }
      }
    }
  }

  /**
   * Tự động Nâng Cấp Tùy Tùng bằng Bạc
   */
  async autoLevelUpHelpers(targetLevel = 0, targetHelperId = 0, isLoop = false) {
    const helpers = (this.client.helperInfoList || []).slice();
    if (helpers.length === 0) return 0;

    // Sắp xếp tùy tùng ưu tiên theo tư chất/lực chiến cao nhất
    helpers.sort((a, b) => Number(b.fightValue || 0) - Number(a.fightValue || 0));

    let upgrades = 0;
    let outOfSilver = false;
    const targetHelpers = targetHelperId ? helpers.filter(h => h.helpId === targetHelperId) : helpers;

    for (const helper of targetHelpers) {
      if (outOfSilver) break;
      let curLv = Number(helper.lv) || 1;
      const hId = helper.helpId;
      const helperName = getHelperName(hId);

      let maxLoops = 200;
      while (maxLoops-- > 0) {
        if (targetLevel > 0 && curLv >= targetLevel) break;

        this.client.lastReturnCode = null;
        this.client.lastHelperUp = null;

        const lvType = (targetLevel > 0 && targetLevel - curLv < 10) ? 1 : 2;
        this.send(105101, { helpId: hId, lvType });
        await this.sleepRandom(1.0, 1.8);

        if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 105101 && this.client.lastReturnCode.code !== 0) {
          if (lvType === 2) {
            this.client.lastReturnCode = null;
            this.send(105101, { helpId: hId, lvType: 1 });
            await this.sleepRandom(1.0, 1.8);
            if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 105101 && this.client.lastReturnCode.code !== 0) {
              outOfSilver = true;
              break;
            }
          } else {
            outOfSilver = true;
            break;
          }
        }

        if (this.client.lastHelperUp && this.client.lastHelperUp.helpId === hId) {
          const newLv = Number(this.client.lastHelperUp.lv) || (curLv + (lvType === 2 ? 10 : 1));
          if (isLoop) {
            const timeStr = new Date().toLocaleTimeString('vi-VN');
            console.log(`[${timeStr}] [Tùy Tùng] [${helperName}] Nâng cấp thành công lên Lv.${newLv}!`);
          } else {
            console.log(`  [${helperName}] Nâng cấp thành công lên Lv.${newLv}!`);
          }
          curLv = newLv;
          helper.lv = newLv;
          upgrades++;
        } else {
          curLv += (lvType === 2 ? 10 : 1);
          upgrades++;
        }

        if (targetLevel > 0 && curLv >= targetLevel) break;
      }
    }

    if (outOfSilver && !isLoop) {
      console.log('  [-] [Tùy Tùng] Đã dùng tối đa Bạc hiện có để nâng cấp Tùy Tùng.');
    }

    return upgrades;
  }
}

module.exports = HelperService;
