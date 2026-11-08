# Rendering game và preview admin

`arena-renderer.js` là nguồn renderer Canvas duy nhất của ArenaV2.
Nạp classic script `/js/game/rendering/arena-renderer.js`, rồi gọi
`ArtemisArenaRenderer.create()` để tạo instance riêng cho từng consumer.

- Giữ Game, cache sàn, biome và WeakMap visual riêng trong từng instance.
- Chỉ render và xử lý visual như trước; không đưa công thức damage, thưởng hoặc save vào đây.
- Không chuyển sang ES module/defer mà chưa chuyển bootstrap cùng lúc.
- Các module sprite/VFX khác hiện còn ở `public/`; chỉ chuyển theo đợt có cập nhật caller/test.
- Tài nguyên vẫn dùng URL theo trang `public/index.html` hoặc `public/admin.html`,
  không tự thêm tiền tố asset theo thư mục chứa script.

Test: `tests/rendering/arena-renderer.test.mjs` và các test renderer liên quan ở `tests/`.
Browser fixture: `tools/verify-arena-renderer-browser.mjs` (cần đủ RAM và playwright-core đã có).
