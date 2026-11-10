# Phản hồi hình ảnh chiến dịch

## Sáu phần đã nối
1. Boss: vòng triệu hồi + khe Pixelfx khi spawner tạo boss; co vòng và tàn sáng tại nhánh onEnemyKilled thật. Không thêm invulnerability hoặc hit-stop.
2. Vật trang trí tường: dung nham sủi, tinh thể lóe, nấm/bào tử, phù văn; chọn theo biome thực tế của arena renderer. Không thêm obstacle.
3. Dọn phòng: hạt sáng chạy về cổng, vòng sáng mở rộng, sự kiện có hạn 1,6 giây.
4. NPC: màu riêng thiên thần/ác quỷ/Valkyrie, vòng chân, hạt/lông sáng cách điệu và nhịp khi vào vùng gần. Không sửa controller nhận thưởng.
5. Mở chương: chỉ lần thắng đầu tiên qua finishRun thật tạo thông báo trang trí; bản đồ chỉ tiêu thụ khi đang hiển thị và chương thật sự mở. Cuộn đến đảo, vòng phong ấn và đường nối sáng, không đổi selectedChapterIdx. Chỉ giữ thông báo trong phiên, không thêm field save.
6. Chuyển phòng: hạt tro/băng/sao và viền mờ trong 0,42 giây ngay sau setupRoom từ portal thật; không chờ animation mới spawn.

## Thiết kế an toàn
- Module public/campaign-map-juice.js dùng WeakMap theo Game; không thay schema, HP, enemy stats, hitbox, rewards, collider.
- Clock theo updateGame và đứng yên khi pause. Không thêm requestAnimationFrame/timer độc lập.
- Cả low graphics và reduced motion tắt lớp mới; trang trí sàn dưới quái/telegraph, chuyển cảnh không flash trắng toàn sân.
- Không thêm asset atlas: dùng portal Pixelfx hiện có và vector nhỏ cho sự kiện.
- Hiệu ứng hạ boss cuối không trì hoãn finishRun: nếu bảng kết quả mở và loop dừng ngay thì animation có thể không chạy hết. Đây là chủ ý giữ luồng kết thúc trận, không thay thời gian gameplay.

## Kiểm chứng
- tests/campaign-map-juice.test.mjs: 5 PASS, vòng đời/giới hạn event, pause/reset, unlock một lần, đủ hook production, canvas cân bằng và bất biến Game, low/reduced motion, nhánh scenery.
- Cùng tests/pixelfx.test.mjs + tests/rendering/arena-renderer.test.mjs: 17 PASS, bao gồm assertion scenery.
- Chrome thật local HTTP mock auth/save + sanitizer thật: mở trận bằng click, clock chạy, 3 quái, HP=775. Spawner boss phòng 10 thật; damageEnemy thật kích hoạt boss-death và clear. Fixture phòng thường tiếp xúc portal qua updateGame thật sang phòng 2 và phát transition. Renderer NPC được chạy với fixture 3 loại, không thay player/enemies/obstacles/portal. finishRun(true) là HOOK trong fixture, không phải tự chơi thắng; mở khóa chương 2 có class thật và không replay sau hết animation. Không pageerror, không HTTP lỗi. Kết quả docs/map-juice-evidence/verification.json.
- Ảnh mở khóa đã xem: quầng nhẹ, tên vùng đọc rõ. Chưa benchmark FPS A/B, chưa chứng minh tự nhiên vượt cả chương, chưa kiểm tra production.
- npm run check: 307 file, 6 inline script, 0 lỗi (trước chỉnh hai assertion test).
- Full suite: 844 test, 827 PASS, 8 FAIL, 9 SKIP trước chỉnh hai test cửa sổ nguồn. Hai lỗi mới là cửa sổ 300/900 ký tự trong bestiary/hud-progress bị hook làm cụt; đã thay bằng ranh giới đoạn logic và chạy cả hai file PASS. Sáu lỗi còn lại trùng baseline đã ghi ở docs/pixelfx.md; chưa chạy lại full suite sau sửa assertion, không gọi full suite xanh.

Trạng thái xuất bản được xác định bằng lịch sử Git; chưa xác minh deploy production.
