# RISK REGISTER — Artemis Unity Migration

Thang điểm: **Xác suất** (1–5) × **Tác động** (1–5) = **Điểm**.
Xử lý: ≥15 chặn tiến độ; 8–14 phải có kế hoạch; <8 theo dõi.

| # | Rủi ro | XS | TĐ | Điểm | Kế hoạch giảm thiểu | Trạng thái |
|---|---|---|---|---|---|---|
| R01 | Làm tròn JS vs .NET làm lệch ATK/HP → TTK khác | 5 | 5 | **25** | `JsMath.Round/ToFixed` + test đối chiếu Node ngay trong CI | Đã có giải pháp |
| R02 | Xác thực Android không dùng được cookie HttpOnly | 5 | 5 | **25** | Phương án A (Bearer) — **cần phê duyệt**; chưa duyệt thì Android blocked | **Chờ quyết định** |
| R03 | Không có Unity Editor → không chứng minh được gameplay chạy | 5 | 4 | **20** | Domain C# compile+test bằng `dotnet`; phần engine ghi rõ "chưa build" | **Blocked (một phần)** |
| R04 | Port sai thứ tự pipeline `hurtPlayer` (gộp phép giảm) | 4 | 4 | 16 | Mirror 9 bước, test từng bước với 1000 tổ hợp | Đã có kế hoạch |
| R05 | Passive hero/boss cộng sát thương *sau* finalDmg bị port thành *trước* | 4 | 4 | 16 | `IAttackModifier.PostHit` tách riêng + test riêng từng passive | Đã có kế hoạch |
| R06 | Unity gửi save có `season` sai → 422 → mất tiến trình ván | 3 | 5 | 15 | `SeasonDeltaValidator` mirror chạy trước PUT; test bằng chính test case của JS | Đã có kế hoạch |
| R07 | Chép tay 250+ mục dữ liệu → sai lệch âm thầm | 4 | 4 | 16 | Sinh JSON từ `index.html`, không chép tay; có test đếm số mục | Đã có giải pháp |
| R08 | Unity WebGL phục vụ khác origin → cookie bị chặn | 3 | 4 | 12 | Bắt buộc cùng origin (`/unity/` trên Vercel) | Đã có kế hoạch |
| R09 | `dt` khác nhau giữa web (giây thực) và Unity (`Time.deltaTime` bị clamp) → nhịp bắn lệch | 3 | 3 | 9 | Cùng chính sách clamp `dt`, test đo ASPD thực tế | Đã có kế hoạch |
| R10 | Dùng `Rigidbody2D` động → quán tính, cảm giác khác web | 4 | 2 | 8 | Kinematic + tự giải va chạm theo trục | Đã có kế hoạch |
| R11 | `Physics2D` tự pierce khác `hitSet` của web | 3 | 3 | 9 | Giữ `HashSet<int>` instanceID, tắt auto-collide | Đã có kế hoạch |
| R12 | Vô tình sửa `public/` hoặc `lib/` khi migrate | 2 | 5 | 10 | Nhánh riêng; 36 test web làm hàng rào; review diff | Đã có giải pháp |
| R13 | Commit nhầm secret / `.env` | 2 | 5 | 10 | `.gitignore` đã chặn `.env*`; không đọc/ghi secret; review trước commit | Đã có giải pháp |
| R14 | Commit build artifact (`Library/`, `Build/`) | 3 | 3 | 9 | `.gitignore` cho Unity trước khi tạo project | Cần làm |
| R15 | Dữ liệu người chơi production bị đụng | 1 | 5 | 5 | Không kết nối Mongo production; chỉ GET; không có script ghi | Đã có giải pháp |
| R16 | Tài khoản mới hiện chỉ số tài khoản cũ (bug `localStorage` cũ) | 2 | 4 | 8 | Không cache save trên đĩa; save luôn gắn `playerId` | Đã có kế hoạch |
| R17 | `int` overflow khi cộng ATK lớn | 2 | 3 | 6 | `long` cho trung gian | Đã có kế hoạch |
| R18 | Boss HP bị nhân thêm `roomMul` (hiểu sai) | 3 | 3 | 9 | Test riêng: HP boss độc lập với số phòng | Đã có kế hoạch |
| R19 | Chọn loại quái bằng random thay vì modulo tất định | 3 | 3 | 9 | Port đúng `(room + i) % len`; test snapshot | Đã có kế hoạch |
| R20 | `garden`/`plinko` tưởng là bền vững nhưng server lọc | 3 | 2 | 6 | Ghi rõ trong audit; UI nói "không lưu" | Đã ghi nhận |
| R21 | Unity version không khớp → asmdef/API lỗi khi mở | 4 | 3 | 12 | Khoá `ProjectVersion.txt` = 2022.3 LTS; ghi yêu cầu | Cần làm |
| R22 | Android build thiếu JDK/NDK | 5 | 3 | 15 | Ghi blocked; không hứa APK | **Blocked** |
| R23 | Test parity dùng fixture "tự bịa" thay vì save thật | 3 | 4 | 12 | Fixture sinh từ oracle chạy trên save tổng hợp + save trắng | Đã có giải pháp |
| R24 | Sửa test cho pass thay vì sửa code | 2 | 5 | 10 | Cấm nới tolerance; reviewer kiểm tra diff test | Quy tắc |
| R25 | Đổi cân bằng khi "thấy khó quá" | 3 | 4 | 12 | Cấm đổi hằng số; mọi thay đổi phải qua `docs/COMBAT_FORMULAS.md` | Quy tắc |

## Rủi ro cao nhất cần người quyết định

**R02 (xác thực Android)** — không thể tự quyết vì nó đụng bảo mật production.
Ba phương án ở `SOURCE_AUDIT.md` §3. Cho tới khi có phê duyệt, Android nằm ngoài
phạm vi và mọi tuyên bố "chạy trên Android" đều bị coi là sai.

**R03 (không có Unity Editor)** — không thể giảm thiểu bằng code. Cách duy nhất
là tách domain để *phần lớn* rủi ro được kiểm chứng, và **nói thẳng** phần còn
lại chưa được kiểm chứng.
