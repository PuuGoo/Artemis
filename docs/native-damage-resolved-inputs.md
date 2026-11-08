# Giải nghĩa caller, crit, clamp và khiên

> Cập nhật tiếp: xem `native-damage-branch-validation.md` và `native-damage-branches-evidence.json` cho oracle GetDecrease, RNG, crit và mutation khiên. Các giới hạn về oracle trong báo cáo này mô tả mốc phân tích trước, không thay thế kết quả mới.

## Phạm vi / bằng chứng

Phân tích tĩnh bản libil2cpp.so SHA-256 `bed445a394a7b7e7f58a5f61399ccf1875a03087c574e76e726d4aa23ca7f7d3` và metadata giải mã SHA-256 `fd6a35437472ed8ae4247d3dd6a1c2063ac8fbd37cdba6da3e8952db00e28c43`. Không chạy APK, không tải hot-update hoặc gọi server. Các kết luận chỉ thuộc nhánh native mặc định của build này.

## 1. Tên attribute đã giải đúng

AttributeIntKey dùng default-value **compressed signed integer**, không phải int32 thẳng. Giải nén cho chuỗi đầu HPMax=1, HPMaxPercent=2, Attack=3, AttackPercent=4…; giữ nguyên cả tên có lỗi chính tả từ metadata.

| ID | Tên trong metadata |
|---|---|
| 0x25 | HurtDecrease |
| 0x26 | HurtDecreasePercent |
| 0x95 | VulnerabilityPercent |
| 0xf1 | FinaHurtReducePercent |
| 0x6c | CirHurtReducePercent |
| 0xa9 | CriReduceForPlayerPercent |
| 0xaa | CriValueReduceForPlayerPercent |
| 0xb3 | CriReducePercent |
| 0x23 / 0x24 | StandHurtDecrease / StandHurtDecreasePercent |
| 0x27 / 0x28 | BodyHurtDecrease / BodyHurtDecreasePercent |
| 0x61 | BulletHurtDecreasePercent |

Không áp dụng decoder int32 này cho enum 64-bit khác khi chưa kiểm type; không suy tên race từ bitmask chưa giải.

## 2. Caller thực sự truyền gì

Quét BL trong các segment executable tìm đúng một direct call đến HurtBase.Run: VA **0x63f88a0**, trong **CharacterComponentOnHit.OnHitUpdateHP** (entry 0x63f80f0). Không khẳng định đây là mọi caller vì virtual/indirect call chưa bao phủ.

- Caller gọi **GetDecrease** tại 0x64090c4. Các tham số metadata: ownerRaceFlag, hurtAttackerType, hurtType, exHurtAttack, invHurt, damageDecrease, damageDecreasePercent.
- Output damageDecrease ở `[sp+0x80]`, output damageDecreasePercent ở `[sp+0x78]`.
- GetDecrease khởi tạo hai output qua **AttributeData.GetHurtDecrease** (0x67f4554, getter ID0x25) và **GetHurtDecreasePercent** (0x67f45c4, getter ID0x26). Sau đó có điều kiện bổ sung theo trạng thái đứng, body/bullet, race, nguyên tố và loại đòn. Không được lấy riêng hai getter gốc rồi coi đã bao hết helper 4000 byte.
- `OnHitUpdateHP.exDecrease` (tham số x3, lưu x20) nếu khác 0 sẽ **nhân** vào output damageDecreasePercent, dịch phải16 (0x63f8480–0x63f848c).
- Ngay trước BL Run: `ldp x4,x3,[sp+0x78]`: x3=damageDecrease, x4=damageDecreasePercent. Các nguồn output và vị trí truyền khớp nhau.

Kết luận: damageDecrease là giảm flat raw FP; damageDecreasePercent là **hệ số còn lại được nhân trực tiếp**, đã chịu nhiều modifier. Chưa chứng minh toàn pipeline tạo giá trị attribute gốc là `1 - một stat DEF cụ thể`; không thay bằng DEF của Artemis tùy ý.

## 3. Clamp đã có tên và nguồn cấu hình

Field-offset table của **LocalModels.Const**: FinalHurtMin static offset0x618, FinalHurtMax0x620.

Chứng cứ độc lập:
- Const..cctor 0x614dfd0/0x614dfec ghi kết quả ParseFp vào đúng hai offset.
- Metadata string literals nạp trước ParseFp là **"0.2f"** và **"5"**.
- Parse đủ **235 record** của bảng Consts_Const theo schema readImpl (năm chuỗi), đúng EOF. Hàng 214: FinalHurtMin, fp, 0.2f; hàng215: FinalHurtMax, fp, 5.

Vì vậy nhánh mặc định clamp `1 + SourceData.FinalHurt - FinaHurtReducePercent` trong **[0.2, 5]** theo FP parser. Chưa kiểm rounding raw của ParseFp("0.2f"); không nhận giá trị raw13107 trong test là kết quả parser đã quan sát. Max5 có biểu diễn FP nguyên chính xác.

## 4. Virtual dispatch và khiên đã xác định

Vtable base phù hợp **0x138**, slot method từ metadata, mỗi entry16 byte. Hai đường khớp chéo:
- HurtBase slots9/11/12 → byte0x1c8/0x1e8/0x1f8: **OnRunSecKill → OnRunCrit → OnRunAttack** theo thứ tự gọi ở Run. Run này không gọi OnRunMiss trực tiếp trong chuỗi ba lời gọi.
- EntityCharacter.CheckShield slot65 → **0x548**, đúng chỗ Run gọi sau tính damage. **Không phải ConsumeShield** (slot67 →0x568).

**CheckShield 0x647250c**:
- GetCurrentShield qua virtual; nếu shield=0, trả0.
- Nếu shield > incomingDamage: gọi ConsumeShield(incomingDamage), trả incomingDamage.
- Nếu shield <= incomingDamage: giữ số shield cũ làm lượng hấp thụ; chạy break effect/clear flags/OnShieldBreak/clear shield cùng event/buff nếu có, trả số shield cũ.
- Lượng trả về tương đương `min(shield, incomingDamage)` trên miền shield/damage không âm; side effects không được thay bằng phép min đơn lẻ.

Run ghi lượng hấp thụ vào output castShield. Nếu hurtShieldAndBody=false, trừ lượng hấp thụ khỏi AttackResult; nếu true, vẫn tiêu thụ khiên nhưng không trừ khỏi phần body ở vị trí này. IsUseShield của HurtBase là một nhánh khác, không đồng nhất với số shield của CheckShield.

EntityHero có override **ConsumeShield** 0x6530ca0: tiêu thụ lớp shield riêng tại offset0x458 trước, phần thiếu chuyển về ChangeShield; các getter virtual và side effects có thể làm nhiều lớp. Chưa xác minh mọi lớp shield và cập nhật HP/event cuối caller.

## 5. Crit/supercrit: nhánh mặc định theo raw FP

HurtNormal.OnRunCrit 0x6565f68, Q=65536:

- Đầu hàm reset IsCrit=false, CritValue=Q. Nếu IsSecKill thì trả ngay.
- Đặt `C = SourceData.CritRate`. Nếu target có bit4 trong race flag: cộng SourceData.CriForPlayer; nếu đồng thời `SourceData.OwnerRaceFlag & 0x58090 != 0`, trừ target.CriReduceForPlayerPercent.
- Đặt `S = SourceData.SuperCirtRate` (đúng tên typo trong metadata), `R = target.CriReducePercent`, `T = C - R`.
- Lấy roll từ helper gọi với (0,65536). Nếu **roll >= T + S**, không crit.
- Nếu roll < T+S: IsCrit=true, `M = SourceData.CritValue - target.CirHurtReducePercent`.
- Với target bit4: cộng SourceData.CriValueForPlayer; nếu owner mask ở trên khác0, trừ target.CriValueReduceForPlayerPercent.
- Nếu **roll > T** (so sánh nghiêm ngặt, không phải >=): cộng SourceData.SuperCritValue.
- `CritValue = max(M,66191)`; ngưỡng raw66191 tương đương1.0099945068359375.

Chưa giải tên các bit của owner mask và chưa kiểm phân phối/endpoints helper RNG; giữ điều kiện raw, không tự công bố phần trăm thực nghiệm. Đây là OnRunCrit của HurtNormal, không đại diện mọi HurtElement/override.

## 6. Kiểm thử số học đã thực thi

`tools/verify-native-damage-math.py`:
- Xác thực SHA binary trước đọc.
- Đọc đúng instruction từ **0x6562e44 tới trước0x6562eb4**.
- Interpreter cho instruction ARM64 vùng đó (callee mulFP được mô phỏng theo tách hi/lo từ native) đối chiếu mô hình độc lập dùng số nguyên lớn.
- **1440/1440 trường hợp đạt**: damage0/1/17/100/10000; nhiều factor/flat/coefficient; extra modifier và hai flag.
- Kết quả `docs/native-damage-math-evidence.json`.

Lệnh (dùng Python bundled, không Python MS Store alias):
`<bundled-python> tools/verify-native-damage-math.py --artifact-dir <scratch-native> --analysis-tools <scratch-native>/analysis-tools --output docs/native-damage-math-evidence.json`

**Không nâng phạm vi test:** oracle không chạy APK, không test runtime dispatch/caller/config, không test RNG/crit hay tác dụng phụ khiên. Clamp là đầu vào của phép thử; không được nói 1440 case chứng minh toàn bộ end-to-end.

## Kết luận triển khai

Đã giải tên attribute, clamp, direct caller và helper shield, đồng thời phục hồi điều kiện raw của crit/supercrit. Có đủ căn cứ cho một module tham khảo số học nhánh mặc định; **chưa đủ thay toàn combat Artemis** khi GetDecrease còn nhiều nhánh cần oracle, nguồn base damage/HP event chưa khép kín và stat model Artemis chưa map. Không sửa gameplay trong task phân tích này.
