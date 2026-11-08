# Cửa hàng xu VIP

## Ranh giới

- `catalog.js`: nguồn duy nhất của giá, phần thưởng và giới hạn các gói VIP, cửa hàng ngày và đổi vàng.
- `rewards.js`: tạo snapshot phần thưởng mới, kiểm trần tài nguyên/túi đồ; không truy cập HTTP hoặc DB.
- `handler.js`: HTTP handler xác thực, đọc catalog và commit nguyên tử `trừ xu + cấp thưởng + giới hạn + receipt` bằng revision CAS.
- `../../api/privileges.js`: function dùng chung, phân luồng shop và thẻ đặc quyền; giữ nguyên hành vi thẻ cũ.
- `../../public/js/game/shop/vip-shop.js`: view adapter đọc catalog server; không quyết định giá hoặc tự cộng thưởng.
- `../../public/cloud.js`: flush save trước mua, khóa ghi khi thanh toán/đồng bộ và giữ mã giao dịch khi mất phản hồi.

## Triển khai trong giới hạn Hobby

`vercel.json` rewrite `/api/shop` sang `/api/privileges?__resource=shop`.
Không tạo lại `api/shop.js`: mỗi file API riêng sẽ tăng số Serverless Functions.
Handler shop nằm ngoài `api/`, nên cửa hàng và thẻ VIP dùng chung một function;
URL frontend, cookie, body, giá, phần thưởng và CAS không đổi. Tổng hiện tại là 12 function.
Dev server dùng cùng cấu hình rewrite qua `lib/httpRouting.js`; bộ phân giải local
chỉ hỗ trợ các rewrite literal nội bộ `/api`, không giả lập toàn bộ router Vercel.
`tests/deployment-routing.test.mjs` chặn vượt quota và kiểm HTTP thật trong fixture
DB bộ nhớ riêng, không nạp `.env` thật hoặc truy cập production.

## Giá và phần thưởng

Tỷ lệ được duyệt: **1 xu VIP tương ứng 1.000đ giá niêm yết cũ**. `legacyVnd` chỉ phục vụ đối chiếu giá cũ; giao dịch không nhận hoặc thu tiền thật.
Giá hiện tại được GET từ `/api/shop`; không thêm bảng giá riêng trong HTML.

- Một gói chương: một lần/tài khoản, 14.000 Kim Cương và một trang bị Epic S-Tier.
- Gói ưu đãi cơ bản: Kim Cương theo gói, 10 chìa Ngũ Sắc và 20 cuộn **mỗi loại** trong sáu slot.
- Sáu gói Kim Cương: giữ phần tặng kèm bằng lượng gốc, tổng thưởng bằng hai lần lượng gốc.
- Sáu gói Aurocite: tối đa 30 lần/gói/tháng; Aurocite được lưu thật trên server, mặc định 0, không còn số 51 giả lập trong UI.

Trước đây hình gói ưu đãi không khớp handler (mảnh hero, vàng, lựa chọn...), còn gói chương quảng cáo S-Tier nhưng gọi rương ngẫu nhiên thường. UI ưu đãi nay hiển thị đúng thưởng thực tế; gói chương cấp S-Tier thật. Đây là sửa sai có chủ đích, không tự chế thêm vật phẩm từ hình minh họa.

Cửa hàng ngày và đổi Kim Cương sang Vàng dùng chung checkout máy chủ với shop VIP.
Giá/phần thưởng/giới hạn lấy từ catalog; không còn handler tự cộng vàng hoặc tự cấp
thưởng cửa hàng ngày trong trình duyệt. API thẻ đặc quyền VIP có sẵn giữ nguyên.
Thay đổi này không biến toàn bộ gameplay thành server-authoritative: vàng/kim cương
kiếm và tiêu trong gameplay vẫn theo snapshot cùng bộ kiểm tra delta/ngân sách hiện có.

## Xác nhận và lịch sử người chơi

Catalog hiện có 34 gói: 25 gói VIP, 7 gói dùng Kim Cương và 2 gói dùng Vàng.
`chapter_91` đổi tên thành Gói Tiếp Sức Hành Trình, giữ ID và hạn mức cũ.
Bỏ `wk_3`, `wk_5`, `mo_3` trùng hoàn toàn trong cùng chu kỳ. `mo_4` tập trung
cuộn (120 mỗi loại), `mo_5` tập trung chìa Ngũ Sắc (60 chìa); giữ giá và hạn mức.
Gói cơ bản cùng giá/thưởng giữa ngày/tuần/tháng là lựa chọn có chu kỳ mua độc lập,
không còn bản sao cùng giá/thưởng trong một chu kỳ.
Cửa hàng ngày cấp đúng vật phẩm/schema hiện có: mảnh Hậu Nghệ, Ủng Echo thường,
xu cầu nguyện, Hạt Mầm Xanh và cuộn trang bị. Giữ các phần thưởng đã sửa trên main;
không thay vật phẩm của người chơi khi chuyển checkout lên máy chủ.

- Trước giao dịch mới, tải lại catalog và số dư máy chủ; popup xác nhận ghi giá,
  phần thưởng và số dư dự kiến sau mua. Hủy không gửi POST mua hàng.
- Client gửi số dư đã xác nhận qua `expectedBalance`. Server từ chối nếu số dư
  thay đổi khi flush save, tránh thanh toán trên số dư khác popup.
- Giao dịch chưa rõ kết quả được kiểm tra bằng request cũ, không hỏi mua lại hay
  tạo requestId mới. Số dư vẫn được máy chủ quyết định; không tin DOM/browser.
- Lịch sử nằm trong cửa hàng, đọc receipt của đúng tài khoản từ API; tối đa 100
  giao dịch mới nhất, ghi thời gian Việt Nam, giá, thưởng, số dư và mã giao dịch.
  Receipt cũ chưa ghi số dư hiển thị thiếu dữ liệu, không bịa số dư quá khứ.
- `tools/verify-shop-browser.mjs` kiểm hủy/xác nhận/đổi vàng/lịch sử sau reload bằng
  Chrome + HTTP handler thật + DB bộ nhớ riêng. Không đọc `.env`, không gọi production.

## Hợp đồng giao dịch

`POST /api/shop` nhận `{ offerId, playerId, revision, requestId }`.
`requestId` là UUID v4; `playerId` phải khớp phiên và `revision` phải là snapshot đã đồng bộ. Giá/phần thưởng gửi kèm từ client bị bỏ qua.

- Cùng mã giao dịch và cùng gói trả xác nhận cũ, không trừ/cấp lại.
- Đổi gói bằng mã đã dùng hoặc gửi revision cũ trả 409.
- Receipt chỉ giữ 100 giao dịch cuối. Mã đã bị cắt khỏi log vẫn không thể tiêu lại revision cũ.
- Giới hạn và receipt nằm ngoài `data`; client không thể reset bằng PUT save.
- `vipCoins` và `aurocite` lấy từ snapshot server trong save policy; luôn cập nhật projection cùng policy.
- Ngày/tháng tính theo UTC+7; tuần bắt đầu thứ Hai. Chỉ reset bộ đếm khi chu kỳ thay đổi, không sửa tài nguyên cũ.
- Thiếu xu, hết lượt, túi đầy hoặc vượt trần tài nguyên: từ chối, không trừ xu.
- Mất phản hồi: client giữ nguyên request và khóa ghi; bấm lại **đúng gói** để kiểm tra. Không gửi mã mới khi chưa biết giao dịch cũ đã thành công hay chưa.

## Kiểm thử

```bash
node --max-old-space-size=192 --test --test-concurrency=1 tests/shop/*.test.mjs tests/cloud-client-reliability.test.mjs tests/save/*.test.mjs
npm test
npm run check
```

API test dùng đăng ký/phiên/admin grant và DB bộ nhớ thật của dự án. Test view chạy module và renderer HTML thật trong VM với network/DOM seam; không chứng nhận giao diện pixel trên Chrome hoặc hoạt động production.
