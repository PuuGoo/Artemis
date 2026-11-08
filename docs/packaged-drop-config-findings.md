# Bảng drop đóng gói và giới hạn online

## Nguồn thực tế

Trong asset pack do người dùng cung cấp, bundle `localmodel_assets__853868ce61b27d1c773ab17f911e07e5.bundle` chứa 586 TextAsset. Đã trích offline vào scratch `apk-audit/native/packaged-data/`, không chạy code và không gọi endpoint.

Các bảng có thật gồm Item_drop (94852 bytes), Item_dropLv (7500 bytes), Character_entity (334968 bytes), Chapter_MainChapter, Chapter_monsterCfg, Weapon_Weapon, Skill_Main và các bảng mission. Có bảng không có nghĩa đã giải schema hoặc đã nối vào mode cụ thể.

## Item_drop đã parse đầy đủ

Đối chiếu native `LocalModels.Bean.Item_drop.readImpl` tại 0x673e584 và các helper BaseLocalBean.readInt/readArraystring/readArrayint. Trình đọc số nguyên big-endian; độ dài chuỗi gồm cả prefix 2 byte; độ dài record gồm cả prefix 4 byte.

- Parse **2079/2079 record**, **2079 drop_id duy nhất**.
- Tất cả record kết thúc đúng ranh giới; parser tiêu thụ đúng **94852/94852 bytes**, không còn đuôi.
- Mỗi reward là bộ ba số. Theo DropGroup.InitFromTableData, số thứ ba là weight; không gán ngữ nghĩa item ID/count nếu chưa nối setter output/type tương ứng.
- Đầu ra đầy đủ giữ ngoài Git: `apk-audit/native/item-drop-decoded.json`.

Ví dụ nhóm đóng gói drop_id=1000: 72 entry, tổng weight=918; bốn entry đầu là [110110,1,20], [110120,1,20], [110130,1,10], [110140,1,1]. Đây là weight thực sự đọc từ file, không phải fixture. Không suy ra đây là drop của chương/boss nào khi chưa chứng minh đường tham chiếu.

DropGroup.Drop dùng cumulative weights (báo cáo native-field-formulas.md). Xác suất chọn có điều kiện lý thuyết là weight/sum nếu RNG uniform trên khoảng đã quan sát; chưa xác minh helper RNG và không thể coi xác suất chọn nhóm là xác suất rơi vật phẩm cuối cùng. Drop có thể qua nhóm lồng, điều kiện, cấp độ hoặc triển khai thay thế.

## AI: bước tăng và khởi tạo được nối thêm

Metadata field-offset mapping xác định `LocalModels.Bean.Character_entity.<attackPossibility>k__BackingField` tại **0xa0**.

Nhánh native mặc định của AIStateController.SetEntity đọc chuỗi object qua offset 0xa8, rồi field 0xa0 và gán vào `_mAttackPossibility` tại 0x38 (store VA 0x61f7a38). IsAttackRandomSuccess đọc cùng field config 0xa0; khi kiểm RandomNextBool thất bại thì cộng giá trị đó vào `_mAttackPossibility`.

Kết luận có căn cứ: **ngưỡng ban đầu và bước cộng khi thất bại đều lấy từ attackPossibility trong nhánh mặc định này**. Chưa chứng minh mọi loại AI gọi SetEntity mỗi chu kỳ, chưa có kết luận reset sau thành công hay state machine từng boss.

Character_entity.readImpl tại 0x66c9f94 đã xuất assembly và nhận diện chuỗi helper đọc int/float/fixed-point/array/localString. Chưa hoàn tất parser bảng này; không công bố thông số balance từ blob chưa giải schema.

## Hot-update: dữ liệu có và dữ liệu không có

Tám TextAsset snapshot đóng gói (HotFix.dll/.mv, HotFixBattle.dll/.mv, HotFixFalcon.dll/.mv, Sdkhubv2.dll/.mv) đều chỉ chứa **1 byte ASCII '1'**. Đây không phải assembly thay thế đọc được. Không suy ra game không có hot-update: các file có thể là placeholder.

Không có quan sát phiên runtime online, manifest cập nhật đã tải hay bộ nhớ dispatch. Vì vậy **không thể kết luận override nào đang hoạt động trong bản online từ ba APK này**. Không tự gọi CDN/server để bù khoảng trống; cần bản dữ liệu cập nhật hoặc log/capture từ phiên kiểm thử được phép.

## Trạng thái kết luận

| Hạng mục | Kết quả |
|---|---|
| Trọng số Item_drop trong build đóng gói | Đọc đầy đủ 2079 hàng |
| Tỉ lệ drop end-to-end của chương/boss | Chưa xác minh điều kiện/chọn nhóm/RNG |
| Công thức sát thương toàn đường đi | Vẫn một phần; chưa đủ crit/defense/final reduction |
| AI ngưỡng ban đầu/bước cộng mặc định | Nối được field attackPossibility |
| Reset/lịch AI từng boss | Chưa hoàn tất |
| Override đang hoạt động online | Không thể xác định bằng chứng tĩnh hiện có |

Không thay logic Artemis. Không đưa binary, config thương mại hoặc dữ liệu phục hồi đầy đủ lên Git; chỉ báo cáo kết quả và giới hạn.
