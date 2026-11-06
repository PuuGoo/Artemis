# SOURCE AUDIT — Artemis → Unity Migration

> **Trạng thái:** Phase 0 hoàn tất (kiểm chứng bằng code thật, không suy đoán).
> **Commit khảo sát:** `0e00f4a` (merge PR #9, Chapter 5 Eclipse Kingdom).
> **Ngày khảo sát:** 2026-11-06.
>
> Mọi con số trong tài liệu này lấy từ một trong hai nguồn, và ghi rõ nguồn:
> - **【SRC】** — đọc trực tiếp `public/index.html` / `lib/` / `api/`.
> - **【ORACLE】** — chạy chính code production trong sandbox headless
>   (`tools/unity-parity/oracle.mjs`), không chép lại công thức.

---

## 0. Tóm tắt điều hành

Artemis là một game roguelike bắn cung (Archero-like) chạy trên **một file
`public/index.html` 32.668 dòng** (toàn bộ gameplay + UI + VFX) cộng một backend
Vercel serverless (Node.js + MongoDB Atlas). Không có bundler, không có module
gameplay tách rời: mọi logic sống trong `<script>` inline thứ 2 (dòng 3916).

Điều đó quyết định chiến lược migration:

1. **Không thể "port" theo kiểu dịch từng file** — phải rút domain logic ra thành
   một lớp C# thuần (pure C#), và dùng **chính code JS đang chạy** làm oracle để
   chứng minh parity bằng số, không bằng cảm nhận.
2. **Backend giữ nguyên 100%.** Unity chỉ là một client thứ hai của
   `/api/auth/*` + `/api/save`. Không có database thứ hai, không có đường tắt
   kinh tế nào được nới lỏng.
3. **Visual nâng cấp, hành vi không đổi.** Mọi hằng số cân bằng (78/420,
   1.85 crit, 400+120×rooms DEF, 1.4→2.4 hits/quái, 24/30/40 hits boss) phải
   giống tuyệt đối.

### Quy mô đã xác nhận

| Hạng mục | Số lượng | Nguồn |
|---|---|---|
| Dòng `public/index.html` | 32.668 | 【SRC】`wc -l` |
| API debug/test export (`window.Archero2FusionAPI`) | 157 khoá | 【ORACLE】 |
| Chương (chapter) | 5 | 【ORACLE】 |
| Chế độ chơi (game mode) | 5 (`campaign`, `endless`, `tower`, `bossrush`, `practice`) | 【ORACLE】 |
| Anh hùng | 18 | 【SRC】`const HEROES` |
| Vũ khí (archetype) | 3 (`bow`, `staff`, `claw`) | 【SRC】`const WEAPONS` |
| Pet | 3 | 【SRC】`const PETS` |
| Mẫu trang bị (gear template) | 42 | 【ORACLE】 |
| Phẩm chất trang bị | 7 (normal→chaotic) | 【ORACLE】 |
| Công thức ghép (fusion recipe) | 15 | 【ORACLE】 |
| Kỹ năng roguelike | 72 (11 legendary + 25 epic + 22 rare + 14 fine) | 【SRC】 |
| Thẻ tài năng (talent card) | 32 | 【SRC】 |
| Cổ ngữ (rune) | 46 (13 etched + 7 blessing + 13 enhancement + 13 ability) | 【SRC】 |
| Thánh vật (artifact) | 46 (18 mythic + 16 legendary + 7 epic + 5 rare) | 【SRC】 |
| Bộ thánh vật (artifact set) | 13 | 【SRC】`ARTIFACT_SETS_DATA` |
| Ngọc (gem) | 9 | 【SRC】`GEM_META` |
| Quái (bestiary entry) | 16 | 【ORACLE】 |
| Thành tựu | 25 | 【ORACLE】 |
| Bước Hành Trình Tân Thủ | 8 (`N01`…`N08`) | 【ORACLE】 |
| Nghề Mùa Giải | 5 (`blade`,`ranger`,`guardian`,`mage`,`merchant`) | 【ORACLE】 |
| Trùm Mùa Giải | 3 (`ironhide`,`reflector`,`regenerator`) | 【ORACLE】 |
| Khoá save phía client | 62 | 【ORACLE】`SaveState` |
| Field được server whitelist | 73 | 【SRC】`lib/saveSchema.js` |
| Test hiện có | 36 file `tests/*.test.mjs` | 【SRC】 |

### Chỉ số tài khoản mới (chuẩn parity — 【ORACLE】)

```
hero=alex  weapon=bow  pet=spirit_sword
ATK=152   HP=775   ASPD=1.94   CRIT=0.22   CritDMG=1.85
DEF=0     DR=0     Dodge=0     GoldBonus=0  PowerScore=3215
```

Đây là **hợp đồng số #1**: bất kỳ bản Unity nào cho tài khoản trắng phải ra đúng
bộ số này. Nếu lệch, có lỗi ở công thức — không phải "khác biệt thiết kế".

---

## 1. Bản đồ source

### 1.1 Frontend — `public/index.html`

Cấu trúc thực tế (số dòng 【SRC】):

| Vùng | Dòng | Nội dung |
|---|---|---|
| `<style>` | 1–2465 | Toàn bộ CSS Tailwind-in-JS + VFX |
| `<script>` #1 | 2466–3915 | Renderer canvas 2.5D: biome, quái, boss, hero chibi |
| `<script>` #2 | 3916–32421 | **Game engine + dữ liệu + UI** (đây là phần phải port) |

Các khối trong `<script>` #2:

```
3920   SoundFX (WebAudio tổng hợp, không file âm thanh)
3978   GAME_MODES, CHAPTERS, HEROES, WEAPONS, PETS, TALENT_CARDS_DATA
4250   BESTIARY (16 loại quái: lore + behavior + chỉ số hiển thị)
4452   HEROES (18 anh hùng) + HERO_STAR_MILESTONES (0★→8★)
5637   TALENT_CARDS_DATA (32 thẻ, set 1 & set 2)
6184   SKILLS DATABASE (72 kỹ năng, 4 độ hiếm, 3 provider)
6955   GEAR_SLOTS_META (6 ô), GEAR_QUALITIES (7), GEAR_TEMPLATES (42)
6966   FUSION_RECIPES (15) — cây ghép blacksmith
7712   RUNES (46, 4 loại, 13 ô, 11 tier)
8451   ARTIFACTS (46) + ARTIFACT_SETS_DATA (13 bộ, 0★→15★)
9437   SaveState (persistent state, 62 khoá)
10011  Equipment V4: computeSingleItemStat, GEAR_SET_META (6 bộ trang bị)
10399  Reforge / enchant
10603  Loadout manager
10733  Hero star / resonance / skin helpers
11169  ★ getComputedStats() — nguồn duy nhất của ATK/HP/ASPD/CRIT/DEF
13417  UI rendering & bindings (lobby, gear, hero, shop…)
13956  Guild
14075  Garden (Vườn Thủ Hộ)
14238  Season (Mùa Giải)
14776  Plinko
17897  Currency & items
19429  Gear inspect/equip/level-up modal
19667  Blacksmith modal + quick merge
24854  Achievements (25)
25031  Beginner Journey (8 bước)
26200  Hybrid damage & ASPD formula calculator
26421  ★ ACTIVE GAME ENGINE (canvas roguelike arena)
26532  DungeonSession
26560  Checkpoint (Continue)
26902  ★ setupRoom() — sinh quái/boss theo phòng (cân bằng độ khó)
27200  Roguelike skill modal (Valkyrie/Angel/Devil)
27410  ★ Combat & projectile spawning (createPlayerBullet, damageEnemy…)
28201  ★ updateGame(dt) — main loop
29208  ★ hurtPlayer() — pipeline nhận sát thương
29360  Render arena (2.5D)
31077  Adaptive performance
31236  ★ finishRun() — thưởng, thành tựu, kết thúc phiên
31369  Input listeners (keyboard + pointer joystick)
32319  window.Archero2FusionAPI (157 khoá — API test/debug)
```

### 1.2 Backend — Vercel serverless

| Endpoint | File | Hành vi |
|---|---|---|
| `POST /api/auth/register` | `api/auth/register.js` | bcrypt(10), rate-limit 10/10min theo IP, 409 nếu trùng |
| `POST /api/auth/login` | `api/auth/login.js` | rate-limit 30/10min theo IP + 15/10min theo user, so sánh hash giả khi không tìm thấy (chống dò user), Set-Cookie HttpOnly |
| `POST /api/auth/logout` | `api/auth/logout.js` | xoá cookie |
| `GET /api/auth/me` | `api/auth/me.js` | `{authenticated, player, hasSave, saveUpdatedAt}` |
| `GET /api/save` | `api/save.js` | `{hasSave, data, revision, updatedAt}` |
| `PUT /api/save` | `api/save.js` | sanitize → economy check → season check → upsert, revision+1 |
| `GET /api/health` | `api/health.js` | ping MongoDB, 503 nếu down |
| `GET /api/admin/*` | `api/admin/` | dashboard quản trị (players, stats) |

Phiên: JWT HS256 (`jose`), 30 ngày, cookie `artemis_session`, `HttpOnly; SameSite=Lax; Secure` (production). **Secret chỉ ở server.** 【SRC】`lib/auth.js`

### 1.3 Thư viện thuần (dùng lại được, không đụng tới khi migrate)

| File | Vai trò | Test |
|---|---|---|
| `lib/saveSchema.js` | whitelist + clamp toàn bộ save (73 field) | `tests/save-schema.test.mjs` |
| `lib/economy.js` | chặn leo thang vàng/gems + kiểm tra Mùa Giải | `tests/economy.test.mjs`, `tests/season-economy.test.mjs` |
| `lib/auth.js` | bcrypt + JWT + validation | `tests/integration.test.mjs` |
| `lib/http.js` | đọc body giới hạn, rate-limit, clientIp | `tests/integration.test.mjs` |
| `lib/mongo.js` | Mongo client (cache theo lambda) | — |

Ba file đầu là **hợp đồng bảo mật**. Unity không được nới lỏng bất kỳ điều nào
trong đó; nếu Unity cần một endpoint mới (ví dụ refresh token), nó phải được
thêm **phía server** và đi qua cùng lớp kiểm tra.

---

## 2. Hệ thống gameplay — đặc tả từng hệ thống

Mỗi mục theo mẫu: **Nguồn** · **Phụ thuộc** · **Hành vi hiện tại** · **Cấu trúc
dữ liệu** · **Field save** · **Test hiện có** · **Tương đương Unity** · **Độ phức
tạp** · **Rủi ro tương thích** · **Tiêu chí nghiệm thu**.

### 2.1 Di chuyển người chơi

- **Nguồn** 【SRC】`updateGame()` dòng 28201–28260.
- **Phụ thuộc** `Game.player.speed`, `Game.wallPad`, `Game.obstacles`.
- **Hành vi**: 8 hướng (WASD / mũi tên / joystick ảo). Vector được chuẩn hoá
  (`len = hypot`) nên đi chéo **không nhanh hơn**. Tốc độ `225 × (hero.bonusSpd || 1)`
  — hệ số `|| 1` là bản vá cho bug `225 × undefined = NaN` từng làm nhân vật biến mất.
  Kẹp trong `[wallPad + r, width - wallPad - r]`; va chạm vật cản xử lý **theo từng
  trục** (trượt dọc tường, không dính).
- **Cấu trúc**: `player.{x,y,r,speed,facingAngle,moving}`.
- **Save**: không (chỉ là trạng thái phiên).
- **Test**: `tests/combat.test.mjs` khoá `Number(stats.hero && stats.hero.bonusSpd) || 1`.
- **Unity**: `PlayerController` trên `Rigidbody2D` (Kinematic) + `MoveTowards`, cùng
  chuẩn hoá vector và cùng thứ tự giải va chạm theo trục.
- **Độ phức tạp**: Thấp.
- **Rủi ro**: Dùng `Rigidbody2D` động sẽ tạo quán tính → cảm giác khác. Phải
  kinematic + tự giải va chạm, hoặc chấp nhận sai lệch và ghi vào tài liệu.
- **Nghiệm thu**: từ một điểm bất kỳ, đi chéo 1 giây phải ra đúng
  `speed × 1.0` px (không phải `speed × 1.414`).

### 2.2 Cơ chế bắn "dừng để bắn" (core Archero)

- **Nguồn** 【SRC】`updateGame()` nhánh `else` dòng 28312–28330.
- **Hành vi**: khi **đứng yên** và `attackCooldown <= 0` và còn quái →
  `firePlayerVolley()`, rồi `attackCooldown = 1 / (aspd × lokiBoost × alexBoost × helixBoost)`.
  Khi **di chuyển**, chỉ bắn nếu có Thor / `weapon_enchantment` (bắn cả lúc chạy).
- **Hệ số**: `lokiBoost 1.30` (Loki Focus), `alexBoost 1.15` (Alex sau crit),
  `helixBoost 1.25` (Helix dưới 50% HP).
- **Unity**: `CombatController` với state machine `Idle→Fire`, cùng công thức
  cooldown, cùng điều kiện "còn quái".
- **Độ phức tạp**: Thấp–Trung bình.
- **Rủi ro**: Nếu dùng `Update()` với `Time.deltaTime` khác `dt` của web (web dùng
  giây thực, có clamp), nhịp bắn sẽ lệch ở máy yếu. Phải clamp `dt` giống web.
- **Nghiệm thu**: ASPD 1.94 → đúng 1.94 phát/giây ±1% trong 10 giây đo.

### 2.3 Sinh đạn của người chơi

- **Nguồn** 【SRC】`createPlayerBullet()` dòng 27601.
- **Hành vi**:
  ```
  spd = weapon.projSpeed × 60 × (tracking_eye ? 0.78 : 1)
  dmg = atk × dmgScale × mainWepDmgMult × dmgCatMult
        × (charged_arrow ? 2.0 : 1) × (lightwing_arrow 45% ? 2.0 : 1)
  r   = charged ? 12 : (claw ? 9 : 6.5)
  pierce = weapon.pierceDefault || pierce_skill || charged
  homing = tracking_eye ? 0.11 : weapon.homing
  ```
- **Vũ khí** 【SRC】: `bow` (atkMult 1.0, aspd 1.9, projSpeed 10.5, crit +0.10),
  `staff` (1.18 / 1.45 / 7.4, crit +0.05, homing 0.075),
  `claw` (1.32 / 1.55 / 8.8, crit +0.08, pierce mặc định).
- **Unity**: `WeaponController` + `ProjectileController` + pool.
- **Độ phức tạp**: Trung bình (homing/bounce/pierce/ricochet có tương tác).
- **Rủi ro**: Dùng `Physics2D` với `Collider2D` sẽ tự động "pierce" khác với
  `hitSet` của web (web chống trúng lại một quái bằng `Set`). Phải giữ `hitSet`
  theo `instanceID` quái.
- **Nghiệm thu**: 3 vũ khí × có/không kỹ năng → `dmg`, `spd`, `r`, `pierce`
  khớp oracle từng field.

### 2.4 Công thức chỉ số — `getComputedStats()`

Đây là **hệ thống quan trọng nhất** và là nguồn duy nhất của mọi chỉ số.

- **Nguồn** 【SRC】dòng 11170–11290 【ORACLE】`api.getComputedStats()`.
- **Hợp đồng công thức** đã có sẵn ở `docs/COMBAT_FORMULAS.md` (file chuẩn của
  dự án). Unity phải theo **đúng** file đó, không theo bản tóm tắt nào khác.

Thứ tự cộng (không được đổi — phép nhân không giao hoán với làm tròn):

```
ATK = round( (78 + gearAtk + gemAtk + affAtkFlat + runeAtk + heroStarAtk
              + (gearLevel-1)*12 + talent.flatAtk)
             × weapon.atkMult
             × (1 + setAtkRate + affAtkPct + globalAll.atkPct
                  + artifact.totalAtkPct + starMilestone.atkMult*0.25 + careerAtkPct)
             × (1 - sacrificePct) )          ← powerexchange (Mùa Giải)

HP  = round( (420 + gearHp + gemHp + affHpFlat + runeHp + heroStarHp
              + (gearLevel-1)*45 + talent.flatHp)
             × (1 + setHpRate + affHpPct + globalAll.hpPct
                  + artifact.totalHpPct + starMilestone.hpMult*0.25 + careerHpPct)
             × (1 - sacrificePct) )

ASPD = +( weapon.aspd × (1 + talent.aspdBonus + epicCount*0.03 + setAspdRate
              + affAspd + rune.aspdBonus + artifact.aspdBonus
              + starMilestone.aspdBonus + skin.bonusAspd + careerAspdPct) ).toFixed(2)

CRIT = min(0.98, +(0.10 + weapon.critBonus + gemCrit + affCrit + setCrit
              + rune.critBonus + artifact.critRate + starMilestone.critBonus
              + globalAll.critRate + skin.bonusCrit + talent.critRate
              + careerCritFlat).toFixed(2))

CritDMG = +(1.85 + talent.critDmgPct + artifact.critDmgPct + globalAll.critDmgPct
              + Σ set.critDmgPct + skin.bonusCritDmg + careerCritDmgPct).toFixed(3)

DEF = round( heroStar*2 + (gearLevel-1)*3 + talent.flatDef + rune.defFlat
              + artifact.defFlat + (gemHp+affHpFlat)*0.02 + careerDefFlat )

K   = 400 + 120 × chapter.rooms        ← phụ thuộc CHƯƠNG, không phải phiên
DR  = min(0.75, DEF/(DEF+K))
```

**Chi tiết dễ sai khi port:**

1. `heroStarAtk = round(hero.bonusAtk × (1 + starMilestone.atkMult)) + starMilestone.flatAtk + skin.bonusAtk + skinColBonus.atk`
   — **hai** lần làm tròn khác nhau trong cùng một biểu thức.
2. `baseAspd`/`baseCrit`/`critDmgMult` đều bị `.toFixed(n)` → **chuỗi → số**.
   `toFixed` là half-away-from-zero trên biểu diễn nhị phân, khác `Math.Round`
   của C# (banker's rounding) — phải dùng `MidpointRounding.AwayFromZero` và
   cẩn thận với các giá trị `.xx5` trong binary.
3. `defK` dùng `Game.chapter.rooms`, và khi chưa vào trận thì mặc định **15**.
   Nghĩa là DR trong sảnh khác DR trong trận chương 3.
4. `_sacMul = 1 - sacrificePct` nhân **sau** mọi thứ, kể cả sau làm tròn của
   ngoặc trong? Không — nó nằm **trong** `Math.round()`. Đọc kỹ: `Math.round(A * B * _sacMul)`.
5. `epicCount` đếm trang bị có `quality.order >= 4`, mỗi món +3% ASPD.

- **Cấu trúc**: `{ hero, heroStar, starMilestone, activeSkin, globalAll, resonance,
  weapon, pet, baseAtk, baseHp, baseAspd, baseCrit, gearDodge, goldBonus,
  powerScore, gearAtk, gearHp, critDmgMult, critDmgBonus, defFlat, dmgReduction }`.
- **Save**: đọc từ 20+ field (`equippedGear`, `gearBag`, `talents`, `runes`,
  `heroStars`, `artifactStars`, `unlockedSkins`, `season`, …).
- **Test**: `tests/stat-curve.test.mjs` (khoá fallback), `tests/no-hardcoded-stats.test.mjs`.
- **Unity**: `PlayerStatsCalculator` (pure C#, không `MonoBehaviour`) + `PlayerStats`
  (component giữ kết quả).
- **Độ phức tạp**: **Cao**. Đây là nơi dễ sai nhất của toàn bộ migration.
- **Rủi ro**: Làm tròn khác 1 đơn vị ATK sẽ lan ra damage → TTK → "game khó hơn".
  Bắt buộc test parity số học trên ≥ 200 cấu hình trang bị.
- **Nghiệm thu**: với 200 bộ save thật, mọi field số của C# khớp JS **tuyệt đối**
  (sai số 0 cho số nguyên, ≤ 5e-4 cho số thực đã `toFixed`).

### 2.5 Sát thương gây ra — `damageEnemy()`

- **Nguồn** 【SRC】dòng 27663–27890.
- **Thứ tự tuyệt đối**:
  ```
  1. nếu e.hp <= 0 → bỏ qua
  2. bonusCritFromHero = (otta && e.hp/e.maxHp > 0.6 ? 0.18 : 0)
                        + (alexNextGuaranteedCrit ? 1.0 : 0)
  3. isCrit = !isElemental && random() < (critRate + bonusCritFromHero)
  4. heroDmgMult = 1
        + (helix  ? (1 - hp/maxHp) * 0.28 : 0)
        + (dracoola && hp >= maxHp*0.95 ? 0.40 : 0)
        + (hou_yi ? 0.16 : 0)
        + (wukong ? 0.14 : 0)
  5. rawDmg *= heroDmgMult
  6. markMult = (artemisMarked ? 1.25 : 1)
              × (corrosiveVulnerable ? 1.35 : 1)
              × (isBoss && boss_slayer ? 1.25 : 1)
              × (woundedWarriorTimer > 0 ? 1.50 : 1)
              × (perilous_fervor && hp < maxHp*0.5 ? 1.30 : 1)
  7. finalDmg = round(rawDmg × (isCrit ? critDmgMult : 1.0) × markMult)
  ```
  Sau đó mới tới chuỗi passive (Oracle combo, Cleo, Rolla, Dracoola, Otta, Phynx…)
  — các passive này **cộng thêm** sát thương lên `e.hp` riêng, không nhân vào
  `finalDmg`. Đây là điểm rất dễ port sai.
- **Unity**: `DamageCalculator.Calculate(request) → DamageResult` (pure), và
  `CombatEventSystem` phát sự kiện `OnHit` cho passive.
- **Độ phức tạp**: Cao (30+ passive tương tác).
- **Rủi ro**: `random()` là nguồn **không tất định**. Test parity phải inject RNG
  (`IRandomSource`) để cả hai bên dùng cùng dãy số.
- **Nghiệm thu**: cùng seed + cùng input → `finalDmg` khớp từng đơn vị, với
  cả crit và không crit.

### 2.6 Sát thương nhận vào — `hurtPlayer()`

- **Nguồn** 【SRC】dòng 29208–29360.
- **Thứ tự cố định** (đã ghi trong `docs/COMBAT_FORMULAS.md` §9):
  ```
  1. invulnTimer > 0                      → bỏ qua
  2. dodge = min(0.55, hermes_boots*0.15 + gearDodge); random < dodge → né, invuln 0.45s
  3. dmg = max(1, round(dmg × (1 - dmgReduction)))
  4. guardian rune   → dmg = max(1, round(dmg × 0.85))
  5. wukong          → dmg = max(1, round(dmg × 0.82))
  6. sacredShieldStacks > 0 → chặn hoàn toàn, invuln 0.85s, return
  7. darkShieldHp    → hấp thụ, dmg còn lại mới đi tiếp
  8. hp -= dmg; if (hp < 0) hp = 0
  9. hp <= 0 → chuỗi hồi sinh (valkyrie → revive → mymu) → finishRun(false)
  ```
- **Unity**: `PlayerDamageReceiver` gọi cùng pipeline, cùng thứ tự, cùng
  `max(1, …)` sau **mỗi** bước giảm.
- **Độ phức tạp**: Trung bình–Cao.
- **Rủi ro**: Gộp các bước giảm thành một phép nhân sẽ cho kết quả **khác** vì
  web làm tròn và `max(1, …)` ở từng bước. Ví dụ `dmg=7`, DR 50%, guardian 15%:
  web → `round(7×0.5)=4` → `round(4×0.85)=3`; gộp → `round(7×0.425)=3` (trùng ở
  đây nhưng lệch ở nhiều bộ khác). Phải giữ từng bước.
- **Nghiệm thu**: 1000 tổ hợp (dmg × DR × rune × hero) khớp oracle tuyệt đối.

### 2.7 Quái — sinh, chỉ số, AI

- **Nguồn** 【SRC】`setupRoom()` 27030–27200; bestiary 4250.
- **Số lượng**: `count = min(8, 3 + floor(room/2))` → phòng 1: 3, phòng 10+: 8.
- **Loại theo chương**:
  - Ch.1–3: `slime, goblin, skeleton_mage, plant_turret, bat`
  - Ch.4: `dragon_whelp, cloud_wisp, sky_sentinel`
  - Ch.5: `rift_stalker, eclipse_oracle, obsidian_brute`
- **Chọn loại**: `types[(roomNum + i) % types.length]` — **tất định**, không random.
- **HP**: `max(1, round(playerAtk × atkMul × scale))`
  ```
  scale    = chapter.enemyScale × (1 + (room-1)*0.13)
  depth    = min(1, (room-1)/max(1, maxRooms-1))
  baseHits = 1.4 + depth*1.0            ← 1.4 → 2.4 đòn để giết
  atkMul   = per-type × baseHits
  ```
  `per-type`: obsidian_brute 1.28, eclipse_oracle 1.16, rift_stalker 1.04,
  sky_sentinel 1.25, cloud_wisp 0.96, dragon_whelp 1.08, plant_turret 1.23,
  skeleton_mage 1.12, còn lại 1.0.
- **ATK**: `max(1, round(playerMaxHp / (16 - depth*10) / max(1, sqrt(count/3))))`
  → phòng đầu chịu ~16 đòn, phòng cuối ~6 đòn.
- **Tốc độ** 【SRC】: plant_turret 0, obsidian_brute 38, sky_sentinel 48,
  eclipse_oracle 55, slime/goblin/skeleton_mage 64, dragon_whelp 88,
  cloud_wisp 92, rift_stalker 102, bat 115.
- **AI**: lao về phía người chơi, giữ khoảng cách theo loại; `plant_turret` đứng
  yên bắn; `bat`/`rift_stalker` nhanh; `skeleton_mage` bắn đạn.
  【SRC】`updateGame()` dòng 28201+ và `BESTIARY[].behavior` (16 mô tả).
- **Unity**: `EnemyController` + `EnemyAI` (state machine), `EnemySpawner` dùng
  **cùng công thức** và **cùng thứ tự chọn loại**.
- **Độ phức tạp**: Trung bình.
- **Rủi ro**: Nếu Unity random vị trí khác, "cùng phòng" sẽ khác — chấp nhận
  được (vị trí là trình bày), nhưng **loại quái và chỉ số phải khớp**.
- **Nghiệm thu**: với 5 chương × mọi phòng, `{type, hp, atk, speed}` khớp oracle.

### 2.8 Boss

- **Nguồn** 【SRC】`setupRoom()` 27067–27120; `BOSSFN` 3795.
- **Phòng trùm**: `isBossRoom(room) = (room % 5 === 0) || room === maxRooms`,
  và mọi phòng nếu mode `tower`/`bossrush`. 【ORACLE】Ch.1 → `[5,10,15]`;
  Ch.3 → `[5,10]`.
- **Loại trùm theo chương**: Ch.5 → `eclipse_sovereign`; Ch.4 → `elder_dragon`;
  còn lại: phòng 5 → `golem`, phòng 10 → `queen`, phòng cuối → `demon_king`.
- **HP**: `round(playerAtk × hitsToKill × chapterMul × (demon_king ? 1.15 : 1))`
  với `hitsToKill = 24 (phòng 5) / 30 (phòng 10) / 40 (khác)`.
  **Chú ý**: `roomMul` **không** nhân vào HP boss (quyết định có chủ đích, xem
  comment trong source).
- **ATK**: `max(1, round(playerMaxHp / (room===5 ? 9 : room===10 ? 7 : 5)))`
  → trùm đầu 9 đòn, trùm giữa 7, trùm cuối 5.
- **Nhiều pha**: `attackTimer`, `phaseTimer`, `dashTarget`; pattern đạn theo
  từng `BOSSFN` (golem/queen/demon_king/elder_dragon/eclipse_sovereign).
- **Unity**: `BossController` + ScriptableObject `BossDefinition` cho pattern;
  damage/HP lấy từ công thức, **không** từ asset.
- **Độ phức tạp**: Cao (5 bộ pattern).
- **Tiêu chí nghiệm thu**: HP/ATK khớp oracle; số pha và pattern đạn khớp mô tả
  `showBossIntro` + code `BOSSFN`.

### 2.9 Tiến trình phòng & phiên chơi

- **Nguồn** 【SRC】`DungeonSession` 26532, `startNewRun` 26894, `finishRun` 31236.
- **Ba hành động khác nhau** (đã đặc tả ở `docs/DUNGEON_RESET_SPEC.md`):
  Retry (`'retry'`), Reset/fresh (`'fresh'`), Continue (chỉ `paused = false`).
- **Dọn phòng** → `saveCheckpoint()` **chỉ khi `roomCleared === true`** và
  `room < maxRooms`, hết hạn 24h.
- **Ranh giới dữ liệu**: phiên (xoá được) vs nhân vật (không bao giờ xoá) —
  danh sách đầy đủ trong `DUNGEON_RESET_SPEC.md` §2.
- **Unity**: `RunSession` (C#) + `RoomController` + `CheckpointService`. Không
  có `MonoBehaviour` nào giữ dữ liệu nhân vật.
- **Độ phức tạp**: Trung bình.
- **Rủi ro**: Unity scene reload dễ vô tình reset dữ liệu nhân vật. Bắt buộc
  tách "persistent save" khỏi "scene state" về mặt kiểu dữ liệu.
- **Nghiệm thu**: 9 kịch bản trong `DUNGEON_RESET_SPEC.md` §6 chạy được trên bản
  Unity, dữ liệu nhân vật giữ nguyên từng số.

### 2.10 Thưởng & kinh tế

- **Nguồn** 【SRC】`finishRun()` 31236; drops 27890+.
- **Thưởng trận**: `victory → gold 350×chapterId, gems 40×chapterId`;
  `thua → gold room×20, gems floor(room×2)`.
- **Drop mỗi quái**: xp `22` (boss 35), gold `12` (boss 28), tim `round(maxHp ×
  (hero==alex ? 0.18 : 0.14))` (22% thường, 100% boss), scroll 28%/100%.
- **Lên cấp**: `xpNext` bắt đầu 80, mỗi cấp `round(xpNext × 1.25)`.
- **Server chặn**: `validateEconomyDelta` — `MAX_GOLD_GAIN_PER_REVISION = 500.000`,
  `MAX_GEMS_GAIN_PER_REVISION = 20.000`, và `goldEarned <= gold*100 + 1e6`.
- **Unity**: `RewardService` (pure) — phải cho **cùng số** với JS, và vẫn đi qua
  endpoint cũ để server kiểm tra.
- **Độ phức tạp**: Thấp.
- **Rủi ro**: Unity cộng thưởng ở client rồi save → server có thể chặn nếu một
  phiên tạo ra > 500k vàng. Giữ nguyên nhịp save của web (debounce 1200ms,
  save sau mỗi lần dọn phòng).
- **Nghiệm thu**: 1 trận thắng chương 1 (15 phòng) cho đúng tổng vàng/gems như
  web với cùng hạt giống drop.

### 2.11 Trang bị, phẩm chất, ghép

- **Nguồn** 【SRC】6955–7710, 10011–10602; 【ORACLE】`GEAR_TEMPLATES` (42),
  `GEAR_QUALITIES` (7), `FUSION_RECIPES` (15).
- **Chỉ số một món**:
  ```
  computeSingleItemStat(item) = round(
      (tpl.baseStat + (level-1) × tpl.perLv)
      × quality.mult
      × (1 + awakeningBonus(quality, awakening))
  )
  ```
  `quality.mult`: common 1.0, uncommon 1.28, rare 1.65, epic 2.15,
  legendary 2.85, mythic 3.85, chaotic 5.20.
- **Awakening**: epic 1→8%, 2→15%; legendary 1→8%, 2→14%, 3+→20%;
  mythic 1→25%, 2→30%, 3→35%, 4→40% (cần xác nhận 4, xem `getAwakeningBonusRate`).
- **Set bonus** 【SRC】`GEAR_SET_META` (6 bộ: phoenix/shadow/celestial/echo/
  destruction/decisiveness) theo mốc 2/4/6 món.
- **Ghép**: 3 món cùng tên → 1 món phẩm chất cao hơn, 15 công thức.
- **Unity**: `GearStatCalculator` (pure) + `GearItem` struct + `ScriptableObject`
  cho template. Id giữ nguyên chuỗi.
- **Độ phức tạp**: Trung bình.
- **Rủi ro**: `Math.round` trên `.5` (JS làm tròn lên, C# banker's) → lệch 1 ATK.
- **Nghiệm thu**: 42 template × 7 quality × 5 level × 5 awakening khớp tuyệt đối.

### 2.12 Anh hùng, sao, skin, cộng hưởng

- **Nguồn** 【SRC】4452–5636, 10733–11168.
- **18 anh hùng**, mỗi người `bonusAtk`, `bonusHp`, passive riêng, 0★→8★
  milestones (9 mốc), resonance slot 1 ở 3★ và slot 2 ở 6★.
- **Passive ảnh hưởng combat** (không chỉ hiển thị): thor (bắn khi chạy),
  wukong (+ATK/giảm thương), cleo (burn + nổ 300%/12 hit), rolla (freeze +
  thiên thạch), otta (trảm sát <30%), hou_yi (+16%), helix (+28% theo HP mất),
  dracoola (+40% khi full HP + lifesteal), alex (crit bảo đảm), loki (+ASPD),
  nezha (vệt lửa), phynx (bleed), mymu (bất tử 1 lần), atreus (dark shield),
  seraph/hela/nyanja/artemis (mark + hawk).
- **Unity**: `HeroDefinition` SO + `HeroPassiveRegistry` (mỗi passive một class
  `IHeroPassive` để test riêng).
- **Độ phức tạp**: Cao.
- **Rủi ro**: 18 passive × tương tác chéo. Port từng cái, test từng cái, không
  port "gần đúng".

### 2.13 Kỹ năng roguelike (72)

- **Nguồn** 【SRC】6184–6954.
- 4 độ hiếm: legendary 11, epic 25, rare 22, fine 14. 3 provider: Valkyrie,
  Angel, Devil. Chọn 1 trong N sau mỗi lần lên cấp / dọn phòng.
- **Save**: `starterSkillIds[]`, `acquiredSkills{}`, checkpoint `player.skills{}`
  (server whitelist slug + tier 1..20, tối đa 60 mục).
- **Unity**: `SkillDefinition` SO + `SkillController` + `SkillRollService` (pure,
  inject RNG).
- **Độ phức tạp**: Cao.
- **Nghiệm thu**: cùng seed → cùng 3 lựa chọn; tier cộng dồn đúng.

### 2.14 Cổ ngữ (46) & Thánh vật (46 + 13 bộ)

- **Nguồn** 【SRC】7712–9436 (runes), 8451–9436 (artifacts), 9063 (13 bộ).
- Rune: 4 loại (etched 13, blessing 7, enhancement 13, ability 13), 13 ô,
  11 tier. Có rune đổi hành vi combat (`guardian` -15%, `rune_valkyrie` hồi sinh,
  `star_of_fury` 7 thiên thạch, `arrow_of_echoes` bắt đầu với diag_arrow).
- Artifact: 0★→15★, cộng `atk`, `hp`, `atkPct`, `hpPct`, `critRate`,
  `critDmgPct`, `aspdBonus`, `dodgeBonus`, `defFlat`. 13 bộ có `tiersPct`
  `[12,18,24,30,36,42]`.
- **Unity**: `RuneService`, `ArtifactService` (pure) + data SO.
- **Độ phức tạp**: Trung bình (dữ liệu nhiều, công thức đơn giản).
- **Rủi ro**: Sai một field tên (`atkPct` vs `atkRate`) sẽ làm chỉ số lặng lẽ
  bằng 0. Test phải so từng field, không chỉ tổng.

### 2.15 Thẻ tài năng (32)

- **Nguồn** 【SRC】5637–6028.
- 32 thẻ, 2 set, cấp 1★/5★. `computeAllTalentCardsBonuses()` gộp thành
  `{flatAtk, flatHp, flatDef, atkPct, hpPct, critRate, critDmgPct, aspdBonus,
  dodgeBonus, gearBasePct, healer, …}`.
- **Unity**: `TalentService` (pure).
- **Độ phức tạp**: Thấp–Trung bình.
- **Nghiệm thu**: 32 thẻ × 5 cấp → object bonus khớp từng field.

### 2.16 Hành Trình Tân Thủ (8 bước)

- **Nguồn** 【SRC】25031+；【ORACLE】`BEGINNER_STEPS` = `N01..N08`.
- **Server whitelist** `BEGINNER_STEP_IDS`; `claimedRewards` chỉ hợp lệ nếu bước
  đã `completedSteps` (chống nhận trùng).
- **Unity**: `BeginnerJourneyService` — cùng id, cùng điều kiện, cùng thứ tự.
- **Độ phức tạp**: Thấp.
- **Rủi ro**: Unity gửi id lạ → server lọc sạch → người chơi mất tiến trình.
  Chỉ dùng đúng 8 id.

### 2.17 Mùa Giải (Season)

- **Nguồn** 【SRC】14238–14775; `lib/economy.js` `validateSeasonDelta`.
- 5 nghề (`blade/ranger/guardian/mage/merchant`), 3 trùm
  (`ironhide/reflector/regenerator`), 3 món shop.
- **Hi sinh sức mạnh**: mỗi 2% (`powerSacrificed`, tối đa 0.20) đổi 60 Tiền Mùa;
  hạ trùm +120; đổi nghề −50.
- **Ràng buộc server**: không hoàn tác hi sinh, không đổi trùm khi chưa hạ, không
  tự thay `bossMaxHp`, không hồi sinh trùm đã hạ, `tokens` tăng ≤ phần đã kiếm.
- **Unity**: `SeasonService` + `SeasonDeltaValidator` (mirror của JS để báo lỗi
  sớm trước khi gửi).
- **Độ phức tạp**: Trung bình.
- **Rủi ro**: Nếu Unity gửi save có `season` sai một field, **toàn bộ save bị
  422** → người chơi mất tiến trình ván đó. Validator phía client phải chạy
  trước khi PUT.

### 2.18 Bang Hội (Guild)

- **Nguồn** 【SRC】13939–14074; 【ORACLE】`GUILD_RANKS`, `GUILD_MAX_MEMBERS` 20.
- Hiện là **NPC cục bộ** (tạo bang, sinh 20 thành viên giả theo lực chiến chủ
  bang, 4 cấp bậc). Không có server-side guild.
- **Unity**: port nguyên hành vi (không "nâng cấp" thành multiplayer — ngoài
  phạm vi).
- **Độ phức tạp**: Thấp.
- **Rủi ro**: Dễ bị hiểu nhầm là hệ thống online. Ghi rõ trong tài liệu.

### 2.19 Vườn Thủ Hộ (Garden)

- **Nguồn** 【SRC】14075–14237; 【ORACLE】4 loại hạt, `GARDEN_PRODUCE`, `GARDEN_SHOP`.
- Trạng thái `garden` **không** nằm trong whitelist `saveSchema.js` → **không
  được lưu lên server**. Đây là phát hiện quan trọng: tiến trình vườn hiện chỉ
  sống trong phiên.
- **Unity**: port hành vi; **không** tự thêm field vào save (sẽ bị server lọc,
  và nếu thêm vào whitelist thì phải làm phía server + test).
- **Độ phức tạp**: Thấp.
- **Rủi ro**: Nếu Unity lưu `garden` và tưởng là bền vững → dữ liệu mất khi
  server lọc. Phải nêu rõ.

### 2.20 Plinko

- **Nguồn** 【SRC】14776+; 【ORACLE】`PLINKO_ROWS=8`, `PLINKO_MULTS` (9 bin,
  8.5/3.2/1.3/0.67/0.35 đối xứng).
- **Save**: `plinko` cũng **không** có trong whitelist server.
- **Unity**: port nguyên; cùng bảng hệ số.
- **Độ phức tạp**: Thấp.

### 2.21 Bestiary (16)

- **Nguồn** 【SRC】4250–4407; 【ORACLE】`BESTIARY` 16 mục.
- Save `bestiary{typeId: {seen, killed, firstAt}}`, giới hạn 64 loại.
- Hiển thị "???" khi chưa giết lần nào.
- **Unity**: `BestiaryService` + UI codex.
- **Độ phức tạp**: Thấp.

### 2.22 Thành tựu (25)

- **Nguồn** 【SRC】24854–25030; 【ORACLE】`ACHIEVEMENTS` 25.
- `achievementsUnlocked` (mốc thời gian) + `achievementsClaimed` (chống nhận
  trùng). `bumpLifetimeStat`, `setLifetimeStatMax`.
- **Unity**: `AchievementService` (pure) + UI.
- **Độ phức tạp**: Thấp–Trung bình.
- **Rủi ro**: Đếm hai lần `runs` (web đếm ở `startNewRun`, không ở `finishRun`).

### 2.23 Xác thực & Cloud save

- **Nguồn** 【SRC】`public/cloud.js` (517 dòng), `lib/auth.js`, `api/save.js`.
- **Nguyên tắc**: MongoDB là **nguồn duy nhất**. `localStorage` bị xoá chủ động
  (`purgeLegacyLocalSave`) vì bug thật: tài khoản mới hiện chỉ số của tài khoản
  cũ trên cùng trình duyệt.
- **Luồng**: `GET /api/auth/me` → nếu chưa đăng nhập hiện cổng → `GET /api/save`
  → buffer trong bộ nhớ → `SaveState.load()` → game chạy.
- **Ghi**: `SaveState.save()` phát event `artemis:save` → debounce 1200ms →
  `PUT /api/save {data, revision}`. Nếu 409 → cảnh báo, không ghi đè.
  Nếu 422 `ECONOMY_*` → nạp lại bản server rồi reload.
- **Unity**: `ArtemisApiClient` (UnityWebRequest) + `SaveSyncService` +
  `SaveSerializer` (versioned).
- **Độ phức tạp**: **Cao** (đặc biệt xác thực trên Android).
- **Rủi ro**: xem §3.

### 2.24 Công cụ quản trị

- **Nguồn** 【SRC】`public/admin.html`, `api/admin/*`, `lib/adminAuth.js`.
- Dashboard đọc trực tiếp MongoDB (players, saves, stats). Không phụ thuộc client.
- **Unity**: không port. Giữ nguyên web admin.
- **Rủi ro**: Không có. Chỉ cần đảm bảo schema save không đổi.

---

## 3. Rủi ro tương thích — xác thực trên Android

Đây là rủi ro **lớn nhất** của toàn bộ migration và phải quyết định trước khi
viết dòng code Unity nào.

**Hiện trạng:** phiên là cookie `HttpOnly; SameSite=Lax; Secure` do server đặt.
Web hoạt động vì trình duyệt tự gửi cookie.

**Vấn đề:**
- **WebGL**: chạy trong trình duyệt → cookie hoạt động như web, **miễn là**
  cùng origin. Nếu build WebGL phục vụ từ domain khác (ví dụ CDN) → cookie
  cross-site bị chặn bởi `SameSite=Lax`. → **Phải phục vụ cùng origin** (ví dụ
  `/unity/index.html` trên chính domain Vercel).
- **Android**: `UnityWebRequest` **không** có cookie jar tự động đáng tin cậy
  (`CookieContainer` chỉ hoạt động khi bật, và `HttpOnly` không đọc được bằng
  JS/Unity API). Bản thân client cũng không thể đọc token HttpOnly → không
  "chuyển" cookie sang header được.

**Ba phương án, chọn 1 (cần người quyết định phê duyệt):**

| Phương án | Cách làm | Ưu | Nhược |
|---|---|---|---|
| **A. Bearer token (khuyến nghị)** | Thêm `POST /api/auth/token` trả `{token, expiresAt}` trong **body** (không cookie) cho client native; thêm middleware chấp nhận `Authorization: Bearer` **bên cạnh** cookie cũ | Không phá web; chuẩn cho mobile; token lưu trong `Android Keystore` / `SecureStorage` | Phải sửa server (thêm route + đọc header) → cần test bảo mật mới; token trong bộ nhớ thiết bị nếu lưu sai chỗ sẽ nguy hiểm |
| **B. Cookie jar trong Unity** | Bật `UnityWebRequest.cookieContainer`, đăng nhập qua `UnityWebRequest`, giữ cookie trong RAM | Không sửa server | Không hoạt động với `HttpOnly` trên một số backend; mất khi app bị kill → phải đăng nhập lại; không kiểm soát được `Secure` |
| **C. WebView wrapper** | Nhúng web game vào WebView (không phải Unity thật) | Cookie hoạt động | **Không đáp ứng yêu cầu** (không phải Unity native) |

**Khuyến nghị: A.** Nhưng theo yêu cầu "không nới lỏng bảo mật để dễ tích hợp",
phương án A **không** được làm yếu cookie hiện có: cookie vẫn là mặc định cho
web, Bearer chỉ là kênh bổ sung, cùng secret, cùng thời hạn, cùng rate-limit,
và **không** trả token cho request đã có cookie (tránh rò rỉ qua XSS).

Cho tới khi được duyệt, Phase 1 **chỉ** dùng được WebGL cùng origin; Android
được đánh dấu **blocked** trong ma trận parity.

---

## 4. Ma trận tính năng (feature parity matrix)

Cột **P1** = phạm vi Phase 1 (vertical slice). **P2–P4** = các phase sau.

| # | Hệ thống | Nguồn | P1 | P2 | P3 | P4 | Test parity | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| 1 | Di chuyển + kẹp tường | `updateGame` | ✅ | | | | ✅ | Chưa port |
| 2 | Dừng-để-bắn | `updateGame` | ✅ | | | | ✅ | Chưa port |
| 3 | Đạn người chơi (3 vũ khí) | `createPlayerBullet` | ✅ | | | | ✅ | Chưa port |
| 4 | `getComputedStats` (ATK/HP/ASPD/CRIT/DEF) | 11170 | ✅ | | | | ✅ | Chưa port |
| 5 | `damageEnemy` + crit | 27663 | ✅ | | | | ✅ | Chưa port |
| 6 | `hurtPlayer` pipeline | 29208 | ✅ | | | | ✅ | Chưa port |
| 7 | Quái: sinh + chỉ số + AI cơ bản | 27030 | ✅ | | | | ✅ | Chưa port |
| 8 | Boss: HP/ATK + 1 pattern (golem) | 27067 | ✅ | | | | ✅ | Chưa port |
| 9 | Tiến trình phòng + thắng/thua | 31236 | ✅ | | | | ✅ | Chưa port |
| 10 | HUD (HP, phòng, quái còn, XP, vàng) | 27140 | ✅ | | | | ✅ | Chưa port |
| 11 | Cloud save (GET/PUT, 409/422) | `cloud.js` | ✅ | | | | ✅ | Chưa port |
| 12 | Xác thực web (cookie) | `auth.js` | ✅ | | | | ✅ | Chưa port |
| 13 | 72 kỹ năng roguelike | 6184 | | ✅ | | | ✅ | Chưa port |
| 14 | 18 hero passive | 4452 | | ✅ | | | ✅ | Chưa port |
| 15 | 5 boss pattern còn lại | `BOSSFN` | | ✅ | | | ✅ | Chưa port |
| 16 | Trang bị 42 mẫu + 7 phẩm chất | 6955 | | | ✅ | | ✅ | Chưa port |
| 17 | Ghép 15 công thức | 6966 | | | ✅ | | ✅ | Chưa port |
| 18 | 46 cổ ngữ | 7712 | | | ✅ | | ✅ | Chưa port |
| 19 | 46 thánh vật + 13 bộ | 8451 | | | ✅ | | ✅ | Chưa port |
| 20 | 32 thẻ tài năng | 5637 | | | ✅ | | ✅ | Chưa port |
| 21 | Sao hero 0★→8★ + skin + resonance | 10733 | | | ✅ | | ✅ | Chưa port |
| 22 | Kinh tế + thưởng + lên cấp | 31236 | | | ✅ | | ✅ | Chưa port |
| 23 | Hành Trình Tân Thủ (8 bước) | 25031 | | | ✅ | | ✅ | Chưa port |
| 24 | 25 thành tựu | 24854 | | | ✅ | | ✅ | Chưa port |
| 25 | Mùa Giải (nghề/trùm/hi sinh) | 14238 | | | | ✅ | ✅ | Chưa port |
| 26 | Bang Hội (NPC) | 13939 | | | | ✅ | ✅ | Chưa port |
| 27 | Vườn Thủ Hộ | 14075 | | | | ✅ | ✅ | Chưa port |
| 28 | Plinko | 14776 | | | | ✅ | ✅ | Chưa port |
| 29 | Bestiary (16) | 4250 | | | | ✅ | ✅ | Chưa port |
| 30 | 5 chế độ chơi | 3994 | | | | ✅ | ✅ | Chưa port |
| 31 | Gacha/rương + wish | 17897 | | | | ✅ | ✅ | Chưa port |
| 32 | Admin dashboard | `admin.html` | — | — | — | — | — | Giữ nguyên web |

Bảng này là **nguồn sự thật của tiến độ**. Cập nhật sau mỗi milestone, không
đánh dấu ✅ khi chưa có test chạy thật.

---

## 5. Đồ thị phụ thuộc (rút gọn)

```
getComputedStats()  ← SaveState(20+ field), HEROES, WEAPONS, PETS,
                       GEAR_TEMPLATES, GEAR_QUALITIES, GEAR_SET_META,
                       RUNES, ARTIFACTS, TALENT_CARDS_DATA,
                       HERO_STAR_MILESTONES, HERO_SKINS, season career
        │
        ├──> Game.player {hp,maxHp,atk,aspd,critRate,critDmgMult,defFlat,dmgReduction,dodge}
        │
        ├──> createPlayerBullet()  ← weapon, skills (tracking/charged/lightwing)
        ├──> damageEnemy()         ← player stats + 18 hero passive + set passive
        └──> hurtPlayer()          ← dmgReduction, rune, hero, dark shield

setupRoom(room) ← chapter.enemyScale, Game.maxRooms, player.atk, player.maxHp
   ├──> spawn quái (loop count, type, hp, atk, speed)
   └──> spawn boss (5 loại, hitsToKill 24/30/40, atk /9 /7 /5)

finishRun(victory) ← Game.{room,runGold,kills,chapter,mode}
   ├──> SaveState.gold/gems += bonus
   ├──> lifetimeStats, winsByChapter, achievements
   ├──> checkpoint = null
   └──> SaveState.save() → PUT /api/save
```

**Hệ quả cho Unity:** `PlayerStatsCalculator` phải chạy được **không cần scene**;
`EnemySpawner` chỉ được đọc **kết quả** của nó, không tự tính lại ATK.

---

## 6. Đề xuất kiến trúc Unity

```
Artemis/
  unity-client/
    Assets/Artemis/
      Core/            # pure C#: math, rounding, RNG interface, time
      Data/            # ScriptableObject definitions + JSON importer
      Combat/          # DamageCalculator, CombatEventSystem
      Characters/      # PlayerStatsCalculator, HeroPassiveRegistry
      Enemies/         # EnemyController, EnemyAI
      Bosses/          # BossController, pattern SOs
      Skills/          # SkillController, SkillRollService
      Equipment/       # GearStatCalculator, RuneService, ArtifactService
      Inventory/       # GearBag, loadouts
      Progression/     # XpService, ChapterService, AchievementService
      Dungeons/        # RunSession, RoomController, CheckpointService
      Seasons/         # SeasonService, SeasonDeltaValidator
      Networking/      # ArtemisApiClient, SaveSyncService
      Persistence/     # SaveSerializer, SaveMigrator
      UI/              # UXML/USS hoặc uGUI
      Audio/           # SoundFX port
      VisualEffects/   # pool, particles
      Tests/EditMode/  # formula parity (NUnit)
      Tests/PlayMode/  # slice smoke
  tools/unity-parity/  # oracle.mjs + fixtures generator + compare
  docs/unity-migration/
```

**Quy tắc kiến trúc bắt buộc:**

1. `Core/`, `Combat/`, `Characters/`, `Equipment/`, `Progression/`, `Dungeons/`,
   `Seasons/` **không được** `using UnityEngine` (trừ `UnityEngine.Mathf` nếu
   thay bằng `System.Math`). Nhờ vậy compile + test được bằng `dotnet test`
   ngoài Unity Editor — điều kiện tiên quyết để kiểm chứng trên máy này.
2. Mọi ngẫu nhiên đi qua `IRandomSource` (implement bằng `System.Random` cho
   test, `UnityEngine.Random` cho game).
3. Mọi làm tròn đi qua `JsMath.Round` (mô phỏng `Math.round` của JS:
   half-up về +∞, khác `Math.Round` của .NET).
4. Không `MonoBehaviour` nào giữ dữ liệu người chơi.

---

## 7. Cạm bẫy kỹ thuật đã xác định (từ đọc source)

| # | Cạm bẫy | Bằng chứng | Cách xử lý |
|---|---|---|---|
| 1 | `Math.round` JS ≠ `Math.Round` .NET | `Math.round(2.5)=3`, .NET `Math.Round(2.5)=2` | `JsMath.Round(x) => (long)Math.Floor(x + 0.5)` |
| 2 | `.toFixed(2)` trả **chuỗi** rồi `+` ép về số | `baseAspd`, `baseCrit`, `critDmgMult` | `JsMath.ToFixed(x, 2)` = `double.Parse(x.ToString("F2", Invariant))` |
| 3 | `|| 1` bảo vệ `NaN` | `225 * (Number(stats.hero?.bonusSpd) || 1)` | giữ nguyên, không "dọn" thành `?? 1` |
| 4 | `defK` phụ thuộc chương đang chơi, mặc định 15 | `const defK = 400 + 120 * ((Game.chapter && Game.chapter.rooms) || 15)` | truyền `maxRooms` tường minh vào calculator |
| 5 | `roomMul` **không** nhân HP boss | comment 27092–27100 | test riêng: boss HP chỉ phụ thuộc chapter, không phụ thuộc phòng |
| 6 | `hitsToKill` theo **số phòng**, không theo "boss thứ mấy" | `roomNum === 5 ? 24 : roomNum === 10 ? 30 : 40` | Ch.4/5 có 15 phòng → boss phòng 15 dùng 40 |
| 7 | Chọn loại quái tất định `(room + i) % types.length` | 27166 | port đúng phép modulo, không `Random.Range` |
| 8 | `int` overflow khi `atk` lớn | `atk ≈ 287.510` từng xuất hiện; safe với `int` nhưng `playerAtk × 40 × 2.62` vẫn < 2^31 | dùng `long` cho HP/ATK trung gian, `int` chỉ khi đã round |
| 9 | `damageEnemy` cộng passive **sau** `finalDmg` | Oracle combo `e.hp -= round(finalDmg*0.85)` | tách `IAttackModifier.PostHit` |
| 10 | `garden`/`plinko` **không** được server lưu | `lib/saveSchema.js` not whitelisted | không giả định bền vững |
| 11 | `localStorage` từng gây rò dữ liệu chéo tài khoản | comment `cloud.js` 1–13 | Unity cũng **không** cache save trên đĩa mà không gắn playerId |
| 12 | 409 khi revision lệch | `api/save.js` | không tự ghi đè; phải hỏi người chơi |
| 13 | 422 `ECONOMY_*` trả kèm `serverData` | `api/save.js` | nạp lại bản server, không gửi lại mù |
| 14 | **Lỗi ưu tiên toán tử**: `obsidian_brute` không nhân `baseHits` | `const atkMul = t === 'obsidian_brute' ? 1.28 : (…) * baseHits;` — `?:` thấp hơn `*` nên `* baseHits` chỉ áp cho nhánh sau | Unity **tái hiện đúng hành vi** (`EnemySpawner.MobHpMultiplier`) để không đổi cân bằng; đội game quyết định có vá web hay không |
| 15 | `startNewRun(reason)` **không** nhận chỉ số chương | đọc `SaveState.selectedChapterIdx`; truyền tham số thứ hai bị bỏ qua | khi scripting/test phải set `selectedChapterIdx` rồi gọi `startNewRun()`; và phải mở khoá `winsByChapter` nếu không `startNewRun` trả `false` |
| 16 | Lên cấp dùng `if`, không `while` | `updateGame` dòng 29001 | một lần nhặt XP chỉ lên 1 cấp; giữ đúng để không đổi nhịp roguelike |
| 17 | 14/18 hero **không** có skin trong `HERO_SKINS` | `getHeroSkinsList` sinh động 3 skin với hệ số khác | không được chỉ đọc `heroSkins.json`; phải port nhánh sinh (`SkinsForHero`) |
| 18 | **Server LỌC BỎ `artifactStars` + `equippedRuneSlots`** | 0/52 save production có hai field này (đo 2026-11-06); mất tới 98,9% ATK | xem `FINDING-save-drops-artifacts-runes.md`. Unity đọc nếu có, KHÔNG ghi đè bằng rỗng; Phase 3 bị chặn |

---

## 8. Test hiện có (phải giữ nguyên, không sửa để dễ pass)

36 file `tests/*.test.mjs`, chạy `npm test` (`node --test`). Nhóm chính:

| Nhóm | File |
|---|---|
| Combat/công thức | `combat`, `stat-curve`, `no-hardcoded-stats`, `float-text`, `boss-hp-hud` |
| Phòng/tiến trình | `room-clear`, `checkpoint`, `dungeon-reset`, `chapter-select`, `chapter-victory`, `run-defeat`, `map-select` |
| Hệ thống | `economy`, `progression-economy`, `season*`, `garden`, `guild`, `bestiary`, `plinko`, `game-modes`, `beginner-journey`, `new-player-zero-state`, `ultimate`, `devil-*` |
| Hạ tầng | `integration`, `cloud-only-save`, `save-schema`, `admin`, `purge-safety`, `dev-cheats`, `hero-roster-nav`, `battle-ui`, `hud-progress` |

**Ràng buộc:** migration không được làm đỏ bất kỳ test nào trong 36 file này.
Đó là "hàng rào" chứng minh game web không bị đụng.

---

## 9. Kết luận Phase 0

Đã hoàn thành: kiểm kê đầy đủ, công thức then chốt, ma trận 32 hệ thống, đồ thị
phụ thuộc, 13 cạm bẫy cụ thể, và một **oracle chạy được** để kiểm chứng parity
bằng số.

Điều kiện vào Phase 1: **đã đủ**. Oracle + .NET SDK cục bộ cho phép viết domain
C# và chứng minh parity ngay trên máy không có Unity Editor.

Điều kiện **chưa** đủ: quyết định phương án xác thực Android (§3). Phase 1 chỉ
làm WebGL cùng origin; Android bị chặn cho tới khi có phê duyệt.
