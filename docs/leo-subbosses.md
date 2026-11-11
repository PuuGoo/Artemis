# Chương 1 – Thánh Điện Nhật Luân: bốn boss phụ

Bốn thủ lĩnh là boss phụ của Chương 1 (Sư Tử) ở các phòng 10, 20, 30, 40.
Phòng 50 vẫn là Sư Vương Thái Dương (Leo). Không đổi boss của Chương 2–12.

| Phòng | Boss phụ | Nhận diện chibi Canvas | Đòn đặc trưng | Cách né |
|---|---|---|---|---|
| 10 | **Kim Giáp Sư Vệ** | Sư tử giáp vàng, bờm tia nắng, khiên mặt trời | **Khiên Nhật Luân** – quạt phi đao có khe né và khoảng trống sau lưng | Đi vòng qua cạnh khiên, phản công lúc hồi chiêu |
| 20 | **Nhật Ấn Tế Sư** | Tế sư tóc tím, áo hồng, trượng nhật ấn, đôi pháp cầu | **Song Ấn Quang Tiễn** – hai gốc bắn lệch tâm | Né giữa hai luồng và lợi dụng vật cản |
| 30 | **Xích Diệm Đao Vương** | Kỵ sĩ đỏ sẫm, mũ sừng, đại kiếm rực lửa, áo choàng | **Xích Diệm Liên Trảm** – nhiều đường chém so le | Đọc nhịp cảnh báo, di chuyển vào khe trống |
| 40 | **Thiên Dực Nhật Long** | Rồng ngọc xanh, sừng vàng, cánh lớn, bụng kem | **Thiên Dực Nhật Triều** – hai cánh đạn đan, đòn bắn dày hơn | Di chuyển về phía sau boss sau lượt phát xạ |

## Quy tắc triển khai

- Bộ tạo hình được dựng bằng Canvas 2D trong renderer hiện tại; không dùng sprite quái ngẫu nhiên cho bốn boss này. Các sprite của quái thường và boss ở chương khác không đổi.
- campaignChapter=1, campaignRoom=10/20/30/40 và loại boss gốc phải khớp mới kích hoạt tạo hình. Điều này tránh lẫn sang Boss Rush, tháp và chương khác.
- Không đổi type gốc (golem/queen/demon_king/elder_dragon), hitbox, luật di chuyển, hệ thống vật cản, rơi vật phẩm hay lưu tiến trình.
- Đạn vẫn dùng một kế hoạch chung cho bắn thực và cảnh báo trong BossAttackPatterns; mỗi boss có bộ góc bắn, tốc độ, vị trí bắn và thời gian hồi chiêu riêng.
- Sát thương mỗi viên vẫn dựa trên ATK có sẵn; tốc độ đạn tối đa 320 và cooldown tối thiểu 1,2 giây. Dưới 35% HP boss bắn nhanh hơn nhưng vẫn giữ giới hạn trên.
- Trang Admin sử dụng cùng renderer và thông số catalog với gameplay, hiển thị boss phụ trong biome Thánh Điện Nhật Luân.
- Cần playtest trực tiếp trên máy và điện thoại để điều chỉnh lượng đạn, độ rõ cảnh báo và độ khó tân thủ. Kiểm thử tự động chỉ xác nhận cấu trúc, số liệu, sự khớp giữa cảnh báo và đạn bắn.
