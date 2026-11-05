# Khảo sát XAPK Archero 2 thật (v1.1.9) — dùng làm tham chiếu

> **Kết quả:** trích được **danh sách hero thật** và **bản đồ tính năng** (413 màn hình UI).
> **Không trích được** số liệu gameplay (ATK/HP/công thức) — metadata bị obfuscate.
> Ngày: 2026-11-05 · nguồn: `C:\Users\PuuGoo\Desktop\Reference\`

---

## 1. Thông tin gói

| | |
|---|---|
| Package | `com.xq.archeroii` |
| Tên | Archeroii (Archero 2) |
| Phiên bản | **1.1.9** (version_code 77) |
| Engine | **Unity 2022.3.62f2**, IL2CPP |
| minSdk / targetSdk | 26 / 36 |
| Kích thước | 97,5 MB (base) + 57 MB (arm64) + **643 MB** (asset) = ~798 MB |
| Phân phối | XAPK, tải config qua `prod-dataupdate.archero2.com` |

---

## 2. Hero thật của Archero 2 (25 nhân vật)

Trích từ tên prefab `dhead_*` — đây là danh sách chính thức:

| # | ID nội bộ | Ghi chú |
|---|---|---|
| 1 | `alex01` | **Alex** — nhân vật chính (khớp với game của bạn) |
| 2 | `artemis01` | Artemis |
| 3 | `thor01` | Thor |
| 4 | `sunwukong01` | Tôn Ngộ Không |
| 5 | `houyi01` | Hậu Nghệ |
| 6 | `nezha01` | Na Tra |
| 7 | `loki01` | Loki |
| 8 | `luola01` | Rolla |
| 9 | `dekula01` | Dracula / Dekula |
| 10 | `demeter01` | Demeter |
| 11 | `fenkesi01` | Phynx (bản 1) |
| 12 | `fenkesi02` | Phynx (bản 2) |
| 13 | `keliou01` | Cleo |
| 14 | `lielang01` | Lielang (Sói Liệt?) |
| 15 | `luandou01` | Luandou |
| 16 | `miaorenzhe01` | Miêu Nhân Giả (Mèo) |
| 17 | `morty01` | **Morty** (collab Rick & Morty) |
| 18 | `rick01` | **Rick** (collab Rick & Morty) |
| 19 | `mrmeeseeks01` | **Mr. Meeseeks** (collab) |
| 20 | `mowangache01` | Ma Vương Ache |
| 21 | `shenjuanzhe01` | Thẩm Quyến Giả |
| 22 | `tata01` | Tata |
| 23 | `cny26` | Skin Tết 2026 |
| 24 | `football` | Skin bóng đá |
| 25 | `zhounianqing` | Skin kỷ niệm |

**Đối chiếu với game của bạn (18 hero):**

| | Hero |
|---|---|
| ✅ Khớp bản thật (11) | `alex`, `artemis`, `thor`, `wukong`, `hou_yi`, `nezha`, `loki`, `rolla`, `phynx`, `cleo`, `dracoola` |
| ❌ **Hero hư cấu — KHÔNG có trong Archero 2 thật (7)** | `atreus`, `otta`, `seraph`, `mymu`, `hela`, `helix`, `nyanja` |
| ➕ Bản thật có, game bạn thiếu (7 + 3 collab) | `demeter`, `lielang`, `luandou`, `miaorenzhe`, `mowangache`, `shenjuanzhe`, `tata`, `rick`, `morty`, `mrmeeseeks` |

7 hero hư cấu bị gán nhầm độ hiếm: `helix`/`nyanja` đang là Rare, `atreus`/`otta` đang là Legendary — trong khi bản thật không có nhân vật nào tên như vậy. Nếu muốn game khớp thương hiệu thì nên đổi tên/loại bỏ; nếu giữ thì nên ghi rõ đây là nội dung riêng, không phải Archero 2.

---

## 3. Bản đồ tính năng (413 màn hình UI)

Phân bố theo chủ đề:

| Chủ đề | Số prefab | Ý nghĩa |
|---|---|---|
| **Guild / xã hội** | 101 | Nhiều nhất — guild, camp, chat, mail, rank, friend |
| **Chiến đấu** | 73 | arena, pvp, tower, endless, boss, raid, dungeon |
| **Trang bị** | 38 | equip, forge, smith, enchant, refine, gem, rune, artifact |
| **Hero / thẻ** | 32 | card, dhead, awaken, skin |
| **Sự kiện** | 22 | activity, festival, cny, anniversary, collab |
| **Túi đồ** | 16 | bag, inventory, chest, gacha |
| **Tiến trình** | 11 | chapter, stage, mission, pass, quest |
| **Cửa hàng** | 6 | shop, iap, recharge |

**Nhận xét quan trọng cho game của bạn:** bản thật dồn rất nhiều vào **Guild (101)** và **PvP/Arena (73)**. Game của bạn hiện chỉ có chơi đơn + vài chế độ. Đây là khoảng cách lớn nếu muốn theo sát bản thật — nhưng cũng là lựa chọn hợp lý vì bạn đang làm bản web chơi đơn.

**Các chế độ chơi bản thật có mà bạn chưa có** (từ tên prefab):
`arena`, `pvp`, `peakarena`, `tower`, `endless`, `boss`, `guildraid`, `guildfight`, `divinecasting`, `seasonmultiplayer`, `kungfu` (collab), `spar` (đấu tập)

---

## 4. Vì sao KHÔNG trích được số liệu gameplay

Đã thử và thất bại ở 3 hướng:

1. **`global-metadata.dat` (29 MB)** — chứa toàn bộ class/method C# nhưng **header bị đổi** (`dafe5713` thay vì magic chuẩn `0xFAB11BAF`) và **nội dung bị bit-flip từng ký tự**:
   - `"ALL TGE TYPES"` thay vì `"ALL THE TYPES"`
   - `"SVILL GGT THKS ERTOR"` thay vì `"WILL GET THIS ERROR"`
   - `H`→`G`, `W`→`S`, `I`→`K`… là biến đổi phi tuyến, không phải XOR một khoá
   - Đây là obfuscation chủ động (Habby chống dịch ngược). Không giải được nếu không có tool chuyên dụng (Il2CppDumper + script deobfuscate custom).

2. **Bundle asset** — `qresource-config` chỉ 31 KB, chứa MonoBehaviour config của Unity (navmesh, physics), không phải bảng số liệu.

3. **Catalog addressables (10 MB)** — chỉ là index đường dẫn tài nguyên; 16.771 mục toàn là bundle ảnh/prefab/âm thanh.

**Ngoài ra:** bảng số liệu thật (ATK/HP/công thức/cân bằng) Archero 2 **phục vụ từ server** (`prod-dataupdate.archero2.com`), không nhúng trong APK. Kể cả giải được metadata cũng chỉ có cấu trúc class, không có con số.

---

## 5. Việc nên làm tiếp — và việc KHÔNG nên

### ✅ Nên: dùng tên hero thật để đồng bộ

Thêm các hero bản thật có mà game bạn thiếu, dùng đúng tên nội bộ:

```
demeter   — Demeter
lielang   — Liệt Lang (Sói)
luandou   — Luân Đấu
miaorenzhe — Miêu Nhân Giả
mowangache — Ma Vương Ache
shenjuanzhe — Thẩm Quyến Giả
tata      — Tata
```

Đây là dữ liệu **chắc chắn đúng** (từ tên asset chính thức), rủi ro thấp.

### ✅ Nên: xem lại 7 hero "không có trong bản thật"

`atreus`, `otta`, `seraph`, `mymu`, `hela`, `helix`, `nyanja` — cần bạn xác nhận: giữ (nếu là thiết kế riêng) hay bỏ/đổi tên (nếu muốn khớp bản thật).

### ❌ KHÔNG nên: cố trích số liệu từ APK

- Metadata obfuscated → cần tool chuyên + nhiều giờ, kết quả vẫn không có con số (config ở server)
- Rủi ro pháp lý: đây là tài sản của Habby; dùng số liệu nội bộ nguyên bản cho sản phẩm khác là vi phạm
- Cách đúng: **đo từ gameplay thật** (chơi thử, quay màn hình, đọc số trên màn hình) rồi tự hiệu chỉnh công thức của bạn — đây là cách bạn đang làm và nó hợp lệ

### ✅ Nên: dùng danh sách chế độ chơi làm roadmap

Thứ tự ưu tiên theo độ phổ biến trong bản thật:
1. **Endless / Tower** — dễ làm nhất, tái dùng combat hiện có
2. **Boss Rush** — tái dùng trùm hiện có
3. **Arena / PvP** — cần server, làm sau
4. **Guild** — chỉ khi có nhiều người chơi

---

## 6. Cách tự kiểm tra lại

```bash
# Xem cấu trúc gói
unzip -l com.xq.archeroii.apk | head -40
unzip -l UnityDataAssetPack.apk | grep -iE "config|data|table"

# Đọc danh sách asset (cần Node)
node -e "const d=require('./catalog_archeroii.json'); \
  const ids=d.m_InternalIds; \
  console.log([...new Set(ids.filter(x=>/dhead_/.test(x)))].map(x=>x.split('/').pop()))"

# Kiểm tra obfuscation metadata
xxd -l 16 global-metadata.dat          # magic phải là AF 1B B1 FA
strings -n 10 global-metadata.dat | head
```

File đã giải nén tạm: `C:\Users\PuuGoo\AppData\Local\hermes\cache\scratch\arc\`
