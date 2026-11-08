import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');
const adminName = `shopadmin_${randomBytes(3).toString('hex')}`;
process.env.ADMIN_USERNAMES = adminName;

const { POST: register } = await import('../../api/auth/register.js');
const { PATCH: grant } = await import('../../api/admin/players.js');
const { GET: getSave, PUT: putSave } = await import('../../api/save.js');
const { getMongoDb, COLLECTIONS } = await import('../../lib/mongo.js');
const routeUrl = new URL('../../api/privileges.js', import.meta.url);
const catalogUrl = new URL('../../lib/shop/catalog.js', import.meta.url);
function request(method, cookie, body) {
  return new Request('https://artemis.test/api/shop', {
    method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function account(username) {
  const response = await register(request('POST', null, { username, password: 'shop-test-password-only' }));
  assert.equal(response.status, 201);
  return (response.headers.get('set-cookie') || '').split(';')[0];
}
const snapshot = async cookie => (await getSave(request('GET', cookie))).json();

test('VIP shop uses authoritative prices, atomic rewards, limits and replay-safe purchases', async t => {
  assert.ok(fs.existsSync(routeUrl), 'Cần API shop trừ xu VIP thật');
  assert.ok(fs.existsSync(catalogUrl), 'Cần catalog giá duy nhất trên server');
  const { GET, POST } = await import(routeUrl);
  const { SHOP_OFFERS, shopPeriodKey } = await import(catalogUrl);
  const admin = await account(adminName);
  const cookie = await account(`shopuser_${randomBytes(3).toString('hex')}`);
  const save = await snapshot(cookie);
  const fund = async amount => {
    const result = await grant(request('PATCH', admin, { playerId: save.playerId, action: 'grant', payload: { vipCoins: amount } }));
    assert.equal(result.status, 200);
  };
  const bodyFor = async offerId => {
    const current = await snapshot(cookie);
    return { offerId, playerId: current.playerId, revision: current.revision, requestId: randomUUID() };
  };

  await t.test('all 28 former money offers convert exactly at 1000 VND per VIP coin', async () => {
    assert.equal(SHOP_OFFERS.length, 28);
    assert.equal(new Set(SHOP_OFFERS.map(o => o.id)).size, SHOP_OFFERS.length);
    for (const offer of SHOP_OFFERS) {
      assert.equal(offer.priceVip, offer.legacyVnd / 1000, offer.id);
      assert.ok(Number.isSafeInteger(offer.priceVip) && offer.priceVip > 0);
    }
    const response = await GET(request('GET', cookie));
    assert.equal(response.status, 200);
    const catalog = await response.json();
    assert.equal(catalog.playerId, save.playerId);
    assert.equal(catalog.offers.length, SHOP_OFFERS.length);
    assert.equal((await GET(request('GET', null))).status, 401);
  });
  await t.test('anonymous, forged owner, price, unknown offers and insufficient funds cannot grant rewards', async () => {
    const body = await bodyFor('gems_80');
    assert.equal((await POST(request('POST', null, body))).status, 401);
    assert.equal((await POST(request('POST', cookie, { ...body, playerId: 'someone-else' }))).status, 409);
    assert.equal((await POST(request('POST', cookie, { ...body, offerId: '__proto__' }))).status, 400);
    assert.equal((await POST(request('POST', cookie, { ...body, priceVip: 0, gems: 999999 }))).status, 422);
    assert.equal((await POST(request('POST', cookie, { ...body, revision: undefined }))).status, 400);
    assert.equal((await POST(request('POST', cookie, { ...body, requestId: 'bad' }))).status, 400);
    assert.equal((await POST(request('POST', cookie, { ...body, requestId: [body.requestId] }))).status, 400);
    assert.deepEqual((await snapshot(cookie)).data, save.data);
  });
  await fund(1000000);
  await t.test('every catalog offer charges its price and awards the documented inventory', async () => {
    for (const offer of SHOP_OFFERS) {
      const before = await snapshot(cookie);
      const body = await bodyFor(offer.id);
      const response = await POST(request('POST', cookie, { ...body, priceVip: 0, rewards: { gems: 9999999 } }));
      assert.equal(response.status, 200, offer.id);
      const after = await snapshot(cookie);
      assert.equal(after.data.vipCoins, before.data.vipCoins - offer.priceVip, offer.id);
      assert.equal(after.revision, before.revision + 1, offer.id);
      for (const [key, amount] of Object.entries(offer.rewards)) {
        if (key === 'sTierGear') {
          assert.equal(after.data.gearBag.length, before.data.gearBag.length + amount);
          assert.equal(after.data.gearBag[0].quality, 'epic');
        } else if (key === 'scrollsEach') {
          for (const slot of ['weapon', 'armor', 'helmet', 'ring', 'necklace', 'boots']) {
            assert.equal(after.data.gearScrolls[slot], (before.data.gearScrolls[slot] || 0) + amount);
          }
        } else if (key === 'chromaticKeys') {
          assert.equal(after.data.chestKeys.chromatic_chest_key, (before.data.chestKeys.chromatic_chest_key || 0) + amount);
        } else assert.equal(after.data[key], (before.data[key] || 0) + amount, `${offer.id}:${key}`);
      }
      const replay = await POST(request('POST', cookie, body));
      assert.equal(replay.status, 200, `replay ${offer.id}`);
      assert.equal((await replay.json()).replayed, true);
      assert.deepEqual(await snapshot(cookie), after);
      assert.equal((await POST(request('POST', cookie, { ...body, offerId: 'gems_500' === offer.id ? 'gems_80' : 'gems_500' }))).status, 409);
    }
  });
  await t.test('chapter and periodic limits survive forged save payloads', async () => {
    for (const offerId of ['chapter_91', 'dl_1', 'wk_1', 'mo_1']) {
      assert.equal((await POST(request('POST', cookie, await bodyFor(offerId)))).status, 422, offerId);
    }
    const current = await snapshot(cookie);
    const response = await putSave(request('PUT', cookie, {
      playerId: current.playerId, revision: current.revision,
      data: { ...current.data, vipCoins: 1e9, aurocite: 1e9, shopPurchases: {} },
    }));
    assert.equal(response.status, 200);
    const after = await snapshot(cookie);
    assert.equal(after.data.vipCoins, current.data.vipCoins);
    assert.equal(after.data.aurocite, current.data.aurocite);
    assert.equal((await POST(request('POST', cookie, await bodyFor('chapter_91')))).status, 422);
  });
  await t.test('concurrent purchases never overwrite or double-spend the same revision', async () => {
    await (await getMongoDb()).collection(COLLECTIONS.loginAttempts).deleteMany({ key: `shop:${save.playerId}` });
    const body = await bodyFor('gems_80');
    const before = await snapshot(cookie);
    const responses = await Promise.all([POST(request('POST', cookie, body)), POST(request('POST', cookie, body))]);
    assert.ok(responses.every(r => [200, 409].includes(r.status)));
    const after = await snapshot(cookie);
    assert.equal(after.data.vipCoins, before.data.vipCoins - 24);
    assert.equal(after.data.gems, before.data.gems + 160);
    assert.equal(after.revision, before.revision + 1);
    const distinct = await bodyFor('gems_80');
    const results = await Promise.all([POST(request('POST', cookie, distinct)), POST(request('POST', cookie, { ...distinct, requestId: randomUUID() }))]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  });
  await t.test('periods use Vietnam midnight and Monday week boundaries', () => {
    assert.notEqual(shopPeriodKey('daily', Date.parse('2026-11-08T16:59:59Z')), shopPeriodKey('daily', Date.parse('2026-11-08T17:00:00Z')));
    assert.notEqual(shopPeriodKey('weekly', Date.parse('2026-11-08T16:59:59Z')), shopPeriodKey('weekly', Date.parse('2026-11-08T17:00:00Z')));
    assert.notEqual(shopPeriodKey('monthly', Date.parse('2026-11-30T16:59:59Z')), shopPeriodKey('monthly', Date.parse('2026-11-30T17:00:00Z')));
  });
  await t.test('multi-purchase caps and expired period records are enforced by the API', async () => {
    for (const id of ['mo_4', 'mo_5']) {
      const offer = SHOP_OFFERS.find(o => o.id === id);
      for (let i = 1; i < offer.limit; i++) assert.equal((await POST(request('POST', cookie, await bodyFor(id)))).status, 200);
      const before = await snapshot(cookie);
      assert.equal((await POST(request('POST', cookie, await bodyFor(id)))).status, 422);
      assert.deepEqual(await snapshot(cookie), before);
    }
    const saves = (await getMongoDb()).collection(COLLECTIONS.saves);
    const stored = await saves.findOne({ playerId: save.playerId });
    await saves.updateOne({ playerId: save.playerId }, { $set: { shopLimits: {
      ...stored.shopLimits,
      dl_1: { period: '2000-01-01', count: 1 },
      aurocite_99: { period: shopPeriodKey('monthly'), count: 29 },
    } } });
    for (const id of ['dl_1', 'aurocite_99']) {
      assert.equal((await POST(request('POST', cookie, await bodyFor(id)))).status, 200);
      assert.equal((await POST(request('POST', cookie, await bodyFor(id)))).status, 422);
    }
    const catalog = await (await GET(request('GET', cookie))).json();
    assert.equal(catalog.offers.find(o => o.id === 'aurocite_99').remaining, 0);
  });
  await t.test('a replay whose receipt was pruned still cannot spend its old revision', async () => {
    const body = await bodyFor('gems_80');
    assert.equal((await POST(request('POST', cookie, body))).status, 200);
    const before = await snapshot(cookie);
    const saves = (await getMongoDb()).collection(COLLECTIONS.saves);
    const stored = await saves.findOne({ playerId: save.playerId });
    await saves.updateOne({ playerId: save.playerId }, { $set: { shopReceipts: stored.shopReceipts.filter(r => r.requestId !== body.requestId) } });
    assert.equal((await POST(request('POST', cookie, body))).status, 409);
    assert.deepEqual(await snapshot(cookie), before);
  });
  await t.test('inventory and currency caps reject purchases without charging', async () => {
    const capped = await account(`shopcap_${randomBytes(3).toString('hex')}`);
    const initial = await snapshot(capped);
    assert.equal((await grant(request('PATCH', admin, { playerId: initial.playerId, action: 'grant', payload: { vipCoins: 3000 } }))).status, 200);
    const saves = (await getMongoDb()).collection(COLLECTIONS.saves);
    const funded = await snapshot(capped);
    const fullBag = Array.from({ length: 400 }, (_, i) => ({ uid: `cap_${i}`, templateId: 'crimson_bow', quality: 'epic', level: 1, awakening: 0, sockets: [], affixes: [] }));
    await saves.updateOne({ playerId: initial.playerId }, { $set: { data: { ...funded.data, gearBag: fullBag, gems: 1e12, aurocite: 1e9 } } });
    const before = await snapshot(capped);
    for (const offerId of ['chapter_91', 'gems_80', 'aurocite_99']) {
      const response = await POST(request('POST', capped, { offerId, playerId: initial.playerId, revision: before.revision, requestId: randomUUID() }));
      assert.equal(response.status, 422, offerId);
      assert.deepEqual(await snapshot(capped), before);
    }
  });
  await t.test('server keeps an auditable bounded receipt log outside client snapshots', async () => {
    const stored = await (await getMongoDb()).collection(COLLECTIONS.saves).findOne({ playerId: save.playerId });
    assert.ok(stored.shopReceipts.length >= SHOP_OFFERS.length);
    assert.ok(stored.shopReceipts.every(r => r.requestId && r.offerId && r.priceVip > 0 && r.at));
    assert.ok(stored.shopLimits.chapter_91);
    assert.equal('shopLimits' in (await snapshot(cookie)).data, false);
  });
});
