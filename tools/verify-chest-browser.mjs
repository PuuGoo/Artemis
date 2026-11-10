// Real Chrome + real isolated memory-DB HTTP handlers. Never loads .env or production.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs node tools/verify-chest-browser.mjs
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');
assert.ok(process.env.PLAYWRIGHT_MODULE, 'Set PLAYWRIGHT_MODULE to playwright or playwright-core index.mjs');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const { getMongoDb, COLLECTIONS } = await import('../lib/mongo.js');
const { sanitizeSave } = await import('../lib/save/schema.js');
const register = await import('../api/auth/register.js');
const saves = await import('../api/save.js');
const auth = await import('../api/auth/me.js');
const shop = await import('../lib/shop/handler.js');
const publicDir = resolve('public');
const evidence = resolve(process.env.CHEST_EVIDENCE_DIR || 'docs/chest-evidence');
await mkdir(evidence, { recursive: true });
const handlers = { '/api/auth/register': register, '/api/auth/me': auth, '/api/save': saves, '/api/shop': shop };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      const handler = handlers[url.pathname]?.[req.method];
      if (!handler) { res.writeHead(404); return res.end('{}'); }
      let body = ''; for await (const chunk of req) body += chunk;
      const response = await handler(new Request(url, { method: req.method, headers: req.headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body }) }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(await response.text());
    }
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir + sep)) throw Error('outside public');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch (error) { res.writeHead(500); res.end(JSON.stringify({ error: error.message })); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(12000);
  const errors = [], cases = [], geometry = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin || ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin) ? route.continue() : route.abort();
  });
  const registration = await page.request.post(origin + '/api/auth/register', { data: { username: 'chest_fixture', password: 'fixture-password-only' } });
  assert.equal(registration.status(), 201);
  const playerId = (await registration.json()).player.id;
  const fresh = (await (await page.request.get(origin + '/api/save')).json()).data;
  const db = await getMongoDb();
  const fixture = sanitizeSave({ ...fresh, beginnerJourney: { isCompleted: true, skipped: true }, gems: 1000000, chestKeys: { silver_chest_key: 2000, obsidian_chest_key: 2000, chromatic_chest_key: 2000 }, gearBag: [] }).data;
  await db.collection(COLLECTIONS.saves).updateOne({ playerId }, { $set: { data: fixture } });
  assert.equal((await (await page.request.get(origin + '/api/save')).json()).data.chestKeys.chromatic_chest_key, 2000);
  await page.goto(origin, { waitUntil: 'load' });
  await page.waitForFunction(() => window.Archero2FusionAPI && window.ArtemisCloud?.getState().ready);
  await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
  const snapshot = () => page.evaluate(() => {
    const s = window.Archero2FusionAPI.SaveState;
    return { gems: s.gems, keys: { ...s.chestKeys }, bag: s.gearBag.map(i => ({ uid: i.uid, templateId: i.templateId, quality: i.quality, level: i.level })) };
  });
  await page.locator('#bottomNavBar [data-tab="tabShopVn"]').click();
  await page.locator('[data-vn-chest-pull]').first().waitFor();
  const entries = await page.locator('[data-vn-chest-pull]').evaluateAll(buttons => buttons.map(b => ({ type: b.dataset.vnChestPull, count: Number(b.dataset.vnPulls) })));
  assert.ok(entries.some(e => e.count === 100), 'shop exposes ×100');
  const popup = page.locator('#artemisChestResults');
  for (const { type, count } of entries) {
    const selector = `[data-vn-chest-pull="${type}"][data-vn-pulls="${count}"]`;
    const key = (type === 'silver' ? 'silver' : type === 'obsidian' ? 'obsidian' : 'chromatic') + '_chest_key';
    const before = await snapshot();
    await page.locator(selector).click();
    await popup.waitFor({ state: 'visible' });
    const after = await snapshot();
    assert.equal(after.bag.length - before.bag.length, count);
    assert.equal(after.keys[key], before.keys[key] - count);
    assert.equal(after.gems, before.gems);
    const ids = await popup.locator('.acr-card').evaluateAll(cards => cards.map(c => c.dataset.gearUid));
    assert.equal(ids.length, count);
    assert.equal(new Set(ids).size, count, 'unique actual inventory IDs');
    assert.deepEqual(ids, after.bag.slice(0, count).reverse().map(i => i.uid));
    assert.equal(await popup.getAttribute('aria-labelledby'), 'acr-title');
    assert.equal(await popup.locator('#acr-title').innerText(), 'Chiến lợi phẩm của bạn');
    assert.equal(await popup.locator('.acr-done').evaluate(el => el === document.activeElement), true);
    for (let tab = 0; tab < 5; tab++) {
      await page.keyboard.press('Tab');
      assert.equal(await popup.evaluate(el => el.contains(document.activeElement) || document.activeElement === document.body), true, 'native dialog prevents focus entering background controls (browser chrome may own focus)');
    }
    if (type === 'chromatic') {
      for (const width of [1024, 390, 360]) {
        await page.setViewportSize({ width, height: 900 });
        const box = await popup.boundingBox();
        assert.ok(box.x >= -1 && box.x + box.width <= width + 1 && box.y >= -1 && box.y + box.height <= 901);
        assert.equal(await popup.evaluate(el => el.scrollWidth <= el.clientWidth), true);
        assert.ok((await popup.locator('.acr-done').boundingBox()).height >= 44);
        geometry.push({ count, width, fits: true });
        await popup.screenshot({ path: resolve(evidence, `chest-${count}-${width}.png`) });
        await popup.locator('.acr-scroll').evaluate(el => el.scrollTop = el.scrollHeight);
        const last = await popup.locator('.acr-card').last().boundingBox();
        const footer = await popup.locator('.acr-footer').boundingBox();
        assert.ok(last.y + last.height <= footer.y + 1, 'last card scrolls fully above footer');
        // Decode every card, including offscreen lazy images, before asserting artwork.
        await popup.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => { img.loading = 'eager'; return img.decode(); })));
        assert.equal(await popup.locator('img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)), true, 'actual equipment art loads');
        await popup.locator('.acr-scroll').evaluate(el => el.scrollTop = 0);
      }
      await page.setViewportSize({ width: 1024, height: 900 });
    }
    await page.keyboard.press('Escape');
    assert.equal(await popup.evaluate(el => el.open), false);
    assert.deepEqual(await snapshot(), after, 'Escape must not spend or grant again');
    // The native dialog close event is dispatched asynchronously after Escape.
    await page.waitForFunction(selector => document.querySelector(selector) === document.activeElement, selector);
    cases.push({ entrypoint: 'shop', type, count, exactInventoryIds: true, singleDebit: true });
  }
  // Legacy entrypoints are hidden by the current simplified inventory. Exercise their
  // real onclick handlers via DOM click (not a fabricated call to the result modal).
  const legacy = await page.evaluate(() => [...document.querySelectorAll('[data-open-wiki-chest], [data-chest-pull]')].map((b, index) => ({ index, type: b.dataset.openWikiChest || 'legacy', count: Number(b.dataset.chestCount || b.dataset.chestPull), wired: typeof b.onclick === 'function' })));
  for (const entry of legacy.filter(e => e.wired)) {
    const before = await snapshot();
    await page.evaluate(index => document.querySelectorAll('[data-open-wiki-chest], [data-chest-pull]')[index].click(), entry.index);
    await popup.waitFor({ state: 'visible' });
    const after = await snapshot();
    assert.equal(after.bag.length - before.bag.length, entry.count);
    assert.equal(await popup.locator('.acr-card').count(), entry.count);
    const key = (entry.type === 'silver' ? 'silver' : entry.type === 'obsidian' ? 'obsidian' : 'chromatic') + '_chest_key';
    assert.equal(after.keys[key], before.keys[key] - entry.count);
    assert.equal(after.gems, before.gems);
    assert.deepEqual(await popup.locator('.acr-card').evaluateAll(cards => cards.map(c => c.dataset.gearUid)), after.bag.slice(0, entry.count).reverse().map(i => i.uid));
    await popup.locator('.acr-done').click();
    assert.deepEqual(await snapshot(), after, 'continue cannot roll or debit again');
    cases.push({ entrypoint: 'legacy', ...entry, singleDebit: true });
  }
  const earned = await snapshot();
  await page.waitForFunction(() => !window.ArtemisCloud.getState().dirty);
  const persisted = (await (await page.request.get(origin + '/api/save')).json()).data;
  assert.deepEqual(persisted.gearBag.map(i => i.uid), earned.bag.map(i => i.uid));
  assert.deepEqual(persisted.chestKeys, earned.keys);
  assert.equal(persisted.gems, earned.gems);
  // Deliberately impoverish only this disposable memory fixture in the browser.
  await page.evaluate(() => {
    const s = window.Archero2FusionAPI.SaveState;
    s.gems = 0;
    for (const key of Object.keys(s.chestKeys)) s.chestKeys[key] = 0;
  });
  const failedBefore = await snapshot();
  await page.locator('[data-vn-chest-pull="chromatic"][data-vn-pulls="100"]').click();
  assert.equal(await popup.evaluate(el => el.open), false, 'failed purchase never opens results');
  assert.deepEqual(await snapshot(), failedBefore, 'failed purchase cannot mutate funds or inventory');
  assert.deepEqual(errors, []);
  const result = { scope: 'Real Chrome + real HTTP + seeded isolated memory DB; no production, no Mongo durability claim', cases, legacyPresent: legacy, geometry, failureNoPopupOrMutation: true, errors };
  await writeFile(resolve(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
}
