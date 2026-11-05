# VÒNG LẶP PHÁT TRIỂN NGƯỜI CHƠI — KIỂM CHỨNG END-TO-END

> Bài kiểm thử xuyên suốt trên **production thật**: đăng ký → chơi → kiếm tài
> nguyên → nâng cấp → hoàn thành tutorial → cloud save. Mỗi tính năng từng được
> test riêng lẻ; tài liệu này chứng minh chúng nối liền thành một vòng lặp.

---

## 1. Điểm xuất phát của tài khoản mới

Tạo `e2e842149` trên `artemis-puugoo.vercel.app`:

```
gold 500      gems 50       atk 22.718     hp 75.623
weapon rusty_bow Lv.1  common      gearLevel 1      powerScore 230.994
talent 0      artifact 0★      túi đồ trống      Beginner Journey: bật
```

Đúng chuẩn tân thủ: không full đồ, mọi hệ thống tăng sức mạnh đều ở 0.

## 2. Chơi thật — kiếm tài nguyên

Dọn 3 phòng đầu bằng cách giết quái và nhặt loot như người chơi thật:

| Sau 3 phòng | Giá trị |
|---|---|
| Vàng | 656 (+156 từ loot) |
| Cuộn giấy | 2 (rơi vào slot `boots`) |
| Kills | 11 |
| Nhiệm vụ tự xong | N02, N03, N06 |

## 3. Nâng cấp trang bị — mắt xích quan trọng

Mở modal chi tiết giày (`eq_b1`), bấm **Cường Hóa (125 🪙)**:

| | Trước | Sau |
|---|---|---|
| Cấp giày | 1 | **2** |
| Vàng | 656 | 531 (−125 đúng giá) |
| Cuộn giày | 2 | 1 (−1 đúng yêu cầu) |
| HP | 75.623 | **75.630** |
| powerScore | 230.994 | **231.002** |
| Nhiệm vụ | — | **N05 hoàn thành** |

Chỉ số thực sự thay đổi và nhiệm vụ hook bắt đúng sự kiện.

## 4. Hoàn thành chương — N07

Dọn 15 phòng, đi vào cổng cuối:

```
"🏆 CHIẾN THẮNG HUY HOÀNG!"
gold 656 → 2.705     gems 50 → 90     wins 1
N07 tự hoàn thành
```

## 5. Hoàn tất Beginner Journey — 8/8

Làm nốt N01 (hội thoại), N04 (đổi trang bị sang món epic rơi được), N08 (nhận thưởng):

```
isCompleted: true     completedAt: có      active: false (tự tắt)
8/8 bước            con trỏ nhảy đúng sau mỗi bước
```

### Phần thưởng chính xác tuyệt đối

| | Trước | Sau | Chênh |
|---|---|---|---|
| Vàng | 3.805 | 5.755 | **+1.950** (đúng 200+150+250+300+250+800) |
| Gems | 170 | 245 | **+75** (đúng 10+15+50) |
| Cuộn giấy | 42 | 49 | **+7** |
| Chìa khoá | 0 | 1 | **+1** |

Tổng toàn bộ tutorial (cả N01 và N08): **3.050 vàng, 155 gems, 7 cuộn, 1 chìa**.

## 6. Cloud save

Sau `pushNow()`, đọc lại từ server:

```json
{ "ok": true, "revision": 15, "gold": 5755, "gems": 245,
  "bjDone": 8, "bjClaimed": 8, "bjCompleted": true,
  "bootsLv": 2, "bootsQ": "epic" }
```

Không bị `validateEconomyDelta` chặn — vì vàng tăng qua 15 revision, đúng nhịp
chơi thật.

## 7. Phân tích nền kinh tế phát triển

Công thức đọc trực tiếp từ `public/index.html`:

```js
needScrolls(lv) = max(1, min(25, ceil(lv/4)))
upgradeCost(lv) = 80 + lv*45
quái thường: 28% rơi cuộn, giá trị 2      boss: 100%, giá trị 5
slot: ngẫu nhiên đều trong 6 slot
```

Nguồn cung **đo thực tế trên production**: 2.049 vàng/trận, ~69 quái/trận,
~52 cuộn/trận.

### Chi phí nâng cả 6 slot

| Mốc | Vàng cần | Trận (vàng) | Trận (cuộn) | Nghẽn |
|---|---|---|---|---|
| Lv.5 | 4.620 | 2,3 | 0,5 | **VÀNG** |
| Lv.10 | 16.470 | 8,0 | 1,7 | **VÀNG** |
| Lv.15 | 35.070 | 17,1 | 3,7 | **VÀNG** |
| Lv.20 | 60.420 | 29,5 | 6,4 | **VÀNG** |

**Kết luận trung thực:** nền kinh tế **không hỏng**. 8 trận để cả 6 slot lên
Lv.10, 29 trận lên Lv.20 — hợp lý cho roguelike. Vàng mới là điểm nghẽn, không
phải cuộn giấy.

### Vấn đề nhịp độ (không phải lỗi)

Cuộn rơi ngẫu nhiên 1/6 slot → muốn nâng đúng vũ khí (slot mạnh nhất) chỉ có
4,67%/quái. Nhưng cuộn lệch slot vẫn dùng được cho slot khác, nên đây là vấn đề
nhịp độ, không chặn tiến trình. **Không sửa** — sửa sẽ làm nâng cấp quá dễ.

## 8. Khoá cân bằng bằng test

`tests/progression-economy.test.mjs` — **26 assertion**, đọc công thức **trực
tiếp từ `index.html`** (không phải bản sao có thể lạc hậu):

- Tìm thấy đúng công thức `max(1,min(25,ceil(lv/4)))` và `80+lv*45`
- Tỉ lệ rơi 28%/100%, slot chọn đều (không thiên vị)
- Nguồn cung 60–80 quái, 40–65 cuộn mỗi trận
- Lv.10/15/20 rơi trong khoảng hợp lý, vàng luôn là điểm nghẽn
- Không thể nâng miễn phí: cuộn ≥1, giá >0, giá tăng dần
- Tổng thưởng tutorial đúng 3.050 vàng / 155 gems / 7 cuộn
- Tài khoản mới: talent 0, artifact 0★ (không tặng miễn phí)

Nếu sau này ai sửa giá, tỉ lệ rơi, hay phần thưởng làm phá vỡ tiến trình — test
sẽ bắt được.

## 9. Dọn dẹp

Tài khoản test tạo trong quá trình kiểm chứng đã được xoá bằng
`tools/purge-test-accounts.mjs --apply` (4 tài khoản + 3 save, backup 24 KB).
DB còn đúng 3 tài khoản thật.
