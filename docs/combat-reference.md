# Combat theo ảnh tham chiếu

## Đã tích hợp

- Loading sọc xanh/vàng/mint và mascot ma cà rồng SVG nguyên bản trong khung app; chờ thao tác khởi tạo và tải ảnh thật, không chèn tiến độ giả.
- Màn chọn năng lực: 3 thẻ lúc bắt đầu, 2 thẻ khi gặp Valkyrie, ribbon vàng, thẻ xanh, làm mới theo quota thật và danh sách kỹ năng đã học. Không thay listener/cơ chế cấp kỹ năng gốc.
- Sân dọc: thế giới480×1200, khung nhìn480×853⅓, fit9:16 trên mobile/desktop; camera theo nhân vật cả hai hướng, tọa độ joystick tính theo viewport và bù camera khi vẽ. Sàn đá/tường, cửa tím và cổng sáng Tiến Lên bằng renderer2D.
- HUD gọn: level/XP/vàng, pause, tốc độ×1/×3 thực, thời gian chơi không tính pause, phòng và số kỹ năng. Nút tím mở kỹ năng đang dùng; chưa phải kỹ năng chủ động/cooldown giống bản gốc.
- Phòng5/15/25/35/45 không quái, đạn hay loot; chỉ Valkyrie chọn phước lành và cửa tiếp tục. Boss10/20/30/40/50 giữ nguyên. Safe rooms không cấp XP; giảm EXP threshold base66→59 để cả19 chương vẫn lên cấp10 ở phòng40–47 từ chiến đấu.
- NPC vòng quay tại phòng đã sạch4/14/24/34/44:6 ô thưởng vàng/cuộn vũ khí, Start, animation và chạm vùng trống để đến kết quả ngay. Chạm lần nữa đóng thưởng.
- Kết quả vòng quay xác định theo runId/chapter/room; lưu ready trước claimed, server xác minh index, gold và scroll delta, không cho xóa/nhận lại receipt. Receipt giữ qua các phòng sau và reload. Đây là xác minh biên nhận, không phải chiến đấu server-authoritative.

## Kiểm chứng

- Chrome route thật với auth/save fixture: entry3cards, Valkyrie2cards và cả5 phòng không enemies/bullets/drops, camera cuộn hai chiều, NPC/wheel/skip/reward, không lỗi JS hoặc asset thiếu.
- Chrome+HTTP auth/save thật trên memoryDB cô lập: ready/claimed được server nhận, sang phòng5 giữ receipt và không cộng lại thưởng. Có fixture nhảy phòng để kiểm tra, không phải chơi tự nhiên50 phòng.
- 24 test targeted mới đạt; full suite699 đạt/4 lỗi baseline/7 skip. Syntax269 files/6 inline scripts/0 lỗi.
- `tools/verify-combat-reference.mjs`, `tools/verify-wheel-http.mjs`; ảnh tại docs/combat-reference-evidence.

## Đối chiếu BlueStacks và giới hạn

Đã quan sát một lượt Chương3 trên BlueStacks1080×1920, chọn kỹ năng, NPC/quay nhận630coin, cửa Tiến lên và chuyển vài phòng. Đã để game tạm dừng. Chưa thấy Valkyrie và chưa hoàn thành chương, không suy diễn Lv.2 thành tầng2. Nhật ký cục bộ nằm ở Hermes scratch/archero-observe.

Đồ họa vẫn là engine2D bevel và asset vẽ lại, chưa khớp pixel100% với engine3D gốc. Không tuyên bố đã chơi tự nhiên từ đầu tới thắng50 phòng hoặc đã xác minh deploy production.
