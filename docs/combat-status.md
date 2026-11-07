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

- 20 test `combat-status.test.mjs`: VM thực thi `damageEnemy`, `updateGame`, spawner và renderer production; kiểm .01/.033/.1s partition, nhịp hết hạn, nonstack, cổng sở hữu/rank, Cleo+Blaze, Rolla, chết một lần, không ghi save, lowGfx/reduced-motion; thêm phẩm chất/đúng nhóm ô của Hỏa Độc Ấn, raw potency, Nezha và nhãn sát thương.
- 3 test `gem-combat-impact.test.mjs`: chạy `getComputedStats` thật với fixture trung tính. Ruby +18 ATK; Sapphire +90 HP và DEF; Amethyst +2% crit; Emerald +2% dodge; Topaz +5% vàng. Chỉ sockets trên đồ đang mặc có tác dụng; ngọc trong túi/kho không bị tính nhầm; HP/ATK quái cùng chương/phòng không tăng theo ngọc.
- Chrome thật qua `tools/verify-combat-status-browser.mjs`, mock auth/save localhost, không DB/tài khoản thật: Độc Tiễn gây một nhịp 38 HP khi ATK152; quái thường đi 0.25px bình thường và 0.1375px lúc chậm trong bước đo. Không thay save trong probe combat, 0 lỗi JS và 0 tài nguyên local lỗi. Probe sàn trống tách va chạm chướng ngại khỏi phép đo.
- Đính chính bằng chứng renderer cũ: sau `stopGameLoop()`, Resume chỉ bỏ pause chứ không tự nối lại rAF; ảnh không rỗng trước đó chưa đủ chứng minh hiệu ứng mới được vẽ. Harness nay nối lại **vòng gameLoop thật qua export chỉ trong HTML fixture**, kiểm số lần hook status tăng (24 lần trong lần chạy lưu), không có lỗi update/render, rồi chụp lại. Không thêm API debug vào production.
- Đây là state-jump/run fixture, không phải người chơi tự đi hết chương, không phải production E2E, chưa có số FPS. Ảnh tổng quan không đủ để khẳng định biểu tượng nhỏ dễ đọc ở mọi cỡ màn hình.
- Bộ test hồi quy skill-art, monster-art, admin campaign và sở hữu anh hùng đã chạy cùng nhóm: 58/58 đạt trước lần tăng độ rõ huy hiệu; nhóm trạng thái/ngọc đã chạy lại 16/16 sau sửa.

## Giới hạn và phần chưa làm

Không tuyên bố toàn bộ mô tả wiki đã hoạt động: Super Venom/Blaze/Freeze/Bolt, Elemental Domain/Crit, Băng Lôi Ấn và enchant meteor/phi kiếm chưa được triển khai trong task này. Bonus lửa theo roster chưa được nối; không dùng mô tả để giả vờ cộng damage. Sét thường vẫn dùng cơ chế cũ. Ngọc Ruby/Sapphire là bonus stat, không tự biến thành lửa/băng. Dấu vết trên sàn chỉ là đồ họa, không phải vùng sát thương mới. Không sửa save schema, quyền sở hữu, inventory, giá hoặc bảng `CAMPAIGN_TUNING`.

## Hỏa Độc Ấn — bonus theo phẩm chất đã nối

Nguồn dữ liệu đã có trong repo: `public/rune-wiki-data.js`, Epic: Fire DMG +50%, Legendary: Poison DMG +50%. `RuneEconomy` ánh xạ Epic = 4, Legendary = 7, Mythic = 11. Phần trăm không tăng theo mọi bản sao trung gian.

- Chỉ có tác dụng khi rune thật sự thuộc bộ sưu tập và nằm trong nhóm ô `enhancement`. Rune trong túi, chưa sở hữu hoặc khảm sai nhóm không tạo bonus. Không cấp rune hay nâng hạng tài khoản.
- Từ hạng 4: +50% trên các nhịp cháy thật (Blaze, Cleo, Nezha, bộ trang bị, Hỏa Độc Chạm) và lửa chạm của Nezha. Từ hạng 7: thêm +50% trên độc tức thì của Độc Tiễn và DoT độc (Độc Tiễn/Hỏa Độc Chạm).
- `damageEnemy` nhận element riêng bên cạnh cờ secondary hiện có. Chỉ nguồn `'fire'`/`'poison'` được hưởng bonus; đòn vật lý, sét, ultimate, meteor/Touch hỗn hợp chưa định danh không bị tăng bừa theo màu VFX.
- Potency lưu trên quái vẫn raw, chỉ scale một lần lúc trừ máu, rồi làm tròn ở cuối pipeline hiện hành. Tháo/khảm lại không nhân dồn; không thay nhịp, thời lượng hay quy tắc strongest-source. Hệ số hero/mark cũ vẫn áp dụng như trước.
- Số sát thương thật hiện `LỬA` cam / `ĐỘC` xanh, dùng chính final damage đã trừ. Không sinh thêm vòng AoE/hazard giả hoặc animation loop mới.
- Hồ sơ rune mở bằng card thật có khối “Đã hoạt động trong Artemis”; giữ bảng wiki riêng và ghi rõ chưa có nổ Mythic, bonus phẳng Normal/Fine và phù phép. Không đoán hệ số nổ từ mô tả thiếu số.

Chrome với ATK100, hero trung tính, Blaze + Độc Tiễn, một mục tiêu sống:

| Rune | Sát thương lúc trúng (100 vật lý + độc) | Sát thương trong giây kế tiếp (3 cháy + 1 độc) |
|---|---:|---:|
| Hạng 0/3 hoặc hạng 4 chưa khảm | 150 | 109 |
| Hạng 4/6 đã khảm | 150 | 151 |
| Hạng 7/11 đã khảm | 175 | 164 |

7/7 biến thể sở hữu/phẩm chất/khảm trong Chrome khớp, snapshot save sau khi khôi phục fixture không đổi. Flow UI thật: về sảnh → Trang Bị → Ngọc → card Hỏa Độc Ấn → đọc ghi chú → đóng, không thay collection. Ảnh mobile nằm trong `docs/combat-status-evidence/seal-detail-mobile.png`. Screenshot combat chỉ là một thời điểm nên không bảo đảm đồng thời đọc được mọi nhãn.

Toàn suite hiện hành: **349 test, 342 đạt, 0 lỗi, 7 integration bỏ qua** (không có DB/server thật). `npm run check`, compile inline scripts và `git diff --check` đạt. Đây vẫn là Chrome/mock-services và production functions/VM, không phải production E2E hay số liệu tỉ lệ thắng/FPS.
