# Oracle cho GetDecrease, crit, RNG và trạng thái khiên

Tiếp nối `native-damage-resolved-inputs.md`. Cùng bản libil2cpp.so, SHA-256 `bed445a394a7b7e7f58a5f61399ccf1875a03087c574e76e726d4aa23ca7f7d3`.

## Kết quả kiểm thực tế

`tools/verify-native-damage-branches.py` đọc instruction từ binary và chạy **interpreter tĩnh**, không nạp/thực thi thư viện game. So với các mô hình cấp cao độc lập:

| Nhóm | Ca đạt |
|---|---:|
| GetDecrease, nhiều tổ hợp modifier | 450 |
| RNG, gồm bounds đảo/equal và seed ép biên | 96 |
| CheckShield, lượng hấp thụ/thứ tự callback | 96 |
| Crit/supercrit, sec-kill và các biên threshold | 448 |
| Khiên thường/hero: tiêu hao, xóa và ghi flags thực trong interpreter | 60 |
| Gate replacement với callback fixture nhân tạo | 2 |
| **Tổng ca mới** | **1152** |

Chạy lại oracle số học cuối cũ: **1440/1440** vẫn đạt. Hai bộ có phạm vi khác nhau; không cộng thành tuyên bố end-to-end coverage.

Evidence: `native-damage-branches-evidence.json`; giữ số instruction address đã đi qua (**588** cho GetDecrease, **226** cho crit), không gọi đây là phần trăm branch coverage. Không có runtime hotfix, null/error path hoặc mọi đường callee trong mẫu.

## 1. GetDecrease: đã kiểm các nhóm nhánh default

Entry0x64090c4; chạy cả dispatcher/setup/return của thân mặc định với object và attribute fixtures không null.

### Khởi tạo

- Flat = AttributeData.GetHurtDecrease.
- Coefficient = AttributeData.GetHurtDecreasePercent.
- Getter và dữ liệu attribute là stub rõ ràng, không giả làm quan sát stat runtime.

### Nhánh target hero (bit4)

- Nếu không có flag di chuyển bit5: nhân StandHurtDecreasePercent, cộng StandHurtDecrease.
- hurtAttackerType3: cộng BodyHurtDecrease, nhân BodyHurtDecreasePercent.
- hurtAttackerType1: nhân BulletHurtDecreasePercent.
- Race modifier theo **thứ tự ưu tiên**, không cộng tất cả bit trúng:
  - bit1 → HurtReduceForMonsterPercent;
  - nếu không, bit3 → HurtReduceForBossPercent;
  - nếu không, bit2 → HurtReduceForElitePercent;
  - nếu không, một trong bit4/18/7/15/16 → HurtReduceForPlayerPercent.
- Bit5 nguồn: chọn HurtReduceForFlyPercent; không có: HurtReduceForGroundPercent.
- Target có ancestry EntityHero và flag31: lấy GetSwordIntentDamageReductionPercent, nhân với `Q - giá trị` nếu khác0. Getter sword-intent vẫn là fixture, thân tính kiếm ý chưa nằm trong oracle này.

### Nhánh áp dụng sau nhánh hero

- Nếu invHurt>=1 và IsInvincible: nhân invHurt; không tự coi invincible luôn đồng nghĩa damage0.
- hurtType2/3/4/5: lần lượt Fire/Poison/Ice/ThunderHurtDecreasePercent; tiếp đó nhân ElementHurtDecreasePercent.
- hurtType8: chỉ nhân ElementHurtDecreasePercent trong switch này. 0/1/6/7/ngoài switch không đi nhánh nguyên tố này.
- exHurtAttack:

| Giá trị | Hệ số giảm | Hệ số vulnerability tiếp theo |
|---|---|---|
| 1 hoặc7 | RotateBallHurtDecreasePercent | 1 + BallVulnerabilityPercent |
| 2 | SwardHurtDecreasePercent | 1 + FlySwardVulnerabilityPercent |
| 3 | StarHurtDecreasePercent | 1 + StarFallVulnerabilityPercent |
| 4 | MainWeaponHurtDecreasePercent | không có tại switch này |
| 5 | SpriteHurtDecreasePercent | 1 + SpriteVulnerabilityPercent |
| 6 | PlantHurtDecreasePercent | không có tại switch này |

Giữ spelling trong metadata. Không suy tên enum chỉ từ giá trị switch khi chưa map enum type.

**Điểm cần bảo toàn khi port:** phép nhân modifier ở GetDecrease là `MUL` low64 rồi signed `ASR16` **mỗi lần**, không phải mọi nơi đều gọi helper mulFP tách hi/lo. Đổi toàn bộ thành một phép nhân số thực cuối có thể khác rounding/tràn. Fixture dùng miền số nhỏ; chưa phủ cực trị signed64 cho toàn pipeline.

## 2. RNG crit đã khép phần endpoints và state update

HurtNormal.OnRunCrit tại0x6566308 gọi helper0x42a2654 với bounds0 và65536.

Instruction tương ứng mô hình:

- `state' = (state * 25214903917 + 11) mod 2^48`.
- `u = state' >> 32` (16 bit trên).
- `roll = min(a,b) + floor(u * abs(b-a) / 65536)` trong miền bounds đã kiểm.

Với bounds crit, roll chính là u: **0..65535**, upper65536 bị loại. Bounds bằng nhau vẫn **tiến state**, khác helper integer kế bên có early-return. Không tráo hai helper này.

96 ca kiểm cả giá trị trả về và state ghi lại. Seed được dựng bằng nghịch đảo modulo để ép roll **0,1,65534,65535**, ngoài seed0/1/mixed/max48. Đây là kiểm recurrence/endpoints; không phải đo phân phối runtime hay chứng minh seed online.

## 3. Crit/supercrit đã có oracle toàn thân default với injected rolls

Entry0x6565f68. Fixture cấp SourceData, attribute getters và roll theo các biên T-1/T/T+1/T+S-1/T+S, lọc vào miền0..65535. So sánh IsCrit, CritValue và số lần gọi roll.

Đã kiểm:
- Sec-kill reset kết quả crit và không gọi RNG.
- Target bit4, owner mask0x58090, kháng crit/crit-value và bonus cho player.
- `roll < T+S` mới crit; `roll > T` mới cộng SuperCritValue.
- Roll đúngT **không** được đổi thành supercrit do dùng >=.
- Floor multiplier raw66191.

448 ca đạt; RNG fixture được tiêm để kiểm đúng biên, còn thân RNG thật được interpreter kiểm riêng ở phần2. Chưa chạy source-stat builder hay các Hurt subclass khác.

## 4. Khiên: đã kiểm cả mutation, không chỉ min(shield,damage)

Bộ96 ca kiểm CheckShield tại0x647250c với stub ghi lại callback. Khi shield<=damage và shield>0, thứ tự:

1. CharacterShield.BreakEffect nếu có component.
2. ClearMainWeaponShieldFlags.
3. OnShieldBreak.
4. TriggerShieldChange.
5. ClearShield.
6. AddBuffToEntity nếu `_breakBuffId` ở CharacterShield+0x78 >=1.

Bộ60 ca bổ sung đi vào instruction của GetCurrentShield/GetShieldMax, ConsumeShield/ChangeShield/ClearShield thường và hero, CharacterShield.Change/Clear, ClearMainWeaponShieldFlags, TriggerShieldChange:

- Hero ưu tiên tiêu hao ex-shield tại+0x458; phần thiếu mới trừ normal shield.
- CharacterShield.Change clamp current vào[0,max].
- Hero.ClearShield xóa normal lẫn ex-shield.
- Khi vỡ, xóa bits35 và37 ở data flags+0x128, giữ các bit khác.
- TriggerShieldChange đánh dấu bit30 ở+0x120 nếu GetShieldMax>=1.
- Kiểm shield0, damage0, bằng shield và vượt shield.

**Phần vẫn stub:** OnShieldBreak của actor, hiệu ứng hình ảnh và toàn thân AddBuff. Không khẳng định đã kiểm tác dụng dây chuyền của mọi buff/hero.

## 5. Override: đã kiểm cơ chế, chưa có bằng chứng online

Hai fixture bật bit5 tại method descriptor+0x53, đặt callback nhân tạo tại+0x60:

- GetDecrease (global slot0x982d278) chuyển tiếp đủ tám argument và bỏ thân mặc định.
- OnRunCrit (global slot0x983b118) chuyển tiếp this và bỏ thân mặc định.

Đây là **callback thử nghiệm do công cụ tự cấp**, không phải payload hoặc phản hồi máy chủ. Evidence JSON đánh nhãn `replacement_dispatch_fixture` để tránh đọc nhầm.

Muốn kết luận override nào đang hoạt động phải có capture runtime/update đúng build: trạng thái descriptor/callback hoặc payload hot-update thật cùng hash. Các snapshot placeholder đã có không cung cấp thông tin đó. Không tự truy cập endpoint nhặt từ APK; không gọi server hoặc cài/chạy APK trong task này.

## Điều kiện tích hợp còn lại

Các blocker cũ về **nhánh modifier default của GetDecrease, endpoints RNG, biên crit và mutation khiên cơ bản** đã có bằng chứng kiểm thực thi bằng interpreter; không còn chỉ là mô tả tĩnh.

Chưa đủ tuyên bố tương đương toàn game: nguồn stat/base attack, đầy đủ source-data builder/HP event, các callback buff/actor, các Hurt subclass và map vào stat model Artemis vẫn chưa kiểm end-to-end. Online parity là một acceptance gate riêng, không thể giải quyết bằng thêm test offline.

Không thay gameplay, save, ownership hoặc tiến trình. Không đưa binary/metadata/config gốc vào Git.

## Chạy lại

Dùng Python bundled của Hermes, dependency phân tích trong scratch (Capstone/pyelftools), không cài vào dependency game:

`<bundled-python> tools/verify-native-damage-branches.py --artifact-dir <scratch-native> --analysis-tools <scratch-native>/analysis-tools --output docs/native-damage-branches-evidence.json`

Interpreter fail khi gặp instruction, read hoặc call chưa mô hình hóa; giới hạn5000 bước/case. Input binary bắt buộc đúng SHA trước khi phân tích.
