# UI/UX Ngọc đồng bộ Trang bị

Phạm vi: làm lại trình bày và tương tác Ngọc; giữ 13 ô, sở hữu, phẩm chất, bộ khảm nhanh và luồng Tàn Tích hiện có. Không đổi cơ chế nhận/ghép ngọc, giá, schema save hay hiệu ứng chiến đấu.

## Giao diện

- Cùng nền xanh đen, viền tím nhẹ, CTA vàng và thẻ vật phẩm với Trang bị.
- Bảng đang gắn → tổng Công/Máu → kho ngọc, mặc định chỉ ngọc đã có.
- Chọn ô để lọc đúng nhóm; tab Tất cả vẫn tra cứu đầy đủ 46 ngọc.
- Chi tiết dùng native dialog: chỉ số cơ bản, vị trí gắn/tháo, phần Wiki thu gọn và ghi rõ giới hạn triển khai combat.
- Giữ bộ khảm nhanh trong phần thu gọn, bỏ nút “Xưởng Ngọc” trung gian; không xóa cơ chế ngọc.

## Bằng chứng đã chạy

`tools/verify-rune-browser.mjs` dùng Chrome thật và HTTP thật tới các handler register/auth/save, DB bộ nhớ riêng (`NODE_ENV=test`, `DB_BACKEND=memory`). Tạo tài khoản fixture, seed rõ 5 loại ngọc; không phải tài sản kiếm qua chiến đấu và không gọi production.

- Desktop 1024 và mobile 390/360: đủ 13 ô, vùng bấm tối thiểu 44×44, từng ô nằm trong bảng, không tràn ngang.
- Dialog desktop và mobile 360×740: CTA 48px nằm trong viewport; Tab/Shift+Tab đi hết vòng, Escape và bấm nền đóng được.
- Gắn → tháo → gắn lại → thay ngọc hoạt động qua nút thật; ngọc khác nhóm bị chặn, ngọc chưa có chỉ được khám phá.
- Hủy không thay ô; đóng từ kho giữ scrollTop 1375 và trả focus đúng thẻ.
- Bộ Oracle chỉ gắn 5 viên đã sở hữu; số lượng/bậc trong `runes` không đổi.
- Đọc lại `/api/save` và reload giữ đúng vị trí ngọc; reduced-motion tắt animation nền/nhân vật.
- Không có `pageerror`; browser và server được đóng trong `finally`.

Kết quả đo: `result.json`. Ảnh: `board-1024.png`, `board-390.png`, `board-360.png`, `detail-desktop.png`, `detail-mobile.png`, `inventory-mobile.png`, `equipped-mobile.png`.

Kiểm mã: `npm run check`, không lỗi. Full suite: 479 tests, 472 pass, 7 skip, 0 fail. Các test mới: `tests/rune-workspace.test.mjs`; test ghi chú Ấn tại `tests/combat-status.test.mjs` đọc module trình bày thật sau khi tách khỏi HTML.

## Giới hạn

Chưa xác minh production, MongoDB bền vững, nguồn thưởng Tàn Tích hoặc combat tự nhiên. Đây là kiểm UI/auth/save với fixture cô lập, không phải kiểm cân bằng hay triển khai toàn bộ thuộc tính Wiki.

## Kiểm thủ công

1. Trang bị → Ngọc: bảng và kho cùng phong cách Trang bị; Đã có không hiện ngọc chưa sở hữu.
2. Chọn ô trống → chọn ngọc cùng nhóm → Gắn ngọc; bấm ô đang gắn để xem hoặc tháo.
3. Chọn Tất cả để tra cứu ngọc chưa có; chỉ có nút Khám phá, không có Gắn ngọc.
4. Đóng bằng Escape/nền/Để sau; vị trí kho không nhảy. Reload giữ ô đã gắn.
