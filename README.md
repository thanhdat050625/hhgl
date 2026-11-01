# 👑 Bot Game (`hhgl`)

## ⚡ 1. Khởi Động Nhanh

### Cài đặt dependencies:
```bash
npm install
```

### Chạy Bot trên máy tính:
1. Tạo file `.env` từ cấu hình mẫu:
   ```ini
   PORT=10000
   NOTE_URL=https://your-notes-server.com/notes/your-note-id
   NOTE_LOGIN_URL=https://your-notes-server.com/auth/login
   NOTE_SAVE_URL=https://your-notes-server.com/notes/admin/manager/action/save
   NOTE_PASSWORD=your_password
   NOTE_ID=your_note_id
   NOTE_TITLE=your_note_title
   NOTE_POLL_INTERVAL_MS=10000
   ...
   ```
   *(Cấu hình serverId trực tiếp trong Web Note cho từng tài khoản, ví dụ: `["user@example.com", "pass", "on", 1105]`)*
2. Chạy bot:
   ```bash
   npm start
   ```

---

## ☁️ 2. Triển Khai Treo Máy 24/7 Trên Render (Miễn Phí)

1. Đẩy code lên GitHub cá nhân.
2. Truy cập [Render.com](https://render.com) -> **New Web Service** -> Chọn repository.
3. Cấu hình:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Cài đặt các **Environment Variables** từ file `.env.prod`.
   *(Lưu ý: Server ID được cấu hình trực tiếp trên Web Note cho từng tài khoản).*
5. Mở URL Render trên trình duyệt để theo dõi **Web Dashboard Realtime** (tự động reload khi có bản build mới).

---

## 🎮 3. Danh Mục Chức Năng (Menu)

| Phím | Chức năng | Chi tiết hoạt động |
|:---:|---|---|
| **`1` / `auto`** | 🔄 **Auto 24/7 Treo Máy Toàn Diện (All-In-One)** | **Tự động hóa hoàn toàn 100% tất cả các phân hệ:**<br>• **Phúc Lợi & Báo Danh:** 5 Tab Phúc Lợi, Hộp Thư, 7 Ngày Vui Vẻ, Thành Tựu Cung Đình, Bái kiến 6 BXH, Thỉnh An Hoàng Cung, Online Reward.<br>• **Nhiệm Vụ & Tước Vị:** Nhận thưởng Nhiệm Vụ Chính Tuyến, Nhiệm Vụ Tước Vị & 5 Rương Năng Động Ngày.<br>• **Hậu Cung & Tri Kỷ:** Tự động vấn an Lam Nhan (`106101`), nhận Vàng mốc Thân Mật (`106110`).<br>• **Túi Đồ & Mở Rương:** Tự động mở sạch tất cả các loại Rương Vàng (Rương Vàng May Mắn, Quà 1 Đồng/6 Đồng, Lễ Bao Tước Vị) và Hộp Quà Cung Vận (`10013`, `10014`, `15003`), cắn Đan Dược tăng trưởng.<br>• **Chiến Đấu & Vượt Ải:** Tự động Vượt Ải Cốt Truyện, trảm Boss và Giáo Huấn kẻ thù tại Đại Lý Tự.<br>• **Tùy Tùng & Học Viện:** Đọc Thư Tùy Tùng, nâng Tư Chất, thăng Phẩm, đúc Bạc lên Cấp, canh Học Viện chính xác 0 giây delay.<br>• **Nội Vụ & Cung Vụ:** Thu hoạch Bạc, Lương, Binh từng giây; xử lý sạch Cung Vụ miễn phí trước, sau đó dùng Cung Vụ Lệnh trong thời gian chờ cooldown để tối đa Cung Vận.<br>• **Sự Kiện Hạn Giờ & Hoa Đăng:** Tự động mua 20 Bảo Liên Đăng (Bạc) mỗi ngày, thả đèn chúc phúc, đổi điểm thưởng, nhận quà đua top xếp hạng (`140108`).<br>• **Bảo Vệ RAM 24/7:** Tích hợp Memory Leak Guard dọn dẹp bộ nhớ định kỳ, treo máy ngày đêm không nóng máy, không tràn RAM! |
| **`2`** | ⏳ **Sự Kiện Hạn Giờ (EventRankPoint)** | Tự động đồng bộ các sự kiện đang diễn ra (`127111`), kiểm tra chi tiết sự kiện tích điểm (`140101`), đối chiếu hạng & trạng thái (`140107`), tự động bấm nhận thưởng xếp hạng (`140108`) lấy Cung Vận và Vàng. |
| **`0`** | 🚪 **Thoát Game** | Ngắt kết nối an toàn và đóng ứng dụng. |
