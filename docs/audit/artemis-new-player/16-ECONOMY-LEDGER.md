# 16 — Đợt 7: P0 economy provenance — ngân sách theo đồng hồ server

Đây là blocker P0 mở từ đầu audit. Bản vá đóng **phần nguy hiểm nhất** của nó và ghi
rõ phần còn lại.

## 1. Lỗ hổng trước bản vá

`validateEconomyDelta` (lib/economy.js) cho phép client tự khai số dư, chỉ chặn ở
ngưỡng **500.000 vàng và 20.000 đá quý MỖI REVISION**. Vì trần tính theo *số lần lưu*
chứ không theo *thời gian chơi*:

| Kịch bản | Trước bản vá |
|---|---|
| PUT 1 lần, khai +500.000 vàng | **Lọt** |
| PUT 4 lần liên tiếp (vài trăm ms) | **Mint 2.000.000 vàng + 80.000 đá** |
| Cần chơi trận nào không | **Không** |

## 2. Cách sửa

Thêm `lib/economyLedger.js`: server giữ **ngân sách** và nạp dần theo **đồng hồ server**.

```js
RATES  = { goldPerSecond: 300, gemsPerSecond: 1/4 }
BURST  = { gold: 90s, gems: 600s }
=> trần mỗi lần lưu: 27.000 vàng, 150 đá quý
```

- Ngân sách lưu trong **document save** (`ledger: { v, at, gold, gems }`), không phải
  phía client.
- Mỗi lần lưu: `refillLedger()` nạp theo `now - ledger.at`, rồi **trừ** phần đã tiêu.
- Client **không thể tua nhanh** đồng hồ server → trần thu nhập bị chặn theo thời gian.
- Offline 1 tuần cũng chỉ nạp tới mức dự trữ, không tích luỹ vô hạn.
- Đồng hồ bị chỉnh lùi: **không trừ** ngân sách (không phạt oan), chỉ giữ nguyên.
- Ledger hỏng/thiếu (save cũ chưa có field): coi như **đầy dự trữ**, để người chơi cũ
  không bị chặn oan ở lần lưu đầu sau deploy.

Thứ tự kiểm tra trong `api/save.js`: `validateEconomyDelta` (chặn payload khổng lồ) →
`validateEconomyBudget` (chặn theo thời gian) → `validateSeasonDelta` → CAS ghi.

## 3. Kết quả đo lại

| Kịch bản | Trước | Sau |
|---|---|---|
| PUT 1 lần +500.000 vàng | 200 (lọt) | **422 `ECONOMY_BUDGET_GOLD`** |
| 4 lần PUT × +500.000 | mint 2.000.000 | **mint 0** |
| PUT +20.000 đá quý | 200 (lọt) | **422 `ECONOMY_BUDGET_GEMS`** |
| Người thật: +2.000 vàng sau 20s | OK | **OK** |
| Người thật: 40 trận trong 10 phút | OK | **OK** (có test riêng) |
| Tiêu sạch vàng | OK | **OK** (tiêu không tiêu ngân sách) |
| `NaN`/`Infinity`/`1e20`/`-1` | ghi đè số dư | **422 `ECONOMY_INVALID_VALUE`** |

Test: `tests/economy-budget.test.mjs` **14/14** (đơn vị) và
`tests/economy-budget-api.test.mjs` **6/6** (qua HTTP thật, DB bộ nhớ, nên đi qua đúng
bcrypt → JWT → sanitizer → CAS).

## 4. Còn lại — nói thẳng

Bản vá này là **TRẦN TỐC ĐỘ do server áp**, không phải **bằng chứng từng hành động**:

- Kẻ gian vẫn mint được tối đa ~**300 vàng/giây** và ~**1 đá/4 giây**. Với người chơi
  thật, mức đó tương đương thu nhập hợp lệ, nên không phá nền kinh tế — nhưng nó
  **không** chứng minh được "vàng này đến từ trận thắng nào".
- Muốn chứng minh từng nguồn cần **action ledger**: client gửi danh sách sự kiện
  (thắng phòng, nhận quest, mở rương) và server tính lại phần thưởng từ bảng reward
  của chính nó. Việc này cần:
  1. Chuyển bảng reward sang module dùng chung client+server (hiện nằm trong
     `public/index.html`).
  2. Instrument ~18 điểm cộng vàng/đá trong client.
  3. Chống replay (event id + nonce + cửa sổ thời gian).
- Vì vậy mục P0 nay là **GIẢM MẠNH** chứ chưa **ĐÓNG HOÀN TOÀN**. Đừng ghi "đã xong".

## 5. Rủi ro triển khai

- **Client cũ** (bundle trong cache) vẫn lưu được vì ledger nằm phía server; chúng chỉ
  bị chặn nếu khai vượt tốc độ — đúng ý đồ.
- Người chơi mở nhiều tab và lưu liên tục: mỗi tab đều bị trừ cùng một ngân sách, nên
  tổng vẫn đúng. Không có ngân sách "mỗi tab".
- Nếu một phiên chơi thật kiếm > 27.000 vàng trong **một** lần lưu (ví dụ nhận thưởng
  chương lớn), người chơi sẽ gặp 422. Ngưỡng 27.000 vàng ≈ 90 giây chơi liên tục; nếu
  về sau có nguồn thưởng lớn hơn, phải nâng `BURST_SECONDS.gold` — và test
  `người chơi thật: nhiều trận liên tiếp` sẽ bắt được nếu nâng quá tay.
- Rollback: xoá lời gọi `validateEconomyBudget` trong `api/save.js` là quay lại hành vi
  cũ; field `ledger` trong document vô hại nếu bỏ dùng.
