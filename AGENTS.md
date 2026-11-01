# Rules
Tool fail: ghi lỗi + cách sửa ngắn gọn vào `SYNTAX.md` trước khi tiếp tục.
Commit/PR: cấm chèn thêm thông tin/attribution Claude (Co-Authored-By, Generated with Claude, v.v.).
Comment code: cấm chú thích kiểu AI (dài dòng, giải thích điều hiển nhiên). Chú thích gọn sạch, chỉ nêu lý do ("why") khi thực sự cần như dev con người chuyên nghiệp (trong code có comment code nào chưa chuẩn thì sửa lại luôn cho chuẩn).
Clean code: xóa bỏ code thừa, biến/hàm/import không dùng tới, tránh để code rác.
Code style: tuân thủ ESLint (không Prettier); file <= 1000 dòng; đặt tên nhất quán (PascalCase cho Component/Class, camelCase cho hàm/biến); FE dùng Modal/ConfirmModal chuẩn (cấm alert/confirm); BE bọc transaction khi ghi nhiều bảng.
Review: luôn chạy `git diff` rà soát trước khi báo; kiểm tra chặt type safety (hạn chế tối đa `any`); cấm tự ý commit/push khi chưa có lệnh; đảm bảo lint/build sạch.
Multi-agent: phân ranh giới rõ ràng giữa FE và BE; cấm 2 agent cùng chỉnh sửa 1 file gây xung đột; agent con chỉ xử lý đúng phạm vi được giao và tóm tắt kết quả cốt lõi.
Không được để lộ env trong code hay tài liệu public.
# 👑 QUY CHUẨN KIẾN TRÚC BOT (100% SERVER-AUTHORITATIVE STATE SYNC)
Tài liệu này là **QUY TẮC BẮT BUỘC VÀ BẤT KHẢ XÂM PHẠM** (Always-On Workspace Rule) áp dụng cho mọi lượt tương tác, lập trình, bảo trì và mở rộng hệ thống Bot Game (`hhgl`, `hhgl-dau-tai-nghe`, `hhgl-ngan`, `hhgl-dk`, `hhgl-source`).
## 🚫 1. CẤM LƯU FILE TRẠNG THÁI TĨNH
1. **Tuyệt đối KHÔNG ghi trạng thái game ra file đĩa cục bộ:**
- ❌ **CẤM:** Không tạo các file như `daily_state.json`, `game_state.json`, `cache_state.json` để lưu cờ "đã bái kiến", "đã nhận quà", "đã thỉnh an", v.v.
- ❌ **Lý do:** Khi người chơi đăng nhập trên điện thoại, máy tính khác hoặc khi server reset ngày/rollback, các file tĩnh trên máy sẽ bị lệch pha với Server dẫn đến mất đồng bộ, bỏ sót quà hoặc gửi request sai lệch.
2. **Server Game là Nguồn Chân Lý Duy Nhất (Single Source of Truth):**
- Mọi quyết định hành động đều phải dựa trên dữ liệu thời gian thực được Server trả về qua các gói tin WebSocket Protocol.
## 🔄 2. QUY CHUẨN THỰC THI SERVICE (SERVER SYNC)
1. **Quy trình 4 bước bắt buộc:**
- Mọi Service trước khi hành động bắt buộc tuân theo: **[1] Gửi query truy vấn mới nhất $\rightarrow$ [2] Đợi response từ Server $\rightarrow$ [3] Kiểm tra cờ trạng thái thật $\rightarrow$ [4] Thực thi & log kết quả**. *(Chi tiết code mẫu, checklist protobuf và bảng tra cứu Protocol xem tại `task.md`).*
2. **Quy tắc in log minh bạch 100% (Không in ID số trần trụi):**
- ❌ **CẤM IN ID SỐ TRẦN:** Tuyệt đối không in các mã số như `[ID: 10012001]`, `[ID: 10014]`, `[Mục Tiêu 10012001]`, `[Thành Tựu 101001]`.
- ✅ **BẮT BUỘC IN TÊN / MÔ TẢ TIẾNG VIỆT:** Phải map ID sang Tên/Nội dung trong file cấu hình. Nhận quà thành công phải bóc tách chi tiết phần thưởng. Server trả mã lỗi phải báo rõ mã lỗi.
## ⚡ 3. QUY TẮC CẬP NHẬT TRẠNG THÁI MỚI (FRESH STATE RE-SYNC)
- Khi tài khoản trải qua các hoạt động làm thay đổi thuộc tính (vượt ải, thăng quan, tăng Binh/Thế lực, dùng đan): Luôn truy vấn lại Server trước khi nhận thưởng liên quan (Thành tựu, 7 Ngày, Nhiệm vụ) để bắt kịp các mốc mới đôn lên.
- Tuyệt đối không tự tính toán trong Client rồi suy ra trạng thái, luôn đợi gói tin xác nhận từ Server.
## 📏 4. QUY TẮC GIỚI HẠN DÒNG MÃ NGUỒN (MAX 1000 LINES PER FILE)
1. **Cấm vượt quá 1000 dòng code:** Không viết file God Object, không nhồi nhét HTML/CSS/JS chung vào một file JavaScript lớn.
2. **Quy chuẩn module hóa bắt buộc:** Khi file tiệm cận 500 - 800 dòng, chủ động tách nhỏ ra module độc lập. File UI Web tách riêng `index.html`, `style.css`, `app.js`.
3. **Ngoại lệ duy nhất:** Các file từ điển/dữ liệu tĩnh JSON thuần dữ liệu từ game (`item_names.json`, `main_tasks.json`, `proto.json`).
## 🛑 5. QUY TẮC QUẢN LÝ GIT COMMIT & PUSH: CHỈ COMMIT KHI USER YÊU CẦU
1. **Tuyệt đối KHÔNG tự ý thực hiện `git commit` hay `git push`** nếu chưa có lệnh rõ ràng từ người dùng.
2. **Chỉ commit khi người dùng yêu cầu trực tiếp** (ví dụ: "commit đi", "commit giúp", "lưu commit này",...).
## 🔒 6. QUY TẮC BẢO MẬT & BIẾN MÔI TRƯỜNG: CẤM FALLBACK VÀ LỘ ENV VÀO CODE
1. **Tuyệt đối KHÔNG sử dụng Fallback (`||`, `&&`, hoặc toán tử 3 ngôi `? :` để gán giá trị mặc định cho biến môi trường / trạng thái):** Kiểm tra kiểu (`typeof`, `if/else`) tường minh và chuẩn mực.
2. **Tuyệt đối KHÔNG gán cứng (hardcode) giá trị bí mật / cấu hình `.env` vào mã nguồn:** Không chèn URL, mật khẩu, ID bí mật, auth token hay thông số game làm giá trị fallback/dự phòng trong code.
3. **Kiểm định 100% biến môi trường bắt buộc khi khởi động (Fail-Fast):** Nạp trực tiếp từ `process.env`. Thiếu bất kỳ biến nào phải ném lỗi (`throw new Error(...)`) và dừng ngay lập tức.
## 🛡️ 7. NGUYÊN TẮC BẢO TOÀN TÀI NGUYÊN & QUẢN LÝ PHIÊN (ZERO RESOURCE CONSUMPTION & AUTO-OFF)
1. **Bảo toàn tài nguyên game 100%:** Tuyệt đối KHÔNG tự ý dùng Vàng, Bạc, Đan dược quý trừ các tính năng mua miễn phí hoặc lượt quay free mỗi ngày. Không mua thêm lượt hay nâng cấp tốn phí nếu không có lệnh.
2. **Xử lý ngắt kết nối an toàn khi bị đăng nhập nơi khác (`101203 ResSubstitute`):** Ngắt socket ngay lập tức, OFF bot luôn để tránh tranh chấp session.
3. **Quản lý vòng đời phiên & giải phóng bộ nhớ (No Memory Leak):** Thực thi xong task phải đóng WebSocket (`client.close()`). Dọn sạch timer heartbeat, ping-pong, timeout và listeners khi ngắt kết nối.
## 💬 8. QUY TẮC CHÚ THÍCH & COMMENT TỐI GIẢN (NO DECORATIVE BANNERS)
1. **Loại bỏ chú thích thừa và trang trí hoa văn:** Cấm comment banner hoa văn trang trí (`// ------------`, `// ============`, `# ============`). Cấm comment lặp lại hiển nhiên hành động của code.
2. **Tối ưu viết chú thích ngắn gọn, súc tích:** Tối đa 1 dòng mô tả, chỉ giữ lại chú thích giải thích lý do (Why) thật sự cần thiết.