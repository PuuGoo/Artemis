# Trang bị: kiểm chứng UI/UX

## Phạm vi

Chrome thật, các HTTP handler đăng ký/auth/save thật, DB bộ nhớ cô lập (`DB_BACKEND=memory`, `NODE_ENV=test`). Không đọc `.env`, không truy cập production hoặc MongoDB thật.

Script tạo tài khoản riêng và seed trang bị/cuộn nâng cấp vào DB thử nghiệm trước khi tải trang. Đây là kiểm chứng UI và lưu dữ liệu, không phải bằng chứng kiếm vật phẩm qua chiến đấu.

## Kết quả

- Kho và bảng chi tiết: desktop 1024 px, mobile 390/360 px; không tràn ngang, cả sáu ô trang bị nằm trong sân khấu.
- Mobile 360 × 740: nút trang bị nằm trong viewport; Escape, nút đóng và bấm backdrop đều đóng được; kiểm Shift+Tab từ nút đóng quay lại nút trang bị. Thẻ vật phẩm có xử lý Enter/Space trong mã, chưa có bài kiểm trình duyệt riêng cho phím mở thẻ.
- So sánh đúng tổng chỉ số: thay nhẫn Echo bằng Destruction kế thừa cấp 5, công 214 → 204, máu 945 → 945; cảnh báo mất mốc Echo 2 món. Xem trước không đổi bộ đồ thật.
- Cường hóa cấp 5 → 6: trừ 305 vàng và 2 cuộn; không thay công thức chi phí.
- Phân rã một món thường cấp 1: nhận 35 vàng, 1 mảnh rèn; đồ đang mặc, khóa và yêu thích không nằm trong danh sách chọn.
- Đóng chi tiết giữ vị trí cuộn 863 px; đổi qua tab Anh hùng vẫn hoạt động.
- GET save và reload xác nhận nhẫn mới cấp 6 và món đã phân rã không xuất hiện lại.
- Không có `pageerror` trong phiên kiểm chứng.

`result.json` và ảnh PNG được tạo từ lần chạy thật. Bộ kiểm mã: `npm run check` đạt; `npm run test`: 473 bài, 466 đạt, 7 bỏ qua, 0 lỗi. Những bài tích hợp cần môi trường/DB riêng vẫn được bỏ qua; không coi là đã kiểm chứng production.

## Chạy lại

Cần Chrome và module `playwright-core` có sẵn. Không tự cài browser/dependency.

```sh
PLAYWRIGHT_MODULE='C:/path/to/playwright-core/index.mjs' node --max-old-space-size=192 tools/verify-gear-browser.mjs
```

Kiểm RAM trước khi mở Chrome; chỉ chạy browser khi còn ít nhất 3 GB RAM trống, không chạy đồng thời với full test.

## Thử thủ công

1. Trang bị → Kho trang bị: kiểm sáu ô đang mặc, chuyển Bộ 1/2/3 và lọc từng vị trí.
2. Chọn một món trong kho: xem tổng Công/Máu sau khi thay, cấp kế thừa và cảnh báo thay đổi bộ; đóng rồi kiểm bộ lọc/vị trí cuộn.
3. Trang bị món đó, mở lại và cường hóa: kiểm giá, vàng/cuộn bị trừ và thông báo thiếu tài nguyên khi không đủ.
4. Mở Xưởng trang bị → Phân rã: chọn món không khóa/yêu thích, xem tài nguyên dự kiến trước khi thực hiện. Thao tác này tiêu hủy vật phẩm, chỉ thử với đồ muốn bỏ.
