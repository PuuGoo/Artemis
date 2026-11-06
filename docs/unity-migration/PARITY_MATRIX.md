# PARITY MATRIX — trạng thái kiểm chứng

> Cập nhật: sau commit Phase 1 (domain + runtime scaffold).
> **Quy tắc:** chỉ đánh ✅ khi có test chạy thật và đã xem kết quả. Không đánh
> dấu dựa trên "đã viết code".

Cột trạng thái:

| Ký hiệu | Nghĩa |
|---|---|
| ✅ **Verified** | Có test so với code production, test xanh, đã xem output |
| 🟡 **Port xong, chưa chạy** | Công thức đã port và biên dịch, nhưng chưa được chạy trong Unity |
| ⬜ **Chưa làm** | Chưa có gì |
| ⛔ **Blocked** | Bị chặn bởi nguyên nhân bên ngoài |

---

## A. Công thức & dữ liệu — kiểm chứng bằng `dotnet test` (81 test)

| # | Hệ thống | Trạng thái | Bằng chứng |
|---|---|---|---|
| A1 | `Math.round` / `toFixed` của JS | ✅ | `JsMathTests`, 17 ca đối chiếu Node, gồm `0.49999999999999994` và `1.005 → 1.00` |
| A2 | `getComputedStats()` — ATK | ✅ | 16 cấu hình, khớp tuyệt đối tới từng đơn vị (152 → 40.334) |
| A3 | `getComputedStats()` — HP | ✅ | cùng 16 cấu hình (775 → 119.796) |
| A4 | `getComputedStats()` — ASPD / CRIT / CritDMG | ✅ | khớp tới sai số 1e-9 |
| A5 | `getComputedStats()` — DEF / dmgReduction | ✅ | khớp; có test riêng: cùng DEF, chương ít phòng → DR cao hơn |
| A6 | `getComputedStats()` — powerScore | ✅ | khớp tuyệt đối |
| A7 | Trang bị: `computeSingleItemStat` + awakening | ✅ | nằm trong 16 cấu hình (common → mythic ×5) |
| A8 | Gem / affix / set bonus 6 bộ | ✅ | nằm trong cấu hình `dragonknight-*`, `everything-combined` |
| A9 | Rune: 4 loại, 13 ô, enchant | ✅ | cấu hình `runes-filled` khớp oracle |
| A10 | Artifact: 46 món + 13 bộ 0★→15★ | ✅ | cấu hình `artifacts-3star-set` khớp oracle |
| A11 | Talent 32 thẻ | ✅ | cấu hình `talents-maxed` khớp oracle |
| A12 | Season career 5 nghề + hi sinh sức mạnh | ✅ | `season-career-blade-10sacrifice`, `-guardian` |
| A13 | Skin: 4 curate + 14 sinh động | ✅ | test bắt được lỗi này; sau khi port nhánh sinh thì khớp |
| A14 | Hero star 0★→8★ + global [All] bonus | ✅ | `hero-thor-8star` (ATK 4044 / HP 14405) |
| A15 | `damageEnemy()` — crit, hero mult, mark mult | ✅ | 9 ca khớp từng đơn vị |
| A16 | `damageEnemy()` — Otta bonus crit | ✅ | test riêng: >60% HP mới có +0.18 |
| A17 | `damageEnemy()` — Alex crit bảo đảm (tiêu 1 lần) | ✅ | test riêng |
| A18 | `damageEnemy()` — Artemis mark SAU khi đọc hệ số | ✅ | test riêng: đòn đầu không bonus, đòn sau +25% |
| A19 | `hurtPlayer()` — 9 bước, sàn max(1) từng bước | ✅ | test riêng cho từng bước + dodge cap 0.55 |
| A20 | `hurtPlayer()` — chuỗi hồi sinh valkyrie→revive→mymu | ✅ | test thứ tự + "chỉ 1 lần/lượt" |
| A21 | Quái: số lượng, loại tất định, HP, ATK, speed, r | ✅ | **67 phòng × 5 chương** khớp oracle |
| A22 | Boss: HP/ATK, loại theo chương/phòng, isBossRoom | ✅ | khớp; test riêng: HP boss KHÔNG nhân roomMul |
| A23 | Quái Ch.5 `obsidian_brute` (lỗi ưu tiên toán tử) | ✅ | tái hiện đúng hành vi production, có test khoá |
| A24 | Thưởng thắng/thua | ✅ | 30 ca khớp |
| A25 | XP lên cấp (`if`, không `while`) | ✅ | test khoá: 1 cấp/lần nhặt, phần dư ở lại `xp` |
| A26 | Mở khoá chương + normalize selected | ✅ | test riêng |
| A27 | Save round-trip không mất field | ✅ | 8 bộ save server thật |
| A28 | Chỉ số y nguyên sau round-trip | ✅ | ATK/HP/ASPD/CRIT/DEF khớp trên cả 8 bộ |
| A29 | 409 / 422 / 429 / 5xx policy | ✅ | `SavePushPolicyTests`, 6 test |
| A30 | Dữ liệu tĩnh 250+ mục khớp web | ✅ | `check-unity-project.mjs` khoá số lượng từng bảng |

## B. Runtime Unity — biên dịch được, **chưa chạy lần nào**

| # | Hệ thống | Trạng thái | Ghi chú |
|---|---|---|---|
| B1 | Di chuyển (chuẩn hoá vector, kẹp tường, trượt theo trục) | 🟡 | `PlayerController`, biên dịch OK |
| B2 | Dừng-để-bắn + 3 booster cooldown | 🟡 | `CombatController.ComputeCooldown` có test tĩnh |
| B3 | Đạn + pool + `hitSet` chống trúng lại | 🟡 | `Projectile`, `ProjectilePool` |
| B4 | Quái AI (lao tới, plant_turret đứng yên) | 🟡 | `EnemyController` |
| B5 | Boss (1 pattern: golem) | ⬜ | chưa có `BossController`; HP/ATK đã verified ở A22 |
| B6 | Tiến trình phòng + thắng/thua | 🟡 | `RoomController` |
| B7 | HUD (máu, phòng, quái, XP, vàng, boss bar) | 🟡 | `CombatHud`, 14 field cần gán trong Editor |
| B8 | Cổng đăng nhập / đăng ký | 🟡 | `AuthScreen` |
| B9 | Gọi API (6 endpoint) + cookie | 🟡 | `ArtemisApiClient` |
| B10 | Đồng bộ save (debounce, không ghi khi chưa nạp) | 🟡 | `SaveSyncService`, 3 lớp bảo vệ |
| B11 | Nạp dữ liệu từ Resources | 🟡 | `GameDataProvider` |
| B12 | Scene `Bootstrap.unity` | 🟡 | GUID đã vá đúng 7/7; **chưa mở trong Unity** |
| B13 | Prefab đạn / quái | ⬜ | phải tạo trong Editor |
| B14 | Gán tham chiếu UI/component | ⬜ | phải làm trong Editor |
| B15 | EditMode test (NUnit trong Unity) | ⬜ | domain test đã có; bản trong Unity chưa |
| B16 | PlayMode smoke test | ⬜ | |
| B17 | Build WebGL | ⛔ | không có Unity Editor |
| B18 | Build APK Android | ⛔ | không có Unity + chặn xác thực |

## C. Hệ thống chưa port (theo phase)

| Hệ thống | Phase | Trạng thái |
|---|---|---|
| 72 kỹ năng roguelike | P2 | ⬜ |
| 18 hero passive (25+ hiệu ứng) | P2 | ⬜ |
| 4 boss pattern còn lại | P2 | ⬜ |
| 16 loại quái AI đầy đủ | P2 | ⬜ |
| Homing / bounce / ricochet | P2 | ⬜ |
| Status effect (burn/slow/bleed/freeze) | P2 | ⬜ |
| Ultimate (18 NL/giây) | P2 | ⬜ |
| Devil pact | P2 | ⬜ |
| Giao diện trang bị / blacksmith / loadout | P3 | ⬜ |
| Inventory, gacha, chest, wish | P3 | ⬜ |
| Hero star UI, skin UI, resonance | P3 | ⬜ |
| 25 thành tựu | P3 | ⬜ |
| Hành Trình Tân Thủ 8 bước (UI) | P3 | ⬜ |
| Mùa Giải | P4 | ⬜ |
| Bang Hội (NPC) | P4 | ⬜ |
| Vườn Thủ Hộ | P4 | ⬜ |
| Plinko | P4 | ⬜ |
| Bestiary UI | P4 | ⬜ |
| 5 chế độ chơi | P4 | ⬜ |
| Admin dashboard | — | giữ nguyên web, không port |

---

### Việc phải làm để B* chuyển thành ✅

1. Cài Unity 2022.3 LTS + WebGL module. ← **Unity Hub đã cài xong (3.22.5)**, còn
   thiếu: đăng nhập + chọn Editor 2022.3.62f1 + tick WebGL Build Support.
   Xem `INSTALL-UNITY.md`.
2. Mở project, tạo 2 prefab (đạn, quái), gán tham chiếu trong `GameBootstrap`.
3. Dựng Canvas HUD + panel Auth, gán 23 field.
4. Chạy PlayMode: di chuyển, bắn, giết 8 quái, hết phòng, sang phòng 2.
5. Chạy 3 phòng đầu chương 1 với save thật, so HP/ATK quái với bảng ở
   `docs/unity-migration/SOURCE_AUDIT.md`.
6. Build WebGL, phục vụ **cùng origin**, đăng nhập, xác nhận `GET /api/save`
   trả đúng và `PUT` được chấp nhận (revision tăng).

Không bước nào trong 6 bước trên đã được thực hiện.
