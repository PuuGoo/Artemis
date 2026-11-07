# 15 — Đợt 6: campaign dùng độ khó TUYỆT ĐỐI

Bản vá này hiện thực đề xuất ở `13-GAME-BALANCE-MEASURED.md` §4 (đã được duyệt).
Đây là **thay đổi cân bằng thật** — lần đầu tiên sau toàn bộ đợt audit.

## 1. Vấn đề đã đo

| Đo được trước bản vá | Hệ quả |
|---|---|
| ATK 152 → 5934 (**39×**) nhưng TTK chỉ **0,61s → 0,31s** (1,96×) | Nâng đồ gần như không giúp giết nhanh hơn |
| HP 775 → 19489 (**25×**) nhưng số đòn chịu vẫn **16,1** | Nâng đồ gần như không giúp sống lâu hơn |
| Hồ sơ tân thủ đứng ở C5-P1 | Vẫn chịu đúng **16,1 đòn** như ở C1 |

Nguyên nhân: `enemyHp = playerAtk × hits` và `enemyAtk = playerMaxHp / hits`. Chỉ số
người chơi bị triệt tiêu ngay trong công thức.

## 2. Đã thay đổi

Thêm bảng tuyệt đối theo chương trong `public/index.html`:

```js
const CAMPAIGN_TUNING = {
  1: { mobHp: 300,  mobAtk: 70,  bossHp: 5200,  bossAtk: 190 },
  2: { mobHp: 520,  mobAtk: 95,  bossHp: 9000,  bossAtk: 260 },
  3: { mobHp: 820,  mobAtk: 130, bossHp: 15000, bossAtk: 350 },
  4: { mobHp: 1250, mobAtk: 220, bossHp: 33000, bossAtk: 460 },
  5: { mobHp: 1750, mobAtk: 380, bossHp: 34000, bossAtk: 600 },
  6: { mobHp: 2400, mobAtk: 520, bossHp: 48000, bossAtk: 760 },
};
```

Độ sâu trong chương vẫn tăng dần: `mobHp ×(1+depth×1.2)`, `mobAtk ×(1+depth×0.5)`,
`bossHp ×(1+depth×0.35)`, `bossAtk ×(1+depth×0.3)`.

**Phạm vi áp dụng:** chỉ chế độ có chương (`hasChapters === true`, tức Chiến Dịch).
Vô Tận / Tháp / Săn Trùm / Luyện Tập **giữ nguyên** công thức thích ứng cũ vì độ sâu
vô hạn nên phải neo theo người chơi — có test khoá riêng cho việc này.

## 3. Kết quả đo lại (simulator chạy thật, 19/19 bất biến)

| Hồ sơ | ATK | C1 TTK | C1 số đòn chịu | C6 TTK | C6 số đòn chịu |
|---|---:|---:|---:|---:|---:|
| A. Tân thủ | 152 | 0,79s | 11,1 | 6,3s | 1,5 |
| E. Cuối chương 1 | 1073 | 0,14s | 61 | 0,9s | 5,7 |
| F. Người cũ (mythic Lv.100) | 5934 | 0,03s | 279 | 0,2s | 26 |
| G. Yếu ở chương cao | 164 | 0,74s | 11,8 | 5,9s | 1,6 |

So sánh trực tiếp với trước bản vá:

| Chỉ số | Trước | Sau |
|---|---|---|
| ATK ×39 giảm TTK | 1,96× | **76,5×** |
| HP ×25 tăng số đòn chịu | 1,0× (16,1 → 16,1) | **25,3×** |
| Yếu ở C5-P1 chịu được | 16,1 đòn | **2,0 đòn** |
| Tân thủ hạ 1 quái C1 | 1,4 đòn | **2,0 đòn** |
| Trùm cuối C1 (hồ sơ A) | 20,0s | **23,1s** |

Trùm theo hồ sơ đúng tầm chương: C1 23,1s · C2 37,0s · C3 15,7s · C4 13,7s · C5 12,7s · C6 17,9s
— tất cả trong dải 10–60s. Đồ tân thủ gặm trùm C6 mất **172s** → đúng là cổng tiến trình.

## 4. Kiểm chứng

`tests/campaign-difficulty.test.mjs` — **5/5 pass**:

1. Bảng có đủ 6 chương, mọi giá trị dương.
2. **Đơn điệu:** chương sau khó hơn chương trước trên cả 4 chỉ số.
3. HP/ATK địch chiến dịch **không** tham chiếu `playerAtk`/`playerMaxHp`; nhánh
   thích ứng vẫn còn nguyên cho Vô Tận.
4. Chỉ `hasChapters: true` mới dùng bảng tuyệt đối; 4 chế độ vô hạn giữ `false`.
5. Chạy **thật** `tools/combat-sim.mjs`, đòi `0 FAIL` và các kết luận then chốt.

`tests/combat.test.mjs` được cập nhật: các assertion cũ khoá đúng hành vi thích ứng
(`playerAtk * atkMul * scale`) nay chuyển sang kiểm bảng tuyệt đối, đồng thời **vẫn**
giữ assertion cho nhánh Vô Tận để không ai xoá nhầm.

Full suite: **202 test — 200 pass / 0 fail / 2 skip**.

## 5. Rủi ro và cách rollback

- **Chưa playtest người thật.** Toàn bộ số trên là mô hình TTK/số đòn, không phải win rate.
  Con số có thể cần chỉnh sau khi có người chơi thật.
- Bảng số nằm ở **một chỗ duy nhất** (`CAMPAIGN_TUNING`); muốn nới/tighten chỉ sửa đó rồi
  chạy `node tools/combat-sim.mjs` để xem lại toàn bộ hệ quả.
- Rollback: đặt `usesCampaignTuning()` trả `false` là toàn bộ chiến dịch quay lại công thức
  thích ứng cũ, không cần revert code. Không đụng dữ liệu người chơi.
- Không thay reward table, rarity, drop rate hay giá nâng cấp trong cùng bản vá.
- Save cũ **không bị sửa**: chỉ cách tính trận đấu thay đổi.
