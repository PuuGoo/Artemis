# COMBAT FORMULAS — ARTEMIS (sau chuẩn hoá)

> Tài liệu này là **hợp đồng công thức** của game. Mọi thay đổi cân bằng phải sửa
> ở đây trước, rồi mới sửa code — để không sinh ra công thức thứ hai song song.
>
> Đối chiếu lịch sử: `docs/COMBAT_BALANCE_AUDIT.md`.

---

## 1. Điểm vào duy nhất

```
getComputedStats()  →  Game.player  →  damageEnemy() / hurtPlayer()
```

`getComputedStats()` là **nơi duy nhất** tổng hợp chỉ số. Không có chỗ nào khác được
phép cộng ATK/HP/DEF.

## 2. ATK

```
baseAtk = round(
  ( 78
    + gearAtk + gemAtk + affAtkFlat + runeAtk + heroStarAtk
    + (gearLevel - 1) * 12 + talentTotals.flatAtk )
  × weapon.atkMult
  × ( 1 + setAtkRate + affAtkPct + globalAll.atkPct
      + artifactTotals.totalAtkPct + starMilestone.atkMult × 0.25 )
)
```

## 3. Max HP

```
baseHp = round(
  ( 420 + gearHp + gemHp + affHpFlat + runeHp + heroStarHp
    + (gearLevel - 1) × 45 + talentTotals.flatHp )
  × ( 1 + setHpRate + affHpPct + globalAll.hpPct
      + artifactTotals.totalHpPct + starMilestone.hpMult × 0.25 )
)
```

**Bất biến:** `0 ≤ hp ≤ maxHp` luôn đúng. `hurtPlayer()` chặn `hp < 0`.
Mọi nguồn hồi máu đều `min(maxHp, hp + amount)`.

## 4. Tốc độ đánh

```
baseAspd = weapon.aspd × ( 1 + talent.aspdBonus + epicCount×0.03 + setAspdRate
                             + affAspd + rune.aspdBonus + artifact.aspdBonus
                             + starMilestone.aspdBonus + skin.bonusAspd )
```

## 5. CRIT Rate

```
baseCrit = min(0.98,
     0.10 + weapon.critBonus + gemCrit + affCrit + setCrit
   + rune.critBonus + artifact.critRate + starMilestone.critBonus
   + globalAll.critRate + skin.bonusCrit + talent.critRate )
```

Roll crit trong `damageEnemy()`:

```
isCrit = !isElemental && Math.random() < (p.critRate + bonusCritFromHero)
```

`bonusCritFromHero` cộng thêm (Otta +0.18 khi quái >60% HP, Alex +1.0 đòn bảo đảm).
Giá trị này **cố ý** có thể vượt 1.0 — nghĩa là chắc chắn crit, không phải lỗi.

## 6. CRIT DMG — ĐÃ SỬA (trước đây vô hiệu)

```
critDmgBonus = talent.critDmgPct
             + artifact.critDmgPct
             + globalAll.critDmgPct      // hero 1★/4★/7★ global
             + Σ setBonuses[].critDmgPct
             + skin.bonusCritDmg

critDmgMult = 1.85 + critDmgBonus
```

`1.85` là hệ số crit cũ, giữ làm baseline để **không làm thay đổi sức mạnh hiện có**.
Trước đây `damageEnemy()` hardcode `1.85` nên toàn bộ `critDmgPct` bị bỏ phí.

## 7. DEF và giảm sát thương — MỚI

```
defFlat = round(
    heroStar × 2
  + (gearLevel - 1) × 3
  + talent.flatDef
  + rune.defFlat
  + artifact.defFlat
  + (gemHp + affHpFlat) × 0.02
)

defK        = 400 + 120 × chapter.rooms
dmgReduction = min(0.75, defFlat / (defFlat + defK))
```

**Vì sao dùng đường cong bão hoà:** giảm tuyến tính sẽ đạt 100% miễn nhiễm ở một
ngưỡng DEF nào đó, khiến nửa sau game không còn độ khó. Đường cong `DEF/(DEF+K)`
tiệm cận nhưng không bao giờ chạm 1, và `K` tăng theo số phòng của chương nên
DEF cần thiết để giảm 50% cũng tăng dần.

| defFlat | Ch.1 (15 phòng, K=2200) | Ch.3 (10 phòng, K=1600) |
|---|---|---|
| 100 | 4.3% | 5.9% |
| 500 | 18.5% | 23.8% |
| 1000 | 31.3% | 38.5% |
| 3000 | 57.7% | 65.2% |
| ≥ 6600 | 75.0% (chặn) | 75.0% (chặn) |

## 8. Sát thương gây ra — `damageEnemy()`

```
rawDmg ×= heroDmgMult
  heroDmgMult = 1
    + (helix      ? (1 - hp/maxHp) × 0.28 : 0)
    + (dracoola && hp ≥ maxHp×0.95 ? 0.40 : 0)
    + (hou_yi  ? 0.16 : 0)
    + (wukong  ? 0.14 : 0)

markMult = (artemisMarked        ? 1.25 : 1)
         × (corrosiveVulnerable  ? 1.35 : 1)
         × (isBoss && boss_slayer ? 1.25 : 1)
         × (woundedWarriorTimer > 0 ? 1.50 : 1)
         × (perilous_fervor && hp < maxHp×0.5 ? 1.30 : 1)

finalDmg = round( rawDmg × (isCrit ? critDmgMult : 1.0) × markMult )
```

## 9. Sát thương nhận vào — `hurtPlayer()`

Thứ tự áp dụng **cố định**:

```
1. invulnTimer > 0                        → bỏ qua
2. dodge = min(0.55, hermes×0.15 + gearDodge)
     Math.random() < dodge                → né, hồi 0.45s invuln
3. DEF:  dmg = max(1, round(dmg × (1 - dmgReduction)))     ← MỚI
4. Guardian rune:   dmg = max(1, round(dmg × 0.85))
5. Wukong:          dmg = max(1, round(dmg × 0.82))
6. Sacred Protection stack                → chặn hoàn toàn
7. Dark Shield (Atreus)                   → hấp thụ tới darkShieldHp
8. hp = hp - dmg;  if (hp < 0) hp = 0     ← MỚI chặn âm
9. hp ≤ 0                                → chuỗi hồi sinh → finishRun(false)
```

Giảm trừ nhân dồn tuyến tính: `0.75 × 0.85 × 0.82 ≈ 52%` sát thương gốc trong điều
kiện tệ nhất (không bao giờ về 0).

## 10. Quái và boss — ĐÃ CÂN BẰNG LẠI

Dùng **hai thước đo khác nhau**, mỗi cái đúng chỗ:

| Thành phần | Công thức | Vì sao |
|---|---|---|
| HP quái | `playerAtk × atkMul × scale` | giữ **TTK** ổn định ở mọi mức trang bị |
| ATK quái | `playerMaxHp × 0.055 × min(2.5, scale) / max(2, count×0.6)` | giữ **số đòn chịu được** ổn định |
| HP boss | `playerAtk × 30 × scale × (demon_king ? 1.35 : 1)` | trận boss luôn dài tương đương |
| ATK boss | `playerMaxHp × 0.075 × min(2.5, scale)` | áp lực buộc né đòn |

`atkMul` theo loại quái: `plant_turret 3.2`, `skeleton_mage 2.9`, còn lại `2.6`.

```
scale = chapter.enemyScale × (1 + (roomNum - 1) × 0.13)

chapter.enemyScale:  Ch.1 = 1.00 (15 phòng)
                     Ch.2 = 1.45 (12 phòng)
                     Ch.3 = 2.00 (10 phòng)
```

`min(2.5, scale)` chặn ATK phình quá mức ở phòng cuối chương 3
(`2.00 × 2.56 = 5.12` → chặn còn `2.5`).

## 11. Chỉ số đánh giá độ khó (dùng để cân bằng)

Đo trên tài khoản tân thủ thật (ATK 22.718, MaxHP 75.623, ASPD 2.15, CRIT 36%, CritDMG 2.09):

```
DPS = atk × aspd × (1 + crit × (critDmg - 1))
    = 22718 × 2.15 × 1.3924
    ≈ 68.010 /s

TTK quái phòng 1   ≈ 0.87s      (1-2 đòn)
TTK quái phòng 14  ≈ 2.3s
TTB boss phòng 5   ≈ 6.5s   (HP = atk×30×1.52)
TTB boss phòng 10  ≈ 19.9s  (HP = atk×30×2.17)
TTB boss phòng 15  ≈ 34s    (HP = atk×30×2.56×1.35)
Số đòn boss giết người chơi: phòng 5 ≈ 8.7 | phòng 10 ≈ 6.1 | phòng 15 ≈ 5.2
Số đòn quái thường giết người chơi (8 quái): ≈ 26
```

**Tính bất biến:** nhân ATK và MaxHP cùng một hệ số thì TTK/TTB và số đòn chịu
được **không đổi**. Đây là tính chất được test tự động kiểm chứng — nghĩa là
người chơi mặc đồ mạnh hơn không làm game dễ đi, họ chỉ tiến được sang chương cao
hơn (nơi `enemyScale` lớn hơn).

## 12. Hồi máu

| Nguồn | Công thức |
|---|---|
| Nhặt tim | `maxHp × (hero==alex ? 0.18 : 0.14)` |
| Boss Slayer trước trận boss | 100% maxHp |
| Healer talent chuyển phòng | `maxHp × 0.06 × talents.healer` |
| Từ chối Khế Ước Ác Quỷ | `+maxHp × 0.25` |
| Revive rune | `maxHp × 0.50` + `atk × 1.20` |
| Revive skill | 100% maxHp |

## 13. Bất biến phải luôn đúng

1. `0 ≤ hp ≤ maxHp`
2. `0 ≤ dmgReduction ≤ 0.75`
3. `0 ≤ critRate ≤ 0.98` (chưa tính bonusCritFromHero)
4. `0 ≤ gearDodge ≤ 0.68`
5. Không có `NaN` hoặc `Infinity` trong `hp`, `atk`, `x`, `y`, `speed`
6. `finalDmg ≥ 0`, `dmg ≥ 1` khi có sát thương
7. Mọi hồi máu đều bị chặn bởi `maxHp`
