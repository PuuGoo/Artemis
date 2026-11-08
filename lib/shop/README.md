# Cửa hàng xu VIP

## Ranh giới

- `catalog.js`: nguồn duy nhất của giá, phần thưởng và giới hạn 28 gói trước đây niêm yết tiền đ.
- `rewards.js`: tạo snapshot phần thưởng mới, kiểm trần tài nguyên/túi đồ; không truy cập HTTP hoặc DB.
- `../../api/shop.js`: xác thực, đọc catalog và commit nguyên tử `trừ xu + cấp thưởng + giới hạn + receipt` bằng revision CAS.
- `../../public/js/game/shop/vip-shop.js`: view adapter đọc catalog server; không quyết định giá hoặc tự cộng thưởng.
- `../../public/cloud.js`: flush save trước mua, khóa ghi khi thanh toán/đồng bộ và giữ mã giao dịch khi mất phản hồi.

## Giá và phần thưởng

Tỷ lệ được duyệt: **1 xu VIP tương ứng 1.000đ giá niêm yết cũ**. `legacyVnd` chỉ phục vụ đối chiếu giá cũ; giao dịch không nhận hoặc thu tiền thật.
Giá hiện tại được GET từ `/api/shop`; không thêm bảng giá riêng trong HTML.

- Một gói chương: một lần/tài khoản, 14.000 Kim Cương và một trang bị Epic S-Tier.
- 15 gói ưu đãi: giữ phần thưởng **thực tế** của handler cũ: Kim Cương theo gói, 10 chìa Ngũ Sắc và 20 cuộn **mỗi loại** trong sáu slot.
- Sáu gói Kim Cương: giữ phần tặng kèm bằng lượng gốc, tổng thưởng bằng hai lần lượng gốc.
- Sáu gói Aurocite: tối đa 30 lần/gói/tháng; Aurocite được lưu thật trên server, mặc định 0, không còn số 51 giả lập trong UI.

Trước đây hình gói ưu đãi không khớp handler (mảnh hero, vàng, lựa chọn...), còn gói chương quảng cáo S-Tier nhưng gọi rương ngẫu nhiên thường. UI ưu đãi nay hiển thị đúng thưởng thực tế; gói chương cấp S-Tier thật. Đây là sửa sai có chủ đích, không tự chế thêm vật phẩm từ hình minh họa.

Cửa hàng vàng/kim cương và API thẻ đặc quyền VIP có sẵn giữ nguyên. Thay đổi này không biến toàn bộ gameplay thành server-authoritative.

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
