# Kiến trúc UI Archero 2 thật — dùng để build lại giao diện

> Nguồn: XAPK `com.xq.archeroii` v1.1.9, 164 màn hình UI trích từ addressables catalog.
> Đây là **bản đồ điều hướng chính thức**, không phải suy đoán.

---

## 1. Sáu tab chính (khác game hiện tại)

Game của bạn hiện có **5 tab**: `Chiến Dịch · Trang Bị · Sự Kiện · Cửa Hàng · Tài Năng`.

Archero 2 thật có **6 tab**, tên prefab chính xác:

| # | Prefab | Tab | Nội dung |
|---|---|---|---|
| 1 | `uimainbattle` | **Chiến Đấu** | Chọn màn, vào trận |
| 2 | `uimaincard` | **Thẻ** (Hero) | Danh sách hero, triệu hồi, nâng sao |
| 3 | `uimainequip` | **Trang Bị** | Gear, rương, rune, thú |
| 4 | `uimainactivity` | **Sự Kiện** | Season, hoạt động, collab |
| 5 | `uimainshop` | **Cửa Hàng** | IAP, daily deal, shop season |
| 6 | `uimainguild` | **Guild** | Bang hội, boss guild, viễn chinh |

**Khác biệt lớn nhất: bản thật KHÔNG có tab "Tài Năng"** — talent nằm trong `ui_role` (nhân vật) và `ui_rune`.
Bản thật **có tab Guild** mà game bạn thiếu hoàn toàn.

---

## 2. Cây màn hình đầy đủ (164 màn)

### 2.1. Chiến Đấu — 47 màn

**Vào trận (`ui_main` → `ui_world_*`):**
```
ui_main                    Sảnh chính (chọn chế độ)
├── ui_world_main          Chiến dịch chính (chapter/stage)
├── ui_world_boss          Đánh trùm
├── ui_world_endless       Vô tận (endless)
├── ui_world_tower         Tháp (tower climb)
├── ui_world_arena         Đấu trường
├── ui_world_peakarena     Đấu trường đỉnh cao
├── ui_world_divinecasting Chế độ thần thánh
├── ui_world_guildfight    Chiến guild
├── ui_world_kungfu        Kungfu (collab)
├── ui_world_football      Bóng đá (collab)
├── ui_world_ultimatecup   Cúp thần thánh
├── ui_world_training      Luyện tập
└── ui_world_pet           Thú (pet world)
```

**Chọn trùm:** `ui_bossselect`
**Chọn kỹ năng trong trận:** `ui_skillselect`, `ui_pvpskillselect`
**Tạm dừng:** `ui_pause`, `ui_pause_guildfight`, `ui_pause_peakarena`
**Bảng điểm cuối trận (13 biến thể!):**
```
ui_battleresultmain        Thường
ui_battleresultmainhard    Khó
ui_battleresultboss        Trùm
ui_battleresultendless     Vô tận
ui_battleresulttower       Tháp
ui_battleresultarena       Đấu trường
ui_battleresultpeakarena   Đấu trường đỉnh
ui_battleresultguildfight  Chiến guild
ui_battleresultguildraid   Raid guild
ui_battleresultmultiplayer Nhiều người
ui_battleresultseasonmultiplayer  Season nhiều người
ui_battleresultdivinecasting     Thần thánh
ui_battleresultspar        Đấu tập
ui_battleresultactivity    Hoạt động
ui_battleresultgold        Hang vàng
ui_battleresulkungfu       Kungfu
```
**Treo máy / tự động:** `ui_hangup`, `ui_quickhangup`
**Khác:** `ui_battlepowershow`, `ui_dropup`, `ui_dropupgoldcave`, `ui_dropupworldboss`, `ui_endlessrankpanel`, `ui_endlessrankreward`, `ui_enterad`

### 2.2. Thẻ / Hero — 9 màn

```
ui_carddraw       Triệu hồi thẻ (gacha)
ui_carddetail     Chi tiết thẻ
ui_role           Nhân vật (trang bị + talent + skill)
ui_roleexchange   Đổi shard
ui_angel          Thiên thần (buff)
ui_contractdevil  Khế ước ác quỷ  ← bạn ĐÃ có (devilModal)
ui_greedydevil    Ác quỷ tham lam
```
**Thú (pet):** `ui_petegginfo` (trứng), `ui_pethatchery` (ấp), `ui_petpalace` (cung thú), `ui_world_pet`

### 2.3. Trang Bị — 6 màn

```
ui_equipment   Trang bị chính
ui_rune        Rune
ui_treasure    Kho báu
ui_pvptreasure Kho báu PvP
ui_plinkoactivitychoosereward  Chọn thưởng plinko
ui_activityplinko              Plinko
```

### 2.4. Sự Kiện / Season — 10 màn

```
ui_activityseason                Season chính
ui_seasoncareerselect            Chọn nghề season
ui_seasonbossrecruit             Chiêu mộ trùm season
ui_seasonbossspecialmechanism    Cơ chế đặc biệt
ui_seasonbattlepowerexchange     Đổi lực chiến
ui_activitynoticedig             Thông báo hoạt động
ui_activityopennoticecontainer   Khung thông báo mở
ui_*  (7 biến thể thông báo: fightinggod, fishing, kungfu, monopoly, petcontract, pvprank, ultimatecup)
```

### 2.5. Cửa Hàng — 4 màn

```
uimainshop                 Shop chính
ui_guildmarket             Chợ guild
ui_kungfushopviewmodule    Shop kungfu
ui_pvprankshopviewmodule   Shop PvP rank
seasonshoppage             Shop season
ui_guardplantshop          Shop bảo vệ
```

### 2.6. Guild — 50 màn (LỚN NHẤT)

```
ui_mainguildinfo        Thông tin guild
ui_createguildpop       Tạo guild
ui_guildapplyjoin       Xin vào
ui_guildinfopop         Chi tiết
ui_guildannouncementmodify  Sửa thông báo
ui_changeguildnotice    Đổi ghi chú
ui_guildlog             Nhật ký
ui_guildrank            Xếp hạng
ui_guildbuilding        Xây dựng
ui_guildlevelup         Lên cấp
ui_guildbargain         Mặc cả
ui_guildhighfive        Đập tay
ui_guildhighfivequeue   Hàng chờ đập tay
ui_guildschedule        Lịch
ui_guildinvitesignup    Mời đăng ký

BOSS GUILD:
ui_guildboss            Trùm guild
ui_guildbossreward      Thưởng
ui_guildbossuserrank    Xếp hạng cá nhân

VIỄN CHINH (11 màn):
ui_guildexpedition              Viễn chinh
ui_guildexpeditioninfo          Thông tin
ui_guildexpeditionmapchangepanel  Đổi bản đồ
ui_guildexpeditionmemberinfo    Thành viên
ui_guildexpeditionrank          Xếp hạng
ui_guildexpeditionrankitem      Item xếp hạng
ui_guildexpeditionranklvchang   Đổi cấp
ui_guildexpeditionexchange      Trao đổi
ui_guildexpeditionlog           Nhật ký
ui_guildexpeditionstatsview     Thống kê

CHIẾN GUILD:
ui_guilddeploy          Triển khai
ui_guilddeploybattle    Trận triển khai
ui_guilddeploymemberinfo  Thành viên
ui_guildpreparearenarewards  Thưởng chuẩn bị
ui_guildpreparerankpanel     Bảng hạng

TRẠI (camp):
ui_camp              Trại
ui_campblacklist     Danh sách đen
ui_campvisitorlist   Khách thăm
ui_campownermsgmodify  Sửa tin chủ
ui_changecampname    Đổi tên trại
ui_messageboard      Bảng tin
ui_helplist          Danh sách trợ giúp

TÀI NGUYÊN GUILD:
ui_guardplantmain          Cây bảo vệ (trồng)
ui_guardplantweektask      Nhiệm vụ tuần
ui_guardplantrank          Xếp hạng
ui_guardplantrecruit       Chiêu mộ
ui_guardplantloading       Tải
ui_guardplantinfoviewmodule  Thông tin
ui_guardplantmulti         Nhiều người
ui_guardplantbattleresult  Kết quả trận
```

### 2.7. Khác — 8 màn

```
ui_palace           Cung điện (VIP)
ui_palaceprivilege  Đặc quyền
ui_palaceshareinfo  Chia sẻ
ui_settingpop       Cài đặt
ui_pause            Tạm dừng
ui_mainguildinfo    (đã tính ở guild)
ui_mainhuntertask   Nhiệm vụ thợ săn
ui_missionrewardintegratedpanel  Thưởng nhiệm vụ tổng hợp
```

---

## 3. Khoảng cách với game hiện tại

| Hạng mục | Bản thật | Game bạn | Việc cần làm |
|---|---|---|---|
| Tab chính | 6 | 5 | Thêm **Guild**, bỏ tab Tài Năng (gộp vào Nhân vật) |
| Chế độ chơi | 14 (`ui_world_*`) | 3 (campaign + vài thứ) | Thêm Endless, Tower, Boss Rush trước |
| Bảng kết quả | 13 biến thể | 3 (victory/defeat/room-clear) | Thêm biến thể cho chế độ mới |
| Hero | card draw + role + devil | có devil ✓ | Thêm `ui_carddraw` (triệu hồi), `ui_role` (gộp trang bị+talent) |
| Thú | 4 màn | 0 | Cần hệ thống pet (đã có pet trong combat) |
| Rune | `ui_rune` riêng | nhúng trong trang bị | Tách tab rune |
| Season | 5 màn | 0 | Cần hệ thống season |
| Guild | 50 màn | 0 | Cần server + nhiều người |
| Cửa hàng | 6 màn | 1 | Thêm daily deal, shop riêng |

---

## 4. Lộ trình build (theo thứ tự khả thi)

### Giai đoạn 1 — Khung điều hướng 6 tab (làm ngay)
Thêm tab **Guild** (dạng "sắp mở"), đổi tab Tài Năng → gộp vào Nhân Vật.
Tạo `#screen-*` container cho từng màn, router bằng hash.

### Giai đoạn 2 — Chiến Đấu đa chế độ
Dựng `ui_main` (sảnh chọn chế độ) với 6 nút: Chiến dịch / Vô tận / Tháp / Trùm / Đấu trường / Luyện tập.
Tái dùng combat engine hiện có, chỉ khác cách sinh phòng.

### Giai đoạn 3 — Hero & Trang bị
- `ui_carddraw`: màn triệu hồi thẻ (dùng gems, có pity counter — đã có `chestGachaState`)
- `ui_role`: gộp trang bị + talent + kỹ năng một chỗ
- `ui_rune`: tách riêng

### Giai đoạn 4 — Sự kiện & Season
Khung season với nhiệm vụ tuần, shop season.

### Giai đoạn 5 — Guild & PvP
Cần backend đa người chơi. Làm sau cùng.

---

## 5. Nguyên tắc build

1. **Không chép tài sản** — chỉ dùng **cấu trúc điều hướng** (tên màn, phân cấp, luồng). Art/asset tự vẽ.
2. **Tái dùng engine hiện có** — combat, save, achievement đã chạy tốt; chỉ thêm màn mới.
3. **Mỗi giai đoạn phải chạy thật** — không làm mockup tĩnh.
4. **Không phá vỡ thứ đang hoạt động** — test suite hiện 1260 PASS phải giữ xanh.
