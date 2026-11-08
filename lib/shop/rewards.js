import { randomInt, randomUUID } from 'node:crypto';
import { sanitizeSave, MAX_BAG_ITEMS } from '../save/schema.js';

// Các template S-Tier hiện có trong GEAR_SET_META của game.
export const SHOP_S_TIER_TEMPLATES = Object.freeze([
  'crimson_bow', 'sapphire_pendant', 'sun_gold_ring', 'golden_plate', 'golden_helm', 'titan_boots',
  'dragoon_claw', 'celestial_amulet', 'jade_flower_ring', 'shadow_tunic', 'phantom_mask', 'aqua_boots',
  'oracle_staff', 'void_prism_necklace', 'starlight_ring', 'wind_vest', 'astral_crown', 'starlight_greaves',
]);
export const SHOP_SCROLL_SLOTS = Object.freeze(['weapon', 'armor', 'helmet', 'ring', 'necklace', 'boots']);

function add(record, key, amount, max = 1e9) {
  const next = (Number(record[key]) || 0) + amount;
  if (!Number.isSafeInteger(next) || next < 0 || next > max) throw new RangeError('Tài nguyên đã đạt giới hạn lưu trữ.');
  record[key] = next;
}

/** Tạo snapshot mới; tất cả reward/giá đến từ catalog server, không mutation. */
export function applyShopRewards(data, rewards) {
  const next = structuredClone(data);
  if (rewards.gold) add(next, 'gold', rewards.gold, 1e12);
  if (rewards.gems) add(next, 'gems', rewards.gems, 1e12);
  if (rewards.aurocite) add(next, 'aurocite', rewards.aurocite);
  if (rewards.wishTokens) {
    add(next, 'wishTokens', rewards.wishTokens);
    next.wikiOtherItems = { ...(next.wikiOtherItems || {}), wish_token: next.wishTokens };
  }
  if (rewards.seeds) {
    next.garden = next.garden || {
      plots: Array.from({ length: 6 }, (_, id) => ({ id, seedId: null, plantedAt: 0, watered: false, readyAt: 0 })),
      seeds: { sprout: 2 }, produce: { leaf: 0, petal: 0, dew: 0, essence: 0 }, totalHarvest: 0,
      weekTask: { done: 0, target: 10, claimed: false }, raidsRepelled: 0,
    };
    next.garden.seeds = { ...(next.garden.seeds || {}) };
    for (const [seed, amount] of Object.entries(rewards.seeds)) add(next.garden.seeds, seed, amount, 1e6);
  }
  if (rewards.chromaticKeys) {
    next.chestKeys = { ...(next.chestKeys || {}) };
    add(next.chestKeys, 'chromatic_chest_key', rewards.chromaticKeys);
  }
  if (rewards.scrollsEach) {
    next.gearScrolls = { ...(next.gearScrolls || {}) };
    for (const slot of SHOP_SCROLL_SLOTS) add(next.gearScrolls, slot, rewards.scrollsEach);
  }
  if (rewards.gearScrolls) {
    next.gearScrolls = { ...(next.gearScrolls || {}) };
    for (const [slot, amount] of Object.entries(rewards.gearScrolls)) {
      if (!SHOP_SCROLL_SLOTS.includes(slot)) throw new RangeError('Loại cuộn không hợp lệ.');
      add(next.gearScrolls, slot, amount);
    }
  }
  if (rewards.heroShards) {
    next.heroShards = { ...(next.heroShards || {}) };
    for (const [heroId, amount] of Object.entries(rewards.heroShards)) add(next.heroShards, heroId, amount);
  }
  if (rewards.gear) {
    next.gearBag = [...(next.gearBag || [])];
    if (next.gearBag.length >= MAX_BAG_ITEMS) throw new RangeError('Túi trang bị đã đầy. Hãy dọn túi trước khi mua.');
    next.gearBag.unshift({ uid: `shop_${randomUUID()}`, templateId: rewards.gear.templateId,
      quality: rewards.gear.quality, awakening: 0, level: 1, locked: false, favorite: false, sockets: [], affixes: [] });
  }
  if (rewards.sTierGear) {
    next.gearBag = [...(next.gearBag || [])];
    if (next.gearBag.length + rewards.sTierGear > MAX_BAG_ITEMS) throw new RangeError('Túi trang bị đã đầy. Hãy dọn túi trước khi mua.');
    // Gói ghi rõ một trang bị S-Tier: cấp Epic S-Tier thật, không quay rương thường.
    next.gearBag.unshift({ uid: `shop_${randomUUID()}`, templateId: SHOP_S_TIER_TEMPLATES[randomInt(SHOP_S_TIER_TEMPLATES.length)],
      quality: 'epic', awakening: 0, level: 1, locked: true, favorite: true, sockets: [], affixes: [] });
  }
  const valid = sanitizeSave(next);
  if (!valid.ok) throw new RangeError(valid.reason);
  return next;
}
