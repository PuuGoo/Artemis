# Field layout và công thức native đã đối chiếu

Cùng danh tính binary/metadata trong `native-metadata-investigation.md`. Chỉ phân tích offline, không chạy APK hay gọi server. Kết quả là nhánh native mặc định, không chứng minh triển khai thay thế đang hoạt động.

## Bảng offset

Tìm bảng field-offset tại VA `0x9993408` bằng count type 32112, con trỏ và relocation ELF. Một bảng liền kề có cùng count nhưng cấu trúc không khớp accessor đã bị loại. Field record lấy từ section fields (header pair 11), không nhầm section parameters (pair 10).

| Type | Offset instance | Field |
|---|---|---|
| HurtBase | 0x28 | SourceData |
| HurtBase | 0x48 | Entity |
| HurtBase | 0x58 | CritValue |
| HurtBase | 0x60 | IsCrit |
| HurtBase | 0x62 | IsSecKill |
| HurtBase | 0x68 | AttackResult |
| HurtBase | 0x70 | AttackBeforeReduction |
| HurtSourceData | 0x50 | Attack |
| HurtSourceData | 0x58 | AttackPercent |
| HurtSourceData | 0x60 | ExAttackPercent |
| HurtSourceData | 0xa0 | BossHurtAdd |
| HurtSourceData | 0xe0 | NormalMonsterHurtAdd |
| HurtSourceData | 0xe8 | FlyHurtAdd |
| HurtSourceData | 0xf0 | GroundHurtAdd |
| HurtSourceData | 0xf8 | EliteHurtAdd |
| HurtSourceData | 0x100 | HeroHurtAdd |
| HurtSourceData | 0x108 | ExHurtAddValue |
| HurtSourceData | 0x168 | ExploreHurtAdd |
| AIStateController | 0x38 | _mAttackPossibility |
| DropMgr | 0x28 | _fixExpRandomAdd |
| DropMgr | 0x4c | DropHpCount backing field |
| TakeDamageData | 0x30 | HurtValue backing field |

Bốn mapping được đối chiếu riêng bằng getter/setter native: TakeDamageData.HurtValue, HurtSourceData.FireHurtValue, DropMgr.DropHpCount, AIStateController.TaskEndAction. Không coi offset thấp là instance tự động: static field có thể có offset trùng; bảng JSON giữ raw index/type để phân biệt tiếp.

## Sát thương thường: nhánh chính

VA `0x65664b0` (`HurtNormal.OnRunAttack`), đơn vị raw fixed-point 65536. Helper nhân `mulFP(a,b) = (a*b)>>16` trong miền không tràn.

1. HurtBase.HurtData bắt đầu tại 0x30; phép nhân thực tế đọc raw 64-bit tại offset **0x38**, tức phần bên trong field này. Chưa giải layout nội bộ HurtData nên đặt tên tạm là `baseRaw38`, không được đồng nhất nó với SourceData.Attack hay toàn bộ HurtData.
2. Nhánh không xử lý sec-kill: `v = mulFP(baseRaw38, 65536 + GetHurtAdd())`.
3. Nếu SourceData.ExAttackPercent khác 0: `v = mulFP(v, ExAttackPercent)`. Nhánh kiểm raw OR 65536 so với 65536 cũng bỏ qua giá trị 65536 (hệ số 1).
4. Nếu SourceData.IsExplore và ExAttackType không phải 3: nhân thêm ExploreHurtAdd trước phần crit.
5. Nếu IsCrit: nhân thêm HurtBase.CritValue; khi IsExplore và ExAttackType == 3, nhân một lần với tổng `ExploreHurtAdd + HurtBase.CritValue` thay vì nhân riêng hai hệ số.
6. Cộng SourceData.ExHurtAddValue, rồi lưu `AttackResult = (raw >> 16) + ((raw >> 15) & 1)`.

Nhánh sec-kill đi đường khác; nhánh shield cũng có thể trả sớm. Công thức này chưa bao gồm HurtBase.Run, giảm sát thương phía nhận, final modifiers và các override. Không gọi đây là công thức end-to-end.

`GetHurtAdd` VA `0x65631ec`: bắt đầu bằng SourceData.AttackPercent, chọn tối đa một bonus theo thứ tự kiểm bit target: bit1 NormalMonsterHurtAdd → bit3 BossHurtAdd → bit2 EliteHurtAdd → bit4 HeroHurtAdd; sau đó luôn cộng FlyHurtAdd nếu bit5, ngược lại GroundHurtAdd. Chưa nối tên enum của các bit với type target, vì vậy giữ chỉ số bit như quan sát thay vì bịa tên enum.

## AI

`IsAttackRandomSuccess` VA `0x61f9304`: offset 0x38 nay đã được xác định là `_mAttackPossibility`. Gọi RandomNextBool với ngưỡng đó; thất bại thì cộng một bước lấy từ config qua chuỗi object, thành công không cập nhật trong hàm này. Chưa gán tên bước config hay thời điểm reset, nên không suy thành toàn bộ lịch AI.

## Drop: đã phục hồi thuật toán chọn trọng số

`DropGroup.InitFromTableData` VA `0x63b3b28` đọc danh sách từ object bảng offset 0x28, chia từng chuỗi theo ký tự mã 0x2c (dấu phẩy), parse ba số. Hai số đầu lưu ở hai trường item, số thứ ba cộng vào `_totalWeight`; mỗi item giữ tổng trọng số tích lũy.

`DropGroup.Drop` VA `0x63b3d14`:
- Nếu items null hoặc totalWeight bằng 0, trả về không chọn.
- Gọi helper RNG với min=1, max=totalWeight+1.
- Duyệt theo thứ tự và chọn item đầu tiên có cumulativeWeight >= roll.
- Ghi hai giá trị item vào output (offset 4 và 8).

Đã kiểm mô hình khoảng tích lũy bằng duyệt hết roll trên fixture trọng số [2,0,3,5], số lần chọn đúng [2,0,3,5]. Đây không phải trọng số của game. Nếu RNG uniform trên [1,totalWeight], xác suất lý thuyết là weight/totalWeight; chưa xác minh helper RNG và chưa có hàng cấu hình thực nên chưa đưa phần trăm drop thực tế.

Metadata có LocalModels.Bean.Item_drop (drop_id/reward/lvReward) và Item_dropLv (drop_id/level/reward), nhưng không tự chứa giá trị các hàng. Cần trích bảng/config serialized và xác minh đường nạp trước khi công bố tỷ lệ từng vật phẩm.

## Artifact và giới hạn

Scratch `apk-audit/native/`: gameplay-field-layouts.json, field-layout-validation.json, gameplay-accessor-offsets.json, GetHurtAdd.asm.txt, DropGroup.InitFromTableData.asm.txt, DropGroup.Drop.asm.txt. Accessor inventory là ứng viên cửa sổ disassembly; chỉ bốn accessor nêu trên đã đối chiếu cụ thể, không coi mọi dòng trong cửa sổ là field của getter.

Chưa có runtime verification, chưa có config balance/drop thực tế, chưa phân tích toàn bộ crit/defense/AI. Không sửa Artemis bằng logic chưa kiểm định. Chỉ báo cáo được đưa lên Git.
