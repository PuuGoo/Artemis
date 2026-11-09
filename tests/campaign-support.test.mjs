import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const path = new URL('../public/campaign-support.js', import.meta.url);
const sandbox = {};
if (existsSync(path)) vm.runInNewContext(readFileSync(path, 'utf8'), sandbox);
const api = sandbox.CampaignSupport;
const plain = x => JSON.parse(JSON.stringify(x));
const context = (stage = 10, extra = {}) => ({ stage, hp: 80, maxHp: 100, cost: { pct: 15, costHp: 15, directHp: false, freeReason: null }, ...extra });

test('offer snapshots rare cost without mutating inputs or rerolling pending terms', () => {
  assert.equal(typeof api?.offer, 'function');
  const state = api.create();
  const ctx = context();
  const result = api.offer(state, ctx);
  assert.equal(result.ok, true);
  assert.deepEqual(plain(result.offer), { stage: 10, cost: ctx.cost, choices: ['angel', 'devil', 'skip'] });
  assert.equal(state.pending, null);
  ctx.cost.pct = 0;
  assert.equal(result.state.pending.cost.pct, 15);
  const reloaded = api.normalize(plain(result.state));
  assert.deepEqual(plain(api.offer(reloaded, context(10, { cost: null })).offer), plain(result.offer));
  for (const stage of [0, 5, 11, 50, '10', NaN]) assert.equal(api.offer(state, context(stage)).ok, false);
  assert.equal(api.offer(state, context(10, { hp: 0 })).ok, false);
  assert.equal(api.offer(state, context(10, { cost: null })).ok, false);
});

test('claim angel heals 20 percent of current cap once and skip records no reward', () => {
  assert.equal(typeof api?.claim, 'function');
  const initial = api.offer(api.create(), context()).state;
  const snapshot = plain(initial);
  const result = api.claim(initial, context(10, { choice: 'angel' }));
  assert.equal(result.ok, true);
  assert.equal(result.hp, 100);
  assert.equal(result.maxHp, 100);
  assert.equal(result.damageBonus, 0);
  assert.deepEqual(plain(initial), snapshot);
  assert.equal(result.state.pending, null);
  assert.deepEqual(plain(result.state.receipts), [{ stage: 10, choice: 'angel' }]);
  const replay = api.claim(api.normalize(plain(result.state)), context(10, { choice: 'angel' }));
  assert.equal(replay.ok, false);
  assert.equal(replay.hp, 80);
  const pending = api.offer(result.state, context(20)).state;
  const skipped = api.claim(pending, context(20, { choice: 'skip', hp: 30 }));
  assert.equal(skipped.hp, 30);
  assert.equal(skipped.damageBonus, 0);
  assert.equal(api.offer(skipped.state, context(20)).ok, false);
});

test('devil pays actual rare percent with rune reductions and safe HP-only enchant semantics', () => {
  assert.equal(typeof api?.claim, 'function');
  for (const [pct, directHp, freeReason] of [[15, false, null], [11.25, false, null], [7.5, false, null], [7.5, true, 'Legendary Enchant'], [0, false, 'Seraph'], [0, false, 'Mythic Enchant']]) {
    const ctx = context(10, { hp: 800, maxHp: 1000, cost: { pct, costHp: Math.round(1000 * pct / 100), directHp, freeReason } });
    const pending = api.offer(api.create(), ctx).state;
    const result = api.claim(pending, { ...ctx, choice: 'devil', cost: { pct: 0, costHp: 0, directHp: false } });
    const expectedMax = directHp || pct === 0 ? 1000 : Math.round(1000 * (1 - pct / 100));
    const payment = directHp ? ctx.cost.costHp : 1000 - expectedMax;
    assert.equal(result.ok, true);
    assert.equal(result.hp, 800 - payment);
    assert.equal(result.maxHp, expectedMax);
    assert.equal(result.damageBonus, 0.05);
    assert.equal(result.state.receipts[0].choice, 'devil');
    assert.equal(result.state.pending, null);
  }
  for (const maxHp of [100, 1000]) {
    const ctx = context(10, { hp: 5, maxHp, cost: { pct: 15, costHp: Math.round(maxHp * 0.15), directHp: false, freeReason: null } });
    const result = api.claim(api.offer(api.create(), ctx).state, { ...ctx, choice: 'devil' });
    assert.equal(result.hp, 5, 'safe floor cannot heal');
    assert.ok(result.maxHp <= maxHp, '120 floor must never increase a small HP cap');
  }
});

test('claims reject missing offer, wrong stage, dead players and invalid choices without payment', () => {
  assert.equal(typeof api?.claim, 'function');
  const pending = api.offer(api.create(), context()).state;
  for (const ctx of [context(20, { choice: 'devil' }), context(10, { hp: 0, choice: 'devil' }), context(10, { hp: NaN, choice: 'devil' }), context(10, { choice: 'skill' })]) {
    const snapshot = plain(pending);
    const result = api.claim(pending, ctx);
    assert.equal(result.ok, false);
    assert.deepEqual(plain(result.state), snapshot);
    assert.ok(Object.is(result.hp, ctx.hp));
    assert.equal(result.maxHp, ctx.maxHp);
  }
  assert.equal(api.claim(api.create(), context(10, { choice: 'devil' })).ok, false);
});

test('four stage receipts cap temporary damage at 15 percent and finish expires it permanently', () => {
  assert.equal(typeof api?.finish, 'function');
  let state = api.create();
  for (const stage of [10, 20, 30, 40]) {
    state = api.offer(api.normalize(plain(state)), context(stage)).state;
    const result = api.claim(state, context(stage, { choice: 'devil' }));
    assert.equal(result.ok, true);
    assert.ok(result.damageBonus <= 0.15);
    state = result.state;
  }
  assert.equal(state.damageBonus, 0.15);
  assert.equal(state.receipts.length, 4);
  assert.equal('skills' in state, false);
  const finished = api.finish(state);
  assert.equal(finished.damageBonus, 0);
  assert.equal(finished.finished, true);
  assert.equal(finished.pending, null);
  assert.equal(api.normalize(plain(finished)).damageBonus, 0);
  assert.equal(api.offer(finished, context()).ok, false);
  assert.equal(api.claim(finished, context(10, { choice: 'devil' })).ok, false);
  assert.equal(state.finished, false);
});

test('classic global creates isolated JSON state and normalizes bounded receipts', () => {
  assert.ok(api, 'CampaignSupport classic global must exist');
  assert.deepEqual(plain(api.create()), { version: 1, receipts: [], pending: null, damageBonus: 0, finished: false });
  const raw = { receipts: [{ stage: 10, choice: 'devil' }, { stage: 10, choice: 'devil' }, { stage: 11, choice: 'devil' }, { stage: 20, choice: 'angel' }, { stage: 30, choice: 'devil' }, { stage: 40, choice: 'devil' }], damageBonus: 999 };
  const state = api.normalize(raw);
  assert.equal(state.receipts.length, 4);
  assert.equal(state.damageBonus, 0.15);
  assert.deepEqual(plain(api.normalize(JSON.parse(JSON.stringify(state)))), plain(state));
  state.receipts.pop();
  assert.equal(raw.receipts.length, 6);
});
