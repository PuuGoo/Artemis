# PHÁT HIỆN CHẶN — Save production đang làm mất dữ liệu artifact & rune

> **Trạng thái:** đã xác minh trên production ngày 2026-11-06.
> **Mức độ:** nghiêm trọng (mất tiến trình người chơi), nhưng **KHÔNG phải do
> migration Unity gây ra** — lỗi có từ trước, nằm ở `lib/saveSchema.js`.
> **Ảnh hưởng migration:** chặn Phase 3 (Artifact + Rune) và chặn mọi tuyên bố
> "save compatibility 100%".

---

## 1. Kết luận trước, chứng cứ sau

Server **lọc bỏ** hai field dùng để tính chỉ số chiến đấu:

| Field | Ý nghĩa | Trong whitelist `lib/saveSchema.js`? |
|---|---|---|
| `artifactStars` | Sao của 46 thánh vật (0★→15★) | ❌ **Không** |
| `equippedRuneSlots` | Rune đang gắn ở 4 loại ô (13 ô) | ❌ **Không** |
| `runeQualityTier` | Bậc phẩm chất của rune ảnh hưởng chỉ số | ❌ Không |
| `runeMythicEnchant` | Cờ cường hoá mythic của rune | ❌ Không |

Hệ quả: mỗi lần client `GET /api/save`, server trả về document **không có** các
field trên. Client nạp lại, `getComputedStats()` thấy `artifactStars` rỗng →
mọi thánh vật về 0★ → chỉ số tụt. Người chơi tưởng mình vừa mất toàn bộ đầu tư.

## 2. Chứng cứ A — server lọc (đo bằng chính `sanitizeSave`)

```
$ node tools/unity-parity/gen-save-fixtures.mjs
Field bị server lọc khỏi save:
  mid-game-gear — bỏ: artifactStars, equippedRuneSlots
  late-game-full — bỏ: artifactStars, equippedRuneSlots
  …
```

Ca `late-game-full` gửi lên một save **có** `artifactStars` (3 thánh vật 15★) và
`equippedRuneSlots` (7 rune); server trả về bản đã lọc, không còn hai field đó.

## 3. Chứng cứ B — production thật (chỉ đọc)

```
$ node tools/unity-parity/audit-prod-fields.mjs
Đã kết nối database: artemis
Tổng số save: 52

Field có mặt trong save production:
  artifactStars                0 / 52  (0.0%)
  equippedRuneSlots            0 / 52  (0.0%)
  runes                       16 / 52  (30.8%)   ← có rune trong kho
  equippedGear.weapon          9 / 52  (17.3%)
  heroStars                   16 / 52  (30.8%)
  talents                     16 / 52  (30.8%)
  season                       4 / 52  ( 7.7%)
  dungeonCheckpoint            5 / 52  ( 9.6%)

Save có ít nhất 1 rune đã gắn: 0
Save có artifact 0 sao trở lên (có key artifactStars): 0
```

Đọc: **16 tài khoản đã sở hữu rune** (`data.runes` có dữ liệu) nhưng **0 tài
khoản** có rune nào đang gắn. Với 46 thánh vật thì **không một tài khoản nào**
có dù chỉ key `artifactStars`. Đây không phải "chưa ai chơi tới" — `runes` có
dữ liệu chứng minh người chơi đã tương tác với hệ thống đó.

## 4. Chứng cứ C — mức thiệt hại về chỉ số

```
$ node tools/unity-parity/measure-save-loss.mjs

3 thánh vật 15★ (đủ bộ):  ATK  152 → 13.251   (+13.099)
sau khi server lọc:       ATK 13.251 → 152    (-98,9%)

4 rune đã gắn:            ATK  152 → 11.792, HP 775 → 47.335, ASPD 1.94 → 2.51, CRIT 0.22 → 0.38
sau khi server lọc:       mất toàn bộ phần trên
```

Không phải "mất vài phần trăm": mất **98,9% ATK** ở cấu hình đủ bộ 15★.

## 5. Vì sao lỗi này tồn tại

`lib/saveSchema.js` là **whitelist**: field không có tên trong danh sách thì bị
bỏ. Danh sách đó được viết khi hệ thống rune/artifact chưa có, và khi thêm hai
hệ thống này người ta quên cập nhật whitelist. Code client thì vẫn lưu và đọc
hai field này từ `SaveState`, nên **trong cùng một phiên chơi** mọi thứ có vẻ
đúng — chỉ hỏng sau khi tải lại trang hoặc đăng nhập lại.

Đó là lý do lỗi không bị phát hiện: nó không hiện ra trong phiên, chỉ hiện ra
sau `GET /api/save`.

## 6. Ảnh hưởng tới migration Unity

1. **Không được** thiết kế Unity tin rằng `artifactStars`/`equippedRuneSlots` sẽ
   có trong save. Nếu Unity làm vậy, nó sẽ tái hiện đúng lỗi này — tệ hơn, vì
   Unity còn có thể ghi đè bằng dữ liệu rỗng.
2. Phase 3 **bị chặn** cho tới khi whitelist được sửa và có test.
3. Đây là lỗi **của bản web**, nên theo yêu cầu "không sửa web", tài liệu này
   chỉ báo cáo. Việc sửa cần người quyết định, vì nó đụng `lib/saveSchema.js`
   (một file production) và cần test hồi quy riêng.

## 7. Đề xuất sửa (chờ phê duyệt, CHƯA làm)

Thêm vào `sanitizeSave()` trong `lib/saveSchema.js`:

```js
artifactStars: sanitizeNumericRecord(raw.artifactStars, { max: 15 }),
runeQualityTier: ["normal","fine","rare","epic","epic_1","epic_2","legendary",
                  "legendary_1","legendary_2","legendary_3","mythic"].includes(raw.runeQualityTier)
                 ? raw.runeQualityTier : "mythic",
runeMythicEnchant: raw.runeMythicEnchant !== false,
equippedRuneSlots: sanitizeRuneSlots(raw.equippedRuneSlots),
```

`sanitizeRuneSlots` phải whitelist 4 khoá (`etched`/`blessing`/`enhancement`/
`ability`), mỗi khoá là mảng slug tối đa 6 phần tử, và chỉ giữ rune id có thật
trong `RUNES_DATA` — nếu không sẽ mở đường cho client bơm id rác.

Kèm theo bắt buộc:

1. Test mới `tests/save-schema-rune-artifact.test.mjs`: save có 3 artifact 15★ +
   7 rune → qua `sanitizeSave` → đọc lại → `getComputedStats()` cho **cùng**
   chỉ số như trước khi lưu.
2. Script backfill **chỉ đọc** để đo ai đã mất dữ liệu — nhưng lưu ý: dữ liệu đã
   mất thì **không thể phục hồi** từ DB, vì server chưa từng lưu nó. Người chơi
   chỉ có thể được đền bù bằng tay.
3. Ghi rõ trong thông báo cho người chơi rằng đầu tư artifact/rune đã bị ảnh
   hưởng.

## 8. Việc migration Unity sẽ làm ngay (không cần phê duyệt)

- Đọc hai field này **nếu có**, không giả định chúng tồn tại.
- **Không** ghi đè lên một save không có chúng bằng dữ liệu rỗng — nếu chưa
  nạp xong save từ server thì không cho ghi (giống `__ARTEMIS_SAVE_READY` của
  bản web).
- Ghi vào `SOURCE_AUDIT.md` (đã ghi, cạm bẫy #18) và ma trận parity là **blocked**.
