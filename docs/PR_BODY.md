# Pull Request: Beginner Journey, Combat Balancing & Dungeon Progression V1

**Branch:** `feature/beginner-journey-v1` → `main`
**So sánh:** https://github.com/PuuGoo/Artemis/compare/main...feature/beginner-journey-v1
**Commit cuối:** `833168e`
**Diff:** 12 files changed, +1991 / −19

## Tạo PR (thủ công — chưa đăng nhập GitHub trong phiên này)

Mở link so sánh ở trên, bấm **"Create pull request"**, dán nội dung bên dưới.
Hoặc chạy:

```bash
gh pr create --base main --head feature/beginner-journey-v1 \
  --title "feat(balance): DEF + CRIT DMG + cân bằng quái/boss + reset phó bản + Beginner Journey" \
  --body-file docs/PR_BODY.md
```

---

## Nội dung PR

### Tóm tắt

Giải quyết đồng thời 5 vấn đề trong MASTER TASK V1: trải nghiệm tân thủ, tính nhất
quán chỉ số, cân bằng chiến đấu, cơ chế reset phó bản, và ảnh hưởng thực tế của
trang bị/kỹ năng lên sức mạnh nhân vật.

**Kiểm thử: 363 PASS / 0 FAIL** trên 8 bộ test.

| Bộ test | Số assertion |
|---|---|
| `combat.test.mjs` | 43 |
| `dungeon-reset.test.mjs` | 74 |
| `checkpoint.test.mjs` | 59 |
| `beginner-journey.test.mjs` | 71 |
| `save-schema.test.mjs` | 38 |
| `devil-encounter.test.mjs` | 21 |
| `integration.test.mjs` | 29 |
| `admin.test.mjs` | 28 |

### Lỗi combat đã sửa

| ID | Mức | Lỗi | Ảnh hưởng |
|---|---|---|---|
| BUG-02 | P0 | `critDmgPct` tính ở 5 nguồn nhưng `damageEnemy()` hardcode `1.85` | Toàn bộ đầu tư CRIT DMG vô hiệu |
| BUG-01 | P0 | Không tồn tại chỉ số DEF | Không thể build phòng thủ |
| BUG-03 | P0 | Quái gây 28 sát thương lên 75.000 HP | Cần ~2700 đòn mới chết — không thể chết ở chương 1 |
| BUG-04 | P0 | Boss chương 1 phòng 10 có 3.147 HP | Chết trong 1 đòn |
| BUG-05 | P1 | `startNewRun()` không reset `particles`/`floatTexts`/timer | Tàn dư trận cũ hiện sang trận mới |
| BUG-06 | P1 | Không có session, bấm "Chơi Lại" 2 lần tạo 2 vòng lặp | Chạy song song hai phiên |
| BUG-07 | P2 | `p.hp -= dmg` không chặn âm | HP có thể xuống số âm lớn |

### Công thức sau chuẩn hoá

**CRIT DMG:**
```
critDmgMult = 1.85 + (talent + artifact + heroStarGlobal + setBonus + skin).critDmgPct
```
Giữ `1.85` làm baseline để không thay đổi sức mạnh hiện có của người chơi.

**DEF (mới):**
```
defFlat      = heroStar×2 + (gearLevel−1)×3 + talent + rune + artifact + (gemHp+affHpFlat)×0.02
defK         = 400 + 120 × chapter.rooms
dmgReduction = min(0.75, defFlat / (defFlat + defK))
```
Đường cong bão hoà thay vì tuyến tính — không bao giờ đạt miễn nhiễm, `K` tăng theo
số phòng của chương.

**Quái/boss:** dùng hai thước đo khác nhau

| Thành phần | Công thức | Mục đích |
|---|---|---|
| HP quái | `playerAtk × atkMul × scale` | TTK ổn định |
| ATK quái | `playerMaxHp × 0.055 × min(2.5,scale) / max(2,count×0.6)` | số đòn chịu được ổn định |
| HP boss | `playerAtk × 30 × scale` | TTB ổn định |
| ATK boss | `playerMaxHp × 0.075 × min(2.5,scale)` | buộc né đòn |

`atkMul`: plant_turret 3.2, skeleton_mage 2.9, còn lại 2.6.

**Số đo thực tế** (tân thủ: ATK 22.718, MaxHP 75.623, ASPD 2.15, CRIT 36%, CritDMG 2.09,
DPS ≈ 68.010/s):

```
TTK quái phòng 1   ≈ 0.87s
TTK quái phòng 14  ≈ 2.3s
TTB boss phòng 5   ≈ 6.5s
TTB boss phòng 10  ≈ 19.9s
TTB boss phòng 15  ≈ 34s
Số đòn boss giết người chơi: 8.7 / 6.1 / 5.2
Số đòn quái thường giết người chơi (8 quái): 26
```

**Tính bất biến:** nhân ATK và MaxHP cùng hệ số → TTK/TTB và số đòn chịu được không
đổi. Được test tự động kiểm chứng. Nghĩa là mặc đồ mạnh hơn không làm game dễ đi —
người chơi chỉ tiến sang chương cao hơn.

### Reset phó bản

Ba hành động được phân biệt:

| Hành động | Ý nghĩa | Chương | Session |
|---|---|---|---|
| Retry | Chơi lại phó bản hiện tại từ màn 1 | giữ | mới |
| Reset | Kết thúc phiên, tạo phiên mới từ màn 1 | chọn lại | mới |
| Continue | Tiếp tục phiên đang tạm dừng | giữ | giữ |

`clearRunState()` xoá **18 array entity + 14 timer + cờ phòng + joystick**.
`stopGameLoop()` gọi trước khi dựng trận mới và trong `finishRun()`.
`SaveState` không bị đụng tới — reset phó bản tuyệt đối không xoá nhân vật.

### Beginner Journey

8 nhiệm vụ, mỗi nhiệm vụ gắn hook vào **sự kiện gameplay thật**:

| ID | Sự kiện | Vị trí hook |
|---|---|---|
| N01 | Bấm "Đã Hiểu" | handler panel |
| N02 | Quái cuối phòng chết | sau `Game.roomCleared = true` |
| N03 | Nhặt 10 vật phẩm | sau `Game.drops.splice` |
| N04 | Mặc trang bị | cuối handler equip |
| N05 | Nâng cấp trang bị | cuối handler upgrade |
| N06 | Chọn kỹ năng trong trận | trong `applyRogueSkill(!silent)` |
| N07 | Thắng Chương 1 | trong `finishRun(isVictory)` |
| N08 | Bấm "Hoàn Tất" | handler panel |

**Phân biệt tài khoản mới/cũ:** dùng `beginnerJourney.startedAt > 0`, **không** dùng
`playerLevel`. `startedAt` chỉ được gán trong nhánh `mode === "register"` của
`cloud.js`. Server whitelist 8 ID, dedupe, và chặn `claimedRewards` chứa bước chưa
hoàn thành.

### Backward compatibility

- Save cũ không có `beginnerJourney` → migration tạo object rỗng `startedAt: 0`
- Tài khoản cũ: **không** kích hoạt tutorial, không reset dữ liệu
- Không thay đổi trang bị/pet/rune/skill/currency/tiến trình phó bản
- Kiểm chứng: đăng nhập `web492972` → 624.148 vàng, 34 món đồ, 40 kills **giữ nguyên**

### Kiểm chứng trên trình duyệt thật

| Kịch bản | Kết quả |
|---|---|
| Tài khoản mới đăng ký | Tutorial kích hoạt, N01 +100 vàng, `currentStep` → N02 |
| Claim N01 lần hai | `false`, vàng không tăng |
| Claim N05 khi chưa xong | `false` |
| Complete ID giả `HACK` | `false` |
| Trong trận | `critDmgMult: 2.09`, `defFlat: 2`, `dmgReduction: 0.0009`, không NaN |
| Reset khi combo 99 / kills 77 / 46 particles | Về phòng 1, tất cả về 0, session id mới |
| Dữ liệu sau reset | vàng 968→968, gems 70→70, túi 1→1, weapon `rusty_bow`→`rusty_bow`, bestRooms 1→1, lifetimeKills 9→9 |
| Tài khoản cũ `web492972` | `isActive: false`, dữ liệu nguyên vẹn, panel báo "chỉ dành cho tài khoản mới" |

### Tài liệu

- `docs/COMBAT_BALANCE_AUDIT.md` — audit toàn bộ, 8 lỗi, trích số dòng
- `docs/COMBAT_FORMULAS.md` — hợp đồng công thức sau chuẩn hoá
- `docs/DUNGEON_RESET_SPEC.md` — ranh giới dữ liệu phiên/nhân vật, 9 kịch bản test
- `docs/BEGINNER_JOURNEY_V1.md` — 8 nhiệm vụ, cơ chế phân biệt tài khoản

### Chưa triển khai

- Hội thoại nhiều bước cho NPC (mỗi bước hiện là một đoạn văn).
- Thông báo đẩy khi hoàn thành nhiệm vụ ngoài màn hình phó bản.
- Khôi phục vị trí quái / đạn đang bay trong checkpoint (phòng được dựng lại từ đầu).

### Continue (checkpoint) — đã bổ sung

Hành động thứ ba trong spec PHẦN 5.2. Chỉ lưu khi phòng sạch quái (`Game.roomCleared`),
chỉ lưu scalar nhân vật (không lưu entity), hết hạn 24h, phải cùng chương.
Retry/Reset xoá checkpoint; Continue dùng rồi xoá.

Kiểm chứng: dọn phòng 1→2→3 → reload trang → checkpoint còn → bấm Continue →
phòng 3, level 3, 2 kỹ năng khôi phục, không NaN.

### Không vi phạm nguyên tắc

1. ✅ Không viết lại toàn bộ game
2. ✅ Không xoá/reset dữ liệu người chơi
3. ✅ Không đổi chỉ số theo cảm tính — mọi con số neo theo công thức + test
4. ✅ Không tạo công thức combat thứ hai (`getComputedStats` vẫn là nguồn duy nhất)
5. ✅ Không hardcode độ khó rải rác — gom vào `setupRoom` với `playerAtk`/`playerMaxHp`
6. ✅ Không mất tương thích save cũ
7. ✅ Không phần thưởng trùng — 2 lớp client + server
8. ✅ Không hỏng trang bị/tiến trình — 74 assertion riêng
9. ✅ Không commit trực tiếp vào `main` — nằm trên branch riêng
10. ✅ PR chỉ tạo sau khi 363/363 test PASS
