/**
 * Trade Service: Sắp Xếp Nội Vụ (Từ Thiện, Vườn Thuốc, H.Y Bổ Khí)
 */

const BaseService = require('../base/BaseService');
const { formatDuration } = require('../../core/protocol');

class TradeService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'trade',
      domain: 'daily',
      name: '[Nội Vụ] Sắp Xếp Nội Vụ (Từ Thiện, Vườn Thuốc, Bổ Khí)',
      menuOption: 2,
      listenedMsgIds: [102206]
    });
  }

  async execute() {
    return this.autoHarvestAll();
  }

  async autoHarvestAll(isLoop = false) {
    const maxCap = Math.min(30, Math.max(3, 2 + this.playerData.lv));
    const tradeTypes = [
      { type: 1, name: 'Từ Thiện (Thu Bạc)', short: 'Từ Thiện', rewardName: 'Bạc', attrId: 102, resKey: 'silver' },
      { type: 2, name: 'Vườn Thuốc (Thu T.Dược)', short: 'Vườn Thuốc', rewardName: 'Thảo Dược', attrId: 103, resKey: 'food' },
      { type: 3, name: 'H.Y Bổ Khí (Thu Binh Lực)', short: 'Bổ Khí', rewardName: 'Binh Lực', attrId: 104, resKey: 'soldier' }
    ];

    let totalTradeHarvested = 0;
    const results = [];

    for (const t of tradeTypes) {
      let item = (this.client.tradeInfoList || []).find(x => x.type === t.type);
      if (!item) {
        item = { type: t.type, num: 0, time: 60, updatedAt: Date.now() };
        this.client.tradeInfoList.push(item);
      }

      let curNum = Number(item.num) || 0;
      let timeSec = Number(item.time) || 0;
      if (item.updatedAt) {
        const elapsed = Math.floor((Date.now() - item.updatedAt) / 1000);
        timeSec = Math.max(0, timeSec - elapsed);
      }

      // Nếu đã hết thời gian đếm ngược (timeSec = 0) và chưa đầy, coi như đã hồi ít nhất 1 lượt
      if (curNum <= 0 && timeSec === 0) {
        curNum = 1;
      }

      if (curNum <= 0) {
        results.push({ name: t.name, short: t.short, rewardName: t.rewardName, amountText: t.rewardName, gainedAmount: 0, harvested: 0, curNum: 0, timeSec });
        continue;
      }

      const prevRes = Number(this.playerData[t.resKey]) || 0;
      let harvestTries = 0;
      while (harvestTries < curNum && harvestTries < maxCap) {
        harvestTries++;
        this.client.lastReturnCode = null;
        this.send(102101, { type: t.type });
        await this.sleepRandom(0.8, 1.3);

        if (this.client.lastReturnCode && this.client.lastReturnCode.reqId === 102101 && this.client.lastReturnCode.code !== 0) {
          harvestTries--;
          break;
        }

        totalTradeHarvested++;
      }

      item.num = Math.max(0, curNum - harvestTries);
      if (item.num === 0) {
        item.time = 60; // Đặt lại 60 giây chờ hồi lượt tiếp theo
      }
      item.updatedAt = Date.now();

      const curRes = Number(this.playerData[t.resKey]) || 0;
      let gainedAmount = curRes > prevRes ? (curRes - prevRes) : 0;
      if (gainedAmount === 0 && harvestTries > 0) {
        const baseAttr = (this.playerData.attrMap && this.playerData.attrMap[t.attrId]) || 0;
        gainedAmount = baseAttr * harvestTries;
      }

      const amountText = gainedAmount > 0 ? `+${gainedAmount.toLocaleString('vi-VN')} ${t.rewardName}` : t.rewardName;
      results.push({
        name: t.name,
        short: t.short,
        rewardName: t.rewardName,
        amountText,
        gainedAmount,
        harvested: harvestTries,
        curNum: item.num,
        timeSec: item.time
      });
    }

    if (!isLoop) {
      console.log('[Nội Vụ]');
      if (totalTradeHarvested === 0) {
        const cdSummary = results.map(r => `${r.short}: ${formatDuration(r.timeSec)}`).join(' | ');
        console.log(`  [-] Đã hết lượt thu hoạch (${cdSummary})`);
      } else {
        results.forEach(r => {
          if (r.harvested > 0) {
            const countStr = r.harvested > 1 ? ` (x${r.harvested})` : '';
            console.log(`  - ${r.name}: Đã thu hoạch ${r.amountText}${countStr} [OK] (Hồi sau: ${formatDuration(r.timeSec)})`);
          } else {
            console.log(`  - ${r.name}: 0/${maxCap} lượt (Hồi sau: ${formatDuration(r.timeSec)})`);
          }
        });
      }
    } else {
      const activeHarvests = results.filter(r => r.harvested > 0);
      if (activeHarvests.length > 0) {
        const timeStr = new Date().toLocaleTimeString('vi-VN');
        const desc = activeHarvests.map(r => {
          const countStr = r.harvested > 1 ? ` x${r.harvested}` : '';
          return `${r.short} (${r.amountText}${countStr})`;
        }).join(', ');
        console.log(`[${timeStr}] [Nội Vụ] Thu hoạch thành công: ${desc} [OK]`);
      }
    }

    return { totalTradeHarvested, results };
  }

  /**
   * Chế độ Auto Vòng Lặp 24/7: Tự động canh hồi lượt Nội Vụ, Cung Vụ & Bồi Dưỡng Tùy Tùng
   */
  async autoDailyLoopContinuous() {
    console.log('\n================================================================');
    console.log('--- BẮT ĐẦU CHẾ ĐỘ AUTO 24/7 NỘI VỤ, CUNG VỤ & BỒI DƯỠNG TÙY TÙNG ---');
    console.log('[*] Tự động canh hồi lượt, thu hoạch & bồi dưỡng Tùy Tùng liên tục');
    console.log('[!] Bấm [Ctrl + C] bất cứ lúc nào để dừng vòng lặp');
    console.log('================================================================\n');

    // Chạy thu hoạch & bồi dưỡng đợt đầu tiên ngay khi bật Auto
    await this.autoHarvestAll(true);
    if (this.client.affair) {
      await this.client.affair.autoHandleAffairs(true);
    }
    if (this.client.helper) {
      await this.client.helper.autoPromoteHelpers(true);
      await this.client.helper.autoLevelUpHelpers(0, 0, true);
    }

    while (!this.client.isManualClosed) {
      // Luôn sleep 1s trong mỗi vòng lặp đếm ngược để CPU luôn ở mức 0%
      await new Promise(r => setTimeout(r, 1000));
      if (this.client.isManualClosed) break;

      // Nếu đang mất kết nối mạng hoặc đang tự động kết nối lại
      if (!this.client.isReady) {
        process.stdout.write('\r[Treo Máy 24/7] Mất kết nối Game Server, đang chờ tự động kết nối lại...     ');
        continue;
      }

      const maxCap = Math.min(30, Math.max(3, 2 + this.playerData.lv));
      const tradeList = this.client.tradeInfoList || [];
      let shouldHarvestTrade = false;
      let minTradeCd = Infinity;
      let minTradeName = 'Nội Vụ';

      for (let t = 1; t <= 3; t++) {
        let item = tradeList.find(x => x.type === t);
        if (!item) {
          item = { type: t, num: 0, time: 60, updatedAt: Date.now() };
          tradeList.push(item);
        }

        const cur = Number(item.num) || 0;
        let timeSec = Number(item.time) || 0;
        if (item.updatedAt) {
          const elapsed = Math.floor((Date.now() - item.updatedAt) / 1000);
          timeSec = Math.max(0, timeSec - elapsed);
        }

        if (cur > 0 || (cur < maxCap && timeSec === 0)) {
          shouldHarvestTrade = true;
        }

        if (cur < maxCap) {
          if (timeSec < minTradeCd) {
            minTradeCd = timeSec;
            minTradeName = t === 1 ? 'Từ Thiện' : (t === 2 ? 'Vườn Thuốc' : 'Bổ Khí');
          }
        }
      }

      // Kiểm tra Cung Vụ
      const availableWorks = (this.client.workList || []).length;
      let shouldHandleAffairs = availableWorks > 0;
      let affairCd = Infinity;

      if (this.client.workRefreshTime > 0) {
        let rawTime = this.client.workRefreshTime;
        if (rawTime > 10000000) {
          affairCd = Math.max(0, Math.floor(rawTime - Date.now() / 1000));
        } else {
          affairCd = rawTime;
        }
        if (affairCd === 0) {
          shouldHandleAffairs = true;
        }
      }

      // 1. Nếu có lượt Nội Vụ sẵn sàng
      if (shouldHarvestTrade) {
        if (process.stdout.isTTY && !process.env.PORT && !process.argv.includes('--dashboard')) {
          process.stdout.write(`\r                                                                                                    \r`);
        }
        await this.autoHarvestAll(true);

        // Sau khi thu hoạch có Bạc mới -> tự động bồi dưỡng Tùy Tùng
        if (this.client.helper) {
          await this.client.helper.autoPromoteHelpers(true);
          await this.client.helper.autoLevelUpHelpers(0, 0, true);
        }
      }

      // 2. Nếu có Sự Vụ sẵn sàng
      if (shouldHandleAffairs && this.client.affair) {
        if (process.stdout.isTTY && !process.env.PORT && !process.argv.includes('--dashboard')) {
          process.stdout.write(`\r                                                                                                    \r`);
        }
        await this.client.affair.autoHandleAffairs(true);
      }

      // 3. Hiển thị dòng đếm ngược
      if (!shouldHarvestTrade && !shouldHandleAffairs) {
        const tStr = minTradeCd !== Infinity ? `${minTradeName} (${formatDuration(minTradeCd)})` : 'Đã tối đa';
        const aStr = affairCd !== Infinity ? formatDuration(affairCd) : 'Đã tối đa';
        const minWait = Math.min(
          minTradeCd !== Infinity ? minTradeCd : 60,
          affairCd !== Infinity ? affairCd : 60
        );

        const statusMsg = `[Treo Máy 24/7] ${tStr} | [Cung Vụ]: ${aStr} | Chờ: ${formatDuration(minWait)}...`;
        
        // Cập nhật trạng thái lên Web Dashboard
        if (global.dashboardServer) {
          global.dashboardServer.updateStatus(statusMsg);
        }

        // Chỉ in ra console nếu đang chạy ở local (TTY) và KHÔNG trên Cloud (PORT)
        if (process.stdout.isTTY && !process.env.PORT && !process.argv.includes('--dashboard')) {
          process.stdout.write(`\r${statusMsg}   `);
        }
      }
    }
  }
}

module.exports = TradeService;
