/**
 * UI Helper: Hiển thị giao diện Terminal, Bảng thông tin nhân vật và Menu điều khiển
 */

const readline = require('readline');

class UI {
  static printBanner() {
    console.log('================================================================');
    console.log('--- HOÀNG HẬU CÁT TƯỜNG - AUTO BOT CHƠI GAME TỰ ĐỘNG ---');
    console.log('================================================================');
  }

  static printHeader() {
    UI.printBanner();
  }

  static printPlayedServers(myServerList) {
    console.log('\n================================================================');
    console.log('[DANH SÁCH SERVER BẠN ĐÃ TỪNG CHƠI (ĐÃ CÓ NHÂN VẬT)]:');
    console.log('================================================================');
    myServerList.forEach((s, idx) => {
      const status = s.status === 1 ? '[Tốt]' : (s.status === 2 ? '[Đông]' : '[Đầy]');
      console.log(`  [${idx + 1}] Server ${s.serverId}: ${s.serverName || s.name || ''} | Trạng thái: ${status}`);
    });
    console.log('----------------------------------------------------------------');
    console.log('  [A] Hiển thị toàn bộ tất cả Server khác trong Game');
    console.log('================================================================\n');
  }

  static printAllServers(serverList) {
    console.log('\n================================================================');
    console.log(`[TOÀN BỘ DANH SÁCH TẤT CẢ SERVER GAME (TỔNG CỘNG: ${serverList.length} SERVER)]:`);
    console.log('================================================================');
    
    // In danh sách dạng cột đôi hoặc từng dòng rõ ràng
    for (let i = 0; i < serverList.length; i += 2) {
      const s1 = serverList[i];
      const s2 = serverList[i + 1];

      const st1 = s1.status === 1 ? '[Tốt]' : (s1.status === 2 ? '[Đông]' : '[Đầy]');
      const text1 = `[ID ${String(s1.serverId).padEnd(4)}] ${st1} ${(s1.serverName || s1.name || '').padEnd(16)}`;

      let text2 = '';
      if (s2) {
        const st2 = s2.status === 1 ? '[Tốt]' : (s2.status === 2 ? '[Đông]' : '[Đầy]');
        text2 = `  |  [ID ${String(s2.serverId).padEnd(4)}] ${st2} ${(s2.serverName || s2.name || '').padEnd(16)}`;
      }

      console.log(`  ${text1}${text2}`);
    }
    console.log('================================================================\n');
  }

  static printServerList(serverList, myServerList) {
    if (myServerList && myServerList.length > 0) {
      UI.printPlayedServers(myServerList);
    } else {
      UI.printAllServers(serverList);
    }
  }

  static printPlayerInfo(playerData, client = null) {
    const { getLevelInfo } = require('../config');
    const lvlInfo = getLevelInfo(playerData.lv);
    const posName = lvlInfo.name || `Cấp ${playerData.lv}`;
    const maxExp = lvlInfo.maxExp || 0;
    const curExp = playerData.exp || 0;
    const expPercent = maxExp > 0 ? ` (${((curExp / maxExp) * 100).toFixed(1)}%)` : '';

    console.log('\n======================================================');
    console.log('[THÔNG TIN NHÂN VẬT & TÀI NGUYÊN HIỆN TẠI]:');
    console.log('======================================================');
    console.log(`- Tên nhân vật    : ${playerData.name}`);
    console.log(`- Player ID       : ${playerData.playerId}`);
    console.log(`- Tước vị         : ${posName} (Lv.${playerData.lv})`);
    console.log(`- Cung Vận        : ${curExp.toLocaleString()} / ${maxExp.toLocaleString()} EXP${expPercent}`);
    console.log(`- Cấp VIP         : VIP ${playerData.vip}`);
    console.log(`- Thế Lực         : ${playerData.power.toLocaleString()}`);
    console.log(`- Vàng (Gold)     : ${playerData.gold.toLocaleString()}`);
    console.log(`- Bạc (Silver)    : ${playerData.silver.toLocaleString()}`);
    console.log(`- Lương thực      : ${playerData.food.toLocaleString()}`);
    console.log(`- Binh lực        : ${playerData.soldier.toLocaleString()}`);

    if (client) {
      console.log('------------------------------------------------------');
      console.log('[TRẠNG THÁI & THỜI GIAN HỒI PHỤC (COOLDOWNS)]:');

      // 1. Nội Vụ
      const maxTrade = Math.min(30, Math.max(3, 2 + playerData.lv));
      const tradeList = client.tradeInfoList || [];
      const t1 = tradeList.find(x => x.type === 1);
      const t2 = tradeList.find(x => x.type === 2);
      const t3 = tradeList.find(x => x.type === 3);

      const num1 = t1 ? Number(t1.num) : 0;
      const num2 = t2 ? Number(t2.num) : 0;
      const num3 = t3 ? Number(t3.num) : 0;

      const cd1 = t1 ? Number(t1.time) || 0 : 0;
      const cd2 = t2 ? Number(t2.time) || 0 : 0;
      const cd3 = t3 ? Number(t3.time) || 0 : 0;

      const { formatDuration } = require('../core/protocol');
      console.log(`[Nội Vụ - Từ Thiện]   : ${num1}/${maxTrade} lượt ${num1 < maxTrade ? `(Hồi lượt sau: ${formatDuration(cd1)})` : '(Đầy lượt)'}`);
      console.log(`[Nội Vụ - Vườn Thuốc] : ${num2}/${maxTrade} lượt ${num2 < maxTrade ? `(Hồi lượt sau: ${formatDuration(cd2)})` : '(Đầy lượt)'}`);
      console.log(`[Nội Vụ - Bổ Khí]     : ${num3}/${maxTrade} lượt ${num3 < maxTrade ? `(Hồi lượt sau: ${formatDuration(cd3)})` : '(Đầy lượt)'}`);

      // 2. Cung Vụ
      const maxWork = Math.min(30, Math.max(3, 2 + playerData.lv * 2));
      const workCount = (client.workList || []).length;
      const rawWorkTime = client.workRefreshTime || 0;
      const workCd = rawWorkTime > 10000000 ? Math.max(0, Math.floor(rawWorkTime - Date.now() / 1000)) : rawWorkTime;
      console.log(`[Cung Vụ - Sự Vụ]    : ${workCount}/${maxWork} sự vụ ${workCount < maxWork ? `(Hồi sự vụ sau: ${formatDuration(workCd)})` : '(Đầy sự vụ)'}`);

      // 3. Tùy Tùng
      const helperCount = (client.helperInfoList || []).length;
      console.log(`[Tùy Tùng]           : ${helperCount} Tùy Tùng đang xuất chiến`);
    }

    console.log('======================================================');
  }

  static printMenu(playerData) {
    console.log('\n----------------------------------------------------------------');
    console.log('MENU TỰ ĐỘNG CHƠI GAME (100% LIVE SERVER SYNC):');
    console.log(' [1]  [Auto 24/7] Treo Máy Toàn Diện (Phúc Lợi, Nội Vụ, Cung Vụ & Tùy Tùng)');
    console.log(' [0]  Thoát game');
    console.log('----------------------------------------------------------------');
  }

  static createPrompt() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return {
      ask: (question) => new Promise(resolve => rl.question(question, resolve)),
      close: () => rl.close()
    };
  }
}

module.exports = UI;
