# Save backend

| File | Trách nhiệm |
|---|---|
| `schema.js` | Whitelist, chuẩn hoá và giới hạn snapshot client |
| `initialState.js` | Seed chuẩn do server tạo cho tài khoản mới |
| `policy.js` | Quyền sở hữu, tương thích client cũ, kiểm tra chuyển trạng thái |
| `repository.js` | Projection, restore và ghi compare-and-set qua collection được truyền vào |

HTTP/auth/rate limit ở `api/save.js`, không chuyển vào thư mục này.
Luật kinh tế dùng chung vẫn ở `lib/economy.js` và `lib/economyLedger.js`.
Không đọc `.env`, không mở MongoDB trong policy/repository và không thêm barrel export
che vòng phụ thuộc. Import trực tiếp file sở hữu symbol.

Test trực tiếp: `node --max-old-space-size=192 --test --test-concurrency=1 tests/save/*.test.mjs`.
`npm test` tự tìm cả test thư mục con lẫn các test cũ ở root.
