import { getMongoDb, COLLECTIONS } from '../lib/mongo.js';
import { getCurrentPlayer, json, fail } from '../lib/http.js';
import { VIP_CARD_IDS, VIP_CARD_PRICE, VIP_CARD_DURATION_MS, normalizeVipPasses } from '../lib/privilegeCards.js';
import { GET as getShop, POST as purchaseShop } from '../lib/shop/handler.js';
import { GET as getPatrol, POST as claimPatrol } from '../lib/patrol/handler.js';

export const config = { runtime: 'nodejs' };

// Vercel rewrite giữ /api/shop nhưng dùng chung một function với thẻ VIP.
function isShopRequest(request) {
  const url = new URL(request.url);
  return url.pathname.replace(/\/+$/, '') === '/api/shop' || url.searchParams.get('__resource') === 'shop';
}

function isPatrolRequest(request) {
  const url = new URL(request.url);
  return url.pathname.replace(/\/+$/, '') === '/api/patrol' || url.searchParams.get('__resource') === 'patrol';
}

export async function GET(request) {
  if (isPatrolRequest(request)) return getPatrol(request);
  return isShopRequest(request) ? getShop(request) : fail('Phương thức không được hỗ trợ.', 405);
}

export async function POST(request) {
  if (isPatrolRequest(request)) return claimPatrol(request);
  if (isShopRequest(request)) return purchaseShop(request);
  const player = await getCurrentPlayer(request);
  if (!player) return fail('Bạn cần đăng nhập để mua thẻ.', 401);
  let body;
  try { body = await request.json(); } catch { return fail('Dữ liệu không hợp lệ.', 400); }
  const cardId = body?.cardId;
  if (!VIP_CARD_IDS.includes(cardId)) return fail('Thẻ đặc quyền không hợp lệ.', 400);

  const playerId = String(player._id);
  const saves = (await getMongoDb()).collection(COLLECTIONS.saves);
  for (let attempt = 0; attempt < 3; attempt++) {
    const save = await saves.findOne({ playerId });
    if (!save) return fail('Chưa có tiến trình để mua thẻ.', 404);
    const balance = Number(save.data?.vipCoins) || 0;
    if (balance < VIP_CARD_PRICE) return fail(`Cần ${VIP_CARD_PRICE} xu VIP để mua thẻ.`, 422);
    const now = Date.now();
    const passes = normalizeVipPasses(save.data?.vipPasses);
    // Renewals extend the remaining term, instead of discarding paid days.
    passes[cardId] = Math.max(now, passes[cardId]) + VIP_CARD_DURATION_MS;
    const data = { ...save.data, vipCoins: balance - VIP_CARD_PRICE, vipPasses: passes };
    const revision = (save.revision || 1) + 1;
    const purchase = { at: new Date(now), cardId, price: VIP_CARD_PRICE, expiresAt: passes[cardId] };
    const privilegeLog = [...(Array.isArray(save.privilegeLog) ? save.privilegeLog : []), purchase].slice(-30);
    const result = await saves.updateOne(
      { playerId, revision: save.revision === undefined ? { $exists: false } : save.revision },
      { $set: { data, revision, updatedAt: new Date(now), privilegeLog } },
    );
    if (result.matchedCount === 1) return json({ ok: true, cardId, vipCoins: data.vipCoins, expiresAt: passes[cardId], revision });
  }
  return fail('Tiến trình vừa thay đổi. Hãy thử mua lại.', 409);
}
