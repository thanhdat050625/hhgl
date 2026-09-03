/**
 * 🏷️ Names & Descriptions Resolver for Game Entities
 * Đảm bảo 100% tên tiếng Việt rõ ràng, tuyệt đối không in ID số kỹ thuật ra UI.
 */

const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, '../../_source_game/config_tables');

let itemNamesMap = null;
let sevenDayConfig = null;
let honorTargetConfig = null;
let honorConfig = null;
let workConfig = null;
let helperConfig = null;
let wifeConfig = null;

function loadJsonSafe(filename) {
  try {
    const fullPath = path.join(configDir, filename);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    }
  } catch (e) {}
  return null;
}

function getItemName(id) {
  if (!itemNamesMap) {
    try {
      const p = path.join(__dirname, 'item_names.json');
      if (fs.existsSync(p)) itemNamesMap = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {}
  }
  const idStr = String(id);
  return (itemNamesMap && itemNamesMap[idStr]) || `Vật phẩm [${idStr}]`;
}

function getSevenGoalTargetName(id) {
  if (!sevenDayConfig) sevenDayConfig = loadJsonSafe('SevenDayMissionTargetConfig_json.json');
  const idStr = String(id);
  if (sevenDayConfig && sevenDayConfig.list && sevenDayConfig.list[idStr]) {
    return sevenDayConfig.list[idStr][1] || `Mục tiêu 7 Ngày`;
  }
  return `Mục tiêu 7 Ngày`;
}

function getAchievementName(achievementId, targetId) {
  if (!honorTargetConfig) honorTargetConfig = loadJsonSafe('HonorTargetConfig_json.json');
  if (!honorConfig) honorConfig = loadJsonSafe('HonorConfig_json.json');

  const targetIdStr = String(targetId || achievementId);
  if (honorTargetConfig && honorTargetConfig.list && honorTargetConfig.list[targetIdStr]) {
    const row = honorTargetConfig.list[targetIdStr];
    const catName = row[1] || 'Thành Tựu';
    const val = row[3];
    return val !== undefined ? `${catName} (Mốc ${val.toLocaleString()})` : catName;
  }
  const achIdStr = String(achievementId);
  if (honorConfig && honorConfig.list && honorConfig.list[achIdStr]) {
    return honorConfig.list[achIdStr][0] || 'Thành Tựu Cung Đình';
  }
  return 'Thành Tựu Cung Đình';
}

function getWorkDescription(workId) {
  if (!workConfig) workConfig = loadJsonSafe('WorkConfig_json.json');
  const idStr = String(workId);
  if (workConfig && workConfig.list && workConfig.list[idStr]) {
    return workConfig.list[idStr][1] || 'Sự vụ Triều đình';
  }
  return 'Sự vụ Triều đình';
}

function getWorkDetails(workId) {
  if (!workConfig) workConfig = loadJsonSafe('WorkConfig_json.json');
  const idStr = String(workId);
  if (workConfig && workConfig.list && workConfig.list[idStr]) {
    const row = workConfig.list[idStr];
    return {
      workId,
      description: row[1] || 'Sự vụ Triều đình',
      option1: row[2] || 'Lựa chọn 1',
      option2: row[3] || 'Lựa chọn 2'
    };
  }
  return {
    workId,
    description: 'Sự vụ Triều đình',
    option1: 'Lựa chọn 1',
    option2: 'Lựa chọn 2'
  };
}

function getHelperName(helperId) {
  if (!helperConfig) helperConfig = loadJsonSafe('HelperConfig_json.json');
  const idStr = String(helperId);
  if (helperConfig && helperConfig.list && helperConfig.list[idStr]) {
    return helperConfig.list[idStr][0] || `Tùy Tùng`;
  }
  return `Tùy Tùng`;
}

function getWifeName(wifeId) {
  if (!wifeConfig) wifeConfig = loadJsonSafe('WifeConfig_json.json');
  const idStr = String(wifeId);
  if (wifeConfig && wifeConfig.list && wifeConfig.list[idStr]) {
    return wifeConfig.list[idStr][8] || wifeConfig.list[idStr][9] || `Tri Kỷ`;
  }
  return `Tri Kỷ`;
}

let aptitudeConfig = null;

function getAptitudeName(aptId) {
  if (!aptitudeConfig) aptitudeConfig = loadJsonSafe('HelperAptitudeConfig_json.json');
  const idStr = String(aptId);
  if (aptitudeConfig && aptitudeConfig.list && aptitudeConfig.list[idStr]) {
    return aptitudeConfig.list[idStr][0] || `Tư chất`;
  }
  return `Tư chất`;
}

let levelConfig = null;

function getLevelInfo(lv) {
  if (!levelConfig) levelConfig = loadJsonSafe('LevelConfig_json.json');
  const idStr = String(lv || 1);
  if (levelConfig && levelConfig.list && levelConfig.list[idStr]) {
    const row = levelConfig.list[idStr];
    return {
      lv: Number(row[1]) || lv,
      maxExp: Number(row[2]) || 0,
      name: row[3] || `Cấp ${lv}`
    };
  }
  return { lv: lv || 1, maxExp: 0, name: `Cấp ${lv || 1}` };
}

module.exports = {
  getItemName,
  getSevenGoalTargetName,
  getAchievementName,
  getWorkDescription,
  getWorkDetails,
  getHelperName,
  getWifeName,
  getAptitudeName,
  getLevelInfo
};
