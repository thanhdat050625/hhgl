// GameClient: kết nối WebSocket, điều phối ServiceRegistry & SelfHealer

const WebSocket = require('ws');
const { CONFIG } = require('../config');
const { encodeMsg, decodeBuffer } = require('../core/protocol');
const SelfHealer = require('../core/SelfHealer');
const ServiceRegistry = require('../runners/ServiceRegistry');
const { runWithAccount } = require('../core/accountContext');

class GameClient {
  constructor(serverInfo, rcode, gateId, encryptHelper) {
    this.serverInfo = serverInfo;
    this.rcode = rcode;
    this.gateId = gateId;
    this.encryptHelper = encryptHelper;
    this.ws = null;
    this.autoId = 1;
    this.heartbeatTimer = null;
    this.isReady = false;
    this.isManualClosed = false;

    this.playerData = {
      name: '',
      playerId: '',
      lv: 1,
      power: 0,
      vip: 0,
      gold: 0,
      silver: 0,
      food: 0,
      soldier: 0,
      stamina: 10,
      isSigned: 0,
      hasReceivedVip: 0
    };

    this.lastReturnCode = null;
    this.mailList = null;
    this.lastMailAward = null;
    this.signInfo = null;
    this.lastSignAward = null;
    this.onlineInfo = null;
    this.lastOnlineReward = null;
    this.sevenDayInfo = null;
    this.lastSevenDayReward = null;
    this.wifeEnergyInfo = null;
    this.wifeInfoList = [];
    this.sceneInfo = null;
    this.lastFightResult = null;
    this.lastBossFightResult = null;
    this.lastClothesFightResult = null;
    this.mainQuestInfo = null;
    this.everydayQuestInfo = null;
    this.lastMainAward = null;
    this.lastQuestAllAward = null;
    this.lastCallWife = null;
    this.lastLookAdvertReward = null;
    this.lookAdvertInfo = null;
    this.lastLookAdvert = null;
    this.eventActivityInfo = null;
    this.eventActivityRankRewardInfo = null;
    this.lastEventActivityRankReward = null;
    this.newActivityList = null;
    this.tradeInfoList = [];
    this.workList = [];
    this.workRefreshTime = 0;
    this.recentProps = [];
    this.propList = [];
    this.helperInfoList = [];
    this.lastHelperUp = null;
    this.palaceInfo = null;
    this.prisonInfo = null;
    this.wardrobe = { wearingIds: [], haveClothesList: [] };
    this.sevenGoalTargets = [];
    this.sevenGoalRewardList = [];
    this.lastSevenGoalReward = null;
    this.achievementList = [];
    this.lastAchievementAward = null;
    this.gardenInfo = null;
    this.flowerRankList = null;
    this.academyInfo = null;
    this.manorInfo = null;
    this.lotteryCdInfo = null;
    this.lastLotteryReward = null;
    this.lastRankWorship = null;
    this.rankLocalInfo = [];
    this.hasNewMail = false;
    this.hasNewSevenGoal = false;
    this.hasNewAchievement = false;
    this.isNewDay = false;
    this.academyNextReadyTime = 0;
    this.allOnlineRewardsClaimed = false;
    this.lastActiveDateStr = new Date().toLocaleDateString('vi-VN');

    this.serverTime = 0;
    this.serverTimeUpdated = 0;

    this.healer = new SelfHealer(this);
    this.registry = new ServiceRegistry(this);
    this.services = this.registry;

    this.trade = this.registry.get('trade');
    this.affair = this.registry.get('affair');
    this.work = this.trade;
    this.mail = this.registry.get('mail');
    this.welfare = this.registry.get('welfare');
    this.level = this.registry.get('level');
    this.helper = this.registry.get('helper');
    this.bagService = this.registry.get('bag');
    this.sevenGoalService = this.registry.get('sevengoal');
    this.achievementService = this.registry.get('achievement');
    this.rankService = this.registry.get('rank');
    this.palace = this.registry.get('palace');
    this.quest = this.registry.get('quest');
    this.stage = this.registry.get('stage');
    this.prison = this.registry.get('prison');
    this.academy = this.registry.get('academy');
    this.wife = this.registry.get('wife');
    this.eventRankPoint = this.registry.get('eventrankpoint');
    this.hoaDang = this.registry.get('hoadang');
    this.chestOpen = this.registry.get('chestopen');
  }

  getServerTime() {
    if (this.serverTime && this.serverTimeUpdated) {
      return this.serverTime + Math.floor((Date.now() - this.serverTimeUpdated) / 1000);
    }
    return Math.floor(Date.now() / 1000);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  sleepRandom(minSec = 1, maxSec = 3) {
    const ms = Math.floor((minSec + Math.random() * (maxSec - minSec)) * 1000);
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  send(msgId, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const buf = encodeMsg(msgId, payload, this.autoId++, true, this.encryptHelper);
    this.ws.send(buf);
  }

  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.send(101102, {});
    }, 20000);
  }

  connect() {
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const connectTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try { if (this.ws) this.ws.close(); } catch (_) { }
          reject(new Error('Kết nối Game Server quá thời gian (15s timeout)'));
        }
      }, 15000);

      const safeResolve = () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(connectTimer);
          resolve();
        }
      };

      const safeReject = (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(connectTimer);
          reject(err);
        }
      };

      if (this.ws) {
        try {
          this.ws.onclose = null;
          this.ws.onerror = null;
          this.ws.onmessage = null;
          this.ws.close();
        } catch (_) { }
        this.ws = null;
      }

      this.encryptHelper.generateGameServerCode(this.serverInfo.serverId, this.rcode);
      this.autoId = this.encryptHelper.autoAddCode + 1;

      const wsUrl = `wss://${this.serverInfo.ip}:${this.serverInfo.port}`;
      this.ws = new WebSocket(wsUrl, {
        headers: { Origin: CONFIG.ORIGIN_CDN },
        rejectUnauthorized: true
      });

      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        const initBuf = encodeMsg(101106, { code: this.rcode, gateId: this.gateId }, this.autoId++);
        this.ws.send(initBuf);
      };

      this.ws.onmessage = async (evt) => {
        return runWithAccount(this.accountEmail, async () => {
          const pkts = decodeBuffer(Buffer.from(evt.data));
          for (const pkt of pkts) {
            if (pkt.msgId === 101206) {
              this.send(101101, {
                code: this.rcode,
                serverId: this.serverInfo.serverId,
                channel: CONFIG.CHANNEL,
                version: CONFIG.CLIENT_VERSION,
                param: JSON.stringify({ deviceOS: CONFIG.DEVICE_OS, step: 0 })
              });
            } else if (pkt.msgId === 101202) {
              const code = pkt.data?.code;
              const errMsg = code === 7
                ? `Game yêu cầu tải lại / cập nhật phiên bản mới (code 7, version hiện tại: ${CONFIG.CLIENT_VERSION})`
                : `Máy chủ báo lỗi kết nối 101202 (code: ${code})`;
              console.error(`\n❌ [${this.accountEmail || 'GameClient'}] ${errMsg}`);
              safeReject(new Error(errMsg));
            } else if (pkt.msgId === 101201) {
              if (pkt.data && pkt.data.time) {
                this.serverTime = Number(pkt.data.time);
                this.serverTimeUpdated = Date.now();
              }
              if (pkt.data.code === 5) {
                console.log('\n⚠️ Server này bạn chưa tạo nhân vật!');
              }
              safeResolve();
            } else if (pkt.msgId === 163201) {
              const list = pkt.data.resourceList || [];
              list.forEach(r => {
                const val = Number(r.value) || 0;
                if (r.type === 1) this.playerData.exp = val;
                if (r.type === 2) this.playerData.silver = val;
                if (r.type === 3) this.playerData.food = val;
                if (r.type === 4) this.playerData.soldier = val;
                if (r.type === 8) this.playerData.gold = val;
                if (r.type === 25) this.playerData.stamina = val;
              });

              if (global.dashboardServer) {
                global.dashboardServer.broadcastSSE('player_state', global.dashboardServer.getPlayerState());
              }
            } else if (pkt.msgId === 163203) {
              const type = pkt.data.type;
              const val = Number(pkt.data.newValue) || 0;
              if (type === 1) this.playerData.exp = val;
              if (type === 2) this.playerData.silver = val;
              if (type === 3) this.playerData.food = val;
              if (type === 4) this.playerData.soldier = val;
              if (type === 8) this.playerData.gold = val;
              if (type === 25) this.playerData.stamina = val;

              if (global.dashboardServer) {
                global.dashboardServer.broadcastSSE('player_state', global.dashboardServer.getPlayerState());
              }
            } else if (pkt.msgId === 145201) {
              if (pkt.data.workInfoList) this.workList = pkt.data.workInfoList;
              if (pkt.data.tradeInfoList) {
                this.tradeInfoList = pkt.data.tradeInfoList;
                this.tradeInfoList.forEach(t => { t.updatedAt = Date.now(); });
              }
              if (pkt.data.workTime !== undefined) {
                const t = Number(pkt.data.workTime) || 0;
                this.workRefreshTime = t > 10000000 ? t : (t > 0 ? Math.floor(Date.now() / 1000) + t : 0);
              }
              if (pkt.data.wifeEnergyFuncDataInfo) this.wifeEnergyInfo = pkt.data.wifeEnergyFuncDataInfo;
              if (pkt.data.helperInfoList) this.helperInfoList = pkt.data.helperInfoList;
            } else if (pkt.msgId === 102206) {
              if (pkt.data.tradeInfoList) {
                pkt.data.tradeInfoList.forEach(t => {
                  t.updatedAt = Date.now();
                  const ex = this.tradeInfoList.find(x => x.type === t.type);
                  if (ex) Object.assign(ex, t);
                  else this.tradeInfoList.push(t);
                });
              }
            } else if (pkt.msgId === 102207) {
              const works = pkt.data.workInfoList || [];
              this.lastHarvestedWorks = works;
              if (pkt.data.type === 1) {
                works.forEach(w => {
                  if (!this.workList.some(ex => ex.workId === w.workId)) {
                    this.workList.push(w);
                  }
                });
              } else if (pkt.data.type === 2 || pkt.data.type === 5) {
                const ids = works.map(w => w.workId);
                this.workList = this.workList.filter(w => !ids.includes(w.workId));
              } else if (pkt.data.type === 4) {
                this.workList = works.slice();
              }
              if (pkt.data.time !== undefined) {
                const t = Number(pkt.data.time) || 0;
                this.workRefreshTime = t > 10000000 ? t : (t > 0 ? Math.floor(Date.now() / 1000) + t : 0);
              }
            } else if (pkt.msgId === 102226) {
              this.lastReturnCode = pkt.data;
              if (pkt.data.code !== 0) {
                this.healer.diagnoseAndFix(pkt.data.reqId, pkt.data.code).catch(() => { });
              }
            } else if (pkt.msgId === 117205) {
              this.mailList = pkt.data.mailList || [];
            } else if (pkt.msgId === 117202) {
              this.lastMailAward = pkt.data;
            } else if (pkt.msgId === 211201) {
              this.signInfo = pkt.data;
            } else if (pkt.msgId === 211202) {
              this.lastSignAward = pkt.data;
            } else if (pkt.msgId === 151201) {
              this.onlineInfo = pkt.data;
            } else if (pkt.msgId === 151202) {
              this.lastOnlineReward = pkt.data;
            } else if (pkt.msgId === 152201) {
              this.sevenDayInfo = pkt.data;
            } else if (pkt.msgId === 152202) {
              this.lastSevenDayReward = pkt.data;
            } else if (pkt.msgId === 104201) {
              if (pkt.data.propInfo) {
                this.recentProps.push(pkt.data.propInfo);
                if (this.recentProps.length > 50) this.recentProps.shift();
              }
            } else if (pkt.msgId === 104202) {
              this.propList = pkt.data.propList || [];
            } else if (pkt.msgId === 102215) {
              if (pkt.data.isSucc) {
                const newLv = Number(pkt.data.lvId) || (this.playerData.lv + 1);
                this.playerData.lv = newLv;
                if (this.playerData.attrMap) this.playerData.attrMap[106] = newLv;
                if (global.dashboardServer) {
                  global.dashboardServer.broadcastSSE('player_state', global.dashboardServer.getPlayerState());
                }
              }
            } else if (pkt.msgId === 102204 || pkt.msgId === 102205) {
              if (pkt.data.playerAttributeList) {
                if (!this.playerData.attrMap) this.playerData.attrMap = {};
                pkt.data.playerAttributeList.forEach(a => {
                  const val = Number(a.attValue) || 0;
                  if (pkt.msgId === 102205) {
                    this.playerData.attrMap[a.attType] = (this.playerData.attrMap[a.attType] || 0) + val;
                  } else {
                    this.playerData.attrMap[a.attType] = val;
                  }
                  if (a.attType === 106) this.playerData.lv = Number(a.attValue) || this.playerData.lv;
                  if (a.attType === 105) this.playerData.power = Number(a.attValue) || this.playerData.power;
                  if (a.attType === 108) this.playerData.vip = Math.max(0, (Number(a.attValue) || 1) - 1);
                  if (a.attType === 114) this.playerData.isSigned = Number(a.attValue) || 0;
                  if (a.attType === 116) this.playerData.hasReceivedVip = Number(a.attValue) || 0;
                });

                if (global.dashboardServer) {
                  global.dashboardServer.broadcastSSE('player_state', global.dashboardServer.getPlayerState());
                }
              }
            } else if (pkt.msgId === 106219) {
              this.wifeEnergyInfo = pkt.data.wifeEnergyFuncDataInfo || pkt.data;
            } else if (pkt.msgId === 106201) {
              this.wifeInfoList = pkt.data.wifeInfo || [];
            } else if (pkt.msgId === 106204) {
              this.lastCallWife = pkt.data;
            } else if (pkt.msgId === 112201) {
              this.sceneInfo = (pkt.data.sceneFuncDataInfo && pkt.data.sceneFuncDataInfo.sceneInfo) ? pkt.data.sceneFuncDataInfo.sceneInfo : (pkt.data.sceneInfo || pkt.data);
              this.helperStateList = (pkt.data.sceneFuncDataInfo && pkt.data.sceneFuncDataInfo.helperStateList) ? pkt.data.sceneFuncDataInfo.helperStateList : [];
            } else if (pkt.msgId === 112202) {
              this.lastFightResult = pkt.data;
            } else if (pkt.msgId === 112203) {
              this.lastBossFightResult = pkt.data;
            } else if (pkt.msgId === 112209) {
              this.lastClothesFightResult = pkt.data;
            } else if (pkt.msgId === 129201) {
              if (this.clothesService) this.clothesService.handleClothesInfo(pkt.data);
            } else if (pkt.msgId === 124202) {
              this.lastMainAward = pkt.data;
            } else if (pkt.msgId === 124201) {
              this.mainQuestInfo = pkt.data;
            } else if (pkt.msgId === 124203) {
              this.everydayQuestInfo = pkt.data;
            } else if (pkt.msgId === 124206) {
              this.lastActiveChestAward = pkt.data;
            } else if (pkt.msgId === 124207) {
              this.positionQuestInfo = pkt.data;
            } else if (pkt.msgId === 124208) {
              this.lastPositionQuestAward = pkt.data;
            } else if (pkt.msgId === 124210) {
              this.lastQuestAllAward = pkt.data;
            } else if (pkt.msgId === 128202) {
              this.lotteryCdInfo = pkt.data;
            } else if (pkt.msgId === 128201) {
              this.lastLotteryReward = pkt.data;
            } else if (pkt.msgId === 105201) {
              this.helperInfoList = pkt.data.helperInfoList || this.helperInfoList;
            } else if (pkt.msgId === 105202) {
              this.lastHelperUp = pkt.data;
            } else if (pkt.msgId === 105203) {
              this.lastAptitudeUp = pkt.data;
            } else if (pkt.msgId === 105208) {
              this.helperLetters = pkt.data.letterId || [];
            } else if (pkt.msgId === 105209) {
              this.lastHelperLetterAward = pkt.data;
            } else if (pkt.msgId === 114201) {
              this.palaceInfo = pkt.data;
            } else if (pkt.msgId === 113201) {
              this.rankLocalInfo = pkt.data.rankInfo || [];
            } else if (pkt.msgId === 113203) {
              this.lastRankWorship = pkt.data;
            } else if (pkt.msgId === 110201) {
              this.prisonInfo = pkt.data;
            } else if (pkt.msgId === 110202) {
              this.lastHitPrisoner = pkt.data;
            } else if (pkt.msgId === 106204) {
              this.lastCallWife = pkt.data;
            } else if (pkt.msgId === 106210) {
              this.lastWifeNearReward = pkt.data;
            } else if (pkt.msgId === 140201) {
              this.eventActivityInfo = pkt.data;
            } else if (pkt.msgId === 140204) {
              this.lastEventActivityItemUse = pkt.data;
            } else if (pkt.msgId === 140205) {
              this.eventActivityExchangeInfo = pkt.data;
            } else if (pkt.msgId === 140207) {
              this.eventActivityRankRewardInfo = pkt.data;
            } else if (pkt.msgId === 140208) {
              this.lastEventActivityRankReward = pkt.data;
            } else if (pkt.msgId === 140210) {
              this.lastBuyEventActivityGoods = pkt.data;
            } else if (pkt.msgId === 127211) {
              this.newActivityList = pkt.data.activityList || [];
            } else if (pkt.msgId === 162201) {
              this.sevenGoalDay = pkt.data.day;
              this.sevenDayDay = pkt.data.day;
              this.sevenGoalTargets = pkt.data.targetList || [];
              this.sevenGoalRewardList = pkt.data.rewardList || [];
              this.sevenGoalScore = pkt.data.score || 0;
            } else if (pkt.msgId === 162202) {
              this.lastSevenGoalStageReward = pkt.data;
              if (pkt.data && pkt.data.id) {
                if (!this.sevenGoalRewardList) this.sevenGoalRewardList = [];
                this.sevenGoalRewardList.push(pkt.data.id);
              }
            } else if (pkt.msgId === 162204) {
              this.lastSevenGoalReward = pkt.data;
              if (pkt.data && pkt.data.score) {
                this.sevenGoalScore = pkt.data.score;
              }
            } else if (pkt.msgId === 162205) {
              this.hasNewSevenGoal = true;
            } else if (pkt.msgId === 117206) {
              this.hasNewMail = true;
            } else if (pkt.msgId === 125404 || pkt.msgId === 125405) {
              this.hasNewAchievement = true;
            } else if (pkt.msgId === 102242) {
              this.isNewDay = true;
            } else if (pkt.msgId === 125202) {
              this.achievementList = pkt.data.achievementList || [];
            } else if (pkt.msgId === 125203) {
              this.lastAchievementAward = pkt.data;
              if (pkt.data && pkt.data.achievement) {
                const idx = (this.achievementList || []).findIndex(a => a.achievementId === pkt.data.achievement);
                if (idx !== -1 && pkt.data.newTarget) {
                  this.achievementList[idx] = pkt.data.newTarget;
                }
              }
            } else if (pkt.msgId === 125401) {
              if (pkt.data.achievementList) {
                const map = new Map((this.achievementList || []).map(a => [a.achievementId, a]));
                pkt.data.achievementList.forEach(group => {
                  if (group.achievementList) {
                    group.achievementList.forEach(a => map.set(a.achievementId, a));
                  }
                });
                this.achievementList = Array.from(map.values());
              }
            } else if (pkt.msgId === 153201) {
              this.gardenInfo = pkt.data;
            } else if (pkt.msgId === 153217) {
              this.flowerRankList = pkt.data;
            } else if (pkt.msgId === 217208) {
              this.academyInfo = pkt.data;
            } else if (pkt.msgId === 142201) {
              this.manorInfo = pkt.data;
            } else if (pkt.msgId === 102201) {
              const pInfo = pkt.data.playerInfo || {};
              const attrs = pkt.data.playerAttributeList || [];
              const attrMap = {};
              attrs.forEach(a => { attrMap[a.attType] = Number(a.attValue) || 0; });

              this.playerData.name = pInfo.playerName || 'Chưa đặt';
              this.playerData.playerId = pInfo.playerId;
              this.playerData.attrMap = attrMap;
              this.playerData.lv = attrMap[106] || 1;
              this.playerData.power = attrMap[105] || 0;
              this.playerData.vip = Math.max(0, (Number(attrMap[108]) || 1) - 1);
              this.playerData.isSigned = attrMap[114] || 0;
              this.playerData.hasReceivedVip = attrMap[116] || 0;

              this.startHeartbeat();
              setTimeout(() => {
                this.isReady = true;
              }, 300);
            }

            this.registry.dispatchPacket(pkt);
          }
        });
      };

      this.ws.onclose = () => {
        this.isReady = false;
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }

        if (!this.isManualClosed) {
          if (!isSettled) {
            safeReject(new Error('Kết nối Game Server bị đóng trước khi đăng nhập thành công'));
          }
          console.log('\n[!] Kết nối tới Game Server bị ngắt. Đang tự động kết nối lại sau 3 giây...');
          setTimeout(async () => {
            if (!this.isManualClosed) {
              try {
                await this.connect();
              } catch (_) { }
            }
          }, 3000);
        }
      };

      this.ws.onerror = (err) => {
        if (!isSettled) {
          safeReject(err);
        }
      };
    });
  }

  close() {
    this.isManualClosed = true;
    this.isReady = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
  }
}

module.exports = GameClient;
