# Điều chỉnh chiến dịch: Leo thành Chương 1

- Chỉ còn 12 chương chiến dịch, tương ứng 12 cung hoàng đạo.
- Thứ tự mới: Chương 1 Leo (chương 12 cũ), Chương 2–5 Aries/Taurus/Gemini/Cancer (chương 8–11 cũ), Chương 6–12 Virgo đến Pisces (chương 13–19 cũ).
- Bỏ 7 chương chiến dịch đầu trước đây khỏi danh mục hoạt động. Tài nguyên ảnh SVG cũ vẫn giữ trong repository để không làm mất dữ liệu hoặc làm hỏng liên kết cũ; không được truy cập từ chiến dịch hiện hành.
- Mỗi chương có 50 phòng; boss phụ ở 10/20/30/40, boss hoàng đạo ở phòng 50. Leo dùng bốn sprite sheet Idle/Attack/Hit/Death hiện có.
- Độ khó được điều chỉnh theo số chương mới bằng bảng CAMPAIGN_TUNING gốc dành cho các mức 1–12; không giữ nguyên 142.415 HP của Leo khi trước là Chương 12. Cần playtest lại độ khó Chương 1.
- Tiến trình save được chuyển từ legacy IDs sang IDs mới bằng /campaign-order.js. Không di chuyển thành tích của chương 1–7 cũ sang chương nào mới. Checkpoint đang dang dở của chiến dịch cũ bị vô hiệu hóa để tránh tiếp tục ở sai boss.
- Trường campaignOrderVersion=2 được lưu và xác thực ở client/server để chuyển đổi đúng một lần.

Chưa merge vào main. Cần kiểm tra node tests, Admin inspector và browser thực tế, cùng các hồi quy của chiến dịch/tân thủ trước khi phát hành.
