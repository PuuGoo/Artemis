# Tab Chiến Đấu — Viễn chinh ánh trăng

## Thay đổi

- Bỏ bộ chọn chương cũ bị `renderChapterSelectStrip()` tự hiện lại sau mỗi render. Giữ hàm tương thích nhưng vùng cũ luôn ẩn và rỗng.
- Chỉ một nút bắt đầu thật (`btnStartGame`) trong thanh xuất chiến sticky. Cả 5 chế độ dùng màn xác nhận đúng chế độ; không lấy tên chương cho Luyện Tập/Tháp/Vô Tận/Săn Trùm.
- Đổi chương trong disclosure có trạng thái khóa/xem trước. Xem chương khóa không sửa chương xuất chiến, không lưu và vô hiệu hóa bắt đầu; có nút quay lại. Bỏ lời gọi `renderChapterHeader()` không tồn tại.
- Phân biệt kỷ lục với checkpoint: bắt đầu mới từ phòng 1, chỉ checkpoint hợp lệ của chiến dịch/chương hiện tại mới có nút Tiếp tục. Không đưa checkpoint chiến dịch sang chế độ khác.
- Đội hình tóm tắt và danh sách anh hùng/trang bị thu gọn, giữ điều kiện sở hữu. Thêm hướng dẫn điều khiển và lối mở Cách chơi/Sổ tay.
- Bảng màu navy/teal/vàng nhạt, tranh chương có aurora/quỹ đạo nhẹ. Animation CSS dùng transform/opacity; tắt khi reduced-motion/hiệu năng thấp và pause khi tab ẩn. Không thêm canvas/particle/timer cho lobby.
- Briefing đóng bằng nút, nền và Escape, có focus trap và trả focus. Bỏ đánh giá mạnh/yếu dựa trên ba mốc lực chiến hardcode không còn đúng với 19 chương.
- Đồng bộ snapshot renderer admin với renderer quái hiện hành; bổ sung dependency MonsterArt thật vào test sở hữu vốn thiếu từ lần cập nhật Monsters trước.

## Bằng chứng

`tools/verify-battle-hub.mjs` chạy Chrome thật với auth/save mô phỏng trong bộ nhớ, không MongoDB, không tài khoản thật, không đọc `.env`. Tất cả request ngoài localhost bị chặn, ngoại trừ GET các CDN Tailwind/font sẵn có. Không phải production E2E.

- Trước sửa (`dc0b831`): nội dung desktop 2594px, mobile390 4081px. Nút bắt đầu mobile nằm ở y4085.875, không trong viewport. Bộ chọn chương cũ vẫn hiện.
- Sau sửa: desktop 957px, mobile390 1374px. Nút bắt đầu mobile ở y709, cao50px, nhìn thấy và hit-test được ngay khi chưa cuộn. Không tràn ngang tại1280/1024/390/360px.
- PASS Chrome: xem chương khóa/quay lại; disclosure đội hình; chặn anh hùng chưa sở hữu; Cách chơi; Sổ tay; briefing cả5 chế độ; focus trap/Escape/trả focus.
- PASS Chrome: `battle-orbit`/`battle-aurora` thực sự chạy; reduced-motion có0 animation trên các descendant; khi tab ẩn animation paused.
- PASS Chrome smoke: bấm nút thật vào trận, running=true, paused=false, phòng1, quái2, HP775, canvas300700 pixel có alpha, không lỗi JS/tài nguyên local. Không tuyên bố chơi hết chương hay đo FPS.
- Bằng chứng JSON/ảnh trong `docs/battle-hub-evidence/`; baseline đọc trực tiếp từ Git, không tạo bản checkout khác.
- PASS các unit/VM/source test chiến đấu và `npm run check`; full suite chạy tuần tự, giới hạn heap128MB, integration thật/Mongo thật không có opt-in nên SKIP/BLOCKED.

## Giữ nguyên

Không thay save schema, cấp quyền sở hữu, giá nâng cấp, sát thương, hitbox hay đường cong HP/ATK chiến dịch trong task giao diện này.

## Kiểm tra thủ công

1. Vào Chiến Đấu: thấy điểm đến và nút Bắt đầu lượt mới mà không cần kéo tới cuối.
2. Mở Đổi chương → chọn chương khóa: hiện điều kiện, không bắt đầu được; Về chương đang chơi khôi phục nút.
3. Chọn Luyện Tập → Bắt đầu lượt mới: màn xác nhận ghi Luyện Tập và không nhận thưởng; Escape quay về đúng nút.
4. Mở Đổi anh hùng & xem trang bị: tướng chưa mở có khóa, không được chọn. Đóng lại để gọn màn hình.
5. Xuất chinh: vào trận thật; bật Hiệu năng hoặc reduced-motion để tắt hiệu ứng trang trí.
