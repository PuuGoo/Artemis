import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sanitizeSave } from '../../lib/save/schema.js';
import { freshLedger } from '../../lib/economyLedger.js';

const moduleUrl = new URL('../../lib/save/policy.js', import.meta.url);
const NOW = 1_800_000_000_000;

// Báo thiếu boundary bằng assertion, không che lỗi import/cú pháp của implementation.
async function policy() {
  assert.ok(fs.existsSync(moduleUrl), 'Cần module savePolicy độc lập với HTTP/MongoDB');
  return import(moduleUrl);
}

test('save policy giữ tài sản do server cấp và không sửa input', async () => {
  const { prepareSaveData } = await policy();
  const previousData = {
    vipCoins: 42, vipPasses: { hunting: NOW + 1000 },
    runes: { sharp_arrow: 2 }, runeStones: { sharp_arrow: { rare: 1 } },
    runeIntroClaimed: true, runeMythicEnchant: true,
    garden: { plots: ['old'] }, guild: { name: 'old' },
  };
  const incomingData = {
    gold: 500, vipCoins: 999, vipPasses: { hunting: NOW + 99999 },
    runes: { sharp_arrow: 99, guardian: 99 },
    equippedRuneSlots: { enhancement: ['sharp_arrow', 'guardian'] },
  };
  const sanitizedData = sanitizeSave(incomingData).data;
  const before = structuredClone({ previousData, incomingData, sanitizedData });
  const data = prepareSaveData({ previousData, incomingData, sanitizedData, nowMs: NOW });
  assert.equal(data.vipCoins, 42);
  assert.equal(data.vipPasses.hunting, NOW + 1000);
  assert.deepEqual(data.runes, previousData.runes);
  assert.deepEqual(data.runeStones, previousData.runeStones);
  assert.equal(data.runeIntroClaimed, true);
  assert.equal(data.runeMythicEnchant, true);
  assert.deepEqual(data.equippedRuneSlots.enhancement, ['sharp_arrow', null]);
  assert.deepEqual(data.garden, previousData.garden);
  assert.deepEqual({ previousData, incomingData, sanitizedData }, before);
  data.runes.sharp_arrow = 100;
  data.garden.plots.push('new');
  assert.deepEqual({ previousData, incomingData, sanitizedData }, before, 'output không được chia sẻ object mutable với input');
});

test('save policy phân biệt key thiếu với null và dùng đồng hồ được truyền vào', async () => {
  const { prepareSaveData } = await policy();
  const previousData = { garden: { plots: [] }, vipPasses: { hunting: NOW } };
  const incomingData = { gold: 500, garden: null, wikiEventsState: { huntingWarriorCard: true } };
  const sanitizedData = sanitizeSave(incomingData).data;
  const data = prepareSaveData({ previousData, incomingData, sanitizedData, nowMs: NOW });
  assert.equal(data.garden, null);
  assert.equal(data.wikiEventsState.huntingWarriorCard, false, 'pass hết hạn đúng mốc không còn hiệu lực');
  const active = prepareSaveData({ previousData, incomingData, sanitizedData, nowMs: NOW - 1 });
  assert.equal(active.wikiEventsState.huntingWarriorCard, true);
});

test('save policy trả lỗi domain và ledger bằng clock cố định, không cần DB', async () => {
  const { validateSaveTransition } = await policy();
  const previous = { data: { gold: 500, gems: 50 }, ledger: freshLedger(NOW) };
  const before = structuredClone(previous);
  const allowed = validateSaveTransition({ previous, data: { gold: 2500, gems: 50 }, nowMs: NOW });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.ledger.at, NOW);
  assert.equal(allowed.ledger.gold, previous.ledger.gold - 2000);
  const delta = validateSaveTransition({ previous, data: { gold: 1_000_000, gems: 50 }, nowMs: NOW });
  assert.equal(delta.ok, false);
  assert.equal(delta.error.code, 'ECONOMY_GOLD_JUMP');
  assert.ok(delta.error.detail);
  const budget = validateSaveTransition({ previous, data: { gold: 50_000, gems: 50 }, nowMs: NOW });
  assert.equal(budget.ok, false);
  assert.equal(budget.error.code, 'ECONOMY_BUDGET_GOLD');
  assert.equal(budget.error.error, 'Kinh tế không hợp lệ so với thời gian chơi.');
  assert.deepEqual(previous, before);
});
