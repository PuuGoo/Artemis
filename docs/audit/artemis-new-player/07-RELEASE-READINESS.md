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
- **Đợt 4:** simulator khớp source thật (6 chương, hệ số archetype, boss theo chương); 7 hồ sơ A–G **đo** bằng `getComputedStats()` (`13-GAME-BALANCE-MEASURED.md`).
- **Đợt 5:** lobby có thẻ "việc cần làm" (một việc, một nút), bỏ nhãn tĩnh "MAX VIP" thay bằng danh hiệu suy từ dữ liệu thật, hint khớp nhãn nút, modal trang bị hiện tác động lên **tổng** chỉ số (`14-UI-CLARITY.md`).
- **Đợt 6:** sáu suite baseline xanh bằng cách khoá **bất biến** thay vì hằng số cứng → lần đầu full suite không còn fail (`09-TEST-MAINTENANCE.md`).
- **Đợt 7:** campaign dùng độ khó **TUYỆT ĐỐI** (không neo người chơi); đo lại ATK ×39 → TTK giảm 76,5×, HP ×25 → số đòn chịu ×25,3 (`15-CAMPAIGN-DIFFICULTY.md`).
- **Đợt 8:** ngân sách kinh tế theo **đồng hồ server** chặn mint 500k/lần lưu (`16-ECONOMY-LEDGER.md`); Mongo **thật** đã kiểm 6/6 (`17-MONGO-REAL.md`); thu hồi JWT khi logout **và** khi đổi mật khẩu (`18-PASSWORD-CHANGE-REVOCATION.md`).

Chi tiết: `03-BUG-REPORT.md`, `04-CHANGES.md`, `06-REGRESSION.md`, `11-NEW-PLAYER-INIT-AND-PERSISTENCE.md` và báo cáo từng workstream.

## Release blockers

1. **Economy provenance — GIẢM MẠNH, chưa đóng hoàn toàn (P0).** Lỗ hổng "500.000 vàng /
   20.000 đá mỗi revision" **đã bị chặn**: server giữ ngân sách nạp theo **đồng hồ server**
   (`lib/economyLedger.js`), trần 27.000 vàng + 150 đá mỗi lần lưu, dự trữ 90s/600s. Đo lại:
   +500.000 vàng → 422; 4 lần PUT → mint **0**; người thật 40 trận/10 phút vẫn qua.
   Chi tiết: `16-ECONOMY-LEDGER.md`.
   **Còn lại:** đây là **trần tốc độ**, không phải bằng chứng từng hành động — kẻ gian vẫn
   mint được tối đa ~300 vàng/giây (ngang thu nhập hợp lệ). Muốn chứng minh từng nguồn cần
   action ledger thật (chuyển bảng reward sang module chung + instrument ~18 điểm cộng
   thưởng + chống replay). Tài khoản legacy vẫn đi đường cũ ở lần lưu đầu.
2. ~~Chưa xác minh trên Mongo thật~~ — **ĐÃ CHẠY trên Atlas thật, 6/6 PASS**:
   `ensureIndexes` idempotent, unique `playerId` → mã **11000**, CAS hai ghi song song →
   đúng **1** thắng, document legacy không `revision` vẫn CAS đúng, TTL xoá phiên hết hạn
   (13,4s). Đặc tả 5 chỉ số khoá bằng `REQUIRED_INDEXES` + 4 test không cần server.
   Chi tiết: `17-MONGO-REAL.md`. **Còn:** 2 integration cũ (`integration`, `admin`) vẫn
   skip; chỉ số trên **cluster production** chưa kiểm (cần quyền operator, làm khi deploy).
3. **Chưa tạo tài khoản production.** E2E tân thủ đã chạy đủ trên **server local + DB bộ nhớ** (17/17), nhưng production vẫn BLOCKED: chưa tạo account thật, chưa xác minh deployment SHA, chưa kiểm cookie `Secure`/`SameSite` trên HTTPS thật.
4. ~~Full suite còn failures baseline~~ — **ĐÃ XONG**: 6 suite (`bestiary`, `chapter-select`,
   `economy`, `garden`, `map-select`, `season`) đã xanh bằng cách khoá *bất biến* thay vì
   hằng số cứng (12→20 quái, 4→6 chương, regex quá khít, markup đã redesign). Full suite:
   **188 test — 186 pass / 0 fail / 2 skip**. Chi tiết: `09-TEST-MAINTENANCE.md`.
   Hai skip là `integration`/`admin` cần Mongo thật → vẫn thuộc blocker #2.
5. Buffer RAM chưa bảo đảm tiến trình chưa ACK khi crash/offline/logout/conflict. Legacy clients không owner-binding, admin save writes và sâu corrupt snapshot còn cần audit. (`gameMode/modeBest/guild/garden/plinko` đã có writer/schema persistence — xem `11-NEW-PLAYER-INIT-AND-PERSISTENCE.md`.)
6. ~~JWT revocation chưa giải quyết~~ — **ĐÃ XONG cả hai nửa**:
   logout thu hồi theo `jti` trong `revoked_sessions` (TTL = hạn token), chỉ huỷ phiên hiện
   tại; đổi mật khẩu (`api/auth/password.js`) tăng `sessionEpoch` trong **cùng update** với
   hash mới nên mọi token cũ chết ngay, vẫn trả token mới để không đăng xuất oan.
   16 test tổng (9 + 7), gồm "thiết bị khác bị huỷ" và "mật khẩu cũ 401 / mới 200".
   **Còn:** chưa có UI đổi mật khẩu; luồng "quên mật khẩu" chưa có; admin reset mật khẩu
   chưa tăng epoch (xem `18-PASSWORD-CHANGE-REVOCATION.md` §4).
7. **Đợt 4 đã đo được nhưng chưa sửa:** simulator khớp source (6 chương) và hồ sơ A–G đo bằng `getComputedStats()`. Kết quả: ATK tăng **39×** chỉ giảm TTK **1,96×**; HP tăng **25×** nhưng số đòn chịu vẫn **16,1**; hồ sơ yếu ở chương 5 vẫn chịu đúng 16 đòn. Đề xuất tách campaign sang độ khó tuyệt đối nằm ở `13-GAME-BALANCE-MEASURED.md` §4 — **chưa triển khai**, cần phê duyệt và playtest người thật.
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
