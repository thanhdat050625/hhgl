# 📋 TÀI LIỆU HƯỚNG DẪN CODE & THEO DÕI TÁC VỤ (TASK & CODE GUIDE)
## 🔄 1. HƯỚNG DẪN LẬP TRÌNH SERVICE (CHU TRÌNH 4 BƯỚC)
Mỗi khi một Service bắt đầu thực thi một tác vụ (Bái kiến, Thỉnh an, Nhận quà 7 ngày, Thành tựu, Thu hoạch, Vượt ải, Vườn hoa, Nông trại, Học viện, Bang hội, Nuôi mèo, Câu cá, Đấu tài nghệ...), code **BẮT BUỘC** phải tuân theo chu trình 4 bước:
```
[ 1. Send Request Query ] ──► [ 2. Await Server Response ] ──► [ 3. Validate Server Flags ] ──► [ 4. Execute & Log Result ]
```
### Bước 1: Gửi Request truy vấn dữ liệu mới nhất
- Luôn gửi gói tin truy vấn thông tin trước khi hành động (Ví dụ: `113101` cho BXH, `114101` cho Hoàng Cung, `162101` cho 7 Ngày, `125102` cho Thành Tựu, `102101` cho Nội Vụ, `153101` cho Vườn Hoa, `142101` cho Trang Viên, `250101` cho Đấu Tài Nghệ, `160101` cho Nuôi Mèo, `170101` cho Câu Cá).
- Reset biến tạm trước khi gửi để đảm bảo không đọc nhầm dữ liệu cũ:
```javascript
this.client.rankLocalInfo = null;
this.send(113101, {});
await this.sleepRandom(1.2, 2.0);
```
### Bước 2: Đợi & Bắt gói tin Response từ Server
- Trong `GameClient.js`, định tuyến chính xác mã `msgId` của Response và gán vào thuộc tính tương ứng của client.
### Bước 3: Kiểm tra cờ trạng thái thật từ Server
- Đọc trực tiếp các trường trạng thái được định nghĩa trong Protobuf của Server:
  - **Bái Kiến BXH (`113201`):** Kiểm tra `serverRank.isWorship === 1` (Đã bái) hay `0` (Chưa bái).
  - **Thỉnh An Hoàng Cung (`114201`):** Kiểm tra `palaceInfo.isHi === true` (Đã thỉnh an) hay `false`.
  - **Mục Tiêu 7 Ngày (`162201`):** Kiểm tra `t.status === 1` và `!rewardList.includes(t.id)`.
  - **Thành Tựu Cung Đình (`125202`):** Kiểm tra `a.state === 1` (Đủ điều kiện nhận thưởng).
  - **Báo Danh Hàng Ngày (`102201`):** Kiểm tra `attrMap[114]` (1 = đã báo danh, 0 = chưa).
  - **Vườn Hoa (`153201`, `153217`):** Đọc `canStealIds` để hái trộm, `canAssistantIds` để chăm hoa.
  - **Đấu Tài Nghệ (`250201`):** Kiểm tra `isEgg === true` để nhặt trứng, kiểm tra lượt thi đấu `remainTimes > 0`.
  - **Nuôi Mèo (`160201`):** Đọc trạng thái no đói (`satiety < 100`), trạng thái du ngoạn và trưởng thành.
### Bước 4: Thực thi hành động & In Log Minh Bạch 100% (Không In ID Số Trần Trụi)
- Luôn in rõ ràng kết quả phản hồi từ Server kèm Tên / Mô Tả Tiếng Việt:
  - ❌ **CẤM IN ID SỐ TRẦN:** Tuyệt đối không in các mã số như `[ID: 10012001]`, `[ID: 10014]`, `[Mục Tiêu 10012001]`, `[Thành Tựu 101001]`.
  - ✅ **BẮT BUỘC IN TÊN / MÔ TẢ TIẾNG VIỆT:** Phải map ID sang Tên/Nội dung trong file cấu hình (Ví dụ: `👉 Đang nhận: [Tổng tư chất Tùy Tùng đạt 10]...`, `👉 Đang nhận: [Thế Lực đạt 5,000]...`, `📝 Xử lý sự vụ: "Vườn Thuốc có một tiệm thuốc chưa tu sửa..."`).
  - Nếu nhận quà thành công $\rightarrow$ Bóc tách gói tin và in rõ chi tiết: `🎉 Nhận THÀNH CÔNG: +10 Vàng, +50,000 Bạc, +2 Ngân Phiếu`.
  - Nếu Server trả mã lỗi $\rightarrow$ Báo rõ mã lỗi để chẩn đoán.
## 📋 2. BẢNG TRA CỨU PROTOCOL ĐỒNG BỘ CÁC PHÂN HỆ
| Phân Hệ | Gói Request | Gói Response | Trường Trạng Thái Cần Kiểm Tra |
| :--- | :---: | :---: | :--- |
| 🏛️ **Hoàng Cung** | `114101` | `114201` | `isHi: bool` (`true`: đã thỉnh an, `false`: chưa). Lệnh nhận: `114102 { palaceId: 1 }`. |
| 👑 **Bái Kiến BXH** | `113101` | `113201` | `isWorship: int32` (`1`: đã bái, `0`: chưa). Lệnh nhận: `113103 { type: id }`. |
| 🎯 **Mục Tiêu 7 Ngày** | `162101` | `162201` | `targetList [ { id, status: 1 } ]` và `rewardList [ id ]`. Lệnh nhận: `162102 { id }`. |
| 🏆 **Thành Tựu** | `125102` | `125202` | `achievementList [ { achievementId, state: 1 } ]`. Lệnh nhận: `125103 { achievement: id }`. |
| 🌸 **Báo Danh** | `102102` | `102202` | `attrMap[114]` (`1`: đã điểm danh). |
| ⏳ **Thưởng Online** | `151101` | `151201` | `sec: int64` & `rewardList: [idx]` các mốc đã nhận. |
| 📅 **Đăng Nhập 7 Ngày** | `152101` | `152201` | `day: int32` & `rewardList: [id]`. Lệnh nhận: `152102 { id: day - 1 }`. |
| 👑 **Điểm Danh Tích Lũy** | `211101` | `211201` | `totalSignDay: int32` & `rewardSidList: [sid]`. Lệnh nhận: `211102 { rewardSid }`. |
| 🌳 **Cầu Nguyện Miễn Phí** | `128102` | `128202` | `YBCdTime: int32` (`0`: có lượt miễn phí). Lệnh quay: `128101`. |
| 🌸 **Vườn Hoa & Thêu Hoa** | `153101, 153113` | `153201, 153217` | `canStealIds` (trộm hoa), `canAssistantIds` (chăm hoa), thu hoạch `153103`, thêu `153110`. |
| 🌾 **Trang Viên Nông Trại** | `142101` | `142201` | `manorFuncDataInfo`. Thu hoạch `142105`, gieo hạt `142110`. |
| 📚 **Thư Viện / Học Viện** | `217107, 217108` | `217208` | `academyInfo`. Cho tùy tùng học `217104`, tốt nghiệp `217105`. |
| 🏰 **Bang Hội / Liên Minh** | `146113, 146124` | `146213, 146224` | Cống hiến bang `146118`, đánh boss bang `146126`. |
| 💼 **Nội Vụ (Thu Hoạch)** | `102101` | `102206` | `tradeInfoList [ { type, num > 0 } ]`. Lệnh thu: `102101 { type }`. |
| 📜 **Sự Vụ Triều Đình** | `105101` | `105201` | `workList [ { id } ]`. Lệnh duyệt: `105103 { id, choose }`. |
| 🎒 **Túi Đồ (Đan Dược)** | `104102` | `104202` | `propList [ { configId, num > 0 } ]`. Lệnh dùng: `104101 { propId, propNum }`. |
| ⚔️ **Tùy Tùng** | `103101` | `103201` | `helperInfoList [ { helperId, lv, exp } ]`. Lệnh nâng cấp: `103102`. |
| ⚔️ **Vượt Ải Cốt Truyện** | `112101` | `112201` | `sceneInfo` & `helperStateList`. Lệnh đánh: `112102` / `112103` / `112109`. |
| 💕 **Hậu Cung & Tri Kỷ** | `106111, 106119` | `106211, 106219` | `wifeInfoList` & `wifeEnergyFuncDataInfo.num > 0`. Lệnh vấn an: `106104`. |
| 📬 **Hộp Thư** | `107101` | `107201` | `mailList [ { id, state: 1 } ]`. Lệnh nhận: `107103 { id }`. |
| 👑 **Đấu Tài Nghệ (BigBoss)** | `250101, 250102` | `250201, 250202` | Báo danh Top 4 Tùy Tùng: `250102 { helperIds }`. Nhặt trứng: `250101`. So tài: `250104`. Nhận thưởng: `250106 { type }`. |
| 🐱 **Nuôi Mèo (Tổ Ấm)** | `160101` | `160201` | Cho ăn: `160102 { id, foodId }`. Lễ thành niên: `160103 { id }`. Du ngoạn: `160104`. |
| 🎣 **Câu Cá (Chợ Đêm)** | `170101` | `170201` | Kiểm tra điểm tuần (trần 6.000 Đồng), câu cá: `170102 { type }`. |
## 📊 3. BẢNG QUÉT TOÀN BỘ TÍNH NĂNG KIẾM VÀNG & CUNG VẬN TRONG GAME (CHƯA LÀM TOOL)
Tài liệu trích xuất và đối chiếu trực tiếp 100% từ cấu hình game, mã nguồn máy khách và bảng mã WebSocket `protoId.json`.
### 🌟 Hiện trạng đã tích hợp trong chế độ Auto 24/7
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
### 💰 Các nguồn kiếm Vàng (Gold) chưa làm tool
| STT | Phân Hệ Game | Cơ Chế Nhận Vàng | Mã Protocol C2S / S2C | Lượng Vàng Dự Kiến | Mức Ưu Tiên |
|:---:|---|---|---|---|:---:|
| **1** | 🎁 **Rương Năng Động Ngày** (`QuestEveryDay`) | Thu hoạch, bồi dưỡng, vượt ải tích điểm sôi nổi (30, 60, 90, 120, 150 điểm). Mở 5 rương nhận **Vàng** và Đan Dược quý. | • `124103` (ReqQuestEveryDayInfo)<br>• `124106` (ReqQuestEveryDayActiveAward: `{ id }`)<br>• `124110` (Nhận nhanh toàn bộ) | **30 - 100 Vàng / ngày** | 🔴 **Tier S** |
| **2** | 🚶 **Du Ngoạn Lạc Dương** (`Visit`) | Tự hồi 15/15 thể lực (30 phút hồi 1 điểm). Du ngoạn gặp sự kiện ngẫu nhiên nhặt được **Vàng**, Bạc, Binh Lực và Tri Kỷ mới. | • `109101` (ReqVisitInfo)<br>• `109103` (ReqBeginVisit: `{ type: 1 }`)<br>• `109104` (ReqFinishVisit) | **20 - 50 Vàng / ngày** + tài nguyên | 🔴 **Tier S** |
| **3** | 💕 **Thân Mật Tri Kỷ / Hậu Cung** (`Wife`) | Tự hồi 3/3 năng lượng vấn an. Tích điểm Thân Mật lên các mốc Lv.2, Lv.3... nhận thưởng **Vàng** cấp độ thân mật (`RewardNearLv`). | • `106101` (ReqCallWife)<br>• `106102` (ReqLoveWife)<br>• `106110` (ReqRewardNearLv: `{ wifeId }`) | **50 - 200 Vàng / mốc** | 🔴 **Tier S** |
| **5** | ⏳ **Sự Kiện Hạn Giờ** (`ActivityLimit` / `LimitTime`) | Chu kỳ 3 - 7 ngày: Đua tiêu Bạc, Đua thế lực, Tiêu Binh Lực, Vượt ải... Tự chơi đạt mốc và nhận **Rương Vàng** miễn phí. | • `136101` (ReqActivityLimitInfo)<br>• `136103` (ReqActivityLimitAward: `{ id }`)<br>• `135104` (ReqActivitySprintAward) | **100 - 500 Vàng / đợt sự kiện** | 🟡 **Tier A** |
| **6** | ⚔️ **Cung Luận Chiến / Tranh Tài** (`Court` / `Debate`) | Đấu trí Tùy Tùng tại Triều Đình / Phụng Thần Bảng. Đánh bại Tùy Tùng đối thủ nhận ngay Vàng và Điểm Danh Vọng đổi sách. | • `119101` (ReqCourtInfo)<br>• `119104` (ReqCourtFight: `{ helperId }`)<br>• `119105` (ReqCourtAward) | **30 - 80 Vàng / ngày** | 🟢 **Tier B** |
| **7** | 📜 **Giftcode / Mã Đổi Quà** (`PlayerCdKey`) | Hệ thống nhập mã Code quà tặng của nhà phát hành (Fanpage, Group, Sự kiện). Mỗi code chứa từ 100 đến 1000 Vàng. | • `102107` / `102108` (ReqUseCdKey: `{ code }`) | **100 - 1,000 Vàng / code** | 🟢 **Tier B** |
### 👑 Các nguồn kiếm Cung Vận (EXP Thăng Chức) chưa làm tool
Cung Vận là chỉ số quyết định tốc độ **Thăng Quan / Thăng Tước Vị** của nhân vật (từ Đáp Ứng $\rightarrow$ Thường Tại $\rightarrow$ Quý Nhân $\rightarrow$ Tần $\rightarrow$ Phi $\rightarrow$ Quý Phi $\rightarrow$ Hoàng Hậu).
| STT | Phân Hệ Game | Cơ Chế Kiếm Cung Vận | Mã Protocol C2S / S2C | Lượng Cung Vận Nhận Được | Mức Ưu Tiên |
|:---:|---|---|---|---|:---:|
| **1** | 🎁 **Rương Năng Động Ngày** (`QuestEveryDayActive`) | Mốc Rương Năng Động 60, 120 điểm tặng kèm các túi **Đan Cung Vận** hoặc điểm Cung Vận trực tiếp. | • `124106` (ReqQuestEveryDayActiveAward) | **+50 đến +150 Cung Vận / ngày** | 🔴 **Tier S** |
| **2** | 🚶 **Du Ngoạn Gặp Cơ Duyên** (`Visit`) | Du ngoạn Lạc Dương gặp sự kiện đố vui, giải quyết tranh chấp dân gian, vi hành ban thưởng điểm **Cung Vận** trực tiếp. | • `109103` (ReqBeginVisit)<br>• `109104` (ReqFinishVisit) | **+30 đến +100 Cung Vận / ngày** | 🔴 **Tier S** |
| **3** | 💕 **Kỹ Năng Tri Kỷ (Hậu Cung)** (`WifeSkill`) | Dùng điểm kinh nghiệm vấn an nâng cấp kỹ năng Hậu Cung $\rightarrow$ Cộng thẳng hàng trăm % điểm Cung Vận cho nhân vật và Tùy Tùng! | • `106104` (ReqWifeSkillUp: `{ wifeId, skillId }`) | **Tăng vĩnh viễn % Cung Vận** | 🔴 **Tier S** |
| **4** | 🏪 **Tiệm Bang Hội (Đổi Đan Cung Vận)** (`AllianceShop`) | Dùng điểm Cống Hiến Bang đổi lấy **Cung Vận Đan** (mỗi viên tăng 100 - 500 Cung Vận). | • `146113` (ReqAllianceShopInfo)<br>• `146114` (ReqBuyAllianceShop) | **+100 đến +300 Cung Vận / ngày** | 🟡 **Tier A** |
| **5** | 📖 **Minh Tương Ngoại Truyện** (`Gaiden` / `CardStory`) | Phó bản cốt truyện riêng từng Tùy Tùng / Tri Kỷ (FunctionID `14300` trong `GetPathConfig`). Vượt ải ban thưởng lượng lớn Cung Vận. | • `168101` (ReqCardScene)<br>• `168103` (ReqCardFight)<br>• `168106` (ReqCardRewardBox) | **+200 đến +1,000 Cung Vận / chương** | 🟡 **Tier A** |
| **6** | ⏳ **Sự Kiện Tích Điểm Hạn Giờ** (`EventRankPoint` / `12801`) | Nhận quà các mốc điểm sự kiện tích lũy trong `ResourceConfig.list['1']`. | • `140101` (ReqEventActivityInfo)<br>• `140108` (ReqEventActivityRankReward) | **+100 đến +500 Cung Vận / đợt** | 🟢 **Tier B** |
## 🎯 4. ĐỀ XUẤT LỘ TRÌNH TRIỂN KHAI TỐI ƯU
### 🥇 Giai Đoạn 1 (Nên làm ngay):
1. **Rương Năng Động Ngày (`124106` / `124110`)**: Điểm năng động tự động đạt mốc 150/150 sau các hoạt động hàng ngày nhưng chưa nhận. Kiếm ngay **50 - 100 Vàng + 100 Cung Vận** mỗi ngày.
2. **Du Ngoạn Lạc Dương (`VisitService` - `109101`, `109103`, `109104`)**: Thể lực du ngoạn tự hồi 24/7 (30 phút/điểm). Nhặt Vàng, Cung Vận, mở khóa thêm Tri Kỷ mới.
3. **Hậu Cung & Vấn An Tri Kỷ (`WifeService` - `106101`, `106104`, `106110`)**: Tự hồi năng lượng vấn an (3/3), bấm vấn an nhận exp nâng skill Cung Vận và nhận Vàng mốc thân mật.
### 🥈 Giai Đoạn 2 (Mở rộng):
4. **Bang Hội / Liên Minh (`AllianceService`)**: Cống hiến, đánh boss bang, nhặt Lì Xì Vàng, đổi Đan Cung Vận.
5. **Nhận Quà Sự Kiện Hạn Giờ (`ActivityLimitService`)**: Tự động gom sạch Vàng từ các sự kiện đua top/hạn giờ.