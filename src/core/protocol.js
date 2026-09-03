/**
 * Core Protocol Module: Protobuf Encoder/Decoder & Award Formatters
 */

const path = require('path');
const protobuf = require('protobufjs');
const { PROP_NAMES } = require('../config');

const protoJsonPath = path.resolve(__dirname, '../../proto/proto.json');
const protoIdPath = path.resolve(__dirname, '../../proto/protoId.json');

const protoJson = require(protoJsonPath);
const protoId = require(protoIdPath);
const itemNames = require('../config/item_names.json');
const mainTasks = require('../config/main_tasks.json');

const root = protobuf.Root.fromJSON(protoJson);

/**
 * Format danh sách quà tặng sang chuỗi tiếng Việt dễ đọc
 */
function formatPropName(configId) {
  if (!configId) return 'Tài nguyên';
  const idStr = configId.toString();
  return itemNames[idStr] || PROP_NAMES[idStr] || `Vật phẩm (${idStr})`;
}

function getMainTaskInfo(questId) {
  const idStr = questId ? questId.toString() : '';
  return mainTasks[idStr] || null;
}

function formatAwards(awardList) {
  if (!awardList || awardList.length === 0) return 'Không có quà đính kèm';
  return awardList.map(a => {
    const num = Number(a.num || a.awardNum || a.count || 1).toLocaleString();
    let name = '';
    if (a.clothesInfo) {
      if (a.clothesInfo.name) name = a.clothesInfo.name;
      else if (a.clothesInfo.clothesId) name = formatPropName(a.clothesInfo.clothesId);
    }
    if (!name) {
      const targetId = a.id || a.rewardId || a.configId || a.goodsId || a.propId;
      if (a.type === 2) {
        if (targetId === 1) name = 'EXP';
        else if (targetId === 2) name = 'Bạc';
        else if (targetId === 3) name = 'Lương Thực';
        else if (targetId === 4) name = 'Binh Lực';
        else if (targetId === 8) name = 'Vàng';
        else name = formatPropName(targetId);
      } else {
        name = formatPropName(targetId);
      }
    }
    return `+${num} ${name}`;
  }).join(', ');
}

/**
 * Đóng gói message protobuf thành binary buffer có header 12 bytes
 */
function encodeMsg(msgId, payload, autoId, isGame = false, encryptHelper = null) {
  const [mod, cls] = protoId.cs[msgId.toString()];
  const type = root.lookupType('com.proto.' + mod + 'Message.' + cls);
  let protoBytes = Buffer.from(type.encode(type.create(payload)).finish());

  if (isGame && msgId !== 101106 && encryptHelper) {
    protoBytes = encryptHelper.encodeGamePacket(protoBytes, encryptHelper.encryptCode);
  }

  const totalLen = 12 + protoBytes.length;
  const pkt = Buffer.alloc(totalLen);
  pkt.writeUInt32BE(totalLen, 0);
  pkt.writeUInt32BE(autoId, 4);
  pkt.writeUInt32BE(msgId, 8);
  protoBytes.copy(pkt, 12);
  return pkt;
}

/**
 * Giải mã chuỗi binary buffer thành danh sách packet protobuf
 */
function decodeBuffer(buf) {
  const pkts = [];
  let offset = 0;
  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const contentLen = buf.readUInt32BE(offset);
    if (contentLen < 4 || offset + 4 + contentLen > buf.length) {
      break;
    }
    const msgId = buf.readUInt32BE(offset + 4);
    const protoLen = contentLen - 4;
    const protoBytes = buf.subarray(offset + 8, offset + 8 + protoLen);

    const [mod, cls] = protoId.sc[msgId.toString()] || ['Unknown', 'Unknown'];
    let data = null;
    try {
      const type = root.lookupType('com.proto.' + mod + 'Message.' + cls);
      data = type.toObject(type.decode(protoBytes), {
        longs: String,
        enums: String,
        bytes: String,
        defaults: true
      });
    } catch (e) {
      // Ignored non-critical proto decode exceptions
    }

    pkts.push({ msgId, mod, cls, data });
    offset += 4 + contentLen;
  }
  return pkts;
}

function formatDuration(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  if (s === 0) return '0s (Đã hồi xong)';
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) {
    return `${hours}h ${minutes < 10 ? '0' + minutes : minutes}p ${seconds < 10 ? '0' + seconds : seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}p ${seconds < 10 ? '0' + seconds : seconds}s`;
  }
  return `${seconds}s`;
}

module.exports = {
  root,
  protoId,
  encodeMsg,
  decodeBuffer,
  formatPropName,
  formatAwards,
  getMainTaskInfo,
  formatDuration
};
