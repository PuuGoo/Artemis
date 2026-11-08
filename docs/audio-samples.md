# Âm thanh thật cho chiến dịch (nguồn: bản build Unity)

## Nguồn và cách trích

Âm thanh lấy từ `split_UnityDataAssetPack-2.apk` (3 APK của bản build Unity 2022.3.62f2). Mỗi `AudioClip` được đọc qua `UnityPy` cùng sidecar `.resource`, xuất WAV gốc rồi mã hoá lại **MP3 mono 22050 Hz 64 kbps**. Tổng 237 clip trích được; 23 mẫu được chọn vào game.

Không chạy mã nhúng, không gọi endpoint từ asset, không đọc credential. Đây là trích xuất phục vụ học tập theo yêu cầu của chủ dự án.

## Bộ mẫu trong game

| Slot | File | Nguồn gốc | Thời lượng |
|---|---|---|---|
| `shootBow` | `shoot_bow.mp3` | `poly_shoot_arrow` | 0,26s |
| `shootStaff` | `shoot_staff.mp3` | `poly_shoot_magic` | 0,70s |
| `shootClaw` | `shoot_claw.mp3` | `poly_shoot_bone` | 0,47s |
| `hitNormal` | `hit_normal.mp3` | `Hitted_Body02` | 0,32s |
| `hitCrit` | `hit_crit.mp3` | `Hitted_Stone` | 0,76s |
| `hitSkeleton` | `hit_skeleton.mp3` | `hitted_skeleton` | 0,70s |
| `hitGhost` | `hit_ghost.mp3` | `Hitted_Ghost` | 0,81s |
| `enemyDeath` | `enemy_death.mp3` | `Death_Monster01` | 0,84s |
| `bossDeath` | `boss_death.mp3` | `Death_Stone` | 2,12s |
| `playerHurt` | `player_hurt.mp3` | `Hitted_Body01` | 0,68s |
| `coin` | `coin.mp3` | `Button_Click_Coins` | 0,52s |
| `levelUp` | `level_up.mp3` | `level_up` | 2,20s |
| `portal` | `portal.mp3` | `DoorOpen2` | 1,18s |
| `bossSpawn` | `boss_spawn.mp3` | `SkillStart_StoneBoss` | 1,44s |
| `victory` | `victory.mp3` | `PveVictory` | 2,17s |
| `uiClick` | `ui_click.mp3` | `Button_Click_Small` | 0,06s |
| `uiOpen` | `ui_open.mp3` | `Button_ShowPop` | 0,13s |
| `skillFire` | `skill_fire.mp3` | `SkillStart_Fire` | 0,65s |
| `skillIce` | `skill_ice.mp3` | `SkillStart_Ice` | 0,67s |
| `skillPoison` | `skill_poison.mp3` | `SkillStart_Poison` | 1,20s (cắt từ 3,5s + fade 0,3s) |
| `skillHeal` | `skill_heal.mp3` | `SkillStart_RecoverHP` | 1,23s |
| `skillSword` | `skill_sword.mp3` | `SkillStart_Sword1` | 0,44s |
| `skillArrow` | `skill_arrow.mp3` | `SkillStart_Arrow1` | 0,35s |

**Tổng 228 KB** cho cả 23 file — nhỏ hơn một ảnh PNG trong game. `manifest.json` giữ ánh xạ slot → file → clip gốc → thời lượng.

## Thay đổi trong engine

- `SoundFX` có `preload()` nạp song song toàn bộ mẫu, giải mã bằng WebAudio; **thiếu file hoặc lỗi mạng thì tự rơi về synth cũ**, không im lặng và không ném lỗi.
- `playClip()` giữ hai ngân sách voice tách biệt: **12 tiếng ngắn** (bắn/trúng/chết) và **5 tiếng dài** (thắng, lên cấp, cổng, trùm xuất hiện). Nhờ vậy một tiếng thắng dài không làm tắt tiếng chiến đấu, mà spam vẫn bị chặn.
- Mỗi slot có `minGap` riêng nên cùng một mẫu không chồng lên nhau thành tiếng "máy khâu".
- Khi bị chặn bởi minGap hoặc hết voice, không phát synth thay thế. Chỉ thiếu mẫu/lỗi khởi tạo mới dùng synth; thời điểm 0 là giá trị hợp lệ. Voice được giải phóng một lần khi kết thúc, start lỗi không giữ mất suất.
- `SoundFX.muted` chặn ở tầng `playClip`, không tạo nguồn phát nào.
- Gọi `preload()` trong `startNewRun()` — sau thao tác người chơi, đúng chính sách autoplay của trình duyệt.

Sự kiện mới được nối: hạ địch thường/trùm (`onEnemyKilled`), thắng trận (`finishRun`), chọn kỹ năng (`applyRogueSkill`). Các sự kiện cũ (bắn, trúng đòn, nhặt vàng, lên cấp, cổng, trùm xuất hiện) tự động dùng mẫu thật.

## Kiểm chứng

- **6 test** `tests/audio-samples.test.mjs`: từng file tồn tại, đúng magic MP3, thời lượng hợp lệ; VM kiểm mẫu thật/synth dự phòng, minGap tại thời điểm 0, voice ngắn/dài độc lập, giải phóng idempotent, start lỗi và tắt tiếng.
- **Chrome thật** (`tools/verify-audio-browser.mjs`, mock auth/save localhost): nạp **23/23** mẫu, AudioContext ở trạng thái `running`, **23 yêu cầu MP3 đều 200**, không file 404.
- Mỗi sự kiện được gọi và xác nhận **phát mẫu thật, không rơi về synth** — kể cả hit thường, hit chí mạng và 6 loại kỹ năng.
- Tắt tiếng: **0 nguồn phát** được tạo.
- Chrome: gọi hitEnemy 100 lần liên tiếp chỉ tạo **1 nguồn phát, 0 synth**. Phép đo đếm AudioBufferSource.start thật, không suy diễn từ giá trị trả về playClip.
- 0 lỗi JS, 0 tài nguyên local lỗi.
- Toàn suite tuần tự (integration opt-in tắt), `npm run check` và `git diff --check`: exit 0. Không xác minh DB/production.

## Giới hạn

- Chưa **nghe đánh giá thẩm mỹ**: máy phân tích xác nhận file hợp lệ và phát được, không xác nhận gu âm thanh. Cần người nghe thật để chốt.
- Mẫu lấy từ bản build của Habby; **quyền phân phối chưa được xác minh**. Dùng cho học tập/nội bộ theo uỷ quyền của chủ dự án; phát hành công khai cần giấy phép.
- Chưa làm nhạc nền chiến dịch liên tục (loop, crossfade, giảm âm khi vào trận) — hiện chỉ có hiệu ứng rời.
- Không đổi cân bằng, save, quyền sở hữu hay tiến trình. Không thêm file nào ngoài `public/assets/audio/`.
