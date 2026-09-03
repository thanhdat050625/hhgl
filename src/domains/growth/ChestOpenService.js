const BaseService = require('../base/BaseService');
const { getLevelInfo } = require('../../config');
const path = require('path');
const fs = require('fs');

/**
 * ChestOpenService: Tự Động Quét Túi Đồ, Mở Rương & Hộp Quà Nhận Vàng & Cung Vận
 * Protocol:
 * - 104101: ReqUse (propId, num)
 * - 104201: ResPropInfo
 * - 102204: ResAttributeOffice (Cập nhật EXP / Cung Vận)
 * - 102205: ResPlayerAttributeUpdate
 */
class ChestOpenService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'chestopen',
      domain: 'growth',
      name: '[Mở Rương] Tự Động Mở Rương & Hộp Quà Vàng / Cung Vận',
      menuOption: 5,
      listenedMsgIds: [104201, 104202, 102204, 102205]
    });

    // Danh mục ID đạo cụ / rương đã xác thực cho Vàng và Cung Vận
    this.targetItemIds = new Set([
      // Cung Vận:
      10013, // Hộp Quà Cung Vận Nhỏ (+50 Cung Vận)
      10014, // Hộp Quà Cung Vận (+500 Cung Vận)
      15003, // Túi tài nguyên hậu cung (Quà cung vận & tài nguyên)
      
      // Vàng (Gold):
      10012, // Rương Vàng May Mắn (+5-1000 Vàng)
      15022, // Quà Vàng 1 Đồng
      15023, // Quà Vàng 6 Đồng
      
      // Lễ Bao Tước Vị (Nhận lượng lớn Vàng & đạo cụ quý):
      30006, 30007, 30008, 30009, 30010, 30011, 30012, 30013, 30014, 30015, 30016, 30017, 30018,
      
      // Quà Cấp Tước Vị:
      60001, 60002, 60003, 60004, 60005, 60006, 60007, 60008, 60009, 60010, 60011, 60012, 60013, 60014, 60015,
      70001, 70002, 70003, 70004, 70005, 70006, 70007, 70008, 70009, 70010, 70011, 70012, 70013, 70014, 70015,
      80001, 80002, 80003, 80004, 80005, 80006, 80007, 80008, 80009, 80010, 80011, 80012, 80013, 80014, 80015,
      120001, 120002, 120003, 120004, 120005, 120006, 120007, 120008, 120009, 12010, 120011, 120012, 120013, 120014, 120015
    ]);

    this.propConfig = null;
    this.loadPropConfig();
  }

  loadPropConfig() {
    try {
      const cfgPath = path.resolve(__dirname, '../../../_source_game/config_init/PropConfig_json.json');
      if (fs.existsSync(cfgPath)) {
        this.propConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).list;
      }
    } catch (_) {}
  }

  getPropMeta(configId) {
    if (this.propConfig && this.propConfig[configId]) {
      const arr = this.propConfig[configId];
      return {
        name: arr[1] || `Rương #${configId}`,
        desc: arr[2] || '',
        effect: arr[9] || ''
      };
    }
    return {
      name: `Rương #${configId}`,
      desc: '',
      effect: ''
    };
  }

  isGoldOrCungVanItem(item) {
    if (this.targetItemIds.has(item.configId)) return true;

    // Quét động nếu mô tả có đề cập đến Cung Vận hoặc Vàng
    const meta = this.getPropMeta(item.configId);
    const combined = `${meta.name} ${meta.desc} ${meta.effect}`.toLowerCase();
    return combined.includes('cung vận') || combined.includes('cung van') || combined.includes('vàng') || combined.includes('kim nguyên bảo');
  }

  async execute() {
    return this.openGoldAndCungVanChests();
  }

  async openGoldAndCungVanChests(isLoop = false) {
    if (!isLoop) {
      console.log('\n======================================================');
      console.log('[TỰ ĐỘNG MỞ RƯƠNG & HỘP QUÀ VÀNG / CUNG VẬN (LIVE SYNC)]');
      console.log('======================================================');
    }

    const propList = this.client.propList || [];
    if (propList.length === 0) {
      if (!isLoop) console.log('[-] Túi đồ hiện tại đang trống hoặc chưa đồng bộ.');
      return 0;
    }

    // Lọc các rương / hộp quà nhận Vàng hoặc Cung Vận
    const eligibleChests = propList.filter(p => p.num > 0 && this.isGoldOrCungVanItem(p));

    if (eligibleChests.length === 0) {
      if (!isLoop) {
        console.log('ℹ️ Không có Rương hoặc Hộp Quà nào chứa Vàng / Cung Vận trong túi đồ.');
        console.log('======================================================\n');
      }
      return 0;
    }

    if (!isLoop) {
      console.log(`👉 Phát hiện ${eligibleChests.length} loại rương/hộp quà chứa Vàng hoặc Cung Vận:`);
    }

    let openedCount = 0;

    for (const chest of eligibleChests) {
      const count = chest.num;
      if (count <= 0) continue;

      const meta = this.getPropMeta(chest.configId);
      const isCungVan = meta.desc.toLowerCase().includes('cung vận') || meta.name.toLowerCase().includes('cung vận');
      const isGold = meta.desc.toLowerCase().includes('vàng') || meta.name.toLowerCase().includes('vàng');
      const tag = isCungVan ? 'Cung Vận' : (isGold ? 'Vàng' : 'Phúc Lợi');

      if (!isLoop) {
        console.log(`\n🎁 [${tag}] Đang mở x${count} [${meta.name}]...`);
        if (meta.desc) console.log(`   📝 Mô tả: "${meta.desc}"`);
      }

      const expBefore = Number(this.client.playerData.exp) || 0;
      const goldBefore = Number(this.client.playerData.gold) || 0;

      this.client.lastReturnCode = null;
      this.send(104101, {
        propId: chest.propId,
        num: count
      });
      chest.num = 0; // Đánh dấu đã dùng
      await this.sleepRandom(1.2, 1.8);

      openedCount += count;

      const expAfter = Number(this.client.playerData.exp) || expBefore;
      const goldAfter = Number(this.client.playerData.gold) || goldBefore;
      const expGain = expAfter - expBefore;
      const goldGain = goldAfter - goldBefore;

      const lvlInfo = getLevelInfo(this.playerData.lv);
      const progStr = lvlInfo.maxExp > 0 ? ` (${expAfter}/${lvlInfo.maxExp} EXP)` : '';

      const gains = [];
      if (expGain > 0) gains.push(`+${expGain} Cung Vận${progStr}`);
      if (goldGain > 0) gains.push(`+${goldGain} Vàng`);
      if (gains.length === 0) gains.push('Mở thành công');

      const gainSummary = gains.join(', ');

      if (isLoop) {
        const timeStr = new Date().toLocaleTimeString('vi-VN');
        console.log(`[${timeStr}] 🎁 [Mở Rương] x${count} [${meta.name}] -> Nhận: ${gainSummary}`);
      } else {
        console.log(`   🎉 Mở THÀNH CÔNG: ${gainSummary}`);
      }
    }

    if (!isLoop) {
      console.log('------------------------------------------------------');
      console.log(`[Hoàn tất] Đã mở thành công ${openedCount} rương/hộp quà.`);
      console.log('======================================================\n');
    }

    return openedCount;
  }
}

module.exports = ChestOpenService;
