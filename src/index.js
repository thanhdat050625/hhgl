require('dotenv').config();
const http = require('http');

const { EncryptHelper, loginGame, authenticateSdk, getGatewayAuth } = require('./core');
const { GameClient } = require('./bot');
const { UI } = require('./runners');

const DashboardServer = require('./server/DashboardServer');

// Khởi động Web Dashboard Server
if (process.env.PORT || process.argv.includes('--dashboard')) {
  DashboardServer.start(process.env.PORT || 10000);
}

async function main() {
  const io = UI.createPrompt();
  const encryptHelper = new EncryptHelper();

  try {
    UI.printBanner();

    let email = (process.argv[2] || process.env.GAME_EMAIL || '').trim();
    let password = (process.argv[3] || process.env.GAME_PASSWORD || '').trim();
    let serverParam = (process.argv[4] || process.env.GAME_SERVER_ID || '').trim();
    let actionParam = (process.argv[5] || process.env.GAME_ACTION || '').trim();

    if (!email) {
      email = await io.ask('-> Nhập Email đăng nhập: ');
      email = email.trim();
    }
    if (!password) {
      password = await io.ask('-> Nhập Mật khẩu: ');
      password = password.trim();
    }

    console.log(`[1] Đang xác thực tài khoản ${email}...`);
    const loginUrl = await loginGame(email, password);

    console.log('[2] Đang xác thực SDK Game...');
    const sdkAuth = await authenticateSdk(loginUrl);

    console.log('[3] Đang kết nối Gateway...');
    const { gateId, rcode, serverList, myServerList } = await getGatewayAuth(sdkAuth, encryptHelper);

    let chosenServer = null;
    if (serverParam) {
      console.log(`-> Tự động chọn server theo tham số: ${serverParam}`);
      const paramNum = parseInt(serverParam);
      if (paramNum > 0 && paramNum <= myServerList.length) {
        chosenServer = myServerList[paramNum - 1];
      } else {
        chosenServer = serverList.find(s => s.serverId === paramNum) || myServerList.find(s => s.serverId === paramNum);
      }
    }

    if (!chosenServer) {
      if (myServerList && myServerList.length > 0) {
        UI.printPlayedServers(myServerList);
        while (!chosenServer) {
          const ans = await io.ask(`-> Chọn Server đã chơi [1..${myServerList.length}], nhập Server ID (vd: 1105) hoặc gõ 'A' để xem tất cả: `);
          const input = ans.trim().toLowerCase();

          if (input === 'a' || input === 'all' || input === 'tatca') {
            UI.printAllServers(serverList);
            const allAns = await io.ask(`-> Nhập Server ID muốn kết nối (vd: ${serverList[0]?.serverId || 1001}..${serverList[serverList.length - 1]?.serverId || 1105}): `);
            const sId = parseInt(allAns.trim());
            chosenServer = serverList.find(s => s.serverId === sId) || myServerList.find(s => s.serverId === sId);
            if (!chosenServer) {
              console.log('[!] Không tìm thấy Server ID vừa nhập. Vui lòng thử lại.');
            }
          } else {
            const num = parseInt(input);
            if (!isNaN(num)) {
              if (num > 0 && num <= myServerList.length) {
                chosenServer = myServerList[num - 1];
              } else {
                chosenServer = serverList.find(s => s.serverId === num) || myServerList.find(s => s.serverId === num);
              }
            }
            if (!chosenServer) {
              console.log('[!] Lựa chọn không hợp lệ. Vui lòng nhập số thứ tự [1..' + myServerList.length + '], Server ID hoặc gõ A.');
            }
          }
        }
      } else {
        UI.printAllServers(serverList);
        while (!chosenServer) {
          const ans = await io.ask('-> Nhập Server ID muốn kết nối (ví dụ: 1001, 1105): ');
          const sId = parseInt(ans.trim());
          chosenServer = serverList.find(s => s.serverId === sId);
          if (!chosenServer) {
            console.log('[!] Không tìm thấy Server ID vừa nhập. Vui lòng thử lại.');
          }
        }
      }
    }

    if (!chosenServer) {
      console.log('[X] Không tìm thấy thông tin Server. Vui lòng thử lại.');
      io.close();
      process.exit(1);
    }

    console.log(`\nKết nối vào Server: ${chosenServer.serverId} - ${chosenServer.serverName || chosenServer.name || ''}`);

    const client = new GameClient(chosenServer, rcode, gateId, encryptHelper);
    
    // Gắn client vào Dashboard (Nếu Dashboard đang chạy)
    if (global.dashboardServer) {
      global.dashboardServer.setClient(client);
    }

    // Xử lý ngắt tiến trình an toàn (Ctrl + C)
    const handleExit = () => {
      console.log('\n[-] Đang ngắt kết nối an toàn...');
      client.close();
      io.close();
      process.exit(0);
    };
    process.once('SIGINT', handleExit);
    process.once('SIGTERM', handleExit);

    await client.connect();

    // Chờ nhận đủ dữ liệu ban đầu
    while (!client.isReady) {
      await new Promise(r => setTimeout(r, 200));
    }

    UI.printPlayerInfo(client.playerData, client);

    // Vòng lặp Menu Tương Tác
    while (true) {
      let opt = '';
      if (actionParam) {
        opt = actionParam.trim();
        if (opt.toLowerCase() !== 'auto' && opt !== '1') {
          actionParam = null; // Chỉ giữ actionParam liên tục nếu là chế độ auto/1
        }
      } else {
        UI.printMenu(client.playerData);
        try {
          const choice = await io.ask('-> Nhập lựa chọn [1 | 0 | auto]: ');
          opt = choice.trim();
        } catch (e) {
          console.log('\n[-] Luồng nhập liệu kết thúc.');
          break;
        }
      }

      switch (opt.toLowerCase()) {
        case '1':
        case 'auto':
        case '3.1':
        case '3,1':
          await client.trade.autoDailyLoopContinuous();
          break;
        case '0':
          console.log('\n[Thoát] Đang ngắt kết nối và thoát game. Hẹn gặp lại!');
          client.close();
          io.close();
          process.exit(0);
        default:
          console.log('[!] Lựa chọn không hợp lệ. Vui lòng chọn lại [1 | 0 | auto].');
          break;
      }
    }
  } catch (err) {
    console.error('\n[X] Đã xảy ra lỗi:', err.message || err);
    io.close();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
