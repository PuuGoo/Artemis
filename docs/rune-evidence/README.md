# UI/UX Ngọc theo ảnh tham chiếu người dùng

Phạm vi: làm lại trình bày và tương tác Ngọc; giữ 13 ô, sở hữu, phẩm chất, bộ khảm nhanh và luồng Tàn Tích hiện có. Không đổi cơ chế nhận/ghép ngọc, giá, schema save hay hiệu ứng chiến đấu.

## Giao diện

- Tham chiếu: `what-gear-and-runes-should-i-use-to-max-out-damage-v0-gqcoidjf0see1.webp` người dùng cung cấp; thay thiết kế thẻ tối giản của bản trước.
- Đài tròn tường tím/bánh răng, 13 ô bốn hình dạng bao quanh nhân vật toàn thân; ba ô Khắc Ấn phía dưới.
- Thứ tự bắt buộc: đài → ba tab Anh hùng/Trang bị/Ngọc → thanh xanh hai nút vàng → kho 5 cột, kể cả mobile 360 px. Bỏ tiêu đề/pill Công–Máu khỏi luồng chính, chuyển vào nút thông tin.
- Thẻ vuông chỉ icon, viền và màu theo phẩm chất thật; tên vẫn có trong aria-label/title và chi tiết. Mặc định sắp theo phẩm chất, không đổi bậc ngọc.
- Chọn ô để lọc đúng nhóm; bộ lọc Đã có/Tất cả và nhóm nằm trong Xưởng Ngọc.
- Chi tiết dùng native dialog: chỉ số cơ bản, vị trí gắn/tháo, phần Wiki thu gọn và ghi rõ giới hạn triển khai combat.
- Nút Xưởng Ngọc mở đúng bộ lọc/bộ khảm nhanh/Khám phá Tàn Tích hiện có. Điều hướng Trang bị khôi phục thanh tab cũ, không sửa giao diện các mục khác.

## Bằng chứng đã chạy

`tools/verify-rune-browser.mjs` dùng Chrome thật và HTTP thật tới các handler register/auth/save, DB bộ nhớ riêng (`NODE_ENV=test`, `DB_BACKEND=memory`). Tạo tài khoản fixture, seed rõ 5 loại ngọc; không phải tài sản kiếm qua chiến đấu và không gọi production.

- Desktop 1024 và mobile 390/360: đủ 13 ô, vùng bấm tối thiểu 44×44, từng ô nằm trong bảng, không tràn ngang; kho đủ 5 cột và đúng thứ tự đài/tab/toolbar/kho.
- Dialog desktop và mobile 360×740: CTA 48px nằm trong viewport; Tab/Shift+Tab đi hết vòng, Escape và bấm nền đóng được.
- Gắn → tháo → gắn lại → thay ngọc hoạt động qua nút thật; ngọc khác nhóm bị chặn, ngọc chưa có chỉ được khám phá.
- Hủy không thay ô; đóng từ kho giữ scrollTop 276 và trả focus đúng thẻ.
- Bộ Oracle chỉ gắn 5 viên đã sở hữu; số lượng/bậc trong `runes` không đổi.
- Đọc lại `/api/save` và reload giữ đúng vị trí ngọc; reduced-motion tắt animation nền/nhân vật.
- Không có `pageerror`; browser và server được đóng trong `finally`.
- Kiểm nút phẩm chất bật/tắt, Xưởng mở thật, đổi Trang bị và đi Tàn Tích qua UI thật.
- Đối chiếu ảnh dùng fixture thị giác riêng: Seraph (asset có sẵn), 46 loại ngọc ở các bậc đã seed rõ, 10 ô đang gắn. Không đổi anh hùng/tài sản người dùng thật. `heroGeometry` xác nhận ảnh nhân vật không bị intrinsic grid đẩy ra khỏi khung hay bị hàng ngọc dưới che chân.

Kết quả đo: `result.json`. Ảnh đối chiếu chính: `reference-540.png`, `reference-360.png`; ảnh hành vi: `board-1024.png`, `board-390.png`, `board-360.png`, `detail-desktop.png`, `detail-mobile.png`, `inventory-mobile.png`, `equipped-mobile.png`.

Kiểm mã: `npm run check`, không lỗi. Full suite: 480 tests, 473 pass, 7 skip, 0 fail. Các test mới: `tests/rune-workspace.test.mjs`; test ghi chú Ấn tại `tests/combat-status.test.mjs` đọc module trình bày thật sau khi tách khỏi HTML.

## Giới hạn

Chưa xác minh production, MongoDB bền vững, nguồn thưởng Tàn Tích hoặc combat tự nhiên. Đây là kiểm UI/auth/save với fixture cô lập, không phải kiểm cân bằng hay triển khai toàn bộ thuộc tính Wiki.

Không khẳng định pixel-perfect 100%: nền và khung được dựng lại bằng SVG/CSS, không phải asset 3D/texture gốc trong ảnh; dùng nhân vật và phẩm chất thật của tài khoản, giữ HUD/chức năng đang có và chữ tiếng Việt. Không thêm khóa giả cho hai ô Khắc Ấn chỉ vì ảnh có khóa; không sửa tiến trình để bắt chước dữ liệu tham chiếu.

## Kiểm thủ công

1. Trang bị → Ngọc: đài nằm trước ba tab; thanh Theo phẩm chất/Xưởng Ngọc nằm trước kho icon vuông 5 cột.
2. Chọn ô trống → chọn ngọc cùng nhóm → Gắn ngọc; bấm ô đang gắn để xem hoặc tháo.
3. Mở Xưởng Ngọc → Tất cả để tra cứu ngọc chưa có; chỉ có nút Khám phá, không có Gắn ngọc.
4. Đóng bằng Escape/nền/Để sau; vị trí kho không nhảy. Reload giữ ô đã gắn.
