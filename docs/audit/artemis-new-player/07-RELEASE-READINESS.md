# 07 — Release readiness

## NEEDS FIXES BEFORE RELEASE

Không được deploy bản audit này theo yêu cầu người dùng. “Có patch và focused tests pass” không phải “đủ nghiệm thu sản phẩm”. Không còn phép suy production từ localhost/mock.

## Đã có bản vá local để review theo nhóm

- Cloud load fail-closed, revision CAS, season projection, owner binding, serialized writes/ACK.
- N03 progress và starter flag persistence; selector không cấp vũ khí miễn phí; ownership hero UI và copy tutorial.
- Debug query/storage chỉ local/offline, không mở trên public hostname.
- Cookie malformed fail-closed; index errors không bị nuốt toàn bộ.
- Test harness không còn tự đọc `.env`/xóa rate-limit khi chạy npm test, DB integration opt-in bị chặn khi chưa xác minh cô lập.
- **Đợt 1:** tài khoản mới được máy chủ cấp seed chuẩn + `initVersion`; `PUT revision 0` trên tài khoản đã đánh dấu bị từ chối; `GET` khôi phục seed khi bản ghi mất; tutorial nằm trong seed nên sống qua reload.
- **Đợt 2:** `gameMode`/`modeBest`/`guild`/`garden`/`plinko` được writer ghi và sanitizer whitelist; client cũ không ghi đè mất dữ liệu (carry-forward).
- **Đợt 3:** E2E 17/17 PASS trên server thật (`dev-server` + `DB_BACKEND=memory`) — đăng ký, N01–N08, reload, logout/login, cách ly tài khoản, chặn `revision 0` tự khai. Chốt 2 quyết định: cho phép tích luỹ nhiệm vụ (không chặn thứ tự, tránh soft-lock) và chỉ tặng vũ khí khởi đầu khi Hành Trình Tân Thủ đang mở.

Chi tiết: `03-BUG-REPORT.md`, `04-CHANGES.md`, `06-REGRESSION.md`, `11-NEW-PLAYER-INIT-AND-PERSISTENCE.md` và báo cáo từng workstream.

## Release blockers

1. **Economy provenance sau lần lưu đầu vẫn mở (P0).** Tài khoản mới không còn tự khai được số dư khởi tạo, nhưng snapshot các lần sau vẫn tự khai vàng/đá quý trong giới hạn delta (`500.000`/revision, `20.000` gem/revision) mà không có chứng cứ đã chơi/nhận thưởng. Cần server-authoritative action ledger. Tài khoản legacy (không `initVersion`) vẫn đi đường cũ ở lần lưu đầu.
2. Chưa có Mongo test cô lập, chưa xác minh atomic behavior/index options thực, chưa chạy auth/register/logout/login persistence integration thật. Concurrency fake DB không là Mongo proof.
3. **Chưa tạo tài khoản production.** E2E tân thủ đã chạy đủ trên **server local + DB bộ nhớ** (17/17), nhưng production vẫn BLOCKED: chưa tạo account thật, chưa xác minh deployment SHA, chưa kiểm cookie `Secure`/`SameSite` trên HTTPS thật.
4. Full suite vẫn có failures baseline chưa xử lý. Không xem PASS-focused hoặc skip2 suite DB là regression toàn repo xanh.
5. Buffer RAM chưa bảo đảm tiến trình chưa ACK khi crash/offline/logout/conflict. Legacy clients không owner-binding, admin save writes và sâu corrupt snapshot còn cần audit. (`gameMode/modeBest/guild/garden/plinko` đã có writer/schema persistence — xem `11-NEW-PLAYER-INIT-AND-PERSISTENCE.md`.)
6. JWT revocation sau logout/reset-password chưa được giải quyết; quyền admin immutable provisioning cần review riêng.
7. Chưa đủ profile A–G/simulator parity/win rate để tuyên bố nâng cấp tạo lợi ích campaign đúng yêu cầu. Không đổi balance hàng loạt.
8. Sự cố baseline: hai test cũ có thể đã xóa rate-limit records ở DB đọc từ `.env`; đích/tác động chưa biết. Chủ repository cần kiểm audit/log bằng quyền phù hợp. Không khẳng định phiên này “production untouched”.

## Rollback considerations — chưa chạy

- Không có schema migration/production DB writes có chủ đích hoặc asset rebalance cần rollback từ patch.
- Revert source theo nhóm độc lập nếu review không chấp thuận; không reset working tree hoặc xóa tài sản để “rollback”. Không deploy bản cũ có bug mất dữ liệu chỉ để né test.
- API owner field additive/optional cho client cũ; strict revision có thể yêu cầu client ngoài repo cập nhật. Phải thử rolling mixed client/server trên staging.
- Nếu deploy sau khi được phép, kiểm index prerequisites trước rollout; fail-closed index có thể biến lỗi dữ liệu/quyền đang bị nuốt thành outage rõ ràng. Đây là tradeoff bảo vệ dữ liệu cần operator xử lý, không tự tắt guard.
- Không tự phục dựng rate-limit records đã có thể bị xóa từ số liệu phỏng đoán.

## Sau deploy (chỉ sau phê duyệt riêng)

Xác minh đúng SHA/deployment alias, kiểm anonymous + một new-player flow hợp lệ theo budget, reload/logout/login, thiết bị A/B stale-save409, theo dõi rejects/load failures, đối chiếu backups/snapshot. Không exploit economy production, không reset account cũ. Các bước này **chưa được thực hiện** trong phiên audit.

## Next actions

Thực hiện `08-SAFE-FOLLOWUP.md`: review local diff, chốt canonical seed + server action plan, cấp test DB cô lập, bổ sung credential-vault flow an toàn cho tối đa một test account production, xử lý baseline failures và simulation parity. Không đưa mật khẩu/token/connection string vào chat.
