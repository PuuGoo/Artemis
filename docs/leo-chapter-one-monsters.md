# Chương 1 – Thánh Điện Nhật Luân / Sư Tử

Bộ quái thường đầu tiên được làm riêng cho chủ đề hoàng gia Sư Tử,
mặt trời, tượng sư tử, áo giáp vàng và phép thuật nhật luân.

## Đội hình 50 ải

Mã chiến đấu **không đổi**: `campaign-rooms.js` vẫn quản lý đội hình theo
`slime`, `goblin`, `plant_turret`, `skeleton_mage`. Renderer chỉ
thay ngoại hình theo `game.mode === 'campaign'` và `game.chapter.id === 1`:

| Type chiến đấu hiện có | Quái mới | Vai trò hình ảnh | Atlas |
|---|---|---|---|
| `slime` | Ấu Sư Nhật Quang | Sư tử con, lao/cào tấn công | `leo-cub.svg` |
| `goblin` | Sư Vệ Hoàng Kim | Sư tử vệ binh giáp vàng, giáo/đao và khiên | `leo-guard.svg` |
| `plant_turret` | Pháo Đài Nhật Luân | Trụ đá đầu sư tử, tia mặt trời | `leo-turret.svg` |
| `skeleton_mage` | Tư Tế Sư Tử | Pháp sư sư tử áo choàng, quyền trượng nhật luân | `leo-priest.svg` |

Atlas: `public/assets/monster-sprites/`, SVG nền trong suốt,
**960×800px** (6 cột × 5 hàng, mỗi ô 160×160px).
Các hàng là **Idle, Attack, Hit, Death, Skill**,
mỗi hàng 6 frame vẽ khác nhau. Căn chân tại y≈139px.

`public/monster-sprite-animation.js` dùng `spriteFileFor(enemy,game)`
để lựa chọn atlas theo đúng **type + chương + chế độ**. Trong chương khác,
`MonsterArt` và hai atlas quái đã có vẫn hoạt động như trước. Trong
chương 1, khi asset chưa sẵn sàng, renderer chuyển về artwork cũ để
tránh quái vô hình. Chuyển động chỉ đọc countdown Attack, hitFlashTimer
và vòng đời quái; không chỉnh vị trí, va chạm, AI hay sát thương.

### Mốc đặc biệt (giữ nguyên)

- Ải 5/15/25/35/45: Valkyrie
- Ải 10: Ares; 20: Boreas; 30: Terra; 40: Nyx
- Ải 50: Sư Vương Thái Dương

### Cách xem

Mở `/monster-sprite-studio.html`, khu vực **Chương 1 — Thánh Điện Nhật
Luân**; từng quái có nút **IDLE / ATTACK / HIT / DEATH / SKILL**.
Kiểm tra bản vẽ trên các ải thường ở cả chế độ desktop/mobile.

### Kiểm thử

`node --test tests/leo-monsters-visual.test.mjs`

`node --test tests/monster-sprite-sheets.test.mjs`

`npm test`

Không dùng sprite boss phụ làm quái thường và không tạo thêm type trong
logic; khi muốn nâng cấp AI riêng phải tách sang một thay đổi khác.
