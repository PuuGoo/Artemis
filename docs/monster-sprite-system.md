# Artemis – hệ thống sprite sheet cho quái và kỹ năng (đợt 1)

## Đã tích hợp

Hệ thống mới không ghi vào `Game`, `enemy`, `SaveState`, collision, hitbox,
AI, HP, ATK, cooldown hay damage. Renderer chỉ đổi hình ảnh khi asset sẵn sàng.

- Quái thường có atlas thật: **Slime Lam** (icon gốc `Icon_SmilmeSmall_ccca1d.png`)
  và **Dơi Tro Đỏ** (icon gốc `Icon_Bat_Gray_4f8a9c.png`).
- Kỹ năng đã có atlas: **fire_arrow, ice_arrow, venom_arrow, lightning_arrow**.
- Các quái chưa có atlas hoặc tải ảnh lỗi được vẽ bằng `MonsterArt.draw` như trước.
- Khi nhân vật có nhiều nguyên tố hoặc vũ khí đặc biệt, giữ
  `SkillCombatVfx.projectile` cũ để không làm mất hiệu ứng kết hợp.
- Bốn boss phụ Leo và boss Leo vẫn dùng pipeline sprite PNG hiện có.
- Trang duyệt: `/monster-sprite-studio.html`.

## Quy cách sprite atlas cho quái thường

| Hàng (0-based) | Trạng thái | Frame | Ý nghĩa |
|---|---|---:|---|
| 0 | Idle | 6 | Chờ / đi bộ |
| 1 | Attack | 6 | Ra đòn thường theo nhịp tấn công |
| 2 | Hit | 6 | Trúng đòn, dựa trên `hitFlashTimer` |
| 3 | Death | 6 | Chết, còn lưu hình ảnh sau khi entity bị loại |
| 4 | Skill | 6 | Niệm / bắn kỹ năng có thật của quái tầm xa hoặc quái tinh anh |

Mỗi frame **160 × 160px**, cùng gốc tọa độ chân nhân vật, **6 cột × 5 hàng**,
tổng **960 × 800px**. Nền trong suốt. Ảnh SVG được xuất thành từng frame khác nhau,
không quay/nghiêng một icon duy nhất. Có thể thay bằng PNG nền trong suốt nếu
vẫn đúng chiều và căn chân. Có thể thay thông số `scale` / `foot` trong
`public/monster-sprite-animation.js` mà không thay hitbox.

Khung Attack/Skill dùng `attackTimer` thật để chạy hết sáu frame trong cảnh báo
0,75 giây. Khung cuối được giữ thêm 140ms sau khi projectile thực sự bắn ra.
Hit chỉ chơi khi `hitFlashTimer` kích hoạt và không cắt animation Attack.
Death chạy sau khi quái bị loại khỏi `Game.enemies` theo cùng phòng đang hiển thị.

Tất cả phép vẽ được neo tại chân quái và bọc `ctx.save()/ctx.restore()`.
`lowGfx` và `prefers-reduced-motion` dùng key pose tĩnh.

## Quy cách sprite atlas kỹ năng

`public/assets/skill-sprites/elemental-projectiles.svg`: mỗi frame **128 × 128px**,
6 cột × 4 hàng, tổng **768 × 512px**. Thứ tự hàng:
0 Lửa · 1 Băng · 2 Độc · 3 Sét. Renderer 90ms/frame; đối tượng `bullet` và
`player.skills` hiện hành quyết định loại kỹ năng thực sự xuất hiện.

## Thêm quái tiếp theo

1. Lấy hình gốc trong `public/assets/monsters` làm tham chiếu tạo tư thế.
2. Vẽ đủ năm hàng (không ghép nhầm frame Attack thành Death).
3. Đưa atlas vào `public/assets/monster-sprites/`.
4. Đăng ký đúng **file icon gốc** và đường dẫn trong `MANIFEST` của
   `monster-sprite-animation.js`, căn chỉnh `foot` và `scale`.
5. Xem ở Studio, thử Attack/Hit/Death và phòng game thật.
6. Kiểm tra `npm run check`, `node --test tests/monster-sprite-sheets.test.mjs`,
   và `npm test`.

## Phạm vi đang chờ mở rộng

Đây là nền tảng + **hai mẫu quái thật và bốn kỹ năng nguyên tố**, chưa phải tất cả
quái có trong các chương. Đợt tiếp theo nên bổ sung Goblin, pháp sư xương,
tháp hoa, rồng con và từng hiệu ứng riêng, sử dụng đúng asset/biome gốc.
