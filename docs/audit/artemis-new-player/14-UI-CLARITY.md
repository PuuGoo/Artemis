# 14 — Đợt 5: giao diện tân thủ rõ ràng (một việc, một nút)

Mục tiêu: người mới mở game phải trả lời được ngay "giờ tôi làm gì?" và bấm được
đúng một nút để làm việc đó — không phải mò giữa hàng trăm khối UI.

## 1. Vấn đề trước Đợt 5

| Vấn đề | Bằng chứng |
|---|---|
| Nhãn **"MAX VIP"** tĩnh cạnh tên người chơi | `public/index.html:1239` — ai ở cấp 1 cũng thấy "MAX VIP", gợi ý một đặc quyền không tồn tại |
| 8 bước tân thủ chỉ nằm trong tab Thẻ Tài Năng | Người mới phải tự tìm tab, giữa tab Trang Bị/Kỹ Năng/Thú… |
| Hint nhắc nút không tồn tại | N02 ghi *"Vào \"Phó Bản\" → bấm \"Bắt Đầu\""* — không có màn nào tên "Phó Bản"; nút thật là **⚔️ BẮT ĐẦU CHIẾN ĐẤU** |
| Nâng cấp chỉ báo chỉ số của **món đồ** | Người chơi không biết nâng xong **nhân vật** mạnh hơn bao nhiêu |

## 2. Đã thay đổi

### 2.1 Danh hiệu thật thay nhãn giả

`id="topRankBadge"` + `getPlayerRankTitle()` + `RANK_TITLES`:

| Danh hiệu | Điều kiện thật |
|---|---|
| TÂN BINH | chưa xong/bỏ qua hành trình tân thủ (dù đã thắng chương nào) |
| CUNG THỦ | đã xong hành trình, ≥1 lần thắng chương |
| LÃO LUYỆN | ≥3 lần thắng |
| BẬC THẦY | ≥5 lần thắng |

Nguồn: `SaveState.winsByChapter` / `SaveState.lifetimeStats.chaptersCleared`. Không
cấp quyền lợi gì, không đổi dữ liệu — chỉ đổi chữ hiển thị cho đúng sự thật.

### 2.2 Thẻ "Việc cần làm" trong lobby

`#beginnerQuickCard` nằm ngay trên nút Bắt Đầu Chiến Đấu, hiển thị **một** bước:

- icon + mã bước (`N01`…`N08`) + tiến độ `x/8 bước`
- tiêu đề + hint của bước đó
- thanh tiến độ riêng cho N03 (`n/10 vật phẩm`)
- **một** nút hành động chính + nút phụ "Tất cả"

Nút chính đổi theo loại bước:

| Loại bước | Nhãn nút | Hành vi |
|---|---|---|
| `dialogue` | ✔ Đã Hiểu, Bắt Đầu / ✔ Hoàn Tất Hành Trình | hoàn tất + nhận thưởng |
| `gear_equipped` | 🎒 Mở Trang Bị | chuyển tab Trang Bị |
| `gear_upgraded` | 🔨 Mở Trang Bị Để Nâng Cấp | chuyển tab Trang Bị |
| `first_room_cleared` / `loot_10` / `skill_picked` / `chapter_cleared` | ⚔️ Vào Trận Ngay | bấm `#btnStartGame` |

Nếu bước đã xong mà chưa nhận thưởng, thẻ đổi thành **"Thưởng đang chờ"** + nút
Nhận thưởng, để không ai bỏ quên phần thưởng.

**Panel chi tiết N01–N08 vẫn giữ nguyên** trong tab Thẻ Tài Năng (không bị thay thế).

### 2.3 Hint khớp nút thật

- N02: *"Bấm \"⚔️ BẮT ĐẦU CHIẾN ĐẤU\" ở màn Chiến Đấu → dọn sạch phòng 1."*
- N04: *"Tab \"Trang bị\" → chọn Cung Gỉ Sét trong túi → bấm \"Trang Bị\"."*
- N05: *"Tab \"Trang bị\" → chọn món → bấm \"Nâng cấp\"."*

### 2.4 Nâng cấp hiện tác động lên **tổng nhân vật**

Thêm `#gearModalTotalImpact` trong modal trang bị:
> Tổng nhân vật: +12 ATK • +40 HP (lực chiến +52)

Tính bằng **chính `getComputedStats()`** trên bản sao món đồ (tăng `level` 1, đo, rồi
**khôi phục ngay** trong `finally`) — không ghi gì vào save, không tự đặt công thức.
Khi món đã cấp 25, hiện *"Đã đạt cấp tối đa 25 — không thể nâng thêm."*

## 3. Kiểm chứng

`tests/new-player-ui-clarity.test.mjs` — **7/7 pass**:

1. Không còn "MAX VIP" trong code (chỉ còn trong comment giải thích); có `topRankBadge`.
2. Thẻ nằm trong `tabBattle`, đúng **một** template nút hành động chính.
3. Nút trỏ đúng `tabEquip` / `tabTalents` / `btnStartGame`.
4. Panel N01–N08 vẫn render đủ 8 bước.
5. Hint không còn nhắc "Phó Bản"; N02 dùng đúng nhãn nút có thật.
6. Modal có `gearModalTotalImpact`, dùng `getComputedStats()`, có khôi phục `level`.
7. Runtime (VM): danh hiệu chuyển đúng bậc, và **không nhảy bậc khi chưa xong tutorial**.

Ngoài ra `tools/audit-new-player-browser.mjs` chạy lại trên Chrome thật:
**`errors: []`** — không lỗi JS sau khi thêm thẻ, danh hiệu và khối impact.

## 4. Giới hạn

- Chưa đo được **thời gian người thật tìm ra nút** (cần usability test, không có công cụ).
- Thẻ nhanh chỉ hiện với tài khoản đang trong hành trình (hoặc chưa xong); tài khoản
  đã xong/bỏ qua thì ẩn — đúng ý đồ, nhưng nghĩa là người chơi cũ không thấy thay đổi.
- Chưa đụng tới cách sắp xếp các hệ nâng cao (rune/artifact/pet) — nằm ngoài phạm vi
  "một việc một nút" và sẽ là Đợt 6 nếu cần.
- Danh hiệu chỉ để hiển thị; **không** gắn buff, không mở khoá tính năng.
