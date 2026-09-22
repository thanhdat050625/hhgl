# 📊 BẢNG QUÉT TOÀN BỘ TÍNH NĂNG KIẾM VÀNG & CUNG VẬN TRONG GAME (CHƯA LÀM TOOL)

Tài liệu này được trích xuất và đối chiếu trực tiếp 100% từ cấu hình game ([ResourceConfig_json.json](file:///d:/UTE/hhgl/_source_game/config_tables/ResourceConfig_json.json), [GetPathConfig_json.json](file:///d:/UTE/hhgl/_source_game/config_tables/GetPathConfig_json.json)), mã nguồn máy khách game ([main.min.js](file:///d:/UTE/hhgl/_source_game/js/main.min.js)) và bảng mã gói tin WebSocket ([protoId.json](file:///d:/UTE/hhgl/proto/protoId.json)).

---

## 🌟 PHẦN 1: HIỆN TRẠNG ĐÃ TÍCH HỢP TRONG CHẾ ĐỘ AUTO 24/7
Hiện tại, bot của bạn đã tự động thu thập Vàng & Cung Vận từ **12 nguồn**:
1. ✅ **Điểm danh hàng ngày** (`102102`): Vàng miễn phí.
2. ✅ **Thưởng Online tích lũy** (`151102`): Nhận Vàng theo mốc thời gian treo máy (lên đến 120 phút).
3. ✅ **Đăng nhập 7 ngày** (`152102`): Vàng mốc ngày.
4. ✅ **Cầu nguyện miễn phí** (`128101`): Vàng, Thẻ cầu nguyện & vật phẩm.
5. ✅ **Hộp thư hệ thống** (`117102`): Vàng đền bù, bảo trì và thưởng sự kiện.
6. ✅ **Mục tiêu 7 Ngày Vui Vẻ** (`162102` & `162104`): Rương Vàng & Cung Vận.
7. ✅ **Thành tựu Cung Đình** (`125103`): Hàng ngàn Vàng tích lũy theo từng mốc phát triển.
8. ✅ **Thích 6 Bảng Xếp Hạng** (`113103`): Nhận Vàng & Bạc mỗi ngày.
9. ✅ **Thỉnh An Trường Xuân Cung** (`114102`): Nhận 10 Vàng mỗi ngày.
10. ✅ **Nhiệm vụ Chính Tuyến & Tước Vị** (`124102`, `124108`): Nhận Vàng & Cung Vận.
11. ✅ **Duyệt Sự Vụ Triều Đình** (`105103`): Nhận Cung Vận chính yếu để thăng quan.
12. ✅ **Đọc Thư Tùy Tùng** (`105109`): Nhận Vàng & Cung Vận từ các thư gửi về.

---

## 💰 PHẦN 2: CÁC NGUỒN KIẾM VÀNG (GOLD) CHƯA LÀM TOOL

Dưới đây là các tính năng tồn tại trong game có thể **kiếm thêm rất nhiều Vàng miễn phí** mà hiện tại chưa có tool:

| STT | Phân Hệ Game | Cơ Chế Nhận Vàng | Mã Protocol C2S / S2C | Lượng Vàng Dự Kiến | Mức Ưu Tiên |
|:---:|---|---|---|---|:---:|
| **1** | 🎁 **Rương Năng Động Ngày** (`QuestEveryDay`) | Mỗi ngày khi thu hoạch, bồi dưỡng, vượt ải... bạn tích điểm sôi nổi (30, 60, 90, 120, 150 điểm). Mở 5 rương này sẽ nhận được **Vàng** và Đan Dược quý. | • `124103` (ReqQuestEveryDayInfo)<br>• `124106` (ReqQuestEveryDayActiveAward: `{ id }`)<br>• `124110` (Nhận nhanh toàn bộ) | **30 - 100 Vàng / ngày** | 🔴 **Tier S** (Cực dễ làm, nhận hàng ngày) |
| **2** | 🚶 **Du Ngoạn Lạc Dương** (`Visit`) | Tự hồi 15/15 thể lực theo thời gian (mỗi 30 phút hồi 1 điểm). Đi du ngoạn các địa điểm thành Lạc Dương gặp sự kiện ngẫu nhiên nhặt được **Vàng**, Bạc, Binh Lực và làm quen Tri Kỷ mới. | • `109101` (ReqVisitInfo)<br>• `109103` (ReqBeginVisit: `{ type: 1 }`)<br>• `109104` (ReqFinishVisit) | **20 - 50 Vàng / ngày** + tài nguyên khủng | 🔴 **Tier S** (Hồi theo thời gian 24/7) |
| **3** | 💕 **Thân Mật Tri Kỷ / Hậu Cung** (`Wife`) | Tự hồi 3/3 năng lượng vấn an Tri Kỷ. Khi tích điểm Thân Mật lên các mốc Lv.2, Lv.3... sẽ bấm nhận thưởng **Vàng** cấp độ thân mật (`RewardNearLv`). | • `106101` (ReqCallWife)<br>• `106102` (ReqLoveWife)<br>• `106110` (ReqRewardNearLv: `{ wifeId }`) | **50 - 200 Vàng / mốc** | 🔴 **Tier S** (Tự hồi lượt vấn an) |
| **5** | ⏳ **Sự Kiện Hạn Giờ** (`ActivityLimit` / `LimitTime`) | Các sự kiện diễn ra theo chu kỳ 3 - 7 ngày: Đua tiêu Bạc, Đua thế lực, Tiêu Binh Lực, Vượt ải... Khi bot tự chơi sẽ vô tình đạt các mốc này và có thể bấm nhận **Rương Vàng** miễn phí. | • `136101` (ReqActivityLimitInfo)<br>• `136103` (ReqActivityLimitAward: `{ id }`)<br>• `135104` (ReqActivitySprintAward) | **100 - 500 Vàng / đợt sự kiện** | 🟡 **Tier A** (Nguồn Vàng khổng lồ) |
| **6** | ⚔️ **Cung Luận Chiến / Tranh Tài** (`Court` / `Debate`) | Đấu trí Tùy Tùng tại Triều Đình / Phụng Thần Bảng. Đánh bại Tùy Tùng của đối thủ nhận ngay Vàng và Điểm Danh Vọng đổi sách. | • `119101` (ReqCourtInfo)<br>• `119104` (ReqCourtFight: `{ helperId }`)<br>• `119105` (ReqCourtAward) | **30 - 80 Vàng / ngày** | 🟢 **Tier B** |
| **7** | 📜 **Giftcode / Mã Đổi Quà** (`PlayerCdKey`) | Hệ thống nhập mã Code quà tặng của nhà phát hành (Fanpage, Group, Sự kiện). Mỗi code thường chứa từ 100 đến 1000 Vàng. | • `102107` / `102108` (ReqUseCdKey: `{ code }`) | **100 - 1,000 Vàng / code** | 🟢 **Tier B** (Tool nhập code tự động) |
---

## 👑 PHẦN 3: CÁC NGUỒN KIẾM CUNG VẬN (EXP THĂNG CHỨC) CHƯA LÀM TOOL

Cung Vận là chỉ số quan trọng nhất quyết định tốc độ **Thăng Quan / Thăng Tước Vị** của nhân vật (từ Đáp Ứng $\rightarrow$ Thường Tại $\rightarrow$ Quý Nhân $\rightarrow$ Tần $\rightarrow$ Phi $\rightarrow$ Quý Phi $\rightarrow$ Hoàng Hậu). Dưới đây là các nguồn Cung Vận chưa làm tool:

| STT | Phân Hệ Game | Cơ Chế Kiếm Cung Vận | Mã Protocol C2S / S2C | Lượng Cung Vận Nhận Được | Mức Ưu Tiên |
|:---:|---|---|---|---|:---:|
| **1** | 🎁 **Rương Năng Động Ngày** (`QuestEveryDayActive`) | Ngoài Vàng, các mốc Rương Năng Động 60, 120 điểm tặng kèm các túi **Đan Cung Vận** hoặc điểm Cung Vận trực tiếp. | • `124106` (ReqQuestEveryDayActiveAward) | **+50 đến +150 Cung Vận / ngày** | 🔴 **Tier S** |
| **2** | 🚶 **Du Ngoạn Gặp Cơ Duyên** (`Visit`) | Khi đi dạo các cổng thành Lạc Dương, các sự kiện đố vui, giải quyết tranh chấp dân gian, vi hành sẽ ban thưởng điểm **Cung Vận** trực tiếp. | • `109103` (ReqBeginVisit)<br>• `109104` (ReqFinishVisit) | **+30 đến +100 Cung Vận / ngày** | 🔴 **Tier S** |
| **3** | 💕 **Kỹ Năng Tri Kỷ (Hậu Cung)** (`WifeSkill`) | Mỗi Tri Kỷ đều có hệ thống Kỹ Năng Hậu Cung (Skill). Dùng điểm kinh nghiệm vấn an để nâng cấp skill $\rightarrow$ Cộng thẳng hàng trăm % điểm Cung Vận cho nhân vật và Tùy Tùng! | • `106104` (ReqWifeSkillUp: `{ wifeId, skillId }`) | **Tăng vĩnh viễn % Cung Vận** | 🔴 **Tier S** |
| **4** | 🏪 **Tiệm Bang Hội (Đổi Đan Cung Vận)** (`AllianceShop`) | Dùng điểm Cống Hiến Bang tích lũy hàng ngày vào Tiệm Bang đổi lấy **Cung Vận Đan** (mỗi viên cắn vào tăng 100 - 500 Cung Vận). | • `146113` (ReqAllianceShopInfo)<br>• `146114` (ReqBuyAllianceShop) | **+100 đến +300 Cung Vận / ngày** | 🟡 **Tier A** |
| **5** | 📖 **Minh Tương Ngoại Truyện** (`Gaiden` / `CardStory`) | Phó bản cốt truyện riêng của từng Tùy Tùng / Tri Kỷ (FunctionID `14300` trong `GetPathConfig`). Vượt các ải này ban thưởng lượng lớn Cung Vận. | • `168101` (ReqCardScene)<br>• `168103` (ReqCardFight)<br>• `168106` (ReqCardRewardBox) | **+200 đến +1,000 Cung Vận / chương** | 🟡 **Tier A** |
| **6** | ⏳ **Sự Kiện Tích Điểm Hạn Giờ** (`EventRankPoint` / `12801`) | Nhận quà các mốc điểm sự kiện tích lũy trong `ResourceConfig.list['1']`. | • `140101` (ReqEventActivityInfo)<br>• `140108` (ReqEventActivityRankReward) | **+100 đến +500 Cung Vận / đợt** | 🟢 **Tier B** |

---

## 🎯 PHẦN 4: ĐỀ XUẤT LỘ TRÌNH TRIỂN KHAI TỐI ƯU NHẤT (THEO THỨ TỰ HIỆU QUẢ)

Để tối đa hóa lượng **Vàng & Cung Vận** thu được mỗi ngày mà vẫn giữ code siêu gọn gàng, chạy realtime 0s delay và tích hợp thẳng vào `[1] Auto 24/7`:

### 🥇 Giai Đoạn 1 (Nên làm ngay - Đem lại Vàng & Cung Vận mỗi ngày cực lớn):
1. **Rương Năng Động Ngày (`124106` / `124110`)**:
   - *Lý do*: Bạn đã làm hết các việc trong ngày (thu hoạch, bồi dưỡng, vượt ải, thích bxh...), điểm năng động tự động đạt mốc 150/150 nhưng hiện tại **chưa bấm nhận rương**.
   - *Hiệu quả*: Kiếm ngay **50 - 100 Vàng + 100 Cung Vận** mỗi ngày hoàn toàn tự động!
2. **Du Ngoạn Lạc Dương (`VisitService` - `109101`, `109103`, `109104`)**:
   - *Lý do*: Thể lực du ngoạn tự hồi liên tục 24/7 (30 phút/điểm).
   - *Hiệu quả*: Nhặt Vàng, Cung Vận, mở khóa thêm Tri Kỷ mới!
3. **Hậu Cung & Vấn An Tri Kỷ (`WifeService` - `106101`, `106104`, `106110`)**:
   - *Lý do*: Tự hồi năng lượng vấn an (3/3), bấm vấn an nhận exp nâng skill Cung Vận và nhận Vàng mốc thân mật.

### 🥈 Giai Đoạn 2 (Mở rộng khi tham gia Bang hội & Sự kiện):
4. **Bang Hội / Liên Minh (`AllianceService`)**: Cống hiến, đánh boss bang, nhặt Lì Xì Vàng, đổi Đan Cung Vận.
5. **Nhận Quà Sự Kiện Hạn Giờ (`ActivityLimitService`)**: Tự động gom sạch Vàng từ các sự kiện đua top/hạn giờ mà người chơi vô tình đạt mốc.
