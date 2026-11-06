# BUILD WEBGL ĐẦU TIÊN — NHỮNG GÌ THẬT SỰ CHẠY ĐƯỢC

> Ghi ngày 2026-11-06, trên chính máy dev (i7-3520M, 7,9 GiB RAM, Intel HD 4000).
> Mọi dòng dưới đây là kết quả đo, không phải dự đoán.

---

## 1. Kết quả build

| Hạng mục | Giá trị |
|---|---|
| Unity Editor | **2022.3.62f1** (changeset `4af31df58517`) — đúng bản project khoá |
| Module | WebGL Build Support + Windows Standalone |
| Build lần đầu (IL2CPP nguội) | **16 phút 59 giây** |
| Build lại (IL2CPP ấm cache) | **16–25 giây** |
| Kết quả | `BuildResult.Succeeded`, **0 lỗi** |
| Dung lượng | **7 MB** (5 file) |

Cấu trúc ra:

```
Builds/WebGL/
  index.html                         1.787 B
  Build/WebGL.data.unityweb          2.066.742 B
  Build/WebGL.framework.js.unityweb     71.165 B
  Build/WebGL.loader.js                 44.292 B
  Build/WebGL.wasm.unityweb          5.433.586 B   (gzip, magic 1f 8b)
```

Kiểm chứng wasm thật: `xxd -l 8` ra `1f8b 0818` → gzip hợp lệ, không phải file rỗng.

---

## 2. Đã xác nhận CHẠY trong trình duyệt thật

Mở `http://127.0.0.1:8080/` bằng Chrome headless (CDP), chờ Unity nạp:

| Kiểm tra | Kết quả |
|---|---|
| `createUnityInstance` resolve | ✅ `progress: 1` |
| Engine khởi tạo | ✅ `2022.3.62f1 (4af31df58517)`, WebGL 2.0, GLES 3.0 |
| Canvas | ✅ 960×600, có WebGL context |
| HUD tiếng Việt | ✅ `Phòng 1 / 15`, `Quái: 3`, `Cấp 1`, `0 / 80 EXP` |
| Player | ✅ chấm xanh dương hiện ra |
| Quái | ✅ chấm đỏ hiện ra |
| Thanh máu | ✅ thanh xanh lá góc dưới trái |
| **Di chuyển bằng phím** | ✅ **giữ ArrowLeft 1,2s → frame đổi** (`5537501a` → `ba9a6820`) |
| Log game | ✅ chạy tới `BootRoutine`, có `[SaveSync] Từ chối ghi: chưa nạp save từ server` |

Bằng chứng di chuyển: hash ảnh canvas đổi khi giữ phím, và **giữ nguyên** sau khi thả phím — đúng hành vi input.

---

## 3. Lỗi thật đã gặp và cách sửa

### 3.1 `PROJECT:Minimal` — template không tồn tại

```
Exception: Invalid WebGL template path:
  ...\Assets\WebGLTemplates\Minimal! Select a template in player settings.
```

`Minimal` là template **built-in** của Unity, nằm trong
`Editor/Data/PlaybackEngines/WebGLSupport/BuildTools/WebGLTemplates/`.
Prefix `PROJECT:` chỉ dùng cho template tự tạo trong `Assets/WebGLTemplates/`.

→ Sửa: `PlayerSettings.WebGL.template = "APPLICATION:Minimal"`.

### 3.2 TMP Essential Resources thiếu → HUD không có chữ

Triệu chứng: HUD hiện thanh màu nhưng **không một chữ nào**. Package
`com.unity.textmeshpro` chỉ chứa code; font atlas + `TMP Settings` nằm trong
`Package Resources/TMP Essential Resources.unitypackage` và phải import riêng.

→ Sửa: giải nén `.unitypackage` (định dạng tar.gz, mỗi entry có
`pathname`/`asset`/`asset.meta`) thẳng vào `Assets/`. Kết quả: 64 file, gồm
`TMP Settings.asset` và `LiberationSans SDF.asset`.

### 3.3 `AssetDatabase.ImportPackage` treo trong batchmode

Bản đầu của `ImportTmpEssentials.cs` gọi `AssetDatabase.ImportPackage` rồi chờ
bằng `Thread.Sleep`. Hàm đó lên lịch import **bất đồng bộ trên main thread**;
chặn main thread thì import không bao giờ chạy — log ra 32 dòng
`Asset Pipeline Refresh` rồi thoát, `Assets/TextMesh Pro` vẫn rỗng.

→ Sửa: tự giải nén `.unitypackage` bằng `tar` (có sẵn trên Windows 10 1803+).

### 3.4 Scene viết tay gắn component sai chủ

`Bootstrap.unity` (do tôi viết bằng YAML khi chưa có Editor) gắn
`CombatHud`, `AuthScreen`, `RoomController`, `CombatController`,
`PlayerStatsBehaviour` **lên GameObject `GameBootstrap`**. Hệ quả:
`Object.FindObjectOfType<CombatHud>()` tìm thấy bản "mồ côi" không có Canvas
nên `BuildHud()` bỏ qua việc dựng HUD thật → scene chỉ có 8 GameObject, không
có Canvas nào.

→ Sửa: thêm `CleanStrayComponents()` + kiểm tra `GetComponent<Canvas>() != null`
trước khi chấp nhận component có sẵn. Sau khi sửa: **36 GameObject, 2 Canvas,
149 object, 0 tham chiếu mồ côi**.

### 3.5 Build thất bại vì server test đang giữ file

```
IOException: The process cannot access the file '...\Builds\WebGL'
because it is being used by another process.
```

→ Sửa: dừng server local trước khi build.

### 3.6 `serve-webgl.mjs` — `require` trong ESM

`node tools/serve-webgl.mjs` chết ngay:
`ReferenceError: require is not defined in ES module scope`.
→ Sửa: dùng `import http from "node:http"`.

### 3.7 Node background chết trên máy này

`node ... &` ở chế độ `background=true` không sống được trên host này
(`stdin is not a tty`). → Chạy với `pty: true`, hoặc foreground có timeout.

---

## 4. Chưa xác nhận (và không được nói là "đã xong")

| Hạng mục | Trạng thái thật |
|---|---|
| Đạn bắn ra khi đứng yên | ❓ **Chưa thấy trong ảnh chụp** — code đường đi đã đọc và đúng (`Combat.Tick` → `OnFire` → `FireVolley` → `ProjectilePool.Get`), nhưng chưa bắt được frame có đạn. Cần PlayMode test hoặc kiểm tra `LiveEnemyCount`. |
| Quái lao vào player | ❓ 3 quái được báo trong HUD nhưng chỉ 1 hiện ra; chưa xác nhận chúng di chuyển |
| Quái gây sát thương | ❓ thanh máu chưa thấy giảm |
| Giết quái → EXP/vàng | ❓ chưa xác nhận |
| Chuyển phòng (AutoAdvanceDelay) | ❓ chưa xác nhận |
| Android build | ❌ chưa thử — xem `INSTALL-UNITY.md` §1 (RAM/IL2CPP) |

Ghi rõ để không ai đọc tài liệu này rồi tưởng vertical slice đã hoàn chỉnh.

---

## 5. Lệnh tái lập

```bash
# 1. Dựng slice (idempotent, chạy lại được nhiều lần)
UNITY="/c/Program Files/Unity/Hub/Editor/2022.3.62f1/Editor/Unity.exe"
PROJ="C:/Users/PuuGoo/Desktop/Artemis/unity-client"

"$UNITY" -batchmode -nographics -quit -projectPath "$PROJ" \
  -executeMethod Artemis.EditorTools.BatchSetup.Run \
  -logFile "C:/Users/PuuGoo/tools/unity-setup.log"

# 2. Import TMP (chỉ cần một lần)
"$UNITY" -batchmode -quit -projectPath "$PROJ" \
  -executeMethod Artemis.EditorTools.ImportTmpEssentials.Run \
  -logFile "C:/Users/PuuGoo/tools/unity-tmp.log"

# 3. Build WebGL
"$UNITY" -batchmode -nographics -quit -projectPath "$PROJ" \
  -executeMethod Artemis.EditorTools.BuildWebGL.Run \
  -logFile "C:/Users/PuuGoo/tools/unity-build.log"

# 4. Chạy thử local
node tools/serve-webgl.mjs 8080
# mở http://127.0.0.1:8080/
```

Lưu ý khi mở bằng tay: `index.html` của template Minimal gọi
`createUnityInstance` **không kèm `.then()`**, nên `window.unityInstance` luôn
`undefined` dù game chạy bình thường. Muốn có handle thì gọi lại trong console
và gán vào biến.
