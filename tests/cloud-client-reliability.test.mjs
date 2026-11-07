import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/cloud.js', import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
function harness(fetcher) {
  const nodes = [], docEvents = {}, events = {}, timers = new Map(), requests = [];
  let timerId = 0, starts = 0, reloads = 0;
  function node(tag) {
    const n = { tag, style: {}, children: [], listeners: {}, classList: { add() {}, remove() {} },
      appendChild(child) { this.children.push(child); }, insertBefore(child) { this.children.unshift(child); },
      remove() { this.removed = true; }, focus() {},
      addEventListener(name, fn) { this.listeners[name] = fn; },
      querySelector(tag) { return this.children.find(n => n.tag === tag) || this.children.map(n => n.querySelector(tag)).find(Boolean); },
    };
    nodes.push(n); return n;
  }
  const window = { addEventListener: (name, fn) => { events[name] = fn; },
    Archero2FusionAPI: { reloadSaveFromStorage() { reloads++; } } };
  const document = { readyState: 'loading', createElement: node,
    getElementById: id => nodes.find(n => n.id === id && !n.removed),
    addEventListener: (name, fn) => { docEvents[name] = fn; },
    head: node('head'), body: node('body'), documentElement: node('html') };
  const context = vm.createContext({ window, document, console, confirm: () => true,
    location: { reload() {} }, localStorage: { length: 0, removeItem() {}, key() {} },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(path, opts) { requests.push({ path, ...opts }); return fetcher(path, opts); },
  });
  vm.runInContext(source, context);
  window.__artemisBootstrap(() => { starts++; });
  return { window, nodes, requests, timers, events,
    cloud: window.ArtemisCloud,
    async boot() { docEvents.DOMContentLoaded(); await settle(); },
    starts: () => starts, reloads: () => reloads,
    async save(data) { window.__ARTEMIS_SAVE_BUFFER = JSON.stringify(data); events['artemis:save']?.(); await settle(); },
    async push() { window.ArtemisCloud.pushNow(); await settle(); },
    async timer(ms) { const item = [...timers].find(([, value]) => value.ms === ms); if (item) { timers.delete(item[0]); item[1].fn(); } await settle(); },
  };
}
const me = () => response({ ok: true, authenticated: true, player: { id: 'A', username: 'alice' } });
const saved = (data = { gold: 100 }, revision = 3) => response({ ok: true, hasSave: true, data, revision });

test('the real game loader migrates an empty snapshot using the current defaults', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('        load() {');
  const end = html.indexOf('        applyMaxAllSystems(', start);
  assert.ok(start > 0 && end > start);
  const load = html.slice(start, end).trim().replace(/,$/, '');
  const written = [];
  const context = vm.createContext({ console, window: { __ARTEMIS_SAVE_BUFFER: '{}' },
    HEROES: [], createDefaultBag: () => [], written });
  vm.runInContext('const state = { gold: 137, normalizeLoadedGear() {}, save() { written.push(this.gold); },' + load + '}; state.load();', context);
  assert.ok(written.length > 0, 'empty snapshot triggers actual migration saves');
  assert.ok(written.every(gold => gold === 137), 'migration would upload current default gold rather than real progress');
});

test('confirmed no-save resets a stale buffer, but existing saves retain their data', async () => {
  for (const remote of [response({ ok: true, hasSave: false, data: null, revision: 0 }), saved({ gold: 9000000, gems: 40 })]) {
    const h = harness(path => path.endsWith('/me') ? me() : remote);
    h.window.__ARTEMIS_SAVE_BUFFER = JSON.stringify({ gold: 88888888, playerName: 'other account' });
    await h.boot();
    assert.equal(h.starts(), 1);
    assert.equal(h.window.__ARTEMIS_SAVE_READY, true);
    const expected = (await remote.json()).data;
    assert.deepEqual(h.window.__ARTEMIS_SAVE_BUFFER === null ? null : JSON.parse(h.window.__ARTEMIS_SAVE_BUFFER), expected);
  }
});

test('a failed character rebuild never marks the game ready', async () => {
  const h = harness(path => path.endsWith('/me') ? me() : saved({ gold: 9000000 }));
  h.window.Archero2FusionAPI.reloadSaveFromStorage = () => false;
  await h.boot();
  assert.equal(h.starts(), 0);
  assert.equal(h.cloud.getState().ready, false);
  assert.equal(h.cloud.getState().authenticated, true);
});

test('a failed reload preserves unsent data and blocks outgoing PUTs', async () => {
  let fail = false;
  const h = harness(path => path.endsWith('/me') ? me() : fail ? response({ ok: false }, 503) : saved());
  await h.boot(); await h.save({ gold: 101 });
  fail = true;
  await assert.rejects(h.cloud.loadCloudSave());
  await h.push(); await h.timer(1200);
  assert.equal(JSON.parse(h.window.__ARTEMIS_SAVE_BUFFER).gold, 101);
  assert.equal(h.requests.filter(r => r.method === 'PUT').length, 0);
  assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
});

test('different payloads with a colliding short hash are still saved', async () => {
  const h = harness((path, opts) => path.endsWith('/me') ? me()
    : opts.method === 'GET' ? saved({ gold: 100, playerName: 'Aa' }) : response({ ok: true, revision: 4 }));
  await h.boot(); await h.save({ gold: 100, playerName: 'B@' }); await h.push();
  assert.equal(h.requests.filter(r => r.method === 'PUT').length, 1);
});

test('HTTP failures or invalid acknowledgement revisions never clear dirty progress', async t => {
  for (const ack of [response({ ok: true, revision: 4 }, 500), response({ ok: true }), response({ ok: true, revision: 3 })]) {
    await t.test(JSON.stringify(ack), async () => {
      const h = harness((path, opts) => path.endsWith('/me') ? me() : opts.method === 'GET' ? saved() : ack);
      await h.boot(); await h.save({ gold: 101 }); await h.push();
      assert.equal(h.cloud.getState().dirty, true);
      assert.equal(h.cloud.getState().revision, 3);
    });
  }
});

test('a cloud snapshot returned for a different account never enters the game', async () => {
  const h = harness(path => path.endsWith('/me') ? me()
    : response({ ok: true, playerId: 'B', hasSave: true, data: { gold: 999 }, revision: 3 }));
  await h.boot();
  assert.equal(h.starts(), 0);
  assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
});

test('client PUT binds the snapshot to the identity that loaded it', async () => {
  const h = harness((path, opts) => path.endsWith('/me') ? me()
    : opts.method === 'GET' ? saved() : response({ ok: true, revision: 4 }));
  await h.boot(); await h.save({ gold: 101 }); await h.push();
  assert.equal(JSON.parse(h.requests.find(r => r.method === 'PUT').body).playerId, 'A');
});

test('overlapping client saves serialize and retain newer dirty progress until acknowledged', async () => {
  const pending = [];
  const h = harness((path, opts) => {
    if (path.endsWith('/me')) return me();
    if (opts.method === 'GET') return saved();
    const request = deferred(); pending.push(request); return request.promise;
  });
  await h.boot();
  await h.save({ gold: 101 }); await h.push();
  await h.save({ gold: 102 }); await h.push();
  assert.equal(pending.length, 1, 'second PUT must wait for the first revision');
  pending[0].resolve(response({ ok: true, revision: 4 })); await settle();
  assert.equal(h.cloud.getState().dirty, true, 'newer progress is not yet acknowledged');
  await h.timer(1200);
  assert.equal(pending.length, 2);
  assert.equal(JSON.parse(h.requests.filter(r => r.method === 'PUT')[1].body).revision, 4);
  pending[1].resolve(response({ ok: true, revision: 5 })); await settle();
  assert.equal(h.cloud.getState().dirty, false);
});

test('login submission is single-flight until the cloud snapshot has loaded', async () => {
  const login = deferred();
  const h = harness(path => path.endsWith('/me') ? response({ ok: true, authenticated: false }) : login.promise);
  await h.boot();
  h.nodes.find(n => n.name === 'username').value = 'alice';
  h.nodes.find(n => n.name === 'password').value = 'not-a-real-password';
  const submit = h.nodes.find(n => n.tag === 'form').listeners.submit;
  submit({ preventDefault() {} });
  submit({ preventDefault() {} });
  await settle();
  assert.equal(h.requests.filter(r => r.path.endsWith('/login')).length, 1);
});

test('login snapshot failure is caught by the form and leaves retry enabled', async () => {
  const h = harness(path => path.endsWith('/me') ? response({ ok: true, authenticated: false })
    : path.endsWith('/login') ? response({ ok: true, player: { id: 'A', username: 'alice' } })
    : response({ ok: false }, 500));
  await h.boot();
  h.nodes.find(n => n.name === 'username').value = 'alice';
  h.nodes.find(n => n.name === 'password').value = 'not-a-real-password';
  h.nodes.find(n => n.tag === 'form').listeners.submit({ preventDefault() {} });
  await settle();
  assert.equal(h.starts(), 0);
  assert.equal(h.nodes.find(n => n.type === 'submit').disabled, false);
  assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
});

test('a failed cloud load never boots defaults or unlocks writes', async t => {
  for (const failure of [() => response({ ok: false }, 500), () => Promise.reject(new Error('offline')),
    () => response({}), () => response({ ok: true, hasSave: true, data: null, revision: 3 }),
    () => response({ ok: true, hasSave: true, data: {}, revision: 3 }),
    () => response({ ok: true, hasSave: true, data: { gold: 100 }, revision: 0 }),
    () => ({ ok: true, status: 200, json: async () => { throw new Error('bad JSON'); } })]) {
    await t.test(String(failure), async () => {
      const h = harness(path => path.endsWith('/me') ? me() : failure());
      await h.boot();
      assert.equal(h.starts(), 0);
      assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
      assert.equal(h.cloud.getState().ready, false);
    });
  }
});
