import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { RUNE_TIERS, mergeRuneStones } from '../lib/runeCatalog.js';

process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');
const { POST: register } = await import('../api/auth/register.js');
const { POST: runeAction } = await import('../api/runes.js');
const { GET: getSave, PUT: putSave } = await import('../api/save.js');
const { getMongoDb, COLLECTIONS } = await import('../lib/mongo.js');
const req = (method, path, cookie, body) => new Request(`https://artemis.test${path}`, {
  method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
async function fixture() {
  const response = await register(req('POST', '/api/auth/register', null, {
    username: `merge_${randomBytes(5).toString('hex')}`, password: 'merge-test-password-2026',
  }));
  assert.equal(response.status, 201);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const read = async () => (await getSave(req('GET', '/api/save', cookie))).json();
  const saved = await read();
  const saves = (await getMongoDb()).collection(COLLECTIONS.saves);
  await saves.updateOne({ playerId: saved.playerId }, { $set: { data: { ...saved.data, runes: { rune_flame: 4 },
    runeStones: { rune_flame: { epic: 3, normal: 2 } },
    equippedRuneSlots: { etched: [], blessing: [], enhancement: ['rune_flame'], ability: [] } } } });
  return { cookie, read, saved: await read() };
}

test('merge API consumes exactly three, preserves sockets/resources, persists and rejects replay', async () => {
  const f = await fixture(), before = f.saved;
  const body = { action: 'merge', runeId: 'rune_flame', tier: 'epic', revision: before.revision };
  const response = await runeAction(req('POST', '/api/runes', f.cookie, body));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.nextTier, 'epic_1');
  const after = await f.read();
  assert.equal(after.data.runeStones.rune_flame.epic, 0);
  assert.equal(after.data.runeStones.rune_flame.epic_1, 1);
  assert.equal(after.data.runeStones.rune_flame.normal, 2);
  assert.equal(after.data.runes.rune_flame, 5);
  assert.deepEqual(after.data.equippedRuneSlots, before.data.equippedRuneSlots);
  for (const field of ['gems', 'gold', 'wikiOtherItems']) assert.deepEqual(after.data[field], before.data[field]);
  assert.equal((await runeAction(req('POST', '/api/runes', f.cookie, body))).status, 409);
  assert.deepEqual((await f.read()).data, after.data);
  const forged = await putSave(req('PUT', '/api/save', f.cookie, {
    playerId: after.playerId, revision: after.revision,
    data: { ...after.data, runeStones: { rune_flame: { mythic: 999 } }, runes: { rune_flame: 11 } },
  }));
  assert.equal(forged.status, 200);
  assert.deepEqual((await f.read()).data.runeStones, after.data.runeStones);
  assert.deepEqual((await f.read()).data.runes, after.data.runes);
});

test('merge API validates auth, exact identity, tier, quantity and revision without writes', async () => {
  const f = await fixture();
  assert.equal((await runeAction(req('POST', '/api/runes', null, { action: 'merge' }))).status, 401);
  const base = { action: 'merge', runeId: 'rune_flame', tier: 'epic', revision: f.saved.revision };
  for (const [changes, status] of [
    [{ runeId: 'unknown' }, 422], [{ tier: 'mythic' }, 422], [{ tier: 'legendary_4' }, 422],
    [{ tier: 'normal' }, 422], [{ revision: undefined }, 400], [{ revision: 0 }, 400],
  ]) {
    assert.equal((await runeAction(req('POST', '/api/runes', f.cookie, { ...base, ...changes }))).status, status);
  }
  assert.deepEqual((await f.read()).data, f.saved.data);
  const responses = await Promise.all([1, 2].map(() => runeAction(req('POST', '/api/runes', f.cookie, base))));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await f.read()).data.runeStones.rune_flame.epic_1, 1);
});

test('all ten reference transitions, exact-quality fodder, cap and no recursive merging', () => {
  for (let i = 0; i < RUNE_TIERS.length - 1; i++) {
    const tier = RUNE_TIERS[i], nextTier = RUNE_TIERS[i + 1];
    const stones = { rune_flame: { [tier]: 6, [nextTier]: 2 }, rune_frost: { [tier]: 9 } };
    const before = structuredClone(stones);
    const result = mergeRuneStones(stones, { rune_flame: i + 2, rune_frost: i + 1 }, 'rune_flame', tier);
    assert.equal(result.stones.rune_flame[tier], 3);
    assert.equal(result.stones.rune_flame[nextTier], 3);
    assert.equal(result.rank, i + 2);
    assert.deepEqual(result.stones.rune_frost, stones.rune_frost);
    assert.deepEqual(stones, before);
    assert.throws(() => mergeRuneStones({ rune_flame: { [tier]: 2 }, rune_frost: { [tier]: 1 } }, {}, 'rune_flame', tier));
  }
  assert.throws(() => mergeRuneStones({ rune_flame: { mythic: 3 } }, {}, 'rune_flame', 'mythic'));
  for (const count of [-3, NaN, Infinity, 3.1, '3']) {
    assert.throws(() => mergeRuneStones({ rune_flame: { normal: count } }, {}, 'rune_flame', 'normal'));
  }
});
