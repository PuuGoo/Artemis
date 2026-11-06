# 04 — Thay đổi local để review

Không commit/push/merge/deploy. Không đổi `package.json`, lockfile, `vercel.json`, reward tables, rarity, enemy formulas hay framework. Dependencies browser chỉ ở scratch, không vào production bundle.

## Nhóm A — Auth / DB / an toàn test

| File / Hàm | Trước | Sau | Test / Risk |
|---|---|---|---|
| `lib/auth.js` / readSessionToken | Cookie percent-encoding sai ném URIError | Chỉ bắt URIError→null, lỗi khác vẫn throw | `auth-cookie-hardening.test.mjs`; token đúng không đổi, không migration JWT |
| `lib/mongo.js` / ensureIndexes | `.catch(e=>e)` làm allSettled không thấy rejected | Giữ rejected để fail-closed lỗi13/91/11000 | `mongo-index-hardening.test.mjs`; 85/86 theo chính sách cũ vẫn cần kiểm actual index |
| `tests/admin.test.mjs`, `integration.test.mjs` | Tự đọc .env và xóa rate-limit trước HTTP | Loại bỏ cleanup/secret reads; DB suites opt-in `ARTEMIS_ISOLATED_TESTS=1` chỉ sau operator xác minh server/DB cô lập | `audit-test-isolation.test.mjs`; chưa chạy được integration không bị báo PASS |

Các suite DB vẫn còn thao tác grant/reset/delete trên fixtures khi được opt-in, nên **không bật** với server dùng DB thật. Lần baseline trước vá đã có nguy cơ external rate-limit cleanup; xem `00-BASELINE.md`.

## Nhóm B — Cloud reliability / API

| File / Hàm | Trước | Sau | Test / Compatibility |
|---|---|---|---|
| `public/cloud.js` / loadCloudSave, boot, form submit | Load lỗi=false=no-save, mở ghi; promise login không return, submit event lặp | Validate contract/HTTP/owner, reject khi lỗi, giữ buffer/khóa game; single submit và catch load error | `cloud-client-reliability.test.mjs`; chỉ no-save đã xác nhận mới về defaults |
| `public/cloud.js` / pushCloudSave | PUT chồng cùng revision, ACK xóa dirty mới, hash ngắn collision | Single-flight, owner binding, strict ACK, giữ dirty mới, so chuỗi payload chính xác | VM runtime tests; không auto-merge conflict/retry vô hạn |
| `api/save.js` / GET, PUT | Owner không nhận diện response; revision bypass/mất update; thiếu season projection | playerId additive, reject owner mismatch, safe integer revision; CAS+matchedCount hoặc insert unique; thêm season projection | `cloud-save-api-reliability.test.mjs`; legacy missing revision GET/PUT cùng effective1; owner optional cho rolling compatibility |

Không viết lại economy validator. CAS không chứng minh index production đúng; không tuyên bố snapshot đủ provenance hoặc offline zero-loss.

## Nhóm C — Beginner persistence / UI / ownership

| File / Hàm | Thay đổi cụ thể | Test / Compatibility |
|---|---|---|
| `lib/saveSchema.js` / sanitizeBeginnerJourney | Giữ `_lootCount` trong0–10; không xóa mission arrays/timestamps | Schema+runtime tests, không áp defaults mới lên account cũ |
| `public/index.html` / SaveState.save | Serialize `starterWeaponGranted` và `season` đã có trong schema | Bán/tiêu thụ starter rồi reload vẫn nhớ cờ; writer→sanitize giữ token/sacrifice/log cũ, legacy thiếu season không bị seed |
| `public/index.html` / BeginnerHooks.onLoot | Save tiến độ dưới10, bỏ count invalid/âm, cap mục tiêu, ngừng counter khi N03 xong | VM serializer→sanitizer→reload và browser local |
| `public/index.html` / grantStarterWeaponIfNeeded | Nhánh đã equipped đóng cờ tương tự bag, giữ item cũ | Không tịch thu item; không thể tự phục dựng cờ lịch sử đã mất |
| `public/index.html` / weapon selection | Không tạo makeStarterItem hoặc thay templateId; chỉ di chuyển item owned đúng archetype | UID/template/rarity/level/socket/affix preserved, item cũ trả về túi |
| `public/index.html` / isHeroOwned và selectors | Giữ Alex0★ và selected legacy; selector gọi guard trước đổi hero; audit toàn assignment paths | Chi tiết bổ sung `hero-paths-findings.md` nếu có; không tăng sao/shards/skin |
| `public/index.html` / BEGINNER_STEPS, toast, journey panel | N04 tên Cung Gỉ Sét, N08 action Hoàn Tất | Không đổi reward/condition |
| `public/index.html` / DEV_CHEATS | Cổng query/storage chỉ trên exact localhost/127.0.0.1/[::1] HTTP(S) hoặc file:// | Runtime33 tests có public-host cases, browser public-host được intercept về fixture local; không phải quyền server |

Pet không có registry entitlement trong thiết kế hiện tại; không tự khóa ba archetype miễn phí hoặc xóa pet cũ. Hero forced-event/trial phải được phân biệt với ownership persistent, không suy từ copy.

## Tests và bằng chứng mới

- `tests/auth-cookie-hardening.test.mjs` — malformed cookie fail-closed + valid contract.
- `tests/mongo-index-hardening.test.mjs` — execute ensureIndexes production với collection stub, không DB.
- `tests/audit-test-isolation.test.mjs` — test safety guard, không .env/cleanup.
- `tests/cloud-client-reliability.test.mjs` — actual cloud source trong VM, response/ACK/concurrency/owner/hash/load contract.
- `tests/cloud-save-api-reliability.test.mjs` — actual route code với auth/DB seams cô lập, sanitizer/validators thật.
- `tests/new-player-gameplay-runtime.test.mjs` — actual hooks/writer/handlers trong VM, mission/reward/item/hero/debug cases.
- `tests/audit-auth-economy-baseline.mjs` — characterization lỗ hổng LOCAL ngoài glob test mặc định; không biến hành vi chấp nhận gian lận thành security invariant. Cookie case đối chiếu source baseline git với patched reader.
- `tools/audit-new-player-browser.mjs` — Chrome fixture local, mock auth/save in-memory nhưng serializer/sanitizer thật, 0 credentials/DB; chỉ cho remote CDN assets GET. `PLAYWRIGHT_MODULE` chỉ tới scratch package.
- Hai assertion legacy trong `cloud-only-save.test.mjs`, `new-player-zero-state.test.mjs` được thay để bảo vệ contract mới đã có runtime regression; không bỏ/skip test fail để ép xanh.
- Tài liệu `docs/audit/BASELINE.md`, `docs/audit/artemis-new-player/*` và bằng chứng `evidence/*` (anonymous production hoặc local fixture, không token/password).

## Chưa thay đổi

Initial state server seed, authoritative reward ledger, toàn bộ economy, session revocation, pet entitlement, balance campaign, simulator parity, migrations/backfills và production config. Các mục chưa sửa được nêu trong `03-BUG-REPORT.md`, không bị che bởi focused PASS.

## Diff review checklist

- Review từng nhóm source độc lập, không patch khổng lồ format toàn file.
- Chạy focused/runtime/browser sau các thay đổi cuối; full suite vẫn giữ failure baseline đã ghi.
- `git diff --check` phải thành công; không secrets/test credentials/raw cookie trace trong artifact.
- Không staged/commit/push; HEAD vẫn baseline cho đến chủ repository quyết định riêng.
