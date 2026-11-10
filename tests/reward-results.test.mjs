import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const presentation = fs.readFileSync(new URL('../public/reward-results.js', import.meta.url), 'utf8');
const start = html.indexOf('let runeDigging = false;');
const end = html.indexOf('// Render the Mini Bar', start);
function fixture({ tokens = 500, gems = 100000, response = { ok: true, drops: [] }, httpOK = true } = {}) {
  const shown = [], toasts = [], requests = [], stars = {}, buttons = [1, 10, 100].map(n => ({ getAttribute: () => String(n) }));
  let saves = 0, reloads = 0, dismiss;
  const SaveState = { wishTokens: tokens, gems, wikiOtherItems: {}, wikiEventsState: {}, save() { saves++; } };
  const context = vm.createContext({ SaveState, document: { activeElement: {}, querySelector: () => null }, ensureWikiCurrencyAndItemsState() {}, syncWishTokenMirrors() {}, getArtifactStarMap: () => stars,
    ARTIFACTS_DATA: ['rare', 'epic', 'legendary', 'mythic'].map(rarity => ({ id: rarity, rarity, wikiName: rarity + ' artifact', icon: '🏺' })),
    RUNES_DATA: [{ id: 'rune_a', wikiName: 'Rune A', icon: '💠' }], RuneEconomy: { tier: n => n > 1 ? 'epic' : 'rare' },
    renderArtifactIcon: a => `<img src="assets/artifacts/${a.id}.png" alt="">`,
    SoundFX: { levelUp() {} }, StageHeroAnim: { triggerPose() {} }, renderLobbyUI() {}, showToast: (...args) => toasts.push(args),
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: httpOK, json: async () => response }; }, setTimeout: fn => fn(),
    window: { ArtemisCloud: { async exploreRunes(details) { requests.push({ url: '/api/runes', body: details }); if (!httpOK) throw Error(response.error); return response; } }, location: { reload() { reloads++; } }, ArtemisRewardResults: { show(payload) { shown.push(payload); return new Promise(resolve => { dismiss = resolve; }); } } },
    el: { querySelectorAll() { return buttons; } }
  });
  vm.runInContext(html.slice(start, end), context);
  const clickStart = html.indexOf("el.querySelectorAll('[data-vn-wish-pull]').forEach");
  vm.runInContext(html.slice(clickStart, html.indexOf("el.querySelectorAll('[data-vn-deal-period]')", clickStart)), context);
  return { context, SaveState, shown, toasts, requests, stars, buttons, saves: () => saves, reloads: () => reloads, dismiss: () => dismiss?.() };
}
for (const count of [1, 10, 100]) test(`wish shop ×${count}: exact settled names, one debit and save`, async () => {
  const f = fixture();
  await f.buttons[[1, 10, 100].indexOf(count)].onclick();
  assert.equal(f.SaveState.gems, 100000 - count * 400);
  assert.equal(f.SaveState.wishTokens, 500);
  assert.equal(f.saves(), 1);
  assert.equal(f.shown.length, 1);
  assert.equal(f.shown[0].rewards.length, count);
  for (const r of f.shown[0].rewards) {
    assert.ok(r.name.includes(r.rarity + ' artifact'));
    assert.ok(f.stars[r.rarity] > 0);
    assert.ok(r.amount === 0 || r.amount === 1);
    if (!r.amount) assert.ok(r.name.includes('không tăng thêm'));
  }
  const before = JSON.stringify(f.SaveState);
  f.dismiss();
  await Promise.resolve();
  assert.equal(JSON.stringify(f.SaveState), before);
});
test('capped artifacts keep the rolled identity but report zero added stars', async () => {
  const f = fixture();
  for (const rarity of ['rare', 'epic', 'legendary', 'mythic']) f.stars[rarity] = 15;
  await f.buttons[2].onclick();
  assert.equal(f.shown[0].rewards.length, 100);
  assert.ok(f.shown[0].rewards.every(r => r.amount === 0 && r.name.includes('không tăng thêm')));
  assert.deepEqual(Object.values(f.stars), [15, 15, 15, 15]);
});
test('single token uses same returned settled reward and existing save', async () => {
  const f = fixture();
  const reward = await f.context.executeWikiOtherItemAction('wish_token');
  assert.equal(f.SaveState.wishTokens, 499);
  assert.equal(f.saves(), 1);
  assert.equal(f.shown[0].rewards[0], reward);
});
test('insufficient gems/token: no rewards, mutations or saves', async () => {
  const f = fixture({ tokens: 0, gems: 0 });
  await f.buttons[2].onclick();
  await f.context.executeWikiOtherItemAction('wish_token');
  assert.equal(f.shown.length, 0);
  assert.equal(f.saves(), 0);
  assert.equal(f.SaveState.gems, 0);
  assert.equal(f.SaveState.wishTokens, 0);
});
for (const count of [1, 10]) test(`rune ruins ×${count}: acknowledged drops, busy guard, reload only after dismiss`, async () => {
  const drops = Array.from({ length: count }, (_, i) => ({ runeId: i % 2 ? 'unknown_rune' : 'rune_a', rank: i % 2 + 1 }));
  const f = fixture({ response: { ok: true, drops } });
  const pending = f.context.executeRuneRuinsDig(true, count, 7);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests[0].body.count, count);
  assert.equal(f.requests[0].body.promised, true);
  assert.equal(f.requests[0].body.tileIdx, 7);
  assert.equal(f.shown[0].rewards.length, count);
  f.shown[0].rewards.forEach((r, i) => assert.equal(r.name, `${i % 2 ? 'unknown_rune' : 'Rune A'} (${i % 2 ? 'epic' : 'rare'})`));
  assert.equal(f.reloads(), 0);
  await f.context.executeRuneRuinsDig(true, count);
  assert.equal(f.requests.length, 1);
  f.dismiss(); await pending;
  assert.equal(f.reloads(), 1);
  assert.equal(f.saves(), 0, 'do not persist speculative client rune state');
});
test('rune reveal uses actual stone quality, not highest owned rank', async () => {
  const f = fixture({ response: { ok: true, drops: [{ runeId: 'rune_a', quality: 0, rank: 11 }, { runeId: 'rune_a', quality: 3, rank: 11 }] } });
  const pending = f.context.executeRuneRuinsDig(false, 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.shown[0].rewards[0].rarity, 'common');
  assert.equal(f.shown[0].rewards[1].rarity, 'epic');
  f.dismiss(); await pending;
});
test('rune server rejection and network failure never reveal success', async () => {
  const f = fixture({ httpOK: false, response: { ok: false, error: 'insufficient' } });
  await f.context.executeRuneRuinsDig(false, 10);
  f.context.fetch = async () => { throw Error('offline'); };
  await f.context.executeRuneRuinsDig(false, 1);
  assert.equal(f.shown.length, 0);
  assert.equal(f.reloads(), 0);
  assert.equal(f.toasts.length, 2);
});
function uiFixture() {
  let focused = 0;
  const listeners = {}, dialog = { open: false, innerHTML: '', setAttribute() {}, addEventListener(k, fn) { listeners[k] = fn; }, showModal() { this.open = true; }, close() { this.open = false; listeners.close(); }, querySelector() { return { focus() {}, scrollTop: 0 }; } };
  const window = {};
  vm.runInNewContext(presentation, { window, document: { activeElement: { isConnected: true, focus() { focused++; } }, body: { appendChild() {} }, createElement: () => dialog } });
  return { window, dialog, listeners, focused: () => focused };
}
test('presentation renders all 100 entries safely and dismisses without side effects', async () => {
  const f = uiFixture();
  const rewards = Array.from({ length: 100 }, (_, i) => ({ name: `Reward ${i}<script>`, amount: i + 1, rarity: i === 99 ? 'mythic' : 'rare', icon: '💠', art: 'javascript:alert(1)' }));
  const before = JSON.stringify(rewards);
  const pending = f.window.ArtemisRewardResults.show({ title: '<img onerror=x>', rewards });
  assert.equal((f.dialog.innerHTML.match(/<li /g) || []).length, 100);
  assert.ok(f.dialog.innerHTML.includes('Reward 99&lt;script&gt;'));
  assert.ok(!f.dialog.innerHTML.includes('javascript:'));
  assert.ok(!f.dialog.innerHTML.includes('<img onerror'));
  assert.ok(f.dialog.innerHTML.includes('arr-exceptional'));
  f.dialog.close(); await pending;
  assert.equal(f.focused(), 1);
  assert.equal(JSON.stringify(rewards), before);
});
test('existing artwork markup becomes inert images without executable attributes', async () => {
  const f = uiFixture();
  const pending = f.window.ArtemisRewardResults.show({ rewards: [
    { name: 'Artifact', art: '<span><img src="assets/artifacts/a.png" onerror="alert(1)"></span>' },
    { name: 'Gear', art: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' }
  ] });
  assert.ok(f.dialog.innerHTML.includes('src="assets/artifacts/a.png"'));
  assert.ok(f.dialog.innerHTML.includes('data:image/svg+xml;charset=utf-8,'));
  assert.ok(!f.dialog.innerHTML.includes('onerror='));
  assert.ok(!f.dialog.innerHTML.includes('<svg'));
  assert.ok(!f.dialog.innerHTML.includes('<script>'));
  f.dialog.close(); await pending;
});
test('concurrent reveals queue; each promise resolves on its own close', async () => {
  const f = uiFixture();
  let firstClosed = false, secondClosed = false;
  const one = f.window.ArtemisRewardResults.show({ rewards: [{ name: 'first' }] }).then(() => { firstClosed = true; });
  const two = f.window.ArtemisRewardResults.show({ rewards: [{ name: 'second' }] }).then(() => { secondClosed = true; });
  assert.ok(f.dialog.innerHTML.includes('first'));
  f.dialog.close(); await one;
  assert.equal(firstClosed, true);
  assert.equal(secondClosed, false);
  assert.ok(f.dialog.innerHTML.includes('second'));
  f.dialog.close(); await two;
});
test('assets included and component uses native modal, accessible labels and reduced-motion CSS', () => {
  assert.ok(html.includes('src="reward-results.js"'));
  assert.ok(html.includes('href="reward-results.css"'));
  assert.ok(presentation.includes("document.createElement('dialog')"));
  assert.ok(presentation.includes('aria-labelledby'));
  const css = fs.readFileSync(new URL('../public/reward-results.css', import.meta.url), 'utf8');
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(css.includes('overflow-y:auto'));
});
