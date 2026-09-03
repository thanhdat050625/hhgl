/**
 * RankService: Tự động Thích (Bái Kiến) 6 Bảng Xếp Hạng nhận Vàng & Bạc hàng ngày
 * Đọc trực tiếp 100% trạng thái isWorship từ Server Game (113101/113201)
 */

const BaseService = require('../base/BaseService');

class RankService extends BaseService {
  constructor(client) {
    super(client, {
      id: 'rank',
      domain: 'welfare',
      name: '[BXH] Thích 6 Bảng Xếp Hạng Hàng Ngày',
      menuOption: 2,
      listenedMsgIds: [113201, 113203]
    });
  }

  async execute() {
    return this.likeAllRanks();
  }

  async likeAllRanks() {
    console.log('\n======================================================');
    console.log('[AUTO THÍCH 6 BẢNG XẾP HẠNG HÀNG NGÀY (100% LIVE SYNC)]');
    console.log('======================================================');
    console.log('Đang truy vấn trạng thái 6 BXH từ Server Game...');

    this.client.rankLocalInfo = null;
    this.send(113101, {});
    await this.waitFor(() => this.client.rankLocalInfo !== null, 5000);

    const rankList = this.client.rankLocalInfo || [];

    // 6 Tab BXH chuẩn xác theo Game Client (RankInfoId: 0, 1, 2, 3, 5, 6)
    const targetRanks = [
      { id: 0, name: 'Thế Lực' },
      { id: 1, name: 'Cốt Truyện' },
      { id: 2, name: 'Tùy Tùng' },
      { id: 3, name: 'Thân Mật' },
      { id: 5, name: 'Trang Phục' },
      { id: 6, name: 'Mị Lực' }
    ];

    let likedCount = 0;
    for (const t of targetRanks) {
      const serverRank = rankList.find(r => r.RankInfoId === t.id);
      const isLiked = serverRank ? (serverRank.isWorship === 1) : false;

      let top1Name = '';
      if (serverRank && serverRank.playerList && serverRank.playerList.length > 0) {
        top1Name = serverRank.playerList[0].playerName || '';
      }

      if (isLiked) {
        console.log(`  [-] [BXH - ${t.name}] Hôm nay bạn đã Thích rồi${top1Name ? ` (Top 1: ${top1Name})` : ''}.`);
        continue;
      }

      this.client.lastRankWorship = null;
      this.client.lastReturnCode = null;
      console.log(`  👉 Đang Thích [BXH - ${t.name}]${top1Name ? ` (Top 1: ${top1Name})` : ''}...`);
      this.send(113103, { type: t.id });
      await this.sleepRandom(1.2, 2.0);

      if (this.client.lastRankWorship) {
        const val = this.client.lastRankWorship.awardValue || 1;
        const type = this.client.lastRankWorship.awardType === 8 ? 'Vàng' : 'Bạc';
        const targetName = this.client.lastRankWorship.name || top1Name;
        console.log(`  🎉 [BXH - ${t.name}] Thích THÀNH CÔNG${targetName ? ` cho [${targetName}]` : ''}! Nhận: +${Number(val).toLocaleString()} ${type}`);
        likedCount++;
      } else if (this.client.lastReturnCode && this.client.lastReturnCode.code === 118001) {
        console.log(`  [-] [BXH - ${t.name}] Server phản hồi: Hôm nay đã Thích rồi.`);
      } else {
        console.log(`  🎉 [BXH - ${t.name}] Thích hoàn tất!`);
        likedCount++;
      }
    }

    if (likedCount === 0) {
      console.log('\n[-] [BXH] Toàn bộ 6/6 Bảng Xếp Hạng đều đã được Thích hôm nay.');
    } else {
      console.log(`\n🎉 [BXH] Đã Thích thành công ${likedCount}/6 Bảng Xếp Hạng!`);
    }
    console.log('======================================================\n');
    return likedCount;
  }
}

module.exports = RankService;
