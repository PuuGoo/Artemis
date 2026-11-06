# Hero selection ownership — mọi đường gán `selectedHeroId`

> Workstream hẹp: chỉ `public/index.html`, test mới `tests/hero-selection-ownership.test.mjs`, và file này. Không sửa test cũ, schema, cloud, auth. Không commit/push/deploy, không chạm .env/DB/production.

## Kết luận ngắn

- **8 đường gán `SaveState.selectedHeroId` đã bị kiểm tra và đóng** (2 đường trước đây đã có guard ở roster cũ / `.hero-card-btn`).
- Không còn đường UI nào ghi hero **không sở hữu** hoặc **không tồn tại** vào save.
- Trial Demon King (Atreus) **được giữ**, nhưng đổi từ "ghi đè save" sang "override chỉ trong lúc dựng trận" ⇒ save và hero đang chọn không bị thay đổi, không mất trạng thái cũ.
- Sửa thêm 2 lỗi grant liên quan (VN star-up, mua mảnh bằng gem) và 1 lỗi hiển thị 0★ → 6★.

## Test (thật, chạy trên production code)

```bash
# Test mới — RED trước khi sửa, GREEN sau khi sửa
node --test tests/hero-selection-ownership.test.mjs
# → 25 tests / 25 pass / 0 fail

# Nhóm hồi quy liên quan (không sửa các file test này)
node --test tests/hero-selection-ownership.test.mjs tests/new-player-gameplay-runtime.test.mjs \
  tests/hero-roster-nav.test.mjs tests/dev-cheats.test.mjs tests/free-resource.test.mjs \
  tests/beginner-journey.test.mjs tests/save-schema.test.mjs
# → 63 tests / 63 pass / 0 fail

# Toàn repo
npm test
# → 142 tests / 134 pass / 6 fail (xem "Nợ baseline" bên dưới)

# Cú pháp
node --check lib/auth.js && node --check lib/mongo.js && node --check api/save.js   # OK
git diff --check                                                                     # OK
```

Cách test chạy: đọc `public/index.html`, **cắt đúng ranh giới production** (`between()` + `declaration()`), nạp `HEROES`, `getHeroStarLevel`, `isHeroOwned`, `getComputedStats`, `startNewRun`, `launchEventCanvasRun`, `upgradeHeroStar`, `summonHeroShards` cùng **binding click thật** vào Node `vm` với save fixture. DOM/âm thanh/render phụ được stub; mọi ghi save, guard, và logic chọn hero là mã production. Không HTTP, không DB.

### Bằng chứng RED (chạy test mới trên `git archive HEAD` — code trước khi sửa)

```
tests/hero-selection-ownership.test.mjs
ℹ tests 25 / pass 6 / fail 19
✖ char-subtab / jump-upgrade / vn-hero-use / hero-card: locked+invalid selections have no writes
✖ grid[data-hero-pick]: owned heroes selectable (isHeroOwned chưa chặn id lạ)
✖ shared ownership rejects nonexistent IDs
✖ btnStagePrevHero / btnStageNextHero ×2 (xoay qua hero chưa sở hữu)
✖ real Demon King binding plays Atreus for this run only (save bị ghi `atreus`)
✖ forced invalid/unowned non-trial hero never persists (ghi `missing`/`thor` + `dungeonCheckpoint`)
✖ event trial preserves selected hero when startup blocked/throws
✖ VN star-up / star-shard grants / gem shard purchase (unlock & trừ gem trước khi validate)
✖ stage gear summary 0★ → hiện 6★
```

Ghi chú: 6 test pass sẵn từ đầu là các case "hero sở hữu vẫn chọn được" và `.hero-card-btn`/`[data-hero-pick]` đã có guard — đúng như parent đã xác định. 19 test còn lại là RED thật.

## Từng đường gán và cách xử lý

| # | Vị trí (sau sửa) | Trước | Sau |
|---|---|---|---|
| 1 | `renderHeroRoster` pick | đã guard `isHeroOwned` | giữ; `isHeroOwned` nay chặn cả id lạ |
| 2 | quick stage `[data-stage-hero]` (`:17401`) | **unguarded** | `if (!isHeroOwned(nextHeroId)) → toast, return` |
| 3 | `.char-subtab-hero-btn` (`:17870`) | **unguarded** | lấy id vào biến, guard rồi mới gán |
| 4 | `[data-jump-upgrade-hero]` (`:19836`) | **unguarded** | guard trước khi gán + save |
| 5 | `launchEventCanvasRun(forceHeroId)` (`:21379`) | ghi thẳng vào `SaveState` | chỉ cho `atreus` (trial) hoặc hero hợp lệ & sở hữu; id lạ/không sở hữu → toast + `return false`, không dựng trận |
| 6 | `[data-vn-hero-use]` (`:25265`) | `hObj.unlocked = true` rồi map id lạ → `'artemis'` | bỏ unlock metadata + bỏ fallback; guard `isHeroOwned`, gán đúng id |
| 7 | `.hero-card-btn` cũ (`:26373`) | đã guard | giữ nguyên |
| 8 | `btnStagePrevHero` / `btnStageNextHero` (`:32289`, `:32302`) | xoay vòng toàn bộ 18 hero | xoay vòng **chỉ hero sở hữu**; 1 hero sở hữu ⇒ đứng yên; id hiện tại lạ ⇒ về hero sở hữu đầu tiên (không kẹt) |

`isHeroOwned` (dùng chung, `:14198`):

1. `!heroId` → false.
2. Không có trong `HEROES` → false (**id lạ không bao giờ pass**).
3. `alex` → true (luôn sở hữu, kể cả 0★).
4. `getHeroStarLevel(id) >= 1` → true.
5. `id === SaveState.selectedHeroId` → true (giữ đúng ca legacy: hero 0★ đang được chọn vẫn dùng được — không reset save cũ).

## Trial Atreus: thiết kế lại (không xoá oan)

Gọi thật duy nhất có `forceHeroId`: nút `btnDemonPlayAtreusCanvas` → `launchEventCanvasRun(..., 1.85, 'atreus')` ("Demon King Clash • Play as Demon King Atreus"). Đây là trial có chủ đích, không phải chọn hero.

Trước: `SaveState.selectedHeroId = 'atreus'` **trước** `startNewRun()`, nên save bị đổi vĩnh viễn và người chơi mất hero đang chọn (kể cả khi vào trận thất bại).

Sau:

- `runHeroOverrideId` chỉ được set trong `try` quanh `startNewRun()` và **luôn** reset trong `finally`.
- `getComputedStats(heroId = runHeroOverrideId || SaveState.selectedHeroId)` — override không tồn tại ngoài cửa sổ dựng trận, nên mọi đường khác (`retry`, `continue`, lobby, checkpoint) vẫn dùng hero đã chọn.
- Test xác nhận: `Game.player.hero.id === 'atreus'` trong trận, `SaveState.selectedHeroId === 'artemis'` sau đó, **mọi** lần `SaveState.save()` trong lúc startup đều ghi `artemis`, và `startNewRun()` kế tiếp trở lại `artemis`.
- Trial bị chặn (chương khoá) hoặc startup ném lỗi ⇒ hero đang chọn giữ nguyên.

Rủi ro còn lại: nếu sau này có thêm trial cho hero khác, phải whitelist tường minh (`forceHeroId === 'atreus'`) — hiện code đang làm đúng như vậy, và mọi id khác đều phải sở hữu.

## Grant/star handler liên quan (audit hẹp, không refactor)

- `upgradeHeroStar(id)`: trước rơi về `HEROES[0]` khi id lạ ⇒ ghi `heroStars[name lạ]`. Nay trả `false` nếu id không tồn tại, không ghi gì.
- `summonHeroShards(id)`: trước rơi về `HEROES[0]` ⇒ ghi mảnh rác. Nay trả `0`, không trừ gem.
- `[data-buy-hero-shard]`: trước trừ 100 💎 rồi mới gọi summon (id lạ vẫn mất gem). Nay validate `HEROES` **trước** khi trừ.
- `[data-vn-hero-starup]`: trước tự `hObj.unlocked = true` + tự tăng `hObj.stars` rồi mới gọi `upgradeHeroStar` (nên thất bại vẫn "lên sao" trên UI). Nay đi qua `upgradeHeroStar` canonical (đủ mảnh/vàng), chỉ đồng bộ `hObj.stars` khi thành công, **không** bật `unlocked`.
- Không đụng `resetHeroStarToOne` / `maxSingleHeroStarAndSkins` (đã khoá sau `devCheatsEnabled`, parent vừa thêm guard local-origin).

## Sửa hiển thị 0★ (P2, đã làm)

`stageVisualGearSummary` dùng `${stats.heroStar || 6}★` ⇒ Alex 0★ hiện "6★". Nay:

```js
const summaryStar = Number.isFinite(stats.heroStar) ? stats.heroStar : getHeroStarLevel(stats.hero.id);
```

`0` là hợp lệ và được giữ; chỉ fallback khi giá trị không phải số. Test render-snippet khẳng định `Alex (0★)`; đã kiểm chứng ngược (revert dòng này ⇒ test đỏ với `Alex (6★)`).

## Nợ baseline (không do thay đổi này)

`npm test`: 142 tests / 134 pass / **6 fail** — `bestiary`, `chapter-select`, `map-select`, `garden`, `season`, `economy`. Đã đối chứng bằng `git archive HEAD` (worktree sạch): các file này fail **đúng cùng số check** trên code gốc (46/10, 49/7, 124/3, 57/3, 56/1, 36/1). Đây là assertion nội dung/đếm cũ (ví dụ "có 4 chương" trong khi dữ liệu có 6), không liên quan hero. `dungeon-reset` từng đỏ do tôi tạm đổi chữ ký `startNewRun` — đã hoàn nguyên về 1 tham số, hiện 74/0.

## Rủi ro / điều kiện còn lại

- Kiểm chứng ở đây là VM trên mã production; **chưa** phải bằng chứng trình duyệt. Parent chạy harness Chrome cuối (stage-quick Thor, char-subtab Thor, prev/next từ fixture chỉ có Alex).
- `isHeroOwned` có nhánh `typeof HEROES !== 'undefined'` để harness cũ chỉ nạp riêng hàm này không ném `ReferenceError`; trong trang thật `HEROES` luôn tồn tại nên nhánh luôn chạy.
- `data-vn-select-hero` chỉ đổi `st.selectedHeroIdVn` (state xem trước, không ghi `selectedHeroId`) — giữ nguyên có chủ đích.
- Save cũ đang chọn hero 0★ không bị reset: `isHeroOwned` trả true cho `SaveState.selectedHeroId`, và asset (`heroStars`/`heroShards`/`heroSelectedSkins`) không bị chạm ở mọi đường đã sửa.
