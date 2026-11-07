import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');
const adminName = `vipadmin_${randomBytes(4).toString('hex')}`;
process.env.ADMIN_USERNAMES = adminName;

const { POST: register } = await import('../api/auth/register.js');
const { GET: getSave, PUT: putSave } = await import('../api/save.js');
const { PATCH: adminPatch, GET: adminPlayers } = await import('../api/admin/players.js');
const { GET: adminStats } = await import('../api/admin/stats.js');
const { getMongoDb, COLLECTIONS } = await import('../lib/mongo.js');

function request(method, path, cookie, body) {
  return new Request(`https://artemis.test${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function account(username) {
  const response = await register(request('POST', '/api/auth/register', null, { username, password: 'matkhau-rat-dai-2026' }));
  assert.equal(response.status, 201);
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

test('only admin grants VIP coins; player save cannot mint or erase them', async () => {
  const adminCookie = await account(adminName);
  const userCookie = await account(`vipuser_${randomBytes(4).toString('hex')}`);
  let player = await (await getSave(request('GET', '/api/save', userCookie))).json();
  assert.equal(player.data.vipCoins, 0);

  const denied = await adminPatch(request('PATCH', '/api/admin/players', userCookie, {
    playerId: player.playerId, action: 'grant', payload: { vipCoins: 50 },
  }));
  assert.equal(denied.status, 403);

  for (const payload of [{ vipCoins: -1 }, { vipCoins: 1.5 }, { vipCoins: 1_000_001 }, {}]) {
    const invalid = await adminPatch(request('PATCH', '/api/admin/players', adminCookie, {
      playerId: player.playerId, action: 'grant', payload,
    }));
    assert.equal(invalid.status, 400);
  }

  const grantBody = { playerId: player.playerId, action: 'grant', payload: { vipCoins: 50 } };
  const granted = await adminPatch(request('PATCH', '/api/admin/players', adminCookie, grantBody));
  assert.equal(granted.status, 200);
  assert.equal((await granted.json()).balance.vipCoins, 50);
  const stale = await putSave(request('PUT', '/api/save', userCookie, {
    playerId: player.playerId, revision: player.revision,
    data: { ...player.data, vipCoins: 999_999 },
  }));
  assert.equal(stale.status, 409);
  player = await (await getSave(request('GET', '/api/save', userCookie))).json();
  assert.equal(player.data.vipCoins, 50);

  for (const forgedBalance of [999_999, 0]) {
    const response = await putSave(request('PUT', '/api/save', userCookie, {
      playerId: player.playerId, revision: player.revision,
      data: { ...player.data, vipCoins: forgedBalance },
    }));
    assert.equal(response.status, 200);
    player = await (await getSave(request('GET', '/api/save', userCookie))).json();
    assert.equal(player.data.vipCoins, 50);
  }

  const listed = await (await adminPlayers(request('GET', '/api/admin/players', adminCookie))).json();
  assert.equal(listed.rows.find(row => row.id === player.playerId).vipCoins, 50);
  assert.equal(JSON.stringify(listed).includes('passwordHash'), false);
  const stats = await (await adminStats(request('GET', '/api/admin/stats', adminCookie))).json();
  assert.equal(stats.economy.totalVipCoins, 50);
  const database = await getMongoDb();
  const save = await database.collection(COLLECTIONS.saves).findOne({ playerId: player.playerId });
  assert.equal(save.adminCurrencyLog.at(-1).vipCoins, 50);
});
