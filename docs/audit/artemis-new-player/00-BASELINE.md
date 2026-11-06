# Baseline Artemis — 07/11/2026 (UTC+07:00)

- Repository: `C:/Users/PuuGoo/Desktop/Artemis`.
- Commit khảo sát: `3838b40fb453224278a4c232337b5bff8a153447`.
- Branch đầu phiên: `main`, working tree sạch.
- Branch audit: `codex/artemis-new-player-hardening`.
- Node `v24.19.0`, npm `11.17.0`.
- Không push, merge, commit hoặc deploy.
- Không có AGENTS.md trong danh sách tracked files. Không in nội dung `.env`.

## Kết quả trước sửa logic

| Command | Exit | Kết quả |
|---|---:|---|
| `npm ci --ignore-scripts` | 0 | 14 packages, audit 15 packages, 0 vulnerabilities theo npm |
| `npm run check` | 0 | Các module liệt kê trong script parse thành công; script không kiểm tra inline game JS |
| `npm test` | 1 | Node runner: 42 mục, 34 pass, 8 fail, 0 skipped |
| `npm run sim` | 0 | Các tiêu chí của simulator hiện tại pass; không phải E2E/win rate thực chiến |

Runner đếm file test legacy như một mục; không nhầm 42 mục với tất cả assertion bên trong.

## Baseline failures

- `admin.test.mjs`, `integration.test.mjs`: `ECONNREFUSED 127.0.0.1:3000`.
- `bestiary.test.mjs`: 49 assertion pass / 7 fail; expected metadata 12 trong khi thấy 20.
- `chapter-select.test.mjs`: 46 pass / 10 fail; expected 4 chapter trong khi source có 6.
- `economy.test.mjs`: 36 pass / 1 fail; assertion import `validateEconomyDelta`.
- `garden.test.mjs`: 57 pass / 3 fail; tab/container/hook cũ.
- `map-select.test.mjs`: 124 pass / 3 fail; metadata chapter.
- `season.test.mjs`: 56 pass / 1 fail; nhãn cửa hàng.

Không thay expected hoặc skip các assertion fail để ép xanh. Các lỗi baseline chưa sửa phải tiếp tục được báo cáo.

## Sự cố an toàn của baseline — cần chủ repository kiểm tra

Lượt `npm test` đầu tiên chạy trước khi đọc hai suite tích hợp. Sau đó phát hiện cả `tests/integration.test.mjs` và `tests/admin.test.mjs` tự đọc `.env`, kết nối MongoDB rồi gọi `login_attempts.deleteMany({})` trước khi gọi server localhost. `.env` có tồn tại. Log không cho biết database đích hoặc số document bị xóa; admin suite còn nuốt exception.

**Không thể xác nhận tác động/đích DB. Có khả năng rate-limit records đã bị xóa. Không được tuyên bố không chạm production.** Không có bằng chứng trong log cho thấy các bước tạo account, sửa save, grant admin hoặc xóa người chơi đã chạy: cả hai suite dừng ở HTTP request đầu tiên do không có server local.

Agent không mở/in `.env` và không kết nối DB để điều tra hoặc thử khôi phục. Không tự tạo lại records đã mất bằng dữ liệu phỏng đoán. Bản vá local loại bỏ hoàn toàn đọc `.env` và xóa rate-limit từ hai suite, chỉ opt-in các bài tích hợp sau khi operator xác minh server+DB cô lập. Những bài này phải được báo BLOCKED/SKIPPED chứ không phải đã kiểm thử thành công.

## Môi trường chưa có

- Chưa cấp MongoDB test cô lập và test admin fixtures: integration persistence/race DB thật BLOCKED.
- Browser helper default lỗi PermissionError; session riêng timeout CDP. Đang thử alternative Playwright-core trong scratch, không sửa dependencies dự án.
- Production deployment SHA chưa xác minh: `DEPLOYMENT VERSION NOT VERIFIED`.
- Không dùng `.env` của dự án cho dev-server vì chưa biết DB đó có phải test không.

## Log

Log lệnh được giữ trong scratch Hermes: `artemis-baseline-check.log`, `artemis-baseline-test.log`, `artemis-baseline-sim.log`. Không commit raw logs chứa dữ liệu nhạy cảm. Báo cáo chỉ lấy counters và thông báo đã rà soát.
