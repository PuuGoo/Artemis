# Tuần Tra AFK và chơi lại chương

## Hành vi

- Chọn lại đảo chương đã hoàn thành sẽ căn giữa đảo và hiện nút Bắt Đầu với chi phí chơi lại5 năng lượng. Chương khóa chỉ xem trước.
- Sảnh có nút Tuần Tra mở bảng thu nhập, giờ tích lũy, tốc độ vàng/EXP và vật phẩm. Đồng hồ và phần thưởng được tính từ thời gian máy chủ, tối đa24h; lần đầu mở bắt đầu mốc tích lũy, không tạo thưởng ngược thời gian. Tối thiểu60 giây để nhận.
- Tuần Tra Nhanh cho2h thưởng, tốn5 thể lực, tối đa3 lần/ngày UTC và không xóa thời gian AFK đang có.
- Phần thưởng thực gồm vàng, EXP tuần tra, sáu loại cuộn nâng cấp và Aurocite theo chương đã vượt. Không giả trang bị/rune rơi. EXP lưu cộng dồn vào patrolExp; chưa tự nâng cấp tài khoản.
- Nút quảng cáo miễn phí chưa khả dụng vì chưa có nhà cung cấp xác minh quảng cáo. Không tự phát thưởng hoặc báo đã xem quảng cáo.
- Bảng Thưởng đã nhận chỉ hiển thị sau giao dịch máy chủ thành công. Request UUID được giữ khi mất phản hồi; CAS và sổ biên nhận chống nhận hai lần.

## Lưu trữ và triển khai

`ledger.patrol` do server quản lý; snapshot client không được sửa EXP hay xóa trạng thái AFK. Save thường giữ ledger và EXP. Cloud flush trước giao dịch, khóa ghi, tải lại save chính xác trước khi cho thao tác tiếp.

`/api/patrol` được rewrite sang function privileges với discriminator patrol để giữ giới hạn12 Vercel Hobby functions. Không nới ngân sách economy toàn cục.

Giới hạn hiện tại: nguồn winsByChapter vẫn dựa trên save combat hiện hữu; sổ dedupe giữ tối đa4096 UUID, sau đó từ chối an toàn thay vì cấp trùng. Chưa có archival biên nhận.

## Kiểm chứng

Chrome thật với HTTP auth/save/patrol handler thật, DB bộ nhớ cô lập (không production): mở bảng, đồng bộ revision lần đầu, nhận nhanh20→15 thể lực, +480 vàng/+240 EXP ở tài khoản mới, đọc lại từ server đúng, lưu tiếp và reload giữ thưởng. Không lỗi JS. Kiểm tra bản đồ xác nhận chọn lại nhiều chương đã thắng hiện CTA và briefing đúng.

`PLAYWRIGHT_MODULE=<absolute module> node tools/verify-patrol.mjs`

15 bài kiểm tra liên quan (AFK, save integration, UI, map Chrome, routing) đạt. `npm run check`:261 files/6 inline scripts/0 lỗi. Full suite:674 đạt,4 lỗi cũ,7 bỏ qua. Ảnh ở docs/patrol-evidence. Artwork SVG là vẽ lại, không tuyên bố khớp pixel100%.
