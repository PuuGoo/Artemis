# Production E2E — kiểm tra giới hạn, chưa nghiệm thu đăng ký

- Target: `https://artemis-puugoo.vercel.app/`.
- Thời gian bằng chứng: `2026-11-06T17:57:45.755Z` (07/11/2026 00:57 UTC+07:00).
- Browser: Chrome `156.0.8078.80`, headless, context mới không có session.
- Browser helper lỗi quyền trên session mặc định và timeout session riêng; thay bằng Playwright-core cài **trong scratch**, dùng Chrome đã có. Không thêm dependency vào bundle/lockfile Artemis.
- Bằng chứng machine-readable: `evidence/production-anonymous.json`.
- Script chặn tất cả request không phải GET/HEAD; không gọi admin API.
- **Tài khoản production mới đã tạo: 0.** Không gửi POST đăng ký/login, không thử payload gian lận.

| Step | Status | Evidence |
|---|---|---|
| Website load | PASS | GET `/` = 200 |
| Auth session check vô danh | PASS | GET `/api/auth/me` = 200; auth gate hiện |
| Login form | PASS | 2 input username/password, maxLength 20/128; `production-login.png` |
| Mở register form qua button | PASS | Button `✨ Tạo Tài Khoản` hiện; `production-register.png` |
| Submit rỗng | PASS | UI hiện `Tên đăng nhập phải có ít nhất 3 ký tự.`; không có POST |
| Username có thể nhập | NOT TESTED | Không điền credentials |
| Password validation/submit hợp lệ | BLOCKED | Chưa có luồng nhập credential qua vault cho Artemis |
| Registration response/session created | BLOCKED | Không gửi request đăng ký |
| Lobby/initial character/first mission/equipment | BLOCKED | Cần account test production mới được tạo hợp lệ |
| Reload/logout/login lại | BLOCKED | Chưa có account/session test |
| Console exceptions/network failures | PASS trong phạm vi trang auth | `errors=[]`, `failures=[]`; không suy rộng sang gameplay |
| Deployment SHA | NOT VERIFIED | `DEPLOYMENT VERSION NOT VERIFIED` |

## Credential handling

Đã kiểm tra browser vault: không có mục đăng nhập cho origin Artemis. Không tái sử dụng account Lexora hoặc account thật. Không yêu cầu mật khẩu trong chat, không tự gõ credential qua browser tool hoặc lưu credential vào repo. Do đó phần đăng ký thực và authenticated production journey dừng ở BLOCKED; đây không phải bằng chứng đăng ký bị lỗi.

## Phân biệt với local

`evidence/local-browser.json` là browser chạy source local với **mock auth/save server trong bộ nhớ**. Những PASS local không có nghĩa production đã được sửa hoặc MongoDB đã được kiểm thử.

## Lưu ý sự cố baseline

Xem `00-BASELINE.md`: test harness cũ tự đọc `.env` và có khả năng đã xóa rate-limit records khi baseline. Không thể xác định database đích/số records từ log. Browser GET-only ở trên không chứng minh toàn phiên không có DB side effect.
