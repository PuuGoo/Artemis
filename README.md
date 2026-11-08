# 🐴 Archero 2 — Kỷ Nguyên Cung Thủ (Cloud Edition)

Game roguelike bắn cung một người chơi, có **tài khoản** và **lưu tiến trình trên MongoDB Atlas**.

## Kiến trúc

Ranh giới module, luồng save và lộ trình tách frontend: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Save backend tách `api/save.js` (HTTP), `lib/save/policy.js` (luật nghiệp vụ) và
`lib/save/repository.js` (projection/CAS); không cần mở DB để unit-test policy.
Game và admin dùng chung factory Canvas tại `public/js/game/rendering/arena-renderer.js`, mỗi bên
có instance/cache riêng thay vì giữ hai bản renderer phải sửa đồng thời.

```
public/          # game tĩnh (HTML/JS) + cloud.js (auth gate + cloud save)
api/             # Vercel serverless functions (Node.js runtime)
  auth/register  # đăng ký
  auth/login     # đăng nhập
  auth/logout    # đăng xuất
  auth/me        # kiểm tra phiên hiện tại
  save           # GET tải save / PUT ghi save
  shop           # GET catalog VIP / POST mua gói, trừ xu và cấp thưởng bằng CAS
  health         # healthcheck + ping MongoDB
lib/             # logic dùng chung
  mongo.js       # MongoClient cache, tự tạo index
  auth.js        # bcrypt hash + JWT (jose)
  save/          # schema, seed tân thủ, policy, repository (xem README trong thư mục)
  shop/          # catalog giá xu VIP và phần thưởng (xem README trong thư mục)
  http.js        # JSON body guard, rate limit, session
public/js/game/rendering/  # renderer Canvas dùng chung game/admin
public/js/game/shop/       # view cửa hàng VIP; giá/thưởng lấy từ server
tests/save/                # kiểm thử subsystem save
tests/rendering/           # kiểm thử renderer đã tách
tests/shop/                # API mua hàng, view và renderer cửa hàng trong VM
```

## Bảo mật

| Hạng mục | Cách làm |
|---|---|
| Mật khẩu | bcrypt cost 10, không bao giờ trả về client |
| Phiên | JWT HS256, cookie `HttpOnly` + `SameSite=Lax` + `Secure` (production), 30 ngày |
| Chống dò mật khẩu | rate limit theo IP (30/10 phút) và theo tài khoản (15/10 phút), lưu trong MongoDB với TTL 1 giờ |
| Chống enumeration | thông báo lỗi giống nhau cho sai tên và sai mật khẩu; luôn chạy bcrypt kể cả khi không tìm thấy user |
| Save snapshot | whitelist từng field, clamp số, giới hạn số lượng, chặn prototype pollution, tối đa 400 KB |
| Chống ghi đè | mỗi save có `revision`, PUT phải khớp revision hiện tại (nếu không trả 409) |
| Cách ly tài khoản | save gắn `playerId`; đăng nhập tài khoản khác sẽ xoá localStorage cũ |

## Chạy local

```bash
npm install
cp .env.example .env      # điền MONGODB_URI và JWT_SECRET
npm run dev               # http://localhost:3000
```

Tạo `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Test

```bash
npm run check                   # kiểm cú pháp JS/MJS và script nhúng trong HTML, không execute app
npm test                         # tìm *.test.mjs đệ quy, chạy tuần tự; MongoDB thật chỉ chạy khi opt-in
node tools/validate-biomes.mjs   # kiểm tra map, vật trang trí và boss
```

> `tests/save/schema.test.mjs` đối chiếu trực tiếp với `public/index.html`: nếu game thêm field mới
> vào `SaveState.save()` mà `lib/save/schema.js` chưa giữ lại, test sẽ FAIL ngay.

### Chơi thử ngay, không cần MongoDB Atlas

```bash
npm ci
DB_BACKEND=memory JWT_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(48).toString("hex"))')" npm run dev
```

Mở `http://localhost:3000`, tạo tài khoản thử và chơi. Dữ liệu trong bộ nhớ sẽ mất khi tắt server. Chương 7 mở sau khi hoàn thành Chương 6. Các test kết nối MongoDB thật chỉ chạy khi có `TEST_MONGODB_URI` riêng cho test; không dùng database production.

### Xem bản đồ 12 cung hoàng đạo

Trong màn chọn chương, bấm các thẻ Chương 8–19 để xem trước bản đồ và hiệu ứng dù chương còn khóa. Muốn vào trận, hãy hoàn thành chương liền trước; việc xem trước không thay đổi tiến trình hoặc chương đang chơi. Các map có chuyển động nhẹ và tôn trọng tùy chọn giảm chuyển động của thiết bị.

## Deploy Vercel

Biến môi trường cần đặt trong Vercel Project Settings → Environment Variables:

- `MONGODB_URI` — chuỗi kết nối Atlas (`mongodb+srv://...`)
- `MONGODB_DB` — tên database (mặc định `artemis`)
- `JWT_SECRET` — chuỗi ngẫu nhiên ≥ 32 ký tự

## Ghi chú vận hành

- Sửa file trong `lib/*` khi đang chạy `npm run dev` phải **khởi động lại** server (ESM cache).
  Trên Vercel không gặp vấn đề này.
- Save được đẩy lên sau 1.2 giây kể từ lần ghi localStorage cuối (debounce), tránh spam API.
