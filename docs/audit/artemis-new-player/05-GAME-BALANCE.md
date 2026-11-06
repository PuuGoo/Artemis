# 05 — Đo baseline combat và progression

## Kết quả thực thi

Baseline đọc tại HEAD `3838b40`, Node thực `v24.19.0`. Không chỉnh application/simulator, không browser automation, không HTTP/DB, không ghi save. Chạy `node tools/combat-sim.mjs` **exit 0**, đọc output bằng chương trình: **70 dòng mô phỏng, 27 tiêu chí OK, không tiêu chí FAIL**. Chạy lại riêng simulator cũng exit 0 cùng số dòng/tiêu chí. Đây là mô hình giải tích TTK/hits-to-die, **không phải mô phỏng đầy đủ trận đấu**.

Output hằng số thật:

```text
=== HANG SO DOC TU SOURCE ===
  BASE_ATK=78  BASE_HP=420  roomMul=1+(r-1)*0.13
  Quai: HP=atk*(1.4+depth*1)*scale  ATK=maxHp/(16-depth*10)
  Boss: HP=atk*hits(24/30/40)*chapterMul  ATK=maxHp/(9/7/5)
  DEF K=400+120*rooms cap=0.75
```

Nguồn: `tools/combat-sim.mjs:16-32` regex đọc hằng số, `34-38` hardcode C1/C2/C3; `41-74` tính HP, ATK, DPS và hits; `127-183` kiểm tiêu chí. Số 27 là số dòng `OK` thực đếm bằng regex, không số trận.

## Profile thật mà simulator hiện có

`tools/combat-sim.mjs:76-84` ghi chú chỉ số từng được đo từ browser, nhưng file **hardcode** những số sau; audit này không tái đo browser. Không được gọi chúng là chỉ số tài khoản mới hiện tại.

| Profile có sẵn | ATK | HP | Crit | Crit mult | Attack speed | DEF |
|---|---:|---:|---:|---:|---:|---:|
| 1.Tân thủ common Lv1 | 173 | 751 | 0.22 | 1.85 | 1.94 | 0 |
| 2.Sau HD fine Lv10 | 991 | 3889 | 0.22 | 1.85 | 1.94 | 27 |
| 3.Qua C1 rare Lv30 | 4845 | 16602 | 0.36 | 2.10 | 2.20 | 93 |
| 4.Mid epic Lv60 | 15833 | 50152 | 0.46 | 2.35 | 2.62 | 185 |
| 5.Late mythic Lv100 | 71484 | 224920 | 0.70 | 2.60 | 3.13 | 313 |

**A–G: chưa đo/không có trong simulator baseline.** Không đổi tên năm profile thành bảy profile, không tạo chỉ số “naked/first-weapon” tùy ý, không suy diễn win rate. Cần harness chạy `SaveState` + `getComputedStats()` thật từ zero-state và từng hành động được phép mới có thể bổ sung A–G có bằng chứng.

## Kết quả TTK/hits xuất thật

Các giá trị dưới đây lấy nguyên số đã làm tròn từ simulator. Boss cuối và hits có sai lệch mô hình nêu ngay ở phần sau, không dùng chúng làm số đo runtime.

| Profile | C1 boss P5 TTK/hits | C1 cuối TTK/hits | C2 boss P5 TTK/hits | C2 cuối TTK/hits | C3 boss P5 TTK/hits | C3 cuối TTK/hits |
|---|---|---|---|---|---|---|
| 1 | 10.42s / 9.0 | 17.37s / 5.0 | 15.11s / 9.0 | 25.19s / 5.0 | 20.84s / 9.0 | 39.95s / 5.0 |
| 2 | 10.42s / 9.1 | 17.37s / 5.1 | 15.11s / 9.1 | 25.19s / 5.1 | 20.84s / 9.2 | 39.95s / 5.1 |
| 3 | 7.81s / 9.4 | 13.02s / 5.2 | 11.33s / 9.5 | 18.89s / 5.3 | 15.63s / 9.5 | 29.96s / 5.3 |
| 4 | 5.65s / 9.8 | 9.42s / 5.4 | 8.19s / 9.9 | 13.66s / 5.5 | 11.30s / 10.0 | 21.66s / 5.6 |
| 5 | 3.62s / 10.3 | 6.03s / 5.7 | 5.24s / 10.5 | 8.74s / 5.9 | 7.23s / 10.8 | 13.86s / 6.0 |

Quái C1, profile 1: P1 **0.61s / 16.0 hits**, P8 **1.58s / 11.0 hits**, P14 **2.72s / 6.7 hits**. Profile 5 cùng các phòng: **0.21s / 18.3 hits**, **0.55s / 12.6 hits**, **0.94s / 7.7 hits**.

Hai profile đầu có TTK giống hệt dù ATK/HP chênh nhiều: HP địch neo theo ATK và ATK địch neo theo maxHP làm triệt tiêu tăng trưởng ATK/HP trong tỉ số. Tăng crit/attack speed mới làm TTK giảm trong mô hình này; tăng DEF tăng hits. Đây là hệ quả công thức, không phải đo được người chơi không cảm thấy tiến bộ. Khi runtime lấy snapshot stats tại spawn, skill/upgrade trong run có thể thay đổi tác động sau đó; simulator không diễn tiến các hành động này.

## Sai lệch simulator so với runtime — không bỏ qua dù 27 OK

### 1. Boss cuối bị cưỡng ép vào nhánh sai

`tools/combat-sim.mjs:101-107` thay room cuối bằng **999** để luôn dùng hits=40/đòn chịu=5. `104` chỉ đánh dấu demon ở C3 cuối. Nhưng `public/index.html:27440-27456,27469` chọn boss bằng room thực:

- C1 P15: demon_king, hitsToKill=40, hệ số **1.15**, nhưng simulator bỏ hệ số demon.
- C2 P12: demon_king, hitsToKill=40, hệ số **1.15**, nhưng simulator bỏ hệ số demon.
- C3 P10: **queen**, hitsToKill=**30**, chịu **7** đòn trước DEF; simulator dùng 40 × **1.15**, chịu **5**.

Đối chiếu giải tích LOCAL từ công thức nguồn và đúng các input hardcode (Python đã thực tính; **không phải gameplay thực**):

| Input | DPS tính được | C1 cuối theo công thức runtime | C2 cuối theo công thức runtime | C3 cuối theo công thức runtime |
|---|---:|---:|---:|---:|
| Profile 1 cũ | 398.38094 | 19.98s | 28.96s | 26.06s |
| Profile 5 cũ | 474339.2304 | 6.93s | 10.05s | 9.04s |

Các phép đối chiếu này chưa tính rounding HP, thời gian di chuyển, khoảng ngừng bắn, projectile travel và skill. Mục đích là chứng minh **pass simulator không chứng minh parity**. Cần sửa simulator ở lượt khác; nhiệm vụ này không sửa application/tool hiện hữu.

### 2. Quái thường chỉ là mẫu, số lượng cố định không khớp phòng

`tools/combat-sim.mjs:92-98` lấy vài phòng mẫu và luôn truyền count=3, mặc định type HP multiplier=1. Runtime `public/index.html:27488-27508,27523-27525` dùng count=min(8,3+floor(room/2)), type multiplier khác nhau (ví dụ plant_turret 1.23, skeleton_mage 1.12) và rounding. Vì vậy số hits cuối phòng không đại diện incoming damage thực, TTK quái cũng không thể là room-clear time. Simulator không tính sự chồng lấp đạn của 3–8 quái.

### 3. Tiến trình và hệ thống chưa được mô phỏng

- Game có 6 chương (`public/index.html:4415-4551`); simulator chỉ C1–C3, bỏ C4–C6, season, events và boss AI.
- Fresh zero-state hiện tại không mặc sẵn gear (`public/index.html:9920-9924`, `tests/new-player-zero-state.test.mjs:29-46`); simulator gọi “tân thủ common Lv1” là fixture cũ, không chạy getComputedStats lúc start.
- Không RNG seed, không sample battles, không policy né/bắn, không death loop, revive, heal, room transition, skill roll hoặc cooldown/ultimate. **Không có win rate, số lần chết, thời gian hoàn chương, số trận để unlock hero, hay cảm giác chơi** được đo.
- `tests/stat-curve.test.mjs:97-113` còn có bản sao pipeline BASE_ATK=48/BASE_HP=300 khác nguồn 78/420 (`public/index.html:11639-11640`); không dùng các output của pipeline sao chép đó để điền profile thật.

## Đo progression economy bằng tool có sẵn

`node tools/scroll-economy-sim.mjs` **exit 0**. Tool thuần tính toán; dù console nói “đo production”, audit **không lấy mẫu production mới**. `tools/scroll-economy-sim.mjs:14-27` hardcode vàng/trận **2049**, phòng=15, 3 boss, quái thường bình quân 5.5. Đây là input lịch sử/mô hình, không telemetry được xác minh hôm nay.

Nguồn công thức hiện tại đối chiếu: giá nâng `public/index.html:17195,19721,19849,32502`; scroll cần `18628`; xác suất scroll `28310`. Cần phân biệt drop gear khác ở `28300` (22%) với drop scroll (28%).

Output thật:

| Mốc một slot từ Lv1 | Scroll cần | Vàng cần | Trận(vàng) | Trận(scroll) |
|---|---:|---:|---:|---:|
| Lv5 | 4 | 770 | 0.4 | 0.5 |
| Lv10 | 15 | 2745 | 1.3 | 1.7 |
| Lv15 | 32 | 5845 | 2.9 | 3.7 |
| Lv20 | 55 | 10070 | 4.9 | 6.4 |
| Lv30 | 120 | 21895 | 10.7 | 13.9 |

| Mốc cả 6 slot | Vàng cần | Trận(vàng) | Trận(scroll) |
|---|---:|---:|---:|
| Lv5 | 4620 | 2.3 | 0.5 |
| Lv10 | 16470 | 8.0 | 1.7 |
| Lv15 | 35070 | 17.1 | 3.7 |
| Lv20 | 60420 | 29.5 | 6.4 |

Tool in ~69 quái, ~52.0 scroll/trận, ~8.66 scroll/slot/trận. Đây là kỳ vọng từ giả định average=5.5, không count thực của từng phòng và không phân phối variance lệch slot. Tool kết luận vàng nghẽn khi nâng đều 6 slot; không suy ra người mới thực cần đúng 8 hay 29 trận thắng, vì reward onboarding/events, các lần thua, chi tiêu khác, đồ sở hữu và nguồn thu hiện tại chưa được tích hợp. Thời gian tới upgrade cần đo gameplay thật.

## Kiểm tra hỗ trợ, không chạy suite có DB

| Lệnh đã chạy | Exit | Output thật |
|---|---:|---|
| `node tests/combat.test.mjs` | 0 | 45 PASS / 0 FAIL |
| `node tests/new-player-zero-state.test.mjs` | 0 | 32 PASS / 0 FAIL |
| `node tests/progression-economy.test.mjs` | 0 | 26 PASS / 0 FAIL; reward source: 3050 gold, 155 gems, 7 scroll |
| `node --test tests/audit-auth-economy-baseline.mjs` | 0 | 9 pass; xác nhận các lỗ hổng helper, không chứng minh economy an toàn |

Các test hỗ trợ chủ yếu kiểm source/công thức, không là trận đấu browser. Không chạy npm test do sự cố baseline đọc `.env`/cleanup rate-limit được parent thông báo; xem auth-economy-findings.md. Không suy ra tài khoản/save nào bị thay đổi từ sự cố đó.

## Tiêu chí chấp nhận còn thiếu

1. Chạy fixture A–G qua **cùng getComputedStats và spawn logic** với game, có danh sách hành động tạo fixture, không nhập tay ATK/HP giả định.
2. Khớp boss/type/count/rounding C1–C6 trước khi đặt threshold; test parity sẽ phát hiện lỗi room999/demon hiện tại.
3. Nếu cần win rate: mô phỏng policy có seed, số lần chạy, damage/skill/hồi máu/di chuyển đầy đủ hoặc browser runs ghi telemetry. Không gắn phần trăm chiến thắng cho TTK giải tích.
4. Phân biệt cân bằng gameplay với tính toàn vẹn kinh tế. P0 first-save arbitrary economy và mint theo revision còn mở ở baseline; chart tiến trình đẹp không bảo vệ cloud save.

## Bảng trước/sau bản vá reliability/ownership (không sửa balance)

Các giá trị lấy từ output simulator trước và sau các bản vá local, không phải telemetry trận đấu. Vì không thay công thức combat, không được gắn nhãn đây là kết quả một bản cân bằng mới.

| Scenario có sẵn trong sim | Before TTK | After TTK | Damage Taken | Win Rate | Nhận xét |
|---|---:|---:|---|---|---|
| Profile1 cũ, C1 P1 thường | 0.61s | 0.61s | Chưa đo trận thực | Chưa đo | Fixture historical common Lv1, không phải fresh account |
| Profile2 cũ, C1 P1 thường | 0.61s | 0.61s | Chưa đo trận thực | Chưa đo | ATK cao hơn không đổi TTK do adaptive HP |
| Profile1 cũ, C1 P5 boss | 10.42s | 10.42s | Chưa đo trận thực | Chưa đo | Chưa đổi boss |
| Profile1 cũ, C1 cuối theo sim | 17.37s | 17.37s | Chưa đo trận thực | Chưa đo | Có sai lệch runtime multiplier nêu trên |
| Profile5 cũ, quay lại C1 P1 | 0.21s | 0.21s | Chưa đo trận thực | Chưa đo | Crit/ASPD cao hơn; không chứng minh ATK đơn thuần có ích |

Parent bổ sung browser fresh-source local mock: `getComputedStats()` **baseAtk152, baseHp775**, hero Alex0★, không đồ, gold500/gems50/stamina20; trận đầu có3 quái, loop sống và canvas có pixel. Bằng chứng trong `evidence/local-browser.json`. Đây là profile fresh đo được, nhưng **không đủ** bảy profile A–G, win rate hoặc khả năng thắng tự nhiên cả chương. Các phép gọi hook N01–N08 hay API kill/nhảy phòng chỉ xác minh wiring/persistence, không dùng để đo độ khó.

**Đã sửa:** reliability/persistence/ownership/copy, không sửa enemy scaling/reward. **Mới đề xuất:** simulator parity và campaign scaling độc lập player stats. **Chưa đủ dữ liệu:** đầy đủ A–G, sampled win rate, thời gian progression thực và phân phối reward/chi tiêu.

**Kết luận:** baseline simulator chạy thật và pass tiêu chí nội bộ, nhưng có sai lệch boss cuối rõ ràng và dùng năm profile lịch sử. Chưa đủ bằng chứng xác nhận cân bằng zero-state/A–G hoặc khả năng vượt chương của người mới; không có win rate được chế tạo.
