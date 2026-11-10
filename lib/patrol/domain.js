import { getCampaignSummaries } from '../campaignCatalog.js';

export const PATROL = Object.freeze({ capSeconds: 86400, minClaimSeconds: 60, quickSeconds: 7200,
  energyCost: 5, energyDailyLimit: 3, adDailyLimit: 2, maxReceipts: 4096 });
export const SCROLL_SLOTS = Object.freeze(['weapon', 'armor', 'helmet', 'ring', 'necklace', 'boots']);
const CHAPTER_IDS = new Set(getCampaignSummaries().map(chapter => chapter.id));
export const utcDay = now => new Date(now).toISOString().slice(0, 10);

function addBalance(record, key, amount, cap) {
  const current = record[key] === undefined ? 0 : record[key];
  if (!Number.isSafeInteger(current) || current < 0) throw new RangeError('Số dư không hợp lệ.');
  if (!Number.isSafeInteger(amount) || amount < 0 || current + amount > cap) throw new RangeError('Tài nguyên vượt giới hạn lưu trữ.');
  record[key] = current + amount;
}

export function patrolRewards(rates, seconds) {
  const scale = amount => Math.floor(amount * seconds / 3600);
  return { gold: scale(rates.gold), exp: scale(rates.exp), aurocite: scale(rates.aurocite),
    gearScrolls: Object.fromEntries(SCROLL_SLOTS.map(slot => [slot, scale(rates.gearScrolls[slot])])) };
}

export function planPatrolAction(data, state, action, now) {
  const preview = previewPatrol(data, state, now);
  if (action === 'quickAd') throw new RangeError(preview.quickAd.reason);
  if (!['claim', 'quickEnergy'].includes(action)) throw new RangeError('Thao tác không hợp lệ.');
  if (action === 'claim' && !preview.canClaim) throw new RangeError('Cần tích lũy ít nhất 60 giây để nhận.');
  if (action === 'quickEnergy' && preview.quickEnergy.remaining <= 0) throw new RangeError('Đã hết lượt tuần tra nhanh hôm nay (UTC).');
  const next = structuredClone(data), nextState = structuredClone(state);
  if (action === 'quickEnergy') {
    if (!Number.isSafeInteger(next.stamina) || next.stamina < PATROL.energyCost) throw new RangeError('Cần 5 năng lượng để tuần tra nhanh.');
    next.stamina -= PATROL.energyCost;
    nextState.energyUsed = (state.day === utcDay(now) ? state.energyUsed : 0) + 1;
    nextState.adUsed = state.day === utcDay(now) ? state.adUsed : 0;
    nextState.day = utcDay(now);
  } else {
    nextState.lastClaimAt = now;
  }
  const rewards = patrolRewards(preview.ratesPerHour, action === 'claim' ? preview.elapsedSeconds : PATROL.quickSeconds);
  addBalance(next, 'gold', rewards.gold, 1e12);
  addBalance(next, 'patrolExp', rewards.exp, 1e12);
  addBalance(next, 'aurocite', rewards.aurocite, 1e9);
  next.gearScrolls = { ...(next.gearScrolls || {}) };
  for (const slot of SCROLL_SLOTS) addBalance(next.gearScrolls, slot, rewards.gearScrolls[slot], 1e9);
  return { data: next, state: nextState, rewards };
}

export function initialPatrol(now) {
  return { version: 1, startedAt: now, lastClaimAt: now, day: utcDay(now), energyUsed: 0, adUsed: 0, receipts: [] };
}

export function previewPatrol(data, state, now) {
  let bestClearedChapter = 0;
  for (const [key, wins] of Object.entries(data.winsByChapter || {})) {
    const id = Number(key);
    if (String(id) === key && CHAPTER_IDS.has(id) && Number.isSafeInteger(wins) && wins > 0) bestClearedChapter = Math.max(bestClearedChapter, id);
  }
  const elapsedSeconds = Math.min(PATROL.capSeconds, Math.max(0, Math.floor((now - state.lastClaimAt) / 1000)));
  return { serverNow: now, startedAt: state.startedAt, lastClaimAt: state.lastClaimAt,
    elapsedSeconds, capSeconds: PATROL.capSeconds, minClaimSeconds: PATROL.minClaimSeconds,
    canClaim: elapsedSeconds >= PATROL.minClaimSeconds, bestClearedChapter,
    ratesPerHour: { gold: 240 + bestClearedChapter * 60, exp: 120 + bestClearedChapter * 30,
      gearScrolls: Object.fromEntries(SCROLL_SLOTS.map(slot => [slot, 1 + Math.floor(bestClearedChapter / 5)])),
      aurocite: bestClearedChapter >= 3 ? 1 + Math.floor(bestClearedChapter / 10) : 0 },
    quickSeconds: PATROL.quickSeconds,
    dailyResetTimezone: 'UTC', dailyResetAt: Date.parse(`${utcDay(now)}T00:00:00Z`) + 86400000,
    quickEnergy: { cost: PATROL.energyCost, limit: PATROL.energyDailyLimit,
      remaining: Math.max(0, PATROL.energyDailyLimit - (state.day === utcDay(now) ? state.energyUsed : 0)) },
    quickAd: { available: false, limit: PATROL.adDailyLimit, remaining: 0,
      reason: 'Chưa tích hợp nhà cung cấp quảng cáo có xác minh phía máy chủ.' } };
}
