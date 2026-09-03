/**
 * Bag Service: Tự Động Quét Túi Đồ, Sử Dụng Ngân Phiếu, Canh Bổ Khí & Đan Dược
 */

const BaseService = require('../base/BaseService');
const { formatPropName } = require('../../core/protocol');

class BagService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'bag',
      domain: 'growth',
      name: '[Túi Đồ] Túi Đồ & Đan Dược Tăng Trưởng',
      menuOption: 3,
      listenedMsgIds: [104201, 104202]
    });
    this.growthItemIds = [
      10013, 10014, 15003, // Hộp Quà Cung Vận & Túi Tài Nguyên Hậu Cung
      10005, 10006, 10007, 10023, // Ngân Phiếu (Bạc)
      10011, 10024, // Bao Lương Thực
      10012, // Canh Bổ Khí (Binh Lực)
      12001, 12002, 12003, 12004, 12005, 12006, 12007, 12008, 12009, 12010, 12011, // Đan Dược
      10001, 10003, 10004 // Sách Thuộc Tính (10002 là Cung Vụ Lệnh do AffairService quản lý)
    ];
  }

  async execute() {
    return this.useAllGrowthItems();
  }

  async useAllGrowthItems() {
    console.log('\n[Auto Túi Đồ] Bước 1: Quét danh mục vật phẩm trong túi...');
    this.client.propList = null;
    this.send(104102, {});
    await this.waitFor(() => this.client.propList !== null);

    const propList = this.client.propList || [];
    if (propList.length === 0) {
      console.log('  [-] [Auto Túi Đồ] Túi đồ hiện đang trống hoặc chưa có vật phẩm tăng trưởng.');
      return;
    }

    let usedCount = 0;
    const targetHelperId = '10001'; // Dận Lễ

    for (const item of propList) {
      if (this.growthItemIds.includes(item.configId) && item.num > 0) {
        const propName = formatPropName(item.configId);
        const count = item.num;
        item.num = 0; // Đánh dấu đã dùng ngay để tránh lặp
        console.log(`  [+] [Sử Dụng] Đang dùng x${count} ${propName}...`);

        // Gửi lệnh ReqUse 104101
        this.send(104101, {
          propId: item.propId,
          num: count,
          args: targetHelperId
        });

        usedCount++;
        await this.sleepRandom(0.8, 1.5);
      }
    }

    if (usedCount > 0) {
      console.log(`[Auto Túi Đồ] Đã sử dụng thành công ${usedCount} loại vật phẩm tăng trưởng!`);
    } else {
      console.log('  [-] [Auto Túi Đồ] Không còn vật phẩm tiêu hao nào cần dùng.');
    }
  }
}

module.exports = BagService;
