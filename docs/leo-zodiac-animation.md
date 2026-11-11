# Leo Zodiac Guardian — Chương 12

Tích hợp hình ảnh 22 khung (Idle 6, Attack 6, Hit 4, Death 6), không đổi combat, hitbox, thưởng, AI hoặc save.

## Bốn PNG cần bổ sung vào nhánh này trước khi merge

- public/assets/zodiac/leo-idle.png (3072x512)
- public/assets/zodiac/leo-attack.png (3072x512)
- public/assets/zodiac/leo-hit.png (2048x512)
- public/assets/zodiac/leo-death.png (3072x512)

Các file có trong ZIP artemis_leo_integration.zip của cuộc trò chuyện này, mỗi khung 512x512 RGBA. Nhánh hiện tại có code và fallback; PNG chưa được upload trực tiếp nên chưa thể bật visual mới trên GitHub.

## Tích hợp và kiểm thử

Mở ZIP và chạy: node apply-leo.mjs /path/to/Artemis

Sau đó trong repository chạy: npm run check && npm test

Kiểm tra Chương 12 và trang Admin với browser. Toàn bộ các boss hoàng đạo khác và boss Leo khi ảnh lỗi đều dùng Canvas vector có sẵn. Death có afterimage nếu portal đã mở và boss bị loại khỏi danh sách.
