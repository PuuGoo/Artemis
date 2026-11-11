# Artemis Content Studio — bản MVP

Trang: **Admin → Chiến dịch & Quái/Boss → Content Studio** hoặc `/admin-studio.html`.

## Đã triển khai

1. **Boss Builder**: import sprite atlas PNG trong suốt 6 cột × 4 hàng hoặc chọn 22 PNG riêng: `idle_01.png` tới `idle_06.png`, `attack_01.png` tới `attack_06.png`, `hit_01.png` tới `hit_04.png`, `death_01.png` tới `death_06.png`. Preview 4 trạng thái 6/6/4/6 frame. Cell vuông 64–512px, atlas tối đa 1,2 MB. Chấp nhận PNG RGBA và PNG palette tRNS.
2. **Thư viện Boss**: lưu bản Draft → Publish. Boss mặc định không bị xóa.
3. **Map Editor**: chọn biome sẵn có của game, preview bằng cùng `ArtemisArenaRenderer`, lưu Draft → Publish. Đây là thay đổi mỹ thuật đấu trường: nền và theme.
4. **Chapter placement**: gắn Boss/Map Published vào phòng boss 10/20/30/40/50 của bất kỳ chương 1–12. Có Draft/Publish và Trả về mặc định.
5. **Runtime**: `/content-studio-runtime.js` nạp manifest chỉ Published từ `/api/content-studio`; renderer ưu tiên PNG mới khi sẵn sàng và tự fallback art gốc nếu tải thất bại. 6 frame Attack đồng bộ 750ms.

## Cách dùng

- Vào Studio, import atlas hoặc 22 PNG, xem thử bốn hoạt ảnh, nhập tên/hệ/màu, bấm **Lưu Boss Draft**.
- Trong Thư viện Boss, bấm **Publish** boss muốn sử dụng.
- Map Editor: chọn biome, xem demo, đặt tên, lưu Draft, Publish map.
- Gắn boss vào chương: chọn chương và ải, chọn boss/map, bấm **Lưu phân bổ nháp**, sau đó **Publish vào game**.
- Vào trận mới để tải manifest đã Publish. Bấm **Trả về mặc định** tại vị trí nếu muốn hoàn tác.

## Giới hạn giữ an toàn chiến đấu

MVP chỉ đổi **ngoại hình boss** và **visual biome**. KHÔNG sửa AI, loại quái gốc, đạn, thời điểm sát thương, HP/ATK, hitbox, vật cản collision, reward, save.
Mẫu AI chọn trong form là thông tin tham chiếu cho Combat Designer trong tương lai, chưa thay đổi logic AI của slot.
Tên boss mới được tích hợp với trùm phụ khi manifest sẵn sàng. Boss cuối vẫn mang tên chiến dịch mặc định.
Map Editor hiện chưa hỗ trợ kéo thả vật cản có collision, và không hỗ trợ tạo chương mới ngoài 1–12. Đó là các giai đoạn kế tiếp.

## API / giới hạn Vercel

- `/api/admin/studio` được rewrite đến `api/admin/campaign.js`, chỉ tài khoản Admin mới được ghi, có Origin check.
- `/api/content-studio` được rewrite đến `api/privileges.js`, chỉ công bố nội dung Published và ảnh đã xuất bản.
- MongoDB collection `content_studio` lưu Draft/Published; index riêng `(kind,id)`; PNG dạng base64, không viết vào filesystem Vercel.
- Tái sử dụng tổng cộng 12 Vercel Functions của dự án hiện tại (Hobby).

## Kiểm thử

- `node --test tests/content-studio.test.mjs`
- `npm run check && npm test`
- Cần playtest thủ công trên production sau deploy: import, Publish, tải trận, rollback, mobile FPS.
