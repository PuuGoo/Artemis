# Tân thủ sạch (New Player Zero-Item State)

> **Trạng thái:** ĐỀ XUẤT — chưa triển khai.
> **Ngày audit:** 2026-11-05 · tài khoản test `nb296301` trên dev local.

---

## 1. Audit: tài khoản mới hiện có gì

Đo thật trên tài khoản vừa đăng ký qua form `#cloudGate` (chưa chơi phòng nào):

| Hạng mục | Yêu cầu | Hiện tại | Kết luận |
|---|---|---|---|
| **Gear** | không có | **6 món** common Lv.1 | ❌ Sai |
| **Runes** | không có | 4 rune = 0, không equip | ✅ Đúng |
| **Artifacts** | không có | 0/46 sở hữu (0★) | ✅ Đúng |
| **Talent card** | không có | 33 talent = 0 | ✅ Đúng |
| **Nhân vật** | **Alex** | `artemis` (1★) | ❌ Sai |
| Skins | không có / chỉ default | 1 skin `artemis_default` | ⚠️ Tuỳ thiết kế |
| Vàng / Gem | (không yêu cầu) | 500 / 50 | — |
| Chỉ số | — | ATK 234 · HP 1.005 · Power 5.67K | hệ quả của gear |

### 6 món gear đang được tặng

`createDefaultEquipped()` trong `public/index.html:8790`:

```js
weapon:   makeStarterItem('eq_w1', 'rusty_bow'),
necklace: makeStarterItem('eq_n1', 'wooden_charm'),
ring:     makeStarterItem('eq_r1', 'copper_ring'),
armor:    makeStarterItem('eq_a1', 'cloth_vest'),
helmet:   makeStarterItem('eq_h1', 'leather_cap'),
boots:    makeStarterItem('eq_b1', 'worn_boots')
```

Tất cả `quality: 'common'`, `level: 1`, 0 socket, 0 affix. Đây là **bộ khởi đầu cũ**, mâu thuẫn với ý "tân thủ không có gear".

`createDefaultBag()` thì đã đúng — `return []` (comment: *"Túi đồ trống: mọi trang bị đều phải kiếm"*).

---

## 2. Vấn đề phải giải trước khi bỏ gear

### 2.1. Không còn gear → ATK/HP tụt về base thuần

`getComputedStats()` cộng `gearAtk`/`gearHp` từ 6 món. Bỏ hết thì tân thủ chỉ còn:

- ATK = `48` (base) + hero bonus
- HP = `300` (base)

Đoán trước (cần verify): ATK ~48–78, HP ~300. Vẫn nằm trong khoảng mục tiêu "Tài khoản vừa tạo, chưa có đồ: 80–150 ATK / 400–800 HP" — nhưng **thấp hơn sàn**.

→ Cần nâng base stat để tân thủ vẫn sống được mà không cần gear.

### 2.2. `setupRoom` neo độ khó theo ATK người chơi

```js
const playerAtk = Math.max(1, Game.player?.atk || 100);
const maxHp = Math.round(playerAtk * hitsToKill * chapterMul ...);
```

Nếu ATK = 48 thì quái HP = 48 × 1.4 × 1 = 67. TTK vẫn ổn vì neo theo ATK. Nhưng ATK thấp + không có `critRate` từ gear → trận đầu rất chậm. Phải chạy lại `npm run sim` sau khi đổi.

### 2.3. Hệ thống gear cần đường vào khác — ĐÂY LÀ GAP LỚN NHẤT

Bỏ gear khởi đầu nghĩa là người chơi **phải nhặt được món đầu tiên**. Kiểm tra thực tế:

**Không có bất kỳ đường rơi gear nào trong game.** Loại drop duy nhất (`Game.drops`) là:

```
gold · xp · heart · scroll
```

`scroll` là cuộn nâng cấp (dùng cho gear **đã có**), không phải gear. `chestGacha` cần key, key kiếm từ đâu chưa rõ. Shop bán gear nhưng cần vàng — 500 vàng khởi đầu không đủ.

→ **Nếu chỉ bỏ `createDefaultEquipped()` mà không thêm đường rơi gear, người chơi mới sẽ KHÔNG BAO GIỜ có trang bị.** Đây là điều kiện tiên quyết, không phải tuỳ chọn.

### 2.3b. `weapon.atkMult` nhân vào base ATK — bỏ vũ khí sẽ mất multiplier

```js
const baseAtk = Math.round((48 + gearAtk + ...) * weapon.atkMult * (1 + ...));
const baseAspd = +(weapon.aspd * (1 + ...)).toFixed(2);
```

`weapon` không phải gear slot trong `equippedGear` mà là `STATS.weapon` lấy từ `selectedWeaponId`:

```js
const weapon = WEAPONS.find(w => w.id === SaveState.selectedWeaponId) || WEAPONS[0];
```

**Đã kiểm tra: an toàn.** `WEAPONS[0]` là `bow` với `atkMult: 1.0`, `aspd: 1.9`, `critBonus: 0.10` → không NaN, không crash, nhân vật vẫn bắn được. Bỏ 6 món gear không ảnh hưởng tới đường này.

Nhưng lưu ý: `weapon.atkMult = 1.0` nghĩa là base ATK không được nhân thêm. Nếu bỏ gear mà không nâng `48` thì ATK ≈ 48 × 1.0 × (1 + critBonus nhỏ) ≈ **48–53** — dưới sàn 80.

### 2.4. UI giả định luôn có gear

Nhiều nơi đọc `SaveState.equippedGear.weapon.templateId` trực tiếp. Nếu null phải chịu được:
- `computeSingleItemStat(null)` đã guard (`if (!item) return 0`)
- Nhưng UI render card trang bị có thể crash
- Nút "Nâng cấp" / "Tinh luyện" phải disable khi slot trống

### 2.5. Alex với 0★

`heroStars.alex = 0` → skill `Braveheart` **không kích hoạt** (cần 1★+). Nếu chọn Alex làm mặc định nhưng 0★ thì hero thành vô dụng (chỉ là skin).

→ Phải cho Alex **1★ miễn phí** (giống Artemis đang có 1★), hoặc hạ điều kiện skill về 0★.

---

## 3. Đề xuất triển khai

### Phương án A — Bỏ gear hoàn toàn (đúng yêu cầu nhất)

```
createDefaultEquipped()  →  { weapon: null, necklace: null, ring: null,
                              armor: null, helmet: null, boots: null }
```

Kèm 4 việc bắt buộc:

1. **Nâng base stat** để tân thủ sống được: base ATK 48→90, base HP 300→600 (nằm trong khoảng mục tiêu 80–150 / 400–800).
2. **Thêm đường nhặt gear**: món common đầu tiên rơi từ quái phòng 1–2, hoặc tặng qua Beginner Journey bước N01.
3. **Chọn Alex mặc định + 1★ miễn phí**: `selectedHeroId: 'alex'`, `heroStars.alex = 1`, `heroStars.artemis = 0`. Đổi cả `lib/saveSchema.js:346`.
4. **Guard UI**: mọi chỗ đọc `equippedGear[slot].x` phải chịu null; nút nâng cấp disable khi slot trống; hiện "Chưa có trang bị" thay vì card rỗng.

Rủi ro: người chơi mới có thể thấy trận đầu khó hơn đáng kể → phải chạy `npm run sim` + `tests/combat` + `tests/stat-curve`.

### Phương án B — Giữ 1 món vũ khí duy nhất

Chỉ giữ `rusty_bow` (vũ khí là bắt buộc để bắn), 5 slot còn lại null.

- Ít rủi ro hơn (vẫn có vũ khí để bắn, không phải sửa logic fire)
- Nhưng không đúng yêu cầu "không có gear"

### Phương án C — Bỏ gear + tặng qua tutorial có kiểm soát

Bỏ hết gear, nhưng Beginner Journey tặng gear ở bước có kiểm soát (N01: nhận rusty_bow sau khi thắng phòng 1). Người chơi cảm giác "kiếm được" thay vì "được tặng sẵn".

**Khuyến nghị: Phương án C** — đúng yêu cầu (tân thủ bắt đầu tay không), vẫn có đường vào rõ ràng, ít rủi ro kẹt.

---

## 4. Checklist verify (bắt buộc trước khi báo xong)

```
[ ] Tạo tài khoản mới thật (không dùng localStorage, qua #cloudGate)
[ ] equippedGear: cả 6 slot = null
[ ] gearBag = []
[ ] runes: 4 rune = 0, không slot nào equip
[ ] artifactStars: 0/46 sở hữu
[ ] talents: 33 card = 0
[ ] selectedHeroId = 'alex', heroStars.alex = 1
[ ] ATK/HP nằm trong 80–150 / 400–800
[ ] Vào trận phòng 1 được, bắn được, giết được quái
[ ] UI trang bị không crash khi mở, hiện "Chưa có trang bị"
[ ] Nút nâng cấp/tinh luyện disable đúng
[ ] npm run sim: tân thủ Ch1 vẫn đạt tiêu chí
[ ] Full test suite PASS
[ ] Deploy production + verify bằng tài khoản mới trên prod
```

---

## 5. Prompt cho agent phát triển

```
TASK: Tân thủ bắt đầu tay không — bỏ toàn bộ gear/runes/artifacts/talents
khởi đầu, mặc định nhân vật Alex.

REPO: https://github.com/PuuGoo/Artemis.git
FILE CHÍNH: public/index.html (~28.000 dòng, script inline)

=== YÊU CẦU NGHIỆP VỤ ===

Tài khoản vừa đăng ký phải có:
- Gear:        KHÔNG có món nào (cả 6 slot null), túi đồ rỗng
- Runes:       KHÔNG có rune nào được equip
- Artifacts:   0/46 sở hữu (0 sao tất cả)
- Talent card: 0 tất cả
- Nhân vật:    Alex là mặc định, VÀ phải dùng được skill Braveheart
- Skins:       chỉ skin default của Alex

=== VIỆC PHẢI LÀM ===

1. createDefaultEquipped() tại public/index.html:8790
   → trả về cả 6 slot null thay vì makeStarterItem(...)
   → createDefaultPresets() tại :8806 cũng phải null hết (đang trỏ tới
     'eq_w1'...'eq_b1' là UID không còn tồn tại)

2. Base stat: getComputedStats() — kiểm tra baseAtk/baseHp.
   Bỏ gear thì tân thủ chỉ còn base thuần. Mục tiêu: 80–150 ATK, 400–800 HP.
   Đo thực tế rồi điều chỉnh, KHÔNG đoán.

3. Đổi hero mặc định sang Alex:
   - SaveState.selectedHeroId: 'artemis' → 'alex'  (:8830)
   - SaveState.heroStars: artemis:1 → 0, alex:0 → 1
   - lib/saveSchema.js:346 safeId(raw.selectedHeroId) || "artemis" → "alex"
   - Kiểm tra hasHeroSkillActive() — Alex cần 1★ để skill chạy

4. Guard UI khi slot trống:
   - Mọi chỗ đọc SaveState.equippedGear[slot].templateId phải chịu null
   - Card trang bị trống hiện "Chưa có trang bị" + nút "Tìm trang bị"
   - Nút Nâng cấp / Tinh luyện / Khoá disable khi slot null
   - Không được crash khi mở tab Trang bị với 6 slot rỗng

5. Đường nhặt gear đầu tiên (BẮT BUỘC — nếu không người chơi kẹt):
   Chọn 1 trong 2:
   a) Beginner Journey tặng rusty_bow ở bước N01 (sau khi thắng phòng 1)
   b) Quái phòng 1–2 rơi gear common đầu tiên (thêm nhánh drop)

6. setupRoom() neo độ khó theo playerAtk — sau khi đổi base stat phải
   chạy lại npm run sim và xác nhận tân thủ Ch1 vẫn đạt:
   quái 0.6–3s, trùm phòng 5 ≥ 10s, chịu ≥ 5 đòn

=== TEST PHẢI VIẾT ===

tests/new-player-zero-state.test.mjs — khoá:
- createDefaultEquipped() trả 6 slot null
- createDefaultBag() trả []
- createDefaultPresets() không trỏ UID không tồn tại
- selectedHeroId === 'alex'
- heroStars.alex >= 1 && heroStars.artemis === 0
- runes 4 cái = 0
- artifactStars không có entry > 0
- talents không có entry > 0
- lib/saveSchema.js default selectedHeroId là 'alex'
- Không có chỗ nào trong UI đọc .templateId mà không guard null

=== VERIFY BẮT BUỘC (không được báo xong nếu chưa làm) ===

- Tạo tài khoản MỚI THẬT qua form đăng ký trên local
- Đo: 6 slot gear null, bag [], runes 0, artifacts 0, talents 0,
  hero = alex, ATK/HP trong 80–150 / 400–800
- Vào trận phòng 1, bắn, giết quái được (dùng updateGame thật)
- Mở tab Trang bị: không crash, hiện đúng "Chưa có trang bị"
- npm run sim đạt tiêu chí tân thủ
- Full suite PASS (hiện 1228 unit + 16 live)
- Push main, chờ Vercel READY, verify lại bằng tài khoản mới trên production

=== RÀNG BUỘC ===

- MongoDB là nguồn dữ liệu duy nhất — KHÔNG dùng localStorage
- Không chạy test nào ghi vào save thật của tài khoản puugoo/puugoo5
- Không sửa file nguồn gốc trong attachments/
- Commit từng bước, push origin/main, báo commit SHA
- UI copy tiếng Việt
- Comment code tiếng Việt không dấu (theo convention repo)
```

---

## 6. Ghi chú thêm

**Tại sao "không có gear" là quyết định thiết kế lớn, không chỉ là xoá 6 dòng:**
Bộ gear khởi đầu hiện là thứ giữ cho ATK/HP tân thủ không quá thấp. Xoá đi mà không nâng base stat thì trận đầu thành cực khó; nâng base stat mà không chạy sim thì có thể phá đường cong đã cân bằng trước đó. Nên đây là task cần đo đạc, không phải task sửa một chỗ.
