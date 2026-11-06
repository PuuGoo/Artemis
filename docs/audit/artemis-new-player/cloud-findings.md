# Cloud-save/API audit — Artemis new-player hardening

> Ghi nhận theo workstream, trước các bản vá parent cuối. `03-BUG-REPORT.md` và `06-REGRESSION.md` là disposition/kết quả cuối: parent đã cập nhật assertion cloud legacy và sửa việc nuốt lỗi index trong `lib/mongo.js` bằng test RED→GREEN. Chưa kiểm index thật hoặc thay chính sách85/86. Các counters dưới đây là lịch sử lần chạy, không phải final suite.

## Phạm vi và an toàn

- Baseline kiểm tra: branch `codex/artemis-new-player-hardening`, SHA `3838b40`, ban đầu working tree sạch.
- Chỉ sửa production `public/cloud.js`, `api/save.js`; thêm hai test chuyên biệt bên dưới và báo cáo này. Không sửa `lib/saveSchema.js`, `public/index.html`, hoặc test cũ. Working tree hiện có chỉnh sửa song song của parent ở những file đó.
- Không đọc `.env`, không truy cập secrets, không kết nối production/MongoDB, không khởi động server có DB, không commit/push/deploy.
- Đã đọc toàn bộ hai file production, `lib/http.js`, `lib/mongo.js`, `lib/auth.js`, `lib/economy.js`, `lib/saveSchema.js`, các test cloud/schema/economy/season hiện có, và consumer `SaveState.load()` thực tế. Test integration ban đầu có đọc `.env` và xóa rate-limit DB: KHÔNG chạy phiên bản đó. Parent đã thêm opt-in isolation trước lần full-suite dưới đây.

## Các lỗi đã tái hiện trước khi vá

### 1. Lỗi tải bị coi là tài khoản chưa có save

- Cũ: HTTP 500, mất mạng, JSON hỏng, response thiếu contract đều về `false`, xóa buffer rồi đặt `__ARTEMIS_SAVE_READY=true`; boot vẫn gọi game. Tái hiện: game start đếm được 1 thay vì 0.
- Vá: chỉ `hasSave:false,data:null,revision:0` đã xác nhận mới được dùng làm tài khoản mới. Các lỗi reject, giữ write-lock, không vào game, không xóa buffer chưa lưu. Kiểm tra HTTP status, boolean hasSave, safe integer revision và object snapshot.
- Bổ sung tái hiện `{}` và `hasSave:true,revision:0`: trước vá đều vào game; nay chặn. Test lấy nguyên method `SaveState.load()` từ HTML hiện tại cho thấy `{}` kích hoạt migration `save()` với giá trị đang có trong state, chứ không chứng minh được một save cũ hợp lệ. Vì sanitizer luôn tạo snapshot nhiều field, từ chối object rỗng là kiểm tra hẹp, không áp schema mới lên dữ liệu GET.
- Không broad sanitize/clamp snapshot GET, không loại unknown legacy fields. Chưa áp signature chặt hơn lên snapshot có field nhưng sai kiểu: chưa có compatibility contract đủ chắc.

### 2. Revision chỉ kiểm tra trước write, không atomic

- Cũ: hai request đọc cùng revision đều `200`, ghi đè nhau, revision chỉ tăng một lần. Hai first-save cũng đều `200` và ghi đè nhau.
- Vá: existing save dùng compare-and-set `{playerId,revision}` và `upsert:false`; `matchedCount!==1` trả 409 với revision đọc lại. First-save dùng `insertOne`; unique-player duplicate 11000 trả 409, không cập nhật save thắng cuộc.
- Không có rewrite/migration tài liệu DB. Bảo toàn `createdAt` trên update; schema/economy validators giữ nguyên.
- Bắt buộc revision là số nguyên an toàn không âm. Missing/NaN/null/string/boolean/fraction/negative không còn bỏ qua revision guard. Client hiện tại luôn gửi revision dạng number. API fail-closed có thể làm client ngoài repo không gửi revision phải tải lại/cập nhật; không tự suy revision để cho ghi đè.
- Save legacy thiếu revision: GET đang trả 1, PUT cũ so với 0 gây 409 vô tận. Nay PUT dùng cùng effective revision 1 và CAS `$exists:false`, sau đó nâng lên 2. Không sửa dữ liệu save cũ.

### 3. Thiếu season trong projection

- Cũ: projection chỉ đọc gold/gems/lifetimeStats; validator tưởng season chưa có. Save có tokens 120 và sacrifice .04 hợp lệ bị 422 `SEASON_INITIAL_REWARD`.
- Vá một field projection `"data.season":1`. Regression giữ nguyên season, số dư gold cũ 9.000.000 và output sanitizer thật.

### 4. Cross-account khi cookie đổi giữa các tab

- Cũ: snapshot B có revision trùng A vẫn có thể được lưu bằng cookie A; GET không nhận diện owner.
- Vá additive: GET trả `playerId` cả khi có/chưa có save. Client so owner GET với auth identity nếu field có mặt và gửi owner trong PUT. API trả 409 `ACCOUNT_CHANGED` nếu owner gửi lên khác player hiện tại.
- `playerId` optional cho client cũ để tránh phá rolling compatibility. Vì thế tab/client cũ chưa nâng cấp vẫn không có bảo vệ owner binding này; không tuyên bố đã đóng mọi tình huống cross-account ở các bản cũ.

### 5. Client PUT trùng revision và xóa nhầm dirty

- Cũ: trong lúc một PUT chưa xong, một PUT mới gửi cùng revision; ACK đầu đặt dirty=false ngay cả khi buffer mới hơn.
- Vá: single-flight PUT, chỉ gửi khi load đã xác nhận, dirty tính từ payload đang được ACK so với buffer hiện tại. Nếu vẫn có thay đổi, debounce tiếp với revision vừa nhận.
- Chỉ nhận ACK khi HTTP thành công và revision bằng revision kế tiếp. HTTP 500 có JSON `ok:true`, thiếu revision hoặc revision cũ không còn xóa dirty.

### 6. Hash ngắn collision làm bỏ qua save thật

- Tái hiện `playerName:'Aa'` và `'B@'` trong cùng snapshot: khác payload nhưng hash DJB2 32-bit trùng; cũ không gửi PUT.
- Vá: bỏ qua write chỉ khi chuỗi payload bằng chính xác payload đã ACK; hash giữ lại cho debug/compatibility.

### 7. Login submit và promise chain

- Cũ: submit event liên tiếp gọi login hai lần mặc dù button disabled. `.then(loadCloudSave...)` không được return nên load reject không tới form catch, không bật lại nút retry.
- Regression đã thấy 2 login thay vì 1 và unhandled load rejection.
- Vá: guard disabled trong listener và return promise tải save. Load thất bại giữ khóa game và nút form có thể thử lại.

## Kiểm chứng TDD và lệnh

Tất cả lệnh chạy local, workdir `C:/Users/PuuGoo/Desktop/Artemis`. Test mới execute source production thật trong Node VM; API thay các import seam Mongo/auth/HTTP bằng fixture cô lập, nhưng dùng sanitizer và economy validators thật. Không mock toàn bộ thuật toán route. Fake DB thực thi projection, CAS, unique-key insert và lưu tài liệu để đọc lại/assert sau write. Đây KHÔNG phải kiểm chứng trên MongoDB thật.

| Lệnh/giai đoạn | Kết quả thực tế |
|---|---|
| `node --test tests/cloud-only-save.test.mjs tests/save-schema.test.mjs tests/economy.test.mjs tests/season-economy.test.mjs tests/season-save-schema.test.mjs` baseline trước mọi edit | Node runner 10 tests: 9 pass, 1 fail. `economy.test.mjs` fail assertion import-string đã có từ baseline; cloud 41/41 assertions, schema 38/38, season schema 19/19. |
| `node --test tests/cloud-save-api-reliability.test.mjs` season RED → GREEN | 0/1 pass → 1/1 pass. |
| Cùng lệnh, concurrency RED | 1 pass / 2 fail; cả hai race trả `[200,200]` thay vì `[200,409]`. |
| Sau CAS | Race pass; một test snapshot bị nhiễu bởi thay đổi schema song song `_lootCount` của parent. Assertion điều chỉnh so với output sanitizer thật thay vì giả định sanitizer idempotent. Không sửa schema. |
| Cùng lệnh, revision contract RED → GREEN | 3 pass / 3 fail → 6/6 pass. |
| Cùng lệnh, owner-binding RED → GREEN | 6 pass / 2 fail → 8/8 pass. |
| `node --test tests/cloud-client-reliability.test.mjs` load-failure RED → GREEN | 5 assertion subtests + container fail vì game vẫn boot → 6/6 pass. Lần dựng harness đầu bị lỗi fetch stub không trả Promise; sửa harness, chạy lại và quan sát failure đúng trước khi sửa production. |
| Cùng lệnh, login RED → GREEN | 6 pass / 2 fail → 8/8 pass. |
| Cùng lệnh, single-flight RED → GREEN | 8 pass / 1 fail → 9/9 pass. |
| Cùng lệnh, client owner RED → GREEN | 9 pass / 2 fail → 11/11 pass. |
| Cùng lệnh, collision + invalid ACK RED | 11 pass / 5 fail (gồm parent test container). |
| Sau collision + ACK patch, hai suite mới | 24/24 pass. |
| Thêm characterization no-save, failed-reload và `{}`/revision0 RED | 17 pass / 3 fail; hai payload bất hợp lệ vẫn boot. |
| `node --test tests/cloud-client-reliability.test.mjs tests/cloud-save-api-reliability.test.mjs` cuối | **29/29 pass**, 0 fail/skip. |
| `npm run check` | Exit 0, syntax checks cả cloud/API và shared libs. |
| `ARTEMIS_ISOLATED_TESTS=0 npm test` | **94 tests: 83 pass, 9 fail, 2 skip**; không chạy hai suite DB opt-in. Log: `C:/Users/PuuGoo/AppData/Local/hermes/cache/scratch/artemis-cloud-regression.log`. |

### Full-suite blockers cần parent xử lý/đối chiếu baseline

- `cloud-only-save.test.mjs`: 40 pass / 1 fail assertion nguồn cũ “catch xóa buffer”. Đây là expectation không còn an toàn: failure phải giữ unsent buffer và khóa game, không biến thành no-save. Không sửa test cũ vì ngoài ownership; đề nghị parent thay assertion bằng runtime regression mới hoặc assert khóa ghi/reject.
- `economy.test.mjs`: import-string literal không chấp nhận named import có thêm `validateSeasonDelta`; lỗi baseline, không phải regression cloud patch.
- Các file fail còn lại trong lần full run: `bestiary`, `chapter-select`, `garden`, `map-select`, `new-player-zero-state`, `save-schema`, `season`. Không quy tất cả là baseline vì parent đang sửa HTML/schema song song; parent cần so kết quả baseline riêng. Không đụng các file này.

## Giới hạn / rủi ro chưa tự ý đổi

1. Không được phép kiểm tra DB thật, nên không xác minh index `uniq_player` hiện hữu trên deployment. First-insert concurrency dựa vào unique-playerId index đã khai báo trong `lib/mongo.js`. Ngoài scope: `ensureIndexes()` bọc promise `.catch(e=>e)` rồi dùng `allSettled`, có thể nuốt lỗi tạo index; cần audit riêng, không khẳng định production index đã bảo đảm.
2. Thiết kế chỉ có buffer RAM: mất mạng rồi đóng tab/crash vẫn có nguy cơ mất thay đổi chưa ACK; `beforeunload` dùng fetch thường, không cam kết delivery, chưa có local recovery/export được người dùng chấp thuận. Không thể hứa “zero data loss trong mọi tình huống” chỉ bằng patch hẹp này.
3. Luồng `ECONOMY_*` sẵn có thay buffer bằng serverData và reload, logout sẵn có xóa buffer trước reload. Chưa đổi chính sách phục hồi/quyết định logout khi dirty vì có thể thay đổi semantics gameplay/account; cần parent quyết định bảo toàn bản chưa ACK. Không có auto-merge conflict mới.
4. `purgeLegacyLocalSave()` sẵn có xóa key archero2*; không thêm bất kỳ thao tác xóa nào, cũng không tự reimport local save vì nguy cơ cross-account. Nếu còn save local-only lịch sử chưa upload, cần chính sách backup/export owner-aware trước khi purge. Chưa kiểm tra dữ liệu người dùng thật.
5. Snapshot nonempty nhưng sai kiểu chưa bị broad sanitize ở GET; chỉ chặn cấu trúc rõ ràng bất hợp lệ/empty. Cần fixture lịch sử và compatibility contract trước khi áp kiểm tra sâu.
6. Concurrent debug `loadCloudSave()` và response cũ trong cùng trang chưa có generation-token/cancellation; không rewrite session architecture. Owner binding ngăn PUT cross-account cho client mới, nhưng không thay thế toàn bộ điều phối auth đa tab.
7. Test VM không thay cho browser thật, Web session integration hay Mongo atomic execution trên DB test. Parent đang phụ trách browser/baseline; hai integration DB vẫn skip đúng chủ đích.

## File thuộc thay đổi này

- Sửa: `public/cloud.js`, `api/save.js`.
- Thêm: `tests/cloud-client-reliability.test.mjs`, `tests/cloud-save-api-reliability.test.mjs`, `docs/audit/artemis-new-player/cloud-findings.md`.
