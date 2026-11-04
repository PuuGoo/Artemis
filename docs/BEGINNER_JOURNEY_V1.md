# Artemis – Beginner Journey v1

## Mục tiêu
Thiết kế lại trải nghiệm tài khoản mới theo hướng dẫn từng bước, mở khóa hệ thống theo tiến độ và giữ nguyên tính toàn vẹn save hiện có.

## Vấn đề quan sát từ repository
- Game là một bản HTML/JS lớn tại `public/index.html` (~2 MB); GitHub connector không trả nội dung của file này nên chưa xác minh được hook lifecycle, cấu trúc nhiệm vụ, hoặc lệnh điều hướng UI.
- `public/cloud.js` chặn game cho tới khi đăng nhập, tải cloud save rồi mới gọi `startGame()`.
- `lib/saveSchema.js` dùng whitelist; mọi field mới phải được khai báo ở schema để cloud save không làm rơi dữ liệu.
- Save mặc định có thể được khởi tạo cho tài khoản mới, do đó không được dùng `playerLevel === 1` đơn độc để kết luận người chơi là tài khoản mới.
- Không nên sửa trực tiếp chỉ số, đồ trang bị hoặc tài nguyên của người chơi cũ khi bật onboarding.

## Trải nghiệm đề xuất
### 1. Welcome flow
Chỉ hiển thị cho tài khoản mới chưa có tiến trình. Giới thiệu ngắn mục tiêu: chiến đấu -> nhận trang bị -> nâng cấp -> mở nội dung tiếp theo. Có nút Bắt đầu và Bỏ qua hướng dẫn.

### 2. Lộ trình nhiệm vụ tân thủ
| Mã | Mục tiêu | Hành động | Phần thưởng gợi ý |
|---|---|---|---|
| N01 | Làm quen chiến đấu | Hoàn thành màn đầu tiên | Vàng nhỏ + EXP |
| N02 | Nhận trang bị | Nhận một món đồ sau trận | Vàng nhỏ |
| N03 | Trang bị sức mạnh | Trang bị vũ khí hoặc món gear đầu tiên | Nguyên liệu nâng cấp |
| N04 | Nâng cấp | Nâng một món gear lên cấp 2 | Vàng + nguyên liệu |
| N05 | Chọn kỹ năng | Chọn một kỹ năng trong trận | EXP |
| N06 | Hoàn tất chương đầu | Vượt boss/chương mở đầu | Rương tân thủ |

Phần thưởng cần map vào item/resource ID thực tế sau khi đọc được định nghĩa item trong `public/index.html`; không tự bịa ID.

### 3. Mở khóa theo tiến độ
- Ban đầu: chiến đấu, túi đồ, trang bị cơ bản.
- Sau N02: giải thích túi đồ, độ hiếm và chỉ số.
- Sau N03: hướng dẫn nâng cấp và so sánh đồ.
- Sau N04: giới thiệu ghép/phân rã (nếu hệ thống có sẵn).
- Sau chương đầu: mở luồng pet, rune, nhiệm vụ ngày theo điều kiện thật trong game.

### 4. Quy tắc chống gây khó chịu
- Không chặn người chơi quá lâu; có thể bỏ qua mọi bước hướng dẫn.
- Không lặp lại hướng dẫn sau khi hoàn tất.
- Có nút xem lại trong mục Trợ giúp.
- Có thể tiếp tục trên thiết bị khác nhờ cloud save.
- Không tự động equip/consume vật phẩm hiếm.
- Không phát thưởng lặp khi người chơi tải lại hoặc đồng bộ save.

## Mô hình dữ liệu đề xuất
Thêm một object có version vào save:
```js
beginnerJourney: {
  version: 1,
  startedAt: 0,
  completedAt: 0,
  skipped: false,
  currentStep: "N01",
  completedSteps: [],
  claimedRewards: []
}
```

Yêu cầu triển khai:
1. Khởi tạo object cho tài khoản mới bằng server-side registration flow hoặc game onboarding sau khi xác thực.
2. Không tự gán onboarding cho tài khoản cũ đã có save.
3. Sanitize dữ liệu bằng whitelist, giới hạn độ dài mảng và chỉ cho phép step IDs đã định nghĩa.
4. Đánh dấu claim trước hoặc cùng transaction/atomic update với grant reward; bảo đảm idempotency.
5. Nếu đồng bộ revision trả 409, không tự ghi đè; giữ đúng flow conflict hiện tại.

## Kế hoạch tích hợp
1. Đọc được source `public/index.html` bằng Git clone/raw download để xác định các event thật: clear stage, equip gear, upgrade gear, choose skill, chapter completion.
2. Thêm module độc lập `public/beginner-journey.js` chỉ subscribe vào public game events hoặc adapter được xác minh.
3. Thêm CSS/UI modal nhẹ, mobile-first, tôn trọng phong cách hiện tại.
4. Mở rộng `lib/saveSchema.js` và `tests/save-schema.test.mjs`.
5. Thêm test cho new-account gating, legacy-save compatibility, reward idempotency, skip/resume, cloud round-trip.
6. Chạy toàn bộ `npm test` và `npm run check` trước khi merge.

## Tiêu chí nghiệm thu
- Tài khoản mới thấy welcome flow và được dẫn qua nhiệm vụ.
- Tài khoản cũ không bị bật lại onboarding.
- Người chơi bỏ qua được và có thể xem lại hướng dẫn.
- Refresh, đăng xuất/đăng nhập và đổi thiết bị không mất tiến trình.
- Không có reward duplication.
- Save cũ vẫn giữ nguyên toàn bộ gear, currency, pets, skills và event state.
- Game hiện tại vẫn khởi chạy, không phát sinh lỗi console.
