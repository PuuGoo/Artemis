# Artemis — kiểm kê kết quả thưởng sự kiện / minigame

## Đã tích hợp (presentation-only)

| Entry point thực | Dữ liệu hiển thị | Thời điểm |
|---|---|---|
| `renderGemTool` → `btnCraftRandomGem` | Đúng `pick` đã cộng vào `gemInventory`, 1 viên | Sau trừ 2 salvage + 100 gold, save và render |
| `plinkoPlay` (đơn) | `win` từ chính `path` và multiplier đã quyết toán | Sau debit/credit/save; thiếu vàng không popup |
| `plinkoStartBatch` (200 bóng / stop / hết vàng / rời bảng) | Một dòng cho mỗi `res` đã quyết toán, không suy lại từ histogram, không bỏ bóng cuối | Một popup sau save kết thúc batch; không popup cho batch rỗng |
| `renderArtifactsSubtabUI` → `btnWishPull10` (legacy) | Những lần tăng sao thực, tên/rarity/art từ `randArt` | Sau save/render; sao chạm 15 không giả lập thêm thưởng |
| `btnCampaignSweepClear` | Gold, sáu scroll ×5 và đúng gear từ giá trị trả về của `rollSingleCanonicalChestPull` | Sau save/render; điều kiện năng lượng/VIP giữ nguyên |
| `finishGoldCaveRun` → cashout hoặc túi cuối | Gold cap 25000, scroll cap 24/mỗi loại đã chuyển từ escrow vào tài khoản | Chỉ sau quyết toán; không coi bonus trong `run` ở túi trung gian là vàng đã nhận |
| `btnIslandRollDice` | Điểm Otta, Gems, Treasure Coin gồm cả bonus vượt vòng | Sau save/render; giữ RNG, multiplier và chi phí hiện có |
| `btnFishingReelIn` | Vé từ cá `hk` vừa kéo, tên/kg đúng cá cũ, không lấy cá tiếp theo | Sau cộng vé/save/render |
| `btnFishingCast10` | Hai loại vé đã được cấp; kg trong subtitle | Sau quyết toán cố định; không bịa 10 con cá ngẫu nhiên |
| `doDemonSpins` → ×1/×10 | Một dòng/lượt, đầy đủ Eon, badges mọi lượng, Chromatic Key, Promised Shovel | Sau toàn bộ debit, pity, grants, save/render; không thêm RNG |
| `data-claim-demon-milestone` → nhánh `s_gear` | Chính gear đã được trả về, không giả định Epic/S-Tier từ nhãn mốc | Sau save/render |
| `public/campaign-wheel.js` → `open` / `showReward` | `session.reward` theo receipt deterministic hiện hữu | Chỉ sau `persist` thành công và animation/skip; chặn reveal callback trùng |

## Phạm vi do agent khác phụ trách (không sửa trong phần việc này)

- Head/module dùng chung `ArtemisRewardResults`.
- `executeWikiOtherItemAction`: wish đơn/batch, dice legacy Monopoly, balloon Bingo; nhánh arena random shard cũng nằm trong hàm này.
- `executeRuneRuinsDig`: server-issued `result.drops`, gồm Promised/normal và các entry point từ bàn/event/items.
- Shop wish handler.
- Equipment chest `executeCanonicalChestPull`: dùng `ArtemisChestResults` đã có.

## Đã kiểm kê, cố ý không gắn popup random-reward

- `rollSingleAffix`, reforge/unlock affix: sửa chỉ số trang bị hiện có, không phải draw thưởng vật phẩm; UI reforge đã sở hữu bảng kết quả.
- `btnSkyTowerClearRoom` random Valkyrie skill: lựa chọn/nâng skill trận đấu, không random purchase/reward inventory.
- Arena challenge (cả hub và arena/guild mô phỏng), Seal boss, combat kill/drop, run-end gear, stage loot: kết quả chiến đấu, không draw mua thưởng. Random opponent/rank/power/guild-member seed không phải thưởng.
- Talent random-upgrade (`upgradeRandomTalent`, batch variants): progression tài năng, không thưởng draw/minigame.
- `createFreshRuneRuins3x3Board` shuffle: chuẩn bị bàn; settlement thực đi qua server dig ở agent khác.
- `createFreshWorldTreeGrid` và `data-wt-cell`: mẫu board cố định theo chỉ số; pickaxe/bomb/drill/free chest đều cấp Shamrock/Gold Pot cố định theo số ô, không RNG. Không có hidden random mine payout khác trong script hiện tại.
- Treasure Island có nhãn Fate Wheel/Point Slots trên board nhưng không có handler spin riêng: handler xúc xắc chỉ cấp ba loại thưởng như bảng trên. Không tạo popup cho tính năng chỉ có nhãn.
- Fishing cast/reset/hook generation/snap: chưa quyết toán cá/tiền; chỉ reel mới trả vé. Snap trả dây cố định, không random payout.
- Gold Cave intermediate bags: random chọn luckyBag chỉ cập nhật escrow. Cashout/final đã bao phủ; sweep 10 là cố định.
- Fixed shops, milestone/task/carnival/daily/weekly/login rewards, ad/ticket bundles và dev cheats: không random.
- Demon mốc `leg_artifact`, `leg_rune`, `leg_blessing_rune`: source hiện chỉ đánh dấu claimed và toast, không có lệnh cấp vật phẩm tương ứng. Cố ý không bịa thành công hoặc RNG mới. Nhánh `s_gear` thực có grant được bao phủ.
- Các random khác trong index: UID, merge UID, simulation, particles/art/camera/combat proc — không phải draw thưởng.
- Đã quét toàn bộ `public/*.js`: RNG ngoài index chỉ còn combat damage/loot, monster art seed, patrol request UUID; campaign wheel dùng receipt deterministic. Không có spin/minigame reward khác trong những script này.

## Các bất thường có sẵn được giữ nguyên theo yêu cầu presentation-only

- Legacy Artifact nút ×10 thực chạy 3 lựa chọn, có clamp Wish Token tối thiểu 99; popup chỉ phản ánh tăng sao thực chứ không bịa 10 vật phẩm.
- Demon, Island và Fishing có nhánh tự refill tiền/vé/mồi khi thiếu; không thay đổi economy này.
- Demon milestone có nhãn random legendary nhưng không grant; `s_gear` thực gọi chromatic pull thông thường, không đảm bảo S-Tier như copy.
- Phần lớn local event handlers gọi `SaveState.save()` buffer (không await HTTP acknowledgment). Không thể tuyên bố server persistence đã xác nhận chỉ từ unit test. Integration bám đúng settlement hiện hữu; không tạo API/reroll mới. Campaign wheel có ack riêng và được test fail/retry.

## Xác minh thực thi

`node --test tests/event-reward-results.test.mjs`: 17/17 pass ở thời điểm kiểm tra.

Tests chạy trực tiếp code handler trích từ source, không chỉ grep: RNG call counts, exact debit/grant, mọi Demon outcome + pity, Plinko 200/partial/stop/tab exit/insufficient, artifact cap, island lap, Gold Cave capped escrow/idempotent cashout, cá vừa reel so với cá kế, fixed quick-fish, sweep actual gear + blocked entry, random-gem cost + refused craft, milestone actual gear và no fabricated rune, wheel persist failure/retry và actual DOM callback skip/repeated timer. Tất cả inline classic scripts parse bằng `vm.Script`.

`git diff --check`: pass (chỉ cảnh báo line ending LF/CRLF). Chưa xác minh visual/browser/mobile, live authenticated server save hay deployment trong phần việc này. Shared module/browser acceptance do agent chủ quản tiếp tục.

Files thuộc phần việc này: patch các handler trong `public/index.html`, patch `public/campaign-wheel.js`, tạo `tests/event-reward-results.test.mjs`, tạo tài liệu này. Không commit; không đọc secrets.
