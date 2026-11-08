# Crit và giảm sát thương: kết quả phân tích tiếp

Phạm vi: cùng binary/metadata đã hash ở native-metadata-investigation.md; đọc tĩnh, không chạy APK/server. Chưa đủ điều kiện thay toàn bộ combat Artemis.

## HurtBase.Run: tham số đã đọc được từ metadata

VA 0x6562a84, index 108132. Sau `this`, các tham số theo thứ tự:

1. attack (type index 30667)
2. castShield (30667)
3. damageDecrease (44094)
4. damageDecreasePercent (44094)
5. limitHurtToOne (37349)
6. hurtShieldAndBody (37349)
7. extraHurtPercent (44094)

Type index không tự coi là signature đã giải đầy đủ; tên tham số đọc trực tiếp metadata. Entry lưu damageDecrease vào x26, damageDecreasePercent vào x25, limitHurtToOne vào w23, hurtShieldAndBody vào w22, extraHurtPercent vào x24; attack/castShield là con trỏ output theo cách dùng STR quan sát được.

## Thứ tự nhánh mặc định đã quan sát

- Gọi ba virtual method rồi chép AttackResult sang AttackBeforeReduction. Slot virtual chưa nối đầy đủ với tên nên không kết luận thứ tự sec-kill/miss/crit từ slot đơn lẻ.
- IsUseShield: AttackResult=0, castShield=0 rồi đi nhánh trả kết quả.
- Nếu !IsHurt: không chạy giảm sát thương thông thường.
- SourceData.HurtOnlyOne: AttackResult=1; có nhánh extraHurtPercent phụ thuộc hurtShieldAndBody.
- Nhánh thường: chuyển AttackResult integer sang raw (`<<16`). Nếu target attribute ID 0x95 khác 0, nhân với `1+attr95`.
- Lấy `SourceData.FinalHurt`, tính `factor = 65536 + FinalHurt - targetAttr(0xf1)`, clamp giữa hai static field chưa giải giá trị (offset static 0x618/0x620 của type chưa xác định).
- Tính raw: `mulFP(mulFP(previousRaw, factor) - damageDecrease, damageDecreasePercent)`.
- Làm tròn theo bit15 + shift16; chặn tối thiểu 1.
- Nếu extraHurtPercent >=1 và hurtShieldAndBody=true: nhân thêm `65536+extraHurtPercent`, làm tròn lần nữa.
- Nếu limitHurtToOne=true và kết quả >1: ép về 1.
- Gọi virtual target slot 0x548 với kết quả sát thương. Giá trị trả về được ghi castShield; nếu hurtShieldAndBody=false thì trừ giá trị đó khỏi AttackResult. Cần xác định thân virtual này trước khi gọi nó chắc chắn là hấp thụ khiên.

Quan trọng: damageDecreasePercent là **hệ số truyền vào được nhân trực tiếp**, không thể tự đổi thành `1-reduction` nếu chưa lần caller. damageDecrease là raw FP theo phép trừ trước lần nhân cuối. Không tự gán cả hai thành DEF/armor.

## Crit: thêm phần đã đọc được

HurtNormal.OnRunCrit VA 0x6565f68:
- So RNG với ngưỡng gồm nhiều thành phần; chưa đặt tên được toàn bộ nguồn/kháng crit.
- Khi nhánh crit thành công: IsCrit=true; CritValue bắt đầu từ SourceData.CritValue rồi trừ target attribute 0x6c.
- Một điều kiện target cộng SourceData.CriValueForPlayer; một nhánh nữa trừ attribute 0xaa.
- Có nhánh cộng SourceData.SuperCritValue dựa trên roll/ngưỡng đã quan sát.
- CritValue có lower bound raw **66191** (0x1028f), tương đương khoảng **1.0099945068359375** với scale65536. Đây là giá trị thân native, không phải crit multiplier mặc định của mọi entity.

Không suy ngưỡng/attribute IDs thành tên khi chưa giải enum. Thử diễn giải metadata default-values như int32 thẳng cho ra giá trị phi lý; cách diễn giải đã bị loại, không dùng để đặt tên 0x95/0xf1/0x6c/0xaa.

## Còn thiếu để áp dụng

- Caller của HurtBase.Run: damageDecrease/damageDecreasePercent thực sự lấy từ stat nào, scale và clamp ở đâu.
- Enum attribute ID, giá trị static clamp, nhánh virtual target liên quan khiên.
- Đủ mọi điều kiện crit/supercrit, miss, sec-kill và phép tính source base damage.
- Kiểm oracle trên trường hợp cố định và đối chiếu với stat model Artemis, không chỉ dịch assembly sang một công thức suy đoán.
- Runtime override của build online vẫn chưa quan sát.

Artifact scratch/native: HurtBase.Run.asm.txt, HurtNormal.OnRunCrit.asm.txt, damage-final-stage-findings.json. Không sửa gameplay. Báo cáo này là kết quả tĩnh từng phần, không phải công thức end-to-end hoàn chỉnh.
