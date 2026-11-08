import { getMongoDb, COLLECTIONS } from '../mongo.js';
import { getCurrentPlayer, json, fail, readJsonBody, bumpRateLimit } from '../http.js';
import { SHOP_OFFERS, findShopOffer, shopPeriodKey, shopOfferRemaining } from './catalog.js';
import { applyShopRewards } from './rewards.js';

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const balancesFor = data => Object.fromEntries(['vipCoins', 'gold', 'gems'].map(key => [key, Number(data?.[key]) || 0]));
// Biên lai cũ không có số dư sau mua: trả null, không suy đoán từ số dư hiện tại.
const receiptFor = receipt => ({
  ...receipt, name: receipt.name ?? findShopOffer(receipt.offerId)?.name ?? `Gói ${receipt.offerId}`,
  currency: receipt.currency ?? 'vipCoins', price: receipt.price ?? receipt.priceVip,
  balanceAfter: receipt.balanceAfter ?? null,
});

export async function GET(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail('Bạn cần đăng nhập để xem cửa hàng.', 401);
  const playerId = String(player._id);
  const save = await (await getMongoDb()).collection(COLLECTIONS.saves).findOne({ playerId });
  const now = Date.now();
  return json({ ok: true, playerId, revision: save?.revision ?? null, balances: balancesFor(save?.data),
    history: (Array.isArray(save?.shopReceipts) ? save.shopReceipts : []).slice(-100).reverse().map(receiptFor),
    offers: SHOP_OFFERS.map(offer => ({
    ...offer, remaining: shopOfferRemaining(offer, save?.shopLimits, now),
  })) });
}

export async function POST(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail('Bạn cần đăng nhập để mua hàng.', 401);
  const parsed = await readJsonBody(request, 2048);
  if (!parsed.ok) return fail(parsed.error, parsed.status);
  const { offerId, playerId: ownerId, revision, requestId, expectedBalance } = parsed.data;
  if (expectedBalance !== undefined && (!Number.isSafeInteger(expectedBalance) || expectedBalance < 0)) {
    return fail('Số dư xác nhận không hợp lệ.', 400);
  }
  if (typeof offerId !== 'string' || !/^[a-z0-9_]{1,60}$/.test(offerId) || typeof requestId !== 'string' || !REQUEST_ID.test(requestId) || !Number.isSafeInteger(revision) || revision < 1) {
    return fail('Giao dịch cửa hàng không hợp lệ.', 400);
  }
  const playerId = String(player._id);
  if (ownerId !== playerId) return fail('Tài khoản đã thay đổi. Hãy tải lại trang.', 409);
  const limit = await bumpRateLimit(`shop:${playerId}`, { windowMs: 60000, max: 90 });
  if (!limit.allowed) return fail('Bạn mua quá nhanh. Hãy thử lại sau.', 429);
  const saves = (await getMongoDb()).collection(COLLECTIONS.saves);
  const save = await saves.findOne({ playerId });
  if (!save) return fail('Chưa có tiến trình. Hãy tải lại trang.', 404);
  const receipts = Array.isArray(save.shopReceipts) ? save.shopReceipts : [];
  const replay = receipts.find(receipt => receipt.requestId === requestId);
  if (replay) {
    if (replay.offerId !== offerId) return fail('Mã giao dịch đã được dùng cho gói khác.', 409);
    return json({ ok: true, replayed: true, ...receiptFor(replay), revision: save.revision, balances: balancesFor(save.data) });
  }
  const offer = findShopOffer(offerId);
  if (!offer) return fail('Giao dịch cửa hàng không hợp lệ.', 400);
  if (save.revision !== revision) return fail('Tiến trình vừa thay đổi. Hãy đồng bộ rồi thử lại.', 409);
  const now = new Date(), nowMs = now.getTime();
  const remaining = shopOfferRemaining(offer, save.shopLimits, nowMs);
  if (remaining !== null && remaining <= 0) return fail('Gói này đã hết lượt mua trong chu kỳ.', 422);
  const coins = Number(save.data?.[offer.currency]) || 0;
  if (expectedBalance !== undefined && expectedBalance !== coins) return fail('Số dư đã thay đổi. Hãy xác nhận lại giao dịch.', 409);
  const currencyName = { vipCoins: 'xu VIP', gems: 'kim cương', gold: 'vàng' }[offer.currency];
  if (!Number.isSafeInteger(coins) || coins < offer.price) return fail(`Cần ${offer.price} ${currencyName} để mua gói này.`, 422);
  let data;
  try { data = applyShopRewards({ ...save.data, [offer.currency]: coins - offer.price }, offer.rewards); }
  catch (error) { if (error instanceof RangeError) return fail(error.message, 422); throw error; }

  const shopLimits = { ...(save.shopLimits || {}) };
  if (remaining !== null) shopLimits[offer.id] = { period: shopPeriodKey(offer.period, nowMs), count: offer.limit - remaining + 1 };
  const receipt = { requestId, offerId, name: offer.name, currency: offer.currency, price: offer.price,
    ...(offer.priceVip === undefined ? {} : { priceVip: offer.priceVip }),
    balanceAfter: data[offer.currency], rewards: offer.rewards, at: now, revision: revision + 1 };
  const result = await saves.updateOne({ playerId, revision }, { $set: {
    data, revision: revision + 1, updatedAt: now, shopLimits,
    shopReceipts: [...receipts, receipt].slice(-100),
  } });
  if (result.matchedCount !== 1) return fail('Tiến trình vừa thay đổi. Hãy đồng bộ rồi thử lại.', 409);
  return json({ ok: true, ...receipt, balances: balancesFor(data) });
}
