# Audit gameplay tân thủ Artemis — N01–N08, ownership và debug grant

> Báo cáo workstream trước bước review parent cuối. Parent đã sửa cổng debug public-host và cập nhật assertion legacy yêu cầu free weapon. Review tiếp tìm thêm hero assignment bypass ở quick-stage/character/arrows/VN/event; xem `hero-paths-findings.md`, `03-BUG-REPORT.md`, `06-REGRESSION.md` cho kết quả cuối. Không coi đoạn rủi ro/counters lịch sử bên dưới là disposition mới nhất.

## Phạm vi và mức bằng chứng

- Nhánh làm việc: `codex/artemis-new-player-hardening`, baseline được giao: `3838b40`. Không commit/push/deploy.
- Chỉ sửa `public/index.html`, `lib/saveSchema.js`, thêm `tests/new-player-gameplay-runtime.test.mjs` và báo cáo này. Không sửa `public/cloud.js`, `api/save.js`, test dùng chung, cân bằng chiến đấu hoặc dữ liệu tài khoản thật.
- Test mới **thực thi mã production**: lấy khối hàm/handler theo hai ranh giới có kiểm tra tồn tại, chạy trong Node VM với save fixture, gọi callback click thật, chạy `SaveState.save()` thật và `sanitizeSave()` thật. DOM, âm thanh, render phụ và một số dependency như constructor item/stat calculator được stub; riêng grant/hook/writer/handler là mã production. Chrome bổ sung kiểm tra constructor, UI và engine thật. VM không phải bằng chứng render trình duyệt hay kiểm thử DB. Không dùng regex hiện diện source để tuyên bố gameplay chạy.
- Đã bổ sung kiểm chứng Chrome thật bằng trang `file:///.../public/index.html`, chặn HTTP/HTTPS và `cloud.js`, đặt save-ready chỉ cho fixture offline. Không đăng nhập, không request production/API/DB. Lần mở tab mới đầu tiên thiếu injection save-ready nên đọc buffer trả `undefined`; đã cấu hình lại chính tab đó rồi chạy lại thành công. Không tính lần harness lỗi là gameplay lỗi.
- Không chơi tự nhiên đủ 15 phòng. Probe trình duyệt dùng API `damageEnemy(..., 1e9, true)` để tái hiện room-clear; dùng `setupRoom(15)` và bước vào portal để kiểm tra đường thắng chương. Không sử dụng các probe này để kết luận độ khó/cân bằng.

## Kết quả kiểm thử cuối

1. Test mới: **25/25 Node subtests PASS** trong `tests/new-player-gameplay-runtime.test.mjs`.
2. Lệnh regression tập trung:
   ```bash
   node --test tests/new-player-gameplay-runtime.test.mjs tests/beginner-journey.test.mjs tests/save-schema.test.mjs tests/dev-cheats.test.mjs tests/free-resource.test.mjs tests/hero-roster-nav.test.mjs
   ```
   Kết quả: **30/30 Node test entries PASS** = 25 subtests mới + 5 script test cũ. Năm script cũ tự báo lần lượt 71, 38, 40, 23, 42 checks PASS, tổng **214 checks**. Các check source của script cũ không được tính thành 214 kiểm chứng runtime.
3. `node --check lib/saveSchema.js`, compile hai inline scripts bằng `new vm.Script(...)`, `git diff --check`: PASS.
4. Test cũ `tests/new-player-zero-state.test.mjs`: **31 PASS / 1 FAIL**. Assertion thất bại là `doi vu khi khi slot trong se tao moi (khong bo qua)` — nó yêu cầu chính đường tạo vũ khí miễn phí mà audit vừa đóng. Không chỉnh test dùng chung theo phân công. Đây là contract cũ mâu thuẫn, không được báo toàn suite xanh.
5. Log cục bộ: `C:/Users/PuuGoo/AppData/Local/hermes/cache/scratch/artemis-gameplay-green.log` và `artemis-gameplay-legacy-contract.log`. Báo cáo không tuyên bố đã chạy full suite toàn repo; baseline/full-suite do parent tổng hợp.

## N01–N08: kiểm tra từng bước

| Bước | Trigger và thưởng hiện hành | Kết luận / bằng chứng |
|---|---|---|
| **N01 — Chào mừng** | Nút hội thoại; +100 vàng. Bảng bước: `public/index.html:25428`; binding: `:25801`. | Chrome click thật `[data-bj-step=N01]`: `completedSteps=['N01']`, `claimedRewards=['N01']`, chuyển N02, vàng từ 500 lên 600. VM kiểm tra nhận lại trả false, tutorial chưa kích hoạt không tự hoàn thành. Không tự mở tutorial cho save cũ. |
| **N02 — Dọn phòng** | Sau khi quái cuối chết: `:28363`; hook `:25692`. +200 vàng, +10 gems khi bấm nhận; gear starter là đường riêng. | Chrome `startNewRun()` có 3 quái; gọi damage production cho ba quái → `roomCleared=true`, 0 quái, N02 hoàn thành, **đúng một `rusty_bow` Lv.1 trong túi**, cờ starter trong buffer = true. VM gọi hook hai lần vẫn chỉ 1 món. Sửa thiếu persistence cờ và nhánh đã mặc đồ; chi tiết bên dưới. |
| **N03 — Nhặt 10** | Pickup sau `Game.drops.splice`: `:29438`; hook `:25703`. +150 vàng, +2 cuộn. | **Đã tái hiện và sửa** mất `_lootCount` qua sanitizer và thiếu save khi dưới 10. VM: nhặt 6 → serialize → sanitize → fixture mới → nhặt 4, N03 xong. Kiểm tra 9 chưa xong, 10 xong; bỏ NaN/Infinity/âm; không tăng vô hạn sau hoàn thành. Chrome nhặt các drop do kill thật sinh ra qua `updateGame(.016)`: 15 drop → 0, counter dừng 10, N03 xong. |
| **N04 — Trang bị** | Handler modal `:32547`; +250 vàng, +3 cuộn. | VM thực thi handler: chuyển item UID từ túi sang equipped, trả item cũ về túi, không nhân đôi. Selector loại vũ khí nay cũng gọi hook khi thật sự mặc món đang sở hữu. Chrome mặc starter qua selector: túi 1 → 0, cùng UID trong equipped, N04 xong. **Sửa tên hướng dẫn/toast** từ “Thanh Kiếm Gỗ” thành “Cung Gỉ Sét”, đúng template `rusty_bow` ở `:7464`. |
| **N05 — Cường hóa** | Handler `:32514`; +300 vàng, +2 cuộn. | VM chạy 3 trường hợp: 124 vàng +1 cuộn → không đổi; 125 vàng +0 cuộn → không đổi; 125 vàng +1 cuộn → Lv.1→2, trừ đúng 125 vàng và 1 cuộn, mới đánh dấu N05. Chrome click modal thật: vàng **1168→1043**, weapon-scroll **2→1**, cùng UID, level **1→2**, N05 xong. Không thay giá nâng cấp. |
| **N06 — Chọn skill** | `applyRogueSkill(skId, silent)` ở `:27698`; +250 vàng, +15 gems. | VM chạy **toàn hàm production** với dependency fixture: skill không tồn tại không đánh dấu; `silent=true` áp dụng pre-pin nhưng không đánh dấu; chọn thường có N06. Chrome nhặt EXP, hiện 3 lựa chọn, click `.skill-choice-card` thật → N06 xong, không có JS error. |
| **N07 — Thắng Chương 1** | Chỉ trong nhánh thắng `finishRun`, gọi hook ở `:31682`; +800 vàng, +50 gems, +1 silver key. | VM hook chapter 2 không hoàn thành, chapter 1 hoàn thành. Chrome dùng spawner phòng 15 thật, kill quái, đi vào `portalRect`, gọi update → finishRun đường thật: `running=false`, N07 xong. Đây là kiểm chứng wiring thắng/phần thưởng, **không phải** chơi tay vượt cả chương. |
| **N08 — Hoàn tất** | Hội thoại cuối, +1000 vàng, +80 gems. UI chỉ hiện action cho current step. | **Đã tái hiện và sửa** nút cuối vẫn ghi “Đã Hiểu” dù hint yêu cầu “Hoàn Tất”. Test chạy render production kiểm tra HTML kết quả. Chrome sau N07: nút N08 mang nhãn **Hoàn Tất**; click thật → đủ 8 bước và `isCompleted=true`. |

Test chain VM lấy tổng bằng cách cộng chính bảng `BEGINNER_STEPS`, không mô phỏng lại hằng số: **3050 vàng, 155 gems, 7 cuộn, 1 silver key**; nhận mỗi bước lần hai trả false và không cộng thêm. Bước gameplay có thể được ghi nhận ngoài thứ tự; `currentStep` là bước đầu tiên còn thiếu, không phải khóa cứng mọi event về sau. Giữ nguyên cơ chế này để không mất các thao tác hợp lệ người chơi đã làm sớm.

## Các lỗi đã sửa bằng RED → GREEN

### G01 — N03 mất tiến độ nhặt qua cloud schema

- Nguồn: `lib/saveSchema.js:127–153`, `public/index.html:25703–25711`.
- RED: sau 6 loot + `save()` + `sanitizeSave()`, `_lootCount` nhận `undefined` thay vì 6. RED riêng cho save ngay sau 3 loot: chưa có buffer để đọc.
- Root cause: client serialize toàn `beginnerJourney`, nhưng whitelist server không đưa `_lootCount` vào kết quả; hook chỉ save khi đủ 10 thông qua complete.
- GREEN: giữ `_lootCount` trong schema, clamp 0–10; save các cập nhật dưới ngưỡng; kết thúc ở 10; bỏ số đếm không hợp lệ và không tiếp tục save counter sau N03.
- Không reset `completedSteps`, `claimedRewards`, timestamps hay bật tutorial cho save cũ. Số đếm trên 10 trước đây không có ý nghĩa bổ sung cho mục tiêu 10 nên được cap, không phải xóa tiến trình.

### G02 — Starter flag không được ghi, có thể cấp lại sau tải lại

- Nguồn: writer `public/index.html:10308`; grant `:25663–25689`; schema đã có `starterWeaponGranted` ở `lib/saveSchema.js:420`.
- RED: grant thành công đặt cờ trong RAM, nhưng đọc payload thật thấy `undefined`; sau sanitizer cờ thành false, mất vũ khí khỏi túi rồi reload có thể được grant lại.
- GREEN: thêm đúng field vào writer, không đổi schema boolean đã có. Test serialize/sanitize/reload sau khi vũ khí không còn → không tạo món mới.
- RED riêng nhánh đã có vũ khí equipped: không cấp mới nhưng không đóng cờ, khác nhánh bag. GREEN: đóng cờ + save tương tự nhánh bag, **giữ nguyên món đang mặc**.
- Giới hạn lịch sử: nếu bản cũ đã làm rơi cờ và người chơi đã bán/xóa starter, dữ liệu hiện có không phân biệt được “chưa từng nhận” với “từng nhận nhưng mất cờ”. Không đoán rồi xóa gear hoặc thay tài sản để phục hồi lịch sử. Bảo đảm idempotence từ snapshot chứa cờ trở đi, không tuyên bố sửa được quá khứ không lưu.

### G03 — Danh mục vũ khí tạo miễn phí / biến đổi item đã sở hữu

- Nguồn: `public/index.html:26373–26421`.
- RED click handler thật trên fixture trống: `equippedGear.weapon` từ null thành `oracle_staff`, UID mới, không trừ phí. Khi đã có item, code cũ đổi thẳng `templateId` thành S-tier cùng archetype hoặc loại khác.
- GREEN: danh mục chỉ tìm item hợp archetype đang mặc/trong túi. Chưa có → toast khóa, **không đổi state**. Có trong túi → di chuyển đúng object/UID, trả vũ khí cũ vào túi, không sửa template, level, quality, sockets, affixes, locked/favorite. Đã mặc đúng loại → no-op.
- RED cho UI: tài khoản trống vẫn hiện “✓ Đang Trang Bị” vì `selectedWeaponId='bow'`. GREEN: label/ownership dựa vào item thật; món chưa sở hữu ghi “Chưa sở hữu · Xem thông tin”.
- Không tịch thu item S-tier đã tồn tại trong save cũ, không hạ level, không thay UID. Vẫn cho xem thông tin mọi loại vũ khí.

### G04 — Selector hero cũ bypass ownership; Alex mất quyền dùng sau đổi hero

- Nguồn: ownership `public/index.html:14185–14195`; selector cũ `:26335–26346`; star getter `:11125`.
- Roster mới có guard nhưng selector `.hero-card-btn` cũ ghi thẳng `selectedHeroId`. RED click Thor 0 sao đổi Alex→Thor.
- GREEN: dùng chung `isHeroOwned()` trước khi đổi. Không reset/chỉnh `heroStars`, shard hay skin.
- RED phụ: Alex 0 sao đổi sang Thor đã sở hữu rồi không đổi về được, vì fallback ownership chỉ chấp nhận hero hiện đang chọn. GREEN: Alex là hero khởi đầu miễn phí cố định ở 0 sao; luôn có quyền chọn lại, không cấp thêm sao hay buff.
- Giữ fallback cho hero đang được chọn của save cũ ở 0 sao, không ép đổi nhân vật khi tải. Không thêm registry sở hữu mới để tránh migrate nhầm tài khoản cũ.

### G05/G06 — Copy N04 và action N08 lệch hướng dẫn

- Nguồn: `BEGINNER_STEPS`, toast trong `BeginnerHooks`, `buildBeginnerJourneyPanelHtml`.
- RED đã chạy trước khi sửa: N04 không nhắc tên món thật; N08 render nút “Đã Hiểu”.
- GREEN: tên Cung Gỉ Sét và nhãn Hoàn Tất. Không đổi phần thưởng hay điều kiện hoàn thành.

## Ownership pet: không tự đặt luật mới

- `PETS` ở `public/index.html:5997–6025` chỉ có ba archetype: flame_sprite, frost_bat, spirit_sword. Không có stars/shards/owned flag/cost trong bảng pet.
- Default chọn `spirit_sword` (`:9883`); `getComputedStats()` ở `:11561–11568` luôn resolve pet đang chọn hoặc fallback pet đầu; selector `:26444` đổi trực tiếp archetype. Combat pet follow/auto-fire ở `:28768` áp dụng pet thực sự.
- VM click handler pet xác nhận chỉ đổi `selectedPetId` và lưu; không tự tạo gear hay cộng tiền. Chrome default pet có mặt là **hành vi hiện hữu**, không đủ căn cứ nói “grant nhầm pet”.
- Kết luận: hiện có ba lựa chọn pet miễn phí, **chưa có mô hình thu thập/ownership pet riêng**. Không sửa thành “pet rỗng” hoặc khóa pet khác bằng dữ liệu sở hữu không tồn tại: thay đổi đó vừa đổi thiết kế/cân bằng vừa có thể mất quyền dùng của save cũ. Nếu sản phẩm yêu cầu kiếm pet, cần quyết định entitlement/migration riêng trước khi triển khai.

## Debug grant: đã kiểm tra, còn rủi ro cần quyết định

- `DEV_CHEATS` ở `public/index.html:6433–6448` mặc định false, nhưng `?dev=1` hoặc localStorage `artemis_dev=1` bật được ở **mọi hostname**. Đây là opt-in client, **không phải phân quyền admin**.
- Runtime VM kiểm tra khi flag tắt: ba handler viện trợ (`btnRefillStamina`, `btnTopAddGold`, `btnTopAddGem`), `SaveState.applyMaxAllSystems()` (`:10191`) và `grantAllRogueSkillsInRun()` (`:32923`) đều không sửa save. Existing dev/free-resource scripts cũng PASS.
- Runtime VM riêng trên `hostname='audit.invalid'`, `search='?dev=1'` trả `devCheatsEnabled()===true`. Không cần request hostname đó. Vì vậy không được kết luận “production không thể cheat” chỉ từ guard/ẩn nút.
- Không sửa chính sách debug/auth trong nhánh gameplay nhỏ này; cần parent/chủ sản phẩm quyết định khóa build/origin/server authority. Client game và API debug export luôn sửa được RAM bằng console; sanitizer về shape không chứng minh tài nguyên đã kiếm hợp lệ.
- `grantStarterWeaponIfNeeded()` hiện kiểm tra playerName, cờ và inventory, **không kiểm tra tutorial active**; hook room clear vẫn có thể cho một vũ khí với save cũ chưa có món/cờ hoặc người mới đã skip. Giữ đường tương thích này, không dùng trạng thái UI tutorial để chặn người chơi kiếm món đầu tiên.
- N02 hook hiện không nhận chapter/mode; dù copy nhắc Chương 1, event được tính khi dọn phòng ở mode bất kỳ. N07 hook chỉ nhận chapterId, không phải bằng chứng server cho chiến thắng. Đây là khác biệt mô tả/thiết kế cần xác nhận nếu muốn tutorial campaign-only; không tự siết rồi làm mất tiến độ cũ.

## Các giới hạn / việc còn lại

1. Parent quyết định cập nhật assertion cũ đang yêu cầu tạo free weapon; subagent không sửa shared tests.
2. Cần quyết định chính sách quyền debug và mô hình sở hữu pet trước khi làm thay đổi hành vi lớn hơn.
3. Không có dữ liệu lịch sử để sửa retroactive starter grant đã mất cờ; không chỉnh dữ liệu tài khoản để suy đoán.
4. Chưa chứng minh durability DB, xung đột nhiều tab, hoặc đồng bộ A/B bằng báo cáo gameplay này. Các mục đó thuộc audit cloud của agent khác và bằng chứng local mock của parent.
5. Browser đã kiểm tra thật N01, room-clear/N02, pickup/N03, equip/N04, upgrade/N05, skill/N06, final portal/N07, click N08; **0 window error / unhandled rejection** trong chuỗi fixture cuối. Không có assertion cân bằng hoặc tuyên bố tự nhiên vượt 15 phòng.
