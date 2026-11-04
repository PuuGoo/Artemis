# DUNGEON RESET SPEC — ARTEMIS

> Định nghĩa hành vi reset phó bản. Mọi thay đổi phải giữ nguyên các bất biến
> trong tài liệu này.

---

## 1. Ba hành động, ba ý nghĩa

| Hành động | Nút | Ý nghĩa | Chương | Session |
|---|---|---|---|---|
| **Retry** | 🔄 Chơi Lại Ngay | Chơi lại phó bản hiện tại từ màn 1 | giữ nguyên | mới |
| **Reset** | (về sảnh rồi chọn chương) | Kết thúc phiên, tạo phiên mới từ màn 1 | chọn lại | mới |
| **Continue** | ▶ Tiếp Tục Chơi | Tiếp tục phiên đang tạm dừng | giữ nguyên | giữ nguyên |

Trước đây cả ba dùng chung `startNewRun()` mà không phân biệt. Nay:
- `startNewRun('retry')` — dùng cho nút Chơi Lại
- `startNewRun('fresh')` — dùng khi chọn chương mới từ sảnh
- `Continue` chỉ `Game.paused = false` trên session đang có (không tạo session mới)

## 2. Ranh giới dữ liệu

### Thuộc phiên chơi — PHẢI xoá khi reset

```
Game.room, Game.maxRooms, Game.kills, Game.runGold
Game.enemies, Game.obstacles
Game.playerBullets, Game.enemyBullets, Game.swords, Game.drops
Game.particles, Game.floatTexts, Game.shockwaves, Game.lightningBolts
Game.meteors, Game.artemisHawks, Game.ambientMotes
Game.floorDetails, Game.floorDecals, Game.afterimages
Game.muzzleFlashes, Game.wallTorches
Game.roomCleared, Game.portalOpen, Game.playerTookDamageThisRoom
Game.shakeTime, Game.shakeMag, Game.roomBannerTimer
Game.nyanjaSwordTimer, Game.artemisHawkTimer, Game.flyingSwordSkillTimer
Game.meteorTimer, Game.afterimageTimer, Game.thorMoveHammerTimer
Game.comboCount, Game.comboTimer, Game.screenFlashTimer, Game.cleoFireHitCount
Game.joy.*  (joystick)
Game.player  (dựng lại hoàn toàn từ getComputedStats)
Game.pet     (dựng lại)
```

### Thuộc nhân vật — TUYỆT ĐỐI KHÔNG xoá

```
SaveState.gold, SaveState.gems, SaveState.stamina
SaveState.equippedGear, SaveState.gearBag, SaveState.presets, SaveState.gearLoadouts
SaveState.gearLevel, SaveState.gearScrolls, SaveState.chestKeys
SaveState.heroStars, SaveState.heroShards, SaveState.heroSelectedSkins, SaveState.unlockedSkins
SaveState.talents, SaveState.runes, SaveState.artifactStars, SaveState.equippedRuneSlots
SaveState.bestRooms, SaveState.selectedChapterIdx
SaveState.lifetimeStats, SaveState.achievementsUnlocked, SaveState.achievementsClaimed
SaveState.beginnerJourney
SaveState.wikiOtherItems, SaveState.wishTokens
```

## 3. Cơ chế session

```js
DungeonSession = {
  active: false,
  id: 0,          // tăng mỗi lần begin()
  startedAt: 0,
  chapterIdx: 0,
  begin(chapterIdx),  // gọi ở startNewRun()
  end(),              // gọi ở finishRun()
}
```

`Game.sessionId` được gán bằng `DungeonSession.id` khi `begin()`, về `0` khi `end()`.
Dùng để kiểm tra không có hai phiên chạy song song.

## 4. Chống chạy song song

`startNewRun()` gọi `stopGameLoop()` **trước** mọi thứ khác:

```js
function stopGameLoop() {
  if (Game.animId) {
    cancelAnimationFrame(Game.animId);
    Game.animId = 0;
  }
}
```

Trước đây bấm "Chơi Lại" hai lần liên tiếp tạo hai `requestAnimationFrame` cùng
lúc, cả hai cùng `updateGame()` + `renderGame()` trên một `Game` object → quái di
chuyển gấp đôi tốc độ, sát thương nhân đôi.

`finishRun()` cũng gọi `stopGameLoop()` để không còn frame cũ sau khi trận kết thúc.

## 5. Đảm bảo không phát thưởng trùng

| Loại | Cơ chế |
|---|---|
| `runs` | đếm **một lần** ở `startNewRun()`, không đếm ở `finishRun()` |
| `goldEarned` | cộng ở `finishRun()` từ `Game.runGold` — reset về 0 mỗi trận |
| `gold`/`gems` thưởng trận | cộng ở `finishRun()`, chỉ chạy khi `Game.running` chuyển true→false một lần |
| Thành tựu | `achievementsClaimed[id]` chặn nhận hai lần |
| Beginner Journey | `claimedRewards[]` chặn nhận hai lần, server cũng kiểm tra |

## 6. Kiểm thử bắt buộc

Test tự động: `tests/dungeon-reset.test.mjs` (74 assertions).

Kịch bản thủ công đã chạy trên trình duyệt thật:

| Kịch bản | Kết quả |
|---|---|
| Reset khi đang chiến đấu (phòng 10) | ✅ về phòng 1, quái mới, HP đầy |
| Reset khi đang đánh boss | ✅ boss cũ mất, không còn boss HUD |
| Reset khi có projectile/particle | ✅ tất cả array = 0 |
| Reset liên tiếp nhiều lần | ✅ session id tăng đều, không chạy song song |
| Reset khi có buff/combo (combo 99) | ✅ combo về 0 |
| Reset sau khi thắng | ✅ về phòng 1, thưởng thắng đã cộng đúng 1 lần |
| Reset sau khi thua | ✅ về phòng 1, `failedRun` không cộng nhầm |
| Refresh trang giữa trận | ✅ về sảnh (không hỗ trợ checkpoint), dữ liệu nhân vật nguyên vẹn |
| Đăng nhập lại | ✅ tải save từ MongoDB, dữ liệu nhân vật nguyên vẹn |

Đo thực tế sau reset (0 ms, đo ngay không cho game chạy):

```
particles:  46 → 0
floatTexts:  5 → 0
bullets:     1 → 0
combo:      99 → 0
kills:      77 → 0
runGold:     ? → 0
room:        ? → 1
sessionId:   ? → 3 (mới)
```

Và dữ liệu nhân vật giữ nguyên tuyệt đối:

```
gold:        968 → 968
gems:         70 → 70
gearBag:      1 → 1
weapon: rusty_bow → rusty_bow
beginnerJourney.completedSteps: 4 → 4
bestRooms:    1 → 1
lifetimeKills: 9 → 9
```

## 7. Continue (checkpoint) — chưa triển khai

Game hiện **không lưu trạng thái giữa các phòng**. Đóng tab giữa trận = mất lượt chơi
đó (dữ liệu nhân vật vẫn an toàn vì đã lưu sau mỗi phòng).

Lý do: lưu checkpoint đòi hỏi serialize toàn bộ `Game` state (enemies, bullets,
particles, timers) vào save — dung lượng lớn và dễ hỏng khi format thay đổi.
Chưa nằm trong phạm vi V1.

Nếu triển khai sau này:
- Chỉ lưu khi `Game.roomCleared === true` (điểm an toàn)
- Chỉ lưu `room`, `chapter`, `kills`, `runGold`, `player.hp/level/xp/skills`
- Không lưu entity đang bay
- `Continue` chỉ khả dụng khi có checkpoint của **cùng** `chapterIdx`
- `Retry` xoá checkpoint
