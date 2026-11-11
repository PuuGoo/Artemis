# Leo Chương 1 — Bốn Đại Tướng sử dụng PNG thật

Bốn boss dưới quyền Sư Vương Thái Dương Leo (ải 50). Áp dụng duy nhất
cho Chương 1 tại ải 10 / 20 / 30 / 40, giữ nguyên type chiến đấu gốc.

| Ải | Boss | Type chiến đấu | Kỹ năng |
|---|---|---|---|
| 10 | Ares – Tướng Quân Hỏa Ngục | golem | Hỏa Ngục Toái Trảm |
| 20 | Boreas – Tướng Quân Phong Băng | queen | Băng Phong Song Nhận |
| 30 | Terra – Tướng Quân Đại Địa | demon_king | Địa Chấn Liên Hoàn |
| 40 | Nyx – Tướng Quân Hư Ảnh | elder_dragon | Hư Ảnh Giao Thoa |
| 50 | Sư Vương Thái Dương Leo | zodiac_leo | Boss cuối |

## Assets được nạp trực tiếp vào Canvas

Bốn file trong **public/assets/leo-guardians/**: ares.png, boreas.png,
terra.png, nyx.png. Mỗi file PNG có nền trong suốt, kích thước **1152×768**,
chia thành **6 cột × 4 hàng**, mỗi cell **192×192**. Các khung được xử lý từ
bộ sprite đã duyệt và đưa thực sự vào repo. Không dùng Canvas vẽ lại hình
boss khi asset đã sẵn sàng.

| Action | Row 0-based | Frames | ms/frame |
|---|---:|---:|---:|
| Idle | 0 | 6 | 170 |
| Attack | 1 | 6 | 110 |
| Hit | 2 | 4 | 95 |
| Death | 3 | 6 | 145 |

Engine: **public/leo-subboss-animation.js**. Khi asset nạp xong, renderer
dùng drawImage với tọa độ từng frame; animation lấy signal từ attackTimer,
hitFlashTimer, hp và chơi Death sau khi boss bị xóa khỏi enemies trong cùng
phòng. Thứ tự ưu tiên **Death > Attack > Hit > Idle** để nhận sát thương
không làm mất frame Attack đang cảnh báo. Riêng Attack sử dụng trực tiếp
`attackTimer` còn lại: 6 khung trải đều trong 750ms cảnh báo (125ms/khung),
khung cuối trùng thời điểm bắn và được giữ thêm 160ms sau khi cooldown reset.
`frameMs:110` vẫn dùng cho trình xem sprite độc lập; không dùng nó để tính
frame Attack trong gameplay. Không thay đổi thời gian bắn, đạn hay damage.

Renderer chỉ xử lý enemy có isBoss, campaignChapter=1, campaignRoom thuộc
10/20/30/40 và loại golem/queen/demon_king/elder_dragon tương ứng.
Game và Admin dùng chung renderer. Nếu ảnh chưa tải được, body chibi Canvas
cũ được vẽ tạm làm fallback, tránh màn hình đen.

Trang xem và xuất PNG: **/leo-subboss-sprites.html**.

## Giới hạn thay đổi và kiểm thử

Không thay đổi hitbox, AI, HP, ATK, cooldown, damage, cảnh báo, vật cản,
rơi vật phẩm, lưu tiến trình hoặc boss chương khác. Thay đổi tên và mô tả
kỹ năng của đúng bốn boss trên.

- node --test tests/leo-subboss-animation.test.mjs
- node --test tests/leo-subbosses.test.mjs
- npm run check
- npm test
- node tools/validate-biomes.mjs

Cần tiếp tục playtest ở ải 10–20–30–40 trên thiết bị thực để kiểm tra FPS
và tính nhất quán giữa hiệu ứng sprite và đường đạn đang dùng.
