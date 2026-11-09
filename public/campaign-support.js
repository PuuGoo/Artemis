(function (root) {
  'use strict';
  const STAGES = Object.freeze([10, 20, 30, 40]);
  const CHOICES = ['angel', 'devil', 'skip'];
  const MAX_DAMAGE_BONUS = 0.15;
  const DAMAGE_PER_PACT = 0.05;
  const validStage = stage => STAGES.includes(stage);
  function create() {
    return { version: 1, receipts: [], pending: null, damageBonus: 0, finished: false };
  }
  function normalize(raw) {
    const state = create();
    if (!raw || typeof raw !== 'object') return state;
    if (Array.isArray(raw.receipts)) {
      for (const receipt of raw.receipts) {
        if (receipt && validStage(receipt.stage) && CHOICES.includes(receipt.choice) &&
            !state.receipts.some(r => r.stage === receipt.stage)) {
          state.receipts.push({ stage: receipt.stage, choice: receipt.choice });
        }
      }
    }
    state.finished = raw.finished === true;
    state.damageBonus = state.finished ? 0 : Math.min(MAX_DAMAGE_BONUS,
      state.receipts.filter(r => r.choice === 'devil').length * DAMAGE_PER_PACT);
    if (!state.finished && raw.pending && validStage(raw.pending.stage) &&
        !state.receipts.some(r => r.stage === raw.pending.stage)) {
      const cost = normalizeCost(raw.pending.cost);
      if (cost) state.pending = { stage: raw.pending.stage, cost, choices: CHOICES.slice() };
    }
    return state;
  }
  function normalizeCost(cost) {
    if (!cost || !Number.isFinite(cost.pct) || cost.pct < 0 || cost.pct > 15 ||
        !Number.isFinite(cost.costHp) || cost.costHp < 0 ||
        typeof cost.directHp !== 'boolean' || (cost.pct === 0 && cost.costHp !== 0)) return null;
    return { pct: cost.pct, costHp: cost.costHp, directHp: cost.directHp,
      freeReason: typeof cost.freeReason === 'string' ? cost.freeReason.slice(0, 160) : null };
  }
  function alive(ctx) {
    return ctx && Number.isFinite(ctx.hp) && Number.isFinite(ctx.maxHp) &&
      ctx.maxHp > 0 && ctx.hp > 0 && ctx.hp <= ctx.maxHp;
  }
  function offer(raw, ctx) {
    const state = normalize(raw);
    const reject = reason => ({ ok: false, reason, state, offer: null });
    if (state.finished) return reject('finished');
    if (!alive(ctx)) return reject('invalid-player');
    if (!validStage(ctx.stage)) return reject('ineligible-stage');
    if (state.receipts.some(r => r.stage === ctx.stage)) return reject('already-claimed');
    if (state.pending && state.pending.stage !== ctx.stage) return reject('stage-mismatch');
    if (!state.pending) {
      const cost = normalizeCost(ctx.cost);
      if (!cost) return reject('invalid-cost');
      state.pending = { stage: ctx.stage, cost, choices: CHOICES.slice() };
    }
    return { ok: true, state, offer: { stage: state.pending.stage,
      cost: { ...state.pending.cost }, choices: CHOICES.slice() } };
  }
  function claim(raw, ctx) {
    const state = normalize(raw);
    let hp = ctx && ctx.hp;
    let maxHp = ctx && ctx.maxHp;
    const reject = reason => ({ ok: false, reason, state, hp, maxHp, damageBonus: state.damageBonus });
    if (state.finished) return reject('finished');
    if (!alive(ctx)) return reject('invalid-player');
    if (!validStage(ctx.stage)) return reject('ineligible-stage');
    if (state.receipts.some(r => r.stage === ctx.stage)) return reject('already-claimed');
    if (!state.pending) return reject('missing-offer');
    if (state.pending.stage !== ctx.stage) return reject('stage-mismatch');
    if (!CHOICES.includes(ctx.choice)) return reject('invalid-choice');
    if (ctx.choice === 'angel') hp = Math.min(maxHp, hp + Math.round(maxHp * 0.20));
    if (ctx.choice === 'devil') {
      const cost = state.pending.cost;
      if (cost.pct > 0) {
        // Giữ ngữ nghĩa khế ước cũ; sàn 120 không được tự tăng trần máu thấp.
        const nextMax = cost.directHp ? maxHp : Math.min(maxHp, Math.max(120, Math.round(maxHp * (1 - cost.pct / 100))));
        const paid = cost.directHp ? cost.costHp : maxHp - nextMax;
        const safeFloor = Math.min(hp, Math.max(1, Math.round(nextMax * 0.15)));
        hp = Math.min(nextMax, Math.max(safeFloor, Math.round(hp - paid)));
        maxHp = nextMax;
      }
    }
    state.receipts.push({ stage: ctx.stage, choice: ctx.choice });
    state.pending = null;
    const next = normalize(state);
    return { ok: true, state: next, hp, maxHp, damageBonus: next.damageBonus };
  }
  function finish(raw) {
    return normalize({ ...normalize(raw), finished: true });
  }
  root.CampaignSupport = Object.freeze({ create, normalize, offer, claim, finish });
})(typeof globalThis !== 'undefined' ? globalThis : window);
