// LOCAL ONLY characterization of base 3838b40, not desired security contracts.
// Deliberately outside npm's *.test.mjs glob; do not call any API or database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/save/schema.js';
import { validateEconomyDelta, validateSeasonDelta } from '../lib/economy.js';
import { signSession, verifySessionToken } from '../lib/auth.js';
import { POST as logout } from '../api/auth/logout.js';
const clean = (raw) => { const r = sanitizeSave(raw); assert.equal(r.ok, true); return r.data; };

test('BASELINE HOLE: first save accepts 1e12 gold and gems', () => {
  const data = clean({ gold: 1e12, gems: 1e12 });
  assert.equal(data.gold, 1e12); assert.equal(data.gems, 1e12);
  assert.equal(validateEconomyDelta(null, data).ok, true);
  assert.equal(validateSeasonDelta(null, data).ok, true);
  console.log('initial accepted:', JSON.stringify({ gold: data.gold, gems: data.gems }));
});
test('BASELINE HOLE: oversized initial balance clamps before hard-cap validation', () => {
  const data = clean({ gold: 1e15, gems: 1e15 });
  assert.equal(data.gold, 1e12); assert.equal(data.gems, 1e12);
  assert.equal(validateEconomyDelta(null, data).ok, true);
});
test('BASELINE HOLE: four consecutive allowed deltas need no gameplay evidence', () => {
  let prev = clean({ gold: 0, gems: 0 });
  for (let i = 0; i < 4; i++) {
    const next = clean({ gold: prev.gold + 500000, gems: prev.gems + 20000 });
    assert.equal(validateEconomyDelta(prev, next, 1).ok, true); prev = next;
  }
  assert.equal(prev.gold, 2000000); assert.equal(prev.gems, 80000);
  console.log('four local revisions accepted:', JSON.stringify({ gold: prev.gold, gems: prev.gems }));
});
test('BASELINE HOLE: non-currency progression is not authorized by economy validators', () => {
  const prev = clean({});
  const next = clean({ stamina: 1e9, gearLevel: 999, talents: { atk: 1000000 }, gearScrolls: { weapon: 1000000 }, winsByChapter: { 1: 1000000 } });
  assert.equal(next.stamina, 1e9); assert.equal(next.gearLevel, 999);
  assert.equal(next.gearScrolls.weapon, 1000000);
  assert.equal(validateEconomyDelta(prev, next).ok, true);
  assert.equal(validateSeasonDelta(prev, next).ok, true);
});
test('guard: established save rejects huge gold jump', () => {
  assert.equal(validateEconomyDelta(clean({}), clean({ gold: 1e12 })).code, 'ECONOMY_GOLD_JUMP');
});
test('guard: initial season rejects unearned tokens', () => {
  assert.equal(validateSeasonDelta(null, clean({ season: { tokens: 120 } })).code, 'SEASON_INITIAL_REWARD');
});
test('projection bug: full season permits sacrifice, api projection loses previous season', () => {
  const prev = clean({ season: { season: 1, career: 'ranger', tokens: 0, powerSacrificed: 0 } });
  const next = clean({ season: { season: 1, career: 'ranger', tokens: 60, powerSacrificed: 0.02 } });
  assert.equal(validateSeasonDelta(prev, next).ok, true);
  const apiProjection = { gold: prev.gold, gems: prev.gems, lifetimeStats: prev.lifetimeStats };
  assert.equal(validateSeasonDelta(apiProjection, next).code, 'SEASON_INITIAL_REWARD');
});
test('BASELINE HOLE: local synthetic JWT still verifies after logout', async () => {
  process.env.JWT_SECRET = 'audit-local-synthetic-key-not-a-real-secret-3838b40';
  const token = await signSession({ sub: '000000000000000000000001' });
  const response = await logout();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await verifySessionToken(token)).sub, '000000000000000000000001');
});
test('BASELINE robustness throws; patched cookie reader fails closed', async () => {
  const { execFileSync } = await import('node:child_process');
  const { runInNewContext } = await import('node:vm');
  const { readSessionToken } = await import('../lib/auth.js');
  const source = execFileSync('git', ['show', '3838b40:lib/auth.js'], {encoding:'utf8'});
  const legacy = source.slice(source.indexOf('export function readSessionToken('), source.indexOf('export function sessionCookie('));
  const originalReader = runInNewContext(legacy.replace('export function', 'function') + '; readSessionToken', {SESSION_COOKIE:'artemis_session'});
  const request = new Request('http://audit.invalid', { headers: { cookie: 'artemis_session=%ZZ' } });
  assert.throws(() => originalReader(request), {name:'URIError'});
  assert.equal(readSessionToken(request), null);
});
