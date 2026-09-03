/**
 * RankService: Tự động Bái Kiến Bảng Xếp Hạng nhận Vàng & Bạc hàng ngày
 * Đọc trực tiếp 100% trạng thái isWorship từ Server Game (113101/113201)
 */

const BaseService = require('../base/BaseService');

class RankService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'rank',
      domain: 'welfare',
      name: '[BXH] Bái Kiến 3 Bảng Xếp Hạng',
      menuOption: 5,
      listenedMsgIds: [113201, 113203]
    });
  }

  async execute() {
    return this.worshipAllRanks();
  }

  async worshipAllRanks() {
    console.log('\n[Auto Bái Kiến BXH] Đang kiểm tra trạng thái Bái kiến từ Server...');
    this.client.rankLocalInfo = null;
    this.send(113101, {});
    await this.waitFor(() => this.client.rankLocalInfo !== null);

    const rankList = this.client.rankLocalInfo || [];
    const targetRanks = [
      { id: 1, name: 'Thế Lực' },
      { id: 2, name: 'Quan Phẩm' },
      { id: 3, name: 'Cốt Truyện' }
    ];

    let worshipCount = 0;
    for (const t of targetRanks) {
      const serverRank = rankList.find(r => r.RankInfoId === t.id);
      const isWorshiped = serverRank ? (serverRank.isWorship === 1) : false;

      if (isWorshiped) {
        console.log(`  [-] [BXH ${t.name}] Server xác nhận: Hôm nay bạn đã bái kiến rồi.`);
        continue;
      }

      this.client.lastRankWorship = null;
      this.client.lastReturnCode = null;
      console.log(`  -> Đang bái kiến BXH [${t.name}]...`);
      this.send(113103, { type: t.id });
      await this.sleepRandom(1.2, 2.0);

      if (this.client.lastRankWorship) {
        const val = this.client.lastRankWorship.awardValue || 1;
        const type = this.client.lastRankWorship.awardType === 8 ? 'Vàng' : 'Bạc';
        console.log(`    [BXH ${t.name}] Bái kiến THÀNH CÔNG! Nhận: +${Number(val).toLocaleString()} ${type}`);
      } else if (this.client.lastReturnCode && this.client.lastReturnCode.code === 118001) {
        console.log(`    [-] [BXH ${t.name}] Server phản hồi: Hôm nay đã bái kiến rồi.`);
      } else {
        console.log(`    [BXH ${t.name}] Bái kiến hoàn tất!`);
      }

      worshipCount++;
    }

    if (worshipCount === 0) {
      console.log('  [-] [Bái Kiến BXH] Toàn bộ 3/3 Bảng Xếp Hạng đều đã được bái kiến.');
    } else {
      console.log(`[Auto Bái Kiến BXH] Đã thực hiện bái kiến xong ${worshipCount} Bảng Xếp Hạng!`);
    }

    return worshipCount;
  }
}

module.exports = RankService;
