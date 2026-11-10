# Giao diện sảnh theo ảnh tham chiếu

Màn Chiến Dịch mặc định dùng khung dọc tối đa 562px, nền bản đồ xanh, đảo trại SVG tự vẽ, nhãn chương lấy từ renderer hiện tại, shortcut dùng handler hiện hữu và nút Bắt Đầu giữ nguyên flow briefing → xuất chiến. Trên desktop khung game được căn giữa.

`native-campaign.css/js` và `native-navigation.css/js` được nạp sau stylesheet hiện hữu. Không thay đổi API, số dư, save hay nội dung chương để giả lập ảnh. Thanh chat ghi rõ chưa khả dụng vì bản này chưa có dịch vụ chat. Chương đã hoàn thành hiển thị chi phí chơi lại ⚡ ×5; chi phí chỉ trừ khi xác nhận khởi tạo lượt mới thành công. Hủy xác nhận, tiếp tục checkpoint và chương chưa hoàn thành không bị tính phí chơi lại. Trạng thái hoàn thành chỉ xuất hiện khi renderer báo chương đã hoàn thành.

Asset minh họa được vẽ lại, không phải bộ asset gốc của ảnh tham chiếu; do đó không tuyên bố giống pixel 100%. Tên chương, tiến độ và tài nguyên phản ánh dữ liệu tài khoản thật, không chép dữ liệu người chơi trong ảnh.

## Kiểm tra

- `npm ci --no-audit --no-fund`
- `npm run check`
- `node --test tests/native-campaign.test.mjs tests/native-navigation.test.mjs`
- `npm test`
- `PLAYWRIGHT_MODULE=<absolute path to playwright/index.mjs> node tools/verify-native-ui.mjs`

Browser verifier mở Chrome thật với fixture auth/save bộ nhớ cô lập, không đọc `env` và không gọi DB production. Kiểm tra kích thước 562×1001, 390×844 và 1280×900, 5 tab, briefing và vào combat thật. Ảnh và báo cáo nằm trong `docs/native-ui-evidence/`. Đây là kiểm thử local, không phải xác nhận deploy production.

Lần kiểm tra sau cài dependency nhưng trước khi hoàn thiện giao diện có 4 lỗi suite cũ: assertion vị trí thanh HP trong `battle-ui`, assertion cú pháp handler `btnReturnLobby` trong `chapter-victory`, và hai fixture hero ownership thiếu stub `setCombatImmersive`. Không sửa các bài test này để che kết quả.
