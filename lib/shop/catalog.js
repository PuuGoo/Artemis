// Giá VIP giữ nguyên tỷ lệ cũ: 1 xu VIP = 1.000đ.
// Không nhập giá hay phần thưởng từ request của client.
export const VND_PER_VIP_COIN = 1000;
const deal = (id, legacyVnd, gems, period, limit = 1) => ({
  id, name: `Gói ưu đãi ${id}`, legacyVnd, period, limit,
  rewards: { gems, chromaticKeys: 10, scrollsEach: 20 },
});
const rows = [
  { id: 'chapter_91', name: 'Gói Tiếp Sức Hành Trình', legacyVnd: 2500000, period: 'lifetime', limit: 1, rewards: { gems: 14000, sTierGear: 1 } },
  deal('dl_1', 129000, 500, 'daily'),
  deal('dl_2', 386000, 1800, 'daily'),
  deal('dl_3', 505000, 2500, 'daily'),
  deal('dl_4', 766000, 3900, 'daily'),
  deal('dl_5', 1300000, 6500, 'daily'),
  deal('wk_1', 386000, 1800, 'weekly'),
  deal('wk_2', 1300000, 6500, 'weekly'),

  deal('wk_4', 2500000, 14000, 'weekly'),

  deal('mo_1', 766000, 3900, 'monthly'),
  deal('mo_2', 2500000, 14000, 'monthly'),
  // Bỏ bản sao wk_3/wk_5/mo_3; giữ hạn mức riêng cho gói chuyên biệt.
  { id: 'mo_4', name: 'Gói Cuộn Cường Hóa Tháng', legacyVnd: 2500000, period: 'monthly', limit: 2,
    rewards: { gems: 14000, chromaticKeys: 10, scrollsEach: 120 } },
  { id: 'mo_5', name: 'Gói Chìa Khóa Tháng', legacyVnd: 2500000, period: 'monthly', limit: 5,
    rewards: { gems: 14000, chromaticKeys: 60, scrollsEach: 20 } },
  ...[[80, 24000], [500, 129000], [1200, 257000], [2500, 505000], [6500, 1300000], [14000, 2500000]].map(([amount, legacyVnd]) => ({
    id: `gems_${amount}`, name: `${amount} Kim Cương + ${amount} tặng kèm`, legacyVnd,
    period: 'unlimited', limit: null, rewards: { gems: amount * 2 },
  })),
  ...[[99, 24000], [499, 129000], [999, 257000], [1999, 505000], [4999, 1300000], [9999, 2500000]].map(([amount, legacyVnd]) => ({
    id: `aurocite_${amount}`, name: `${amount} Aurocite`, legacyVnd,
    period: 'monthly', limit: 30, rewards: { aurocite: amount },
  })),
];
// Vật phẩm thay thế dùng đúng template/schema hiện hành; không quảng cáo đồ chưa hỗ trợ.
rows.push(
  ...[[6420, 20], [64200, 200], [642000, 2000]].map(([amount, price]) => ({
    id: `gold_${amount}`, name: `${amount} Vàng`, currency: 'gems', price,
    period: 'unlimited', limit: null, rewards: { gold: amount },
  })),
  { id: 'ds_1', name: '3 Mảnh Hậu Nghệ', currency: 'gems', price: 240, period: 'daily', limit: 1,
    rewards: { heroShards: { hou_yi: 3 } } },
  { id: 'ds_2', name: 'Ủng Echo (Thường)', currency: 'gems', price: 45, period: 'daily', limit: 1,
    rewards: { gear: { templateId: 'echo_boots', quality: 'common' } } },
  { id: 'ds_3', name: '1 Xu Cầu Nguyện', currency: 'gems', price: 280, period: 'daily', limit: 1,
    rewards: { wishTokens: 1 } },
  { id: 'ds_4', name: '5 Hạt Mầm Xanh', currency: 'gems', price: 70, period: 'daily', limit: 1,
    rewards: { seeds: { sprout: 5 } } },
  { id: 'ds_5', name: '2 Cuộn Giày Chiến', currency: 'gold', price: 700, period: 'daily', limit: 1,
    rewards: { gearScrolls: { boots: 2 } } },
  { id: 'ds_6', name: '2 Cuộn Vũ Khí', currency: 'gold', price: 900, period: 'daily', limit: 1,
    rewards: { gearScrolls: { weapon: 2 } } },
);
const freezeRewards = rewards => Object.freeze(Object.fromEntries(Object.entries(rewards).map(([key, value]) =>
  [key, value && typeof value === 'object' ? Object.freeze({ ...value }) : value])));
export const SHOP_OFFERS = Object.freeze(rows.map(row => Object.freeze({
  ...row, ...(row.legacyVnd === undefined ? {} : { priceVip: row.legacyVnd / VND_PER_VIP_COIN }),
  currency: row.currency ?? 'vipCoins', price: row.price ?? row.legacyVnd / VND_PER_VIP_COIN,
  rewards: freezeRewards(row.rewards),
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
