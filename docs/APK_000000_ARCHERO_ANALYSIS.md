# Phân tích APK Archero 2 — `0.000000.Archero`

> Nguồn: `C:\Users\PuuGoo\Desktop\0.000000.Archero` (762 MB, 3 APK Unity).
> Mục đích: trích xuất danh mục màn hình + hệ thống thật để đối chiếu với bản web.
> Ngày phân tích: 2026-11-06.

---

## 1. Cấu trúc gói

| File | Kích thước | Nội dung |
|---|---|---|
| `base.apk` | 97,5 MB | 1.449 file — code Android, `res/` (1.203), `assets/` (72), META-INF |
| `split_config.arm64_v8a.apk` | 57,3 MB | Thư viện native (`libunity.so`, `libil2cpp.so`) cho arm64-v8a |
| `split_UnityDataAssetPack.apk` | 643,2 MB | **3.655 asset bundle** — toàn bộ dữ liệu game (prefab, texture, âm thanh) |

Package: `com.xq.archeroii` · Engine: Unity (IL2CPP) · Analytics: ThinkingData + `cct.com.xq.archeroii`

---

## 2. Phân bố 3.655 asset bundle

```
297  autogroup          (nhóm tự sinh — skin/model theo cấu hình)
166  ui                 ← MÀN HÌNH GIAO DIỆN
140  r                  (resource dùng chung)
 97  s                  (sprite)
 89  mfx                (hiệu ứng âm thanh)
 69  bullet
 64  fx                 (hiệu ứng hình ảnh)
 59  weapon
 52  x
 46  boss
 39  weaponshow         (màn trưng bày vũ khí)
 37  bgm
 33  rune
 28  buff
 25  dhead              (đầu nhân vật)
 24  palacerenderconfig
 18  gvg / 17 icon / 12 guild / 12 title / 13 laser / 12 ice ...
```

---

## 3. Danh mục màn hình UI — 166 màn thật

Trích từ 414 file bundle có đường dẫn `/ui/` (phần lớn là icon động
`ui_dynamicicon_*`, không phải màn hình). Sau khi lọc trùng: **166 prefab màn hình**.

### 3.1 Guild / Bang hội — 41 màn (nhóm lớn nhất)

**Viễn chinh (10)**
`guildexpedition`, `guildexpeditionexchange`, `guildexpeditioninfo`,
`guildexpeditionlog`, `guildexpeditionmapchangepanel`, `guildexpeditionmemberinfo`,
`guildexpeditionrank`, `guildexpeditionrankitem`, `guildexpeditionranklvchang`,
`guildexpeditionstatsview`

**Trùm bang (3)**
`guildboss`, `guildbossreward`, `guildbossuserrank`

**Chiến bang / GvG (3)**
`guilddeploy`, `guilddeploybattle`, `guilddeploymemberinfo`

**Tổ chức (20)**
`guildannouncementmodify`, `guildapplyjoin`, `guildbargain`, `guildbuilding`,
`guildcheckpop`, `guildhighfive`, `guildhighfivequeue`, `guildiconset`,
`guildinfopop`, `guildinvitesignup`, `guildlevelup`, `guildlog`, `guildmarket`,
`guildpetskindonateautosetting`, `guildpetskindonateselect`, `guildplayerinformation`,
`guildpreparearenarewards`, `guildpreparerankpanel`, `guildrank`, `guildschedule`

**Bang hội cơ bản (5)**
`camp`, `campblacklist`, `campownermsgmodify`, `campvisitorlist`,
`changecampname` / `changeguildnotice` / `createguildpop` / `createguildiconset` / `mainguildinfo`

> **Kết luận:** Guild trong bản thật là một **hệ thống con hoàn chỉnh** — không
> phải một tab "sắp mở". Có tổ chức (thành lập, mời, duyệt, phân quyền, log,
> cấp bang), kinh tế (chợ bang, đàm phán), cạnh tranh (chiến bang, trùm bang,
> viễn chinh có bảng xếp hạng riêng), và xã hội (high-five, bảng tin).

### 3.2 Chiến đấu — 46 màn

**Chọn chế độ (15)** — mỗi chế độ là một `ui_world_*`:
`world_main`, `world_arena`, `world_boss`, `world_divinecasting`, `world_endless`,
`world_football`, `world_guildfight`, `world_kungfu`, `world_peakarena`, `world_pet`,
`world_skillctr`, `world_skillctrmultiplayer`, `world_tower`, `world_training`,
`world_ultimatecup`

**Bảng kết quả (15)** — mỗi chế độ có màn tổng kết riêng:
`battleresultactivity`, `battleresultarena`, `battleresultboss`, `battleresultdivinecasting`,
`battleresultendless`, `battleresultgold`, `battleresultguildfight`, `battleresultguildraid`,
`battleresultmain`, `battleresultmainhard`, `battleresultmultiplayer`, `battleresultpeakarena`,
`battleresultseasonmultiplayer`, `battleresultspar`, `battleresulttower`

> Nhận xét thiết kế: bản thật tách màn kết quả **theo từng chế độ** thay vì một
> màn chung. Vì mỗi chế độ có đơn vị đo khác nhau (phòng / tầng / điểm / hạng).

**Đấu trường PvP (13)** — `pvprank*`: info, chọn loại, đặt vai, shop, quỹ,
bảng đấu, thay đổi cấp, điểm, 3 màn kết quả (danh dự / chỉ số / tổng)

**Khác (7)**: `battlepowershow`, `bossselect`, `battleturn`, `battleresulkungfu`,
`endlessrankpanel`, `endlessrankreward`, `pvpskillselect`, `skillselect`

**Tạm dừng (3)**: `pause`, `pause_guildfight`, `pause_peakarena`

### 3.3 Trang bị — 5 màn gốc + Pet (3)

`equipment`, `rune`, `treasure`, `carddetail`, `carddraw`, `contractdevil`,
`greedydevil`, `dropup`, `dropupgoldcave`, `dropupworldboss`,
`petegginfo`, `pethatchery`, `petpalace`

### 3.4 Sự kiện — 30 màn

**Mùa giải (5)**: `seasonbattlepowerexchange`, `seasonbossrecruit`,
`seasonbossspecialmechanism`, `seasoncareerselect`, `seasoncareerselectspineholder`

**Mở sự kiện (11)**: `activityopennotice_*` — fishing, kungfu, kungfushow, monopoly,
newanotherworld, petcontract, pvprank, ultimatecupshow, fightinggod + container

**Hoạt động (14)**: `activitynoticedig`, `activityplinko`, `activityseason`,
`plinkoactivitychoosereward`, `guardplant*` (8 màn: main, multi, rank, recruit,
shop, weektask, loading, battleresult, infoviewmodule)

**Kungfu (2)**: `kungfushopviewmodule`, `battleresulkungfu`

**Bóng đá PvP (2)**: `pvpfootballbattlerecord`, `pvpfootballrecruit`

### 3.5 Túi đồ / Nhân vật — 8 màn

`role`, `roleexchange`, `angel`, `palace`, `palaceprivilege`, `palaceshareinfo`,
`pvptreasure`, `messageboard`, `settingpop`, `helplist`, `enterad`

### 3.6 Tiến trình / Nhiệm vụ — 8 màn

`main`, `mainhuntertask`, `hardmissioninfo`, `hardmissionreward`,
`missionrewardintegratedpanel`, `normalmissionterminfo`,
`normalmissionterminfoinbattle`, `normalmissiontermitem`, `hangup`, `quickhangup`

### 3.7 Cửa hàng — nằm rải trong từng hệ thống

Không có màn "shop" trung tâm. Mỗi hệ thống tự có shop riêng:
`guildmarket`, `pvprankshopviewmodule`, `guardplantshop`, `kungfushopviewmodule`.

---

## 4. Chế độ chơi — 15 chế độ thật

| Màn | Tên | Ghi chú |
|---|---|---|
| `world_main` | Chiến dịch | Chế độ chính, có chương |
| `world_endless` | Vô tận | Có bảng xếp hạng riêng (`endlessrankpanel`) |
| `world_tower` | Tháp | Leo tầng |
| `world_boss` | Săn Trùm | |
| `world_training` | Luyện tập | |
| `world_arena` | Đấu trường | PvP |
| `world_peakarena` | Đấu trường đỉnh | PvP cao cấp |
| `world_guildfight` | Chiến bang | PvP theo bang |
| `world_ultimatecup` | Cúp tối thượng | Giải đấu |
| `world_pet` | Pet | Chế độ mang thú |
| `world_skillctr` | Điều khiển kỹ năng | Chơi đơn |
| `world_skillctrmultiplayer` | Điều khiển kỹ năng (co-op) | Nhiều người |
| `world_divinecasting` | Thi triển thần thuật | |
| `world_football` | Bóng đá | PvP vui |
| `world_kungfu` | Kungfu | Sự kiện |

---

## 5. Đối chiếu với bản web hiện tại

| Nhóm | Bản thật | Bản web | Trạng thái |
|---|---|---|---|
| **Guild** | **41 màn** | 1 tab "sắp mở" | ❌ Thiếu gần hết |
| Chiến đấu | 46 màn | 5 chế độ + 1 màn kết quả chung | ⚠️ Có engine, thiếu màn riêng |
| Trang bị | 5 + 3 pet | Có (equipment, rune, treasure, card) | ✅ Gần đủ |
| Hero/Thẻ | 2 (`carddetail`, `carddraw`) | Tab Thẻ (18 hero) | ✅ Đủ ý chính |
| Sự kiện | 30 màn | 1 tab | ❌ Thiếu |
| Túi đồ | 8 | Kho vật phẩm | ⚠️ Cơ bản |
| Tiến trình | 8 | 1 dải nhiệm vụ | ⚠️ Cơ bản |
| Cửa hàng | Rải rác (4 shop hệ thống) | 1 tab shop chung | ⚠️ Khác kiến trúc |

---

## 6. Ưu tiên xây dựng tiếp (theo giá trị / công sức)

### Giai đoạn 1 — Màn kết quả theo chế độ (dễ, tăng cảm giác hoàn chỉnh)
Bản thật có 15 màn kết quả riêng. Bản web đang dùng 1 `showSummaryModal` +
`openChapterVictory` + `openRunDefeat` cho tất cả. Tách nhánh hiển thị theo
`Game.mode`: Vô Tận hiện "kỷ lục phòng", Tháp hiện "tầng đạt được", Săn Trùm
hiện "số trùm đã hạ". **Không cần engine mới, chỉ đổi cách hiển thị.**

### Giai đoạn 2 — Guild tối thiểu (giá trị cao nhất, 41 màn)
Không làm hết 41 màn. Làm 6 màn cốt lõi tạo vòng lặp chơi:
1. `camp` — danh sách bang + tạo/tham gia
2. `guildinfopop` — thông tin bang, thành viên, cấp
3. `guildboss` — trùm bang (dùng lại combat engine, HP theo tổng lực thành viên)
4. `guilddeploy` — chiến bang (xếp đội hình)
5. `guildrank` — bảng xếp hạng
6. `guildlog` — lịch sử hoạt động

Vì chơi đơn, "thành viên" = nhân vật NPC có chỉ số sinh theo tiến trình người chơi.
Bang hoạt động như **nội dung đơn người** (giống Clash of Clans single-player campaign).

### Giai đoạn 3 — Sự kiện (30 màn)
Ưu tiên `guardplant` (8 màn, có vòng lặp trồng/chiến đấu riêng) và `plinko`
(2 màn, cơ chế đơn giản, tái dùng được).

### Giai đoạn 4 — Đấu trường PvP (13 màn)
Chơi đơn thì làm "đấu với bóng người chơi khác" (ghost data từ save của chính
mình hoặc sinh ngẫu nhiên theo dải lực chiến).

---

## 7. Ghi chú kỹ thuật khi trích xuất

- Bundle là Unity AssetBundle (LZ4/LZMA). Đọc prefab cần `UnityPy` (Python)
  hoặc `AssetStudio` — không có sẵn trên máy này, chỉ đọc được **tên + đường dẫn**
  qua `unzip -l` (đủ để lập danh mục).
- `ui_names.txt` chứa 166 tên màn đã lọc trùng, dùng làm checklist.
- Các bundle `autogroup` (297) là skin/model sinh tự động theo cấu hình nhân vật,
  không phải nội dung thiết kế tay.
- `boss` (46) + `weapon` (59) + `weapon show` (39) là dữ liệu hình ảnh, có thể
  dùng để làm sprite cho bản web nếu cần.

---

## 8. Tệp sinh ra trong quá trình phân tích

| File | Nội dung |
|---|---|
| `ui_names.txt` | 166 tên màn UI đã lọc trùng |
| `ui_groups.txt` | 414 đường dẫn nhóm theo thư mục `ui/<nhóm>/` |
