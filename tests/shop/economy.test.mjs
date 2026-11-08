import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

// Backend bộ nhớ bắt buộc; không đọc .env hay mở kết nối Mongo thật.
process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { ObjectId } = await import('mongodb');
const { signSession, SESSION_COOKIE } = await import('../../lib/auth.js');
const { getMongoDb, COLLECTIONS } = await import('../../lib/mongo.js');
const { GET, POST } = await import('../../lib/shop/handler.js');
const { SHOP_OFFERS, findShopOffer, shopPeriodKey } = await import('../../lib/shop/catalog.js');
const db = await getMongoDb();
const saves = db.collection(COLLECTIONS.saves);
const request = (method, cookie, body) => new Request('https://artemis.test/api/shop', {
  method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
async function fixture(data = {}) {
  const _id = new ObjectId(), playerId = String(_id);
  await db.collection(COLLECTIONS.players).insertOne({ _id, username: `economy_${playerId}`, usernameLower: `economy_${playerId}`, sessionEpoch: 0 });
  const cookie = `${SESSION_COOKIE}=${await signSession({ sub: playerId })}`;
  await saves.insertOne({ playerId, revision: 1, data: { gold: 10000, gems: 10000, vipCoins: 10000, gearBag: [], ...data } });
  const stored = () => saves.findOne({ playerId });
  const catalog = async () => (await GET(request('GET', cookie))).json();
  const body = async (offerId, extra = {}) => ({ offerId, playerId, revision: (await stored()).revision, requestId: randomUUID(), ...extra });
  const buy = async payload => POST(request('POST', cookie, payload));
  return { playerId, cookie, stored, catalog, body, buy };
}

test('catalog: canonical metadata, real rewards and differentiated periodic bundles', () => {
  assert.equal(SHOP_OFFERS.length, 34);
  assert.equal(new Set(SHOP_OFFERS.map(o => o.id)).size, SHOP_OFFERS.length);
  for (const offer of SHOP_OFFERS) {
    assert.ok(['vipCoins', 'gold', 'gems'].includes(offer.currency));
    assert.ok(Number.isSafeInteger(offer.price) && offer.price > 0);
    if (offer.currency === 'vipCoins') {
      assert.equal(offer.price, offer.priceVip);
      assert.equal(offer.priceVip, offer.legacyVnd / 1000);
    }
  }
  for (const id of ['wk_3', 'wk_5', 'mo_3']) assert.equal(findShopOffer(id), undefined);
  assert.equal(findShopOffer('chapter_91').name, 'Gói Tiếp Sức Hành Trình');
  assert.equal(findShopOffer('mo_4').limit, 2);
  assert.equal(findShopOffer('mo_5').limit, 5);
  assert.notDeepEqual(findShopOffer('mo_4').rewards, findShopOffer('mo_5').rewards);
});

test('all gold exchanges debit gems, apply exact gold, replay and history atomically', async () => {
  const f = await fixture();
  for (const [amount, price] of [[6420, 20], [64200, 200], [642000, 2000]]) {
    const before = await f.stored();
    const body = await f.body(`gold_${amount}`, { expectedBalance: before.data.gems, price: 0, currency: 'gold', rewards: { gold: 1e12 } });
    const result = await f.buy(body);
    assert.equal(result.status, 200);
    const receipt = await result.json(), after = await f.stored();
    assert.equal(after.data.gems, before.data.gems - price);
    assert.equal(after.data.gold, before.data.gold + amount);
    assert.equal(after.data.vipCoins, before.data.vipCoins);
    assert.equal(after.revision, before.revision + 1);
    assert.equal(receipt.balanceAfter, after.data.gems);
    assert.equal(receipt.currency, 'gems');
    assert.equal(receipt.price, price);
    assert.equal(typeof receipt.name, 'string');
    const replay = await f.buy(body);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).replayed, true);
    assert.deepEqual(await f.stored(), after);
    const catalog = await f.catalog();
    assert.equal(catalog.revision, after.revision);
    assert.equal(catalog.history[0].requestId, body.requestId);
    assert.equal(catalog.history[0].balanceAfter, after.data.gems);
    assert.deepEqual(catalog.balances, { gold: after.data.gold, gems: after.data.gems, vipCoins: after.data.vipCoins });
  }
});

test('daily offers grant actual schema keys, charge correct currency, enforce daily cap and rollover', async () => {
  const f = await fixture();
  for (let i = 1; i <= 6; i++) {
    const offer = findShopOffer(`ds_${i}`), before = await f.stored();
    assert.equal((await f.buy(await f.body(offer.id))).status, 200);
    const after = await f.stored();
    assert.equal(after.data[offer.currency], before.data[offer.currency] - offer.price);
    assert.equal(after.shopLimits[offer.id].count, 1);
    assert.equal((await f.buy(await f.body(offer.id))).status, 422);
    assert.deepEqual(await f.stored(), after);
  }
  const after = await f.stored();
  assert.equal(after.data.heroShards.hou_yi, 3);
  assert.equal(after.data.gearBag[0].templateId, 'echo_boots');
  assert.equal(after.data.gearBag[0].quality, 'common');
  assert.equal(after.data.wishTokens, 1);
  assert.equal(after.data.wikiOtherItems.wish_token, 1);
  assert.equal(after.data.garden.seeds.sprout, 7);
  assert.deepEqual(after.data.gearScrolls, { boots: 2, weapon: 2 });
  await saves.updateOne({ playerId: f.playerId }, { $set: { shopLimits: { ...after.shopLimits, ds_5: { period: '2000-01-01', count: 1 } } } });
  assert.equal((await f.buy(await f.body('ds_5'))).status, 200);
  assert.equal((await f.stored()).data.gearScrolls.boots, 4);
  assert.equal((await f.catalog()).offers.find(o => o.id === 'ds_5').remaining, 0);
});

test('funds, confirmation binding, malformed requests and forged ownership reject without writes', async () => {
  const f = await fixture({ gems: 19, gold: 699 });
  const before = await f.stored(), body = await f.body('gold_6420');
  assert.equal((await POST(request('POST', null, body))).status, 401);
  assert.equal((await GET(request('GET', null))).status, 401);
  for (const extra of [{ expectedBalance: -1 }, { expectedBalance: '19' }, { expectedBalance: null }, { expectedBalance: 1.1 }, { offerId: '__proto__' }, { offerId: ['gold_6420'] }, { offerId: 'not_real' }, { requestId: ['bad'] }, { revision: 0 }]) {
    assert.equal((await f.buy({ ...body, ...extra })).status, 400);
  }
  assert.equal((await f.buy({ ...body, playerId: 'forged' })).status, 409);
  assert.equal((await f.buy({ ...body, expectedBalance: 20 })).status, 409);
  assert.equal((await f.buy(body)).status, 422);
  assert.equal((await f.buy(await f.body('ds_5'))).status, 422);
  assert.deepEqual(await f.stored(), before);
  const funded = await fixture();
  const confirmed = await funded.body('gold_6420', { expectedBalance: 10000 });
  await saves.updateOne({ playerId: funded.playerId }, { $set: { data: { ...(await funded.stored()).data, gems: 9999 } } });
  assert.equal((await funded.buy(confirmed)).status, 409);
  assert.equal((await funded.stored()).revision, 1);
});

test('same-revision races cannot double spend and replay IDs cannot switch offers', async () => {
  for (const sameId of [true, false]) {
    const f = await fixture(), body = await f.body('gold_6420');
    const responses = await Promise.all([f.buy(body), f.buy({ ...body, requestId: sameId ? body.requestId : randomUUID() })]);
    assert.ok(responses.every(r => [200, 409].includes(r.status)));
    assert.ok(responses.some(r => r.status === 200));
    const after = await f.stored();
    assert.equal(after.data.gems, 9980);
    assert.equal(after.data.gold, 16420);
    assert.equal(after.revision, 2);
    assert.equal(after.shopReceipts.length, 1);
    assert.equal((await f.buy({ ...body, offerId: 'gold_64200' })).status, 409);
    assert.deepEqual(await f.stored(), after);
  }
});

test('history is private, newest-first, bounded to 100; evicted and legacy receipts stay safe', async () => {
  const f = await fixture(), other = await fixture();
  const old = { requestId: randomUUID(), offerId: 'wk_3', priceVip: 1300, rewards: { gems: 6500 }, at: new Date('2026-01-01'), revision: 2 };
  await saves.updateOne({ playerId: f.playerId }, { $set: { shopReceipts: [old] } });
  const replay = await f.buy({ offerId: old.offerId, playerId: f.playerId, revision: 1, requestId: old.requestId });
  assert.equal(replay.status, 200);
  const receipt = await replay.json();
  assert.equal(receipt.priceVip, 1300);
  assert.equal(receipt.price, 1300);
  assert.equal(receipt.currency, 'vipCoins');
  assert.equal(receipt.balanceAfter, null); // Thông tin lịch sử cũ không thể khôi phục.
  const seeded = Array.from({ length: 105 }, (_, i) => ({ ...old, offerId: 'gems_80', requestId: randomUUID(), revision: i + 2, at: new Date(2026, 0, i + 1) }));
  await saves.updateOne({ playerId: f.playerId }, { $set: { shopReceipts: seeded } });
  const history = (await f.catalog()).history;
  assert.equal(history.length, 100);
  assert.equal(history[0].requestId, seeded[104].requestId);
  assert.equal(history[99].requestId, seeded[5].requestId);
  const body = await f.body('gold_6420');
  assert.equal((await f.buy(body)).status, 200);
  const after = await f.stored();
  assert.equal(after.shopReceipts.length, 100);
  assert.equal((await f.catalog()).history[0].requestId, body.requestId);
  assert.deepEqual((await other.catalog()).history, []);
  const forgedGet = new Request(`https://artemis.test/api/shop?playerId=${f.playerId}`, { headers: { cookie: other.cookie } });
  assert.deepEqual((await (await GET(forgedGet)).json()).history, []);
  assert.equal((await other.buy(body)).status, 409);
  await saves.updateOne({ playerId: f.playerId }, { $set: { shopReceipts: [] } });
  assert.equal((await f.buy(body)).status, 409);
  assert.equal((await f.stored()).data.gems, after.data.gems);
});

test('monthly multi-purchase limits and Vietnam period boundaries remain explicit', async () => {
  for (const id of ['mo_4', 'mo_5']) {
    const f = await fixture({ vipCoins: 20000 });
    const offer = findShopOffer(id);
    for (let i = 0; i < offer.limit; i++) assert.equal((await f.buy(await f.body(id))).status, 200);
    const after = await f.stored();
    assert.equal(after.shopLimits[id].count, offer.limit);
    assert.equal((await f.buy(await f.body(id))).status, 422);
    assert.deepEqual(await f.stored(), after);
  }
  for (const period of ['daily', 'weekly']) {
    assert.notEqual(shopPeriodKey(period, Date.parse('2026-11-08T16:59:59Z')), shopPeriodKey(period, Date.parse('2026-11-08T17:00:00Z')));
  }
  assert.notEqual(shopPeriodKey('monthly', Date.parse('2026-11-30T16:59:59Z')), shopPeriodKey('monthly', Date.parse('2026-11-30T17:00:00Z')));
});

test('caps and full bag fail before atomic debit; VIP receipts retain priceVip', async () => {
  const f = await fixture({ gold: 1e12, gearBag: Array.from({ length: 400 }, (_, i) => ({ uid: `full_${i}`, templateId: 'worn_boots', quality: 'common' })) });
  const before = await f.stored();
  for (const id of ['gold_6420', 'ds_2']) assert.equal((await f.buy(await f.body(id))).status, 422);
  assert.deepEqual(await f.stored(), before);
  const vip = await fixture();
  const body = await vip.body('gems_80');
  const response = await vip.buy(body);
  assert.equal(response.status, 200);
  const receipt = await response.json();
  assert.equal(receipt.priceVip, 24);
  assert.equal(receipt.price, 24);
  assert.equal(receipt.currency, 'vipCoins');
  assert.equal(receipt.balanceAfter, 9976);
  assert.equal((await vip.stored()).data.gems, 10160);
  assert.equal((await (await vip.buy(body)).json()).priceVip, 24);
});
