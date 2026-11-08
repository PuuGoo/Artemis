# Tích hợp pipeline sát thương đã phân tích vào Artemis

## Thay đổi gameplay thật

`public/combat-damage.js` được tải trước game và gọi từ `damageEnemy`, `hurtPlayer`, DoT và passive gây sát thương phụ. Đây không còn là module chỉ nằm trong báo cáo.

- Fixed-point Q65536 bằng BigInt, tách wide-multiply và MUL-low64/ASR16 đúng các vùng đã phân tích.
- RNG48 riêng theo lượt chơi; reset khi startNewRun, không dùng RNG crit chung với VFX/drop.
- Crit/supercrit, kháng crit và crit-value, điều kiện strict của supercrit, floor raw66191.
- Các nhánh GetDecrease đã kiểm: đứng/di chuyển, body/bullet, race ưu tiên, flying/ground, sword-intent đầu vào, invHurt, nguyên tố và nguồn phụ.
- Vulnerability, final hurt/reduction và clamp[0.2,5], flat decrease, coefficient, rounding, minimum1, extraHurtPercent, limitHurtToOne/hurtOnlyOne/isUseShield.
- Hấp thụ khiên, khiên phụ trước khiên thường, shield-and-body, broken-state và thứ tự callback.
- Các passive Oracle/Cleo/Rolla/Phynx/Dragon không còn tự trừ HP để xuyên pipeline. AoE hạ mục tiêu khác xử lý death ngay; mục tiêu chính defer tới cuối handler. `onEnemyKilled` có guard chống trả thưởng hai lần.
- Đạn quái giữ nguồn bắn khi chạm người chơi; body và projectile có context riêng.
- Đạn vũ khí/flying sword/sprite/orb/meteor truyền loại nguồn đã xác định. Nguồn chưa map dùng loại0, không mặc định tất cả là main weapon. Nguồn fire/lightning đã xác định đi qua đúng nhánh nguyên tố.
- Giữ passives, skill gates, cooldown, revive và một-hit Sacred Protection của Artemis. Wounded Warrior/Riposte chỉ kích khi mất HP sau khiên.

## Cầu nối chỉ số — không tự tạo sức mạnh mới

| Input native | Cách nối Artemis |
|---|---|
| Attack đầu vào | ATK/scale/hero bonus/mark hiện có; chưa thay source-stat builder bằng một bản suy đoán |
| CritRate/CritValue | critRate và critDmgMult từ stats thực của người chơi |
| SuperCirtRate/SuperCritValue | chỉ có tác dụng khi nguồn cung cấp; mặc định0, không tự cấp bonus |
| GetDecrease modifiers | object `entity.combatAttributes`, giữ đúng tên native và đơn vị tự nhiên:0.5=hệ số50%,10=10 damage |
| DEF Artemis | giữ phép đổi DEF→dmgReduction hiện có; truyền `1-dmgReduction` như hệ số tương thích; **không trừ defFlat lần nữa** |
| Guardian/Wukong | hệ số có sẵn đưa vào chuỗi nhân; không cộng phần trăm tuyến tính, không làm tròn HP sau từng buff |
| FinalHurt | `entity.combatSourceData.FinalHurt`, mặc định0 |
| Khiên thường/phụ | shieldHp/darkShieldHp trong entity lượt chơi; không tự cấp khiên cho người chưa có |
| ID buff khiên gốc | chỉ hỗ trợ callback, không nhập ID thương mại thành skill/reward |

Các hệ số chưa có nguồn stats dùng1, phần cộng dùng0. `combatSourceData` hỗ trợ nối các trường SourceData bổ sung sau này. Các context đặc biệt đi qua argument của hit; không ghi chúng vào save hoặc cấp item/hero/rune.

## Những lựa chọn tương thích phải biết

- Rounding/stacking mới có thể lệch1 damage so với phép nhân float cũ; đây là thay đổi có chủ đích để dùng pipeline đã phân tích.
- Clamp0.2 lượng tử hóa bằng quy ước web `round(value*65536)`; chưa khẳng định parser Const.ParseFp gốc có cùng rounding raw.
- Attack không hữu hạn, <=0 bị chặn trước pipeline; raw helper `finalize` vẫn kiểm minimum1 với attackRaw0 theo oracle.
- Miền chuyển Number→FP được giới hạn ở MAX_SAFE_INTEGER raw. Không coi stat cực trị vượt miền này là parity signed64 đã chứng minh.
- RNG sống trong WeakMap, không ghi BigInt vào Game/save. Continue chưa phục hồi seed crit cũ; trước đây Math.random cũng không được checkpoint.
- Các màn mùa/bang dạng nút meta đổi damage thành tài nguyên không bị đổi công thức kinh tế trong task dungeon combat này.
- Không thay native metadata/binary vào bundle web. Không chạy DLL/SO, không SDK, không tải hot-update hoặc gọi server game gốc.

## Kiểm chứng

- RED quan sát trước implementation: thiếu module; thiếu getDecrease/resolveCrit/resolve; handler cũ đánh100 thay vì45, DEF chỉ giảm còn50 thay vì45, khiên thường bị bỏ qua, Cleo giết AoE chưa gọi death.
- Test JS đối chiếu **450 GetDecrease +96 RNG +448 crit +60 shield =1054 vectors** xuất từ interpreter instruction native đúng SHA. Đây là synthetic fixtures, không phải cấu hình game hoặc capture online.
- Kiểm thêm toàn ma trận1440 final-stage; rounding/tràn low64, event order, flags, invalid input, RNG run không làm thay đổi JSON Game.
- VM chạy handler production: giảm trừ ở đòn chính/DoT; incoming DEF bridge; khiên; Cleo AoE/death-once; projectile type và nguồn quái.
- Full suite: **401 pass,0 fail,7 skip** trong408 test. Bảy test integration cần môi trường cô lập/Mongo thật vẫn skip, không coi là pass.
- npm run check, syntax module/browser verifier và diff check đạt.
- Browser verifier: `tools/verify-combat-damage-browser.mjs`; kết quả Chrome được ghi riêng trong `docs/combat-damage-evidence/browser.json` khi chạy đủ RAM. Ở mốc này Chrome **chưa chạy**: sau khi đóng bớt ứng dụng, RAM đo lại vẫn dưới ngưỡng3 GiB của host. Không dùng VM thay cho tuyên bố browser.

Tái tạo vectors: thêm `--vectors-output tests/fixtures/native-combat-vectors.json` vào `tools/verify-native-damage-branches.py` (cần artifact scratch cùng SHA và Python bundled + Capstone/pyelftools). Game runtime không cần các package phân tích.

## Phạm vi chưa thể tự bù

Đã tích hợp các nhánh có bằng chứng vào combat hiện tại, không tiếp tục chặn toàn bộ việc áp dụng chỉ vì còn phần nghiên cứu. Tuy nhiên đây **không phải khôi phục toàn bộ Archero II**: override online, source-stat builder đầy đủ, mọi Hurt subclass và toàn thân callback buff/hero vẫn chưa được xác minh. Những phần này giữ logic Artemis hoặc callback trung tính để bổ sung sau, không điền bằng kết quả giả.
