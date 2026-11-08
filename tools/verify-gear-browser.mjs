// Chrome + HTTP thật + DB bộ nhớ riêng. Fixture được seed rõ ràng, không gọi production.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const { getMongoDb, COLLECTIONS } = await import('../lib/mongo.js');
const { sanitizeSave } = await import('../lib/save/schema.js');
const register = await import('../api/auth/register.js');
const saves = await import('../api/save.js');
const auth = await import('../api/auth/me.js');
const publicDir = resolve('public'), evidence = resolve('docs/gear-evidence');
await mkdir(evidence, { recursive: true });
const handlers = { '/api/auth/register': register, '/api/auth/me': auth, '/api/save': saves };
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
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin || ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin) ? route.continue() : route.abort();
  });
  const registration = await page.request.post(origin + '/api/auth/register', { data: { username: 'gear_browser_fixture', password: 'fixture-password-only' } });
  assert.equal(registration.status(), 201);
  const playerId = (await registration.json()).player.id;
  const fresh = (await (await page.request.get(origin + '/api/save')).json()).data;
  const gear = (uid, templateId, level = 1, extra = {}) => ({ uid, templateId, quality: 'common', level, awakening: 0, locked: false, favorite: false, sockets: [], affixes: [], ...extra });
  const fixture = sanitizeSave({ ...fresh, beginnerJourney: { isCompleted: true, skipped: true },
    equippedGear: { ...fresh.equippedGear, ring: gear('eq_ring', 'echo_ring', 5), helmet: gear('eq_helmet', 'echo_helmet') },
    gearBag: [gear('compare_ring', 'destruction_ring'), gear('protected', 'crimson_bow', 1, { locked: true }), gear('favorite', 'crimson_bow', 1, { favorite: true }), ...Array.from({ length: 30 }, (_, i) => gear('bag_' + i, 'crimson_bow'))],
    gearScrolls: { ...fresh.gearScrolls, ring: 30 },
  }).data;
  const db = await getMongoDb();
  await db.collection(COLLECTIONS.saves).updateOne({ playerId }, { $set: { data: fixture } });
  assert.equal((await (await page.request.get(origin + '/api/save')).json()).data.gearBag.length, fixture.gearBag.length);
  await page.goto(origin, { waitUntil: 'load' });
  await page.waitForFunction(() => window.Archero2FusionAPI && window.ArtemisCloud?.getState().ready);
  await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
  await page.locator('#bottomNavBar [data-tab="tabEquip"]').first().click();
  await page.locator('#tabEquip [data-gear-subtab="gear"]').click();
  assert.equal(await page.locator('#gearWorkshop').getAttribute('open'), null);
  assert.equal(await page.locator('.gear-empty-slot').count(), 4);
  const geometry = [];
  for (const width of [1024, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('#tabEquip').evaluate(el => el.scrollTop = 0);
    const dimensions = await page.locator('#tabEquip').evaluate(el => ({ scroll: el.scrollWidth, width: el.clientWidth, stage: document.querySelector('#gearHeroStage').getBoundingClientRect().height, grid: getComputedStyle(document.querySelector('#gearBagGrid')).gridTemplateColumns }));
    assert.ok(dimensions.scroll <= dimensions.width, JSON.stringify(dimensions));
    assert.ok((await page.locator('#btnQuickEquipBest').boundingBox()).height >= 44);
    const slots = await page.locator('#gearHeroStage').evaluate(el => {
      const stage = el.getBoundingClientRect();
      return [...el.querySelectorAll('#equippedLeftCol > *, #equippedRightCol > *')].map(item => {
        const box = item.getBoundingClientRect();
        return box.left >= stage.left && box.right <= stage.right;
      });
    });
    assert.ok(slots.every(Boolean), 'cả sáu ô phải nằm trong sân khấu, không bị cắt cạnh');
    geometry.push({ viewportWidth: width, ...dimensions, allSlotsVisible: true });
    await page.screenshot({ path: resolve(evidence, `inventory-${width}.png`) });
    await page.locator('[data-gear-uid="compare_ring"]').click();
    const detailBox = await page.locator('#gearDetailModal').boundingBox();
    assert.ok(detailBox.x >= 0 && detailBox.x + detailBox.width <= width && detailBox.y >= 0 && detailBox.y + detailBox.height <= 900);
    assert.equal(await page.locator('#gearDetailModal').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    if (width === 1024) await page.locator('#gearDetailModal').screenshot({ path: resolve(evidence, 'comparison-desktop.png') });
    await page.keyboard.press('Escape');
  }
  await page.locator('[data-slot-filter="ring"]').click();
  const before = await page.evaluate(() => JSON.stringify(window.Archero2FusionAPI.SaveState.equippedGear));
  await page.locator('[data-gear-uid="compare_ring"]').click();
  const modal = page.locator('#gearDetailModal');
  assert.equal(await modal.evaluate(el => el.open), true);
  const comparison = await page.locator('#gearModalComparison').innerText();
  assert.match(comparison, /Kế thừa cấp 5/);
  assert.match(comparison, /Mất.*Echo/);
  const expected = await page.locator('#gearModalComparison > div strong').allTextContents();
  const expectedTotals = expected.map(text => Number(text.split('→')[1].replace(/\D/g, '')));
  assert.equal(await page.evaluate(() => JSON.stringify(window.Archero2FusionAPI.SaveState.equippedGear)), before);
  assert.equal(await page.locator('#btnCloseGearModal').evaluate(el => el === document.activeElement), true);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('#btnModalEquipGear').evaluate(el => el === document.activeElement), true);
  await page.screenshot({ path: resolve(evidence, 'comparison-mobile.png') });
  const action = await page.locator('#btnModalEquipGear').boundingBox();
  assert.ok(action.y >= 0 && action.y + action.height <= 740);
  assert.equal(await modal.evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await page.keyboard.press('Escape');
  assert.equal(await modal.evaluate(el => el.open), false);
  await page.locator('[data-gear-uid="compare_ring"]').click();
  await page.locator('#btnModalEquipGear').click();
  const equipped = await page.evaluate(() => {
    const api = window.Archero2FusionAPI, stats = api.getComputedStats();
    return { uid: api.SaveState.equippedGear.ring.uid, level: api.SaveState.equippedGear.ring.level, totals: [stats.baseAtk, stats.baseHp], gold: api.SaveState.gold, scrolls: api.SaveState.gearScrolls.ring };
  });
  assert.equal(equipped.uid, 'compare_ring');
  assert.equal(equipped.level, 5);
  assert.deepEqual(equipped.totals, expectedTotals);
  await page.locator('[data-gear-uid="compare_ring"]').click();
  const cost = Number((await page.locator('#gearModalUpgradeCost').innerText()).replace(/\D/g, ''));
  await page.locator('#btnModalUpgradeGear').click();
  const upgraded = await page.evaluate(() => ({ level: window.Archero2FusionAPI.SaveState.equippedGear.ring.level, gold: window.Archero2FusionAPI.SaveState.gold, scrolls: window.Archero2FusionAPI.SaveState.gearScrolls.ring }));
  assert.equal(upgraded.level, 6);
  assert.equal(upgraded.gold, equipped.gold - cost);
  assert.ok(upgraded.scrolls < equipped.scrolls);
  await page.locator('#btnCloseGearModal').click();
  await page.locator('[data-slot-filter="all"]').click();
  await page.locator('#gearWorkshop > summary').click();
  await page.locator('#btnBulkSalvage').click();
  assert.equal(await page.locator('.salvage-check[value="protected"]').count(), 0);
  assert.equal(await page.locator('.salvage-check[value="favorite"]').count(), 0);
  assert.equal(await page.locator('.salvage-check[value="compare_ring"]').count(), 0);
  await page.locator('.salvage-check[value="bag_0"]').check();
  assert.match(await page.locator('#gearSalvagePreview').innerText(), /Sẽ mất 1 món.*35 vàng, 1 mảnh/);
  await page.locator('#confirmBulkSalvage').click();
  assert.equal(await page.locator('.salvage-check[value="bag_0"]').count(), 0);
  const salvaged = await page.evaluate(() => ({ gold: window.Archero2FusionAPI.SaveState.gold, shards: window.Archero2FusionAPI.SaveState.salvageMaterials }));
  assert.equal(salvaged.gold, upgraded.gold + 35);
  assert.equal(salvaged.shards, 1);
  await page.locator('#gearWorkshop > summary').click();
  await page.locator('[data-gear-uid="bag_29"]').scrollIntoViewIfNeeded();
  const scroll = await page.locator('#tabEquip').evaluate(el => el.scrollTop);
  assert.ok(scroll > 0);
  await page.locator('[data-gear-uid="bag_29"]').click();
  assert.equal(await page.locator('#btnModalUpgradeGear').isDisabled(), true);
  await page.mouse.click(2, 2);
  assert.equal(await modal.evaluate(el => el.open), false);
  assert.equal(await page.locator('#tabEquip').evaluate(el => el.scrollTop), scroll);
  await page.locator('#btnGearChangeHero').click();
  assert.equal(await page.locator('#subpanelCharacters').isVisible(), true);
  await page.locator('#tabEquip [data-gear-subtab="gear"]').click();
  await page.waitForFunction(() => !window.ArtemisCloud.getState().dirty);
  const persisted = (await (await page.request.get(origin + '/api/save')).json()).data;
  assert.equal(persisted.equippedGear.ring.uid, 'compare_ring');
  assert.equal(persisted.equippedGear.ring.level, 6);
  assert.equal(persisted.gearBag.some(item => item.uid === 'bag_0'), false);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.ArtemisCloud?.getState().ready);
  assert.equal(await page.evaluate(() => window.Archero2FusionAPI.SaveState.equippedGear.ring.level), 6);
  assert.deepEqual(errors, []);
  const result = { scope: 'Chrome + real HTTP + isolated memory DB; seeded gear/scroll fixture, not production or earned loot', geometry, comparison, equipped, upgraded, salvage: { gold: salvaged.gold - upgraded.gold, shards: salvaged.shards }, scrollPreserved: scroll, reloadPersisted: true, errors };
  await writeFile(resolve(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
}
