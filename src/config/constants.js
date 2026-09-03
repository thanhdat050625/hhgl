/**
 * Bảng tra cứu tên vật phẩm tiếng Việt và hằng số game
 */
const PROP_NAMES = {
  // Đan dược thuộc tính
  10001: 'Sách Võ Lực',
  10002: 'Sách Trí Lực',
  10003: 'Sách Chính Trị',
  10004: 'Sách Mị Lực',
  10029: 'Kinh Nghiệm Đan',
  10030: 'Tầm Bảo Lệnh',
  12001: 'Tư Chất Đan Võ Lực',
  12002: 'Tư Chất Đan Trí Lực',
  12003: 'Tư Chất Đan Chính Trị',
  12004: 'Tư Chất Đan Mị Lực',
  12005: 'Tư Chất Đan Binh Lực',
  12006: 'Tư Chất Đan Toàn Năng',
  12007: 'Tư Chất Đan Võ',
  12008: 'Tư Chất Đan Trí',
  12009: 'Tư Chất Đan Chính',
  12010: 'Tư Chất Đan Mị',
  12011: 'Tư Chất Đan Binh',
  // Túi tài nguyên
  10005: 'Túi Bạc Nhỏ',
  10006: 'Túi Bạc Vừa',
  10007: 'Túi Bạc Lớn',
  10011: 'Bao Lương Thực',
  10012: 'Bao Binh Lực',
  10021: 'Lá Kim',
  10022: 'Lá Ngân',
  10023: 'Túi Bạc',
  10024: 'Bao Lương Thực'
};

const CONFIG = {
  LOGIN_URL: process.env.GAME_LOGIN_URL || 'https://h5s3.52look.com/apis/h5/normalLogin',
  CHECK_AUTH_URL: process.env.GAME_CHECK_AUTH_URL || 'https://yxgl-sdk.muugamevn.com/logincheck/check/hhjxA1/muyou_h5/V3_0',
  GATEWAY_WS_URL: process.env.GAME_GATEWAY_WS_URL || 'wss://yxgl-login.52look.com:6868',
  ORIGIN_CDN: process.env.GAME_ORIGIN_CDN || 'https://yxgl-cdn.52look.com',
  GAME_ID: process.env.GAME_ID || '15',
  GAME_SIMPLE_NAME: 'hhjxA1',
  SDK_SIMPLE_NAME: 'muyou_h5',
  SDK_VERSION_CODE: 'V3_0',
  CHANNEL: 'MYnew_h501',
  CLIENT_VERSION: 58404,
  DEVICE_OS: 'Win32'
};

module.exports = {
  PROP_NAMES,
  CONFIG
};
