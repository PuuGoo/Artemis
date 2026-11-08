# Áp dụng kết quả phân tích vào Artemis

## Đã áp dụng

`public/combat-loot.js` triển khai selector trọng số tích lũy: roll 1..totalWeight, lấy entry đầu tiên có cumulativeWeight >= roll. Đây là thuật toán đã đọc được từ nhánh native mặc định, được viết lại độc lập bằng JavaScript.

`onEnemyKilled` production dùng selector để chọn loại cuộn. Các slot Artemis có weight=1, tương đương phân phối đều trước đó. Giữ nguyên xác suất rơi 28% quái thường/100% boss trước bonus và số lượng 2/5; không nhập ID, trọng số hay dữ liệu thương mại chưa map vào kinh tế Artemis. Có fallback selector cũ nếu module không tải.

## Kiểm chứng

4 focused tests đạt: khoảng cumulative gồm weight=0; 6000 sample tại các ranh giới khớp selector cũ; dữ liệu/RNG lỗi trả null; wiring production và xác suất/số lượng không đổi. Full suite tuần tự (integration opt-in tắt), npm run check và git diff --check exit 0. Chưa browser gameplay cho thay đổi này; test wiring là source assertion, không phải chơi trận thật.

## Không áp dụng khi chưa đủ bằng chứng

- Chưa thay toàn bộ công thức sát thương: chưa có crit/defense/final reduction đầy đủ và chưa map stat model của Artemis.
- Chưa thay AI từng boss: ngưỡng mặc định đọc được không chứng minh state machine hay reset đầy đủ.
- Chưa nhập 2079 nhóm drop gốc: chưa map ID vật phẩm, mode/chapter và điều kiện chọn nhóm.
- Không nhập triển khai online không có trong artifact.

Đây là tích hợp từng phần có kiểm soát, không phải bản sao logic game gốc 100%. Không đổi save, quyền sở hữu hoặc tiến trình; không chạy APK hoặc server game gốc.
