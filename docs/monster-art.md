# Mỹ thuật quái theo chương

## Phạm vi

- Nhập đúng 40 PNG được cung cấp, giữ nguyên tên và byte nguồn: 30 quái thường + 10 trùm. Không lấy thêm ảnh từ thư mục composer.
- `public/monster-art.js` là manifest duy nhất và bộ chọn pool theo môi trường. Chương 1–7: đá, lửa, hư không, bầu trời, hư không, băng, rừng. Chương 8–19: lửa, đá, bầu trời, băng, lửa, rừng, bầu trời, hư không, rừng, đá, băng, hư không. Pool bầu trời dùng trùm băng vì bộ ảnh không có trùm thuộc nhóm trời.
- Khi bắt đầu lượt, `MonsterArt.beginRun(Game)` sinh seed chỉ trong bộ nhớ. `setupRoom()` gọi `assignRoom()` **sau constructor thật**, gán ngoại hình theo seed/chương/phòng/chỉ số entity. Mỗi lượt có thể khác; dựng lại cùng phòng trong cùng lượt giữ nguyên ảnh. Không tung ngẫu nhiên mỗi khung hình. Continue/reload bắt đầu seed mới; không thêm trường vào save/checkpoint.
- Renderer chiến đấu thật: `drawMonsterSprite` → `ArenaV2.drawMonster` → `MonsterArt.draw`. PNG neo đáy và giữ tỉ lệ, kể cả transform bên ngoài; không squash/stretch raster. Vẫn giữ bóng, vầng khí, hiệu ứng xuất hiện, cảnh báo đòn, burn/slow, hit flash và thanh máu hiện có.
- Cache lazy tối đa 40 ảnh, không tạo Image mỗi khung, không tải lại liên tục khi lỗi. Ảnh chưa tải/lỗi/không biết/sai nhóm boss dùng thân vector cũ.
- Chỉ thay **ngoại hình cuộc chạm trán**, không thay loại AI, HP/ATK/tốc độ/bán kính/vị trí hay phần thưởng. Một ảnh không cam kết AI riêng; tên trùm vẫn mô tả archetype gốc. Không thêm chương, quái AI mới hoặc sửa cân bằng.

## Tài sản và hình thức

`monster-art-assets.json` liệt kê đủ tên, nhóm, boss, kích thước, alpha min/max và SHA-256 từng ảnh. Kiểm tra bằng Pillow: tất cả 40 ảnh có pixel trong suốt; kích thước 198×198 hoặc 200×200, tổng 1.858.843 byte; bản sao khớp byte nguồn.

`monster-art-contact-sheet.jpg` là bảng kiểm hình từ đúng 40 ảnh, theo thứ tự manifest. Đã xem bằng vision: chủ yếu icon sinh vật toàn thân, không phải sprite sheet hoạt ảnh; ảnh thứ 13 thiên về thân trên, 31–32 có bố cục nhiều phần. Các biến thể màu có silhouette gần nhau; chưa xác nhận độ dễ đọc ở kích thước chiến đấu trong browser.

## Bằng chứng

Lệnh giới hạn RAM, không mạng/DB/tài khoản:

```sh
node --max-old-space-size=128 --test tests/monster-art.test.mjs
```

- PASS (VM/unit): 5 test; đúng 40 tệp PNG RGBA và payload giải nén được.
- PASS (VM handler thật): gọi `setupRoom()` với 19 ID chương × 15 phòng fixture, pool phủ đủ 40 ảnh; ảnh boss chỉ trên boss, cùng phòng ổn định, gán art không đổi trường chiến đấu. Đây là fixture 15 phòng/chương, không tuyên bố chơi hết tất cả phòng thực của chiến dịch.
- PASS (VM renderer thật): thực thi thân hàm `ArenaV2.drawMonster` trên entity do `setupRoom` tạo, spy canvas xác nhận drawImage, fallback loading/error, transform hữu hạn, save/restore cân bằng và không sửa entity. Image và canvas được giả lập; không chứng minh browser decode/raster thực.
- PASS: cache tối đa 40, không tải lại khi lỗi, tỉ lệ 2:1 giả lập được giữ; mọi inline script biên dịch được.
- PASS (regression VM): `node --max-old-space-size=128 --test tests/zodiac-boss-art.test.mjs` trả 4/4; vector hoàng đạo cũ vẫn dùng được làm fallback. `git diff --check` không báo lỗi.
- BLOCKED: browser/gameplay E2E, tải ảnh HTTP và đánh giá hình trên arena. RAM trống khoảng 2,3 GB, dưới ngưỡng 3 GB để mở browser an toàn. Không chạy full suite, không cài dependency, không ghi dữ liệu ngoài, không commit/push.
