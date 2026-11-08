import { getMongoDb, COLLECTIONS } from '../mongo.js';
import { getCurrentPlayer, json, fail, readJsonBody, bumpRateLimit } from '../http.js';
import { SHOP_OFFERS, findShopOffer, shopPeriodKey, shopOfferRemaining } from './catalog.js';
import { applyShopRewards } from './rewards.js';

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail('Bạn cần đăng nhập để xem cửa hàng VIP.', 401);
  const playerId = String(player._id);
  const save = await (await getMongoDb()).collection(COLLECTIONS.saves).findOne({ playerId });
  const now = Date.now();
  return json({ ok: true, playerId, offers: SHOP_OFFERS.map(offer => ({
    ...offer, remaining: shopOfferRemaining(offer, save?.shopLimits, now),
  })) });
}

export async function POST(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail('Bạn cần đăng nhập để mua bằng xu VIP.', 401);
  const parsed = await readJsonBody(request, 2048);
  if (!parsed.ok) return fail(parsed.error, parsed.status);
  const { offerId, playerId: ownerId, revision, requestId } = parsed.data;
  const offer = findShopOffer(offerId);
  if (!offer || typeof requestId !== 'string' || !REQUEST_ID.test(requestId) || !Number.isSafeInteger(revision) || revision < 1) {
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
    if (replay.offerId !== offer.id) return fail('Mã giao dịch đã được dùng cho gói khác.', 409);
    return json({ ok: true, replayed: true, offerId, priceVip: replay.priceVip, revision: save.revision });
  }
  if (save.revision !== revision) return fail('Tiến trình vừa thay đổi. Hãy đồng bộ rồi thử lại.', 409);
  const now = new Date(), nowMs = now.getTime();
  const remaining = shopOfferRemaining(offer, save.shopLimits, nowMs);
  if (remaining !== null && remaining <= 0) return fail('Gói này đã hết lượt mua trong chu kỳ.', 422);
  const coins = Number(save.data?.vipCoins) || 0;
  if (!Number.isSafeInteger(coins) || coins < offer.priceVip) return fail(`Cần ${offer.priceVip} xu VIP để mua gói này.`, 422);
  let data;
  try { data = applyShopRewards(save.data, offer.rewards); }
  catch (error) { if (error instanceof RangeError) return fail(error.message, 422); throw error; }
  data.vipCoins = coins - offer.priceVip;
  const shopLimits = { ...(save.shopLimits || {}) };
  if (remaining !== null) shopLimits[offer.id] = { period: shopPeriodKey(offer.period, nowMs), count: offer.limit - remaining + 1 };
  const receipt = { requestId, offerId, priceVip: offer.priceVip, rewards: offer.rewards, at: now, revision: revision + 1 };
  const result = await saves.updateOne({ playerId, revision }, { $set: {
    data, revision: revision + 1, updatedAt: now, shopLimits,
    shopReceipts: [...receipts, receipt].slice(-100),
  } });
  if (result.matchedCount !== 1) return fail('Tiến trình vừa thay đổi. Hãy đồng bộ rồi thử lại.', 409);
  return json({ ok: true, offerId, priceVip: offer.priceVip, rewards: offer.rewards, revision: revision + 1 });
}
