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
    await this.autoCultivateHelpers();
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

  /**
   * Tự Động Bồi Dưỡng Thuộc Tính Tối Ưu Cho Tùy Tùng (Đan, Tán, Hoàn, Quả, Sách)
   * Chiến thuật tối ưu chuẩn:
   * - Tâm Kế -> Dồn cho Tùy Tùng chuyên Tâm Kế (Tiểu Lộ Tử / Tùy tùng có Tâm Kế cao nhất)
   * - Tài Hoa -> Dồn cho Tùy Tùng chuyên Tài Hoa (Nhiếp Tiểu Thiện / Tùy tùng có Tài Hoa cao nhất)
   * - Giao Tiếp -> Dồn cho Tùy Tùng chuyên Giao Tiếp (Đồng Giai / Tùy tùng có Giao Tiếp cao nhất)
   * - Dung Nhan -> Dồn cho Tùy Tùng chuyên Dung Nhan (Sóc Vũ / Tùy tùng có Dung Nhan cao nhất)
   * - Toàn Diện / Ngẫu Nhiên -> Dồn 100% cho Tùy Tùng Chủ Lực mạnh nhất (Fight Value cao nhất)
   */
  async autoCultivateHelpers(isLoop = false) {
    const helpers = (this.client.helperInfoList || []).slice();
    if (helpers.length === 0) return 0;

    const propList = this.client.propList || [];
    if (propList.length === 0) return 0;

    // 1. Phân tích tìm Tùy Tùng tối ưu nhất cho từng hệ thuộc tính
    const getHelperAttr = (h, typeId) => {
      if (!h.attInfo) return 0;
      const att = h.attInfo.find(a => a.type === typeId);
      return att ? (Number(att.zz || 0) + Number(att.dw || 0)) : 0;
    };

    // Chủ lực mạnh nhất (Fight Value hoặc Lv cao nhất)
    const sortedByPower = helpers.slice().sort((a, b) => Number(b.fightValue || 0) - Number(a.fightValue || 0));
    const mainCarry = sortedByPower[0] || helpers[0];

    // Chuyên Tâm Kế (type 101)
    const sortedByTamKe = helpers.slice().sort((a, b) => getHelperAttr(b, 101) - getHelperAttr(a, 101));
    const bestTamKe = sortedByTamKe[0] || mainCarry;

    // Chuyên Tài Hoa (type 102)
    const sortedByTaiHoa = helpers.slice().sort((a, b) => getHelperAttr(b, 102) - getHelperAttr(a, 102));
    const bestTaiHoa = sortedByTaiHoa[0] || mainCarry;

    // Chuyên Giao Tiếp (type 103)
    const sortedByGiaoTiep = helpers.slice().sort((a, b) => getHelperAttr(b, 103) - getHelperAttr(a, 103));
    const bestGiaoTiep = sortedByGiaoTiep[0] || mainCarry;

    // Chuyên Dung Nhan (type 104)
    const sortedByDungNhan = helpers.slice().sort((a, b) => getHelperAttr(b, 104) - getHelperAttr(a, 104));
    const bestDungNhan = sortedByDungNhan[0] || mainCarry;

    const itemCategoryMap = {
      // Tâm Kế (101)
      12002: { target: bestTamKe, typeName: 'Tâm Kế', addPerItem: 100 },
      12007: { target: bestTamKe, typeName: 'Tâm Kế', addPerItem: 500 },
      12012: { target: bestTamKe, typeName: 'Tâm Kế', addPerItem: 1000 },
      12017: { target: bestTamKe, typeName: 'Tâm Kế', addPerItem: 5000 },
      12022: { target: bestTamKe, typeName: 'Tâm Kế', addPerItem: 10000 },

      // Tài Hoa (102)
      12003: { target: bestTaiHoa, typeName: 'Tài Hoa', addPerItem: 100 },
      12008: { target: bestTaiHoa, typeName: 'Tài Hoa', addPerItem: 500 },
      12013: { target: bestTaiHoa, typeName: 'Tài Hoa', addPerItem: 1000 },
      12018: { target: bestTaiHoa, typeName: 'Tài Hoa', addPerItem: 5000 },
      12023: { target: bestTaiHoa, typeName: 'Tài Hoa', addPerItem: 10000 },

      // Giao Tiếp (103)
      12004: { target: bestGiaoTiep, typeName: 'Giao Tiếp', addPerItem: 100 },
      12009: { target: bestGiaoTiep, typeName: 'Giao Tiếp', addPerItem: 500 },
      12014: { target: bestGiaoTiep, typeName: 'Giao Tiếp', addPerItem: 1000 },
      12019: { target: bestGiaoTiep, typeName: 'Giao Tiếp', addPerItem: 5000 },
      12024: { target: bestGiaoTiep, typeName: 'Giao Tiếp', addPerItem: 10000 },

      // Dung Nhan (104)
      12005: { target: bestDungNhan, typeName: 'Dung Nhan', addPerItem: 100 },
      12010: { target: bestDungNhan, typeName: 'Dung Nhan', addPerItem: 500 },
      12015: { target: bestDungNhan, typeName: 'Dung Nhan', addPerItem: 1000 },
      12020: { target: bestDungNhan, typeName: 'Dung Nhan', addPerItem: 5000 },
      12025: { target: bestDungNhan, typeName: 'Dung Nhan', addPerItem: 10000 },

      // Toàn Diện / Ngẫu Nhiên (Dồn Chủ Lực)
      12001: { target: mainCarry, typeName: 'Ngẫu Nhiên', addPerItem: 100 },
      12006: { target: mainCarry, typeName: 'Ngẫu Nhiên', addPerItem: 500 },
      12011: { target: mainCarry, typeName: 'Ngẫu Nhiên', addPerItem: 1000 },
      12016: { target: mainCarry, typeName: 'Ngẫu Nhiên', addPerItem: 5000 },
      12021: { target: mainCarry, typeName: 'Ngẫu Nhiên', addPerItem: 10000 }
    };

    let totalUsed = 0;

    for (const item of propList) {
      const cat = itemCategoryMap[item.configId];
      if (cat && item.num > 0 && cat.target) {
        const count = item.num;
        const targetId = cat.target.helpId;
        const targetName = getHelperName(targetId);
        const propName = getItemName(item.configId) || `Đạo cụ #${item.configId}`;
        const totalBonus = (count * cat.addPerItem).toLocaleString();

        this.client.lastReturnCode = null;
        this.send(104101, {
          propId: item.propId,
          num: count,
          args: String(targetId)
        });
        item.num = 0; // Đánh dấu đã dùng

        await this.sleepRandom(1.0, 1.6);

        totalUsed += count;

        if (isLoop) {
          const timeStr = new Date().toLocaleTimeString('vi-VN');
          console.log(`[${timeStr}] 💊 [Bồi Dưỡng] x${count} [${propName}] -> [${targetName}] (+${totalBonus} ${cat.typeName})`);
        } else {
          console.log(`  💊 [Bồi Dưỡng ${cat.typeName}] Đã dùng x${count} [${propName}] cho [${targetName}] (+${totalBonus} ${cat.typeName})`);
        }
      }
    }

    return totalUsed;
  }
}

module.exports = HelperService;
