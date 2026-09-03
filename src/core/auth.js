/**
 * Core Auth Module: H5 Login, SDK Authentication, and Gateway Handshake
 */

const WebSocket = require('ws');
const { CONFIG } = require('../config');
const { encodeMsg, decodeBuffer } = require('./protocol');

/**
 * Bước 1: Đăng nhập H5 Portal lấy login_url
 */
async function loginGame(username, password) {
  const body = new URLSearchParams({
    game_id: CONFIG.GAME_ID,
    username: username,
    passwd: password
  });

  const res = await fetch(CONFIG.LOGIN_URL, {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
  });

  const json = await res.json();
  if (json.code !== 200 && (!json.data || !json.data.login_url)) {
    throw new Error(json.msg || 'Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu!');
  }
  return json.data.login_url;
}

/**
 * Bước 2: Xác thực SDK Token
 */
async function authenticateSdk(loginUrlStr) {
  const loginUrl = new URL(loginUrlStr);
  const username = loginUrl.searchParams.get('username');
  const userid = loginUrl.searchParams.get('userid');
  const times = loginUrl.searchParams.get('times');
  const sign = loginUrl.searchParams.get('sign');

  const checkData = {
    gameSimpleName: CONFIG.GAME_SIMPLE_NAME,
    sdkSimpleName: CONFIG.SDK_SIMPLE_NAME,
    sdkVersionCode: CONFIG.SDK_VERSION_CODE,
    timestamp: times,
    other: JSON.stringify({
      game_id: CONFIG.GAME_ID,
      username,
      userid,
      times,
      sign
    }),
    ot: CONFIG.DEVICE_OS
  };

  const res = await fetch(CONFIG.CHECK_AUTH_URL, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(JSON.stringify(checkData)),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
  });

  const json = await res.json();
  if (json.code !== 1 && !json.serverSign) {
    throw new Error(json.message || json.msg || 'Xác thực SDK thất bại!');
  }
  return json;
}

/**
 * Bước 3: Bắt tay Gateway WebSocket và lấy Server List, Rcode, GateId
 */
function getGatewayAuth(sdkAuth, encryptHelper) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(CONFIG.GATEWAY_WS_URL, {
      headers: { Origin: CONFIG.ORIGIN_CDN },
      rejectUnauthorized: true
    });

    let autoId = 1;
    let gateId = 1;
    let rcode = '';
    let serverList = [];
    let myServerList = [];

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      ws.send(encodeMsg(202106, { step: 1, value: encryptHelper.getSelfSalt() }, autoId++));
    };

    ws.onmessage = (evt) => {
      const pkts = decodeBuffer(Buffer.from(evt.data));
      for (const pkt of pkts) {
        if (pkt.msgId === 202206 && pkt.data.step === 1) {
          const checkKey = encryptHelper.getCheckKey(pkt.data.value);
          ws.send(encodeMsg(202106, { step: 2, value: checkKey }, autoId++));
        } else if (pkt.msgId === 202206 && pkt.data.step === 2) {
          gateId = pkt.data.value;
          ws.send(encodeMsg(202105, {
            userType: sdkAuth.userType.toString(),
            openId: sdkAuth.openId.toString(),
            timestamp: sdkAuth.timestamp.toString(),
            serverSign: sdkAuth.serverSign,
            channel: CONFIG.CHANNEL
          }, autoId++));
        } else if (pkt.msgId === 202201) {
          rcode = pkt.data.rcode;
          ws.send(encodeMsg(202104, { channel: CONFIG.CHANNEL }, autoId++));
        } else if (pkt.msgId === 202203) {
          myServerList = pkt.data.serverInfoList || [];
        } else if (pkt.msgId === 202204) {
          serverList = pkt.data.serverInfoList || [];
          ws.close();
          resolve({ gateId, rcode, serverList, myServerList });
        }
      }
    };

    ws.onerror = (err) => {
      reject(err);
    };
  });
}

module.exports = {
  loginGame,
  authenticateSdk,
  getGatewayAuth
};
