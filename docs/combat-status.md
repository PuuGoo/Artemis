# Combat: trạng thái, rune và dấu hiệu trên map

## Đã triển khai

- `CombatStatus` dùng chung cho cháy từ Cleo, Blaze, Nezha, bộ trang bị và Hỏa Độc Chạm. Giữ nguồn mạnh nhất đang hoạt động, không cộng lớp; làm mới không dời nhịp hoặc ghi đè thành nguồn yếu hơn.
- Cháy chuyển từ xác suất `random < dt * 3` sang 3 nhịp/giây theo thời gian. Giữ ngân sách sát thương kỳ vọng trước đây, xử lý đuôi thời lượng lẻ và không gây thêm nhịp sau hết hạn. Không tự đổi thành 5/10 nhịp theo mô tả wiki.
- Độc Tiễn nay hoạt động thật: đòn chính thêm 0.50 ATK độc, sau đó 0.25 ATK/giây cho tới chết. Một lớp độc mạnh nhất, đánh lại không cộng lớp hoặc dời nhịp. Hệ số DoT 0.25 là lựa chọn cân bằng của Artemis, không phải số đã xác minh từ wiki.
- Băng giảm 45% quãng di chuyển của cả quái thường, dơi và boss, đồng thời giảm nhịp tấn công. Hiệu ứng hết giữa bước chỉ áp dụng phần thời gian còn hiệu lực; Băng Tiễn không cắt ngắn 3.2s băng của Rolla.
- Hỏa Độc Chạm và Băng Lôi Chạm có đồng hồ độc lập, chỉ tác dụng khi sở hữu/khảm đúng và hạng >=4. Hỏa Độc không làm chậm; Băng Lôi không gây cháy/độc.
- Quái chết bởi DoT không tiếp tục di chuyển, va chạm hoặc bắn trong cùng frame; cập nhật snapshot tránh bỏ sót quái kế tiếp khi hàm chết thay mảng.
- Renderer thật dùng dấu lửa/băng/giọt độc theo live state, có huy hiệu nền tối và vệt màu trên sàn. Tối đa 3 dấu/quái, không sinh entity/hạt/cache/gradient. Chế độ lowGfx/reduced-motion giữ hình nhận biết, bỏ chuyển động trang trí.
- Đồng bộ renderer read-only của admin với snapshot combat hiện hành. Không sửa chỉ số quái hay đường cong chiến dịch.

## Ngân sách Touch

Các số sau là raw trước hệ số hero/mark đang có, một lần kích hoạt trên mục tiêu còn sống và hàng xóm trong tầm; không phải DPS đo trong gameplay:

| Cơ chế | Trong một cửa sổ 3 giây |
|---|---|
| Touch cũ (hai rune dùng chung handler) | 0.90 ATK trực tiếp + 9 × 0.45 ATK cháy = 4.95 ATK |
| Hỏa Độc mới | 0.45 ATK trực tiếp + 9 × 0.15 ATK cháy + 3 × 0.20 ATK độc = 2.40 ATK |
| Băng Lôi mới | 0.90 ATK mục tiêu + tối đa 0.45 ATK hàng xóm = 1.35 ATK |
| Cả hai mới | Tối đa 3.75 ATK, thấp hơn ngân sách 4.95 ATK cũ |

Chu kỳ hiện tại là 1.65s. Hiệu ứng trạng thái làm mới, không xếp chồng vô hạn. Không đổi hitbox/số lượng quái/phần thưởng để bù ngầm cho kỹ năng. Mô tả gameplay của các kỹ năng/rune đã sửa ghi rõ cách Artemis thực thi; dữ liệu tham khảo nguồn vẫn riêng biệt.

## Kiểm chứng

- 13 test `combat-status.test.mjs`: VM thực thi `damageEnemy`, `updateGame`, spawner và renderer production; kiểm .01/.033/.1s partition, nhịp hết hạn, nonstack, cổng sở hữu/rank, Cleo+Blaze, Rolla, chết một lần, không ghi save, lowGfx/reduced-motion.
- 3 test `gem-combat-impact.test.mjs`: chạy `getComputedStats` thật với fixture trung tính. Ruby +18 ATK; Sapphire +90 HP và DEF; Amethyst +2% crit; Emerald +2% dodge; Topaz +5% vàng. Chỉ sockets trên đồ đang mặc có tác dụng; ngọc trong túi/kho không bị tính nhầm; HP/ATK quái cùng chương/phòng không tăng theo ngọc.
- Chrome thật qua `tools/verify-combat-status-browser.mjs`, mock auth/save localhost, không DB/tài khoản thật: Độc Tiễn gây một nhịp 38 HP khi ATK152; quái thường đi 0.25px bình thường và 0.1375px lúc chậm trong bước đo. Không thay save, 0 lỗi JS và 0 tài nguyên local lỗi. Renderer tiếp tục chạy với 3 quái và canvas có alpha. Probe sàn trống tách va chạm chướng ngại khỏi phép đo.
- Đây là state-jump/run fixture, không phải người chơi tự đi hết chương, không phải production E2E, chưa có số FPS. Ảnh tổng quan không đủ để khẳng định biểu tượng nhỏ dễ đọc ở mọi cỡ màn hình.
- Bộ test hồi quy skill-art, monster-art, admin campaign và sở hữu anh hùng đã chạy cùng nhóm: 58/58 đạt trước lần tăng độ rõ huy hiệu; nhóm trạng thái/ngọc đã chạy lại 16/16 sau sửa.

## Giới hạn và phần chưa làm

Không tuyên bố toàn bộ mô tả wiki đã hoạt động: Super Venom/Blaze/Freeze/Bolt, Elemental Domain/Crit, hiệu ứng Seal theo phẩm chất và enchant meteor/phi kiếm chưa được triển khai trong task này. Bonus lửa theo roster chưa được nối; không dùng mô tả để giả vờ cộng damage. Sét thường vẫn dùng cơ chế cũ. Ngọc Ruby/Sapphire là bonus stat, không tự biến thành lửa/băng. Dấu vết trên sàn chỉ là đồ họa, không phải vùng sát thương mới. Không sửa save schema, quyền sở hữu, inventory, giá hoặc bảng `CAMPAIGN_TUNING`.
