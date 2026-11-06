# UNITY CLIENT — Artemis

> Bản Unity của Artemis. **Không thay thế** bản web: `public/`, `api/`, `lib/`
> giữ nguyên và vẫn là bản đang chạy production.

---

## 1. Trạng thái thật (đọc trước khi dùng)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Domain C# (`Assets/Artemis/Domain`) | ✅ **chạy, có test** | 81 test NUnit xanh, so với chính code JS production |
| Runtime Unity (`Assets/Artemis/Scripts`) | ⚠️ **biên dịch được, CHƯA chạy** | kiểm tra bằng stub API; chưa mở trong Editor |
| Scene `Bootstrap.unity` | ⚠️ **có, chưa mở** | GUID đã vá đúng, nhưng chưa được Unity xác nhận |
| Build WebGL | ❌ **chưa làm** | không có Unity Editor trên máy phát triển |
| Build Android | ❌ **chưa làm** | thiếu Unity + JDK/Android SDK, và **chặn bởi xác thực** (§5) |
| Dữ liệu tĩnh (27 bảng, 250+ mục) | ✅ **sinh tự động** | từ `public/index.html`, có test đếm |

Nói ngắn: **domain đã được chứng minh bằng số; phần engine chưa được chạy lần nào.**
Không có tuyên bố nào dưới đây nói rằng game đã chơi được trong Unity.

---

## 2. Yêu cầu môi trường

| Thành phần | Phiên bản | Bắt buộc cho |
|---|---|---|
| Unity Editor | **2022.3 LTS** (khoá trong `ProjectSettings/ProjectVersion.txt`) | mở project, build |
| Unity modules | WebGL Build Support, Android Build Support | build tương ứng |
| .NET SDK | 8.0 | chạy test domain (`dotnet test`) **không cần Unity** |
| Node.js | ≥ 20 | sinh dữ liệu / fixture parity |
| JDK + Android SDK/NDK | — | build Android |

---

## 3. Chạy test domain (KHÔNG cần Unity)

Đây là phần duy nhất có thể kiểm chứng đầy đủ trên máy không có Editor.

```bash
# 1. Sinh lại fixture từ code production (chỉ khi public/index.html đổi)
node tools/unity-parity/gen-jsmath-fixtures.mjs
node tools/unity-parity/gen-fixtures.mjs
node tools/unity-parity/gen-save-fixtures.mjs

# 2. Chạy 81 test parity
dotnet test unity-client/ArtemisDomain.Tests/Artemis.Domain.Tests.csproj
```

Kỳ vọng: `Passed! - Failed: 0, Passed: 81`.

Ba nhóm test và ý nghĩa:

- **JsMath** — `Math.round` của JS làm tròn nửa về +∞, .NET thì banker's. Test
  đối chiếu trực tiếp với Node trên 17 ca, gồm cả `0.49999999999999994`.
- **Stats / Combat / Spawn** — 16 cấu hình chỉ số, 9 ca `damageEnemy`, 67 phòng ×
  5 chương, 30 ca thưởng. Tất cả so với **kết quả do chính code production tính**,
  không phải bản chép công thức.
- **Save** — round-trip 8 bộ save đã qua `sanitizeSave()` của server; chỉ số phải
  y nguyên sau khi lưu → đọc lại.

---

## 4. Kiểm tra dự án Unity (không cần Editor)

```bash
node tools/unity-parity/check-unity-project.mjs   # 26 kiểm tra
dotnet build unity-client/UnityStub/Artemis.Domain.UnityStub.csproj
```

Lệnh thứ hai biên dịch **chính** mã trong `Assets/Artemis/Scripts` với một stub
API Unity. Nó bắt được lỗi cú pháp, sai kiểu, thiếu `using`, gọi hàm không tồn
tại — nhưng **không** chứng minh mã chạy đúng trong Unity.

---

## 5. Mở trong Unity (chưa được thực hiện ở đây)

```
1. Unity Hub → Add project from disk → chọn unity-client/
2. Mở bằng 2022.3 LTS (Hub sẽ tự tải nếu chưa có)
3. Mở Assets/Artemis/Scenes/Bootstrap.unity
4. Chọn GameObject "GameBootstrap":
   - ApiBaseUrl: để TRỐNG nếu chạy trên cùng origin với API
   - OfflineTestMode: bật để thử không cần đăng nhập (chỉ trong Editor)
5. Play
```

**Lần mở đầu tiên Unity sẽ báo thiếu:** prefab đạn/quái, sprite, và các tham
chiếu UI trong `GameBootstrap`. Đây là phần phải làm bằng tay trong Editor —
không thể sinh bằng script vì chúng là tham chiếu scene object.

Việc còn thiếu để slice chạy được (xem `docs/unity-migration/BACKLOG.md` P1-19…P1-27):

- [ ] `Projectile.prefab` + `Enemy.prefab` (cần SpriteRenderer + Collider2D)
- [ ] Gán 2 `ProjectilePool`
- [ ] Dựng Canvas HUD, gán 14 field của `CombatHud`
- [ ] Dựng panel AuthScreen, gán 9 field
- [ ] Gán `PlayerController` / `PlayerStatsBehaviour` / `CombatController` / `RoomController` vào `GameBootstrap`

---

## 6. Xác thực — điểm chặn Android

Bản web dùng cookie `HttpOnly; SameSite=Lax; Secure`.

| Nền tảng | Khả thi | Điều kiện |
|---|---|---|
| **WebGL** | ✅ | Phải phục vụ **cùng origin** với API (ví dụ `/unity/index.html` trên chính domain Vercel). Khác origin thì `SameSite=Lax` chặn cookie. |
| **Android** | ❌ **chặn** | `UnityWebRequest` không đọc được cookie `HttpOnly`. Cần phương án được phê duyệt (Bearer token bổ sung qua endpoint mới) — xem `docs/unity-migration/SOURCE_AUDIT.md` §3. |

Không có đường tắt nào trong mã: `SaveSyncService` từ chối mọi lệnh ghi khi
trạng thái là `NotReady` hoặc `Unauthorized`.

---

## 7. Cấu trúc

```
unity-client/
  Assets/Artemis/
    Domain/        ← C# THUẦN, không UnityEngine, test bằng dotnet
      Core/          JsMath, Json, IRandomSource
      Stats/         PlayerStatsCalculator (getComputedStats)
      Combat/        DamageCalculator, IncomingDamageCalculator
      Spawning/      EnemySpawner (quái + boss)
      Progression/   RewardService, XpService, ChapterService
      Persistence/   SaveSerializer, SavePushPolicy
    Scripts/       ← MonoBehaviour, phụ thuộc UnityEngine
    Resources/ArtemisData/  ← 27 bảng JSON SINH TỰ ĐỘNG
    Scenes/Bootstrap.unity
    Tests/         ← EditMode/PlayMode (chưa viết — xem BACKLOG)
  ArtemisDomain/          .csproj trỏ vào Assets/Artemis/Domain
  ArtemisDomain.Tests/    81 test NUnit
  UnityStub/              stub API để biên dịch mã Unity bằng dotnet
```

Chỉ có **một** bản source C#: `.csproj` trỏ vào `Assets/`, không chép qua lại.

---

## 8. Dữ liệu tĩnh

`Assets/Artemis/Resources/ArtemisData/*.json` là **nguồn duy nhất**, sinh bởi:

```bash
node tools/unity-parity/extract-data.mjs
```

Script này chạy chính `public/index.html` trong DOM giả rồi xuất ra JSON. Khi web
đổi dữ liệu, chạy lại là Unity nhận thay đổi — **không có bảng nào chép tay**, nên
không thể lệch âm thầm.

`check-unity-project.mjs` khoá số lượng từng bảng (18 hero, 72 skill, 46 rune,
46 artifact…) để phát hiện thiếu mục.

---

## 9. Cảnh báo đã biết

1. **Server lọc bỏ `artifactStars` và `equippedRuneSlots`** — 0/52 save production
   có hai field này. Unity đọc nếu có nhưng **không** tạo mặc định rỗng (sẽ ghi đè
   dữ liệu khi whitelist được sửa). Xem
   `docs/unity-migration/FINDING-save-drops-artifacts-runes.md`.
2. **`obsidian_brute` không nhân `baseHits`** do lỗi ưu tiên toán tử trong bản web.
   Domain tái hiện đúng hành vi đó để không đổi cân bằng.
3. **14/18 hero không có skin curate sẵn** — skin được sinh động với hệ số khác.
   Domain đã port nhánh sinh đó.
