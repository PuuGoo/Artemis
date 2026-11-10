import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the production cloud client; only HTTP, DOM and timers are simulated.
const source = fs.readFileSync(new URL('../public/cloud.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const initial = { gems: 500, wikiOtherItems: { shovel: 2 }, runeStones: {}, runes: {} };
const drops = [{ runeId: 'rune_fire', quality: 0, rank: 7 }, { runeId: 'rune_fire', quality: 3, rank: 8 }];
const confirmed = { ...initial, wikiOtherItems: { shovel: 0, enchantium: 8 }, runeStones: { rune_fire: [1, 0, 0, 1] } };
const details = { promised: false, count: 2, pool: 'elemental_circle', tileIdx: 4, boardCell: 4 };
function harness(fetcher) {
  const nodes = [], events = {}, docEvents = {}, timers = new Map(), requests = [], rebuilt = [];
  let timerId = 0;
  function node(tag) {
    const n = { tag, style: {}, children: [], classList: { add() {}, remove() {} },
      appendChild(child) { this.children.push(child); }, insertBefore(child) { this.children.unshift(child); },
      remove() { this.removed = true; }, focus() {}, addEventListener() {},
      querySelector(tag) { return this.children.find(n => n.tag === tag) || this.children.map(n => n.querySelector(tag)).find(Boolean); } };
    nodes.push(n); return n;
  }
  const window = { addEventListener: (name, fn) => { events[name] = fn; },
    Archero2FusionAPI: { reloadSaveFromStorage() { rebuilt.push(JSON.parse(window.__ARTEMIS_SAVE_BUFFER)); return true; } } };
  const document = { readyState: 'loading', createElement: node,
    getElementById: id => nodes.find(n => n.id === id && !n.removed),
    addEventListener: (name, fn) => { docEvents[name] = fn; }, head: node('head'), body: node('body'), documentElement: node('html') };
  vm.runInNewContext(source, { window, document, console, confirm: () => true,
    location: { reload() {} }, localStorage: { length: 0, removeItem() {}, key() {} },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout(id) { timers.delete(id); },
    async fetch(path, opts) { requests.push({ path, ...opts }); return fetcher(path, opts); } });
  window.__artemisBootstrap(() => {});
  return { window, requests, rebuilt, cloud: window.ArtemisCloud,
    async boot() { docEvents.DOMContentLoaded(); await settle(); rebuilt.length = 0; },
    async save(data) { window.__ARTEMIS_SAVE_BUFFER = JSON.stringify(data); events['artemis:save']?.(); await settle(); },
    async pumpSaves() { window.ArtemisCloud.pushNow(); for (const [id, timer] of [...timers]) if (timer.ms === 1200) { timers.delete(id); timer.fn(); } await settle(); } };
}
function server(overrides = {}) {
  let data = structuredClone(initial), revision = 3;
  return (path, opts) => {
    if (path.endsWith('/me')) return response({ ok: true, authenticated: true, player: { id: 'A', username: 'alice' } });
    if (opts.method === 'GET') return overrides.get?.() ?? response({ ok: true, hasSave: true, playerId: 'A', data, revision });
    if (opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      return overrides.put?.(body) ?? (data = body.data, response({ ok: true, revision: ++revision }));
    }
    if (path === '/api/runes') return overrides.explore?.(JSON.parse(opts.body)) ?? (data = confirmed, response({ ok: true, drops, revision: ++revision }));
    throw new Error(`Unexpected request: ${opts.method} ${path}`);
  };
}

test('rune explore waits for dirty progress flush and posts the acknowledged revision', async () => {
  const put = deferred(), post = deferred();
  const h = harness(server({ put: () => put.promise, explore: () => post.promise }));
  await h.boot(); await h.save({ ...initial, gems: 499 });
  const result = h.cloud.exploreRunes({ ...details, action: 'merge', revision: 999 });
  await settle();
  assert.deepEqual(h.requests.filter(r => r.method !== 'GET').map(r => r.method), ['PUT']);
  assert.deepEqual(JSON.parse(h.requests.at(-1).body), { data: { ...initial, gems: 499 }, revision: 3, playerId: 'A' });
  put.resolve(response({ ok: true, revision: 4 })); await settle();
  assert.deepEqual(JSON.parse(h.requests.at(-1).body), { ...details, action: 'explore', revision: 4 });
  post.resolve(response({ ok: true, drops, revision: 5 }));
  assert.deepEqual(JSON.parse(JSON.stringify(await result)).drops, drops);
});

test('rune explore freezes ordinary writes and concurrent transactions until authoritative refresh completes', async () => {
  const post = deferred(), refresh = deferred(); let gets = 0;
  const h = harness(server({ get: () => ++gets === 1 ? undefined : refresh.promise, explore: () => post.promise }));
  await h.boot(); const pending = h.cloud.exploreRunes(details); await settle();
  assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
  assert.equal(h.cloud.getState().saving, true);
  await assert.rejects(h.cloud.exploreRunes(details));
  await h.save({ ...initial, gems: 999 }); await h.pumpSaves();
  assert.equal(h.requests.filter(r => r.method === 'PUT').length, 0);
  post.resolve(response({ ok: true, drops, revision: 4 })); await settle();
  assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
  await h.pumpSaves(); assert.equal(h.requests.filter(r => r.method === 'PUT').length, 0);
  refresh.resolve(response({ ok: true, hasSave: true, playerId: 'A', data: confirmed, revision: 4 }));
  const receipt = await pending;
  assert.deepEqual(JSON.parse(JSON.stringify(receipt.drops)), drops);
  assert.deepEqual(h.rebuilt, [confirmed]);
  assert.deepEqual(JSON.parse(h.window.__ARTEMIS_SAVE_BUFFER), confirmed);
  assert.equal(h.cloud.getState().revision, 4);
  assert.equal(h.cloud.getState().saving, false);
  assert.equal(h.window.__ARTEMIS_SAVE_READY, true);
  await h.pumpSaves(); assert.equal(h.requests.filter(r => r.method === 'PUT').length, 0);
});

test('lost rune response still refreshes a committed grant before rejecting, without replaying POST', async () => {
  let gets = 0;
  const h = harness(server({ get: () => ++gets === 1 ? undefined : response({ ok: true, hasSave: true, data: confirmed, revision: 4 }),
    explore: () => { throw new Error('response lost after commit'); } }));
  await h.boot();
  await assert.rejects(h.cloud.exploreRunes(details), /response lost after commit/);
  assert.deepEqual(h.requests.map(r => `${r.method} ${r.path}`), ['GET /api/auth/me', 'GET /api/save', 'POST /api/runes', 'GET /api/save']);
  assert.deepEqual(h.rebuilt, [confirmed]);
  assert.equal(h.cloud.getState().revision, 4);
  assert.equal(h.window.__ARTEMIS_SAVE_READY, true);
  await h.pumpSaves(); assert.equal(h.requests.filter(r => r.method === 'PUT').length, 0);
});

test('failed authoritative refresh leaves saves locked after rune exploration', async () => {
  let gets = 0;
  const h = harness(server({ get: () => ++gets === 1 ? undefined : response({ ok: false }, 503) }));
  await h.boot(); await assert.rejects(h.cloud.exploreRunes(details));
  assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
  assert.equal(h.cloud.getState().saving, false);
  await h.save({ ...initial, gems: 999 }); await h.pumpSaves();
  assert.equal(h.requests.filter(r => r.method === 'PUT').length, 0);
  assert.equal(h.rebuilt.length, 0);
});

test('failed progress flush prevents a rune POST', async () => {
  const h = harness(server({ put: () => response({ ok: false, conflict: true }, 409) }));
  await h.boot(); await h.save({ ...initial, gems: 499 });
  await assert.rejects(h.cloud.exploreRunes(details));
  assert.equal(h.requests.filter(r => r.path === '/api/runes').length, 0);
});

test('real dig function builds each receipt drop using draw quality, not collection rank, and waits for popup dismissal', async () => {
  const start = html.indexOf('      async function executeRuneRuinsDig(');
  const end = html.indexOf('\n      // Execute Interactive Activity', start);
  assert.ok(start >= 0 && end > start, 'production dig function must be discoverable');
  const popup = deferred(), calls = [], toasts = []; let reloads = 0, model = initial;
  const h = harness(server()); await h.boot();
  h.window.Archero2FusionAPI.reloadSaveFromStorage = () => { model = JSON.parse(h.window.__ARTEMIS_SAVE_BUFFER); return true; };
  h.window.location = { reload() { reloads++; } };
  h.window.ArtemisRewardResults = { show(receipt) { calls.push(receipt); return popup.promise; } };
  const context = vm.createContext({ window: h.window,
    SaveState: { runeRuinsState: { promisedPool: 'elemental_circle' }, wikiEventsState: { selectedEventId: 'rune_ruins' } },
    RUNES_DATA: [{ id: 'rune_fire', wikiName: 'Fire', icon: '🔥' }], RuneEconomy: { tier() { throw new Error('integer draw quality must take priority over rank'); } },
    SoundFX: { levelUp() {} }, StageHeroAnim: { triggerPose() {} }, showToast: (...args) => toasts.push(args), setTimeout() { throw new Error('unexpected fallback'); } });
  vm.runInContext(`let runeDigging = false;\n${html.slice(start, end)}\nthis.dig = executeRuneRuinsDig;`, context);
  const dig = context.dig(false, 2, 4); await settle();
  assert.equal(calls.length, 1);
  assert.deepEqual(model, confirmed, 'authoritative inventory is rebuilt before the receipt opens');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].rewards)), [
    { name: 'Fire (common)', amount: 1, rarity: 'common', icon: '🔥' },
    { name: 'Fire (epic)', amount: 1, rarity: 'epic', icon: '🔥' },
  ]);
  assert.equal(reloads, 0);
  assert.deepEqual(JSON.parse(h.requests.find(r => r.path === '/api/runes').body), { ...details, action: 'explore', revision: 3 });
  await context.dig(false, 2, 4);
  assert.equal(h.requests.filter(r => r.path === '/api/runes').length, 1, 'popup-open clicks cannot spend again');
  popup.resolve(); await dig;
  assert.equal(reloads, 1);
  assert.deepEqual(toasts, []);
});
