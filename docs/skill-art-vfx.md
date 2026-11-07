# Ảnh kỹ năng và hiệu ứng chiến đấu

## Phạm vi đã nối vào game

- 143 PNG từ đúng danh sách kỹ năng người dùng cung cấp; 1.783.189 byte. Không lấy ảnh gear/hero/rune/artifact cùng thư mục.
- 72 kỹ năng hiện có trong engine: 68 có hình local, 4 giữ biểu tượng cũ vì định danh ảnh chưa chắc: `water_walker`, `slow_field`, `meteor_shower`, `lightwing_arrow`.
- 75 ảnh đã nhập nhưng chưa gắn vào kỹ năng engine (bao gồm kỹ năng chưa hỗ trợ và ảnh chưa rõ ánh xạ). Xem `skill-art-coverage.json` và `SkillArtData.assets` để có danh sách, nguồn và hash từng ảnh.
- 4 đường UI thật: thư viện/ghim kỹ năng, chọn kỹ năng khi lên cấp, HUD kỹ năng đã nhận, tóm tắt trận. Ảnh `contain`, không chặn click, có emoji fallback khi tải lỗi.
- Nguồn được giữ độc lập: 100 hàng wiki revision 1858 và 100 hàng bảng mobi.gg. Bảng tham chiếu mở trong thư viện kỹ năng, không ghi đè mô tả/chỉ số chiến đấu. S–F là hạng biên tập, không phải độ hiếm. Không nhập hoặc chạy script/CSS của HTML nguồn; chỉ đọc các ô bảng. Phần văn xuôi ngoài bảng mobi.gg không được nhập.

## Hiệu ứng thật

`SkillCombatVfx` đã nối trực tiếp vào renderer sản xuất:

1. Đạn: 4 silhouette nguyên tố (lửa, băng, độc, sét), giữ nhiều nguyên tố bằng dấu phụ; phi kiếm có lưỡi/chuôi, kế thừa nguyên tố chỉ khi có `magic_strike`; Lightwing có cánh. Giữ fallback vũ khí cũ khi không có kỹ năng liên quan.
2. Cầu xoay: hút máu, trung tính và beam có hình khác nhau. Không tiếp tục giả hiển thị lửa/băng luân phiên khi cơ chế cầu gộp hiện có không áp các nguyên tố ấy. Vị trí/góc/radius giữ nguyên để khớp va chạm.
3. Thiên thạch: dấu điểm rơi, vệt theo hướng rơi và lõi lửa, vẽ từ `progress` cũ. Không giả thêm nguyên tố ngẫu nhiên khi entity hiện không lưu nguyên tố.
4. Tinh linh/khiên: hình hộ vệ tại điểm phát đạn thật, tia laser/vua và bom khác nhau; vòng khiên chỉ hiện khi `sacredShieldStacks > 0`.

Không đổi damage/hitbox/timer/save. Engine đang gộp nhiều biến thể (`orbit_orbs`, `assault_strike`, cả ba loại tinh linh chung nhịp phát); đây không phải bản triển khai đủ 143 kỹ năng. PNG chỉ là icon, không dùng làm sprite sheet/đạn kéo giãn. Không sinh thêm particle/entity/image cache. Vệt đạn tối đa 6 điểm; lowGfx/reduced-motion bỏ vệt và nhún/xoay trang trí, vẫn giữ chuyển động vật thể thật để không lệch hitbox.

## Kiểm chứng

- `node --max-old-space-size=128 --test tests/skill-art-vfx.test.mjs`: **7/7 PASS**, VM gọi renderer đạn sản xuất, helper VFX thật, kiểm tra ảnh, tham chiếu, không đột biến dữ liệu, cân bằng save/restore, nhánh lowGfx/reduced-motion, compile mọi inline script.
- `node --max-old-space-size=128 --test tests/battle-ui.test.mjs`: **48 kiểm tra PASS**, suite cấu trúc nguồn có sẵn (không phải browser).
- `git diff --check`: PASS.
- Browser/gameplay và đánh giá hình cuối trong UI: **NOT TESTED**. RAM đầu phiên chỉ 1.153 MB, sau đó 2.027 MB; không mở browser. Chưa đo FPS/rasterization.
- Không commit/push, không thao tác tài khoản/cloud save.
