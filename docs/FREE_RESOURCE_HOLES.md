# LỖ HỔNG TÀI NGUYÊN MIỄN PHÍ — ĐÃ VÁ

> Quét toàn bộ điểm cộng tài nguyên trong source. Tìm được **ba lỗ hổng** cho
> phép tạo vàng/đá quý/mảnh tướng không giới hạn. Hai trong số đó còn tệ hơn
> lỗ hổng Tuyệt Kỹ: chúng **tạo tài nguyên** chứ không chỉ gây sát thương.

---

## 1. Ba nút "viện trợ" ở thanh trên

### Lỗ hổng

```js
document.getElementById('btnTopAddGold').addEventListener('click', () => {
  SaveState.gold += 500;      // KHÔNG giới hạn, KHÔNG guard
  SaveState.save();
  showToast('🪙 Nhận viện trợ +500 Vàng!');
});
document.getElementById('btnTopAddGem').addEventListener('click', () => {
  SaveState.gems += 50;       // KHÔNG giới hạn, KHÔNG guard
});
document.getElementById('btnRefillStamina').addEventListener('click', () => {
  SaveState.stamina = 30;
  SaveState.gold += 300;      // tặng cả vàng khi hồi năng lượng
});
```

Ba nút này **không nằm trong `DEV_CHEAT_BUTTON_IDS`** — danh sách chặn dev-cheat
đã có từ trước đó. Nghĩa là cơ chế chống cheat hoạt động đúng, chỉ là ba nút này
bị bỏ sót.

### Đo thực tế trên production

```
devMode: false (người chơi thật)
10 lần bấm → +8.000 vàng, +500 đá quý, năng lượng đầy
```

Bấm 1.000 lần → +500.000 vàng + 50.000 đá quý. Không giới hạn.

### Cách vá — hai lớp

**Lớp 1 — ẩn nút:** thêm vào `DEV_CHEAT_BUTTON_IDS`:

```js
'btnTopAddGold', 'btnTopAddGem', 'btnRefillStamina',
```

**Lớp 2 — chặn tầng hàm:** ẩn nút không đủ, người dùng vẫn gọi được từ console:

```js
document.getElementById('btnTopAddGold').addEventListener('click', () => {
  if (!devCheatsEnabled()) return blockedCheatNotice();
  ...
});
```

Kiểm chứng: cả ba nút `visible: false`, gọi `.click()` qua console → `goldDelta: 0`,
`gemsDelta: 0`.

## 2. `summonHeroShards()` — tự tặng 500 đá quý khi thiếu

### Lỗ hổng (nghiêm trọng nhất)

```js
function summonHeroShards(heroId, amount = 100) {
  const gemCost = 50;
  if (SaveState.gems < gemCost) {
    SaveState.gems += 500;        // ← TỰ CỘNG 500
  }
  SaveState.gems = Math.max(0, SaveState.gems - gemCost);
  SaveState.heroShards[heroId] = getHeroShardsCount(heroId) + amount;
  ...
}
```

Nếu người chơi có **0 đá quý**:
- Tự cộng 500 → 500
- Trừ 50 → **450**
- Nhận 100 mảnh tướng

**Lãi ròng mỗi lần bấm: +450 đá quý và +100 mảnh tướng, vô hạn.**

Đây có vẻ là "ân hạn" viết cho tiện khi test — nhưng nó chạy trên production.
Chỉ cần bấm nút triệu hồi vài lần là có mọi tướng 8★.

### Cách vá

```js
if ((SaveState.gems || 0) < gemCost) {
  showToast(`💎 Cần ${gemCost} Đá Quý để triệu hồi (đang có ${Math.floor(SaveState.gems || 0)}).`, 'err');
  return getHeroShardsCount(heroId);      // không làm gì, báo rõ
}
SaveState.gems = Math.max(0, SaveState.gems - gemCost);
```

### Kiểm chứng

| Tình huống | Trước | Sau |
|---|---|---|
| 10 đá quý, bấm triệu hồi | lên **510** và +100 mảnh | giữ **10**, không mảnh |
| 50 đá quý, bấm triệu hồi | về 0, +100 mảnh | về 0, +100 mảnh ✓ |
| 0 đá quý, bấm 10 lần | **+4.500 đá quý, +1.000 mảnh** | 0, 0 |

## 3. `resetHeroStarToOne()` — tặng 1.600 mảnh miễn phí

```js
function resetHeroStarToOne(heroId) {
  SaveState.heroStars[heroId] = 0;
  SaveState.heroShards[heroId] = Math.max(getHeroShardsCount(heroId), 1600);
  ...
}
```

Đặt sao về 0 nhưng **tặng kèm 1.600 mảnh** — mỗi lần bấm lại được 1.600 mảnh
(nếu đang ít hơn). Đã thêm guard:

```js
if (!devCheatsEnabled()) { blockedCheatNotice(); return; }
```

## 4. Quét mẫu lỗi trên toàn file

Tìm mọi chỗ có dạng "thiếu X thì tự cộng X":

```regex
if (SaveState.(gems|gold) < ...) { SaveState.(gems|gold) += ... }
```

Kết quả: **0 chỗ** sau khi vá. Đây là mẫu lỗi nguy hiểm vì nó không báo lỗi,
không crash — chỉ âm thầm tạo tài nguyên.

## 5. Test khoá lại

`tests/free-resource.test.mjs` — **23 assertion**:

- Ba nút viện trợ nằm trong danh sách chặn
- Mỗi handler có guard `devCheatsEnabled()` **và guard chạy trước** khi cộng tài nguyên
- `summonHeroShards` không còn `SaveState.gems += 500`
- Có kiểm tra thiếu đá quý, báo lỗi rồi `return`
- Đủ đá quý thì trừ đúng `gemCost` và cộng đúng `amount`
- Toàn file không còn mẫu "thiếu X thì tự cộng X"
- `resetHeroStarToOne` có guard, guard chạy trước khi cộng mảnh
- `maxSingleHeroStarAndSkins`, `applyMaxAllSystems` vẫn có guard
- `devCheatsEnabled` đọc từ query string (không phải localStorage — không sửa được)

## 6. Bài học

Cơ chế chống cheat theo **danh sách ID** có điểm yếu cố hữu: thêm nút mới mà quên
thêm vào danh sách thì nút đó thành lỗ hổng. Hai lớp phòng thủ là bắt buộc:

1. **Danh sách chặn** (ẩn UI) — che khỏi người chơi thường
2. **Guard trong handler** (chặn logic) — chặn cả người biết dùng console

Và quan trọng hơn: **không bao giờ viết "thiếu tài nguyên thì tặng thêm tài
nguyên"**. Đó không phải là xử lý lỗi — đó là lỗ hổng được nguỵ trang thành
tiện ích.
