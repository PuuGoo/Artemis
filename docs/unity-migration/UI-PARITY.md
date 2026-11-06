# UI PARITY — ĐÃ LÀM GÌ, CÒN THIẾU GÌ

> Cập nhật: 2026-11-06. Nhánh `feature/unity-migration-parity`.
> Mọi số liệu dưới đây là đo thật, không ước lượng.

---

## 1. Cách làm: Unity KHÔNG vẽ tay lại UI

Thay vì tôi ngồi dựng lại 15 màn hình bằng tay (sẽ lệch dần so với production),
toàn bộ UI được **trích từ chính `public/index.html`** thành dữ liệu, rồi Unity
dựng lại từ dữ liệu đó:

```
public/index.html
      │
      ├─ tools/unity-ui/extract-ui.mjs       -> uiTree.json     (cây DOM)
      ├─ tools/unity-ui/extract-theme.mjs    -> uiTheme.json    (màu/px/gradient)
      ├─ tools/unity-ui/extract-images.mjs   -> uiImages.json + Images/*.jpg
      │
      └──> Artemis.Domain.Ui.UiLayout        (layout engine, test bằng dotnet)
                │
                └──> ProductionUiRenderer     (dựng GameObject)
```

Ưu điểm: sửa production thì Unity tự theo; và **layout kiểm tra được bằng
`dotnet test`**, không cần mở Editor.

---

## 2. Số liệu trích được (đo thật)

| Hạng mục | Số lượng |
|---|---|
| Node DOM | **661** (259 node có id, 349 node có chữ) |
| Thẻ nhiều nhất | div 284, span 176, button 120, p 18, h3 14 |
| Màu Tailwind | **181** (gồm 18 giá trị tuỳ ý `bg-[#0b132b]`) |
| Khoảng cách | 100 class (`p-4` → 16px…) |
| Cỡ chữ | 12 (`text-xs` → 12px, `text-[11px]` → 11px) |
| Bo góc | 6 (`rounded-xl` → 12px) |
| Gradient | **51** (`gold-gradient`, `a2-q-epic`, `epic-gradient`…) |
| Class tuỳ ý | 22 (`a2-*`, `hd-*`, `legend-gradient`…) |
| Ảnh base64 | **3** (177,3 KB) — `topHeroAvatarImg`, `skillModalPortrait`, 1 không id |
| Màn hình phát hiện | 19 (6 tab + 12 modal + 1 view) |
| Tab mặc định | **`tabEquip`** |

Gradient thật đọc từ CSS:

```
gold-gradient     #fde047 → #f59e0b → #d97706
epic-gradient     #c084fc → #9333ea → #6b21a8
rare-gradient     #38bdf8 → #0284c7 → #0369a1
common-gradient   #4ade80 → #16a34a → #15803d
legend-gradient   #fb7185 → #e11d48 → #9f1239
body background   radial-gradient(#1e1b4b → #090d16)
```

Font production: **Inter** + **Baloo 2**.

---

## 3. Layout engine (phần khó nhất, đã test)

Dùng `LayoutGroup` của Unity **không** mô phỏng được CSS flex — lần đầu dựng ra
mọi thứ dồn góc trên-trái, kích thước 0 (xem §6). Nên viết
`Assets/Artemis/Domain/Ui/UiLayout.cs`: tính rect tuyệt đối giống trình duyệt.

Quy tắc đã cài:

| CSS | Cách xử lý |
|---|---|
| `<div>` mặc định | **block** → rộng hết dòng của cha |
| `<span>`, `<b>`, `<em>` | inline → co theo nội dung |
| `flex` | hàng ngang |
| `flex-col` | cột dọc |
| `gap-N` | khoảng cách giữa con |
| `p-/px-/py-` | padding (con bị đẩy vào, không tràn lề) |
| `w-full` | rộng = cha trừ padding |
| `flex-1` | chia đều phần dư |
| `justify-between` | con đầu/cuối dạt hai mép |
| `items-center` | căn giữa trục chéo |
| `absolute inset-0` | phủ kín cha |
| `hidden` | **không chiếm chỗ**, nhưng vẫn giữ node + cây con để bật lại |

Test: **15 ca** trong `UiLayoutTests.cs` + 1 ca trên cây production thật.
Xanh hết — nằm trong tổng **107/107 test**.

---

## 4. Kết quả dựng trong Unity (đo thật)

```
[BuildProductionUi] theme: 181 màu, 51 gradient; spacing: 100; fontSize: 12
[BuildProductionUi] layout: 1150 box cho 1280x720
[BuildProductionUi] màn hình mặc định: tabEquip
[BuildProductionUi] đã dựng 1149 GameObject, bỏ 0
[BuildProductionUi] chưa biểu diễn được: 19
[BuildProductionUi] OK: Assets/Artemis/Scenes/UiPreview.unity
```

Ảnh chụp: `unity-client/DocsCaptures/ui-preview.png`
Ảnh production để so: `unity-client/DocsCaptures/production-1280.png`

### Đã giống
- Chữ tiếng Việt đúng dấu (`Nữ Thần Săn Trăng Bạc`, `Trang bị`, `Ngọc`)
- Màu nền, màu panel, gradient gold/orange đúng hex production
- Thứ tự và cấu trúc node đúng (cùng div, cùng thứ tự)
- `&amp;` đã giải mã (trước đó hiện nguyên entity)
- Tab mặc định `tabEquip` khớp production

### CHƯA giống — 19 điểm, ghi rõ trong log
| Thiếu | Vì sao | Cách xử lý sau |
|---|---|---|
| `box-shadow` (12 chỗ) | Unity UI không có shadow nhiều lớp | ảnh 9-slice hoặc shader |
| `backdrop-blur` (5 chỗ) | cần shader blur | shader riêng |
| Bo góc `rounded-*` | Image cần sprite 9-slice | sinh sprite bo góc từ `radius` |
| Font **Inter** | chưa có file `.ttf` trong project | tải Inter → `Resources/ArtemisFonts/Inter.ttf` |
| Icon/asset ngoài base64 | production dùng SVG do JS tạo | trích tiếp |
| `::after`, hover state | CSS pseudo-element | làm bằng script |

---

## 5. GIỚI HẠN THẬT — đọc kỹ phần này

Extractor hiện tại chỉ đọc **HTML tĩnh** trong `index.html`. Production còn hai
nguồn UI **sinh bằng JavaScript** mà parser không thấy:

### 5.1 Màn đăng nhập nằm ở `public/cloud.js`, không phải `index.html`

Đây là màn hình **đầu tiên người chơi thấy**. Nó không có trong `index.html`:

```
public/cloud.js  ->  function buildGate(mode)
                     ~16.195 ký tự, dựng DOM bằng createElement
                     + cssText inline, KHÔNG dùng Tailwind
```

Vì vậy ảnh production tôi chụp (`production-1280.png`) là **màn login**, còn Unity
đang dựng **tabEquip**. Hai thứ khác nhau, không phải lỗi — nhưng phải nói rõ.

Muốn dựng màn login trong Unity: đọc `buildGate` trong `cloud.js`, chuyển các
`cssText` inline sang theme. Chưa làm.

### 5.2 37% UI trong `index.html` sinh bằng JS

Đo được: **101 chỗ gán `.innerHTML`**, 816 template literal, 156 id chỉ tồn tại
trong JS. Những phần này (danh sách trang bị, lưới kỹ năng, bảng season…) **không
có trong `uiTree.json`** vì chúng chưa tồn tại lúc file HTML được đọc.

Ví dụ cụ thể: `renderGearList()`, `renderGuildPanel()`, `renderSeasonScreen()` …

Để phủ: phải chạy production trong trình duyệt thật (có đăng nhập, có save), rồi
dump DOM **sau khi JS render** — tức chụp `document.body.outerHTML` theo từng màn
hình. Đó là hướng đúng và làm được, nhưng cần:
1. Tài khoản test (hoặc `OfflineTestMode`)
2. Script duyệt qua từng tab/modal, dump DOM mỗi trạng thái
3. Chạy lại pipeline trích xuất trên từng bản dump

### 5.3 Bảng tổng kết phạm vi

| Nguồn UI | Số node | Đã trích | Ghi chú |
|---|---|---|---|
| `index.html` HTML tĩnh | 661 | ✅ | dựng đủ 1149 GameObject |
| `index.html` sinh bằng JS | ~37% id | ❌ | cần dump DOM sau render |
| `cloud.js` màn login | ~16 kB JS | ❌ | dựng tay theo `buildGate` |

---

## 6. Lỗi thật đã gặp và sửa

| Lỗi | Triệu chứng | Nguyên nhân | Sửa |
|---|---|---|---|
| `PROJECT:Minimal` | build WebGL fail | Minimal là template built-in | `APPLICATION:Minimal` |
| TMP chưa import | HUD không có chữ | font atlas nằm trong `.unitypackage` riêng | tự giải nén tar.gz |
| `AssetDatabase.ImportPackage` | treo batchmode | async trên main thread, `Thread.Sleep` chặn chính nó | dựng bằng tar |
| Scene gắn sai chủ | `FindObjectOfType` thấy bản mồ côi | 5 component gắn lên `GameBootstrap` | `CleanStrayComponents` |
| `UiTheme.Load` | `IndexOutOfRange` | CSS có `font-family: inherit` (không dấu nháy) | tách tên font an toàn |
| `AddComponent<Text>` trả null | `NullReferenceException` | Unity chỉ cho 1 Graphic/GameObject | tạo GameObject con "Label" |
| **LayoutGroup dồn góc** | mọi thứ ở góc trên-trái, size 0 | Unity LayoutGroup không mô phỏng CSS flex | **viết `UiLayout` riêng** |
| `w-full` = 0px | khối rộng 0 | extractor bỏ giá trị 0px | nhận diện bằng class |
| `<div>` co theo nội dung | chữ chồng nhau | quên `<div>` là block | `IsBlock` → rộng hết dòng |
| Tab hiện cùng lúc | màn hình lộn xộn | dựng hết 19 màn hình | ép theo `defaultState` |
| `&amp;` hiện nguyên | text sai | không giải mã entity | `decodeEntities` |
| `bg-[#0b132b]` mất màu | panel trắng | chỉ hỗ trợ `bg-slate-900` | thêm nhánh arbitrary |
| `.jpg` không dùng được | ảnh không hiện | import mặc định là Texture | `ImportUiSprites` -> Sprite |

`Arial.ttf` cũng đã bị Unity 2022 bỏ — dùng `LegacyRuntime.ttf`.

---

## 7. Lệnh tái lập

```bash
# 1. Trích dữ liệu từ production
node tools/unity-ui/extract-ui.mjs
node tools/unity-ui/extract-theme.mjs
node tools/unity-ui/extract-images.mjs

# 2. Test (không cần Unity)
dotnet test unity-client/ArtemisDomain.Tests/Artemis.Domain.Tests.csproj

# 3. Dựng + chụp ảnh (cần Unity)
U="/c/Program Files/Unity/Hub/Editor/2022.3.62f1/Editor/Unity.exe"
P="C:/Users/PuuGoo/Desktop/Artemis/unity-client"
"$U" -batchmode -nographics -quit -projectPath "$P" -executeMethod Artemis.EditorTools.ImportUiSprites.Run
"$U" -batchmode -nographics -quit -projectPath "$P" -executeMethod Artemis.EditorTools.BuildProductionUi.Run
"$U" -batchmode -quit -projectPath "$P" -executeMethod Artemis.EditorTools.CaptureUiScreenshot.Run
```

Trong Editor có menu: **Artemis → UI → 1. Dựng màn hình production**.
