# 01 — Kiến trúc và luồng tài khoản mới Artemis

## 1. Phạm vi, phiên bản và cách đọc

- Nguồn đối chiếu: baseline Git `3838b40`, nhánh `codex/artemis-new-player-hardening`; mô tả chính bên dưới là **working tree có các bản vá cục bộ**, chưa phải bản đã triển khai.
- Đây là bản đồ kiến trúc + nguồn đã audit, **không phải chứng nhận toàn bộ economy an toàn**. Công thức chỉ ghi khi đã đọc implementation; bảng sự kiện không bao quát mọi shop, gacha, guild hoặc sự kiện wiki.
- Tham chiếu `đường/dẫn:Lx-Ly` là dòng mã working tree tính từ root repo. Tên hàm là mốc ổn định hơn khi các thay đổi song song làm dịch dòng; nguồn baseline chỉ được dùng khi ghi rõ `3838b40`.
- Lượt lập tài liệu này chỉ đọc mã, diff và test; không chạy lại `npm test`, không đọc secret/`.env`, không gọi DB/API/server/production, không commit/push/deploy. Test được dẫn là **phạm vi assertion đã đọc**, không phải báo cáo đã chạy lại.
- Báo cáo chuyên đề bổ trợ: `auth-economy-findings.md`, `cloud-findings.md`, `gameplay-findings.md` trong cùng thư mục. Các số dòng/kết luận “trước vá” trong những báo cáo đó không thay thế nguồn hiện tại.

## 2. Thành phần và đường đi dữ liệu

```text
Trình duyệt / console / RNG / đồng hồ client: KHÔNG TIN CẬY
  public/cloud.js: auth gate, GET snapshot, owner binding, hàng đợi PUT
       ↕ window.__ARTEMIS_SAVE_BUFFER (JSON trong RAM, không phải kho bền)
  public/index.html: SaveState, combat, UI, giá, thưởng, ownership client
       → SaveState.save() → artemis:save → debounce → PUT /api/save
──────────── ranh giới mạng / xác thực / kiểm tra server ────────────
  lib/http.js + lib/auth.js: cookie JWT → player tồn tại trong DB
  api/save.js: owner từ session → sanitize → revision → delta validators
       → insert hoặc CAS → MongoDB saves {playerId, data, revision, ...}
  api/auth/* → MongoDB players; rate-limit → login_attempts
```

Nguồn: `public/cloud.js:L17-L38,L95-L106,L307-L399,L456-L511`; `public/index.html:L10254-L10331`; `lib/http.js:L49-L63,L70-L92`; `api/save.js:L8-L133`; `lib/mongo.js:L39-L52`.

**Hai nghĩa khác nhau của “authoritative”:** MongoDB giữ snapshot bền được server chấp nhận; **server chưa sở hữu sự thật của từng trận, RNG, giá mua và reward ledger**. Shape hợp lệ và ghi CAS thành công không chứng minh tài nguyên được kiếm hợp lệ (`api/save.js:L44-L97`; `lib/economy.js:L44-L99,L259-L266`).

## 3. Luồng tài khoản mới thực tế

Quy ước test: **C** = `tests/cloud-client-reliability.test.mjs`; **A** = `tests/cloud-save-api-reliability.test.mjs`; **G** = `tests/new-player-gameplay-runtime.test.mjs`. “Chưa E2E” nghĩa là không có chứng minh mạng/DB thật trong tài liệu này.

| Bước / hàm và nguồn | Input → output | Mutation / endpoint | Lỗi và retry thực tế | Test liên quan |
|---|---|---|---|---|
| 1. `boot()` — `public/cloud.js:L477-L502`; `GET` — `api/auth/me.js:L7-L30` | Cookie hiện tại → `authenticated`, public player, `hasSave`; chưa có phiên → gate đăng nhập | GET `/api/auth/me`; purge key local cũ, đặt `cloud-locked`. `me` đọc player/save, không cấp tài nguyên | GET/load reject → dựng gate + cảnh báo; chưa boot gameplay. Không có background retry auth | C:L166-L180 kiểm load; auth/register thực qua mạng: chưa E2E |
| 2. Submit `buildGate()` — `public/cloud.js:L228-L280` | Username trim + password → POST JSON; response có player → gọi load | POST `/api/auth/register` hoặc `/api/auth/login`; đặt authenticated/player trong RAM; guard disabled chặn submit trùng | Validation UI thiếu ký tự: không gửi; lỗi/reject → mở lại nút. Nếu register đã tạo player nhưng load thất bại, đăng ký lại có thể 409: dùng login/reload, không có transaction rollback đăng ký | C:L139-L164 kiểm single-flight và load reject |
| 3. Register `POST()` — `api/auth/register.js:L10-L60` | Credentials hợp lệ → 201 `{ok,player}` + cookie | `players.insertOne` usernameLower/displayName/hash/timestamps; rate-limit theo IP. **Không tạo canonical save** | 400 credentials/body; 429 quá 10 request/10 phút/IP; duplicate 11000 → 409; lỗi DB khác throw. Retry không có idempotency key | Test endpoint cô lập/chưa E2E đăng ký trong lượt này; boundary format: `lib/auth.js:L70-L95` |
| 4. Login/session — `api/auth/login.js:L7-L59`; `lib/http.js:L49-L63` | Credentials → 200 player + JWT; JWT sub → player DB | Cập nhật `lastLoginAt`; xóa counter login-user khi thành công. Cookie HttpOnly, SameSite=Lax, Secure khi production | 400 thiếu input, 401 sai credentials, 429 theo IP 30 hoặc user 15/10 phút. Cookie decode lỗi nay trả null; không thành phiên hợp lệ | `tests/auth-cookie-hardening.test.mjs:L5-L13`; chưa E2E login DB |
| 5. `loadCloudSave()` — `public/cloud.js:L307-L342`; `api/save.js:L8-L22` | GET xác thực → `{playerId,hasSave:false,data:null,revision:0}` khi chưa có save; có save → snapshot/revision | GET `/api/save`; khóa `__ARTEMIS_SAVE_READY`, chỉ thay buffer sau contract hợp lệ; owner nếu có phải trùng player; load xong mới mở ghi | 401 server; network/HTTP/JSON/contract sai reject và giữ buffer chưa ACK. Không biến lỗi thành new-account. Form cho thử lại hoặc reload | C:L48-L84,L104-L117,L166-L180; A:L87-L92 |
| 6. `startGame()` → reload → `SaveState.load()` — `public/cloud.js:L505-L518`; `public/index.html:L10046-L10113` | Buffer null → deep-copy defaults; string → parse/merge/normalize/migration | Trạng thái RAM tân thủ: 500 gold, 50 gems, 20 stamina, playerLevel 1; Alex 0 sao, bow archetype, spirit_sword; bag rỗng, sáu ô gear null | Parse/migration là logic client, không seed server. `SaveState.load` có thể chạy lúc parse nhưng `save()` khóa ghi trước ready. Nhánh legacy không đồng nghĩa nhánh tài khoản mới | C:L48-L72; G:L324-L340; defaults `public/index.html:L9802-L9815,L9833-L9927` |
| 7. `activateBeginnerJourney()` — `public/cloud.js:L264-L273`; `public/index.html:L25532-L25550` | Chỉ nhánh submit register thành công → startedAt, currentStep N01 | Reset các mảng journey khi lần đầu kích hoạt rồi `save()`. Login thông thường không gọi hàm này | startedAt > 0 → false/no-op. Register thành công nhưng chưa tới activation vì load lỗi không được bảo đảm tự kích hoạt ở lần login kế tiếp | G:L118-L167; không có test E2E ngắt giữa register/load/activation |
| 8. N01–N03 / `BeginnerHooks` — `public/index.html:L25566-L25622,L25668-L25723` | Hội thoại, room-clear, pickup → completedSteps/counter; claim riêng → currency | Room-clear cấp rusty_bow nếu chưa có vũ khí/cờ; ghi `starterWeaponGranted`. N03 lưu từng lượt nhặt, cap 10; reward claim dùng claimedRewards | Hoàn thành/claim trùng trả false; count lỗi bỏ qua. Starter độc lập tutorial active; room hook không nhận mode/chapter | G:L36-L61,L118-L167,L304-L340 |
| 9. Equip/upgrade/skill — `public/index.html:L32519-L32574,L25717-L25719` | UID đang sở hữu; gold/scroll; skill → gear hoặc run skill, N04/N05/N06 | Equip chuyển bag ↔ equipped; modal có chuyển level cao sang món mới. Upgrade trả phí trước hook; silent skill không hoàn thành N06 | UID không tồn tại/đang mặc → no-op; thiếu phí → không nâng cấp; selector không tạo gear từ preview | G:L63-L98,L169-L249; upgrade ba fixture ở L214-L224 |
| 10. `startNewRun()` → `finishRun()` — `public/index.html:L27188-L27279,L31659-L31720` | Chương/mode/client stats → session; kết quả client → thưởng, wins, gear, N07 | Run mới xóa checkpoint trừ continue, reset XP/level trong trận. Finish xóa checkpoint, save snapshot. N08 hội thoại hoàn tất, claim thưởng riêng | Chương khóa trong campaign → false; retry tạo run mới không rollback tài sản persistent. Không có chứng từ thắng trận do server phát | G:L118-L151 kiểm hooks/claims, không thay thế full combat E2E |
| 11. `SaveState.save()` → `scheduleSave()` — `public/index.html:L10254-L10331`; `public/cloud.js:L396-L399,L456-L467` | Các field writer liệt kê → JSON buffer + event | Không ghi trước ready; sau ready ghi RAM, debounce 1200ms → PUT `/api/save` | Serialize lỗi chỉ warn; `save()` không phải ACK DB. Mất tab có thể mất dirty; beforeunload dùng fetch thường, không bảo đảm delivery | G:L324-L340; C:L74-L102,L119-L137 |
| 12. `pushCloudSave()` / API `PUT()` — `public/cloud.js:L346-L393`; `api/save.js:L25-L133` | `{data,revision,playerId}` + cookie → revision kế tiếp hoặc lỗi | Sanitize, delta validators, update CAS hoặc unique insert. ACK đúng HTTP + next revision mới đánh dấu payload đã lưu; dirty mới hơn được giữ | 400 revision; 401 session; 409 revision/ACCOUNT_CHANGED; 413/415 body; 422 schema/economy/season; 429 rate-limit. Không tự merge conflict | A:L80-L141; C:L86-L137 |

**Khôi phục sau lỗi ghi:** network/ACK sai giữ dirty và lastError; không có vòng retry tự động vô hạn. ACK hợp lệ khi còn dirty mới schedule tiếp; event save mới hoặc `ArtemisCloud.pushNow()` có thể thử lại. Conflict yêu cầu tải lại; nhánh `ECONOMY_*` có serverData thay buffer và reload, có thể bỏ bản chưa ACK. Logout xóa buffer trước reload (`public/cloud.js:L361-L399,L415-L423,L521-L527`).

## 4. Trust boundary theo nhóm dữ liệu

| Dữ liệu | Nơi quyết định hiện tại | Server thực sự kiểm / lưu | Không được suy diễn |
|---|---|---|---|
| Identity, owner | Cookie/JWT + player DB; không lấy owner đích từ body | `getCurrentPlayer`; save query theo session playerId; playerId body optional chỉ để phát hiện đổi account (`lib/http.js:L49-L63`; `api/save.js:L25-L41`) | Optional field giữ tương thích client cũ, chưa bảo vệ mọi tab cũ khỏi đổi cookie |
| Gold / gems | Seed, drop, claim, shop và phản đòn do client tính | Clamp 0..1e12; lần sau giới hạn tăng 500000/20000 mỗi revision; heuristic earned; snapshot Mongo (`lib/saveSchema.js:L381-L382`; `lib/economy.js:L25-L99`) | Không ledger, không đối soát giá/sự kiện. **First-save và tự mint qua nhiều revision vẫn là P0 mở** |
| Stamina | Client mặc định/mutation các handler | Clamp 0..1e9 rồi lưu; không validator delta stamina (`lib/saveSchema.js:L383`; `api/save.js:L68-L97`) | Không có bảo đảm năng lượng được mua/hồi hợp lệ; không áp “mỗi trận mất 5” từ sweep sang startNewRun |
| Inventory / equipment / scroll / keys | Drop RNG, UID, equip, nâng cấp phía client | Sanitize item/bag/equipped/mixed records (`lib/saveSchema.js:L316-L320,L420-L435`) | Shape/UID hợp lệ không chứng minh item được cấp thật, không chứng minh đã trả phí; guard selector mới chỉ là client |
| Hero / pet | Alex khởi đầu; ownership hero theo sao/fallback, pet chọn trực tiếp | IDs chuỗi, stars/shards được clamp; snapshot (`lib/saveSchema.js:L387-L406`) | Không registry entitlement server; pet hiện không có mô hình sở hữu riêng. `isHeroOwned`: `public/index.html:L14190-L14200`; pet selector: L26449-L26455 |
| Cấp tài khoản / EXP | `playerLevel` persistent khác `Game.player.level/xp/xpNext` trong trận | playerLevel 1..999; không field EXP tài khoản trong writer. XP run khởi tạo 0, level 1, xpNext 80 (`lib/saveSchema.js:L384`; `public/index.html:L27274-L27278,L29422-L29428`) | Không tự đặt công thức account EXP. Pickup XP tăng cấp run, không cộng trực tiếp playerLevel; checkpoint cần xét riêng |
| Beginner journey | Events/completion/claimedRewards/timestamps do client tạo | Whitelist step, claimed phải thuộc completed, `_lootCount` 0..10 (`lib/saveSchema.js:L127-L153`) | “Đúng một lần” là idempotence state client, không proof event server; client vẫn có thể khai completed |
| Season | Client chọn nghề, sacrifice, HP boss, tokens | Schema season + so snapshot trước: step 2%, max 20%, chi phí đổi nghề và token ceiling (`lib/economy.js:L127-L284`; `api/save.js:L53,L86-L97`) | HP boss=0 do client báo không chứng minh combat; Projection và writer season đã vá hẹp, chưa xác thực nguồn reward, xem §5 |
| Revision | Server sở hữu revision ghi; client gửi expected revision | Safe integer ≥0; existing CAS; first-save insert; legacy thiếu revision dùng effective 1 (`api/save.js:L47-L62,L100-L133`) | Revision là concurrency token, **không phải số trận hoặc nguồn thu hợp lệ**; first-insert cần unique index thực tế |

Mongo khai báo `uniq_username`, `uniq_player`, `uniq_attempt_key`, TTL attempts; hiện lỗi tạo index ngoài 85/86 được ném ra thay vì nuốt. Chưa kiểm index DB thật, và giữ ngoại lệ 85/86 không đồng nghĩa đã chứng minh index triển khai đúng (`lib/mongo.js:L45-L60`).

## 5. Persistence: phân biệt RAM, writer, schema, ACK

- Writer hiện liệt kê `gold/gems/stamina/playerLevel`, selections, gear, stars/shards, scrolls/keys, `wikiEventsState`, lifetime/wins/achievements, beginner journey, starter flag và checkpoint; buffer JSON phát event, không tạo bản backup local bền (`public/index.html:L10267-L10327`).
- **Khoảng trống baseline đã xác nhận:** writer `SaveState.save()` từng không liệt kê `season`, `gameMode`, `modeBest`, `guild`, `garden`, `plinko`, dù handler sửa state và gọi save. Baseline `3838b40` cũng thiếu: không phải regression patch.
- **Parent đã tái hiện và vá riêng season:** thêm `season:this.season` vào writer hiện có; không tạo default mới hoặc đổi schema. `tests/save-writer-roundtrip.test.mjs` chạy writer thật→sanitizer với existing snapshot token120/sacrifice.04, giữ nguyên log/currency và qua validateSeasonDelta; legacy thiếu season không tự thêm field vào payload. RED1fail/1pass→GREEN2/2. Test API projection đơn lẻ trước đó không chứng minh được bước client này.
- `gameMode/modeBest/guild/garden/plinko` vẫn thiếu writer và output whitelist server. Vì vậy `SaveState.save()` ở các handler đó **chưa chứng minh tiến trình sống qua reload** (`lib/saveSchema.js:L375-L436`; `public/index.html:L14721-L14734,L15243-L15267,L31700-L31703`).
- Các khoảng trống còn lại là đối chiếu nguồn, chưa có round-trip runtime mới cho từng hệ. Chưa tự tạo schema/migration khi chưa chốt compatibility; xem P1 ART-021 trong `03-BUG-REPORT.md`.

## 6. Chế độ combat đã đọc

| Mode | Luật trong implementation | Reward / lưu ý |
|---|---|---|
| `campaign` | hasChapters, khóa theo chapter; maxRooms = ch.rooms | Finish thắng/thua dùng công thức ở §7; bestRooms/wins là client state |
| `endless` | endless, không chapter-lock; số phòng dùng 9999 | Finish thua dùng Game.room; không được tự gán “thắng chương” |
| `tower` | endless + bossOnly; số phòng dùng 9999 | Không có công thức thưởng tháp riêng trong finishRun đã đọc |
| `bossrush` | bossOnly, maxRooms = 5 | Finish thắng vẫn nhân **Game.chapter.id**, không nhân số boss trong công thức này |
| `practice` | endless + practice | Finish chặn cộng bonus gold/gems và bonus gear; **không đủ để chứng minh mọi nguồn reward bị chặn**, vì pickup gold/scroll đã đọc không có guard practice |

Nguồn mode: `public/index.html:L4327-L4388,L27201-L27235`; finish: L31670-L31720; pickup: L29416-L29443. Không dùng mô tả UI “không được gì” thay cho kiểm tra từng mutation; achievement/journey hooks cũng cần đánh giá theo mode riêng.

## 7. Economy sources / sinks đã đối chiếu

Quy ước persistence: **S** = field có trong writer + schema, phải chờ PUT ACK; **R** = chỉ run RAM trong đường đọc này, không bảo đảm checkpoint; **GAP** = state điều kiện không được serialize đầy đủ ở §5. “Client guard” không phải authorization server. `c = Game.chapter.id`, `r = Game.room`, `L = level item`.

| Event / nguồn | Currency / tài sản | Amount / công thức thực tế | Validation hiện có | Persistence / nguồn |
|---|---|---|---|---|
| Tạo default client | Gold, gems, stamina, playerLevel | 500; 50; 20; 1 | Nhánh no-save reset defaults, không canonical seed server | S sau lần save đầu; `public/index.html:L9833-L9839,L10058-L10067` |
| Kill → drops | Gold / EXP | greedMult = `1 + (talents.greed hoặc 0)*0.15`; mỗi quái thường tạo 2 cặp, boss 8 cặp; gold/drop = `round((e.isBoss ? 28 : 12)*greedMult)`; XP/drop = `round((e.isBoss ? 35 : 22)*greedMult)` | RNG và kill client; chưa có event proof server | Drops R; `public/index.html:L28309-L28324` |
| Pickup | Gold / EXP run / scroll | Gold = round(d.val*(1+goldBonus)); XP += d.val; đủ ngưỡng trừ xpNext, level++, xpNext = round(xpNext*1.25). Scroll += d.val hoặc 1 | Collision khoảng cách client; code XP dùng `if`, không tự đổi thành vòng while | Gold/scroll S tại save kế tiếp; XP R; `public/index.html:L29406-L29443` |
| Scroll combat | Cuộn theo slot | Chance = `(e.isBoss ? 1.0 : 0.28)*(1+(scrollDropBonus hoặc 0))`; số cuộn thường 2, boss 5 | RNG client, chọn slot ngẫu nhiên | S sau pickup/save; `public/index.html:L28336-L28347` |
| `finishRun` không practice | Gold / gems | Thắng: 350*c gold, 40*c gems; thua: 20*r gold, floor(2*r) gems | isVictory/chapter/room do client; server chỉ delta cap | S; `public/index.html:L31670-L31679,L31720` |
| Gear cuối run | Trang bị | 1 món random template nếu thắng hoặc room≥3; quality epic nếu thắng, rare nếu room≥8, còn lại uncommon; Lv1 | Không practice; không reward ledger/server RNG | S; `public/index.html:L31705-L31720` |
| Starter room-clear | Vũ khí | 1 `rusty_bow` qua makeStarterItem nếu chưa cờ và chưa có weapon bag/equipped | Client name/cờ/gear; không khóa tutorial hoặc chapter ở hook | S, patch ghi cờ; `public/index.html:L25668-L25705` |
| N01 / N02 / N03 / N04 | Gold, gems, scroll | N01 +100g; N02 +200g +10 gems; N03 +150g +2 scroll; N04 +250g +3 scroll | Complete và claim tách biệt; claimedRewards chặn nhận lại ở client | S; `public/index.html:L25433-L25472,L25591-L25622` |
| N05 / N06 / N07 / N08 | Gold, gems, scroll, key | N05 +300g +2 scroll; N06 +250g +15 gems; N07 +800g +50 gems +1 silver key; N08 +1000g +80 gems | Reward lấy bảng bước; scroll phân lần lượt +1 cho các slot tới hết số lượng, không mặc định tất cả vào weapon | S; `public/index.html:L25474-L25513,L25599-L25622` |
| Upgrade modal | Gold / scroll → item level | Trừ `80 + L*45` gold; scroll cost = max(1,min(25,ceil(max(1,Number(L) hoặc 1)/4))); level +1 | Kiểm item tồn tại và đủ hai phí; Lv1→2 mất 125 gold +1 scroll | S; `public/index.html:L18634-L18636,L32519-L32548` |
| Achievement claim | Gold / gems | `ACHIEVEMENTS[id].reward`; claim-all cộng reward các mục unlocked chưa claimed | Client unlocked + claimed timestamp; không chứng minh nguồn stat server | S; `public/index.html:L25376-L25420`; không liệt kê hết bảng achievement |
| Season sacrifice / đổi nghề | Token / powerSacrificed | +60 tokens mỗi +0.02 sacrifice, cap 0.20; đổi nghề hiện có khác nghề trừ 50 tokens | Client guard + server delta theo nấc/ceiling; chọn nghề lần đầu free | GAP season; `public/index.html:L14764-L14778,L14849-L14860`; `lib/economy.js:L175-L206,L263-L281` |
| Season boss | Tokens / gems / gold phản đòn | Damage cơ sở round((baseAtk hoặc 100)*42); khi killed +120 tokens +150 gems. Reflect = round(dmg*specialVal*0.5), chỉ trừ gold nếu đủ | Cơ chế reduction/regen/reflect client; server kiểm transition HP/token, không mô phỏng đòn | Gold/gems S, season GAP; `public/index.html:L14806-L14845` |
| Season shop | Tokens → gold/gems | 40→6000g; 80→200 gems; 150→12000g+300 gems | Client đủ token; validator không định giá từng món, chỉ chặn tăng token quá phép | Currency S, token GAP; `public/index.html:L14710-L14714,L14863-L14876` |
| Plinko | Gold | amount = Number(bet) hoặc p.bet hoặc 200; trừ amount, cộng round(amount*mult); mult theo bin `[8.5,3.2,1.3,0.67,0.35,0.67,1.3,3.2,8.5]`; đường đi RNG trái/phải 0.5 | Hàm đã đọc chỉ kiểm đủ gold; không được coi UI bet là validation server hoặc kết luận mọi input bet an toàn | Gold S, lịch sử/bet GAP; `public/index.html:L15205,L15225-L15267` |
| Garden exchange | Produce → gold/gems | Từng `GARDEN_SHOP` item: trừ từng cost, cộng give.gold/give.gems; không suy diễn bảng giá chưa trích | Client kiểm từng produce đủ | Currency S, produce GAP; `public/index.html:L14619-L14633` |
| Gold Cave ticket | Ticket → gold/scroll | -1 gold_cave_ticket; +25000 gold; +15 mỗi slot trong WIKI_GEAR_SCROLLS_META | Client kiểm ticket≥1; server không đối soát giao dịch | S wikiOtherItems/gold/scroll; `public/index.html:L18951-L18963` |
| Wiki campaign sweep | Stamina → gold/scroll/gear | Nếu stamina<5 tự đặt 50 khi huntingWarriorCard, nếu không 30; rồi -5. Gold = 6000 + chapterId*1200; +5 mỗi sáu loại scroll, 1 obsidian pull | Handler client không từ chối vì thiếu stamina, tự refill. Không nhầm với startNewRun | S stamina/gold/wikiEventsState; `public/index.html:L22678-L22694` |
| Debug viện trợ | Stamina / gold / gems | Refill đặt stamina=30 và +300g; nút gold +500g; nút gems +50 | Patch local-origin + opt-in DEV_CHEATS; không phải quyền server/admin | S nếu gọi save; `public/index.html:L6434-L6452,L32214-L32238` |

**Chưa bao quát:** toàn bộ gacha/pity/chest pools, mua hàng, hoàn cấp/salvage/merge, guild/expedition, mọi milestone/weekly/daily/event ticket và toàn bộ đường checkpoint/continue. Không lấy bảng này làm tổng cung tài nguyên hoặc proof không còn faucet khác.

## 8. Baseline khác bản vá cục bộ ở đâu?

| Hạng mục | Baseline `3838b40` | Working tree đã đọc | Nguồn / regression target |
|---|---|---|---|
| Load và submit | Lỗi load có thể thành no-save; submit/promise chain không chặn đủ | Fail-closed, contract/owner GET, return load promise, chặn submit trùng | `public/cloud.js:L228-L280,L307-L342`; C:L139-L180 |
| PUT client | PUT chồng; ACK có thể xóa dirty mới; hash collision bỏ write | Single-flight; exact payload; ACK HTTP + next revision; giữ dirty mới | `public/cloud.js:L346-L393`; C:L86-L137 |
| PUT server | Revision thiếu có thể bỏ guard; check/write tách; projection thiếu season | Revision bắt buộc safe integer, CAS/unique insert, projection season, owner mismatch 409 | `api/save.js:L38-L62,L100-L133`; A:L80-L141 |
| Journey / starter / selectors | Mất counter dưới 10 qua schema; cờ starter không serialize; selector tạo/biến gear; hero bypass | Counter lưu và clamp; writer cờ; selector chỉ item sở hữu; Alex 0 sao luôn chọn lại; copy N04/N08 đúng | `public/index.html:L10312-L10313,L14190-L14200,L25668-L25723,L26339-L26428`; `lib/saveSchema.js:L151-L152`; G:L36-L249 |
| Dev / auth / index | Opt-in dev trên mọi host; cookie malformed throw; index errors bị nuốt | Dev chỉ local/file; malformed cookie null; allSettled giữ rejection, ngoài 85/86 throw | `public/index.html:L6434-L6448`; `lib/auth.js:L45-L59`; `lib/mongo.js:L45-L60`; G:L252-L301; `tests/auth-cookie-hardening.test.mjs:L5-L13`; `tests/mongo-index-hardening.test.mjs:L1-L20` |
| Economy authority / persistence gaps | Không canonical seed/ledger; thiếu field writer ở §5 | **Chưa được đóng bằng các patch trên**; không migration tài khoản nào được chứng minh/cho phép ở đây | `api/auth/register.js:L28-L35`; `lib/economy.js:L44-L99`; writer `public/index.html:L10267-L10318` |

## 9. Điều kiện đọc kết quả và rủi ro còn mở

1. **P0 first-save:** register chỉ tạo player; sanitize clamp gold/gems tới 1e12 rồi first-save validator chấp nhận trong hard cap. Seed hiển thị 500/50 không được server cưỡng chế (`lib/saveSchema.js:L381-L382`; `lib/economy.js:L44-L55`).
2. **P0 mint theo revision:** PUT truyền revisionDelta=1; một revision cho tăng tới 500000 gold/20000 gems mà không có event ledger. CAS chỉ đóng race, không đóng mint lặp; rate-limit 60 PUT/phút/player không là authorization (`api/save.js:L33-L34,L68`; `lib/economy.js:L58-L82`).
3. **Durability chưa đầy đủ:** field có S vẫn cần ACK; tab crash/logout/network có thể mất dirty. GAP ở §5 và reward practice ở §6 cần regression có chủ đích, không bị che bởi kết quả unit test API.
4. **Auth chưa revocation:** logout xóa cookie, không thu hồi JWT đã phát; `getCurrentPlayer` không kiểm session version/passwordChangedAt. Không kết luận reset mật khẩu vô hiệu hóa mọi phiên (`lib/auth.js:L27-L41`; `lib/http.js:L49-L63`; `api/auth/logout.js:L6-L13`).
5. **Mức bằng chứng:** C chạy cloud source trong VM; A dùng API source với seam auth/DB fixture, không Mongo thật; G chạy các block/handler production với dependency fixture. Browser fixture trong báo cáo gameplay là bổ sung riêng, không production và không tự nhiên vượt toàn chương.
6. **Không mở rộng tuyên bố:** API season test không tự cover writer; parent đã thêm writer round-trip regression riêng ở §5; test guard client không proof API entitlement; sanitizer không chứng nhận công thức reward đúng; tài liệu này không thay thế migration canonical seed/reward ledger và audit economy toàn diện.
