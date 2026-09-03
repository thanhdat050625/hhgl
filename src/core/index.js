const { CRC16Helper, EncryptHelper } = require('./crypto');
const { root, protoId, encodeMsg, decodeBuffer, formatPropName, formatAwards, getMainTaskInfo, formatDuration } = require('./protocol');
const { loginGame, authenticateSdk, getGatewayAuth } = require('./auth');
const SelfHealer = require('./SelfHealer');

module.exports = {
  CRC16Helper,
  EncryptHelper,
  root,
  protoId,
  encodeMsg,
  decodeBuffer,
  formatPropName,
  formatAwards,
  getMainTaskInfo,
  formatDuration,
  loginGame,
  authenticateSdk,
  getGatewayAuth,
  SelfHealer
};
