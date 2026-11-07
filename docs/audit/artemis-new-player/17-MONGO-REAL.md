# 17 — Mongo thật: đã chạy và đã chứng minh

Blocker "CAS/unique index mới chỉ chứng minh trên DB bộ nhớ" nay **đã đóng**.

## 1. Kết quả chạy thật

Chạy trên **MongoDB Atlas thật** (URI lấy từ `MONGODB_URI` trong `.env`), database tạm
`artemis_probe_*` được tạo riêng và **xoá bằng `dropDatabase()`** sau mỗi test:

| Test | Kết quả | Thời gian |
|---|---|---|
| `ensureIndexes` tạo đúng 5 chỉ số + idempotent khi chạy lại | **PASS** | 1,8s |
| Unique `playerId` chặn save trùng, đúng mã **11000** | **PASS** | 1,4s |
| CAS: 2 lần ghi song song cùng `revision` → **đúng 1 thắng** | **PASS** | 1,2s |
| Document legacy **không có** `revision` vẫn CAS đúng (`$exists:false`) | **PASS** | 1,1s |
| TTL xoá phiên bị thu hồi khi `expiresAt` trôi qua | **PASS** | 13,4s |

**6/6 PASS.** Đây là bằng chứng trên server thật, không phải mô phỏng.

## 2. Cách chạy lại

```bash
# Windows git-bash, dùng URI test trong .env (không phải DB production)
set -a; . ./.env; set +a
TEST_MONGODB_URI="$MONGODB_URI" node --test tests/mongo-real.test.mjs
```

Không đặt `TEST_MONGODB_URI` thì 5 test này **skip** (không chặn CI).

### Chốt an toàn

- Mỗi lần chạy tạo database riêng: `artemis_probe_<timestamp>_<rand>`.
- Chỉ `dropDatabase()` đúng database đó ở `finally`.
- Hàm `guard()` **từ chối** URI trỏ tới database tên `artemis` / `prod` / `production`.
- Không đọc/ghi collection nào ngoài phạm vi database tạm.
- Không in URI, không log credential.

## 3. Đặc tả chỉ số nay khoá được mà KHÔNG cần server

`lib/mongo.js` xuất `REQUIRED_INDEXES`; `tests/mongo-index-spec.test.mjs` (**4/4**)
gọi `ensureIndexes()` với một db giả ghi lại lời gọi và kiểm đúng **đặc tả**:

| Collection | Keys | Options |
|---|---|---|
| `players` | `{ usernameLower: 1 }` | `unique`, `uniq_username` |
| `saves` | `{ playerId: 1 }` | `unique`, `uniq_player` |
| `login_attempts` | `{ key: 1 }` | `unique`, `uniq_attempt_key` |
| `login_attempts` | `{ lastAt: 1 }` | `expireAfterSeconds: 3600`, `ttl_attempts` |
| `revoked_sessions` | `{ expiresAt: 1 }` | `expireAfterSeconds: 0`, `ttl_revoked` |

Nhờ vậy nếu ai sửa `ensureIndexes` làm mất `unique` (production sẽ cho phép 2 save cùng
playerId), CI đỏ ngay — không cần Mongo để phát hiện.

`tests/mongo-index-hardening.test.mjs` vẫn giữ: lỗi 13/91/11000 **không** bị nuốt
(fail-closed), 85/86 được bỏ qua (deploy lại không sập).

## 4. Còn lại

- Chưa chạy **toàn bộ** integration cũ (`tests/integration.test.mjs`,
  `tests/admin.test.mjs`) trên Mongo thật vì chúng cần thêm `ARTEMIS_ISOLATED_TESTS=1`
  và fixture riêng. Hai test đó vẫn **skip**.
- Chưa xác minh chỉ số đã tồn tại trên **cluster production** — việc đó cần quyền
  operator và chỉ nên làm khi deploy (xem `07-RELEASE-READINESS.md`).
- TTL thật của Mongo chạy theo monitor ~60s; test chờ tối đa 90s nên chậm nhưng ổn định.
