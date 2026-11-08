# VFX trạng thái bằng texture

- Cháy, độc và chậm/băng dùng sáu texture riêng, lấy từ asset pack do người dùng cung cấp; thêm hai texture spark/smoke dự trữ, chưa nối vào combat.
- WebP 128×128 có alpha. Quyền sở hữu thuộc tác giả bản gốc; mục đích học tập không thay thế giấy phép phân phối.
- Nối qua `ArenaV2.drawMonster` đang hoạt động, trước telegraph/thanh máu; renderer legacy gọi cùng helper. Admin giữ bản sao ArenaV2 đồng bộ, bỏ qua an toàn khi không tải module.
- Seed lưu trong WeakMap theo entity, không dựa trên vị trí thay đổi và không ghi vào save. 4–7 hạt/trạng thái; lowGfx/reduced-motion không vẽ hạt.
- Không sửa sát thương, timer, HP, hitbox hay save; giữ globalAlpha của caller.

## Bằng chứng

- 12 focused tests đạt (status VFX + admin campaign), gồm ánh xạ trạng thái, seed ổn định, không sửa entity, alpha texture và đồng bộ renderer.
- Full suite tuần tự với integration opt-in tắt: exit 0; npm run check và git diff --check exit 0. Integration DB không được xác minh.
- Chrome localhost mock auth/save: 8 texture tải/giải mã, 15 lần drawImage VFX trong một lần gọi renderGame production trên quái do game sinh; mỗi loại burn/poison/frost vẽ 5 hạt, 0 lỗi JS, gọi lớp vẽ không sửa entity. Chi tiết trong `status-vfx-evidence/verification.json`.
- Harness dừng update, đặt timer trên quái fixture và gọi renderGame qua handle chỉ tiêm vào HTML phục vụ test. Đây là kiểm chứng renderer thật, không phải bằng chứng người chơi tự gây đủ ba trạng thái trong trận hoặc E2E production.
- Chưa đánh giá thẩm mỹ bằng mắt; screenshot được lưu để kiểm tra sau.
