# KIẾN TRÚC ĐỀ XUẤT — Artemis Unity Client

> Đi kèm: `SOURCE_AUDIT.md` (khảo sát), `RISK_REGISTER.md`, `BACKLOG.md`,
> `PARITY_MATRIX.md`.
>
> Nguyên tắc chi phối toàn bộ tài liệu này: **gameplay là bất biến, trình bày là
> biến**. Mọi quyết định dưới đây phục vụ việc chứng minh điều đó bằng test.

---

## 1. Ràng buộc xuất phát

| Ràng buộc | Hệ quả kiến trúc |
|---|---|
| Web game đang chạy production, không được đổi hành vi | Unity là **client thứ hai**; backend và `public/` không sửa |
| Toàn bộ công thức nằm trong một `<script>` inline 32k dòng | Phải rút ra lớp C# **thuần** để test được ngoài Unity |
| Server kiểm tra kinh tế + season | Client phải mirror validator để báo lỗi sớm, nhưng **server vẫn là trọng tài** |
| Không được commit secret | Unity không bao giờ giữ JWT secret; chỉ giữ cookie/token do server cấp |
| Máy phát triển **không có Unity Editor** | Domain C# phải compile + test bằng `dotnet` thuần; phần Unity là lớp mỏng |

Ràng buộc cuối là quan trọng nhất về mặt kỹ thuật: nó buộc kiến trúc phải
**tách domain khỏi engine**. Đây không phải sở thích — đó là điều kiện để có
bằng chứng parity thật.

---

## 2. Phân lớp

```
┌──────────────────────────────────────────────────────────────┐
│  Unity Engine (Assembly-CSharp)                              │
│  PlayerController · EnemyController · BossController          │
│  ProjectileView · UiBinder · AudioDirector · VfxPool          │
│  MonoBehaviour, Update(), Animator, ParticleSystem           │
└───────────────────────────┬──────────────────────────────────┘
                            │ chỉ ĐỌC kết quả / GỬI intent
┌───────────────────────────▼──────────────────────────────────┐
│  Artemis.Domain (asmdef riêng, KHÔNG reference UnityEngine)   │
│  StatsCalculator · DamageCalculator · EnemyStatFactory        │
│  BossStatFactory · RoomPlan · RewardService · XpService       │
│  GearStatCalculator · SeasonDeltaValidator · SaveModel        │
│  JsMath · IRandomSource                                       │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  Artemis.Net (UnityWebRequest, KHÔNG trong Domain)            │
│  ArtemisApiClient · SessionStore · SaveSyncService            │
└──────────────────────────────────────────────────────────────┘
```

### Vì sao tách tuyệt đối như vậy

1. `dotnet test` compile được `Artemis.Domain` **không cần Unity** → parity test
   chạy được ngay trên máy này, hôm nay.
2. Unity Editor sau này chỉ cần thêm asmdef reference — không phải viết lại.
3. Khi Unity API đổi (WebGL/Android), domain không bị ảnh hưởng.
4. `MonoBehaviour` không thể unit-test; domain thuần thì có.

**Quy tắc cưỡng chế:** `Artemis.Domain` có `.csproj` riêng **không** tham chiếu
`UnityEngine`. Nếu ai thêm `using UnityEngine;` → build gãy ngay. Đây là hàng
rào tự động, không phải quy ước bằng lời.

---

## 3. Cấu trúc thư mục

```
unity-client/
  ArtemisDomain/                    # .NET Standard 2.1 — compile bằng dotnet
    Artemis.Domain.csproj
    Core/
      JsMath.cs                     # Math.round / toFixed của JS
      IRandomSource.cs              # inject RNG để test tất định
      DeterministicRandom.cs        # xorshift, cùng seed → cùng dãy
    Model/
      SaveModel.cs                  # ánh xạ 1:1 SaveState (62 khoá)
      ChapterDefinition.cs
      WeaponDefinition.cs
      HeroDefinition.cs
      EnemyDefinition.cs
      BossDefinition.cs
      GearItem.cs / GearTemplate.cs / GearQuality.cs
    Stats/
      StatsInput.cs                 # đầu vào đã chuẩn hoá
      PlayerStatsCalculator.cs      # getComputedStats
      PlayerStats.cs
    Combat/
      DamageRequest.cs
      DamageResult.cs
      DamageCalculator.cs           # damageEnemy
      IncomingDamageCalculator.cs   # hurtPlayer (pipeline 9 bước)
    Spawning/
      EnemyStatFactory.cs           # HP/ATK quái theo phòng
      BossStatFactory.cs            # HP/ATK boss
      RoomPlan.cs                   # loại quái, số lượng, isBossRoom
    Progression/
      RewardService.cs              # thưởng thắng/thua
      XpService.cs                  # xpNext × 1.25
      ChapterService.cs             # isChapterWon / isChapterLocked
    Seasons/
      SeasonDeltaValidator.cs       # mirror lib/economy.js
    Persistence/
      SaveSerializer.cs             # JSON <-> SaveModel, versioned
      SaveMigrator.cs               # nâng version save cũ
  ArtemisDomain.Tests/              # NUnit, chạy bằng dotnet test
    Fixtures/
      oracle-fixtures.json          # do tools/unity-parity sinh ra
    StatsParityTests.cs
    CombatParityTests.cs
    SpawnParityTests.cs
    RewardParityTests.cs
    SaveRoundTripTests.cs
  Assets/Artemis/                   # dự án Unity thật
    Core/ ... UI/ ... (xem SOURCE_AUDIT §6)
  Packages/manifest.json
  ProjectSettings/
```

`ArtemisDomain` nằm **trong** `unity-client/` để Unity có thể symlink/asmdef
trỏ tới, nhưng vẫn build độc lập bằng `dotnet build`.

---

## 4. Hợp đồng số học (điểm quyết định của toàn bộ migration)

JavaScript và .NET làm tròn **khác nhau**. Đây là nguồn sai lệch lớn nhất và
cũng dễ bỏ qua nhất.

| JS | .NET tương đương | Ghi chú |
|---|---|---|
| `Math.round(2.5)` → `3` | `JsMath.Round(2.5)` → `3` | .NET `Math.Round` → `2` (banker's) |
| `Math.round(-2.5)` → `-2` | `JsMath.Round(-2.5)` → `-2` | JS làm tròn về **+∞** tại .5 |
| `x.toFixed(2)` | `JsMath.ToFixed(x, 2)` | kết quả là **chuỗi**, sau đó `+` ép về số |
| `Math.min/max` | `Math.Min/Max` | giống nhau với `double` |
| `Number.isFinite` | `double.IsFinite` | |
| `parseInt(x, 10)` | `JsMath.ParseInt(x)` | `"3.9"` → `3`, `"abc"` → 0 |

Cài đặt `JsMath.Round`:

```csharp
// JS: Math.round(x) = floor(x + 0.5), với edge case -0
public static double Round(double x) => Math.Floor(x + 0.5);
public static long RoundLong(double x) => (long)Math.Floor(x + 0.5);
```

Kiểm chứng bằng test đối chiếu trực tiếp với Node:

```
Math.round(0.49999999999999994) === 0   (đặc biệt: floor(x+0.5) cho 1!)
```

→ Đây là **edge case thật**: `0.49999999999999994 + 0.5 === 1` trong double.
Phải xử lý riêng (JS engine hiện đại trả 0). Ghi vào test.

---

## 5. Luồng dữ liệu một trận

```
[Lobby]  SaveModel (từ GET /api/save)
   │
   ├─ PlayerStatsCalculator.Compute(save, chapter) → PlayerStats
   │
[Vào trận] RunSession.Begin(chapter)          ← tương đương DungeonSession.begin
   │
   ├─ RoomPlan.For(chapter, room, mode)        → {isBoss, enemyCount, types[]}
   ├─ EnemyStatFactory.Spawn(plan, playerStats, room) → [{hp, atk, speed}]
   ├─ BossStatFactory.Spawn(...)               (nếu isBoss)
   │
[Trong trận] tick(dt)
   ├─ InputReader → move intent → PlayerController
   ├─ CombatController: idle && cooldown<=0 → fire
   │     └─ ProjectileController (pool) → on hit:
   │           DamageCalculator.Resolve(req, rng) → DamageResult
   │           EnemyController.ApplyDamage(result)
   ├─ EnemyController → attack → IncomingDamageCalculator.Resolve(...)
   ├─ RoomController: enemies.Count == 0 → RoomCleared
   │     └─ CheckpointService.SaveIfAllowed(room < maxRooms)
   │
[Kết thúc] RewardService.Compute(victory, chapter, room) → {gold, gems}
   ├─ SaveModel ghi nhận (giữ nguyên tên field)
   ├─ SaveSyncService.Push()  → PUT /api/save {data, revision}
   └─ 409 → conflict UI; 422 → reload server data
```

**Điểm cưỡng chế:** `RewardService` và `EnemyStatFactory` **chỉ** nhận
`PlayerStats` đã tính, không đọc `SaveModel` trực tiếp. Nhờ vậy không có đường
tính thứ hai.

---

## 6. Định dạng dữ liệu tĩnh

Ba lựa chọn cho dữ liệu (18 hero, 42 gear, 72 skill, 46 rune, 46 artifact…):

| Cách | Ưu | Nhược | Chọn |
|---|---|---|---|
| Chép sang ScriptableObject bằng tay | type-safe | 250+ mục, sai sót cao, không kiểm chứng được | ✗ |
| Nhúng JSON sinh từ JS | **một nguồn sự thật**, diff được | cần bước sinh | ✓ |
| Đọc trực tiếp `index.html` lúc runtime | luôn đồng bộ | phụ thuộc file 32k dòng, không build được | ✗ |

**Chọn: JSON sinh tự động từ `index.html` bằng `tools/unity-parity/extract-data.mjs`.**
Mỗi lần web đổi dữ liệu, chạy lại script → diff JSON → Unity cập nhật. Đây là
cách duy nhất giữ 250+ mục khớp nhau mà không chép tay.

ScriptoreObject chỉ là **lớp bọc** quanh JSON đã sinh, để designer chỉnh visual.

---

## 7. Mạng & xác thực

```
ArtemisApiClient (UnityWebRequest)
  GET  /api/auth/me      → {authenticated, player}
  POST /api/auth/login   → Set-Cookie (WebGL) | {token} (Android, chờ duyệt)
  POST /api/auth/logout
  GET  /api/save         → {hasSave, data, revision, updatedAt}
  PUT  /api/save         → {ok, revision} | 409 | 422
```

Xử lý trạng thái bắt buộc:

| HTTP | Ý nghĩa | Hành vi Unity |
|---|---|---|
| 401 | phiên hết hạn | hiện cổng đăng nhập, **không** xoá save cục bộ |
| 409 | revision lệch | hiện hộp thoại "dữ liệu đã đổi ở thiết bị khác"; **không** tự ghi đè |
| 422 `ECONOMY_*` / `SEASON_*` | server từ chối | nạp `serverData` nếu có, hiện thông báo, không gửi lại mù |
| 429 | rate-limit | backoff theo `Retry-After`, không spam |
| 5xx | lỗi server | giữ dữ liệu trong RAM, thử lại có backoff, không mất tiến trình |

**Không bao giờ** gửi save khi chưa `GET /api/save` thành công (tránh ghi đè
bằng dữ liệu trắng — đúng lý do web có `__ARTEMIS_SAVE_READY`).

---

## 8. UI

- Desktop: 1920×1080 / 16:9, safe area.
- Mobile: 19.5:9 → 4:3, dùng `CanvasScaler` ScaleWithScreenSize 1080×1920 portrait.
- WebGL: canvas co giãn, không letterbox cứng.
- Một `UiBinder` duy nhất map `PlayerStats` + `RunState` → widget; không widget
  nào tự đọc `SaveModel`.
- Toàn bộ chữ tiếng Việt, cùng thuật ngữ với web (Phòng, Quái, Trùm, Chương,
  Hành Trình Tân Thủ, Mùa Giải…).

Danh sách màn hình bắt buộc: Main Menu, Auth, Hero Select, Chapter Select,
Combat HUD, Inventory, Equipment, Skills, Talents, Game Modes, Season, Dungeon,
Bestiary, Achievements, Beginner Journey, Settings, Pause, Defeat, Victory.

---

## 9. Hiệu năng (ngân sách, chưa phải cam kết)

| Chỉ số | Ngân sách | Ghi chú |
|---|---|---|
| Frame time (desktop) | ≤ 16.6 ms | |
| Frame time (Android mid-range) | ≤ 33 ms | |
| Draw calls | ≤ 80 | sprite atlas + SRP batcher |
| Texture memory | ≤ 128 MB | |
| WebGL build size | ≤ 40 MB (gzip) | |
| Network | ≤ 2 KB/giây trung bình | save debounce |
| Object pool | đạn/quái/particle đều pool | không `Instantiate` trong vòng lặp |

Không hứa FPS cụ thể khi chưa đo trên thiết bị thật.

---

## 10. Điều kiện tiên quyết để build

| Hạng mục | Trạng thái trên máy này |
|---|---|
| Unity Editor (LTS 2022.3 hoặc 6000.0) | ❌ **không có** |
| Unity Hub | ❌ không có |
| .NET SDK 8 | ✅ đã cài cục bộ (`/tmp/dotnet8`, dùng cho domain + test) |
| Node 24 | ✅ (oracle + sinh fixture) |
| Android SDK / JDK | ❌ không có |

→ Phase 1 chỉ có thể **viết source + chứng minh domain bằng test thật**. Việc
mở scene, bake light, build WebGL/APK là **blocked** và được ghi rõ, không được
báo là "đã build".
