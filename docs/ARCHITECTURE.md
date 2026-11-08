# Kiến trúc Artemis — ranh giới trách nhiệm và lộ trình tách module

## Quyết định

Tái cấu trúc **tăng dần theo subsystem**, không viết lại game, không chuyển framework,
không đổi cân bằng hoặc schema save chỉ để làm đẹp cấu trúc thư mục.
Mỗi lát cắt phải có test hành vi, giữ tương thích tài khoản cũ và đường chạy hiện tại.

Đây là tài liệu kiến trúc hiện hành cho các phần đã tách. Các báo cáo trong `docs/audit/`
là bằng chứng theo thời điểm, không phải mô tả tự động cập nhật của working tree.

## Bản đồ hiện tại

| Vùng | Trách nhiệm | Không nên chứa |
|---|---|---|
| `api/` | Adapter HTTP: auth, body, rate limit, status và response | Công thức combat hoặc luật save lặp lại |
| `lib/save/schema.js` | Whitelist, kiểu dữ liệu, giới hạn snapshot | Truy vấn DB, xác thực cookie |
| `lib/save/policy.js` | Quyền sở hữu server, tương thích client cũ, kiểm tra chuyển trạng thái | HTTP, MongoDB, đọc env, đồng hồ ngầm |
| `lib/save/repository.js` | Projection, đọc snapshot, restore seed, ghi compare-and-set | Quyết định quyền VIP/rune hoặc status HTTP |
| `lib/economy.js`, `lib/economyLedger.js` | Luật kinh tế, ngân sách theo giờ server | Điều phối HTTP |
| `lib/shop/catalog.js`, `lib/shop/rewards.js` | Giá xu VIP, phần thưởng và giới hạn gói; tạo snapshot thưởng | Giá/phần thưởng tự khai từ client hoặc kết nối DB |
| `lib/save/initialState.js` | Sinh dữ liệu chuẩn cho tài khoản mới | Thay thế save hiện có |
| `lib/mongo.js`, `lib/mongoMemory.js` | Kết nối và adapter DB | Luật gameplay |
| `public/cloud.js` | Auth gate, tải và đẩy save, vòng đời kết nối client | Nguồn sự thật của tài nguyên do server cấp |
| `public/combat-*.js`, `boss-attack-patterns.js` | Những module combat đã tách | Mở rộng trực tiếp API hoặc DB |
| `public/js/game/rendering/arena-renderer.js` | Factory renderer Canvas dùng chung game/admin, cache và trạng thái visual theo instance | Combat update, thay schema save, renderer copy-paste |
| `public/js/game/shop/vip-shop.js` | Đọc catalog server, trạng thái nút mua và điều phối view | Tự trừ xu/cộng phần thưởng trên client |
| `public/index.html` | Hiện vẫn chứa UI, phần lớn gameplay, state và rendering | Không coi đây là kiến trúc đích |
| `tests/` | Unit, runtime VM, API với DB bộ nhớ, test opt-in | Credentials hoặc dữ liệu production |
| `tools/` | Kiểm tra source và công cụ vận hành độc lập | Logic nghiệp vụ được copy để thay implementation thật |

Không áp một cấu trúc nhiều tầng cho mọi file nhỏ. Chỉ thêm boundary khi nó giảm
phụ thuộc, cô lập side effect hoặc cho phép test logic thật mà không mở app/DB.

### Thư mục đã tổ chức — đợt 1

```text
lib/save/
  README.md           # trách nhiệm và quy tắc phụ thuộc
  schema.js           # validate/normalize snapshot
  initialState.js     # seed tân thủ do server cấp
  policy.js           # luật chuyển trạng thái
  repository.js       # projection và CAS
public/js/game/rendering/
  README.md
  arena-renderer.js    # một factory, instance riêng game/admin
tests/
  README.md
  save/               # schema, writer round-trip, policy, repository, architecture
  rendering/          # factory renderer và loader
tools/run-tests.mjs    # tìm test đệ quy, không chạy audit hoặc fixtures
```

Đã xoá implementation ở đường dẫn phẳng cũ và cập nhật caller/import/script URL.
Chưa di chuyển auth, economy, database và các module combat/UI còn lại. Không tạo
thư mục rỗng cho các subsystem chưa chuyển; không thêm bản sao hoặc barrel export.
Các endpoint API và đường dẫn asset không đổi. Tài liệu audit cũ giữ nguyên tham
chiếu lịch sử, không thay đường dẫn/số dòng để biến chúng thành báo cáo hiện hành.

## Lát cắt đã thực hiện: lưu tiến trình

```text
Request
  -> api/save.js: auth / rate limit / body / account binding
  -> saveSchema: sanitize snapshot, kiểm giới hạn
  -> saveRepository.readForValidation: đọc snapshot + ledger cần cho policy
  -> api/save.js: so expected revision
  -> savePolicy.prepareSaveData: quyền sở hữu + tương thích client cũ
  -> savePolicy.validateSaveTransition: delta -> budget -> season
  -> saveRepository.commit: CAS hoặc unique first insert
  -> api/save.js: HTTP response
```

### Hợp đồng domain

- `prepareSaveData({ sanitizedData, incomingData, previousData, nowMs })` nhận dữ
  liệu **đã sanitize**, trả object mới; không sửa hoặc giữ tham chiếu mutable tới input.
- VIP coins/passes, Aurocite và rune inventory/entitlements lấy từ snapshot server. Client
  được chọn rune đang sở hữu, không được tự cấp rune.
- Các field `gameMode`, `modeBest`, `guild`, `garden`, `plinko` được giữ lại khi client
  cũ không gửi key. Gửi `null` rõ ràng vẫn giữ nghĩa xoá theo sanitizer hiện hành.
- `validateSaveTransition({ previous, data, nowMs })` trả `{ ok: true, ledger }` hoặc
  `{ ok: false, error }`. `error` là dữ liệu domain, không phải `Response`.
- Luôn kiểm delta, budget, season đúng thứ tự cũ. Không trả ledger để ghi khi một
  luật từ chối. Rate cap không phải chứng minh từng hành động gameplay hợp lệ.
- Route lấy một mốc thời gian server rồi truyền cho VIP và budget. Test được dùng
  clock cố định, không phụ thuộc thời gian thực hoặc tự sửa `Date.now`.

### Hợp đồng persistence

- `createSaveRepository(collection)` nhận collection từ caller. Không tự mở Mongo,
  đọc `.env`, hoặc phụ thuộc singleton DB trong repository.
- `readForValidation` sở hữu projection. Khi policy cần field mới, phải cập nhật
  projection **và test projection** trong cùng thay đổi.
- `commit(existing, snapshot)` trả boolean: `true` đã ghi; `false` xung đột.
  Lỗi DB khác unique-key không được nuốt thành thành công hoặc conflict giả.
- Save có sẵn dùng `{ playerId, revision }` và `upsert: false`. Document legacy
  chưa có revision dùng `$exists: false`, giữ cùng ý nghĩa revision như trước.
- First insert dựa trên unique `playerId`. Restore canonical seed đọc lại nếu
  request khác đã tạo trước, không ghi đè snapshot vừa được khôi phục.
- Repository không quyết định status `409`/`422`; route làm việc đó.

### Những gì không đổi

Endpoint, body, status lỗi, seed tân thủ, schema save, thứ tự auth/body validation,
revision, cơ chế CAS, luật tài nguyên và quyền sở hữu server được giữ nguyên.
Không chạy migration, không truy cập production, không cấp lại tài nguyên.

## Lát cắt cửa hàng xu VIP

28 gói tiền đ được chuyển theo tỷ lệ đã duyệt: 1 xu VIP = 1.000đ giá cũ.
Xem bảng trách nhiệm và hợp đồng tại `lib/shop/README.md`.

```text
UI mở cửa hàng -> GET /api/shop -> giá/thưởng/lượt còn lại từ catalog server
UI mua -> cloud flush save -> POST /api/shop (owner/revision/requestId)
       -> auth / body / rate limit / kiểm tiền và giới hạn
       -> rewards tạo snapshot -> CAS trừ xu + cấp thưởng + receipt + giới hạn
       -> cloud tải snapshot server và dựng lại nhân vật -> render số dư thật
```

Ngày/tuần/tháng dùng giờ Việt Nam; receipt và giới hạn ở ngoài snapshot client.
Mất phản hồi giữ nguyên mã giao dịch để retry, không tự cộng thưởng hoặc gửi mã
mới. Aurocite được lưu canonical và bảo vệ qua save policy/projection như xu VIP.
UI chỉ tải catalog khi mở tab cửa hàng, không thêm request vào game/battle bootstrap.
Các cửa hàng dùng vàng/kim cương và giá thẻ đặc quyền có sẵn không đổi.

## Kiểm tra và cách thêm code

```bash
npm run check
npm test

# Khi chỉ sửa save: vòng kiểm tra nhanh trước full suite
node --max-old-space-size=192 --test --test-concurrency=1 tests/save/*.test.mjs tests/cloud-save-api-reliability.test.mjs tests/canonical-new-account.test.mjs
```

- `npm run check` tự tìm source JS/MJS/HTML trong các thư mục code, không dùng
  danh sách tám file cố định. Bỏ qua dependency, asset và symlink.
- Browser `.js` được parse như classic script; file Node kiểm bằng `node --check`.
  Script nhúng trong HTML cũng được kiểm, giữ tên file và dòng cho lỗi classic script;
  JSON/importmap không bị coi là JavaScript. Inline module được parse theo ESM.
- Đây là syntax gate, **không** typecheck, browser E2E, kiểm URL script hoặc kiểm
  tương đương hình ảnh. Công cụ không execute/import code ứng dụng và không mở DB.
- `npm test` dùng `tools/run-tests.mjs` tìm đệ quy chỉ `*.test.mjs` trong `tests/`,
  giữ các test root và thư mục con, bỏ qua fixtures/node_modules/symlink. Không
  tự chạy `audit-*.mjs`, tool live hoặc file chỉ có dữ liệu.
- Test process chạy từng file tuần tự, heap Node giới hạn 256 MB để tránh mở hàng
  chục process cùng lúc trên máy RAM thấp. Đây không phải giới hạn tổng RAM của OS.
- Unit policy không cần DB. Repository test dùng backend bộ nhớ hiện có. Route test
  kiểm luồng thật với dependency thật, hoặc VM seam cho race có chủ đích.
- `tests/save/architecture.test.mjs` giữ boundary mới không trượt ngược về route
  chứa truy vấn Mongo và domain chứa HTTP/env.
- Test MongoDB thật vẫn cần môi trường opt-in; test bộ nhớ không chứng nhận index
  đã được triển khai đúng trên MongoDB production.

## Lát cắt đã thực hiện: renderer dùng chung game/admin

- `public/js/game/rendering/arena-renderer.js` đăng ký `globalThis.ArtemisArenaRenderer.create()`;
  nạp script chỉ khai báo factory, không truy cập DOM hoặc tự mở animation loop.
- Game nạp classic script đồng bộ tại vị trí renderer cũ, rồi tạo `const ArenaV2`.
  `drawMonsterSprite` và các caller khác giữ nguyên API. Không đổi sang `type=module`
  vì bootstrap hiện tại vẫn dùng lexical binding của classic script.
- Admin lazy-load cùng file, tạo instance ở `window.AdminCampaignArenaV2` sau
  `script.onload`; loader vẫn single-flight. Xoá file renderer admin trùng lặp.
- Mỗi `create()` có `Game`, cache sàn, biome, HUD key và WeakMap visual riêng.
  Không chia sẻ singleton renderer giữa preview và trận đang chạy.
- Giữ nguyên thân thuật toán renderer khi extraction. `index.html` giảm 1.948 dòng;
  phần code game ngoài block thay thế không đổi trong lượt tách này.
- Đây chưa phải renderer thuần hoàn toàn: vẫn dùng `document` và các hook optional
  `ArenaGround/MonsterArt/StatusVFX/SkillCombatVfx/ArtemisZodiacBosses` như trước;
  hiệu ứng trùm đáp xuống vẫn cập nhật screen-shake trong Game. Không đổi các hành vi
  đó cùng lúc với việc di chuyển source.
- Test vẽ và validator biome đọc trực tiếp module production mới, không ghép source
  trở lại HTML hoặc giữ một bản copy chỉ để assertion cũ tiếp tục xanh.

### Bằng chứng kiểm tra renderer

`tests/rendering/arena-renderer.test.mjs` kiểm create không đụng DOM, API cũ, cache/biome độc
lập và admin single-flight loader. `tests/admin-campaign.test.mjs` gọi renderer thật
qua Canvas spy trên mọi chương/phòng. `tools/validate-biomes.mjs` đối chiếu registry
trong module renderer với các loại quái spawn trong HTML.

`tools/verify-arena-renderer-browser.mjs` dùng Chrome thật, một browser/page đi lần
lượt qua game và trang admin thật, HTTP local **mock auth/save/admin**. Đã kiểm nạp
script 200, vào trận từ UI, loop chạy, canvas game/admin không rỗng, factory độc lập,
không đổi SaveState khi tạo preview, không lỗi page hoặc request local. Browser/server
được đóng trong `finally`. Kết quả: `docs/arena-renderer-evidence/verification.json`.
Đây không phải kiểm chứng production, MongoDB thật hoặc chơi tự nhiên vượt chương.

```bash
node --max-old-space-size=192 --test --test-concurrency=1 tests/rendering/arena-renderer.test.mjs tests/admin-campaign.test.mjs
node tools/validate-biomes.mjs
# Chỉ chạy khi đủ RAM và đã có playwright-core; không cài thêm vào project
PLAYWRIGHT_MODULE="<duong-dan-playwright-core/index.mjs>" node tools/verify-arena-renderer-browser.mjs
```

## Lộ trình frontend tiếp theo — CHƯA thực hiện

Ưu tiên theo mức giảm coupling và khả năng kiểm chứng, không theo số dòng tách ra:

1. **SaveState và bootstrap.** Tách default/normalize/migration/serialize khỏi UI,
   giữ cloud buffer contract và thứ tự auth gate. Gate: writer -> sanitizer -> load
   round-trip, account switch, lỗi tải save, checkpoint và client cũ.
2. **Combat runtime.** Tách simulation cập nhật trạng thái khỏi canvas/audio/HUD;
   nhận RNG/clock/effect callbacks rõ ràng. Gate: native damage vectors, crit/shield,
   DoT theo dt, chết đúng một lần, reset room/run, giữ kết quả mô phỏng.
3. **Feature UI theo subsystem.** Hero/gear, rune, season, garden/guild là module
   riêng; UI gọi action rõ ràng thay vì sửa state rải rác. Gate: ownership, chi phí,
   persistence và click-flow cho từng subsystem.

Không đổi cùng lúc vị trí source, thuật toán và schema. Nhiều test/tool hiện đọc
`public/index.html` bằng marker; khi di chuyển source phải sửa chúng để đọc đúng
module production, không nhét bản sao source vào HTML chỉ để test tiếp tục xanh.
Không thêm event bus, service locator hoặc container DI toàn cục để che dependency.
