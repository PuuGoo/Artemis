# Audit auth, kinh tế và kiến trúc — baseline 3838b40

> Báo cáo baseline read-only. Bản vá parent sau đó đã xử lý malformed-cookie, phần nuốt index errors, cloud/revision/season. P0 provenance economy và JWT revocation vẫn mở. Xem `03-BUG-REPORT.md`, `06-REGRESSION.md` cho disposition cuối; source lines/counters dưới đây thuộc khảo sát cũ.

## Phạm vi và độ tin cậy

- Audit cục bộ, chỉ đọc mã ứng dụng trên nhánh `codex/artemis-new-player-hardening`, HEAD khi bắt đầu `3838b40`. Các dòng nguồn bên dưới thuộc baseline này; agent khác đang sửa song song, không coi đây là xác nhận bản vá cuối.
- Không HTTP production, không đăng ký tài khoản, không đọc `.env`, không gọi MongoDB, không commit/push/deploy trong phần việc này. Chỉ import helper thuần và logout không DB. JWT test dùng khóa giả cố định trong tiến trình test, không dùng secret thật.
- Đã đọc README, package.json, package-lock.json, vercel.json, .env.example, auth/API/save/schema/economy/cloud và simulator. Không tìm thấy AGENTS.md trong repo, thư mục cha Desktop hoặc home người dùng.
- Đây là đánh giá nguồn + chứng minh helper LOCAL. Không tuyên bố đã khai thác endpoint production hoặc đã ghi dữ liệu server.

## Sự cố an toàn baseline của lượt audit chung

**Thông tin parent cung cấp, không phải thao tác của subagent này:** `npm test` đã chạy trước khi nhận ra `tests/integration.test.mjs` và `tests/admin.test.mjs` đọc `.env` và gọi `deleteMany` trên `login_attempts`. `.env` tồn tại. Không có cảnh báo cleanup trong log nên **có thể đã xóa bộ đếm rate-limit**; DB đích và hiệu ứng thực tế **chưa xác minh**. Không mở secret/kết nối DB để điều tra. Chưa có bằng chứng sửa account/save người chơi. Parent sẽ thêm guard môi trường cô lập và bỏ đọc `.env` trước lần regression tiếp theo. Không chạy lại `npm test` trong phần việc này.

Parent báo baseline runner: 42 test, 34 pass, 8 fail; nhóm fail gồm admin/integration thiếu local server và bestiary/chapter-select/economy/garden/map-select/season có assertion cũ. Parent cũng báo check exit 0, sim exit 0, npm ci exit 0. Các số này là bằng chứng được chuyển giao, không cộng vào số test LOCAL bên dưới.

## Ranh giới tin cậy / kiến trúc

```text
Người chơi / DevTools (không tin cậy)
  -> public/index.html: luật chơi, reward, RNG, chỉ số, tiến trình
  -> public/cloud.js: buffer bộ nhớ, auth gate, debounce, revision
  -> cookie HttpOnly -> lib/http.js xác thực JWT và tìm player trong DB
  -> api/save.js: schema + delta validators -> MongoDB saves
Admin cookie -> requireAdmin -> allowlist username từ env -> thao tác account/save
```

- Client không có quyền quyết định chủ sở hữu save: `api/save.js:9-14,25-30` lấy player từ session, không nhận playerId từ body. Đây là boundary đúng; chưa test IDOR qua mạng.
- `public/cloud.js:304-331` purge dữ liệu local cũ rồi nạp save vào buffer; `336-375` đẩy toàn snapshot. Buffer/hash/debounce chỉ là cơ chế đồng bộ, không là bảo vệ chống giả mạo.
- Schema giới hạn kiểu, kích cỡ, whitelist (`lib/saveSchema.js:307-318,373-433`), nhưng dữ liệu hợp lệ về kiểu không đồng nghĩa được kiếm hợp lệ.
- Server không sở hữu nhật ký combat/chi tiêu/reward; revision là số lần ghi, không chứng cứ gameplay. Đây là gốc của P0 kinh tế còn mở.
- Kiến trúc tĩnh + serverless + MongoDB đúng README:8-20; `vercel.json:5-11` không build, serve `public`, API 15s/1024MB. `public/index.html` khi đọc dài 2.466.822 byte; logic combat/economy/UI trong một HTML gây khó dùng chung công thức server/simulator.
- Lock cục bộ: bcryptjs 2.4.3 (`package-lock.json:43-44`), jose 6.2.15 (`58-59`), mongodb 7.8.0 (`73-74`). Đây không là kết luận CVE hay phiên bản mới nhất. package.json:8 yêu cầu Node >=20 nhưng lock mongodb yêu cầu >=20.19.0; môi trường thực chạy Node v24.19.0.

## Phát hiện theo ưu tiên

| ID | Ưu tiên | Kết luận baseline | Bằng chứng |
|---|---|---|---|
| ECON-01 | **P0, còn mở** | Lần save đầu chấp nhận số dư 1e12 gold + 1e12 gems do client khai | Helper LOCAL, test 1-2 |
| ECON-02 | **P0 về toàn vẹn economy, còn mở** | Giới hạn delta theo revision vẫn cho tự mint nhiều lần; vật phẩm/chỉ số không có kiểm tra nguồn | Helper LOCAL, test 3-4 |
| SAVE-01 | P1 | Revision không phải compare-and-swap atomic và có thể bỏ qua khi revision không hữu hạn | Đọc nguồn |
| SEASON-01 | P1 | Projection thiếu season làm validator coi save hiện có là season mới | Helper LOCAL test 7 + đọc API |
| AUTH-01 | P1 | Logout/reset-password không thu hồi JWT đã phát | Helper LOCAL test 8 + đọc nguồn |
| DB-01 | P1 | Lỗi tạo unique index bị nuốt, làm yếu giả định uniqueness | Đọc nguồn |
| CLOUD-01 | P1 | Load lỗi có thể bị xem như tài khoản mới và mở khóa save | Đọc nguồn, chưa browser repro |
| AUTH-02 | P2 | Cookie percent-encoding sai ném URIError trước verify | Helper LOCAL test 9 |

### ECON-01 — lần save đầu không được server tạo zero-state

`api/auth/register.js:28-35` chỉ tạo player, không tạo canonical save. `api/save.js:45,60` truyền null khi chưa có save. `lib/economy.js:44-56` cho phép first-save đến hard cap, trong khi `lib/saveSchema.js:379-380` clamp đến cùng 1e12 **trước** validator. Vì vậy raw 1e15 cũng bị clamp thành số dư 1e12 rồi được chấp nhận. Test chứng minh chuỗi `sanitizeSave -> validateEconomyDelta -> validateSeasonDelta`, không có DB.

Output thật: `initial accepted: {"gold":1000000000000,"gems":1000000000000}`. Đây là **helper chấp nhận**, không phải response API. Giải pháp: tạo save canonical server khi register, hoặc kiểm first-save với canonical state do server sở hữu; không thay bằng cap rộng khác. Cần xét transaction/idempotency giữa tạo player/save và retry.

### ECON-02 — delta không là authorization

`lib/economy.js:25-29,58-82` cho +500.000 gold/+20.000 gems mỗi save; không kiểm thời gian hoặc sự kiện tạo reward. Test 4 vòng LOCAL từ zero được `2.000.000 gold / 80.000 gems`. `api/save.js:32` có 60 save/phút/player, nhưng rate-limit không biến số dư giả thành hợp lệ. Không gửi vòng lặp này qua mạng.

`lib/saveSchema.js:381-403,419-433` còn cho stamina, gearLevel, talents, shards, vật phẩm và scrolls rất cao; `validateEconomyDelta` chỉ kiểm gold/gems/goldEarned, `validateSeasonDelta` chỉ kiểm season. Test cho stamina 1e9, gearLevel 999, scroll weapon 1e6 và wins chương 1 là 1e6 qua cả hai validator. Không có bằng chứng server-authoritative combat. Đóng ECON-01 chưa đóng ECON-02. Kiến nghị action API/ledger do server tính giá, cấp thưởng idempotent gắn sự kiện hợp lệ; nếu tiếp tục client-authoritative thì phải công khai giới hạn chống cheat, không gọi là kinh tế đã xác thực.

### SAVE-01 — revision check tách khỏi write

`api/save.js:41-54` nhận Number(revision); thiếu/không hữu hạn thành null và bỏ so sánh. `93-106` update chỉ filter `{ playerId }`, không kèm revision đã đọc. Hai request có cùng revision có thể cùng qua check và last-write-wins. Chưa chạy concurrency DB. Sửa bằng yêu cầu revision nguyên không âm, filter CAS `{playerId, revision: expected}`, kiểm matchedCount, xử lý create tranh chấp unique index riêng; admin grant/set-save cũng cần tránh overwrite concurrent (`api/admin/players.js:116-127,154-162`).

### SEASON-01 — validator đúng hơn dữ liệu đầu vào thực tế

`api/save.js:45` chỉ project revision/gold/gems/lifetimeStats, không `data.season`, rồi gọi season validator ở `78`. `lib/economy.js:159-165` coi không có previous season là first-season. Test full prev `{tokens:0,powerSacrificed:0}` -> next `{tokens:60,powerSacrificed:0.02}` được `{ok:true}`, nhưng cùng next với projection thực tế bị `SEASON_INITIAL_REWARD`. Tác động là có thể chặn tiến trình mùa hợp lệ; không được nói endpoint đã bảo vệ đúng chỉ vì unit test validator pass. Cần đưa previous season đầy đủ vào projection rồi retest endpoint với DB giả/cô lập. Sau đó vẫn chưa xác thực combat: boss HP=0 do client báo là chứng cứ trạng thái, không là chứng cứ trận đấu (`lib/economy.js:259-266`).

### AUTH-01 / AUTH-02

- Bcrypt cost 10 (`lib/auth.js:15-22`), HttpOnly/SameSite=Lax/Secure-production (`56-60`), JWT hết hạn 30 ngày (`4-5,27-38`), generic login error và dummy hash (`api/auth/login.js:27-33`) là guard hiện hữu, không phải proof rate-limit live.
- Logout chỉ xóa cookie (`api/auth/logout.js:6-13`). Test token giả do local signer phát vẫn verify sau logout. Reset mật khẩu đặt `passwordChangedAt` (`api/admin/players.js:131-136`) nhưng `lib/http.js:49-63` không so issued-at/version với field đó. Dùng session version/revocation và kiểm lúc authorize.
- `lib/auth.js:9-10` chỉ buộc secret >=16 ký tự, khác README:64 khuyến nghị >=32. Không đánh giá secret đang triển khai.
- `readSessionToken` decode không catch tại `lib/auth.js:45-52`; cookie `artemis_session=%ZZ` gây URIError LOCAL. Bọc decode và trả unauthenticated, không 500.
- Admin allowlist theo username (`lib/adminAuth.js:7-18`), public register cho chọn username (`api/auth/register.js:14-35`): cần reserve/provision admin trước, dùng immutable playerId/role. Rủi ro chiếm tên chỉ có điều kiện tên allowlist chưa được đăng ký; **không biết env allowlist hay account thật**, không kết luận đã xảy ra.

### DB-01 / CLOUD-01

- `lib/mongo.js:48-58`: từng promise index bị `.catch(e => e)` biến thành fulfilled, sau đó chỉ xét rejected; lỗi index thật có thể bị bỏ qua. Không kiểm tra DB; khuyến nghị chỉ bỏ qua code 85/86 đúng chỗ và fail-closed mọi lỗi khác.
- `public/cloud.js:309-312,325-331`: GET lỗi/exception trả false giống no-save, rồi đặt SAVE_READY=true. Cần phân biệt `new account` với `load error`, không cho ghi khi chưa biết server state. Chưa chứng minh mất save trên browser; đây là nguy cơ đọc nguồn cần endpoint/harness test.

## Lệnh và kết quả LOCAL đã chạy

| Lệnh | Exit | Kết quả |
|---|---:|---|
| `git status --short && git rev-parse --short HEAD && git ls-files` | 0 | lúc bắt đầu sạch; HEAD 3838b40 |
| `node --version && node tools/combat-sim.mjs` | 0 | Node v24.19.0; simulator chi tiết ở 05-GAME-BALANCE.md |
| `node --test tests/audit-auth-economy-baseline.mjs` | 0 | **9 test / 9 pass / 0 fail / 0 skip / 0 todo** |
| `node tools/scroll-economy-sim.mjs` | 0 | mô hình giải tích, không gọi mạng |
| `node tests/progression-economy.test.mjs` | 0 | 26 PASS / 0 FAIL |
| `node tests/new-player-zero-state.test.mjs` | 0 | 32 PASS / 0 FAIL |
| `node tests/combat.test.mjs` | 0 | 45 PASS / 0 FAIL |

**9 pass của audit là characterization xác nhận baseline có lỗ hổng, không phải 9 security invariant an toàn.** File đặt tên `.mjs` ngoài glob `tests/*.test.mjs` để không làm suite chuẩn khẳng định rằng hành vi hở là yêu cầu thiết kế. Sau bản vá test baseline có thể fail có chủ đích; chuyển sang assertion reject tương ứng trong regression security riêng. Không chạy file integration/admin hoặc economy-live.

## Chốt phát hành và phần chưa kiểm

P0 ECON-01/02 chưa được giải quyết trong nhiệm vụ read-only này. Cần parent phân biệt bản vá first-save với bài toán authoritative economy rộng hơn; không kết luận “hết P0” chỉ vì sanitize, unit tests hoặc simulator pass. Chưa kiểm production auth/register/logout/save/admin, revocation trên endpoint, isolation nhiều user, origin/CSRF thực tế, headers IP do platform đảm bảo, DB indexes thực và save concurrency. Không có cleanup tài khoản/item vì subagent không tạo external object. Sự cố baseline rate-limit ở trên chưa xác minh target/effect và phải được giữ trong báo cáo cuối.
