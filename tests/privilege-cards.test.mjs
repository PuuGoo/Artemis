import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { hasVipPass, VIP_CARD_DURATION_MS } from '../lib/privilegeCards.js';

process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');
const adminName = `passadmin_${randomBytes(3).toString('hex')}`;
process.env.ADMIN_USERNAMES = adminName;

const { POST: register } = await import('../api/auth/register.js');
const { PATCH: grant } = await import('../api/admin/players.js');
const { POST: purchase } = await import('../api/privileges.js');
const { GET: getSave, PUT: putSave } = await import('../api/save.js');

function request(method, path, cookie, body) {
  return new Request(`https://artemis.test${path}`, {
    method,
    headers: { 'content-type':'application/json', ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body:JSON.stringify(body) }),
  });
}
async function account(name) {
  const response = await register(request('POST', '/api/auth/register', null, { username:name, password:'matkhau-rat-dai-2026' }));
  assert.equal(response.status, 201);
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

test('VIP cards cost server-owned coins, expire, renew, and cannot be forged by save', async () => {
  const adminCookie = await account(adminName);
  const userCookie = await account(`passuser_${randomBytes(3).toString('hex')}`);
  const before = await (await getSave(request('GET', '/api/save', userCookie))).json();
  assert.deepEqual(before.data.vipPasses, { hunting:0, cave:0, sealing:0 });
  assert.equal((await purchase(request('POST', '/api/privileges', userCookie, { cardId:'hunting' }))).status, 422);
  assert.equal((await purchase(request('POST', '/api/privileges', userCookie, { cardId:'fake' }))).status, 400);
  assert.equal((await purchase(request('POST', '/api/privileges', null, { cardId:'hunting' }))).status, 401);

  const granted = await grant(request('PATCH', '/api/admin/players', adminCookie, {
    playerId:before.playerId, action:'grant', payload:{ vipCoins:2000 },
  }));
  assert.equal(granted.status, 200);
  const boughtAt = Date.now();
  for (const cardId of ['hunting','cave','sealing']) {
    const response = await purchase(request('POST', '/api/privileges', userCookie, { cardId }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.cardId, cardId);
    assert.equal(hasVipPass({ [cardId]:result.expiresAt }, cardId, boughtAt), true);
  }
  let save = await (await getSave(request('GET', '/api/save', userCookie))).json();
  assert.equal(save.data.vipCoins, 500);
  const oldExpiry = save.data.vipPasses.hunting;
  assert.equal((await purchase(request('POST', '/api/privileges', userCookie, { cardId:'hunting' }))).status, 200);
  save = await (await getSave(request('GET', '/api/save', userCookie))).json();
  assert.equal(save.data.vipCoins, 0);
  assert.equal(save.data.vipPasses.hunting, oldExpiry + VIP_CARD_DURATION_MS);
  assert.equal((await purchase(request('POST', '/api/privileges', userCookie, { cardId:'hunting' }))).status, 422);

  const forged = await putSave(request('PUT', '/api/save', userCookie, {
    playerId:save.playerId, revision:save.revision,
    data:{ ...save.data, vipCoins:9999, vipPasses:{ hunting:Date.now()+100*VIP_CARD_DURATION_MS, cave:0, sealing:0 } },
  }));
  assert.equal(forged.status, 200);
  const after = await (await getSave(request('GET', '/api/save', userCookie))).json();
  assert.equal(after.data.vipCoins, 0);
  assert.deepEqual(after.data.vipPasses, save.data.vipPasses);
  assert.equal(hasVipPass({ hunting:Date.now()-1 }, 'hunting'), false);
});
