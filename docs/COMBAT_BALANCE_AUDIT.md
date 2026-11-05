# COMBAT BALANCE AUDIT — ARTEMIS

> Phạm vi: audit toàn bộ hệ thống chỉ số, công thức sát thương, cân bằng quái/boss và
> cơ chế reset phó bản của `public/index.html`, tại thời điểm trước khi triển khai
> `feature/beginner-journey-v1`.
>
> Mọi công thức dưới đây **trích trực tiếp từ source** — số dòng ghi kèm để đối chiếu.
> Không có công thức nào được tự suy diễn.

---

## 1. Điểm vào: `getComputedStats()`

Toàn bộ chỉ số nhân vật lúc bắt đầu trận do một hàm duy nhất tính:
`getComputedStats()` — `public/index.html`, bắt đầu dòng **8292**.

Trả về:

```js
{ hero, heroStar, starMilestone, activeSkin, globalAll, resonance, weapon, pet,
  baseAtk, baseHp, baseAspd, baseCrit, gearDodge, goldBonus, powerScore, gearAtk, gearHp }
```

`startNewRun()` (dòng **19990**) chép các field này vào `Game.player` và **từ đó không
tính lại nữa**. Đây là nguồn gốc của phần lớn lỗi cân bằng bên dưới.

---

## 2. Công thức ATK (hiện trạng)

`getComputedStats()`, dòng **8345**:

```js
const baseAtk = Math.round(
  ( 78
    + gearAtk          // tổng stat các món đang mặc
    + gemAtk           // đá quý khảm
    + affAtkFlat       // dòng phụ dạng phẳng
    + runeAtk          // rune + artifact flat
    + heroStarAtk      // hero.bonusAtk * (1 + milestone.atkMult) + flat + skin
    + (SaveState.gearLevel - 1) * 12
    + talentTotals.flatAtk
  )
  * weapon.atkMult
  * ( 1 + setAtkRate + affAtkPct + globalAll.atkPct
        + artifactTotals.totalAtkPct + starMilestone.atkMult * 0.25 )
);
```

Nguồn cộng gộp:

| Nguồn | Lấy từ | Ghi chú |
|---|---|---|
| `gearAtk` | `computeSingleItemStat()` dòng **7159** × `(1 + globalAll.gearBasePct + talentTotals.gearBasePct)` | dòng 8314 |
| `gemAtk` | `getGemBonuses()` dòng **7351** | |
| `affAtkFlat` / `affAtkPct` | `getAffixBonuses()` dòng **7267** | pct chia 100 |
| `runeAtk` | `computeTotalEquippedRunesStats().atk` + `computeAllArtifactsAndSetsBonuses().flatAtk` | dòng 8331 |
| `heroStarAtk` | `hero.bonusAtk * (1 + starMilestone.atkMult) + flatAtk + skin + skinCollection` | dòng 8338 |
| `talentTotals` | `computeAllTalentCardsBonuses()` dòng **3475** | |
| `setAtkRate` | `getSetBonuses()` dòng **7334** | |

## 3. Công thức HP (hiện trạng)

Dòng **8346**:

```js
const baseHp = Math.round(
  ( 420 + gearHp + gemHp + affHpFlat + runeHp + heroStarHp
    + (SaveState.gearLevel - 1) * 45 + talentTotals.flatHp )
  * ( 1 + setHpRate + affHpPct + globalAll.hpPct
        + artifactTotals.totalHpPct + starMilestone.hpMult * 0.25 )
);
```

## 4. Attack Speed và CRIT Rate

Dòng **8347** (ASPD):

```js
baseAspd = weapon.aspd * (1 + talentTotals.aspdBonus + epicCount*0.03 + setAspdRate
                          + affAspd + runeTotals.aspdBonus + artifactTotals.aspdBonus
                          + starMilestone.aspdBonus + activeSkin.bonusAspd)
```

Dòng **8349** (Dodge, chặn trên 0.68):

```js
gearDodge = min(0.68, gemDodge + affDodge + talentTotals.dodgeBonus + rune + artifact
                      + starMilestone + globalAll + set)
```

Dòng **8350** (CRIT Rate, chặn trên 0.98):

```js
baseCrit = min(0.98, 0.10 + weapon.critBonus + gemCrit + affCrit + setCrit
                     + runeTotals.critBonus + artifactTotals.critRate
                     + starMilestone.critBonus + globalAll.critRate
                     + activeSkin.bonusCrit + talentTotals.critRate)
```

## 5. Công thức sát thương gây ra — `damageEnemy()`

Dòng **20716**.

```js
// 1. Crit roll
isCrit = !isElemental && Math.random() < (p.critRate + bonusCritFromHero)

// 2. Hệ số anh hùng
heroDmgMult = 1
  + (helix  ? (1 - hp/maxHp) * 0.28 : 0)
  + (dracoola && hp >= maxHp*0.95 ? 0.40 : 0)
  + (hou_yi ? 0.16 : 0)
  + (wukong ? 0.14 : 0)

rawDmg *= heroDmgMult

// 3. Hệ số dấu ấn / debuff
markMult = (artemisMarked       ? 1.25 : 1)
         * (corrosiveVulnerable ? 1.35 : 1)
         * (isBoss && boss_slayer ? 1.25 : 1)
         * (woundedWarriorTimer > 0 ? 1.50 : 1)
         * (perilous_fervor && hp < maxHp*0.5 ? 1.30 : 1)

// 4. Sát thương cuối
finalDmg = Math.round(rawDmg * (isCrit ? 1.85 : 1.0) * markMult)
```

## 6. Công thức sát thương nhận vào — `hurtPlayer()`

Dòng **22084**. Thứ tự áp dụng:

1. `invulnTimer > 0` → bỏ qua hoàn toàn
2. **Dodge**: `min(0.55, hermes_boots*0.15 + gearDodge)` → né hoàn toàn, hồi 0.45s invuln
3. **Guardian rune**: `dmg *= 0.85` (`Math.max(1, round)`)
4. **Wukong**: `dmg *= 0.82`
5. **Sacred Protection**: chặn 1 đòn hoàn toàn, trừ 1 stack
6. **Dark Shield (Atreus)**: hấp thụ tới `darkShieldHp`
7. `p.hp -= dmg` → nếu ≤ 0 thì chạy chuỗi hồi sinh

## 7. Công thức quái và boss

`setupRoom()` dòng **20202**:

```js
scale = Game.chapter.enemyScale * (1 + (roomNum - 1) * 0.13)
```

`enemyScale` theo chương (dòng **1816 / 1827 / 1838**):

| Chương | Phòng | enemyScale |
|---|---|---|
| 1 | 15 | 1.00 |
| 2 | 12 | 1.45 |
| 3 | 10 | 2.00 |

Quái thường (dòng **20242–20264**):

```js
count   = min(8, 3 + floor(roomNum / 2))
baseHp  = plant_turret 210 | skeleton_mage 185 | còn lại 155
hp      = round(baseHp * scale)
atk     = round(28 * scale)
speed   = plant_turret 0 | bat 115 | còn lại 64
```

Boss (dòng **20204–20235**):

```js
maxHp = round(1450 * scale * (demon_king ? 1.35 : 1.0))
atk   = round(45 * scale)
speed = 68
```

Loại boss: phòng 5 → `golem`, phòng 10 → `queen`, còn lại → `demon_king`.

## 8. Hồi máu

| Nguồn | Công thức |
|---|---|
| Nhặt tim (`heart` drop) | `maxHp * (hero==alex ? 0.18 : 0.14)` — dòng 20940 |
| Boss Slayer trước trận boss | hồi 100% `maxHp` — dòng 20170 |
| Healer talent khi chuyển phòng | `maxHp * 0.06 * talents.healer` — dòng 20176 |
| Devil Declined | `maxHp * 0.25` — dòng 24660 |
| Revive rune | `maxHp * 0.50` + `atk * 1.20` — dòng 22166 |

---

## 9. LỖI VÀ ĐIỂM MẤT CÂN BẰNG ĐÃ PHÁT HIỆN

### 🔴 BUG-01 — Không có chỉ số DEF

Không tồn tại bất kỳ biến `def`, `baseDef`, `damageReduction` nào trong
`getComputedStats()`, `Game.player` hay `hurtPlayer()`.

**Hệ quả:** mọi đòn đánh của quái đều gây sát thương nguyên bản (`e.atk`), chỉ giảm
được nhờ né đòn (dodge) và vài hiệu ứng cố định. Không có cách nào tăng khả năng
chịu đòn bằng trang bị.

### 🔴 BUG-02 — `critDmgPct` được tính nhưng KHÔNG BAO GIỜ dùng

`critDmgPct` được cộng ở **5 nơi**:
- `computeAllTalentCardsBonuses()` trả về (dòng 3522)
- `computeAllArtifactsAndSetsBonuses()` trả về (dòng 6608)
- `getGlobalAllHeroStarBonuses()` trả về (dòng 8081)
- Set bonus `specialBonus.critDmgPct` (dòng 5893, 6129)

Nhưng `damageEnemy()` dòng **20744** hardcode:

```js
finalDmg = Math.round(rawDmg * (isCrit ? 1.85 : 1.0) * markMult)
```

**Hệ quả:** mọi nguồn CRIT DMG (+20% từ hero 1★/4★/7★, +16% set shadow, artifact
critDmgPct…) đều **vô tác dụng hoàn toàn**. Đây là lỗi cân bằng nghiêm trọng: người
chơi đầu tư vào CRIT DMG nhận lại 0 giá trị.

### 🔴 BUG-03 — Sát thương quái không scale theo phòng, boss thì có

```js
atk quái thường = round(28 * scale)    // scale đã gồm (1 + (room-1)*0.13)
```

Nhưng `enemyScale` chương 1 = 1.0, nên:

| Phòng | scale | ATK quái | ATK boss |
|---|---|---|---|
| 1 | 1.00 | 28 | — |
| 5 | 1.52 | 43 | 68 |
| 10 | 2.17 | 61 | 98 |
| 14 | 2.69 | 75 | — |

Trong khi đó `baseHp` người chơi chương 1 (trang bị Lv.1) ≈ **75.623** (đo thực tế).
Quái gây 28–75 sát thương/đòn, người chơi có 75k HP → **cần ~1000–2700 đòn để chết**.

**Hệ quả:** đầu game quá dễ, người chơi không bao giờ chết ở chương 1 → mất toàn bộ
độ căng của roguelike.

### 🔴 BUG-04 — Ngược lại, boss quá yếu so với HP người chơi

Boss phòng 10 chương 1: `maxHp = round(1450 * 2.17) = 3147`.
Người chơi ATK 22.718 (tân thủ) → giết boss trong **1 đòn**.
Người chơi có trang bị mạnh hơn thì boss càng vô nghĩa.

### 🟠 BUG-05 — `startNewRun()` không reset nhiều trường trạng thái trận

Chỉ 11 field của `Game` được gán lại. Các field sau **giữ nguyên từ trận trước**:

`particles`, `floatTexts`, `shakeTime`, `shakeMag`, `roomBannerTimer`,
`nyanjaSwordTimer`, `artemisHawkTimer`, `flyingSwordSkillTimer`, `meteorTimer`,
`afterimageTimer`, `portalOpen`, `roomCleared`, `keys`, `joy.*`

`setupRoom(1)` chỉ reset được các array nằm trong danh sách của nó; `particles` và
`floatTexts` **không** nằm trong danh sách đó.

**Hệ quả:** chơi lại ngay sau khi thắng/thua sẽ thấy tàn dư hiệu ứng của trận cũ
float text cũ, portal mở sẵn, banner phòng cũ.

### 🟠 BUG-06 — Không có khái niệm session phó bản

Không tồn tại `dungeonSession`, không có checkpoint, không lưu tiến trình giữa các
phòng. "Retry" và "Reset" hiện là **cùng một hành động** (`btnPlayAgain` → `startNewRun()`),
dù spec yêu cầu phân biệt ba hành động Retry / Reset / Continue.

### 🟠 BUG-07 — Sát thương có thể vượt Max HP khi hồi máu, nhưng HP có thể âm

`p.hp -= dmg` không chặn dưới, sau đó mới kiểm tra `<= 0`. Bản thân `p.hp` có thể
là số âm lớn khi thoát ra. `updateInGameHUD()` hiển thị trực tiếp `p.hp` ở vài chỗ.

### 🟠 BUG-08 — `baseCrit` có thể vượt 1.0 sau khi cộng `bonusCritFromHero`

```js
isCrit = Math.random() < (p.critRate + bonusCritFromHero)
```

`p.critRate` chặn trên 0.98, nhưng `bonusCritFromHero` cộng tới +1.0 (Alex guaranteed
crit) và +0.18 (Otta) → tổng có thể ≈ 2.16. Không sai về hành vi (luôn crit) nhưng
là dấu hiệu công thức không được chuẩn hóa.

### 🟡 NOTE-01 — Pet không đóng góp chỉ số

`PETS` chỉ có `fireRate` và `dmgRatio`. Pet bắn đạn với `dmg = p.atk * dmgRatio`
(xem phần auto-fire), không cộng ATK/HP cho người chơi. Đúng thiết kế hiện tại nhưng
spec Phần 6.3 yêu cầu audit rõ.

### 🟡 NOTE-02 — `powerScore` dùng để xếp hạng nhưng thiếu DEF

```js
powerScore = baseAtk*6.2 + baseHp*1.15 + baseAspd*180 + baseCrit*600
           + gearDodge*420 + heroStar*1650 + (skinIdx+1)*900
```

Không có DEF vì DEF chưa tồn tại. Sau khi thêm DEF phải cập nhật công thức này.

---

## 10. Cơ chế reset phó bản hiện tại

```
btnPlayAgain  ──►  startNewRun()
btnReturnLobby ─►  (về sảnh, giữ SaveState)
```

`startNewRun()` làm đúng phần lớn:
- Tạo lại `Game.player` từ `getComputedStats()` → HP/ATK/ASPD/CRIT mới
- `Game.room = 1`, `Game.kills = 0`, `Game.runGold = 0`
- `setupRoom(1)` → xoá enemies, obstacles, bullets, drops, shockwaves…
- Huỷ `animId` cũ và tạo `requestAnimationFrame` mới → không chạy song song

`startNewRun()` **không** làm:
- Reset `particles`, `floatTexts`, các timer rời (BUG-05)
- Chặn gọi chồng: nếu bấm "Chơi Lại" hai lần liên tiếp, hai `startNewRun()` chạy
  nối tiếp tạo hai vòng lặp `requestAnimationFrame` → có thể có hai session
  (BUG-06)
- Phân biệt Retry/Reset/Continue

`SaveState` hoàn toàn không bị đụng tới khi reset → dữ liệu nhân vật an toàn. ✅

---

## 11. Kết luận và hướng sửa

| Ưu tiên | Việc | Ảnh hưởng |
|---|---|---|
| P0 | Đưa `critDmgPct` vào công thức crit (BUG-02) | Sửa toàn bộ đầu tư CRIT DMG bị vô hiệu |
| P0 | Thêm DEF + giảm sát thương (BUG-01) | Mở ra hướng build phòng thủ |
| P0 | Cân bằng lại scale quái/boss theo HP người chơi thực tế (BUG-03/04) | Độ khó có ý nghĩa |
| P1 | Reset đầy đủ state trận trong `startNewRun` (BUG-05) | Retry sạch |
| P1 | Tách session + chặn double-run (BUG-06) | Không chạy song song |
| P2 | Chặn HP âm, chuẩn hoá crit cap (BUG-07/08) | An toàn số học |

Chi tiết công thức sau chuẩn hoá: xem `docs/COMBAT_FORMULAS.md`.
Chi tiết cơ chế reset: xem `docs/DUNGEON_RESET_SPEC.md`.
