# NPC chạm và nhịp né đòn

- Khung thường mục tiêu78% chiều cao, boss93%, giới hạn theo chiều rộng; world480×1200 giữ nguyên, zoom/camera không đổi vật lý khi resize.
- Quái thường tăng bán kính thực1.28–1.38 lần trước kiểm tra chỗ sinh, nhiều kiểu bắn luân phiên: burst, fan, split và radial có khe thoát. Báo trước750ms, tối đa2 nguồn tấn công đồng thời, cách nhau320ms, tối đa64 đạn sống. Không khởi phát từ quái ngoài camera, không dồn volley sau giật lag. Boss khóa vị trí/đích lúc báo đòn. Slow giảm đồng hồ pressure.
- Valkyrie ưu tiên giữa phòng5/15/25/35/45, cần chạm mới mở.
- Thiên thần9/19/29/39/49 sau khi phòng sạch: tăng10%HP tối đa hoặc hồi25–45%HP xác định theo lượt. Ác quỷ10/20/30/40 sau boss đứng gần cổng, đưa kỹ năng legend hợp lệ, đổi1 lần, nhận trừ15%HP tối đa và HP hiện tại; có từ chối. Không NPC cuối50.
- State encounters tách khỏi skill-choice budget. Server replay offer/claim/reroll, kiểm tra HP, kỹ năng, receipt và không cho preclaim/rollback. Grant legend áp vào hiệu ứng kỹ năng trong trận, không ghi thành lựa chọn Valkyrie. Giữ lịch sử qua reload.

## Kiểm chứng local

Chrome với HTTP auth/save thật và memoryDB cô lập: không popup từ xa; chạm mở thiên thần9, nhận tăng HP775→853; chạm ác quỷ10, nhận legend và HP/maxHP853→725; server đọc lại đúng receipt. Tests toàn bộ725 pass/4 lỗi baseline/7 skip. Syntax279 files/6 scripts/0 lỗi. Không production DB hoặc credential sử dụng trong kiểm thử này.

Production acceptance: chưa xác nhận vì trình duyệt kiểm thử tại https://artemis-puugoo.vercel.app/ chưa đăng nhập. Local PASS và push không thay thế bước này. Đồ họa là2D/asset vẽ lại, không khớp pixel100%.
