import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sanitizeSave, MAX_SAVE_BYTES } from '../lib/saveSchema.js';
import { validateEconomyDelta, validateSeasonDelta } from '../lib/economy.js';
import { validateEconomyBudget } from '../lib/economyLedger.js';

// Execute the actual route body with isolated Mongo/auth seams; never import
// Mongo or read .env. The sanitizer and economy validators are real dependencies.
const source = fs.readFileSync(new URL('../api/save.js', import.meta.url), 'utf8');
const clone = value => structuredClone(value);
const season = (over = {}) => ({ season: 1, career: 'blade', tokens: 120,
  boss: 'ironhide', bossHp: 700, bossMaxHp: 1000, bossDefeated: false,
  powerSacrificed: 0.04, log: [], ...over });
function harness(initial = null, ownerId) {
  let doc = clone(initial);
  const writes = [];
  const matches = query => doc && Object.entries(query).every(([key, value]) => {
    if (key === 'revision' && value && typeof value === 'object') return !('revision' in doc);
    return doc[key] === value;
  });
  const saves = {
    async findOne(query, options = {}) {
      if (!matches(query)) return null;
      if (!options.projection) return clone(doc);
      const projected = {};
      for (const key of Object.keys(options.projection)) {
        const [root, child] = key.split('.');
        if (!(root in doc)) continue;
        if (child) {
          if (doc[root] && child in doc[root]) (projected[root] ||= {})[child] = clone(doc[root][child]);
        } else projected[root] = clone(doc[root]);
      }
      return projected;
    },
    async updateOne(query, update, options = {}) {
      writes.push({ query: clone(query), options: clone(options) });
      if (!matches(query)) {
        if (!options.upsert) return { matchedCount: 0 };
        if (doc) throw Object.assign(new Error('duplicate player'), { code: 11000 });
        doc = { ...clone(update.$setOnInsert), ...clone(update.$set) };
        return { matchedCount: 0, upsertedCount: 1 };
      }
      Object.assign(doc, clone(update.$set));
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async insertOne(value) {
      writes.push({ insert: clone(value) });
      if (doc) throw Object.assign(new Error('duplicate player'), { code: 11000 });
      doc = clone(value);
      return { acknowledged: true };
    },
  };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const context = vm.createContext({
    getMongoDb: async () => ({ collection: () => saves }), COLLECTIONS: { saves: 'saves' },
    getCurrentPlayer: async request => request.player === null ? null : (request.player || { _id: 'A', username: 'alice' }),
    json, fail: (error, status) => json({ ok: false, error }, status),
    readJsonBody: async request => ({ ok: true, data: await request.json() }),
    bumpRateLimit: async () => ({ allowed: true }), clientIp: () => 'offline',
    sanitizeSave, MAX_SAVE_BYTES, validateEconomyDelta, validateSeasonDelta,
    // Ngân sách kinh tế theo đồng hồ server (Đợt 6).
    validateEconomyBudget,
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace(/export /g, '') + '\nthis.route = { GET, PUT };', context);
  return {
    doc: () => clone(doc), writes,
    async put(data, ...revisions) {
      const revision = revisions.length ? revisions[0] : 1;
      const request = new Request('http://offline.invalid/api/save', { method: 'PUT',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data, revision, playerId: ownerId }) });
      const response = await context.route.PUT(request);
      return { status: response.status, data: await response.json() };
    },
    async get(player) {
      const response = await context.route.GET({ player });
      return { status: response.status, data: await response.json() };
    },
  };
}

test('a stale tab cannot save a different account snapshot after the session cookie changes', async () => {
  const h = harness({ playerId: 'A', revision: 1, data: { gold: 100 } }, 'B');
  assert.equal((await h.put({ gold: 5 })).status, 409);
  assert.equal(h.doc().data.gold, 100);
  assert.equal(h.writes.length, 0);
});

test('GET identifies the save owner even when the account has no snapshot', async () => {
  for (const initial of [null, { playerId: 'A', revision: 1, data: { gold: 100 } }]) {
    const h = harness(initial);
    assert.equal((await h.get()).data.playerId, 'A');
  }
});

test('concurrent API writes using one revision accept exactly one snapshot', async () => {
  const h = harness({ playerId: 'A', revision: 1, data: { gold: 100, gems: 0 } });
  const results = await Promise.all([h.put({ gold: 101 }), h.put({ gold: 102 })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(h.doc().revision, 2);
  assert.equal(results.find(r => r.status === 409).data.serverRevision, 2);
});

test('concurrent first saves cannot overwrite the first successful insert', async () => {
  const h = harness();
  const results = await Promise.all([h.put({ gold: 101 }, 0), h.put({ gold: 102 }, 0)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(h.doc().revision, 1);
});

test('unsafe or missing revisions never authorize overwriting an existing snapshot', async () => {
  for (const revision of [undefined, null, '', '1', false, -1, 1.5, 'broken']) {
    const h = harness({ playerId: 'A', revision: 1, data: { gold: 100 } });
    const result = await h.put({ gold: 50 }, revision);
    assert.equal(result.status, 400, 'revision=' + JSON.stringify(revision));
    assert.equal(h.doc().data.gold, 100);
    assert.equal(h.writes.length, 0);
  }
});

test('legacy document without revision uses the same revision for GET and guarded PUT', async () => {
  const h = harness({ playerId: 'A', data: { gold: 9000000, gems: 40 } });
  const loaded = await h.get();
  const result = await h.put(loaded.data.data, loaded.data.revision);
  assert.equal(result.status, 200);
  assert.equal(h.doc().revision, loaded.data.revision + 1);
  assert.equal(h.doc().data.gold, 9000000);
});

test('a nonzero revision cannot create a missing save', async () => {
  const h = harness();
  assert.equal((await h.put({ gold: 100 }, 8)).status, 409);
  assert.equal(h.doc(), null);
});

test('existing season survives an ordinary API save with nonzero earned tokens', async () => {
  const data = sanitizeSave({ gold: 9000000, gems: 40, season: season() }).data;
  const h = harness({ playerId: 'A', revision: 1, data });
  const result = await h.put(data);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.deepEqual(h.doc().data, sanitizeSave(data).data);
  assert.equal(h.doc().revision, 2);
});
