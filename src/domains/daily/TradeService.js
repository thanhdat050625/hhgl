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
            console.log(`  - ${r.name}: Đã thu hoạch ${r.amountText}${countStr} (Hồi sau: ${formatDuration(r.timeSec)})`);
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
        console.log(`[${timeStr}] [Nội Vụ] Thu hoạch thành công: ${desc}`);
      }
    }

    return { totalTradeHarvested, results };
  }

  /**
   * Chế độ Auto Vòng Lặp 24/7: Tự động canh hồi lượt Nội Vụ, Cung Vụ, Phúc Lợi & Bồi Dưỡng Tùy Tùng
   */
  async autoDailyLoopContinuous() {
    console.log('\n================================================================');
    console.log('--- BẮT ĐẦU CHẾ ĐỘ AUTO 24/7 TOÀN DIỆN (PHÚC LỢI, NỘI VỤ & TÙY TÙNG) ---');
    console.log('[*] Tự động quét sạch Phúc Lợi 5 Tab, Hộp Thư, 7 Ngày & Thành Tựu');
    console.log('[*] Tự động cắn Đan Dược, đọc Thư Tùy Tùng, nâng cấp Lực Chiến & Thư Viện');
    console.log('[*] 100% Realtime Event-Driven canh hồi lượt & nhận thưởng liên tục');
    console.log('[!] Bấm [Ctrl + C] bất cứ lúc nào để dừng vòng lặp');
    console.log('================================================================\n');

    // 1. Quét sạch Phúc Lợi, Thư, 7 Ngày, Thành Tựu (Menu 1)
    if (this.client.welfare) await this.client.welfare.autoClaimAll();
    if (this.client.mail) await this.client.mail.autoClaimAndClean();
    if (this.client.sevenGoalService) await this.client.sevenGoalService.claimAllSevenGoals();
    if (this.client.achievementService) await this.client.achievementService.claimAllAchievements();
    if (this.client.rankService) await this.client.rankService.likeAllRanks();
    if (this.client.palace) await this.client.palace.autoPalaceHi();
    if (this.client.quest) await this.client.quest.autoClaimAll();
    if (this.client.prison) await this.client.prison.autoHitAllPrisoners();
    if (this.client.wife) await this.client.wife.autoCallAllWives(true);

    if (this.client.bagService) await this.client.bagService.useAllGrowthItems();
    if (this.client.chestOpen) await this.client.chestOpen.openGoldAndCungVanChests(true);
    if (this.client.helper) {
      await this.client.helper.readAllHelperLetters();
      await this.client.helper.autoUpgradeAptitudes();
      await this.client.helper.autoPromoteHelpers();
      await this.client.helper.autoCultivateHelpers();
      await this.client.helper.autoLevelUpHelpers();
    }
    if (this.client.academy) await this.client.academy.autoStudy();

    // 3. Thu hoạch đợt đầu Nội Vụ & Cung Vụ (Menu 2)
    await this.autoHarvestAll(true);
    if (this.client.affair) {
      await this.client.affair.autoHandleAffairs(true);
      if (this.client.level) await this.client.level.autoLevelUp(true);
    }

    // 4. Vượt Ải Cốt Truyện & Giáo Huấn Đại Lý Tự đợt đầu
    if (this.client.stage) {
      const sWins = await this.client.stage.autoBattleContinuous(10, true);
      if (sWins > 0 && this.client.prison) {
        await this.client.prison.autoHitAllPrisoners(true);
      }
    }

    // 5. Sự Kiện Hoa Đăng Chúc Phúc & Tích Điểm Hạn Giờ
    if (this.client.hoaDang) await this.client.hoaDang.autoPlayHoaDang(true);
    if (this.client.eventRankPoint) await this.client.eventRankPoint.autoClaimAllEventRewards(true);

    let lastOnlineCheck = Date.now();
    let lastBagCheck = Date.now();
    let lastEventCheck = Date.now();
    let lastMemoryCleanCheck = Date.now();

    while (!this.client.isManualClosed) {
      // Luôn sleep 1s trong mỗi vòng lặp đếm ngược để CPU luôn ở mức 0%
      await new Promise(r => setTimeout(r, 1000));
      if (this.client.isManualClosed) break;

      // Nếu đang mất kết nối mạng hoặc đang tự động kết nối lại
      if (!this.client.isReady) {
        process.stdout.write('\r[Treo Máy 24/7] Mất kết nối Game Server, đang chờ tự động kết nối lại...     ');
        continue;
      }

      // 0. Tự động nhận diện BƯỚC SANG NGÀY MỚI (00:00:00 hoặc chuyển ngày)
      const todayStr = new Date().toLocaleDateString('vi-VN');
      const isDayChanged = (this.client.lastActiveDateStr !== todayStr) || this.client.isNewDay;
      if (isDayChanged) {
        this.client.lastActiveDateStr = todayStr;
        this.client.isNewDay = false;
        this.client.allOnlineRewardsClaimed = false;

        const timeStr = new Date().toLocaleTimeString('vi-VN');
        console.log(`\n================================================================`);
        console.log(`[${timeStr}] 🌅 BƯỚC SANG NGÀY MỚI (${todayStr})!`);
        console.log('[*] Tự động kích hoạt chu trình Phúc Lợi & Quà tặng ngày mới...');
        console.log('================================================================\n');

        // Quét sạch Menu 1 ngày mới
        if (this.client.welfare) await this.client.welfare.autoClaimAll();
        if (this.client.mail) await this.client.mail.autoClaimAndClean();
        if (this.client.sevenGoalService) await this.client.sevenGoalService.claimAllSevenGoals();
        if (this.client.achievementService) await this.client.achievementService.claimAllAchievements();
        if (this.client.rankService) await this.client.rankService.likeAllRanks();
        if (this.client.palace) await this.client.palace.autoPalaceHi();
        if (this.client.quest) await this.client.quest.autoClaimAll();
        if (this.client.prison) await this.client.prison.autoHitAllPrisoners();
        if (this.client.wife) await this.client.wife.autoCallAllWives(true);

        // Cắn đan dược mới và đọc thư mới nếu có
        if (this.client.bagService) await this.client.bagService.useAllGrowthItems();
        if (this.client.chestOpen) await this.client.chestOpen.openGoldAndCungVanChests(true);
        if (this.client.helper) {
          await this.client.helper.readAllHelperLetters();
          await this.client.helper.autoUpgradeAptitudes();
          await this.client.helper.autoPromoteHelpers(true);
          await this.client.helper.autoCultivateHelpers(true);
        }

        // Reset lượt Tùy Tùng đánh Boss & Vượt ải ngày mới
        if (this.client.stage) {
          this.client.stage.resetDaily();
          const sWins = await this.client.stage.autoBattleContinuous(10, true);
          if (sWins > 0 && this.client.prison) {
            await this.client.prison.autoHitAllPrisoners(true);
          }
        }

        // Reset và chạy lại Hoa Đăng Chúc Phúc (mua 20 đèn Bạc ngày mới) & Sự Kiện Tích Điểm
        if (this.client.hoaDang) {
          this.client.hoaDang.resetDaily();
          await this.client.hoaDang.autoPlayHoaDang(true);
        }
        if (this.client.eventRankPoint) await this.client.eventRankPoint.autoClaimAllEventRewards(true);
      }

      // A. Bắt sự kiện Realtime 7 Ngày Vui Vẻ (Gói 162205 ResSevenGoalTaskComplete)
      if (this.client.hasNewSevenGoal && this.client.sevenGoalService) {
        this.client.hasNewSevenGoal = false;
        await this.client.sevenGoalService.claimAllSevenGoals(true);
      }

      // B. Bắt sự kiện Realtime Thành Tựu (Gói 125404/125405 ResNewAchievementRedPoint)
      if (this.client.hasNewAchievement && this.client.achievementService) {
        this.client.hasNewAchievement = false;
        await this.client.achievementService.claimAllAchievements(true);
      }

      // C. Bắt sự kiện Realtime Hộp Thư Mới (Gói 117206 ResHasNewMail)
      if (this.client.hasNewMail && this.client.mail) {
        this.client.hasNewMail = false;
        await this.client.mail.autoClaimAndClean(true);
      }

      // D. Định kỳ mỗi 5 phút: Check Thưởng Online (chỉ check khi chưa nhận đủ 120 phút) & Quét Thư
      if (Date.now() - lastOnlineCheck >= 300000) {
        lastOnlineCheck = Date.now();
        if (!this.client.allOnlineRewardsClaimed && this.client.welfare) {
          await this.client.welfare.checkAndClaimOnlineReward(true);
        }
        if (this.client.mail) await this.client.mail.autoClaimAndClean(true);
      }

      // E. Định kỳ mỗi 15 phút: Quét túi mở các Rương Vàng / Cung Vận / Đan Dược mới rơi
      if (Date.now() - lastBagCheck >= 900000) {
        lastBagCheck = Date.now();
        if (this.client.bagService) await this.client.bagService.useAllGrowthItems();
        if (this.client.chestOpen) await this.client.chestOpen.openGoldAndCungVanChests(true);
        if (this.client.level) await this.client.level.autoLevelUp(true);
      }

      // F. Định kỳ mỗi 30 phút: Kiểm tra Hoa Đăng & Sự Kiện Tích Điểm (nếu có đèn mới hoặc quà mốc mới)
      if (Date.now() - lastEventCheck >= 1800000) {
        lastEventCheck = Date.now();
        if (this.client.hoaDang) await this.client.hoaDang.autoPlayHoaDang(true);
        if (this.client.eventRankPoint) await this.client.eventRankPoint.autoClaimAllEventRewards(true);
      }

      // G. Bảo vệ RAM 24/7 (Memory Leak Guard - Dọn dẹp mỗi 1 giờ)
      if (Date.now() - lastMemoryCleanCheck >= 3600000) {
        lastMemoryCleanCheck = Date.now();
        if (Array.isArray(this.client.recentProps) && this.client.recentProps.length > 20) {
          this.client.recentProps.splice(0, this.client.recentProps.length - 20);
        }
        if (global.gc) {
          try { global.gc(); } catch (_) {}
        }
      }

      // H. Realtime Học Viện (Thư Viện): Canh chính xác đúng giây tốt nghiệp (0 giây delay)!
      if (this.client.academy && Date.now() >= (this.client.academyNextReadyTime || 0)) {
        await this.client.academy.autoStudy(true);
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
          await this.client.helper.autoCultivateHelpers(true);
          const lvUps = await this.client.helper.autoLevelUpHelpers(0, 0, true);
          // Nếu tùy tùng lên cấp -> quét nhanh Thành Tựu, 7 Ngày & Nhiệm vụ ngay lập tức!
          if (lvUps > 0) {
            if (this.client.achievementService) await this.client.achievementService.claimAllAchievements(true);
            if (this.client.sevenGoalService) await this.client.sevenGoalService.claimAllSevenGoals(true);
            if (this.client.quest) await this.client.quest.autoClaimAll();
          }
        }

        // Sau khi thu hoạch Bổ Khí có Binh Lực mới -> Tự động Vượt Ải Cốt Truyện & Giáo Huấn Đại Lý Tự (nếu chưa bị chặn hôm nay)
        if (this.client.stage && !this.client.stage.stageBlockedToday) {
          const sWins = await this.client.stage.autoBattleContinuous(5, true);
          if (sWins > 0) {
            if (this.client.quest) await this.client.quest.autoClaimAll();
            if (this.client.achievementService) await this.client.achievementService.claimAllAchievements(true);
            if (this.client.prison) await this.client.prison.autoHitAllPrisoners(true);
          }
        }
      }

      // 2. Nếu có Sự Vụ sẵn sàng
      if (shouldHandleAffairs && this.client.affair) {
        if (process.stdout.isTTY && !process.env.PORT && !process.argv.includes('--dashboard')) {
          process.stdout.write(`\r                                                                                                    \r`);
        }
        await this.client.affair.autoHandleAffairs(true);
        // Tự động kiểm tra và thăng chức tước vị ngay khi đủ Cung Vận!
        if (this.client.level) {
          await this.client.level.autoLevelUp(true);
        }
        // Kiểm tra nhận nhiệm vụ nếu có mốc hoàn thành
        if (this.client.quest) {
          await this.client.quest.autoClaimAll();
        }
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
