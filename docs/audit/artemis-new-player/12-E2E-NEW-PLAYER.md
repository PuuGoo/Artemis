# 12 — Đợt 3: vòng chơi tân thủ thật (server thật + UI thật)

Tài liệu này ghi lại **bằng chứng chạy được**, kèm rõ phần nào là hành vi thật của
người chơi và phần nào vẫn là hook/giả lập. Không thay thế `07-RELEASE-READINESS.md`.

## 1. Vì sao có thêm backend bộ nhớ

`tools/e2e-new-player.mjs` cần đi qua **đúng route HTTP**: bcrypt, JWT, cookie
HttpOnly, `sanitizeSave`, revision CAS và seed khởi tạo. Nhưng môi trường này không
có Mongo và tuyệt đối không được chạm dữ liệu thật.

`lib/mongoMemory.js` cung cấp một Mongo-compatible tối thiểu (insertOne, findOne có
projection, updateOne, findOneAndUpdate, deleteMany, createIndex) và **chỉ bật khi**:

```js
process.env.DB_BACKEND === "memory" && process.env.NODE_ENV !== "production"
```

Nếu ai đặt `DB_BACKEND=memory` trên production, `getMongoDb()` **ném lỗi** thay vì
âm thầm chạy bằng bộ nhớ (dữ liệu sẽ biến mất giữa các lambda). Mặc định không đổi:
không có `DB_BACKEND` thì vẫn là MongoDB thật như trước.

## 2. Hai quyết định còn treo — đã chốt

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Hành động làm trước thứ tự nhiệm vụ | **Cho phép tích luỹ**, không chặn | Chặn theo thứ tự tạo soft-lock: người chơi chọn kỹ năng ở phòng 1 rồi mới tới N05 sẽ không bao giờ hoàn thành N06. |
| UI ghi “🔒 CHƯA MỞ” | Đổi thành **“⏳ CHƯA XONG”** + ghi chú *“Không bắt buộc làm đúng thứ tự…”* | Nhãn cũ nói sai sự thật: bước vẫn được ghi nhận khi hành động xảy ra. |
| Vũ khí khởi đầu tặng cho ai | **Chỉ tài khoản đang đi Hành Trình Tân Thủ** (`isBeginnerJourneyActive()`) | Trước đây tài khoản cũ dọn một phòng cũng được thêm vật phẩm ngoài ý muốn. Nay quyền sở hữu của người chơi cũ không bị thay đổi. |

Test khoá hành vi: `tests/beginner-journey-decisions.test.mjs` (4 case).

## 3. Kết quả chạy E2E

Lệnh:

```bash
PLAYWRIGHT_MODULE=<.../playwright-core/index.mjs> node tools/e2e-new-player.mjs
```

Kết quả lần chạy cuối: **17/17 PASS, `errors: []`** — Chrome 156, server local
(`dev-server.mjs` + `DB_BACKEND=memory`), `netFailures` chỉ có 2 `ERR_ABORTED` của
`/api/auth/logout` do trang điều hướng lại ngay sau đó.

| ID | Kiểm tra | Cách thực hiện | Kết quả |
|---|---|---|---|
| A1 | Cổng đăng nhập do server trả về (chưa có session) | tải trang thật | PASS |
| A2 | Đăng ký qua form của `cloud.js` | submit event thật trên form, cookie do server set | PASS (201) |
| A3 | Trạng thái khởi tạo 500/50/20, Alex 0★, túi rỗng, N01 mở | đọc `SaveState` sau khi nạp save thật | PASS |
| A4 | Máy chủ đã có save revision 1 | `GET /api/save` bằng cookie | PASS |
| B1 | N01 bằng nút “Đã Hiểu” | click DOM thật | PASS, +100 vàng |
| B2 | Reload giữ N01 + vàng | `page.reload()` | PASS |
| B3 | N02 bằng chiến đấu thật | autopilot bàn phím, dọn sạch phòng 1 | PASS, HP còn nguyên 775/775 |
| B4 | N03 đủ 10 vật phẩm | tiếp tục autopilot qua phòng 2–4 | PASS, loot 10/10, 0 lần chết |
| B5 | N04 mặc Cung Gỉ Sét | `openGearDetailModal` + click `#btnModalEquipGear` | PASS |
| B6 | N05 nâng cấp | click `#btnModalUpgradeGear`, trừ đúng `80+45` vàng + 1 cuộn | PASS (không phải bù tài nguyên) |
| B7 | N06 chọn kỹ năng | **thẻ kỹ năng thật** trong `#skillSelectModal` (5 lượt) | PASS qua `ui-skill-picker` |
| B8 | N07 + N08 | N07 gọi hook `chapter_cleared`; N08 click nút “Hoàn Tất” thật | PASS (xem giới hạn §4) |
| B9 | Nhận thưởng đúng một lần | claim 8 bước hai lần | PASS, lần hai toàn `false`, tài nguyên không đổi |
| C1 | Reload giữ đủ 8 bước | `page.reload()` | PASS |
| C2 | Logout → login lại | cookie phiên bị xoá, đăng nhập lại qua form | PASS, vàng + bước + vũ khí giữ nguyên |
| C3 | Tài khoản B cùng trình duyệt | đăng ký mới ngay trên tab đó | PASS, 500 vàng, túi rỗng, 0 bước |
| C4 | Client tự khai tài nguyên | `PUT revision 0` với `1e12` vàng | PASS, **409 `SAVE_MISSING`**, vàng trên server không đổi |

Chi tiết đầy đủ: `evidence/e2e-new-player.json` (kèm `e2e-new-player-lobby.png`,
`e2e-new-player-final.png`).

### Con số đo được từ lượt chơi (không phải mô phỏng)

- Autopilot: 2 phiên, **45,6 giây** chơi, dọn phòng **2, 3, 4**, chọn **5 kỹ năng**, **0 lần chết**.
- Phòng 1 dọn xong với **HP 775/775** — né đúng cách thì tân thủ không bị đánh trúng.
- Nâng cấp đầu tiên: **125 vàng + 1 cuộn**, tự kiếm được trong lượt chơi (không bù).

## 4. Giới hạn — phải đọc trước khi trích dẫn

1. **N07 chưa phải “thắng chương 1 thật”.** N07 được đánh dấu bằng hook
   `onChapterCleared(1)` — tức là kiểm tra *đường ghi nhận* của sự kiện, không phải
   bằng chứng người chơi tự hạ trùm cuối chương 1. Autopilot dừng ở phòng 4/15.
2. **Không phải production.** Toàn bộ chạy trên `dev-server` + DB bộ nhớ. Không
   chứng minh Mongo Atlas, index thật, hay deployment SHA.
3. **Đăng ký/đăng nhập không chạy trên hạ tầng Vercel.** Cookie `Secure` và
   `SameSite` trên HTTPS thật chưa được kiểm.
4. **Autopilot là bot bàn phím**, không phải người thật: nó không chứng minh độ dễ
   hiểu của UI, chỉ chứng minh luồng dữ liệu và logic nhiệm vụ chạy đúng.
5. **N05 dùng tài nguyên kiếm được trong lượt chơi ngắn** (125 vàng, 1 cuộn). Với
   người chơi thật, chi phí này phụ thuộc số phòng đã dọn.

## 5. Cách chạy lại

```bash
# E2E tân thủ (server thật + DB bộ nhớ)
PLAYWRIGHT_MODULE=C:/Users/PuuGoo/AppData/Local/hermes/cache/scratch/artemis-browser/node_modules/playwright-core/index.mjs \
  node tools/e2e-new-player.mjs

# Chỉ dev server với DB bộ nhớ (không cần Atlas)
DB_BACKEND=memory NODE_ENV=test JWT_SECRET=<>=32 ký tự> PORT=3111 node dev-server.mjs
```

## 6. Regression sau Đợt 3

| Lệnh | Kết quả |
|---|---|
| `npm run check` | pass (đã thêm `lib/initialState.js`) |
| `node --test tests/*.test.mjs` | **179 test — 171 pass / 6 fail / 2 skip** |
| `node tools/e2e-new-player.mjs` | **17/17 PASS**, `errors: []` |
| `node tools/audit-new-player-browser.mjs` | 15/15 PASS (mock auth/save, vẫn giữ) |

6 fail vẫn là đúng sáu suite baseline (`bestiary`, `chapter-select`, `economy`,
`garden`, `map-select`, `season`) — chưa sửa, không đổi expected để ép xanh.
`tests/new-player-zero-state.test.mjs` được cập nhật để khoá hành vi mới
(guard phải đứng trước `grantStarterWeaponIfNeeded`).
