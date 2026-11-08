// Giá duy nhất cho 28 gói trước đây niêm yết tiền đ: 1 xu VIP = 1.000đ.
// Không nhập giá hay phần thưởng từ request của client.
export const VND_PER_VIP_COIN = 1000;
const deal = (id, legacyVnd, gems, period, limit = 1) => ({
  id, name: `Gói ưu đãi ${id}`, legacyVnd, period, limit,
  rewards: { gems, chromaticKeys: 10, scrollsEach: 20 },
});
const rows = [
  { id: 'chapter_91', name: 'Gói Chương 91', legacyVnd: 2500000, period: 'lifetime', limit: 1, rewards: { gems: 14000, sTierGear: 1 } },
  deal('dl_1', 129000, 500, 'daily'),
  deal('dl_2', 386000, 1800, 'daily'),
  deal('dl_3', 505000, 2500, 'daily'),
  deal('dl_4', 766000, 3900, 'daily'),
  deal('dl_5', 1300000, 6500, 'daily'),
  deal('wk_1', 386000, 1800, 'weekly'),
  deal('wk_2', 1300000, 6500, 'weekly'),
  deal('wk_3', 1300000, 6500, 'weekly'),
  deal('wk_4', 2500000, 14000, 'weekly'),
  deal('wk_5', 2500000, 14000, 'weekly'),
  deal('mo_1', 766000, 3900, 'monthly'),
  deal('mo_2', 2500000, 14000, 'monthly'),
  deal('mo_3', 2500000, 14000, 'monthly'),
  deal('mo_4', 2500000, 14000, 'monthly', 2),
  deal('mo_5', 2500000, 14000, 'monthly', 5),
  ...[[80, 24000], [500, 129000], [1200, 257000], [2500, 505000], [6500, 1300000], [14000, 2500000]].map(([amount, legacyVnd]) => ({
    id: `gems_${amount}`, name: `${amount} Kim Cương + ${amount} tặng kèm`, legacyVnd,
    period: 'unlimited', limit: null, rewards: { gems: amount * 2 },
  })),
  ...[[99, 24000], [499, 129000], [999, 257000], [1999, 505000], [4999, 1300000], [9999, 2500000]].map(([amount, legacyVnd]) => ({
    id: `aurocite_${amount}`, name: `${amount} Aurocite`, legacyVnd,
    period: 'monthly', limit: 30, rewards: { aurocite: amount },
  })),
];
export const SHOP_OFFERS = Object.freeze(rows.map(row => Object.freeze({
  ...row, priceVip: row.legacyVnd / VND_PER_VIP_COIN, rewards: Object.freeze(row.rewards),
})));
export const findShopOffer = id => SHOP_OFFERS.find(offer => offer.id === id);

/** Chu kỳ tính theo giờ Việt Nam (UTC+7), tuần bắt đầu thứ Hai. */
export function shopPeriodKey(period, nowMs = Date.now()) {
  if (period === 'lifetime' || period === 'unlimited') return period;
  const date = new Date(nowMs + 7 * 60 * 60 * 1000);
  if (period === 'weekly') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, period === 'monthly' ? 7 : 10);
}

export function shopOfferRemaining(offer, limits, nowMs) {
  if (offer.limit === null) return null;
  const record = limits?.[offer.id];
  const count = record?.period === shopPeriodKey(offer.period, nowMs) ? Number(record.count) || 0 : 0;
  return Math.max(0, offer.limit - count);
}
