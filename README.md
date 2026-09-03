# 👑 Bot Game Hoàng Hậu Cát Tường (`hhgl`)

## ⚡ 1. Khởi Động Nhanh

### Cài đặt dependencies:
```bash
npm install
```

### Chạy Bot trên máy tính:
1. Tạo file `.env` từ cấu hình mẫu:
   ```ini
   GAME_EMAIL=your_email@gmail.com
   GAME_PASSWORD=your_password
   GAME_SERVER_ID=1105
   GAME_ACTION=auto
   ```
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
4. Cài đặt các **Environment Variables**:
   - `GAME_EMAIL`: Email tài khoản game
   - `GAME_PASSWORD`: Mật khẩu tài khoản game
   - `GAME_SERVER_ID`: `1105` (hoặc ID Server của bạn)
   - `GAME_ACTION`: `auto` (chạy chế độ Treo máy 24/7)
5. Mở URL Render trên trình duyệt để theo dõi **Web Dashboard Realtime** (tự động reload khi có bản build mới).

---

## 🎮 3. Danh Mục Chức Năng (Menu)

| Phím | Chức năng | Chi tiết hoạt động |
|:---:|---|---|
| **`1` / `auto`** | 🔄 **Auto 24/7 Treo Máy Toàn Diện** | **Tự động hóa hoàn toàn:** Nhận 5 Tab Phúc Lợi, Hộp Thư, 7 Ngày Vui Vẻ, Thành Tựu Cung Đình, Thích 6 Bảng Xếp Hạng, Thỉnh An Trường Xuân Cung, Nhận Thưởng Nhiệm Vụ (Chính Tuyến & Tước Vị), cắn Đan Dược, đọc Thư Tùy Tùng, nâng cấp & xếp Học Viện (canh chính xác 0s delay). Vòng lặp 24/7: Canh thu hoạch Nội Vụ & Cung Vụ từng giây, đúc Bạc lên cấp Tùy Tùng, bắt sự kiện Server nhận thưởng tức thì, tự động nhận quà ngày mới lúc 00:00! |
| **`0`** | 🚪 **Thoát Game** | Ngắt kết nối an toàn và đóng ứng dụng. |
