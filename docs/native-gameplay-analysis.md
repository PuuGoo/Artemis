# Phân tích logic native — kết quả bước đầu

## Phạm vi và danh tính

Phân tích offline cùng bộ binary/metadata trong `native-metadata-investigation.md`. Không chạy APK, không attach process, không gọi máy chủ. Metadata SHA-256 `fd6a35437472ed8ae4247d3dd6a1c2063ac8fbd37cdba6da3e8952db00e28c43`; libil2cpp SHA-256 `bed445a394a7b7e7f58a5f61399ccf1875a03087c574e76e726d4aa23ca7f7d3`.

REA ghép binary với metadata vượt giới hạn báo cáo 64 MiB, không giữ được inventory đầy đủ. Thay bằng parser nhỏ đọc từng bảng, giải relocation ELF R_AARCH64_RELATIVE và tra token RID trong code-gen module. Đây là ánh xạ tĩnh tự kiểm, không phải decompile C# hay bằng chứng runtime.

## Ánh xạ đã kiểm

| Module | Codegen VA | Slot method | Con trỏ khác 0 |
|---|---|---:|---:|
| HotFix.dll | 0x93d88a8 | 81378 | 80514 |
| HotFixBattle.dll | 0x93d6988 | 30101 | 29252 |

Tổng 111479 method records, 109766 con trỏ khác 0; mọi con trỏ khác 0 nằm trong PT_LOAD executable của binary. Giá trị 0 chỉ nghĩa là không có con trỏ trong slot này, không chứng minh phương thức không có triển khai ở nơi khác.

Đã xuất 209 bản disassembly có giới hạn cho các type AIStateController, DropMgr, MainDropManager, HurtBase, HurtElementBase, HurtElementFire, HurtElementPoison, HurtNormal. Biên hàm được chặn theo địa chỉ bắt đầu kế tiếp quan sát được, tối đa 16 KiB: không phải khôi phục CFG hoàn chỉnh, shared bodies và generic instances chưa được giải.

## Sát thương: phần đọc được

- `HurtNormal.OnRunAttack`: method index 108170, token 0x060068a9, VA 0x65664b0.
- Helper VA 0x42b7ae0 tách số 64-bit thành phần thấp 16-bit và phần cao có dấu. Với số nguyên không tràn, phép toán tương đương `(a*b) >> 16`: 56 cặp thử cả âm/dương/0 khớp mô hình instruction. Đây là fixed-point scale 65536; chưa gán tên API cho helper.
- Nhánh mặc định ở 0x65665d8 gọi GetHurtAdd, cộng 65536 rồi nhân qua helper. Các nhánh tiếp theo có thêm hệ số/trạng thái từ object; một nhánh kết thúc cộng raw value tại offset 0x108 rồi làm tròn theo bit 15 và dịch phải 16, lưu kết quả ở offset 0x68 của instance.
- Không đặt tên ngữ nghĩa cho các offset chưa nối được field layout. Chưa đủ căn cứ viết công thức đầy đủ ATK/DEF/crit hay chuyển vào Artemis.
- `HurtNormal.OnRunCrit`: VA 0x6565f68, đã giữ disassembly nhưng chưa diễn giải đầy đủ các thuộc tính/buff và nhánh.

## AI: phần đọc được

- `AIStateController.IsAttackRandomSuccess`: index 99890, VA 0x61f9304.
- Nhánh mặc định gọi `BattleWorldContext.RandomNextBool` (index 109905, VA 0x65fa61c) với raw threshold lấy từ offset 0x38. Nếu thất bại, cộng thêm một giá trị lấy qua chuỗi object rồi lưu lại offset 0x38; nếu thành công, giữ raw threshold. Chưa có field layout để gọi đây là xác suất cụ thể hay khẳng định thời điểm reset.
- RandomNextBool nhánh mặc định: threshold <= 0 trả false; threshold >= 65536 trả true; ở giữa gọi helper RNG với tham số 0 và 65536 rồi so kết quả `< threshold`. Chưa xác minh phân phối RNG và ranh giới của helper, nên không quy thành tỉ lệ thực nghiệm.
- Có method nhiệm vụ chờ, cảnh báo, di chuyển, quay, lao tới, tấn công và chọn mục tiêu. Tên method chỉ là inventory; chưa phục hồi state machine đầy đủ hay AI từng boss.

## Drop: phần đọc được và giới hạn

- DropMgr.DropFromGroup VA 0x63ada54; MainDropManager.CheckSpecialDrop VA 0x63b64e4; AddDropItemFromGroup VA 0x63b69ac. Đã xuất disassembly, chưa khôi phục weighted sampling/tỉ lệ.
- MainDropManager.get_WaveGold VA 0x63b5fc0 gọi gián tiếp qua interface ở object offset 0x60: không có một hằng số vàng chung có thể lấy từ getter này.
- DropMgr.AddExpRate VA 0x63b037c nhánh mặc định cộng raw tham số vào field offset 0x28.
- OnPresetBossDropByServer VA 0x63ab2a0 nhánh mặc định không làm gì; có nhánh dispatch thay thế. Tên hàm không chứng minh server luôn quyết định drop, và thân mặc định rỗng không chứng minh boss không drop.

## Giới hạn quan trọng

Nhiều thân hàm kiểm cờ rồi chuyển qua con trỏ gián tiếp trước khi chạy nhánh native mặc định. Metadata cũng có HybridCLR.Runtime.dll. Quan sát này phù hợp với cơ chế thay thế/hot-update, nhưng chưa chứng minh override nào đang hoạt động. Vì vậy không gọi bản phân tích này là logic hiện hành của game online.

Chưa hoàn tất: field-offset mapping, type signatures, gọi generic/shared body, config drop/balance thực tế, logic thay thế tải sau và kiểm thử runtime. Không thể báo đã khôi phục toàn bộ công thức/AI/drop.

## Artifact cục bộ

Thư mục `C:/Users/PuuGoo/AppData/Local/hermes/cache/scratch/apk-audit/native/`:
- `hotfix-method-addresses.json`: bản ghi method/name/token/address của hai module.
- `selected-gameplay-methods.json`: nhóm method được chọn.
- `mapping-validation.json`: số lượng và địa chỉ module.
- `gameplay-assembly/`: 209 bản disassembly.
- `normal-attack.asm.txt`, `ai-attack-chance.asm.txt`, `random-next-bool.asm.txt`, `fixed-multiply.asm.txt`: các thân hàm hỗ trợ kết luận trên.

Binary, metadata và code giải mã không được đưa lên Git. Không sửa gameplay Artemis dựa trên công thức chưa đủ chứng cứ.
