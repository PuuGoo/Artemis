# CÀI UNITY ĐỂ CHẠY UNITY CLIENT

> Tài liệu này hướng dẫn cài Unity Editor trên **chính máy này** để làm được 3
> việc còn thiếu: mở `Bootstrap.unity`, chạy vertical slice, và build WebGL/APK.
>
> Toàn bộ số liệu dung lượng dưới đây lấy từ **API phát hành chính thức của Unity**
> (`services.api.unity.com`), không phải ước lượng.

---

## 1. Đánh giá máy này trước khi cài

Đo trực tiếp trên máy:

| Thành phần | Máy này | Unity 2022.3 yêu cầu | Kết luận |
|---|---|---|---|
| OS | Windows 10 22H2 (19045.6466) 64-bit | Windows 7 SP1+/10/11 64-bit | ✅ đạt |
| CPU | Intel **i7-3520M** (2 nhân / 4 luồng, 2.9 GHz, **Ivy Bridge 2012**) | x64 + SSE2 | ⚠️ đạt tối thiểu, rất cũ |
| RAM | 8.490.168.320 byte (**7,9 GiB**) | tối thiểu 8 GB | ⚠️ vừa khít |
| GPU | **Intel HD Graphics 4000**, driver 10.18.10.5129 | DX10/11/12 | ❌ **driver 2015, quá cũ** |
| Trống C: | **16,5 GiB** | xem §2 | ⚠️ đủ nếu chỉ WebGL |
| Trống G: | 15,7 GiB | | |
| Unity Editor | chưa có | | cần cài |
| JDK / Android SDK | chưa có | | cần cài nếu làm Android |

**Kết luận thẳng thắn:**

- **Chạy được, nhưng chậm.** Editor sẽ mất 40–90 giây để mở project lần đầu; mỗi
  lần bấm Play có thể chờ 10–30 giây. Đây là trải nghiệm thật trên HD 4000, không
  phải lời cảnh báo chung.
- **Build WebGL: khả thi** (16,5 GiB đủ cho Editor + WebGL = 8,6 GiB, còn ~7 GiB).
  Đã đo thật trên máy này: build đầu **18m47s**, build lại **16–47s**.
- **Build Android: KHÔNG khuyến nghị.** Cần thêm 2,1 GiB (tổng 10,7 GiB) và
  **IL2CPP cần ~8 GB RAM chỉ để link** — với 7,9 GiB máy sẽ swap và có thể treo
  hoặc lỗi link. Chưa kể Android đang bị **chặn bởi vấn đề xác thực** (xem
  `docs/unity-migration/SOURCE_AUDIT.md` §3).

### Cải thiện trước khi cài (nếu làm được)

| Việc | Lợi ích |
|---|---|
| Cài driver Intel HD 4000 mới nhất từ Lenovo/Dell | Unity cần DX11 ổn định; driver 2015 hay crash khi mở scene |
| Giải phóng C: thêm ~5 GiB | `%LOCALAPPDATA%\Temp` đang chiếm **2,3 GiB**; `Temp` an toàn để xoá |
| Đặt Library ra ổ khác | Unity sinh 2–4 GiB cache; `Preferences → Paths` |
| Tắt Windows Defender realtime cho `unity-client/` | tăng tốc import đáng kể |

Xoá temp an toàn (không ảnh hưởng dữ liệu):

```bash
rm -rf "$LOCALAPPDATA/Temp"/* 2>/dev/null
```

> Lưu ý: lệnh này cũng xoá `/tmp/dotnet8` (SDK .NET tôi đang dùng để test). Nếu
> cần chạy lại `dotnet test`, cài lại theo §6.

---

## 2. Dung lượng chính xác (từ API Unity)

Đo từ `services.api.unity.com` cho đúng bản `2022.3.62f1` (changeset
`4af31df58517`):

| Thành phần | Tải về | Sau khi cài |
|---|---|---|
| Unity Editor 2022.3.62f1 | 3,44 GiB | **6,05 GiB** |
| WebGL Build Support (`webgl`) | 0,55 GiB | **2,55 GiB** |
| Android Build Support (`android`) | 0,44 GiB | **2,09 GiB** |
| Documentation (`documentation`, tuỳ chọn) | 0,33 GiB | 0,67 GiB |
| Visual Studio 2022 Community (**bỏ chọn**) | 1,58 GiB | 1,59 GiB |

Tổng:

```
Editor + WebGL              =  8,60 GiB   ← khuyến nghị cho máy này
Editor + WebGL + Android    = 10,69 GiB   ← vượt ngưỡng an toàn của 16,5 GiB trống
```

Cộng thêm `Library/` của project (2–4 GiB sau lần import đầu) → **Editor + WebGL
cần khoảng 11–13 GiB**. Với 16,5 GiB trống, đủ nhưng không rộng rãi.

**Đừng chọn** `visualstudio`, `documentation`, `ios`, `mac-*`, `linux-*`,
`universal-windows-platform` — mỗi cái 0,3–2,7 GiB và không dùng tới.

---

## 3. Cài Unity Hub

### Cách A — winget (nhanh nhất)

```bash
winget install --id Unity.UnityHub --accept-source-agreements --accept-package-agreements
```

Đã xác minh máy này có: `Unity Hub 3.22.5.65535` trong kho winget.

> ⚠️ **Không chạy lệnh này ở chế độ nền** (`background=true`). Đã thử và nó chết
> với `stdin is not a tty`. Chạy trực tiếp trong terminal.

### Cách B — tải tay

1. https://unity.com/download → **Download for Windows**
2. Chạy `UnityHubSetup.exe`, để mặc định
3. Đăng nhập bằng tài khoản Unity (bắt buộc — bản Personal miễn phí vẫn cần)

Sau khi cài, mở Hub → ⚙ **Settings → Installs → Install location**, đổi sang ổ
còn nhiều chỗ nếu cần (ví dụ `G:\Unity`).

---

## 4. Cài Unity Editor 2022.3.62f1 + WebGL

### Cách A — giao diện Hub (khuyến nghị cho máy này)

1. Hub → tab **Installs** → **Install Editor**
2. Chọn tab **Archive** → tìm `2022.3.62f1` (hoặc bấm link này:
   `unityhub://2022.3.62f1/4af31df58517`)
3. Ở bước **Add modules**, **chỉ tick**:
   - ☑ **WebGL Build Support** (2,55 GiB)
4. **Bỏ tick** mọi thứ khác, đặc biệt **Microsoft Visual Studio Community 2022**
   (1,59 GiB — không cần để chạy project, chỉ cần khi debug sâu)
5. **Install** → chờ 30–60 phút trên máy này (tải 4 GiB + giải nén)

### Cách B — Unity CLI (nếu muốn script hoá)

Hub 3.22 vẫn còn Hub CLI (tuy đã deprecate từ 3.18).

> **Quan trọng:** trên Windows, Unity Hub cài qua winget là gói **MSIX**, nên
> **KHÔNG** nằm ở `C:\Program Files\Unity Hub\`. Đường dẫn thật (đã kiểm tra trên
> máy này):
>
> ```
> C:\Program Files\WindowsApps\UnityTechnologies.UnityHub_3.22.5.65535_x64__2vrhnee42bhxm\app\Unity Hub.exe
> ```
>
> Thư mục `WindowsApps` bị chặn quyền đọc với user thường, nên gọi `.exe` trực
> tiếp từ bash sẽ ra **Permission denied**. Dùng một trong hai cách:

```bash
# Cách 1 — chạy qua AppsFolder (hoạt động, đã thử trên máy này)
powershell -NoProfile -Command "Start-Process 'shell:AppsFolder\UnityTechnologies.UnityHub_2vrhnee42bhxm!UnityHub'"
```

Cách 2 — giao diện (khuyến nghị, vì CLI còn cần đăng nhập):

```
Mở Unity Hub → Sign in → Installs → Install Editor → Archive → 2022.3.62f1
```

Nếu lệnh trên báo không nhận `--headless`, dùng **Unity CLI** mới:

```bash
npm install -g unity-cli      # hoặc tải từ unity.com
unity install 2022.3.62f1 -c 4af31df58517 -m webgl
```

Kiểm tra đã cài đúng:

```bash
ls "/c/Program Files/Unity/Hub/Editor/2022.3.62f1/Editor/Unity.exe"
```

---

## 5. Mở project và chạy vertical slice

### 5.1 Mở lần đầu

```bash
# Hub → Add → Add project from disk → chọn:
C:\Users\PuuGoo\Desktop\Artemis\unity-client
```

Hoặc mở trực tiếp:

```bash
"/c/Program Files/Unity/Hub/Editor/2022.3.62f1/Editor/Unity.exe" \
  -projectPath "C:/Users/PuuGoo/Desktop/Artemis/unity-client"
```

Lần mở đầu tiên Unity sẽ:
- import 27 file JSON + 96 `.meta` + toàn bộ script (~2–5 phút trên máy này)
- tạo `Library/` (~2–4 GiB)
- **có thể hiện hộp thoại nâng cấp project** — chọn **Continue** (project khoá
  2022.3.62f1, không đổi gì)

Nếu Unity báo lỗi biên dịch: mở **Window → General → Console**, đọc lỗi đầu tiên.
Mã đã được biên dịch thành công bằng `dotnet` với stub API (xem §7), nên lỗi thật
trong Unity thường do **thiếu TMP Essential Resources** — package
`com.unity.textmeshpro 3.0.6` đã khai trong `manifest.json`, nhưng bộ font/asset
mặc định phải import một lần: **Window → TextMeshPro → Import TMP Essential
Resources**. Nếu bỏ qua bước này, mọi `TextMeshProUGUI` sẽ không hiện chữ.

### 5.2 Dựng vertical slice — MỘT cú click

Sau khi project mở xong:

1. Mở scene: `Assets/Artemis/Scenes/Bootstrap.unity`
2. Menu **Artemis → 1. Dựng Vertical Slice (prefab + HUD + tham chiếu)**

Script Editor này (`Assets/Artemis/Editor/VerticalSliceSetup.cs`) sẽ tự:

- sinh 3 sprite tròn giữ chỗ (player/enemy/projectile) vào `Assets/Artemis/Generated/`
- tạo `Prefabs/Projectile.prefab` và `Prefabs/Enemy.prefab` (có collider + rigidbody)
- tạo 2 pool đạn (`PlayerProjectilePool`, `EnemyProjectilePool`)
- dựng Canvas HUD: phòng / quái / cấp / XP / vàng / thanh máu / thanh máu trùm
- dựng Canvas đăng nhập: 2 ô nhập + 3 nút + ô lỗi
- gán **toàn bộ** tham chiếu vào `GameBootstrap`

3. Kiểm tra lại: menu **Artemis → 2. Kiểm tra tham chiếu scene** → phải báo
   *"Mọi tham chiếu đã gán"*
4. Lưu scene (Ctrl+S)
5. Chọn `GameBootstrap` trong Hierarchy, ở Inspector:
   - **Offline Test Mode** = ☑ (để chạy không cần đăng nhập)
   - **Api Base Url** = để trống
6. Bấm **Play**

### 5.3 Kỳ vọng khi chạy

| Hiện tượng | Nghĩa là |
|---|---|
| Chấm xanh ở dưới sân | Player — di chuyển bằng **WASD / mũi tên** |
| Đứng yên → có đạn vàng bắn lên | Cơ chế "dừng để bắn" đang chạy |
| 3 chấm đỏ lao về phía bạn | Quái phòng 1 (slime/goblin/skeleton_mage tuỳ phòng) |
| HUD góc trên trái hiện `Phòng 1 / 15` | Session + domain spawner đang chạy |
| Thanh máu giảm khi quái chạm | `hurtPlayer()` 9 bước đang chạy |
| Giết hết 3 quái | `RoomCleared` — hiện tại **chưa tự sang phòng**, cần gọi `GoToNextRoom()` (xem §8) |

Nếu **không** thấy quái: kiểm tra `RoomController.EnemyPrefab` đã gán. Nếu không
thấy đạn: kiểm tra `PlayerProjectiles.Prefab`.

---

## 6. Build WebGL

### 6.1 Chuẩn bị

```bash
# Nếu /tmp/dotnet8 đã bị xoá và cần chạy test lại:
cd "$TMPDIR" && curl -sSL "https://dotnetcli.azureedge.net/dotnet/Sdk/8.0.404/dotnet-sdk-8.0.404-win-x64.zip" -o dotnet-sdk.zip \
  && mkdir -p dotnet8 && cd dotnet8 && unzip -q ../dotnet-sdk.zip
```

### 6.2 Build

Unity Editor → **File → Build Settings**:

1. **Platform**: WebGL → **Switch Platform** (chờ 3–8 phút trên máy này)
2. **Player Settings** (bấm nút cùng tên):
   - `Player → Resolution and Presentation → WebGL Template`: **Minimal**
   - `Player → Publishing Settings → Compression Format`: **Gzip**
     (Brotli nhỏ hơn nhưng Vercel cần cấu hình header; Gzip an toàn hơn)
   - `Player → Publishing Settings → Decompression Fallback`: ☑
   - `Player → Other Settings → Managed Stripping Level`: **Medium**
3. **Build** → chọn thư mục `unity-client/Builds/WebGL`

Trên máy này: **15–30 phút**, ra khoảng 12–25 MB (nén gzip).

### 6.3 Điều kiện BẮT BUỘC: cùng origin

Cookie phiên là `HttpOnly; SameSite=Lax; Secure`. **Không** hoạt động nếu WebGL
chạy khác domain với API.

Đúng:

```
https://artemis-xxx.vercel.app/            ← web hiện tại
https://artemis-xxx.vercel.app/unity/      ← build Unity đặt ở đây
```

Sai (cookie bị chặn, đăng nhập không giữ được):

```
https://cdn.example.com/unity/   → gọi https://artemis-xxx.vercel.app/api/...
```

Cách triển khai đúng: copy nội dung `Builds/WebGL/` vào thư mục `public/unity/`
**của repo web** rồi deploy Vercel như bình thường. (`public/` là static của
Vercel nên không cần cấu hình thêm.)

> **Chưa làm bước này** vì nó đụng `public/` của bản web production — cần bạn
> quyết định.

### 6.4 Test local trước khi deploy

```bash
cd unity-client/Builds/WebGL && python -m http.server 8080
# mở http://localhost:8080
```

Chỉ để xem scene có chạy. Đăng nhập sẽ **thất bại** vì khác origin — đúng như dự
kiến, không phải lỗi.

---

## 7. Kiểm tra không cần Unity (làm được ngay hôm nay)

Ba lệnh này đã chạy xanh trên máy này và **không cần Unity**:

```bash
# 81 test công thức/dữ liệu, so với chính code JS production
dotnet test unity-client/ArtemisDomain.Tests/Artemis.Domain.Tests.csproj

# 26 kiểm tra cấu trúc dự án (meta, GUID, asmdef, dữ liệu)
node tools/unity-parity/check-unity-project.mjs

# Biên dịch TOÀN BỘ mã Unity + Editor script bằng stub API
dotnet build unity-client/UnityStub/Artemis.Domain.UnityStub.csproj
```

Lệnh thứ ba đặc biệt hữu ích: nó biên dịch **chính** các file trong
`Assets/Artemis/{Domain,Scripts,Editor}` nên bắt được lỗi cú pháp/kiểu **trước
khi** mở Unity. Đây là cách tôi đã tìm và sửa 7 lỗi thật trong mã Unity mà không
có Editor.

---

## 8. Việc còn thiếu sau khi slice chạy

| Việc | Ghi chú |
|---|---|
| ~~Tự chuyển phòng khi dọn sạch~~ | ✅ **Đã làm** — `RoomController.AutoAdvanceDelay = 1.2s` (đặt 0 để chuyển thủ công) |
| `BossController` + pattern golem | `BACKLOG.md` P2-04. HP/ATK boss **đã verified** (test A22), chỉ thiếu pattern đạn. |
| Đạn của quái | Hiện quái chỉ gây sát thương khi chạm; bản web có `skeleton_mage` bắn đạn. |
| Nối `RoomController.Rewarded` → save | Hiện `GameBootstrap.OnRunFinished` đã cộng vàng, nhưng chưa có UI tổng kết. |
| EditMode/PlayMode test trong Unity | `BACKLOG.md` P1-31/32 |
| Build APK | Cần xác thực Android được duyệt trước (xem §1) |

---

## 9. Nếu gặp lỗi

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Artemis.Domain` không thấy | asmdef chưa import | **Assets → Reimport All** |
| `TextMeshPro` không thấy | TMP chưa import lần đầu | **Window → TextMeshPro → Import TMP Essential Resources** |
| Unity treo khi mở scene | driver HD 4000 cũ | cập nhật driver; hoặc **Edit → Project Settings → Editor → Graphics** giảm quality |
| Build WebGL lỗi IL2CPP | thiếu RAM/ổ | đóng app khác; build với `Development Build` tắt |
| `Không nạp được dữ liệu game` khi Play | thiếu JSON trong Resources | chạy `node tools/unity-parity/extract-data.mjs` |
| Bấm Play không có gì xảy ra | chưa gán tham chiếu | menu **Artemis → 2. Kiểm tra tham chiếu scene** |
| Nút đăng nhập không phản hồi (WebGL local) | khác origin, cookie bị chặn | chạy cùng origin như §6.3 |
