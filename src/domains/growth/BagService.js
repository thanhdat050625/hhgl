const BaseService = require('../base/BaseService');
const { getItemName } = require('../../config');

class BagService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'bag',
      domain: 'growth',
      name: '[Túi Đồ] Sử Dụng Tài Nguyên Tiêu Hao',
      menuOption: 3,
      listenedMsgIds: [104201, 104202]
    });
    // Chỉ xử lý các vật phẩm tài nguyên tiêu hao thông thường (Ngân phiếu, Lương thực, Tinh lực đan)
    this.consumableItemIds = [
      10006, 10007, 10023, // Ngân Phiếu (Bạc)
      10011, 10024, // Bao Lương Thực
      10003 // Tinh Lực Đan (Lam Nhan)
    ];
  }

  async execute() {
    return this.useAllGrowthItems();
  }

  async useAllGrowthItems() {
    const propList = this.client.propList || [];
    if (propList.length === 0) return 0;

    let usedCount = 0;

    for (const item of propList) {
      if (this.consumableItemIds.includes(item.configId) && item.num > 0) {
        const propName = getItemName(item.configId) || `Vật phẩm #${item.configId}`;
        const count = item.num;
        item.num = 0; // Đánh dấu đã dùng

        this.send(104101, {
          propId: item.propId,
          num: count,
          args: ''
        });

        usedCount++;
        await this.sleepRandom(0.8, 1.5);
      }
    }

    return usedCount;
  }
}

module.exports = BagService;
