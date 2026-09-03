/**
 * ClothesService: Quản lý Tủ Đồ Trang Phục và Tự Động Phối Đồ khi So Tài Y Phục
 */

const BaseService = require('../base/BaseService');

class ClothesService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'clothes',
      domain: 'combat',
      name: '[Trang Phục] Tủ Đồ & Phối Y Phục',
      menuOption: null,
      listenedMsgIds: [129201, 129202]
    });
    this.wearingIds = [60010008, 30310008, 10010008];
    this.haveClothesList = [];
  }

  onPacket(msgId, data) {
    if (msgId === 129201) {
      this.handleClothesInfo(data);
    }
  }

  handleClothesInfo(data) {
    const cData = data.clothesFuncDataInfo || {};
    let wearing = cData.wearingIds || [];
    if (wearing.length === 0 && cData.snaps && cData.snaps.length > 0 && cData.snaps[0].wearingIds) {
      wearing = cData.snaps[0].wearingIds;
    }
    if (wearing.length === 0) {
      wearing = [60010008, 30310008, 10010008];
    }
    this.wearingIds = wearing;
    this.haveClothesList = cData.haveClothesList || [];
    this.client.wardrobe = {
      wearingIds: this.wearingIds,
      haveClothesList: this.haveClothesList
    };
  }

  async fetchWardrobe() {
    this.send(129101, {});
    await this.sleepRandom(1.0, 1.8);
  }

  getBestOutfit() {
    if (this.wearingIds && this.wearingIds.length > 0) {
      return [...this.wearingIds];
    }
    return [60010008, 30310008, 10010008];
  }

  async fightClothesStage() {
    console.log(`[Auto Tủ Đồ] Đang kiểm tra trang phục để so tài y phục...`);
    await this.fetchWardrobe();
    const outfit = this.getBestOutfit();
    console.log(`  [+] Đang trang bị bộ y phục tối ưu [${outfit.join(', ')}] và xuất chiến...`);
    this.send(112109, { wearing: outfit });
    await this.sleepRandom(2.0, 3.0);
    return true;
  }
}

module.exports = ClothesService;
