# feat: cân bằng lại chỉ số combat + thiết kế lại màn chọn bản đồ

Branch: `feature/combat-rebalance-map-selection-v1` → `main`

## Tổng quan

Hai hạng mục lớn theo yêu cầu:

1. **Cân bằng lại toàn bộ ATK/HP** — tài khoản mới từ 287.510 ATK xuống 173 ATK.
2. **Thiết kế lại màn chọn bản đồ** — ảnh minh hoạ từng chương + dải mốc phòng.

---

## PHẦN A — CÂN BẰNG CHỈ SỐ

### Nguyên nhân gốc (bảng audit)

Đo trực tiếp trên trình duyệt: tài khoản vừa tạo (trang bị Lv.1 common, tổng
`gearAtk = 28`) có **ATK 287.510 / HP 1.052.029**. Trang bị tân thủ chỉ đóng góp
0,04% tổng lực chiến. Mục tiêu thiết kế 80–150 / 400–800 → vượt ~2.000 lần.

| Source | Current Formula | Flat | % | Multiplier | Risk |
|---|---|---|---|---|---|
| Base ATK | hằng số 78 | 78 | – | – | thấp |
| Base HP | hằng số 420 | 420 | – | – | thấp |
| Gear Lv.1 (6 món tân thủ) | `baseStat * quality.mult` | 28 / 62 | – | ×1.0 | 0,04% |
| `getArtifactStarLevel()` | trả 15 sao khi chưa có | 76.670 / 306.680 | – | ×8.5 | **BUG GỐC** |
| `computeSingleArtifactStats()` | 0 sao vẫn 1.0× base | 9.020 / 36.080 | – | – | **BUG** |
| artifact `specialBonus` | cộng vô điều kiện | – | 0,65 | – | **BUG** |
| `getHeroStarLevel()` | trả 8 sao khi `heroStars={}` | 960 / 4.800 | – | ×2.0 | **BUG** |
| `getActiveHeroSkin()` | idx 2 khi chưa chọn skin | 280 / 1.150 | 0,10 crit | – | **BUG** |
| `isHeroSkinUnlocked()` | auto-mở `_legendary`/`_mythic` | 1.715 / 6.829 | – | – | **BUG** |
| `getAllUnlockedSkinBonuses()` | tính cả 17 tướng chưa sở hữu | – | – | – | **BUG** |

### 9 sửa chữa

1. `getHeroStarLevel`: fallback 8 → 0
2. `getArtifactStarLevel`: fallback 15 → 0, không tự ghi `map[artId]=15`
3. `computeSingleArtifactStats`: 0 sao → `{atk:0, hp:0, owned:false}`
4. `computeAllArtifactsAndSetsBonuses`: bỏ qua `specialBonus` khi `!owned`
5. `computeAllArtifactsAndSetsBonuses`: bỏ qua set bonus khi `minStar <= 0`
6. `getActiveHeroSkin`: mặc định idx 2 → 0
7. `isHeroSkinUnlocked`: chỉ auto-mở `_default`
8. `getAllUnlockedSkinBonuses`: chỉ tính tướng sở hữu
9. Base 78/420 → 48/300

### Bảng so sánh trước / sau

| | ATK | HP | Power |
|---|---:|---:|---:|
| Trước | 287.510 | 1.052.029 | 2.995.870 |
| Sau | **173** | **751** | **3.317** |

### Đường cong tiến trình

| Giai đoạn | ATK | HP | Crit | DR |
|---|---:|---:|---:|---:|
| Tân thủ (common Lv.1) | 173 | 751 | 0,22 | 0 |
| Fine Lv.10 | 991 | 3.889 | 0,22 | 1,2% |
| Rare Lv.30 + 3 sao | 4.845 | 16.602 | 0,36 | 4,1% |
| Epic Lv.60 + 4 sao | 15.833 | 50.152 | 0,46 | 7,8% |
| Legendary Lv.100 6 sao | 35.429 | 114.429 | 0,54 | 12,3% |
| Mythic Lv.100 + 8 sao | 71.484 | 224.920 | 0,70 | 12,5% |
| Chaotic + 15 sao artifact | 105.907 | 333.201 | 0,70 | 12,5% |

Tăng đơn điệu, không bước nhảy đột biến. Late mạnh hơn tân thủ 1.005× ATK.

### Bảo toàn dữ liệu người chơi cũ

Không xoá/reset bất kỳ trường nào. Không có migration ghi đè. Người chơi cũ giữ
nguyên trang bị, vàng, đá quý, tiến trình; chỉ mất phần bonus ảo trước đây được
cộng nhầm (artifact chưa sở hữu, skin chưa mua của tướng chưa mở).

### Simulation cân bằng combat

`npm run sim` — đọc công thức trực tiếp từ source bằng regex, tính TTK /
Hits To Die cho 5 hồ sơ × 3 chương.

Tân thủ ở Chương 1:

| Phòng | Loại | TTK | Số đòn chịu được |
|---|---|---:|---:|
| 1 | quái | 0,61s | 16,0 |
| 8 | quái | 1,58s | 11,0 |
| 14 | quái | 2,72s | 6,7 |
| 5 | TRÙM | 10,42s | 9,0 |
| 15 | TRÙM | 17,37s | 5,0 |

19 tiêu chí tự động: **TẤT CẢ ĐẠT**.

---

## PHẦN B — UI CHỌN BẢN ĐỒ

### Asset (`public/assets/`)

3 SVG tự vẽ, không URL ngoài, không chứa chữ (đa ngôn ngữ):

| File | Size | Nội dung |
|---|---:|---|
| `map-ch1-ancient-stone.svg` | 9.016 B | hầm ngục đá: cổng vòm, mặt trăng, núi 3 lớp, sương mù |
| `map-ch2-lava-valley.svg` | 9.076 B | thung lũng dung nham: núi lửa, suối lava, hồ dung nham |
| `map-ch3-void-sanctum.svg` | 10.788 B | thánh điện hư không: lâu đài, cổng dịch chuyển, rune |

Mỗi ảnh: `viewBox 1200x600`, 9–11 gradient, 19–33 path, filter blur, nhiều
không gian âm để đặt panel thông tin.

### Khung chọn bản đồ

- Ảnh 2:1 làm trọng tâm, zoom nhẹ 1,045 khi chọn, scrim gradient để đọc chữ
- Nhãn: `CHƯƠNG N · TÊN KHU VỰC` / tên chương / câu mô tả không khí
- Badge: 3 chấm độ khó + "ĐÃ PHÁ ĐẢO"
- 4 ô: PHÒNG / TỐT NHẤT / LẦN THẮNG / HỆ SỐ QUÁI
- Dải mốc phòng: 1 nút/phòng, trùm hình tròn đỏ, đã qua xanh, hiện tại vàng
- 2 nút: Về Sảnh / Bắt Đầu Hành Trình (disabled + lý do nếu khoá)
- 3 tab chọn nhanh với ảnh thu nhỏ + % tiến độ + ổ khoá

### Giữ nguyên logic

`isChapterLocked()` / `getChapterBest()` / `isChapterWon()` /
`normalizeSelectedChapter()` / `startNewRun()` — **không sửa dòng nào**.

### Responsive

390 / 360 / 320px: dải 15 mốc vừa 1 hàng, không cuộn ngang, stats 2 cột.

---

## KIỂM THỬ

- `npm run check` — PASS
- **1083 unit + 16 live = 1099 PASS / 0 FAIL** (25 bộ test)
- Thêm mới: `tests/stat-curve.test.mjs` (51), `tests/map-select.test.mjs` (100)
- `npm run sim` — 19/19 tiêu chí ĐẠT

### Test mới có mô phỏng chạy thật

- **stat-curve**: mô phỏng pipeline qua 4 giai đoạn, kiểm tra dải chỉ số, tỉ lệ
  tăng trưởng, tính đơn điệu, chống cộng trùng
- **map-select**: mô phỏng dải mốc trên cả 3 chương (boss 5/10/15, 5/10/12,
  5/10), mô phỏng phân quyền (tài khoản mới, thắng C1, người cũ chỉ có
  `bestRooms` mà không có `winsByChapter`)

---

## VERIFY TRÊN PRODUCTION

Tài khoản mới `new178208` (đăng ký thật):

```
ATK 234 | HP 1.005 | crit 0,24 | def 2 | power 5.672
vàng 500 | đá quý 50 | gearLevel 1 | túi trống
trang bị: 6 món common Lv.1
heroStars: chỉ artemis 1 sao | artifact: 0 | talent: 0
```

Màn chọn bản đồ với tài khoản mới: Chương 1 mở, Chương 2/3 khoá, 15 mốc,
"0/15 TỐT NHẤT", 3 ảnh tải đúng.

---

## RỦI RO / CHƯA HOÀN THÀNH

1. **HP tân thủ 1.005** nhỉnh hơn dải mục tiêu (400–800) do tướng khởi đầu
   1 sao (+200 flat HP). Chấp nhận được; nếu cần chặt hơn thì hạ `flatHp` của
   mốc 1 sao.
2. **Chỉ số người chơi cũ giảm** (`puugoo`: 99.763 → 42.648 ATK) vì mất bonus
   ảo từ 46 artifact chưa sở hữu. Đây là hệ quả đúng đắn của việc sửa bug,
   nhưng người chơi sẽ cảm nhận rõ.
3. **Artifact 0 sao giờ không cộng gì** — cần rà soát lại luồng mở khoá
   artifact để đảm bảo người chơi thật sự nhận được sao đầu tiên.
4. Chưa chạy E2E đánh trận thật trên production sau khi đổi chỉ số (chỉ
   simulation + đo chỉ số). Nên chơi thử 1 trận Chương 1 bằng tài khoản mới.
