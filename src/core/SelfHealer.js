/**
 * Self-Healing & Reflexion Engine: Tự chẩn đoán, tự phục hồi và sửa lỗi runtime
 */

class SelfHealer {
  constructor(client) {
    this.client = client;
    this.failureCounts = new Map(); // key -> failure count
    this.circuitBreakers = new Map(); // key -> cooldown until timestamp
    this.isHealing = false;
    this.MAX_RETRIES = 3;
    this.COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Kiểm tra xem một tác vụ có đang bị ngắt bởi Circuit Breaker hay không
   */
  isCircuitOpen(taskKey) {
    const cooldownUntil = this.circuitBreakers.get(taskKey);
    if (!cooldownUntil) return false;
    if (Date.now() > cooldownUntil) {
      this.circuitBreakers.delete(taskKey);
      this.failureCounts.delete(taskKey);
      return false;
    }
    return true;
  }

  /**
   * Ghi nhận lỗi và kích hoạt Circuit Breaker nếu vượt quá số lần thử lại
   */
  recordFailure(taskKey, errorInfo) {
    if (this.failureCounts.size > 100) {
      this.failureCounts.clear();
      this.circuitBreakers.clear();
    }
    const current = (this.failureCounts.get(taskKey) || 0) + 1;
    this.failureCounts.set(taskKey, current);

    if (current >= this.MAX_RETRIES) {
      const cooldownUntil = Date.now() + this.COOLDOWN_MS;
      this.circuitBreakers.set(taskKey, cooldownUntil);
      console.log(`  [!] [Circuit Breaker] Tác vụ [${taskKey}] đã đạt giới hạn an toàn. Tạm hoãn 15 phút để bảo vệ luồng chơi chính.`);
      return true; // Circuit opened
    }
    return false;
  }

  /**
   * Ghi nhận thành công để reset bộ đếm lỗi
   */
  recordSuccess(taskKey) {
    this.failureCounts.delete(taskKey);
    this.circuitBreakers.delete(taskKey);
  }

  /**
   * Tự chẩn đoán mã lỗi server (ReturnCode 102226) và thực hiện hành động khắc phục
   */
  async diagnoseAndFix(reqId, returnCode) {
    if (this.isHealing) return { handled: false };
    const taskKey = `REQ_${reqId}_${returnCode}`;
    if (this.isCircuitOpen(taskKey)) {
      return { handled: false, message: 'Circuit is open' };
    }

    this.isHealing = true;
    try {
      switch (returnCode) {
        case 100014: // Thiếu đạo cụ / trang phục chưa sở hữu
          if (reqId === 105102) {
            this.recordSuccess(taskKey);
            return { handled: true, action: 'BOOK_NOT_ENOUGH' };
          }
          if (reqId === 112109 || reqId === 129101) {
            console.log(`  [-] [Self-Healer] Khắc phục 100014: Cập nhật lại tủ đồ...`);
            if (this.client.clothesService) {
              await this.client.clothesService.fetchWardrobe();
            }
          }
          this.recordSuccess(taskKey);
          return { handled: true, action: 'ITEM_NOT_ENOUGH' };

        case 109016: // Đã nhận phần thưởng hoặc chưa đủ điều kiện
          if (reqId === 102103) {
            // Phúc lợi VIP hôm nay đã nhận
            this.recordSuccess(taskKey);
            return { handled: true, action: 'VIP_ALREADY_CLAIMED' };
          }
          if (reqId === 162104 || reqId === 162102) {
            // Mục tiêu 7 ngày đã nhận
            this.recordSuccess(taskKey);
            return { handled: true, action: 'SEVEN_DAY_ALREADY_CLAIMED' };
          }
          if (reqId === 112109) {
            console.log(`  [-] [Self-Healer] Khắc phục 109016: Ải thời trang cần trang phục phù hợp. Tự động cập nhật tủ đồ...`);
            if (this.client.clothesService) {
              await this.client.clothesService.fetchWardrobe();
            }
            this.recordSuccess(taskKey);
            return { handled: true, action: 'FETCH_WARDROBE' };
          }
          this.recordSuccess(taskKey);
          return { handled: true, action: 'ALREADY_CLAIMED' };

        case 130001: // Đánh ải thường bị chặn (Đang ở Ải Boss hoặc Lựa chọn đối thoại)
          console.log(`  [-] [Self-Healer] Khắc phục 130001: Ải yêu cầu hình thức đặc biệt (Boss / Trang phục).`);
          this.recordSuccess(taskKey);
          return { handled: true, action: 'SPECIAL_STAGE_NOTIFIED' };

        case 129001: // Hoạt động chưa mở hoặc không thuộc phân hệ này
        case 129003: // Chưa đủ điều kiện nhận quà sự kiện
        case 164001: // Hết lượt xem video
        case 164002: // Kênh video chưa mở
          this.recordSuccess(taskKey);
          return { handled: true, action: 'ACTIVITY_STATUS_NOTIFIED' };

        case 146052: // Tùy tùng hiện tại đã hết lượt xuất chiến Boss
          console.log(`  [-] [Self-Healer] Khắc phục 146052: Tùy tùng đã hết lượt đánh Boss hôm nay.`);
          this.recordSuccess(taskKey);
          return { handled: true, action: 'BOSS_ATTEMPTS_EXHAUSTED' };

        case 105001: // Nhiệm vụ đã hoàn thành hoặc trạng thái không hợp lệ
          console.log(`  [-] [Self-Healer] Khắc phục 105001: Làm mới thông tin nhiệm vụ...`);
          if (this.client.quest) {
            this.client.send(124101, {});
            this.client.send(124103, {});
          }
          this.recordSuccess(taskKey);
          return { handled: true, action: 'REFRESH_QUESTS' };

        case 118001: // Đã bái kiến BXH hôm nay
          if (this.client.rankService) {
            this.client.rankService.hasWorshipedToday = true;
          }
          this.recordSuccess(taskKey);
          return { handled: true, action: 'RANK_WORSHIP_DONE' };

        case 127002: // Chưa đủ Uy vọng thăng chức
          this.recordSuccess(taskKey);
          return { handled: true, action: 'LEVEL_EXP_NOT_ENOUGH' };

        case 131002: // Đã nhận mốc thân mật này rồi
          this.recordSuccess(taskKey);
          return { handled: true, action: 'INTIMACY_REWARD_CLAIMED' };

        case 114006: // Chưa đủ EXP để nâng kỹ năng Tri Kỷ
          this.recordSuccess(taskKey);
          return { handled: true, action: 'WIFE_EXP_NOT_ENOUGH' };

        case 114002: // Hết thể lực vấn an Tri Kỷ
          this.recordSuccess(taskKey);
          return { handled: true, action: 'HAREM_ENERGY_EMPTY' };

        case 124001: // Thành tựu chưa đạt hoặc đã nhận
          this.recordSuccess(taskKey);
          return { handled: true, action: 'ACHIEVEMENT_CLAIMED' };

        case 100010: // Vàng không đủ
        case 100011: // Bạc không đủ
        case 100012: // Dược thảo không đủ
        case 100013: // Lương thực không đủ
        case 100015: // Binh lực không đủ
        case 100016: // Đạt cấp tối đa
        case 113007: // Chưa đủ điều kiện đề bạt Tùy Tùng
        case 113008: // Đạt phẩm cao nhất
        case 113021: // Đạt cấp tư chất tối đa
        case 128003: // Chưa hoàn thành mục tiêu hoặc đã nhận
        case 153009: // Tính năng Vườn Hoa chưa mở khóa
        case 153010:
        case 153038: // Chưa có tranh thêu hoàn thành
        case 153039: // Không có bong bóng hoa
        case 147035: // Không có giọt sương
        case 113001: // Đã bái kiến hoặc dữ liệu bình thường
        case 113011: // Tùy tùng đã xuất chiến Boss
        case 142001: // Đất nông trại chưa chín
        case 217001: // Phòng học chưa mở
          this.recordSuccess(taskKey);
          return { handled: true, action: 'NORMAL_FEATURE_STATUS' };

        default:
          this.recordFailure(taskKey, `ReturnCode ${returnCode}`);
          return { handled: false, message: `Mã lỗi chưa có kịch bản xử lý tự động: ${returnCode}` };
      }
    } finally {
      this.isHealing = false;
    }
  }
}

module.exports = SelfHealer;
