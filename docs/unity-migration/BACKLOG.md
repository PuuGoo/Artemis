# BACKLOG — Artemis Unity Migration

Ưu tiên: **P0** = chặn Phase 1 · **P1** = trong Phase hiện tại ·
**P2** = phase sau · **P3** = có thể cắt nếu cần.

Kích thước: S ≤ 0.5 ngày · M ≈ 1–2 ngày · L ≈ 3–5 ngày · XL > 5 ngày
(ước lượng theo năng lực một kỹ sư đã đọc xong audit).

---

## Phase 0 — Khảo sát & kế hoạch ✅ HOÀN TẤT

| ID | Việc | Ưu tiên | Kích thước | Trạng thái |
|---|---|---|---|---|
| P0-01 | Khảo sát toàn bộ `public/index.html`, `api/`, `lib/`, `tests/` | P0 | M | ✅ |
| P0-02 | `docs/unity-migration/SOURCE_AUDIT.md` | P0 | M | ✅ |
| P0-03 | Ma trận 32 hệ thống | P0 | S | ✅ |
| P0-04 | `ARCHITECTURE.md` | P0 | S | ✅ |
| P0-05 | `RISK_REGISTER.md` (25 rủi ro) | P0 | S | ✅ |
| P0-06 | Oracle headless (`tools/unity-parity/oracle.mjs`) | P0 | M | ✅ |
| P0-07 | `.gitignore` cho Unity | P0 | S | ✅ |

## Phase 1 — Nền tảng Unity + vertical slice

### 1A. Domain thuần (chứng minh được bằng `dotnet test`)

| ID | Việc | Ưu tiên | Kích thước | Phụ thuộc |
|---|---|---|---|---|
| P1-01 | `Artemis.Domain.csproj` (netstandard2.1, không UnityEngine) | P0 | S | — |
| P1-02 | `JsMath` + test đối chiếu Node (`Math.round`, `toFixed`, edge `0.49999999999999994`) | P0 | S | P1-01 |
| P1-03 | `IrRrandomSource` + `DeterministicRandom` (xorshift, seed cố định) | P0 | S | P1-01 |
| P1-04 | `SaveModel` + `SaveSerializer` (giữ đúng 62 khoá, không đổi tên) | P0 | M | P1-01 |
| P1-05 | `ChapterDefinition`, `WeaponDefinition`, `HeroDefinition` từ JSON sinh | P0 | M | `extract-data.mjs` |
| P1-06 | `PlayerStatsCalculator` (getComputedStats) | P0 | L | P1-02/03/04/05 |
| P1-07 | `DamageCalculator` (damageEnemy) | P0 | M | P1-06 |
| P1-08 | `IncomingDamageCalculator` (hurtPlayer 9 bước) | P0 | M | P1-06 |
| P1-09 | `EnemyStatFactory` + `RoomPlan` (sinh quái theo phòng) | P0 | M | P1-06 |
| P1-10 | `BossStatFactory` | P0 | S | P1-06 |
| P1-11 | `RewardService` + `XpService` + `ChapterService` | P1 | S | P1-06 |
| P1-12 | `SeasonDeltaValidator` (mirror JS) | P1 | M | P1-04 |
| P1-13 | Fixture generator (`tools/unity-parity/gen-fixtures.mjs`) | P0 | M | oracle |
| P1-14 | Test parity: stats / damage / incoming / spawn / reward | P0 | L | P1-06…P1-13 |
| P1-15 | Test save round-trip với save mẫu có/không có mọi field | P1 | M | P1-04 |

### 1B. Dự án Unity (source đầy đủ, **không build được ở máy này**)

| ID | Việc | Ưu tiên | Kích thước | Phụ thuộc |
|---|---|---|---|---|
| P1-16 | `ProjectSettings/ProjectVersion.txt` (khoá 2022.3 LTS) | P0 | S | — |
| P1-17 | `Packages/manifest.json` (URP, Input System, Test Framework) | P0 | S | — |
| P1-18 | asmdef: `Artemis.Domain` / `Artemis.Runtime` / `Artemis.Tests` | P0 | S | — |
| P1-19 | `Bootstrap` scene + `GameBootstrap` (điểm vào duy nhất) | P0 | M | P1-18 |
| P1-20 | `PlayerController` (kinematic, chuẩn hoá vector, kẹp tường) | P0 | M | P1-19 |
| P1-21 | `InputReader` (Input System, WASD + joystick ảo) | P0 | M | P1-19 |
| P1-22 | `CombatController` (dừng-để-bắn, cooldown `1/aspd`) | P0 | M | P1-20 |
| P1-23 | `ProjectileController` + pool | P0 | M | P1-22 |
| P1-24 | `EnemyController` + `EnemyAI` (1 loại: slime) | P0 | M | P1-23 |
| P1-25 | `BossController` (golem, 3 pha) | P0 | M | P1-23 |
| P1-26 | `RoomController` (dọn phòng, tiến phòng, thắng/thua) | P0 | M | P1-24/25 |
| P1-27 | `CombatHud` (HP, phòng, quái còn, XP, vàng) | P0 | M | P1-26 |
| P1-28 | `ArtemisApiClient` (UnityWebRequest, 401/409/422/429/5xx) | P0 | L | P1-18 |
| P1-29 | `SaveSyncService` (debounce, revision, không ghi đè) | P0 | M | P1-28 |
| P1-30 | `AuthScreen` (đăng nhập/đăng ký, cùng validation) | P0 | M | P1-28 |
| P1-31 | EditMode test gọi `PlayerStatsCalculator`/`DamageCalculator` | P1 | M | P1-14 |
| P1-32 | PlayMode smoke test (1 phòng, di chuyển, bắn, giết) | P1 | M | P1-26 |
| P1-33 | `README.md` hướng dẫn mở bằng Unity LTS + build WebGL | P0 | S | P1-17 |

### 1C. Không làm được ở máy này (blocked, ghi rõ)

| ID | Việc | Lý do |
|---|---|---|
| X-01 | Mở scene trong Editor, kiểm tra visual | Không có Unity Editor |
| X-02 | Build WebGL | Không có Unity Editor + WebGL module |
| X-03 | Build APK Android | Không có Unity, JDK, Android SDK |
| X-04 | Profiling FPS thật | Không có build |
| X-05 | Kiểm thử cookie trên trình duyệt thật với WebGL | Không có build |

## Phase 2 — Combat parity đầy đủ

| ID | Việc | Ưu tiên | Kích thước |
|---|---|---|---|
| P2-01 | 72 kỹ năng roguelike (`SkillDefinition` + `SkillController`) | P2 | XL |
| P2-02 | `SkillRollService` (3 provider, cùng seed → cùng lựa chọn) | P2 | M |
| P2-03 | 18 hero passive (mỗi passive 1 class `IHeroPassive`) | P2 | XL |
| P2-04 | 4 boss pattern còn lại (queen, demon_king, elder_dragon, eclipse_sovereign) | P2 | XL |
| P2-05 | 16 loại quái AI đầy đủ | P2 | L |
| P2-06 | Homing/bounce/ricochet/pierce parity | P2 | M |
| P2-07 | Status effect (burn/slow/bleed/freeze/paralyze) | P2 | L |
| P2-08 | Ultimate (charge 18/s) | P2 | M |
| P2-09 | Devil pact encounter | P2 | M |

## Phase 3 — Tiến trình

| ID | Việc | Ưu tiên | Kích thước |
|---|---|---|---|
| P3-01 | 42 gear template + 7 quality + awakening | P3 | L |
| P3-02 | 15 fusion recipe + blacksmith UI | P3 | L |
| P3-03 | 46 rune (4 loại, 13 ô) | P3 | L |
| P3-04 | 46 artifact + 13 bộ (0★→15★) | P3 | L |
| P3-05 | 32 talent card | P3 | M |
| P3-06 | Hero star 0★→8★ + skin + resonance | P3 | L |
| P3-07 | Inventory / loadout / preset | P3 | M |
| P3-08 | Currency + gacha + chest | P3 | L |
| P3-09 | Beginner Journey 8 bước | P3 | S |
| P3-10 | 25 thành tựu | P3 | M |
| P3-11 | Chapter unlock + best room | P3 | S |

## Phase 4 — Hệ thống còn lại

| ID | Việc | Ưu tiên | Kích thước |
|---|---|---|---|
| P4-01 | Mùa Giải (5 nghề, 3 trùm, hi sinh, shop) | P4 | L |
| P4-02 | Bang Hội (NPC, 20 thành viên, 4 cấp) | P4 | S |
| P4-03 | Vườn Thủ Hộ (4 hạt) | P4 | S |
| P4-04 | Plinko (8 hàng, 9 bin) | P4 | S |
| P4-05 | Bestiary 16 mục | P4 | S |
| P4-06 | 5 chế độ chơi | P4 | M |
| P4-07 | Wish shrine / events | P4 | M |

## Phase 5 — Sẵn sàng production

| ID | Việc | Ưu tiên |
|---|---|---|
| P5-01 | Build WebGL + smoke test trình duyệt | P5 |
| P5-02 | Build Android (**chờ duyệt xác thực**) | P5 |
| P5-03 | Profiling theo ngân sách | P5 |
| P5-04 | Regression toàn bộ 36 test web + test Unity | P5 |
| P5-05 | Tài liệu deploy + rollback | P5 |
| P5-06 | Di trú dữ liệu (nếu cần) — **chỉ sau phê duyệt** | P5 |

---

## Thứ tự thực hiện Phase 1

```
P1-01 → P1-02 → P1-03
                 ↓
P1-04 → P1-05 → P1-06 → P1-07 / P1-08 / P1-09 / P1-10
                              ↓
                        P1-13 → P1-14   ← bằng chứng parity
                              ↓
P1-16 → P1-17 → P1-18 → P1-19 → P1-20 → P1-22 → P1-23 → P1-24/25 → P1-26 → P1-27
                                                             ↓
                                                     P1-28 → P1-29 → P1-30
```

Domain (trái) chạy độc lập với Unity (phải). Domain phải xanh trước khi viết
`MonoBehaviour` — nếu không, không có cách nào biết lỗi nằm ở công thức hay ở
engine.
