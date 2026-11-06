# Phase 1 — Battle Mode 2.0: Hang Vàng

## Mục tiêu
Bổ sung Hang Vàng như một chế độ chơi độc lập trong khu vực chọn chế độ. Chế độ này tái sử dụng combat engine, quái, boss, điều khiển, kỹ năng và cách chuyển phòng hiện có.

## Luật của Hang Vàng
- 5 phòng cố định; phòng cuối là boss theo quy tắc isBossRoom hiện tại.
- Dùng bối cảnh và hệ số chương đang chọn, không yêu cầu mở khóa chương để vào mode.
- Vàng rơi trong trận được nhân 3 lần; bonus vàng hiện có của nhân vật vẫn được giữ.
- Chỉ nhận vàng nhặt trong trận: không nhận đá quý, bonus cuối trận của Campaign hoặc trang bị rơi ngẫu nhiên.
- Không cập nhật bestRooms, winsByChapter, Beginner Journey clear hoặc mở khóa chương.
- Kỷ lục phòng được lưu riêng trong modeBest.goldcave.

## Bảo toàn gameplay
- Không sửa getComputedStats, damageEnemy, hurtPlayer, công thức chỉ số, AI hoặc cách điều khiển.
- Các mode hiện có vẫn dùng hệ số vàng 1 và giữ nguyên phần thưởng cũ.
- Không tạo combat engine hoặc loại quái/boss riêng cho Hang Vàng.

## Save compatibility
Server save schema cho phép gameMode và modeBest theo whitelist. Save cũ không có các trường này vẫn mặc định về Campaign và kỷ lục rỗng; những trường save hiện hữu khác không bị đổi cấu trúc.

## Kiểm thử
Chạy:
- node tests/game-modes.test.mjs
- node tests/gold-cave.test.mjs
- npm test
