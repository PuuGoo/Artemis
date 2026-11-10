Pixelfx trong Chiến Dịch Artemis

Nguồn: https://github.com/patch-gg/pixelfx
Revision: 044e12a45dc9cc312cec50ee606dfc98afe5adc2
Giấy phép MIT, Copyright (c) 2026 Patch và Hugo Duprez.
Bản quyền/giấy phép được giữ nguyên tại public/assets/pixelfx/LICENSE.txt.

Phạm vi
- Bản đồ chọn chương: nền sâu hơn, đường chấm nối đảo, quầng sáng chương đang chọn, đảo nổi nhẹ và overlay theo vùng (sương/tia sáng/lá/tuyết/cực quang). Giữ nguyên khóa chương, chọn chương, kéo/cuộn và CTA cũ.
- Sân chiến đấu: layer khí quyển sau nền biome, trước quái/đạn/telegraph; đuốc và cổng dùng sprite Pixelfx khi ảnh sẵn sàng, fallback renderer cũ khi thiếu ảnh hoặc chế độ nhẹ.
- Không đổi hitbox, vật cản, world dimensions, save schema, giá trị combat hay điều kiện mở khóa.
- Không thêm mô phỏng hạt và vòng lặp JavaScript riêng. Atlas bake offline; ảnh runtime LRU tối đa 4 effect, không tải lại liên tục khi lỗi. CSS đảo dừng ngoài viewport, khi tab ẩn, khi vào combat và khi trang bị background. Low graphics/reduced motion tắt lớp mới.

Tái tạo asset
1. Checkout nguồn đúng revision trên ở thư mục scratch.
2. node --max-old-space-size=192 tools/bake-campaign-pixelfx.mjs <đường-dẫn-checkout>
3. Công cụ xuất 7 PNG atlas, JS metadata và CSS keyframes; giữ giấy phép. Khí quyển được downsample alpha-aware còn 160x90/frame; đuốc 16fps, cổng 15fps, khí quyển 5–8fps. Tổng PNG: 3,658,320 bytes.

Kiểm chứng
- node --max-old-space-size=128 --test --test-concurrency=1 tests/pixelfx.test.mjs tests/campaign-world-map.test.mjs tests/rendering/arena-renderer.test.mjs: 14 PASS, 1 browser test opt-in SKIP. Pixelfx renderer chạy VM qua 19 chương x 4 phòng đại diện, bất biến Game và canvas save/restore cân bằng.
- tools/verify-pixelfx-browser.mjs: Chrome thật, local HTTP mock auth/save, sanitizer thật. 19 đảo; click khóa và quay về; desktop 1366/mobile 390/360 không tràn ngang; animation đổi frame, dừng ngoài viewport, giảm chuyển động và low graphics. Khởi động trận bằng UI thật: running=true, 3 quái, HP=775, lastTime tăng. PNG thật tải/giải mã có pixel trong suốt; 7 phòng fixture dùng spawner và renderer production; cổng mở vẽ atlas; low graphics không vẽ atlas; 0 pageerror và 0 HTTP lỗi.
- Ảnh và JSON: docs/pixelfx-evidence/. Các phòng fixture không phải bằng chứng người chơi tự vượt chương; không kiểm tra production/DB thật.
- npm run check: 305 files, 6 inline scripts, 0 lỗi.
- npm run test ở thời điểm trước hai test VM bổ sung: 837 tests, 822 PASS, 6 FAIL, 9 SKIP. Sáu lỗi được tái hiện cùng tên bằng cách chạy các test lỗi với public/index.html của HEAD (baseline oracle, không sửa checkout): battle-ui (2 assertion cũ), chapter-victory (1 assertion cũ), hero-selection-ownership (2 test thiếu stub setCombatImmersive), và file campaign-skill-feedback.test.mjs có sẵn nhưng chưa tracked (2 test). Không sửa các phần ngoài phạm vi để làm xanh giả.
- Công cụ đo pixel thử nghiệm riêng đã bị bỏ vì fixture không qua được bootstrap; không sử dụng kết quả đó để tuyên bố chất lượng/FPS.
- Chưa có benchmark FPS A/B hoặc đánh giá thẩm mỹ độc lập hoàn chỉnh. Ảnh bằng chứng để người dùng duyệt; không gắn nhãn “siêu đẹp” như một số đo đã xác nhận.

Trạng thái deploy/production không nằm trong phạm vi kiểm chứng ở trên; xem lịch sử Git để xác định commit xuất bản.
