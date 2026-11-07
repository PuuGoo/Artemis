# 11 — Đợt 1 và Đợt 2: khởi tạo tài khoản mới + persistence các hệ mở rộng

Tài liệu này ghi lại **phần đã làm thật** sau `08-SAFE-FOLLOWUP.md`. Không thay thế
`07-RELEASE-READINESS.md`: các blocker chưa đóng vẫn giữ nguyên trạng thái.

## 1. Đợt 1 — Trạng thái khởi tạo do máy chủ quyết định

### Vấn đề (đã xác nhận trước bản vá)

Tài khoản mới đăng ký xong **không có save** và **không có dấu nhận dạng** trên
player. Client tự dựng state tân thủ rồi `PUT /api/save` lần đầu với `revision: 0`.
Nhánh "lần lưu đầu" trong `lib/economy.js` chỉ áp trần cứng `1e12`, nên payload
tự khai được chấp nhận nguyên vẹn.

### Bằng chứng trước/sau (cùng một probe, hai worktree)

Probe: đăng ký một tài khoản → `PUT revision 0` với `{gold: 1e12, gems: 1e12}`.

```
=== TRƯỚC BẢN VÁ (a0878de) ===
  registerStatus: 201
  playerHasInitMarker: false
  saveCreatedAtRegister: false
  firstSaveStatus: 200          ← được chấp nhận
  storedGold: 1000000000000
  storedGems: 1000000000000

=== SAU BẢN VÁ ===
  registerStatus: 201
  playerHasInitMarker: true
  saveCreatedAtRegister: true
  saveCreatedRevision: 1
  firstSaveStatus: 409          ← bị từ chối (code SAVE_MISSING)
  storedGold: 500               ← seed chuẩn của máy chủ
  storedGems: 50
```

Probe chạy trên mock Mongo, không kết nối DB thật và không gọi production.

### Thay đổi

| File | Nội dung |
|---|---|
| `lib/initialState.js` (mới) | `NEW_ACCOUNT_INIT_VERSION = 1`, `buildCanonicalNewAccountData()`, `buildCanonicalNewAccountSave()` |
| `api/auth/register.js` | Ghi `initVersion`/`initVersionAt` lên player; tạo snapshot chuẩn revision 1 ngay sau khi tạo player |
| `api/save.js` | `GET` khôi phục seed khi bản ghi của tài khoản đã đánh dấu bị mất; `PUT revision 0` trên tài khoản đã đánh dấu trả `409 SAVE_MISSING` |
| `public/cloud.js` | Nhận `SAVE_MISSING` → tải lại để `GET` khôi phục, không ghi đè bằng state hiện tại |

### Vì sao an toàn với người chơi cũ

- Nhánh mới chỉ kích hoạt khi `player.initVersion >= 1`. Tài khoản cũ không có cờ này
  nên giữ nguyên toàn bộ đường cũ: save hiện có không bị đọc/ghi khác đi.
- `PUT revision 0` chỉ bị chặn cho tài khoản đã đánh dấu. Tài khoản cũ thiếu snapshot
  vẫn lưu lần đầu như trước (hành vi legacy được giữ nguyên có chủ đích, xem mục 4).
- Seed chỉ chứa đúng trạng thái tân thủ; không có đồ, không có tài nguyên ngoài
  500 vàng / 50 đá quý / 20 stamina.

### Tutorial không còn phụ thuộc vào một lần gọi trên client

`beginnerJourney.startedAt` nằm ngay trong seed, nên N01 vẫn mở sau reload, mất mạng
hoặc đăng nhập lại. Lời gọi `activateBeginnerJourney()` sau khi đăng ký trở thành
idempotent (`startedAt > 0` → trả `false`), không tạo thêm trạng thái.

## 2. Đợt 2 — Persistence cho 5 hệ đang thiếu

`gameMode`, `modeBest`, `guild`, `garden`, `plinko` có state trong `SaveState` và
được người chơi thay đổi, nhưng **không có trong writer** và **không có trong
whitelist** của sanitizer. Hệ quả: mọi tiến trình Vườn/Bang/Plinko/Chế độ mất sau
reload.

| File | Nội dung |
|---|---|
| `lib/saveSchema.js` | `sanitizeModeBest`, `sanitizeGuild`, `sanitizeGarden`, `sanitizePlinko`; `gameMode` chuẩn hoá theo danh sách chế độ |
| `public/index.html` | Writer ghi 5 field, luôn gửi key (`null` khi chưa mở) |
| `api/save.js` | Carry-forward: client cũ không gửi key → giữ giá trị đang có trong DB |

### Quy tắc tương thích đã chốt

- **Không có key** = client cũ (hoặc save trước bản vá) → không tự thêm, và API giữ
  nguyên giá trị trong DB. Nhờ vậy mở game bằng bundle cũ không xoá tiến trình mới.
- **Key = null** = người chơi/hệ thống chủ động xoá → ghi null, không khôi phục.
- Save cũ không bị "hồi sinh" dữ liệu mặc định của hệ mới.

### Kiểm tra dữ liệu bẩn

Đã có test cho: prototype pollution, mảng 500 phần tử (cắt còn 20/60/6/20), `NaN`,
`Infinity`, số âm, `readyAt < plantedAt`, HP trùm > `maxHp`, `gameMode` lạ, `guild`
thiếu tên. Không có trường hợp nào làm sập sanitizer hoặc ghi giá trị vô lý.

## 3. Kiểm thử

| Lệnh | Kết quả |
|---|---|
| `node --test tests/canonical-new-account.test.mjs` | 15/15 pass |
| `node --test tests/subsystem-save-persistence.test.mjs` | 12/12 pass |
| `node --test tests/subsystem-save-roundtrip.test.mjs` | 1/1 pass (writer → sanitizer → load thật) |
| `node --test tests/*.test.mjs` | 175 test: **167 pass / 6 fail / 2 skip** |

6 fail là các suite baseline đã có từ trước bản vá đầu tiên (`bestiary`,
`chapter-select`, `economy`, `garden`, `map-select`, `season`) — chưa sửa, không
đổi expected để ép xanh. 2 skip là integration/admin cần DB cô lập.

## 4. Rủi ro còn mở (không được coi là đã đóng)

1. **Tài khoản legacy vẫn là P0.** Tài khoản tạo trước bản vá (không có
   `initVersion`) vẫn lưu lần đầu bằng snapshot client tự khai. Không thể phân biệt
   "người chơi cũ mất save" với "người chơi mới tự khai" nếu không có lịch sử, nên
   hành vi được giữ nguyên thay vì đoán.
2. **Cửa sổ chuyển tiếp.** Tài khoản đăng ký trong khoảng giữa bản deploy trước và
   bản này không có `initVersion`, nên thuộc nhóm legacy ở mục 1. Cần theo dõi.
3. **Reward provenance vẫn chưa có.** Snapshot sau lần lưu đầu vẫn có thể tự khai
   vàng/đá quý trong giới hạn delta (`500.000`/revision, `20.000` gem/revision). Đóng
   hoàn toàn cần server-authoritative action ledger (`08-SAFE-FOLLOWUP.md` §2).
4. **Chưa kiểm Mongo thật.** CAS, unique index `playerId` và index options mới chỉ
   được chứng minh trên mock. Cần DB cô lập trước khi tuyên bố atomic trên Atlas.
5. **Chưa chạy E2E production.** Không tạo tài khoản production, không xác minh
   deployment SHA. Toàn bộ bằng chứng ở tài liệu này là local/mock.
6. `gameMode`/`modeBest`/`guild`/`garden`/`plinko` chưa có test trên browser thật;
   `subsystem-save-roundtrip` chạy đúng hàm writer/ensure của game trong VM.

## 5. Rollback

- Không có migration DB. Revert theo file: `api/auth/register.js`, `api/save.js`,
  `lib/initialState.js`, cùng phần thêm trong `lib/saveSchema.js` và
  `public/index.html`.
- Tài khoản đã tạo bởi bản vá vẫn giữ save chuẩn nếu revert code (dữ liệu không phụ
  thuộc code mới để đọc được: mọi field đều nằm trong whitelist cũ trừ 5 field mới,
  vốn chỉ bị bỏ qua chứ không gây lỗi).
- Không xoá `initVersion` khỏi player đã có: nếu revert, trường này chỉ là dữ liệu
  thừa, không ảnh hưởng đường cũ.
