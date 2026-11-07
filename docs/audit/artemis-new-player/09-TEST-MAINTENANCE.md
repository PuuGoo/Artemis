# 09 — Bảo trì test: 6 suite baseline đã xanh

Sau Đợt 5, lần đầu tiên full suite của repo **không còn fail**:
**188 test — 186 pass / 0 fail / 2 skip**.

Tài liệu này ghi lại chính xác **vì sao** 6 suite từng fail và **sửa cái gì**, để sau
này không ai "sửa" lại theo hướng sai (đổi expected cho vừa mắt, hoặc xoá assertion).

## Nguyên tắc

Không có lỗi runtime nào trong 6 suite này. Tất cả đều là **test viết cho một phiên
bản nội dung cũ** rồi nội dung lớn lên, hoặc **regex quá khít** tới mức một thay đổi
UI hợp lệ làm nó trượt. Vì vậy cách sửa là **thay hằng số cứng bằng bất biến**, không
hạ nhẹ assertion và không bỏ test.

| Suite | Trước | Vì sao fail | Sau |
|---|---|---|---|
| `bestiary` | `FAIL 4` | Campaign mở rộng 12 → **20** loại quái; test hardcode `n === 12` cho cả 7 field | Đếm `entries` từ block, assert `n === entries` — mọi loại vẫn phải có đủ `name/icon/tier/color/lore/behavior/threat` |
| `chapter-select` | `FAIL 5` | 4 → **6** chương; hardcode `chapterCount === 4` và `n === 4` cho 9 field | Bất biến theo `chapterCount` thật (`>= 4`), mỗi chương phải đủ 9 field metadata |
| `map-select` | `FAIL 3` | `mapAsset/mapRegion/mapTagline === 4` nhưng có 6 chương | Đếm `chapterTotal` từ `CHAPTERS`, so khớp theo số thật |
| `economy` | `FAIL 1` | So khớp **nguyên chuỗi** `import { validateEconomyDelta } from ...`, nhưng import nay kèm `validateSeasonDelta` | Regex kiểm **thành phần** trong danh sách import |
| `garden` | `FAIL 3` | Cửa sổ regex 600/120/200 ký tự; DOM và khối chuyển tab dài ra nên `gardenContent` / `renderGardenPanel()` / `startGardenTicker()` rơi ra ngoài | Nới 3000/1200/1200 — vẫn khoá đúng quan hệ "tab Sự Kiện render vườn + chạy ticker" |
| `season` | `FAIL 1` | Kiểm đúng markup `<b class="block text-[10px] ...">Cửa Hàng</b>` của bản thiết kế cũ; panel đã redesign thành "🎟️ Đổi Sức Mạnh & Quà" | Bất biến: nút mua mùa giải (`data-season-buy`) **không** được chỉ ghi "Đổi" (tránh trùng "Đổi nghề"), và hai chức năng dùng hai thuộc tính riêng |

## Hai lần sửa sai đã tự bắt được

1. **`chapter-select` trượt thêm một assertion** `renderLobbyUI gọi normalizeSelectedChapter`
   — do chính Đợt 5 chèn `renderRankBadge()` + `renderBeginnerQuickCard()` **trước**
   lời gọi đó, làm khoảng cách vượt cửa sổ 300 ký tự. Nới lên 1200, giữ nguyên ý nghĩa.
2. **Bất biến "không nút nào nhãn đúng 'Đổi'"** ban đầu bắt nhầm hai chỗ hợp lệ:
   - câu văn *"Đổi 20% Máu Tối Đa"* trong Khế Ước Huyết Ma (prose, không phải nút),
   - nút **`data-exchange` của Vườn Thu Hoạch** (đổi nông sản — không liên quan "Đổi nghề").
   Thu hẹp phạm vi về đúng `data-season-buy` của mùa giải.

Bài học: assertion theo *vị trí/khoảng cách* và theo *markup cụ thể* sẽ hỏng khi UI
lớn lên. Assertion theo *quan hệ chức năng* thì không.

## Còn 2 test skip

`integration` và `admin` là loại cần Mongo thật + `.env`; chúng chỉ chạy khi đặt
`ARTEMIS_ISOLATED_TESTS=1` (xem `04-*`). Vẫn **chưa** chứng minh CAS/unique index trên
Mongo thật — đó vẫn là việc mở của release readiness.
