# Đồng bộ Trang bị và Anh hùng với Ngọc

Phạm vi: nền tím, đài theo ảnh nền Ngọc, chiều rộng nội dung 600px, ba tab xanh/vàng cùng biểu tượng, thanh hành động vàng, kho trang bị năm cột, danh sách anh hùng cùng bảng màu. Giữ Thánh vật và Vật phẩm trong mục phụ; không thay đổi cơ chế hoặc schema save.

## Đã kiểm tra

- `npm run test`: 483 tests, 476 pass, 7 skipped, 0 fail. Các test bị bỏ qua không được coi là đã xác minh.
- `npm run check`: 189 files, 6 inline scripts, 0 errors.
- `tools/verify-rune-browser.mjs`: Chrome thật, HTTP đăng ký/save thật với DB bộ nhớ cô lập; không chạm tài khoản production.
- Trang bị và Anh hùng: chuyển qua tab hiển thị bằng click thật, đúng aria-current, ba cột điều hướng; không tràn ngang ở 1024/390/360px; kho trang bị năm cột.
- Ngọc: gắn/tháo/thay, chặn sai nhóm và chưa sở hữu, hủy không đổi dữ liệu, giữ scroll, bàn phím modal, bộ khảm chỉ dùng ngọc sở hữu, save/reload, Tàn Tích; zero page errors.
- Browser và server fixture được đóng trong finally.

## Ảnh

`docs/rune-evidence/gear-unified-{1024,390,360}.png`
`docs/rune-evidence/characters-unified-{1024,390,360}.png`

## Giới hạn

Fixture ngọc được cấp riêng cho kiểm thử, không chứng minh nhận thưởng từ chiến đấu. Kho trang bị fixture trống; không coi kiểm tra lần này là E2E cường hóa/ghép đồ. Không xác minh deployment production hoặc Mongo bền vững.

## Kiểm tra thủ công

1. Mở Trang bị → Ngọc → Trang bị: nền tím/đài đồng nhất, Trang bị sáng vàng, thanh sắp xếp và Ghép đồ vẫn hoạt động.
2. Chọn Anh hùng: phần giới thiệu nhân vật ở đầu trang, ba tab ngay dưới khung nhân vật/kỹ năng; chọn Ngọc để quay lại.
3. Mở Mục khác: vẫn truy cập được Thánh vật và Vật phẩm.
4. Trên điện thoại, cuộn xuống kho và dùng các bộ lọc; không tràn ngang toàn trang, các bộ lọc dài cuộn ngang riêng.
