# 03 — Bug report và disposition

Phạm vi: baseline `3838b40` → working tree local trên `codex/artemis-new-player-hardening`. **Không có bản vá nào được deploy.** “FIXED & VERIFIED” bên dưới chỉ đúng ở seam local/tests được ghi; không ngụ ý Mongo hoặc production đã được nghiệm thu. Chi tiết RED→GREEN và source line trong `cloud-findings.md`, `gameplay-findings.md`, `auth-economy-findings.md`.

## Summary

| BUG-ID | Severity | Status | Affected files | Fix / disposition |
|---|---|---|---|---|
| ART-001 | P0 | FIXED & VERIFIED — LOCAL | public/cloud.js | Load lỗi không khởi tạo defaults, không mở ghi, giữ unsent buffer; chặn empty snapshot và revision bất nhất |
| ART-002 | P1 | FIXED & VERIFIED — MOCK DB; real DB BLOCKED | api/save.js | CAS revision cho update, insert-first unique conflict, revision bắt buộc, legacy missing-revision thống nhất GET/PUT |
| ART-003 | P1 | FIXED & VERIFIED — LOCAL | api/save.js | Projection thêm previous season |
| ART-004 | P1 | FIXED & VERIFIED — LOCAL | public/cloud.js | Single-flight PUT; dirty theo payload ACK; exact payload thay hash collision; kiểm ACK HTTP/revision |
| ART-005 | P0 | FIXED & VERIFIED cho client mới; legacy còn risk | api/save.js, public/cloud.js | GET owner binding và PUT playerId khớp session; không cấp quyền theo body |
| ART-006 | P1 | FIXED & VERIFIED — LOCAL | lib/saveSchema.js, public/index.html | Giữ _lootCount, save ngay, cap đúng mục tiêu 10 |
| ART-007 | P1 | FIXED & VERIFIED từ snapshot mới; history BLOCKED | public/index.html | Serialize starterWeaponGranted; nhánh equipped ghi cờ; không cấp lại sau bán/reload |
| ART-008 | P0 | FIXED & VERIFIED — đường UI; snapshot authority còn mở | public/index.html | Preview/selector không tạo item hoặc thay template; chỉ equip object đang sở hữu |
| ART-009 | P1 | FIXED & VERIFIED — selectors | public/index.html | Selector hero cũ gọi isHeroOwned; Alex 0★ chọn lại được, giữ legacy selected fallback |
| ART-010 | P2 | FIXED & VERIFIED — LOCAL | public/index.html | N04/toast đúng Cung Gỉ Sét, N08 đúng Hoàn Tất |
| ART-011 | P0 | FIXED & VERIFIED — cổng debug UI; không phải anti-cheat server | public/index.html | Public hostname không thể bật dev bằng query/localStorage; local/offline giữ tooling |
| ART-012 | P2 | FIXED & VERIFIED — LOCAL | lib/auth.js | Cookie percent-encoding hỏng trả unauthenticated, không ném URIError |
| ART-013 | P1 | FIXED & VERIFIED — fake index; production index BLOCKED | lib/mongo.js | Không biến createIndex rejection thành fulfilled; không sửa index/config DB |
| ART-014 | P0 | CONFIRMED / BLOCKED safe implementation | lib/economy.js, api/save.js, auth/register.js | Initial snapshot chấp nhận tài nguyên client đến hard cap; cần canonical server seed và rollout tương thích |
| ART-015 | P0 | CONFIRMED / BLOCKED architecture | lib/economy.js, saveSchema.js, index.html | Delta theo revision không xác minh reward/ownership/upgrade provenance; cần action APIs/ledger có chứng cứ hợp lệ |
| ART-016 | P1 | CONFIRMED / chưa sửa | lib/auth.js, lib/http.js, api/auth/logout.js | JWT đã phát không được thu hồi sau logout/reset-password; cần chính sách phiên tương thích |
| ART-017 | P1 | CONFIRMED limitation / chưa sửa | public/cloud.js | Buffer RAM, logout/ECONOMY recovery và đóng tab khi offline chưa bảo đảm giữ bản chưa ACK |
| ART-018 | P1 | FIXED & VERIFIED harness; baseline impact UNKNOWN | tests/admin.test.mjs, integration.test.mjs | Bỏ đọc .env/xóa rate-limit; opt-in môi trường cô lập, báo skip/BLOCKED rõ |
| ART-019 | P2 | CONFIRMED / chưa đổi balance | public/index.html, tools/combat-sim.mjs | Enemy scaling neo player; simulator chưa parity boss/profile/chapter |
| ART-020 | P1 | FIXED & VERIFIED — LOCAL | public/index.html | Writer thật bỏ season dù schema hỗ trợ; thêm field và test round-trip snapshot cũ |
| ART-021 | P1 | CONFIRMED source / BLOCKED schema compatibility | public/index.html, lib/saveSchema.js | gameMode/modeBest/guild/garden/plinko thiếu writer và whitelist; không thêm schema suy đoán |
| ART-022 | P2 | CONFIRMED source / NOT TESTED runtime | public/index.html | Practice chặn bonus cuối run nhưng pickup chưa guard tương ứng; cần mode/reward contract review |
| ART-023 | P1 | FIXED & VERIFIED — LOCAL | public/index.html | 8 đường gán selectedHeroId: quyền sở hữu + tồn tại HEROES; prev/next chỉ xoay hero sở hữu; trial Atreus thành override trong trận |
| ART-024 | P2 | FIXED & VERIFIED — LOCAL | public/index.html | Alex 0★ hiển thị 6★ do `stats.heroStar || 6` |
| ART-025 | P2 | FIXED & VERIFIED — handler | public/index.html | upgradeHeroStar/summonHeroShards rơi về HEROES[0]; mua mảnh trừ gem trước khi validate; VN star-up tự unlock metadata |

## Reproduction / root cause / expected / actual / verification

### ART-001 / ART-005 — tải save và owner

- Input local: 401/429/500, network reject, JSON hỏng, contract thiếu, snapshot `{}`, hasSave=true revision0; snapshot owner khác auth player.
- Steps: bootstrap cloud trong VM, trả response lỗi, quan sát start count, SAVE_READY, buffer; thử push.
- Expected: không khởi động game/không PUT khi chưa xác nhận; không nạp dữ liệu account khác.
- Actual cũ: catch trả false như no-save và mở khóa; snapshot không gắn identity. Có khả năng defaults ghi đè tiến trình.
- Root cause: boolean false dùng chung cho “không có save” và “không biết save”; cookie đa tab không buộc snapshot owner.
- Patch: fail-closed, reject giữ buffer và khóa; identity additive cho client mới. Optional owner cho legacy client để không phá rolling compatibility.
- Tests: `cloud-client-reliability.test.mjs`, `cloud-save-api-reliability.test.mjs`. Risk: client cũ không gửi owner vẫn chưa có bảo vệ mới; snapshot nonempty sai kiểu sâu chưa được migration/validate toàn diện.

### ART-002 / ART-003 — revision và season

- Steps: hai PUT cùng đọc revision; hai first-save; save season đang có token hợp lệ.
- Expected: một winner, loser409; season hợp lệ không bị coi là season mới.
- Actual cũ: cả hai200 và last-write-wins; projection thiếu season gây422.
- Root cause: kiểm revision ngoài atomic write, update chỉ filter playerId; dữ liệu validation bị projection bỏ.
- Patch: compare-and-set + matchedCount; insertOne/duplicate11000; projection season. Không rewrite dữ liệu đã lưu.
- Tests: fake collection thực thi projection/CAS/unique insert; sanitizer/validator thật. Risk: chưa chạy DB thật; unique-player index thực tế và admin writes còn cần kiểm tra.

### ART-004 — save scheduling

- Steps: đổi buffer khi PUT đang pending; gửi payload khác có DJB2 hash trùng; ACK thiếu/sai revision.
- Expected: chỉ một write pending, thay đổi mới vẫn dirty và được gửi; ACK không hợp lệ không xác nhận saved.
- Actual cũ: PUT trùng revision; ACK cũ xóa dirty; payload hash collision bị bỏ qua.
- Patch/test: exact payload comparison, single-flight, kiểm HTTP/revision; runtime VM suite. Không thêm auto-merge hoặc retry vô hạn.

### ART-006 / ART-007 — persistence

- Steps: loot6→serialize→sanitize→reload→loot4; starter grant→serialize→sanitize→bán→reload→room-clear.
- Expected: 6 rồi10, không mất tiến độ; không nhận item lần hai.
- Actual cũ: schema bỏ _lootCount; dưới10 không save; writer bỏ cờ starter; equipped branch không đóng cờ.
- Patch: field narrow trong schema/writer, save counter, grant flag idempotent. Không reset mission hoặc tài sản cũ.
- Tests: `new-player-gameplay-runtime.test.mjs`, browser local `evidence/local-browser.json` qua sanitizer thật. Risk: cờ đã mất trong quá khứ không thể khôi phục lịch sử chắc chắn; không đoán và thu hồi item.

### ART-008 / ART-009 — quyền sở hữu

- Steps: fixture bag/equipped trống click chọn staff; fixture có item level/rarity/UID mạnh đổi archetype; click Thor chưa sở hữu qua legacy selector.
- Expected: xem thông tin không cấp item; chỉ di chuyển item thật giữ nguyên thuộc tính; hero bị khóa không được chọn.
- Actual cũ: tạo S-tier miễn phí hoặc đổi template của item; selector hero cũ bỏ guard.
- Patch: tra item owned, di chuyển object thay tạo/chỉnh template; dùng isHeroOwned. Alex luôn miễn phí0★, không tăng sao.
- Tests: click callback production thật trong VM, bảo toàn UID/template/level/quality/socket/affix; browser fixture. Risk: không có server entitlement ledger; legacy selected hero0★ fallback được giữ để tránh tịch thu quyền hợp lệ.

### ART-010 — copy

Render N04/reward và N08 current. Cũ nói kiếm/Đã Hiểu trong khi template là rusty_bow và hint Hoàn Tất. Chỉ đổi copy, không reward/rarity/mission target. Render tests RED→GREEN và browser event smoke pass.

### ART-011 — debug gate (parent bổ sung sau báo cáo gameplay)

- Repro: cùng production gate snippet chạy VM với `hostname=artemis-puugoo.vercel.app`, `?dev=1` và/hoặc stored flag1; cũ bật true. Không probe cheat production.
- RED: 33 tests, 29 pass/4 fail (public hostname cases). Patch: allow exact localhost/127.0.0.1/[::1] qua HTTP(S), hoặc file://, rồi mới đọc cờ opt-in. GREEN: 33/33.
- Browser: intercept `https://audit.invalid/?dev=1` về server fixture local, seed storage1, gọi ba grant handlers và max helper: gate false, tài sản byte-equivalent. Không hề request host đó ngoài fixture.
- Risk: chặn affordance debug không biến client thành trusted authority; DevTools vẫn sửa RAM/snapshot, P0 ART-014/015 vẫn mở. Localhost chạy DB thật cũng không tự trở thành môi trường test an toàn.

### ART-012 / ART-013 — hardening nhỏ tách biệt

- Cookie malformed `%ZZ`, `%`, UTF8 hỏng: RED1fail/1pass; chỉ catch URIError và trả null; GREEN2/2. Token hợp lệ/thiếu cookie giữ contract. Không đổi JWT/session schema.
- Index error13/91/11000: production ensureIndexes trước đây resolve dù lỗi, RED3fail/1pass. Bỏ `.catch(e=>e)` trước allSettled, GREEN4/4. Không thực hiện migration/index operation DB thật. Chính sách cũ bỏ qua85/86 vẫn giữ; trước release phải kiểm chứng đúng unique index thay vì suy từ tên index.

### ART-014 / ART-015 — chặn release, không tự đổi economy

- Local helper pipeline sanitize→economy/season accepts first1e12 gold+1e12 gems; raw1e15 clamp xuống rồi accepts. Bốn revisions accepts tổng2.000.000 gold+80.000 gems không sự kiện gameplay.
- Expected: server xác minh nguồn reward/chi tiêu và initial state; Actual: giới hạn shape/cap/delta, không có chứng cứ nguồn.
- Không gửi payload lên production. Không dùng trần thấp hoặc seed mới ghi đè save cũ. Cần canonical new-account marker và action/ledger rollout, xem `08-SAFE-FOLLOWUP.md`.
- Characterization9/9 xác nhận lỗ hổng tồn tại, **không phải PASS security**. Không được tự đánh dấu READY.

### ART-016 / ART-017 — rủi ro ngoài patch hẹp

JWT giả ký bằng khóa fixture vẫn verify sau logout (logout chỉ clear cookie); reset-password không được authorize so passwordChangedAt. Không đổi cơ chế đăng nhập diện rộng. Buffer chưa ACK chỉ ở RAM, beforeunload không bảo đảm fetch delivery; cần owner-aware recovery và UX quyết định khi conflict/logout, không silent reset.

### ART-018 — test harness safety và sự cố đã xảy ra

Baseline đã chạy hai suite đọc `.env`/`deleteMany(login_attempts)` trước khi phát hiện. DB target và effect không biết; không có bằng chứng account/save steps đã chạy vì request đầu tiên localhost bị từ chối. Báo chi tiết trong `00-BASELINE.md`, không nói “không chạm production”. Patch removes DB cleanup entirely, gates integration với opt-in được operator xác nhận, và runner thực sự báo2 skipped. Test mới red4→green4, không tính skipped thành thành công.

### ART-019 — gameplay/simulator

Không đổi công thức/reward tables. Các profile analytical tăng ATK/HP có TTK gần như không đổi khi enemy scale theo player; tool có room999 và boss-type mismatch, không đủ dữ liệu A–G/win rate để cân bằng diện rộng. Chi tiết và số đo thật: `05-GAME-BALANCE.md`.

### ART-023 / ART-024 / ART-025 — ownership UI (workstream hero)

- RED trước patch: chạy **cùng** `tests/hero-selection-ownership.test.mjs` trên `git archive` của HEAD sạch → **6 pass / 19 fail**; quick-stage, `.char-subtab-hero-btn`, `[data-jump-upgrade-hero]`, `[data-vn-hero-use]`, prev/next đều ghi `selectedHeroId` không kiểm quyền, và nút Demon King ghi vĩnh viễn `atreus`.
- GREEN 25/25. `isHeroOwned` giờ chặn id không tồn tại, giữ Alex0★ và giữ đúng ca legacy “hero đang chọn luôn dùng được” để không reset save cũ.
- Trial Atreus không bị xoá: chỉ whitelist `atreus`, override qua `runHeroOverrideId` trong `try/finally` quanh `startNewRun()`; mọi `SaveState.save()` trong lúc dựng trận vẫn ghi hero người chơi đang chọn. Đã kiểm cả nhánh chặn/throw.
- Kiểm chứng bổ sung: Chrome thật fixture local click `.stage-quick-hero-btn[data-stage-hero=thor]`, `.char-subtab-hero-btn[data-char-hero=thor]`, `#btnStagePrevHero`, `#btnStageNextHero` trên save chỉ có Alex → `selectedHeroId` không đổi, 0 JS error.
- Không chạm `heroStars/heroShards/heroSelectedSkins` của save cũ; không tự mở pet/hero mới.

### ART-020 / ART-021 / ART-022 — phát hiện khi map kiến trúc

- `SaveState.save()` không serialize season mặc dù load/schema/API đã có. Test dùng **writer production thật** với existing snapshot gold9.000.000/gems9.000, ranger/token120/sacrifice.04 và log; RED1fail/1pass, `serialized.season===undefined`. Thêm đúng `season:this.season` không default hoặc migration, GREEN2/2; round-trip qua sanitizer giữ nguyên season/currency và validateSeasonDelta succeeds. Regression schema/season10/10 runner entries pass. Legacy chưa có season vẫn không tự seed field trong writer.
- `gameMode`, `modeBest`, `guild`, `garden`, `plinko` thiếu cả writer và output whitelist: source-confirmed persistence gaps đã tồn tại ở baseline. Không tự tạo schema mới bằng phỏng đoán/cap gây cắt dữ liệu cũ; cần đọc đầy đủ state contract, fixtures và compatibility rollout riêng. Đây là P1 còn mở, không được tuyên bố mọi hệ thống lưu đầy đủ.
- Practice finishRun chặn bonus/bonus gear nhưng pickup gold/scroll chưa có guard tương ứng ở source. Chưa thực hiện runtime repro toàn flow; ghi nguồn/giới hạn trong `01-ARCHITECTURE.md`, không tự thay reward mọi mode.

## Diff review

Không đổi framework/dependencies dự án/Vercel config/lockfile/reward table/rarity. Không migration hoặc chỉnh DB thủ công. Không xóa hoặc hạ item/hero/tài nguyên cũ. Hai assertion test cũ chỉ được cập nhật vì chính contract cũ yêu cầu hành vi mất an toàn vừa thay: cloud error xóa buffer và selector cấp vũ khí miễn phí. Sáu file failure baseline khác không bị sửa expected để ép PASS.
