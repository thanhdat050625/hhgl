require('dotenv').config();

// Tra cứu tên vật phẩm tiếng Việt và hằng số game
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

function getRequiredEnv(key) {
  const val = process.env[key];
  if (val === undefined || val === null || val === '') {
    throw new Error(`[CONFIG ERROR] Biến môi trường '${key}' bắt buộc phải được khai báo trong .env!`);
  }
  return val;
}

function getRequiredIntEnv(key) {
  const val = getRequiredEnv(key);
  const num = parseInt(val, 10);
  if (isNaN(num)) {
    throw new Error(`[CONFIG ERROR] Biến môi trường '${key}' phải là số nguyên hợp lệ, nhận được: '${val}'`);
  }
  return num;
}

const CONFIG = {
  LOGIN_URL: getRequiredEnv('GAME_LOGIN_URL'),
  CHECK_AUTH_URL: getRequiredEnv('GAME_CHECK_AUTH_URL'),
  GATEWAY_WS_URL: getRequiredEnv('GAME_GATEWAY_WS_URL'),
  ORIGIN_CDN: getRequiredEnv('GAME_ORIGIN_CDN'),
  GAME_ID: getRequiredEnv('GAME_ID'),
  GAME_SIMPLE_NAME: getRequiredEnv('GAME_SIMPLE_NAME'),
  SDK_SIMPLE_NAME: getRequiredEnv('GAME_SDK_SIMPLE_NAME'),
  SDK_VERSION_CODE: getRequiredEnv('GAME_SDK_VERSION_CODE'),
  CHANNEL: getRequiredEnv('GAME_CHANNEL'),
  CLIENT_VERSION: getRequiredIntEnv('GAME_CLIENT_VERSION'),
  DEVICE_OS: getRequiredEnv('GAME_DEVICE_OS'),
  DEFAULT_SERVER_ID: getRequiredIntEnv('GAME_SERVER_ID')
};

module.exports = {
  PROP_NAMES,
  CONFIG
};

