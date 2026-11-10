import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { POST: register } = await import('../api/auth/register.js');
const { getMongoDb, COLLECTIONS } = await import('../lib/mongo.js');
const req = (method, cookie, body) => new Request('https://artemis.test/api/patrol', {
  method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('real authenticated handler persists baseline and atomically grants once with CAS', async () => {
  const route = await import('../api/privileges.js').catch(() => null);
  assert.ok(route, 'patrol API must exist');
  const { createPatrolHandlers } = await import('../lib/patrol/handler.js');
  let now = Date.now();
  const api = createPatrolHandlers({ clock: () => now });
  assert.equal((await api.GET(req('GET'))).status, 401);
  assert.equal((await api.POST(req('POST', null, {}))).status, 401);
  const registration = await register(new Request('https://artemis.test/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: `patrol_${randomBytes(5).toString('hex')}`, password: 'isolated-patrol-test-2026' }),
  }));
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  const first = await (await api.GET(req('GET', cookie))).json();
  assert.equal(first.ok, true);
  assert.equal(first.patrol.elapsedSeconds, 0);
  const saves = (await getMongoDb()).collection(COLLECTIONS.saves);
  let saved = await saves.findOne({ playerId: first.playerId });
  assert.equal(saved.ledger.patrol.lastClaimAt, first.patrol.lastClaimAt);
  assert.equal(saved.revision, first.revision);
  assert.equal((await api.GET(req('GET', cookie))).status, 200);
  assert.equal((await saves.findOne({ playerId: first.playerId })).revision, saved.revision);
  const early = await api.POST(req('POST', cookie, { action: 'claim', revision: saved.revision, requestId: randomUUID() }));
  assert.equal(early.status, 422);
  now += 3600000;
  saved = await saves.findOne({ playerId: first.playerId });
  const originalBudget = { ...saved.ledger }; delete originalBudget.patrol;
  const id = randomUUID(), body = { action: 'claim', revision: saved.revision, requestId: id, seconds: 99999999, rewards: { gold: 1e12 } };
  const response = await api.POST(req('POST', cookie, body));
  assert.equal(response.status, 200);
  const claimed = await response.json();
  assert.equal(claimed.data.gold, saved.data.gold + claimed.rewards.gold);
  assert.equal(claimed.data.patrolExp, (saved.data.patrolExp || 0) + claimed.rewards.exp);
  const after = await saves.findOne({ playerId: first.playerId });
  assert.equal(after.revision, saved.revision + 1);
  const afterBudget = { ...after.ledger }; delete afterBudget.patrol;
  assert.deepEqual(afterBudget, originalBudget);
  const replay = await api.POST(req('POST', cookie, body));
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).replayed, true);
  assert.equal((await saves.findOne({ playerId: first.playerId })).data.gold, after.data.gold);
  assert.equal((await api.POST(req('POST', cookie, { ...body, action: 'quickEnergy' }))).status, 409);
  assert.equal((await api.POST(req('POST', cookie, { ...body, requestId: randomUUID() }))).status, 409);
  assert.equal((await api.POST(req('POST', cookie, { ...body, requestId: 'bad', revision: after.revision }))).status, 400);
  const ad = await api.POST(req('POST', cookie, { action: 'quickAd', revision: after.revision, requestId: randomUUID() }));
  assert.equal(ad.status, 422);
  assert.equal((await ad.json()).code, 'AD_UNAVAILABLE');
  const quickId = randomUUID();
  const concurrent = await Promise.all(Array.from({ length: 2 }, () => api.POST(req('POST', cookie,
    { action: 'quickEnergy', revision: after.revision, requestId: quickId }))));
  assert.ok(concurrent.every(res => res.status === 200));
  const quickSaved = await saves.findOne({ playerId: first.playerId });
  assert.equal(quickSaved.data.stamina, after.data.stamina - 5);
  assert.equal(quickSaved.ledger.patrol.energyUsed, 1);
  assert.equal(quickSaved.revision, after.revision + 1);

  // Distinct concurrent request keys share one revision: only one may debit.
  const distinct = await Promise.all(Array.from({ length: 2 }, () => api.POST(req('POST', cookie,
    { action: 'quickEnergy', revision: quickSaved.revision, requestId: randomUUID() }))));
  assert.deepEqual(distinct.map(res => res.status).sort(), [200, 409]);
  let latest = await saves.findOne({ playerId: first.playerId });
  const lastQuick = await api.POST(req('POST', cookie, { action: 'quickEnergy', revision: latest.revision, requestId: randomUUID() }));
  assert.equal(lastQuick.status, 200);
  latest = await saves.findOne({ playerId: first.playerId });
  assert.equal(latest.ledger.patrol.energyUsed, 3);
  assert.equal(latest.data.stamina, 5);
  assert.equal((await api.POST(req('POST', cookie, { action: 'quickEnergy', revision: latest.revision, requestId: randomUUID() }))).status, 422);
  now = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`) + 86400000;
  assert.equal((await (await api.GET(req('GET', cookie))).json()).patrol.quickEnergy.remaining, 3);
  assert.equal((await api.POST(req('POST', cookie, { action: 'quickEnergy', revision: latest.revision, requestId: randomUUID() }))).status, 200);
  latest = await saves.findOne({ playerId: first.playerId });
  assert.equal(latest.data.stamina, 0);
  assert.equal(latest.ledger.patrol.energyUsed, 1);
  assert.equal((await api.POST(req('POST', cookie, { action: 'quickEnergy', revision: latest.revision, requestId: randomUUID() }))).status, 422);

  const { PUT: putSave } = await import('../api/save.js');
  const forged = await putSave(new Request('https://artemis.test/api/save', { method: 'PUT',
    headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ playerId: first.playerId,
      revision: latest.revision, data: { ...latest.data, patrolExp: 1e12,
        patrol: { lastClaimAt: 0, energyUsed: 0 } }, ledger: { patrol: { lastClaimAt: 0 } } }) }));
  assert.equal(forged.status, 200);
  const protectedSave = await saves.findOne({ playerId: first.playerId });
  assert.equal(protectedSave.data.patrolExp, latest.data.patrolExp);
  assert.deepEqual(protectedSave.ledger.patrol, latest.ledger.patrol);

  // An overflow rejects the whole transaction: no timestamp, quota, or stamina debit.
  await saves.updateOne({ playerId: first.playerId }, { $set: { data: { ...protectedSave.data, gold: 1e12, stamina: 20 } } });
  const overflowBefore = await saves.findOne({ playerId: first.playerId });
  const overflow = await api.POST(req('POST', cookie, { action: 'quickEnergy', revision: overflowBefore.revision, requestId: randomUUID() }));
  assert.equal(overflow.status, 422);
  assert.deepEqual(await saves.findOne({ playerId: first.playerId }), overflowBefore);
  await saves.updateOne({ playerId: first.playerId }, { $set: { ledger: { ...overflowBefore.ledger,
    patrol: { ...overflowBefore.ledger.patrol, energyUsed: -1 } } } });
  const corrupted = await api.GET(req('GET', cookie));
  assert.equal(corrupted.status, 422);
  assert.equal((await corrupted.json()).code, 'PATROL_STATE_INVALID');
});
