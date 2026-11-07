# 06 — Regression cuối

Ngày chạy: 07/11/2026 (UTC+07:00). Nhánh `codex/artemis-new-player-hardening`. Node `v24.19.0`, npm `11.17.0`. Không chạy DB thật, không gọi API ghi production.

> **Cập nhật sau Đợt 1 + 2 + 3** (xem `11-NEW-PLAYER-INIT-AND-PERSISTENCE.md`,
> `12-E2E-NEW-PLAYER.md`): tổng suite nay là **179 test — 171 pass / 6 fail / 2 skip**.
> Suite mới đều pass: `canonical-new-account` (15), `subsystem-save-persistence` (12),
> `subsystem-save-roundtrip` (1), `beginner-journey-decisions` (4). Thêm
> `tools/e2e-new-player.mjs`: **17/17 PASS** trên server thật + DB bộ nhớ.
> Sáu failure vẫn là đúng sáu suite baseline ở mục 2, không phát sinh regression mới.

Số liệu dưới đây là **output thật** của lần chạy cuối, sau khi tất cả thay đổi local đã áp. Log giữ ngoài repo: `artemis-regression-test-final.log`, `artemis-regression-sim-final.log`, `artemis-new-suites.log`, `artemis-local-browser.log`, `artemis-head-six.log` trong `C:/Users/PuuGoo/AppData/Local/hermes/cache/scratch/`.

## 1. Lệnh và exit code

| Lệnh | Exit | Kết quả |
|---|---:|---|
| `npm run check` | 0 | 7 module server/cloud parse OK |
| `npm test` | 1 | 147 test entry: **139 pass / 6 fail / 2 skip** (trước Đợt 1/2) |
| `node --test tests/*.test.mjs` | 1 | **175 test — 167 pass / 6 fail / 2 skip** (sau Đợt 1/2) |
| `npm run sim` | 0 | Simulator chạy, tiêu chí nội bộ OK (sai lệch parity ở `05-GAME-BALANCE.md`) |
| `node --test <11 suite mới + 2 suite isolation>` | 0 | **105 pass / 0 fail / 2 skip** (107 entry) |
| `node tools/audit-new-player-browser.mjs` | 0 | Chrome thật, fixture local: **15/15 PASS**, `errors=[]` |
| `git diff --check` | 0 | Không whitespace error |

## 2. Sáu failure còn lại — tất cả là baseline, đã đối chứng bằng worktree sạch

Tạo worktree detached tại đúng `3838b40` (`git worktree add --detach … 3838b40`), chạy nguyên 6 file trên code gốc. Số check trùng khít với working tree sau thay đổi:

| Suite | HEAD 3838b40 | Working tree | Nguyên nhân (nội dung cũ, không liên quan patch) |
|---|---|---|---|
| `bestiary.test.mjs` | 49 pass / 7 fail | 49 / 7 | Kỳ vọng 12 loại, dữ liệu có 20 |
| `chapter-select.test.mjs` | 46 / 10 | 46 / 10 | Kỳ vọng 4 chương, dữ liệu có 6 |
| `economy.test.mjs` | 36 / 1 | 36 / 1 | Assertion đọc chuỗi import `validateEconomyDelta` |
| `garden.test.mjs` | 57 / 3 | 57 / 3 | Test tìm `#gardenContent`/hook tab cũ |
| `map-select.test.mjs` | 124 / 3 | 124 / 3 | Metadata `mapAsset/mapRegion/mapTagline` |
| `season.test.mjs` | 56 / 1 | 56 / 1 | Nhãn nút cửa hàng |

Không sửa expected/skip để ép xanh. Đây là nợ test baseline chủ repo cần xử lý riêng.

## 3. Khác baseline: 8 fail → 6 fail + 2 skip

Baseline ban đầu fail `admin.test.mjs` và `integration.test.mjs` vì `ECONNREFUSED 127.0.0.1:3000` (không có dev server) — đồng thời hai file đó tự đọc `.env` và xóa rate-limit trước khi gọi. Bản vá loại bỏ hoàn toàn việc đọc secret/cleanup DB và biến chúng thành suite **opt-in**; runner báo đúng `2 skipped` kèm lý do BLOCKED, không tính là pass. Vì vậy tổng fail giảm 8→6 mà không che lỗi.

## 4. Coverage mới (chạy thật)

| Nhóm | Suite | Số case |
|---|---|---:|
| Cloud client | `cloud-client-reliability.test.mjs` | 11 |
| Cloud API/revision | `cloud-save-api-reliability.test.mjs` | 8 |
| Beginner/ownership/pet/debug | `new-player-gameplay-runtime.test.mjs` | 33 |
| Mọi đường chọn hero | `hero-selection-ownership.test.mjs` | 25 |
| Cookie phiên | `auth-cookie-hardening.test.mjs` | 3 |
| Index Mongo | `mongo-index-hardening.test.mjs` | 4 |
| Season round-trip writer | `save-writer-roundtrip.test.mjs` | 2 |
| An toàn test harness | `audit-test-isolation.test.mjs` | 4 |
| Schema hostile input | `schema-hostile-input.test.mjs` | 5 |
| Khởi tạo tài khoản mới (server seed, restore, revision 0, carry-forward) | `canonical-new-account.test.mjs` | 15 |
| Persistence 5 hệ (writer, sanitizer, dữ liệu bẩn, legacy absence) | `subsystem-save-persistence.test.mjs` | 12 |
| Round-trip writer→sanitizer→load thật của 5 hệ | `subsystem-save-roundtrip.test.mjs` | 1 |
| Admin/integration | 2 suite | 2 skip có lý do |

RED→GREEN đã quan sát cho từng nhóm: cloud load fail (6/6 sau khi đỏ), login single-flight, owner binding, hash collision, revision contract, owner mismatch, season projection, `_lootCount`, starter flag, free weapon, hero ownership (6 pass/19 fail trên HEAD → 25/25), dev gate public-host (4 fail → 33/33), cookie (1 fail → 3/3), index error (3 fail → 4/4), writer season (1 fail → 2/2).

## 5. Browser — hai cấp bằng chứng khác nhau

| Bằng chứng | Môi trường | Kết quả | Không được suy ra |
|---|---|---|---|
| `evidence/local-browser.json` | Chrome thật, source local, **mock auth/save in-memory**, sanitizer thật | 15/15 PASS, 0 JS error: INIT 1/500/50/20, gear rỗng, Alex0★; hero gate 4 UI; N01–N08 claim/duplicate/reload; `_lootCount` 7→7; A/B isolation; trận đầu running/unpaused/3 địch/canvas có pixel; public-host dev gate bị chặn | Không chứng minh Mongo durability, JWT lifecycle, đăng ký production |
| `evidence/production-anonymous.json` | Production thật, GET-only, không account | Trang 200, auth gate, register form, validation rỗng, `errors=[]` | **Chưa tạo account production**, chưa kiểm reload/login lại |
| `evidence/production-*.png` | Production, màn auth | Login + register form | Không phải bằng chứng gameplay |

## 6. Chưa kiểm thử được

- Mongo thật: CAS/unique index/legacy doc/race nhiều tab (2 suite DB đang skip đúng chủ đích).
- Đăng ký + hành trình tân thủ trên production bằng account thật (vault không có credential Artemis; không yêu cầu mật khẩu qua chat).
- Logout → login lại, session hết hạn, multi-tab cookie switch.
- Offline/crash trước ACK, conflict recovery.
- ~~`gameMode/modeBest/guild/garden/plinko` persistence~~ → đã có writer + schema + round-trip
  trong VM; **chưa** kiểm trên browser thật hoặc Mongo thật.
- Profile A–G, win rate, thời gian vượt chương.
- Index `uniq_player` options thực tế trên deployment.

## 7. Kết luận

Focused + browser-fixture coverage xanh và không có regression do patch (6 failure trùng khít HEAD). Nhưng **không đạt READY**: còn P0 economy provenance (ART-014/015) và các blocker DB/production trong `07-RELEASE-READINESS.md`. Báo cáo này không thay thế integration test trên DB cô lập.
