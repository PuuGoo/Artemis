# Cảnh báo đòn boss khớp đạn thực

## Thay đổi

`public/boss-attack-patterns.js` là một nguồn mẫu đòn dùng chung:

- `plan()` tính đúng pha kế tiếp, vị trí xuất phát, góc, tốc độ, sát thương, bán kính đạn và hồi chiêu.
- Nhánh boss trong `updateGame()` gọi `fire()`; phần cảnh báo trong `renderGame()` gọi `draw()` từ cùng module.
- Thay cảnh báo cố định 8 tia / 3 tia / 1 tia bằng đúng mẫu của từng boss: vòng có khe, quạt có khe, hai cụm đan chéo và biến thể cuồng nộ. Ví dụ Zodiac thường có 12 tia thực trong pha vòng vì hai vị trí trong vòng 14 đã bị bỏ để tạo khe, không phải 14 viên.
- Nét đứt hồng có viền tối, tăng độ rõ trên sàn sáng. Vòng quanh boss biểu thị tiến độ nạp. Không thêm vòng gây sát thương giả.
- Giữ cảnh báo ở chế độ hiệu năng thấp và giảm chuyển động hệ thống, chỉ tắt chuyển động cuộn nét đứt. Không thêm ảnh, hạt, gradient hay vòng animation độc lập.

## Các bất biến

Giữ nguyên số đạn, vị trí xuất phát (kể cả hai cụm lệch ±24px), góc bắn, tốc độ, sát thương, bán kính, thứ tự pha, ngưỡng cuồng nộ và hồi chiêu của mọi boss. Không sửa chỉ số quái, `CAMPAIGN_TUNING`, save schema, sở hữu, phần thưởng hay tiến trình. Mẫu đòn không được ghi vào save.

Cảnh báo xuất hiện khi đồng hồ tấn công còn trong khoảng `(0, 0.48)`; băng làm chậm đồng hồ đó như trước. Hướng dự báo theo vị trí người chơi hiện tại, **không chốt aim** từ đầu cảnh báo; boss vẫn có thể đổi hướng nếu người chơi di chuyển. Tia vẽ dài bằng quãng đạn đi trong 0.95 giây, không phải giới hạn tầm bắn hay bản đồ va chạm. Tường/chướng ngại và hitbox vẫn do logic đạn thật xử lý.

## Kiểm chứng

### VM / mã production

8/8 test `tests/boss-attack-patterns.test.mjs` đạt:

- So kế hoạch với oracle trước khi tách, 19 loại boss × 3 pha × 2 mức máu = **114 trường hợp**.
- Chạy chính nhánh bắn và nhánh vẽ trích từ `public/index.html`, không chỉ test module rời: số tia/hướng cảnh báo đúng, đạn bắn và hồi chiêu đúng, cả hai gọi chung module.
- Preview không sửa boss/người chơi; canvas save/restore cân bằng; entity chết/sai tọa độ bị bỏ qua; reduced-motion/lowGfx giữ cảnh báo tĩnh; viền tương phản được vẽ dưới nét hồng.

Oracle `tests/fixtures/boss-attacks-before-extraction.mjs` được giữ để test chạy trên shallow CI không cần git history. Đã đối chiếu fixture với nhánh thật tại `b23f55c` bằng `git show`: **114/114 khớp**, không lấy kết quả từ module mới làm oracle cho chính nó.

### Chrome thật, dịch vụ mock localhost

`tools/verify-boss-patterns-browser.mjs`:

- Dùng constructor `setupRoom()` thật rồi `updateGame()` thật cho **114 trường hợp / 19 loại boss**: đạn, vận tốc, sát thương, bán kính, pha và hồi chiêu đều khớp.
- Đo `lineTo` từ `renderGame()` thật trong vòng `gameLoop()` thật: desktop 1024px (vòng Zodiac 12 tia, quạt Nấm 6 tia), mobile 390px (hai cụm Zodiac 10 tia) và reduced-motion (vòng Nhật Thực 16 tia).
- Mỗi mẫu quan sát ít nhất 3 frame renderer; góc/vị trí tia khớp mẫu bắn, 0 lỗi update/render/JavaScript và 0 tài nguyên local lỗi. LowGfx/reduced-motion có `lineDashOffset = 0`.
- Save snapshot trước/sau không đổi. Writer bị chặn trước state jump; thay đổi best-room tạm do `setupRoom()` được khôi phục ngay. Không DB hay tài khoản thật.
- Harness phục vụ một bản HTML có export **chỉ trong fixture** của `gameLoop`; không thêm API debug vào trang production. Sau `stopGameLoop()`, nút Resume chỉ bỏ pause nên harness phải khởi động lại rAF thật để kiểm renderer, không dùng screenshot của frame cũ làm bằng chứng.

Bằng chứng: `docs/boss-patterns-evidence/verification.json` và bốn ảnh kèm theo. Ảnh mobile sau tăng tương phản có nét hồng nhìn rõ trên nền tối, không che nhân vật đáng kể; vùng giao nhiều hiệu ứng vẫn có thể rối.

### Hồi quy

Toàn suite Node chạy tuần tự, heap128MB: **342 test, 335 đạt, 0 lỗi, 7 bỏ qua** (integration opt-in tắt, không có DB thật). `npm run check`, biên dịch inline scripts và `git diff --check` đạt.

## Giới hạn

Đây là kiểm chứng client trong Chrome thật với state-jump và dịch vụ mock, không phải người chơi tự vượt 19 boss, không phải E2E production. Chưa đo FPS, tỉ lệ thắng hay độ dễ né bằng người chơi. Cảnh báo không mô phỏng đường đạn sau va chạm và không hứa mọi tia luôn nằm trong viewport. Cơ chế đòn của quái thường và toàn bộ hiệu ứng Seal/elemental nâng cao không thuộc task này.
