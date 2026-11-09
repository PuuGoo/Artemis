# Dọn UI anh hùng — bằng chứng cục bộ

## Kiểm kê trước sửa

- Battle: `heroSelectList` + `.hero-card-btn`, và lối tắt `btnBattleOpenStarSkin`.
- Gear stage: quick pills (đã bị remove lúc boot nhưng renderer/listener còn), mũi tên trước/sau, disclosure `stageStarSkinDrawer`.
- Characters: catalogue PDF `renderVnHeroesAndWardrobeUI` có picker/Nâng Sao/Cộng Hưởng riêng; quick grid `charSubtabHeroGrid`; disclosure `charHeroStatsStarSkinPanel`; `petCardsGrid` và `.select-pet-btn`.
- Roster chính `tabHeroes`: `heroRosterGrid`, ownership guard, chi tiết và nút `btnUpgradeStar` riêng.
- Kho mảnh: `data-jump-upgrade-hero` lại đổi selected hero và chuyển tới Characters.

## Sau sửa

Giữ duy nhất roster `tabHeroes` để chọn nhân vật. Xoá markup/renderer/listener của các picker phụ, catalogue PDF và pet picker. Characters còn điều khiển ngoại hình/sân khấu, tinh thông vũ khí và link tới roster; navigation được gắn lại ngoài catalogue PDF đã xoá.

Một disclosure Nâng sao & cộng hưởng duy nhất đặt cạnh chi tiết canonical; studio vẫn dùng upgradeHeroStar và setResonanceSlotHero, không nhân đôi action nâng sao trong chi tiết. Giữ schema và combat resolver hero/pet/star/resonance/weapon. Không đọc .env hoặc sửa production; không commit/push.

## Kết quả

- TDD: test cấm hai disclosure/picker phụ thất bại trước khi sửa; focused 45 PASS.
- Source sau xác minh cloud: `npm run check`: 205 files, 6 inline scripts, 0 errors.
- Full suite tuần tự, child heap 256 MB: 521 tests, 514 PASS, 7 SKIP, 0 FAIL (34.46 s). Bảy test tích hợp cần server/Mongo riêng vẫn SKIP/BLOCKED, không tính là PASS.
- Chrome thật + HTTP/auth/save route thật + DB memory cô lập: UI PASS tại 360×740 và 1024×900, 0 page errors, không tràn ngang, nút disclosure 44 px, Escape trả focus, nav/re-entry đóng bảng; 1 disclosure, 1 star-up action, 0 picker phụ/pet picker; hero bị khoá không đổi lựa chọn.
- Fixture có 100000 vàng + 1000 mảnh Alex: click thật nâng 0→1★, client còn 99500 vàng + 950 mảnh; pet/resonance/gear không đổi.
- **PASS trong HTTP/memory fixture: nâng sao lưu qua cloud và reload giữ đúng 1★/950 mảnh/99500 vàng.** Giao dịch PUT tự động trả 200 revision 2; GET độc lập xác nhận; reload xác nhận lần nữa. Snapshot retry revision cũ trả 409, dữ liệu và revision không đổi. Pet spirit_sword, cộng hưởng Thor, gear thật kèm gem ruby/affix atk_flat và đủ 13 rune sockets (có rune_flame) không đổi. Không gọi pushNow, không PUT thủ công thay thế giao dịch thật.

## Chẩn đoán cloud / hồi quy harness

Nguyên nhân là **harness đọc quá sớm**, không phải backend cố giữ heroStars server-owned. `page.waitForFunction(async () => ...)` trả Promise truthy ngay lần poll đầu; resolved false vẫn làm wait hoàn tất. Đã tái hiện trực tiếp trong Chrome bằng `async () => false`: trả về false sau 54 ms thay vì tiếp tục poll/timeout. Vì debounce cloud là 1200 ms, GET cũ thấy snapshot trước nâng sao. Đổi sang predicate đồng bộ chờ `dirty=false`, `saving=false`, không có `lastError`, và star bằng giá trị kỳ vọng cố định đã chụp sau click; sau đó đọc HTTP độc lập và reload. Không sửa luật economy/serialization/server, không nới guard.

TDD: `tests/hero-cloud-evidence.test.mjs` chạy với callback cũ **0 PASS/2 FAIL**, sau sửa **2 PASS**; phủ chờ debounce/in-flight và không cho rollback về star cũ tạo false PASS. Focused cả ownership: **15 PASS**, gồm kiểm tra riêng thiếu vàng nhưng đủ mảnh và thiếu mảnh nhưng đủ vàng (không ghi save). Browser có một vòng FAIL phụ do so JSON string khác thứ tự key level/awakening dù dữ liệu đúng; đã đổi so parsed object, không hạ tiêu chuẩn dữ liệu.

Lệnh xác minh:

```sh
node --max-old-space-size=256 --test --test-concurrency=1 tests/hero-cloud-evidence.test.mjs tests/hero-selection-ownership.test.mjs
node --max-old-space-size=256 tools/verify-hero-ui-browser.mjs
npm run test
npm run check
git diff --check
```

RAM đo riêng trước Chrome/full suite đều >4 GB; browser/server đóng trong finally. Bằng chứng `result.json` và sáu screenshot được cập nhật bằng lần chạy PASS cuối. Không commit/push; để parent kiểm tra và push.

Screenshot chỉ là capture, không phải đánh giá thẩm mỹ bằng mắt. Không có production E2E hoặc Mongo thật.
