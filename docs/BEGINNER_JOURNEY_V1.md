# BEGINNER JOURNEY V1 — ARTEMIS

> Hệ thống hướng dẫn tân thủ có NPC dẫn đường, 8 nhiệm vụ theo dõi **sự kiện
> gameplay thật**, phần thưởng cân bằng, và **chỉ áp dụng cho tài khoản mới**.

---

## 1. Phân biệt tài khoản mới và tài khoản cũ

### Nguyên tắc

**Không** dùng `playerLevel === 1` để xác định tài khoản mới. Tài khoản cũ có thể
vẫn ở level 1 nếu chưa chơi nhiều.

### Cơ chế thật

```
beginnerJourney.startedAt > 0   →  tutorial có hiệu lực
beginnerJourney.startedAt === 0 →  tài khoản cũ, KHÔNG bao giờ kích hoạt
```

`startedAt` chỉ được gán tại **một chỗ duy nhất**: `activateBeginnerJourney()`,
và hàm này chỉ được gọi từ nhánh `mode === "register"` trong `public/cloud.js`:

```js
if (mode === "register" && window.Archero2FusionAPI
    && typeof window.Archero2FusionAPI.activateBeginnerJourney === "function") {
  var activated = window.Archero2FusionAPI.activateBeginnerJourney();
  ...
}
```

`mode` là biến cục bộ của form đăng nhập/đăng ký. Đăng nhập tài khoản cũ luôn có
`mode === "login"` → không đi qua nhánh này → tutorial không bao giờ tự bật.

`activateBeginnerJourney()` còn tự chặn lần hai:

```js
if (bj.startedAt > 0) return false;   // đã kích hoạt rồi
```

### Kết quả kiểm chứng trên trình duyệt thật

| Tài khoản | startedAt | isActive | gold | gearBag | lifetimeKills |
|---|---|---|---|---|---|
| Mới tạo (`bj835254`) | `1793835255170` | `true` | 500 | 0 | 0 |
| Cũ (`web492972`) | `0` | `false` | 624.148 | 34 | 40 |

Tài khoản cũ giữ nguyên **toàn bộ** dữ liệu, panel hiển thị
"Hành trình tân thủ chỉ dành cho tài khoản mới."

## 2. Tám nhiệm vụ

| ID | Tên | Sự kiện kích hoạt (gameplay thật) | Phần thưởng |
|---|---|---|---|
| N01 | Chào mừng Cung Thủ | Bấm "Đã Hiểu" trong hội thoại NPC | 100 🪙 |
| N02 | Làm quen chiến đấu | `Game.roomCleared = true` lần đầu | 200 🪙 + 10 💎 |
| N03 | Thu thập chiến lợi phẩm | Nhặt đủ 10 vật phẩm (`Game.drops.splice`) | 150 🪙 + 2 📜 |
| N04 | Trang bị sức mạnh | `SaveState.equippedGear[slot] = item` | 250 🪙 + 3 📜 |
| N05 | Cường hóa | `item.level = item.level + 1` | 300 🪙 + 2 📜 |
| N06 | Học kỹ năng | `p.skills[skId] = ...` (không tính pre-pin) | 250 🪙 + 15 💎 |
| N07 | Thử thách đầu tiên | `finishRun(true)` với `chapter.id === 1` | 800 🪙 + 50 💎 + 1 🗝️ |
| N08 | Chính thức trở thành Cung Thủ | Bấm "Hoàn Tất" | 1.000 🪙 + 80 💎 |

**Tổng thưởng nếu hoàn thành hết:** 3.050 🪙, 155 💎, 7 📜, 1 🗝️

Không có Legendary/Mythic miễn phí. Không có currency số lượng lớn gây lạm phát
(so sánh: một trận thắng chương 1 cho 350 🪙 + 40 💎).

### Hook được gắn ở đâu (không phải nút bấm giả)

| Hook | Vị trí trong code | Sự kiện thật |
|---|---|---|
| `BeginnerHooks.onRoomCleared()` | ngay sau `Game.roomCleared = true;` trong `damageEnemy` | quái cuối cùng chết |
| `BeginnerHooks.onLoot(1)` | ngay sau `Game.drops.splice(i, 1);` | vật phẩm thật sự được nhặt |
| `BeginnerHooks.onGearEquipped()` | cuối handler `btnModalEquipGear` | đồ được mặc vào slot |
| `BeginnerHooks.onGearUpgraded()` | cuối handler `btnUpgradeGear` (sau khi trừ vàng + cuộn giấy) | nâng cấp thành công |
| `BeginnerHooks.onSkillPicked()` | trong `applyRogueSkill(skId, silent)` khi `!silent` | chọn kỹ năng trong trận |
| `BeginnerHooks.onChapterCleared(id)` | trong `finishRun(isVictory)` khi `isVictory` | thắng chương |

Không nhiệm vụ nào hoàn thành bằng cách bấm nút "hoàn thành" — chỉ N01 và N08 là
bước hội thoại, cố ý như vậy.

## 3. Chống nhận thưởng trùng

Hai lớp:

**Client** — `claimBeginnerReward`:
```js
if (bj.claimedRewards.includes(stepId)) return false;
if (!(bj.completedSteps || []).includes(stepId)) return false;
```

**Server** — `sanitizeBeginnerJourney` trong `lib/saveSchema.js`:
```js
const claimedRewards = claimedRaw.filter((id) => completedSteps.includes(id));
```
và `sanitizeStepIdList` dedupe + whitelist 8 ID.

Nghĩa là kể cả client bị sửa để gửi `claimedRewards: ["N01","N01","N07"]` khi chưa
hoàn thành N07, server sẽ lưu `["N01"]`.

Kiểm chứng: claim N01 lần hai trả `False`, vàng không tăng.

## 4. Schema

```js
beginnerJourney: {
  version: 1,
  startedAt: 0,          // 0 = tài khoản cũ, chưa từng kích hoạt
  completedAt: 0,
  skipped: false,
  currentStep: 'N01',
  completedSteps: [],    // whitelist N01..N08, dedupe, đúng thứ tự khai báo
  claimedRewards: [],    // chỉ chứa ID đã có trong completedSteps
  isCompleted: false,
}
```

Lưu ở cả `localStorage` (`SaveState.save()`) và MongoDB (`PUT /api/save`).
Revision conflict xử lý sẵn bởi cơ chế `revision` hiện có của `/api/save`.

## 5. Backward compatibility

Save cũ (chưa có `beginnerJourney`) → migration tạo object **rỗng** với
`startedAt: 0`:

```js
if (!this.beginnerJourney || typeof this.beginnerJourney !== 'object') {
  this.beginnerJourney = { ...bjDefaults };
}
```

Không đụng tới bất kỳ field nào khác của save. Không reset dữ liệu.
Không thay đổi trang bị/pet/rune/skill/currency/tiến trình phó bản.

## 6. Giao diện

Panel nằm trong tab **Thẻ Tài Năng** (`#tabTalents`), container
`#beginnerJourneyContainer`, có thể ẩn/hiện bằng nút `#btnBeginnerJourneyToggle`.

Thành phần:
- Avatar NPC Artemis (🐴) + hội thoại
- Thanh tiến độ `done/8` với gradient
- Danh sách 8 thẻ nhiệm vụ, mỗi thẻ có icon, ID, tiêu đề, mô tả, nhãn sự kiện,
  phần thưởng, trạng thái (✔ XONG / ▶ ĐANG LÀM / 🔒 CHƯA MỞ)
- Nút "Nhận thưởng" riêng cho từng bước đã xong
- Nút "Bỏ qua hướng dẫn" (có confirm)

Responsive: dùng `flex flex-col gap-2` và Tailwind breakpoint sẵn có của game,
hoạt động cả mobile và desktop.

## 7. Skip

```js
function skipBeginnerJourney() {
  bj.skipped = true;
  bj.completedAt = Date.now();
  SaveState.save();
}
```

`startedAt` **giữ nguyên** → không kích hoạt lại. Panel vẫn xem lại được.
Người chơi bỏ qua sẽ không nhận được thưởng các bước còn lại (theo spec).

## 8. Kiểm thử

`tests/beginner-journey.test.mjs` — 71 assertions:

- 8 bước tồn tại đúng ID
- `isBeginnerJourneyActive()` trả false khi `startedAt = 0` / `skipped` / `isCompleted`
- Không dùng `playerLevel` để xác định tài khoản mới
- `activateBeginnerJourney` idempotent
- `completeBeginnerStep` chặn ID ngoài whitelist và bước đã xong
- 6 hook gameplay thật nằm ngay sau sự kiện tương ứng
- `claimBeginnerReward` chặn nhận hai lần và chặn nhận bước chưa xong
- Migration tạo `startedAt: 0` cho save cũ
- Server: dedupe, whitelist, chặn claim bước chưa hoàn thành
- UI: container, nút toggle, thanh tiến độ, nút nhận thưởng, nút bỏ qua

## 9. Chưa triển khai

- Checkpoint / Continue giữa phó bản (xem `docs/DUNGEON_RESET_SPEC.md` §7)
- Hội thoại nhiều bước (mỗi bước hiện là một đoạn văn, không phải chuỗi thoại)
- Nhiệm vụ phụ ngoài 8 bước chính
- Thông báo đẩy khi hoàn thành bước ngoài màn hình phó bản
