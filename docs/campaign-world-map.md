# Bản đồ đảo Chiến Dịch

Toàn bộ 19 chương hiện có hiển thị trên bản đồ cuộn dọc, chương cao ở trên, chương 1 ở dưới, đảo xen kẽ và hình minh họa riêng. Danh sách lấy từ `getCampaignChapters()` trả bản sao metadata của CHAPTERS; việc chọn/mở khóa vẫn dùng handler và điều kiện thật của game.

- Vuốt cảm ứng, lăn chuột, giữ chuột trái kéo; kéo quá ngưỡng không chọn nhầm đảo.
- Phím lên/xuống/Home/End chuyển focus; Escape về chương hiện tại.
- Đảo khóa có ổ khóa, nền tối và điều kiện thắng chương trước; vùng khóa chuyển nền tím. Không thêm điều kiện chế độ Khó không tồn tại.
- Khi khám phá xa chương hiện tại, ẩn banner/CTA/shortcut dưới để không che bản đồ, giữ menu hai bên/chat và nút trở về. Trở về xóa preview khóa trước khi khôi phục CTA.
- Giữ vị trí cuộn sau render lobby. Chuyển chế độ khác không hiển thị danh sách chương.
- Hình SVG được vẽ lại, không phải asset gốc và không tuyên bố khớp từng pixel.

## Kết quả kiểm chứng

Chrome thật với auth/save fixture bộ nhớ cô lập (không DB production): 19/19 chương, wheel, kéo chuột trái, vuốt native touch, preview khóa không đổi selected save, return, chọn chương đã mở, sao hoàn thành, bàn phím, đổi mode, giữ vị trí sau render và vào trận thật. Không lỗi JavaScript hay asset thiếu.

`PLAYWRIGHT_MODULE=<path to playwright/index.mjs> node tools/verify-world-map.mjs`

`PLAYWRIGHT_MODULE=<path to playwright/index.mjs> node --test tests/campaign-world-map.test.mjs` → 3/3 đạt.

`npm run check` → 251 files, 6 inline scripts, 0 lỗi.

Toàn suite sau tích hợp: 653 đạt, 4 lỗi cũ, 7 bỏ qua (battle-ui, chapter-victory, hai fixture hero-selection-ownership). Ảnh/báo cáo ở `docs/world-map-evidence/`.
