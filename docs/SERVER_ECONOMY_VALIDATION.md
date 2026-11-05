# SERVER-SIDE ECONOMY VALIDATION — ARTEMIS

> Chặn việc tự cấp vàng/đá quý qua `PUT /api/save`. Đây là lớp bảo vệ **phía
> server**, không phụ thuộc việc client có bị sửa hay không.

---

## 1. Vấn đề

`PUT /api/save` nhận bất kỳ `gold`/`gems` nào client gửi lên. Trần cũ là `1e12`
(1000 tỷ) — không có tác dụng bảo vệ. Một người dùng sửa `localStorage` hoặc gọi
thẳng API có thể tự cấp 1000 tỷ vàng trong **một** request.

Đo trên DB production trước khi vá: nhiều tài khoản có `gold: 9999999`,
`gems: 999999` nhưng `goldEarned: 0` — dấu vết của đường này.

## 2. Vì sao KHÔNG đặt trần tuyệt đối

Đặt trần (ví dụ `gold ≤ 10.000.000`) sẽ:
- Phá dữ liệu người chơi hợp lệ đã tích luỹ lâu dài
- Không thể biết người chơi cũ đang có bao nhiêu
- Vi phạm nguyên tắc "không xoá dữ liệu người chơi"

Đo thực tế DB: tài khoản cao nhất có **10.357.405 vàng** (puugoo) với
`goldEarned: 352.156`. Đặt trần thấp hơn sẽ cắt mất tài sản của người chơi thật.

## 3. Cách chặn: giới hạn DELTA

```
goldMới - goldCũ  ≤  500.000 × sốRevisionTăng
gemsMới - gemsCũ  ≤   20.000 × sốRevisionTăng
```

**Vì sao dùng `revision` làm mốc:** người chơi hợp lệ kiếm vàng bằng cách chơi
trận. Mỗi trận lưu save vài lần → `revision` tăng theo số trận. Kẻ gian gửi
+1000 tỷ trong khi `revision` chỉ tăng 1 → bị chặn.

### Ngưỡng có căn cứ (đo từ source, không tự cảm tính)

| Nguồn vàng hợp lệ | Giá trị |
|---|---|
| Thắng chương 3: `350 × 3` + (15 phòng × 28 vàng rơi) | ≈ 1.500 / trận |
| Bán/merge trang bị: `computeTotalUpgradeGoldSpent(100)` | ≈ 230.000 một lần |
| **Chọn ngưỡng** | **500.000 / revision** |

500.000 thoải mái cho mọi trường hợp hợp lệ, vẫn chặn được leo thang kiểu
+1000 tỷ.

### Không chặn nhầm

- **Không chặn GIẢM** — tiêu vàng, hoàn cấp, bán đồ đều hợp lệ.
- **Không chặn khi `goldCũ` vốn đã lớn** — giữ nguyên tài sản cũ.
- **Lần lưu đầu tiên** (chưa có bản ghi) không so sánh delta, chỉ áp trần cứng.

## 4. Mã lỗi

| Code | Ý nghĩa |
|---|---|
| `ECONOMY_GOLD_JUMP` | Vàng tăng bất thường so với tiến trình |
| `ECONOMY_GEMS_JUMP` | Đá quý tăng bất thường |
| `ECONOMY_FAKE_EARNED` | Khai khống `lifetimeStats.goldEarned` để hợp thức hoá |
| `ECONOMY_HARD_CAP` | Vượt trần cứng 1e12 (chỉ để chặn tràn số) |

`ECONOMY_FAKE_EARNED`: `lifetimeStats.goldEarned` là bộ đếm CHỈ TĂNG do game tự
cộng. Nếu client khai khống nó, kiểm tra
`earned > gold × 100 + 1.000.000` sẽ phát hiện.

## 5. Luồng xử lý

```
PUT /api/save
  → sanitizeSave (whitelist, clamp, giới hạn kích thước)
  → kiểm tra revision (409 nếu lệch)
  → validateEconomyDelta(serverData, clientData, 1)      ← MỚI
       nếu fail → 422 + { code, detail, conflict, serverRevision, serverData }
                  KHÔNG ghi DB
  → updateOne (revision + 1)
```

Khi client nhận `ECONOMY_*`:
1. Ghi `serverData` trở lại `localStorage`
2. Cập nhật `revision` về `serverRevision`
3. Toast cảnh báo, reload sau 1.6s

Nhờ vậy người chơi **không tiếp tục chơi trên dữ liệu sai**, và không ghi đè
dữ liệu hỏng lên máy chủ.

## 6. Admin grant không bị ảnh hưởng

`PATCH /api/admin/players` với `action: "grant"` ghi thẳng vào DB, **không** đi
qua `/api/save`, nên không bị `validateEconomyDelta` chặn. Đúng thiết kế: admin
có quyền cấp tài nguyên có kiểm soát, có ghi `adminNote`.

## 7. Kiểm thử

### `tests/economy.test.mjs` — 37 assertion (unit)

- Delta hợp lệ qua: 1 trận, 50 trận liên tiếp, hoàn tiền merge 230.000
- Tấn công bị chặn: +9.999.999, +999.999 gems, +100 tỷ, khai khống `goldEarned`
- **Không phá dữ liệu cũ**: puugoo 10.357.405 vàng vẫn qua; 9.999.999 giữ nguyên
- Tiêu vàng luôn hợp lệ
- `NaN`/`undefined` không crash
- `revisionDelta` 0 và 3 hoạt động đúng

### `tests/economy-live.mjs` — 16 assertion (server thật)

```
1. Tạo tài khoản + lưu 500 vàng          → 200
2. Kiếm 1500 vàng                        → 200
3. Gửi +9.999.999 vàng                   → 422 ECONOMY_GOLD_JUMP
4. Save trên server vẫn 2000, revision không tăng
5. Gửi +999.999 gems                     → 422 ECONOMY_GEMS_JUMP
6. Khai khống goldEarned                 → 422 ECONOMY_FAKE_EARNED
7. Sau khi bị chặn vẫn lưu tiếp bình thường → 200
8. Tiêu vàng                             → 200
```

## 8. Kiểm chứng trên production

Sau khi deploy, tấn công thật qua `artemis-puugoo.vercel.app`:

```
Đăng ký + lưu save gốc (500 vàng)   → 200, revision 1
PUT +9.999.999 vàng                 → 422
  { code: "ECONOMY_GOLD_JUMP",
    error: "Số vàng tăng bất thường so với tiến trình. Tiến trình chưa được lưu." }
GET /api/save                       → gold: 500, revision: 1  (không bị ghi đè)
```

## 9. Giới hạn đã biết

- Người chơi có thể chơi rất nhiều trận rồi lưu một lần với delta lớn —
  nhưng delta vẫn bị chặn theo `revision`, và mỗi lần lưu tăng 1 revision nên
  muốn +500.000 phải lưu ít nhất 1 lần. Chơi 50 trận thật rồi mới lưu sẽ dùng
  1 revision → chỉ được +500.000, đúng bằng một trận thắng lớn. Đây là đánh đổi
  chấp nhận được: người chơi thật lưu save liên tục (debounce 1.2s).
- Không kiểm tra tính hợp lệ của từng giao dịch mua/bán — chỉ kiểm tra tổng.
- `revision` có thể bị client gửi sai để lách; nhưng `revision` do server cấp và
  kiểm tra ở bước trước, nên không lách được.
