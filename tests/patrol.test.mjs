import test from 'node:test';
import assert from 'node:assert/strict';

// Dynamic import keeps a missing implementation an explicit feature assertion.
test('patrol starts with a persisted server baseline, not retroactive free income', async () => {
  const module = await import('../lib/patrol/domain.js').catch(() => null);
  assert.ok(module, 'patrol domain must exist');
  const state = module.initialPatrol(1_800_000_000_000);
  const view = module.previewPatrol({ winsByChapter: {} }, state, state.startedAt);
  assert.equal(view.elapsedSeconds, 0);
  assert.equal(view.canClaim, false);
  assert.equal(view.bestClearedChapter, 0);
  assert.equal(view.quickAd.available, false);
});

test('claim is capped, finite and pure; quick does not consume accrued time', async () => {
  const m = await import('../lib/patrol/domain.js');
  assert.equal(typeof m.planPatrolAction, 'function', 'server action planner must exist');
  const now = 1_800_000_000_000;
  const state = m.initialPatrol(now - 90000000);
  const data = { gold: 500, patrolExp: 0, stamina: 20, aurocite: 0, winsByChapter: { 1: 1, 3: 1, 999: 1 } };
  const draft = m.planPatrolAction(data, state, 'claim', now);
  assert.equal(draft.rewards.gold, (240 + 3 * 60) * 24);
  assert.equal(draft.data.gold, data.gold + draft.rewards.gold);
  assert.equal(draft.state.lastClaimAt, now);
  assert.equal(state.lastClaimAt, now - 90000000);
  const quick = m.planPatrolAction(data, state, 'quickEnergy', now);
  assert.equal(quick.data.stamina, 15);
  assert.equal(quick.state.energyUsed, 1);
  assert.equal(quick.state.lastClaimAt, state.lastClaimAt);
  assert.throws(() => m.planPatrolAction(data, m.initialPatrol(now), 'claim', now), /60/);
  assert.throws(() => m.planPatrolAction({ ...data, gold: 1e12 }, state, 'claim', now), /giới hạn/);
  assert.throws(() => m.planPatrolAction({ ...data, gold: Infinity }, state, 'claim', now), /hợp lệ/);
  assert.throws(() => m.planPatrolAction(data, state, 'quickAd', now), /quảng cáo/);
});
