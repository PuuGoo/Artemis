# DỌN TÀI KHOẢN TEST — ARTEMIS

> Công cụ và quy trình dọn tài khoản rác do quá trình kiểm thử sinh ra khỏi DB
> production, **không đụng tài khoản người chơi thật**.

---

## 1. Vấn đề

Sau nhiều vòng kiểm thử end-to-end, DB production tích **93 tài khoản** nhưng chỉ
**3 là thật**. 90 tài khoản còn lại là rác (`test_*`, `adm_*`, `e2e*`, `newbie*`,
cùng các tài khoản do chính test của tôi tạo: `u841537`, `v632045`, `w996068`,
`bj835254`, `cp837566`, `eco_*`, `nw841176`…).

Hệ quả:
- Trang admin hiển thị sai số liệu (30 người chơi thay vì 3)
- Khảo sát cân bằng bị nhiễu (tổng vàng 32 triệu trong đó 31,6 triệu là rác)
- Bảng xếp hạng vô nghĩa (tài khoản test đứng top)

## 2. Công cụ

### `tools/account-survey.mjs` — chỉ đọc

Liệt kê toàn bộ tài khoản kèm vàng/kills/runs/ngày tạo, phân loại test vs thật.
Chạy trước khi làm bất cứ điều gì.

### `tools/purge-test-accounts.mjs` — dọn có kiểm soát

```bash
node tools/purge-test-accounts.mjs            # dry-run, không xoá gì
node tools/purge-test-accounts.mjs --apply    # backup rồi mới xoá
```

**Mặc định là dry-run.** Phải có `--apply` mới thực sự xoá.

## 3. Chốt an toàn

| Lớp | Cơ chế |
|---|---|
| Danh sách thật cứng | `REAL_ACCOUNTS = {puugoo, web492972, puugoo1}` — kiểm tra **trước** khi khớp pattern |
| Kiểm tra chéo | Vòng thứ hai ngay trước `deleteMany`: nếu tài khoản thật lọt vào danh sách xoá → `ABORT` + exit 1 |
| Backup bắt buộc | Ghi JSON (players + saves) trước khi xoá; file < 100 bytes → `ABORT` |
| Phạm vi hẹp | Chỉ 3 collection: `players` (theo `_id`), `saves` (theo `playerId`), `login_attempts` (theo username) |
| Không thao tác rộng | Không `dropDatabase`, không `.drop()` |
| Backup ngoài git | `backups/` nằm trong `.gitignore` |

### Pattern nhận diện

```
test_*, test\d+_*, adm_*, newbie*, e2e*, player\d+,
u\d{6}, v\d{6,}, w\d{6}, final\d+, prod\d+, pr\d{8},
bj\d{6}, cp\d{6}, chk\d{6}, shot\d+, noc\d{5}, pf\d{5},
nw\d{6}, ec\d{6}, eco_*, move\d{6}, reg\d+,
clean\d{6}, zero\d{6}, real\d{6}, fresh\d+, boss\d{6},
cheat\d+, ok\d{5}
```

Tên thường như `alice`, `minh`, `player_one` **không** khớp pattern nào → được giữ.

## 4. Kiểm thử an toàn

`tests/purge-safety.test.mjs` — **38 assertion**, không kết nối DB, kiểm tra:

- `REAL_ACCOUNTS` tồn tại và được kiểm tra trước pattern
- `ABORT` đúng cách khi tài khoản thật bị coi là test
- Mặc định dry-run, thoát sớm khi thiếu `--apply`
- Backup phải chạy trước `deleteMany`, `ABORT` nếu file nhỏ
- Phạm vi xoá hẹp, không `dropDatabase`/`.drop()`
- **Chạy thật logic phân loại** trích từ source:
  - `puugoo`, `web492972`, `puugoo1`, `PUUGOO` → giữ
  - `test_ab12cd`, `adm_xyz`, `e2e213818`, `u841537`, `eco_n5q0f1k`,
    `v2808075`, `newbie806465` → xoá
  - `alice`, `minh`, `player_one`, `""`, `null` → giữ

## 5. Kết quả chạy thật

```
Trước:  93 tài khoản (3 thật, 90 test)
Dry-run: xác nhận 90 xoá / 3 giữ
Backup:  487.361 bytes → backups/purge-test-accounts-2026-11-05T01-17-11-923Z.json
Xoá:     players 90, saves 53, login_attempts 0
Sau:     3 tài khoản

Còn lại:
  puugoo       gold=10.358.294  kills=173
  web492972    gold=   624.148  kills= 40
  puugoo1      gold=     7.114  kills= 85
```

### Trang admin sau khi dọn

```
TỔNG NGƯỜI CHƠI   3        (+3 hôm nay)
TỔNG VÀNG         10.989.556   (TB 3.663.185/người)
TỔNG ĐÁ QUÝ       1.042.030     (3 bản lưu)
QUÁI ĐÃ HẠ        298          (4 trận)
Trang 1/1 • 3 người chơi
```

Số liệu giờ phản ánh đúng người chơi thật.

## 6. Khôi phục nếu cần

Backup là JSON chứa nguyên `players` và `saves`:

```js
const backup = JSON.parse(fs.readFileSync("backups/purge-test-accounts-....json", "utf8"));
await db.collection("players").insertMany(backup.players);
await db.collection("saves").insertMany(backup.saves);
```

`InsertMany` sẽ tái tạo đúng `_id` gốc vì `_id` được lưu trong backup.

## 7. Khuyến nghị cho tương lai

- Test e2e nên dùng prefix cố định (`test_`) để luôn khớp pattern
- Hoặc chạy test trên DB riêng (`MONGODB_DB=artemis_test`)
- Định kỳ chạy `node tools/account-survey.mjs` để phát hiện rác sớm
