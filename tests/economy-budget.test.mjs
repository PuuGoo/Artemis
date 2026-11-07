// Khoá lại: KHÔNG thể mint vàng/đá quý bằng snapshot tự khai (P0).
//
// Lỗ hổng cũ: mỗi lần lưu cho phép client tự khai +500.000 vàng và +20.000 đá quý
// (validateEconomyDelta). Bốn lần lưu là mint 2.000.000 vàng + 80.000 đá mà không
// chơi trận nào.
//
// Nay server giữ NGÂN SÁCH nạp theo ĐỒNG HỒ SERVER (lib/economyLedger.js), nên trần
// thu nhập phụ thuộc THỜI GIAN ĐÃ CHƠI, không phụ thuộc số lần lưu.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEconomyBudget, refillLedger, freshLedger,
  RATES, BURST_SECONDS, MAX_GOLD_GAIN_PER_SAVE, MAX_GEMS_GAIN_PER_SAVE,
} from '../lib/economyLedger.js';

const T0 = 1_700_000_000_000;
const base = { gold: 500, gems: 50, lifetimeStats: { goldEarned: 0 } };

// ---------------------------------------------------------------- đơn vị
test('save mới có ngân sách đầy đủ để trận đầu không bị chặn', () => {
  const l = freshLedger(T0);
  assert.equal(l.gold, MAX_GOLD_GAIN_PER_SAVE);
  assert.equal(l.gems, MAX_GEMS_GAIN_PER_SAVE);
  assert.equal(l.at, T0);
});

test('ngân sách KHÔNG tự phình khi thời gian không trôi', () => {
  const l = freshLedger(T0);
  const same = refillLedger(l, T0);
  assert.equal(same.gold, l.gold);
  const later = refillLedger({ ...l, gold: 0, gems: 0 }, T0 + 10_000); // +10s
  assert.equal(Math.round(later.gold), RATES.goldPerSecond * 10);
});

test('dự trữ có trần: offline 1 ngày cũng không vượt burst', () => {
  const week = refillLedger({ v: 1, at: T0, gold: 0, gems: 0 }, T0 + 7 * 24 * 3600 * 1000);
  assert.equal(week.gold, RATES.goldPerSecond * BURST_SECONDS.gold);
  assert.ok(week.gems <= MAX_GEMS_GAIN_PER_SAVE);
});

test('đồng hồ bị chỉnh lùi: không trừ ngân sách, không crash', () => {
  const l = { v: 1, at: T0, gold: 1000, gems: 10 };
  const back = refillLedger(l, T0 - 60_000);
  assert.equal(back.gold, 1000);
  assert.equal(back.gems, 10);
});

test('ledger hỏng/thiếu: coi như đầy (không phạt người chơi thật)', () => {
  assert.equal(refillLedger(null, T0).gold, MAX_GOLD_GAIN_PER_SAVE);
  assert.equal(refillLedger({ gold: 'rac', gems: -5 }, T0).gold, MAX_GOLD_GAIN_PER_SAVE);
});

// ---------------------------------------------------------------- lỗ hổng cũ
test('P0: +500.000 vàng trong 1 giây bị CHẶN (trước đây lọt)', () => {
  const r = validateEconomyBudget(base, { ...base, gold: 500_500 }, freshLedger(T0), T0 + 1_000);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'ECONOMY_BUDGET_GOLD');
});

test('P0: +20.000 đá quý trong 1 giây bị CHẶN', () => {
  const r = validateEconomyBudget(base, { ...base, gems: 20_050 }, freshLedger(T0), T0 + 1_000);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'ECONOMY_BUDGET_GEMS');
});

test('P0: 4 lần lưu liên tiếp KHÔNG mint được 2.000.000 vàng', () => {
  let ledger = freshLedger(T0);
  let data = { ...base };
  let now = T0;
  let minted = 0;
  for (let i = 0; i < 4; i++) {
    now += 100; // 0,1 giây giữa các lần lưu
    const target = { ...data, gold: data.gold + 500_000 };
    const r = validateEconomyBudget(data, target, ledger, now);
    if (r.ok) {
      minted += 500_000;
      ledger = r.ledger;
      data = target;
    }
  }
  assert.equal(minted, 0, 'không lần nào được mint 500k');
  // Tổng mint thực tế suốt 0,4 giây phải <= ngân sách ban đầu.
  assert.ok(minted <= MAX_GOLD_GAIN_PER_SAVE);
});

// ---------------------------------------------------------------- người thật
test('người chơi thật: +2.000 vàng sau 20 giây vẫn qua', () => {
  const r = validateEconomyBudget(base, { ...base, gold: 2_500 }, freshLedger(T0), T0 + 20_000);
  assert.equal(r.ok, true);
  assert.equal(r.spentGold, 2_000);
});

test('người chơi thật: tiêu vàng luôn hợp lệ, kể cả tiêu sạch', () => {
  const rich = { gold: 999_999, gems: 5_000 };
  const r = validateEconomyBudget(rich, { ...rich, gold: 0, gems: 0 }, freshLedger(T0), T0);
  assert.equal(r.ok, true);
  assert.equal(r.spentGold, 0, 'tiêu tiền không tiêu ngân sách');
});

test('nhiều trận liên tiếp trong 10 phút vẫn thoải mái', () => {
  let ledger = freshLedger(T0);
  let data = { gold: 500, gems: 50 };
  let now = T0;
  // 10 phút, mỗi 15 giây cộng ~2.500 vàng + 3 đá (thắng phòng + thưởng).
  for (let i = 0; i < 40; i++) {
    now += 15_000;
    const target = { ...data, gold: data.gold + 2_500, gems: data.gems + 3 };
    const r = validateEconomyBudget(data, target, ledger, now);
    assert.equal(r.ok, true, `trận ${i + 1} bị chặn oan: ${r.message || ''}`);
    ledger = r.ledger;
    data = target;
  }
  assert.ok(data.gold > 100_000, 'vẫn kiếm được thu nhập bình thường');
});

test('sau khi tiêu ngân sách, phải chờ thời gian mới nạp lại', () => {
  const first = validateEconomyBudget(
    { gold: 0 }, { gold: MAX_GOLD_GAIN_PER_SAVE }, freshLedger(T0), T0,
  );
  assert.equal(first.ok, true);
  assert.ok(first.ledger.gold < 1, 'ngân sách đã cạn');

  const immediate = validateEconomyBudget(
    { gold: MAX_GOLD_GAIN_PER_SAVE }, { gold: MAX_GOLD_GAIN_PER_SAVE * 2 }, first.ledger, T0 + 1_000,
  );
  assert.equal(immediate.ok, false, '1 giây sau chưa đủ để mint thêm 27.000');

  const later = validateEconomyBudget(
    { gold: MAX_GOLD_GAIN_PER_SAVE }, { gold: MAX_GOLD_GAIN_PER_SAVE * 2 }, first.ledger, T0 + 95_000,
  );
  assert.equal(later.ok, true, '95 giây sau thì đủ (300/s × 90s)');
});

test('giá trị rác không làm sập và không mint', () => {
  // null coi như "không có" (Number(null) === 0) nên được bỏ qua y như undefined;
  // mọi giá trị SỐ hỏng khác phải bị từ chối thay vì quy về 0 (quy về 0 sẽ xoá tài sản).
  for (const bad of [NaN, Infinity, -Infinity, -1, 'abc', 1e20]) {
    const r = validateEconomyBudget({ gold: 100, gems: 1 }, { gold: bad, gems: bad }, freshLedger(T0), T0 + 1_000);
    assert.equal(typeof r.ok, 'boolean');
    assert.equal(r.ok, false, `giá trị ${String(bad)} phải bị chặn`);
  }
  for (const absent of [null, undefined]) {
    const r = validateEconomyBudget({ gold: 100, gems: 1 }, { gold: absent, gems: absent }, freshLedger(T0), T0 + 1_000);
    assert.equal(r.ok, true, `${String(absent)} = không gửi giá trị, không phải mint`);
  }
});

test('không có save trước đó (lần lưu đầu) vẫn được áp ngân sách', () => {
  const r = validateEconomyBudget(null, { gold: 500_000, gems: 20_000 }, freshLedger(T0), T0 + 500);
  assert.equal(r.ok, false);
});
