export const VIP_CARD_PRICE = 500;
export const VIP_CARD_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const VIP_CARD_IDS = ['hunting', 'cave', 'sealing'];

export function normalizeVipPasses(raw) {
  const out = { hunting: 0, cave: 0, sealing: 0 };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const id of VIP_CARD_IDS) {
    const expiry = Number(raw[id]);
    if (Number.isSafeInteger(expiry) && expiry > 0 && expiry < 9e15) out[id] = expiry;
  }
  return out;
}

export function hasVipPass(passes, id, now = Date.now()) {
  return VIP_CARD_IDS.includes(id) && normalizeVipPasses(passes)[id] > now;
}
