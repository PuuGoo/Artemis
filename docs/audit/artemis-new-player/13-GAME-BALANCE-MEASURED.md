# 13 — Đợt 4: đo cân bằng bằng source thật (không đổi cân bằng)

Mục tiêu của Đợt 4 là **đo trước, sửa sau**. Tài liệu này chỉ ghi số liệu đo được và
đề xuất; **không có thay đổi cân bằng nào được triển khai**.

## 1. Đã sửa gì để phép đo đáng tin

| Trước | Sau |
|---|---|
| Simulator chỉ có 3 chương (rooms 15/12/10, scale 1.0/1.45/2.0) | Đọc **6 chương** thật từ `CHAPTERS` (thêm C4 ×2.35, C5 ×2.62, C6 ×2.95) |
| Số quái cố định `count = 3` | Đọc `min(8, 3 + floor(room/2))` từ source |
| Bỏ qua hệ số loại quái | Đọc nguyên biểu thức `atkMul`: `obsidian_brute 1.28`, `sky_sentinel 1.25`, `plant_turret 1.23`, `eclipse_oracle 1.16`, `skeleton_mage 1.12`, `dragon_whelp 1.08`, `rift_stalker 1.04`, `cloud_wisp 0.96` |
| Boss cuối chỉ có "chương 3 = demon" | Đọc `CHAPTER_BOSS` thật: C4 `elder_dragon`, C5 `eclipse_sovereign`, C6 `astral_devourer`; demon ×1.15 chỉ khi rơi vào `demon_king` |
| 5 hồ sơ **gõ tay** | 7 hồ sơ **đo bằng `getComputedStats()` trên Chrome local** (`tools/measure-profiles.json`) |
| Không phát hiện drift | Mọi hằng số đọc bằng regex; lệch source → script **ném lỗi**, không tính bừa |

Hai công cụ mới:

```bash
node tools/measure-profiles.mjs   # cần PLAYWRIGHT_MODULE; ghi tools/combat-profiles.json
node tools/combat-sim.mjs         # đọc profiles đã đo, in bảng + kết luận
```

## 2. Hồ sơ đo được (từ `getComputedStats()` thật)

| Hồ sơ | ATK | HP | ASPD | CRIT | DEF |
|---|---:|---:|---:|---:|---:|
| A. Tân thủ (tay không, Alex 0★) | 152 | 775 | 1.94 | 0.22 | 0 |
| B. Starter (Cung Gỉ Sét Lv.1) | 164 | 775 | 1.94 | 0.22 | 0 |
| C. Nâng cấp đầu (Lv.5 + uncommon) | 183 | 868 | 1.94 | 0.22 | 0 |
| D. Giữa chương 1 (rare Lv.15) | 491 | 1929 | 2.13 | 0.27 | 4 |
| E. Cuối chương 1 (epic Lv.30, 4★) | 1073 | 4020 | 2.62 | 0.34 | 8 |
| F. Người cũ quay lại (mythic Lv.100, 8★) | 5934 | 19489 | 3.13 | 0.52 | 16 |
| G. Yếu ở chương cao (starter gear) | 164 | 775 | 1.94 | 0.22 | 0 |

## 3. Kết quả đo — vấn đề đã được định lượng

### 3.1 Nâng ATK gần như không giúp giết nhanh hơn

```
Cùng phòng C1-P1:  A (ATK 152) TTK 0.61s   |   F (ATK 5934) TTK 0.31s
ATK F/A = 39,0×    nhưng TTK chỉ giảm 1,96×
Số đòn để hạ 1 quái: A 1,4  |  F 1,4
```

Toàn bộ chênh lệch 1,96× đến từ **attack speed + crit**, không phải từ ATK. Vì
`enemyHp = playerAtk × hitsToKill × scale`, ATK của người chơi bị triệt tiêu ngay
trong công thức.

### 3.2 Nâng HP gần như không giúp sống lâu hơn

```
Số đòn quái phải đánh để giết người chơi:  A 16,1  |  F 16,1
HP tăng 25,1× nhưng sát thương quái tăng theo cùng tỉ lệ
```

`enemyAtk = playerMaxHp / (16 - depth×10) / sqrt(n/3)` — nghĩa là "chịu đúng 16 đòn"
được **đảm bảo bằng thiết kế**, bất kể người chơi mặc gì.

### 3.3 Chương sau khó hơn — nhưng rất ít

```
Boss cuối: C1 20,0s → C5 45,5s (2,28×)   với hồ sơ A
Boss cuối: C1 13,6s → C5 31,0s (2,28×)   với hồ sơ E
```

Chương 5 có `enemyScale = 2,62` nhưng trùm chỉ khó hơn 2,28× vì attack speed của
người chơi cũng tăng. Đây là mức tăng **hợp lý**, không phải lỗi.

### 3.4 Người yếu đứng ở chương cao KHÔNG gặp áp lực

```
Hồ sơ G (starter gear) ở C5-P1: TTK 1,85s, chịu 16,1 đòn
```

Đúng ra người chơi trang bị tân thủ ở chương 5 phải chết rất nhanh. Thực tế họ chịu
**đúng 16 đòn như ở chương 1**. Đây là hệ quả trực tiếp của 3.2 và là lỗi thiết kế
cần sửa, không phải "cân bằng chưa đẹp".

### 3.5 Hệ quả cho trải nghiệm

| Điều người chơi kỳ vọng | Đo được |
|---|---|
| Mặc Cung Gỉ Sét → mạnh hơn rõ | ATK 152 → 164 (+7,9%), TTK 0,61s → 0,61s (không đổi) |
| Nâng cấp đầu tiên → thấy khác biệt | ATK 183, TTK vẫn 0,61s |
| Cày cuốc → vượt chương | Sống sót luôn là "16 đòn" ở mọi chương |
| Quay lại màn cũ → thấy dễ | TTK giảm ~2× (nhờ AS/crit), không phải cảm giác "áp đảo" |

## 4. Đề xuất (CHƯA triển khai)

**Nguyên tắc:** tách *campaign* (độ khó cố định theo chương/phòng) khỏi *mode adaptive*
(giữ nguyên cho Vô Tận / Tháp nếu muốn).

1. **Campaign dùng độ khó tuyệt đối**, không neo theo chỉ số người chơi:
   `enemyHp = f(chapter, room, archetype)` và `enemyAtk = g(chapter, room, archetype)`,
   với `f`, `g` hiệu chỉnh theo hồ sơ A–F đã đo ở trên.
2. **Giữ hệ số nhân theo chương** hiện có (`enemyScale`) làm xương sống, bỏ phần
   nhân với `playerAtk` / `playerMaxHp`.
3. **Hiệu chỉnh bằng số đo, không bằng cảm giác:** mục tiêu gợi ý
   - quái thường C1-P1: 2–3 đòn hạ (hiện 1,4 → quá nhanh, không có gameplay)
   - quái thường cuối chương: 5–7 đòn
   - người chơi chịu 8–12 đòn ở đầu chương, 4–6 đòn ở cuối chương
   - trùm: 15–25s với hồ sơ đúng tầm chương
4. **Kiểm bằng test tự động**: `tools/combat-sim.mjs --verbose` phải thoả các bất biến
   (TTK giảm khi ATK tăng; số đòn chịu giảm khi vào chương cao hơn; hồ sơ yếu ở
   chương cao < 5 đòn).
5. **Không đổi** reward table, rarity, drop rate, giá nâng cấp trong cùng bản vá.
6. **Không hạ tài sản người chơi cũ.** Nếu đổi công thức, save cũ chỉ đổi cách tính
   trận đấu, không đổi dữ liệu.

**Rủi ro nếu làm ngay:** đổi scaling ảnh hưởng toàn bộ 6 chương và 5 chế độ; cần
playtest người thật trước khi merge. Vì vậy bước này cần phê duyệt riêng.

## 5. Giới hạn của phép đo

- TTK là **giá trị kỳ vọng** từ công thức, không phải win rate đo được. Không có
  mô phỏng chuyển động/ né đòn, nên không thay thế playtest.
- Hồ sơ D/E/F dựng bằng cách **mặc đồ trong bộ nhớ** (không cày thật). Chỉ số là
  thật, nhưng đó không phải bằng chứng người chơi đạt được mức đó ở chương tương ứng.
- Chưa mô phỏng kỹ năng người chơi chọn trong trận, pet, rune, artifact, nghề mùa.
- `count` được lấy theo `room % types.length` như source, nhưng source chọn type theo
  `(roomNum + i) % types.length` cho từng con — sim chỉ mô phỏng 1 đại diện.
- Chưa có mode Vô Tận/Tháp/Săn Trùm trong bảng (campaign only).

## 6. Cách chạy lại

```bash
PLAYWRIGHT_MODULE=C:/Users/PuuGoo/AppData/Local/hermes/cache/scratch/artemis-browser/node_modules/playwright-core/index.mjs \
  node tools/measure-profiles.mjs
node tools/combat-sim.mjs --verbose
```
