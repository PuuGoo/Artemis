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
  let purchaseId = 0;
  const window = { crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++purchaseId).padStart(12, '0')}` },
    addEventListener: (name, fn) => { events[name] = fn; },
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

test('ledger 422 preserves its exact diagnostic and never masquerades as another-device conflict', async () => {
  const h = harness((path, opts) => path.endsWith('/me') ? me()
    : opts.method === 'GET' ? saved() : response({ ok: false, conflict: true,
      code: 'CAMPAIGN_CHECKPOINT_TRANSITION', detail: 'support_hp_replay',
      error: 'Checkpoint chiến dịch không hợp lệ.', serverRevision: 3, serverData: { gold: 100 } }, 422));
  await h.boot(); await h.save({ gold: 101 });
  assert.equal(await h.cloud.flushCheckpoint(), false);
  const state = h.cloud.getState();
  assert.equal(state.lastErrorCode, 'CAMPAIGN_CHECKPOINT_TRANSITION');
  assert.equal(state.lastErrorDetail, 'support_hp_replay');
  assert.equal(state.lastErrorStatus, 422);
  assert.equal(state.lastErrorRetryable, false);
  assert.notEqual(state.lastError, 'conflict');
  assert.equal(state.revision, 3);
  assert.equal(state.dirty, true);
  assert.equal(JSON.parse(h.window.__ARTEMIS_SAVE_BUFFER).gold, 101);
  assert.ok(h.nodes.some(n => /support_hp_replay/.test(n.textContent || '')));
  assert.ok(!h.nodes.some(n => /thiết bị khác/.test(n.textContent || '')));
});

test('network and server failures remain retryable while revision conflicts require reload', async () => {
  for (const failure of ['network', 429, 503, 409]) {
    let attempts = 0;
    const h = harness((path, opts) => {
      if (path.endsWith('/me')) return me();
      if (opts.method === 'GET') return saved();
      if (++attempts > 1) return response({ok:true,revision:4});
      if (failure === 'network') throw new Error('offline');
      return response({ok:false,conflict:failure === 409,error:'not saved'},failure);
    });
    await h.boot();await h.save({gold:101});
    assert.equal(await h.cloud.flushCheckpoint(),false);
    assert.equal(h.cloud.getState().lastErrorRetryable,failure !== 409);
    if (failure === 409) assert.equal(h.cloud.getState().lastError,'conflict');
    else {
      assert.equal(await h.cloud.flushCheckpoint(),true);
      assert.equal(h.cloud.getState().lastError,'');
      assert.equal(h.cloud.getState().lastErrorStatus,0);
      assert.equal(h.cloud.getState().lastErrorRetryable,false);
    }
  }
});

test('shop purchase flushes pending progress, locks writes, and rebuilds the confirmed server snapshot', async () => {
  const pending = deferred();
  let current = { gold: 100, vipCoins: 100, gems: 50 }, revision = 3;
  const h = harness((path, opts) => {
    if (path.endsWith('/me')) return me();
    if (path === '/api/shop') return pending.promise;
    if (opts.method === 'PUT') { current = JSON.parse(opts.body).data; return response({ ok: true, revision: ++revision }); }
    return saved(current, revision);
  });
  await h.boot(); await h.save({ ...current, gold: 101 });
  assert.equal(typeof h.cloud.purchaseShopOffer, 'function');
  const purchase = h.cloud.purchaseShopOffer('gems_80');
  await settle();
  const requests = h.requests.filter(r => r.method !== 'GET');
  assert.deepEqual(requests.map(r => r.path), ['/api/save', '/api/shop']);
  assert.equal(JSON.parse(requests[1].body).revision, 4);
  assert.equal(JSON.parse(requests[1].body).playerId, 'A');
  assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
  await assert.rejects(h.cloud.purchaseShopOffer('gems_500'));
  current = { ...current, vipCoins: 76, gems: 210 }; revision++;
  pending.resolve(response({ ok: true, offerId: 'gems_80', revision }));
  await purchase;
  assert.deepEqual(JSON.parse(h.window.__ARTEMIS_SAVE_BUFFER), current);
  assert.equal(h.cloud.getState().ready, true);
  assert.equal(h.cloud.getState().dirty, false);
  assert.equal(h.window.__ARTEMIS_SAVE_READY, true);
});

test('lost shop acknowledgement retries the same request and never writes a stale snapshot', async () => {
  let attempts = 0, current = { gold: 100, vipCoins: 100, gems: 50 };
  const h = harness((path, opts) => {
    if (path.endsWith('/me')) return me();
    if (path === '/api/shop') {
      attempts++;
      if (attempts === 1) { current = { ...current, vipCoins: 76, gems: 210 }; throw new Error('lost reply'); }
      return response({ ok: true, replayed: true, offerId: 'gems_80', revision: 4 });
    }
    return saved(current, attempts ? 4 : 3);
  });
  await h.boot();
  assert.equal(typeof h.cloud.purchaseShopOffer, 'function');
  await assert.rejects(h.cloud.purchaseShopOffer('gems_80'));
  assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
  await h.push(); await h.timer(1200);
  assert.equal(h.requests.filter(r => r.method === 'PUT').length, 0);
  await assert.rejects(h.cloud.purchaseShopOffer('gems_500'));
  const result = await h.cloud.purchaseShopOffer('gems_80');
  assert.equal(result.replayed, true);
  const posts = h.requests.filter(r => r.path === '/api/shop');
  assert.equal(posts.length, 2);
  assert.equal(posts[0].body, posts[1].body);
  assert.equal(h.window.__ARTEMIS_SAVE_READY, true);
  assert.equal(JSON.parse(h.window.__ARTEMIS_SAVE_BUFFER).vipCoins, 76);
});

test('failed flush blocks purchase, and rejected prices never fabricate local rewards', async () => {
  const h = harness((path, opts) => path.endsWith('/me') ? me()
    : path === '/api/shop' ? response({ ok: false, error: 'Không đủ xu VIP' }, 422)
    : opts.method === 'PUT' ? response({ ok: false, error: 'Lưu thất bại' }, 503) : saved());
  await h.boot();
  assert.equal(typeof h.cloud.purchaseShopOffer, 'function');
  await assert.rejects(h.cloud.purchaseShopOffer('gems_80'), /Không đủ xu VIP/);
  assert.equal(h.window.__ARTEMIS_SAVE_READY, true);
  assert.equal(JSON.parse(h.window.__ARTEMIS_SAVE_BUFFER).gold, 100);
  await h.save({ gold: 101 });
  await assert.rejects(h.cloud.purchaseShopOffer('gems_80'));
  assert.equal(h.requests.filter(r => r.path === '/api/shop').length, 1);
});

test('a confirmed shop purchase stays locked through a failed snapshot reload and can be retried', async () => {
  let purchases = 0, failLoad = false;
  const h = harness((path, opts) => {
    if (path.endsWith('/me')) return me();
    if (path === '/api/shop') { purchases++; failLoad = purchases === 1; return response({ ok: true, offerId: 'gems_80', revision: 4, replayed: purchases > 1 }); }
    return failLoad ? response({ ok: false }, 503) : saved({ gold: 100, vipCoins: purchases ? 76 : 100 }, purchases ? 4 : 3);
  });
  await h.boot();
  await assert.rejects(h.cloud.purchaseShopOffer('gems_80'));
  assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
  const firstBody = h.requests.find(r => r.path === '/api/shop').body;
  assert.equal((await h.cloud.purchaseShopOffer('gems_80')).replayed, true);
  assert.equal(h.requests.filter(r => r.path === '/api/shop')[1].body, firstBody);
  assert.equal(h.window.__ARTEMIS_SAVE_READY, true);
});

test('a conflict reload that cannot rebuild the character never unlocks stale writes', async () => {
  const h = harness(path => path.endsWith('/me') ? me()
    : path === '/api/shop' ? response({ ok: false, error: 'conflict' }, 409) : saved());
  await h.boot();
  h.window.Archero2FusionAPI.reloadSaveFromStorage = () => { throw new Error('bad rebuild'); };
  await assert.rejects(h.cloud.purchaseShopOffer('gems_80'), /bad rebuild/);
  assert.equal(h.window.__ARTEMIS_SAVE_READY, false);
  await h.push();
  assert.equal(h.requests.filter(r => r.method === 'PUT').length, 0);
});

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
