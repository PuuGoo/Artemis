# LỖ HỔNG TUYỆT KỸ KHÔNG HỒI CHIÊU — ĐÃ VÁ

> Phát hiện khi quét nút chết trên production. Nghiêm trọng hơn "nút chết": đây
> là **nút hoạt động quá tốt**, phá toàn bộ cân bằng phó bản.

---

## 1. Lỗ hổng

`triggerCelestialUltimate()` (trước khi vá):

```js
function triggerCelestialUltimate() {
  if (!Game.running || !Game.player) return;
  const p = Game.player;
  ...
  for (let k = 0; k < 20; k++) {
    Game.playerBullets.push({ dmg: p.atk * 1.45, bouncesLeft: 2, ... });
  }
}
```

**Không cooldown. Không tiêu năng lượng. Không giới hạn.**

Nút HUD `#btnTriggerUltimate` có `class="animate-pulse"` (nhấp nháy như đang sẵn
sàng), tooltip ghi "Phím Space". Cả hai đường — nút và phím Space — đều gọi hàm
này vô điều kiện:

```js
document.getElementById('btnTriggerUltimate')?.addEventListener('click', triggerCelestialUltimate);

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space' && Game.running && !Game.paused) {
    ev.preventDefault();
    triggerCelestialUltimate();
  }
});
```

### Đo thực tế trên production (tài khoản `puugoo`, ATK 99.763)

```
Bấm 1 lần  → 20 đạn × 144.656 = 2.893.120 sát thương
Bấm 10 lần → 200 đạn        = 28.931.200 sát thương
```

Không có quái hay boss nào chịu nổi. Người chơi chỉ cần giữ phím Space là xong
mọi phó bản — toàn bộ cân bằng quái/boss vừa làm (HP 2,2–3,4% maxHp, boss 55%)
trở nên vô nghĩa.

## 2. Cách vá

Năng lượng Tuyệt Kỹ kiểu MOBA:

```js
const ULT_COST = 100;            // năng lượng cần
const ULT_REGEN_PER_SEC = 18;    // hồi 18 NL/giây → 5,6 giây mỗi lần dùng
```

### Trong `triggerCelestialUltimate()`

```js
if (p.ultCharge < p.ultMax) {
  const pct = Math.round((p.ultCharge / p.ultMax) * 100);
  spawnFloatText(p.x, p.y - 40, `⚡ Năng lượng ${pct}%`, '#94a3b8', 12);
  return;                      // chưa đủ thì không bắn, VÀ báo cho người chơi biết
}
p.ultCharge = 0;               // tiêu hết
syncUltimateButton();          // cập nhật nút ngay
```

### Trong `updateGame(dt)`

```js
updateUltimateCharge(dt);      // hồi 18 NL/giây, chỉ khi game đang chạy
```

### Nút HUD phản ánh trạng thái thật

`syncUltimateButton()`:
- Nhấp nháy **chỉ khi** năng lượng đầy (trước đây luôn nhấp nháy — gây hiểu nhầm)
- Hiện `🔥 Tuyệt Kỹ (37%)` khi đang hồi
- Làm mờ (`opacity 0.55`) khi chưa dùng được
- Tooltip ghi rõ % còn thiếu

### Khởi tạo

`Game.player` có `ultCharge: ULT_COST, ultMax: ULT_COST` — đầu trận đầy, dùng
được ngay một lần, sau đó phải chờ.

## 3. Kiểm chứng

### Trước khi vá (production)
```
Bấm 1 lần:  20 đạn
Bấm 6 lần:  120 đạn (20 mỗi lần)
Bấm 10 lần: 200 đạn
```

### Sau khi vá (local)
```
Bấm 6 lần liên tiếp → 20 đạn   ✓ (chỉ lần đầu bắn)
Năng lượng           100 → 0    ✓
Nút                  "🔥 Tuyệt Kỹ (0%)", không nhấp nháy, opacity 0.55  ✓
Sau ~2,5s game chạy  NL hồi 0 → 23 → 32  ✓
```

Ghi chú kỹ thuật: khi tab bị ẩn, `requestAnimationFrame` bị browser throttle nên
năng lượng đứng yên — đúng hành vi trình duyệt, không phải lỗi. Sau
`Page.bringToFront` năng lượng hồi bình thường.

## 4. Test khoá lại

`tests/ultimate.test.mjs` — **20 assertion**:

- Hàm có guard `ultCharge < ultMax` và `return` khi chưa đủ
- Tiêu hết năng lượng sau khi bắn
- Có cảnh báo cho người chơi (không im lặng)
- `updateUltimateCharge` được gọi trong `updateGame`
- Tốc độ hồi 10–30 NL/giây; hồi đầy trong 4–10 giây
- Nút chỉ nhấp nháy khi sẵn sàng, hiện %, làm mờ khi chưa dùng được
- `syncUltimateButton` gọi ngay sau khi bắn (không đợi frame sau)
- `player` khởi tạo có `ultCharge`/`ultMax`
- Phím Space đi qua đúng hàm có guard

## 5. Bài học

Nút có `animate-pulse` là lời hứa với người chơi rằng "bấm được bây giờ". Nếu
logic bên trong không có giới hạn, giao diện đang nói dối — và trong trường hợp
này còn tạo ra lỗ hổng cân bằng nghiêm trọng hơn mọi bug UI khác.

Khi quét nút, phải phân biệt ba trạng thái: **nút chết** (bấm không gì xảy ra),
**nút sống** (bấm có phản ứng), và **nút sống quá mức** (bấm bao nhiêu cũng
được) — loại thứ ba nguy hiểm nhất vì nó không gây lỗi, chỉ phá game.
