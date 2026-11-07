# 08 — Công việc tiếp theo an toàn, chưa triển khai

**Đây là đề xuất cần review/phê duyệt, không migration/deploy đã thực hiện.** Không tự thay economy toàn bộ, không đặt trần mới làm mất tiến trình cũ.

## 1. Canonical initial state và nhận dạng tài khoản mới

> **Trạng thái: đã triển khai một phần (Đợt 1).** `lib/initialState.js` sinh seed chuẩn;
> `api/auth/register.js` tạo save revision 1 + `initVersion`; `api/save.js` khôi phục seed khi
> bản ghi mất và từ chối `PUT revision 0` trên tài khoản đã đánh dấu. Bằng chứng trước/sau
> trong `11-NEW-PLAYER-INIT-AND-PERSISTENCE.md`. **Còn mở:** tài khoản legacy không marker
> vẫn đi đường lưu-đầu cũ; chưa chạy trên Mongo thật.

1. Chốt spec initial state từ fixture thực: level1, gold500, gems50, stamina20, Alex0★, không gear/talent mạnh; pet hiện là archetype miễn phí, chưa có entitlement riêng. Chốt toàn bộ field thực, không chỉ ba currencies. → **Done**: `buildCanonicalNewAccountData()` khớp `SaveState` defaults, có test khóa từng field.
2. Thêm marker/version server cho **player mới tạo sau rollout**. Không suy “tân thủ” từ thiếu save, thiếu field hoặc level thấp. Player cũ không marker giữ chính sách recovery riêng, không bị apply defaults.
3. Tạo canonical save server với identity/revision/idempotency rõ, trước khi trả registration success. Đánh giá transaction hoặc protocol recoverable giữa player insert và save insert, retry chỉ insert-once, không upsert đè save hiện có.
4. Không chấp nhận client first snapshot tự quyết currency/gear/ownership trên nhánh marker mới. Existing-account-no-save không tự nhận seed mới khi chưa biết lịch sử hay nguyên nhân mất snapshot.
5. Viết fixtures cho player trước/sau rollout, register timeout giữa hai insert, duplicate request, hai tab, initial save retry, save mạnh cũ, account marker mới nhưng save đã tồn tại. Mongo test cô lập bắt buộc.
6. Cần backup/restore drill và rollout/rollback plan riêng. Không tự chạy production migration.

**Chỉ canonical seed chưa đóng P0**, vì snapshot sau đó vẫn có thể tự khai reward/gear.

## 2. Server-authoritative actions theo từng lớp

- Chốt danh mục nguồn thu/chi thực từ architecture/source: quest, room/boss, achievements, event/season, shop, upgrade, merge/sell/reset-level, hero/shard, garden/plinko/guild và compensation/admin.
- Mỗi action có identity từ session, event/run receipt hợp lệ, version và idempotency key; server tính chi phí/phần thưởng, kiểm quyền sở hữu và ghi kết quả atomic. Idempotency key do client tự tạo **không đủ** chứng minh combat/reward đã xảy ra.
- Không coi `lifetimeStats`, client bossHP=0 hoặc số lần save là chứng cứ chiến thắng. Cần quyết định mức thẩm quyền combat/run validation và threat model trước khi tuyên bố chống gian lận.
- Triển khai từng action có shadow validation/telemetry rồi mới enforcement sau compatibility review, không xóa tài nguyên cũ vì không có provenance lịch sử.
- UI chỉ reflect state đã ACK; retry cùng action không trừ/nhận hai lần, concurrent upgrade/reward trên nhiều tab test bằng DB cô lập.
- Save snapshot vẫn cần cho state không nhạy cảm nhưng không là nguồn quyền cấp tài sản.

## 3. Session lifecycle

- Chốt ý nghĩa logout: chỉ xóa cookie hiện tại hay revoke session trên server. Reset-password phải có chính sách thu hồi token đã phát.
- Đánh giá session-version/token-id hoặc issued-at/passwordChangedAt, tính đến token cũ không field, lệch clock và logout nhiều thiết bị. Không tự invalidate tất cả người chơi trong patch audit hẹp.
- Provision admin theo identity bất biến; kiểm tên allowlist được reserve trước. Không dựa vào public-register username để cấp quyền. Không probe admin production.

## 4. Durability / conflict recovery

- Khi dirty và offline/logout/conflict/ECONOMY rejection, phải giữ bản chưa ACK để người dùng quyết định phục hồi; không tự export/import lẫn account.
- Chọn owner-bound recovery store/export với đồng ý và threat model, expiration và conflict policy. Không đưa secret vào local storage. Tránh retry vô hạn.
- Test crash/close tab trước ACK, network outage, two tabs cookie switch, buffer generation/cancellation, trước khi hứa zero-loss.

## 5. Combat measurement trước thay đổi balance

1. Sửa parity simulator: boss room thực/type/demon multiplier, số quái/rounding/archetype C1–C6, không dùng room999 để chọn boss cuối.
2. Lấy profile A–G bằng `SaveState`/`getComputedStats`/spawn thật và danh sách hành động hợp lệ; không nhập tay fixture ATK/HP lịch sử thành “tân thủ hiện tại”.
3. Baseline fixed encounter kiểm ATK/HP/DEF/ASPD/crit, TTK, damage, first upgrade affordability; nếu cần win rate phải có policy/seed/số sample và outcome thật.
4. Đề xuất riêng campaign fixed-difficulty theo chapter/room/archetype; giữ mode adaptive nếu có lý do. Không tự giảm HP tất cả quái hoặc tăng thưởng hàng loạt.

## 6. Preconditions trước review phát hành

- Chủ repository kiểm log/audit DB đích của sự cố baseline cleanup rate-limit bằng quyền quản trị phù hợp; không gửi secrets vào chat.
- Cấp môi trường Mongo test cô lập và admin fixtures, kiểm chứng unique-player index/options thực tế, CAS/inserts và legacy saves.
- Hoàn thiện luồng một account production test qua credential-vault/interaction an toàn; hiện chưa tạo account production nào.
- Sửa baseline failure tests theo contract thực sau phân tích riêng, không skip/đổi expected để ép xanh.
- Review diff theo nhóm patch, bảo đảm không hạ tài sản/quyền hợp lệ cũ; chưa được phép push/merge/deploy.
