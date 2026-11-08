// Chrome + HTTP/auth/save thật + DB bộ nhớ cô lập; fixture ngọc không phải loot từ chiến đấu.
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
const publicDir = resolve('public'), evidence = resolve('docs/rune-evidence');
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
  const errors = [], geometry = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin || ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin) ? route.continue() : route.abort();
  });
  const registration = await page.request.post(origin + '/api/auth/register', { data: { username: 'rune_browser_fixture', password: 'fixture-password-only' } });
  assert.equal(registration.status(), 201);
  const playerId = (await registration.json()).player.id;
  const fresh = (await (await page.request.get(origin + '/api/save')).json()).data;
  const db = await getMongoDb();
  const fixture = sanitizeSave({ ...fresh, beginnerJourney: { isCompleted: true, skipped: true }, runes: { echo_scythe: 1, rune_valkyrie: 1, rune_flame: 4, rune_frost: 3, rune_thunder: 1 }, equippedRuneSlots: { etched: [null, null, null], blessing: [null, null], enhancement: [null, null, null, null], ability: [null, null, null, null] } }).data;
  await db.collection(COLLECTIONS.saves).updateOne({ playerId }, { $set: { data: fixture } });
  assert.deepEqual((await (await page.request.get(origin + '/api/save')).json()).data.runes, fixture.runes);
  const enter = async () => {
    await page.waitForFunction(() => window.Archero2FusionAPI && window.ArtemisCloud?.getState().ready);
    await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
    await page.locator('#bottomNavBar [data-tab="tabEquip"]').first().click();
    if (!await page.locator('#subpanelRunes').isVisible()) await page.locator('#tabEquip [data-equipment-nav="runes"]:visible').first().click();
  };
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await enter();
  assert.equal(await page.locator('[data-equip-wiki-rune]').count(), 5);
  assert.equal(await page.locator('#btnRuneSortQuality').getAttribute('aria-pressed'), 'true');
  await page.locator('#btnRuneSortQuality').click();
  assert.equal(await page.locator('#btnRuneSortQuality').getAttribute('aria-pressed'), 'false');
  await page.locator('#btnRuneSortQuality').click();
  assert.equal(await page.locator('#btnRuneSortQuality').getAttribute('aria-pressed'), 'true');
  for (const width of [1024, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('#tabEquip').evaluate(el => el.scrollTop = 0);
    const bounds = await page.locator('#subpanelRunes').evaluate(el => {
      const altar = el.querySelector('.rune-altar').getBoundingClientRect();
      const slots = [...el.querySelectorAll('[data-rune-slot]')].map(node => { const b = node.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height }; });
      const nav = el.querySelector('.rune-reference-tabs').getBoundingClientRect();
      const toolbar = el.querySelector('.rune-catalog-toolbar').getBoundingClientRect();
      const grid = el.querySelector('.rune-inventory-grid');
      return { width: el.clientWidth, scroll: el.scrollWidth, slots, allInside: slots.every(b => b.left >= altar.left - 1 && b.right <= altar.right + 1 && b.top >= altar.top - 1 && b.bottom <= altar.bottom + 1), gridColumns: getComputedStyle(grid).gridTemplateColumns, referenceOrder: altar.bottom <= nav.top + 1 && nav.bottom <= toolbar.top + 1 && toolbar.bottom <= grid.getBoundingClientRect().top + 1 };
    });
    assert.equal(bounds.slots.length, 13);
    assert.ok(bounds.allInside, 'cả 13 ô ngọc phải ở trong bảng, không bị cắt');
    assert.ok(bounds.slots.every(b => b.width >= 44 && b.height >= 44));
    assert.ok(bounds.scroll <= bounds.width, JSON.stringify(bounds));
    assert.equal(bounds.gridColumns.split(' ').length, 5);
    assert.equal(bounds.referenceOrder, true, 'đài → ba tab → thanh nút → kho');
    geometry.push({ viewportWidth: width, ...bounds });
    await page.screenshot({ path: resolve(evidence, `board-${width}.png`) });
    if (width === 1024) {
      await page.locator('[data-equip-wiki-rune="rune_flame"]').click();
      const desktopModal = page.locator('dialog.rune-workspace-detail');
      const bounds = await desktopModal.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 900);
      await desktopModal.screenshot({ path: resolve(evidence, 'detail-desktop.png') });
      await page.keyboard.press('Escape');
      await desktopModal.waitFor({ state: 'detached' });
    }
  }
  await page.setViewportSize({ width: 360, height: 740 });
  await page.locator('[data-rune-slot="enhancement:2"]').click();
  assert.equal(await page.locator('[data-equip-wiki-rune]').count(), 2);
  const modal = page.locator('dialog.rune-workspace-detail');
  await page.locator('[data-equip-wiki-rune="rune_flame"]').click();
  assert.equal(await modal.evaluate(el => el.open), true);
  assert.equal(await modal.locator('[data-rune-combat-note]').count(), 1);
  const box = await modal.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 360 && box.y >= 0 && box.y + box.height <= 740, JSON.stringify(box));
  assert.equal(await modal.evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await modal.locator('[data-rune-popup-equip]').scrollIntoViewIfNeeded();
  const actionBox = await modal.locator('[data-rune-popup-equip]').boundingBox();
  assert.ok(actionBox.y >= 0 && actionBox.y + actionBox.height <= 740, JSON.stringify(actionBox));
  await modal.screenshot({ path: resolve(evidence, 'detail-mobile.png') });
  const controls = await modal.locator('button:not([disabled]), summary').count();
  for (const key of ['Tab', 'Shift+Tab']) for (let step = 0; step < controls * 2; step++) {
    await page.keyboard.press(key);
    assert.equal(await page.evaluate(() => document.activeElement.closest('dialog') !== null), true);
  }
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.Archero2FusionAPI.SaveState.equippedRuneSlots.enhancement[2]), null);
  await page.locator('[data-equip-wiki-rune="rune_flame"]').click();
  await modal.locator('[data-rune-popup-equip]').click();
  await modal.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.Archero2FusionAPI.SaveState.equippedRuneSlots.enhancement[2]), 'rune_flame');
  await page.locator('[data-rune-slot="enhancement:2"]').click();
  await modal.locator('[data-rune-popup-unequip]').click();
  await modal.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.Archero2FusionAPI.SaveState.equippedRuneSlots.enhancement[2]), null);
  await page.locator('[data-equip-wiki-rune="rune_flame"]').click();
  await modal.locator('[data-rune-popup-equip]').click();
  await modal.waitFor({ state: 'detached' });
  await page.locator('[data-equip-wiki-rune="rune_frost"]').click();
  await modal.locator('[data-rune-popup-equip]').click();
  await modal.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.Archero2FusionAPI.SaveState.equippedRuneSlots.enhancement[2]), 'rune_frost');
  await page.locator('#btnRuneWorkshop').click();
  await page.locator('[data-rune-cat-filter="ability"]').click();
  await page.locator('[data-equip-wiki-rune="rune_thunder"]').click();
  assert.equal(await modal.locator('[data-rune-popup-equip]').isDisabled(), true);
  await page.mouse.click(2, 2);
  await modal.waitFor({ state: 'detached' });
  await page.locator('[data-rune-clear-selection]').click();
  await page.locator('[data-rune-scope="all"]').click();
  await page.locator('[data-rune-cat-filter="all"]').click();
  assert.equal(await page.locator('[data-equip-wiki-rune]').count(), 46);
  const locked = page.locator('[data-equip-wiki-rune="rabbits_foot"]');
  await locked.scrollIntoViewIfNeeded();
  const scroll = await page.locator('#tabEquip').evaluate(el => el.scrollTop);
  assert.ok(scroll > 0);
  await locked.click();
  assert.equal(await modal.locator('[data-rune-popup-ruins]').count(), 1);
  assert.equal(await modal.locator('[data-rune-popup-equip]').count(), 0);
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'detached' });
  assert.equal(await page.locator('#tabEquip').evaluate(el => el.scrollTop), scroll);
  assert.equal(await locked.evaluate(el => el === document.activeElement), true);
  await page.locator('[data-rune-scope="owned"]').click();
  await page.locator('.rune-inventory-grid').scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(evidence, 'inventory-mobile.png') });
  if (!await page.locator('.rune-presets').evaluate(el => el.open)) await page.locator('#btnRuneWorkshop').click();
  await page.locator('[data-rune-preset="oracle_weapon"]').click();
  const preset = await page.evaluate(() => JSON.parse(JSON.stringify(window.Archero2FusionAPI.SaveState.equippedRuneSlots)));
  assert.equal(Object.values(preset).flat().filter(Boolean).length, 5);
  assert.ok(Object.values(preset).flat().filter(Boolean).every(id => fixture.runes[id] > 0));
  await page.waitForFunction(() => !window.ArtemisCloud.getState().dirty);
  const persisted = (await (await page.request.get(origin + '/api/save')).json()).data;
  assert.equal(persisted.equippedRuneSlots.enhancement[2], 'rune_frost');
  assert.deepEqual(persisted.runes, fixture.runes);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await enter();
  assert.equal(await page.evaluate(() => window.Archero2FusionAPI.SaveState.equippedRuneSlots.enhancement[2]), 'rune_frost');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.rune-altar').evaluate(el => getComputedStyle(el, '::before').animationName), 'none');
  assert.equal(await page.locator('.rune-hero img').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.locator('#tabEquip').evaluate(el => el.scrollTop = 0);
  await page.screenshot({ path: resolve(evidence, 'equipped-mobile.png') });
  await page.locator('[data-rune-nav="gear"]').click();
  assert.equal(await page.locator('#subpanelGear').isVisible(), true);
  assert.equal(await page.locator('#tabEquip > .gear-subnav').isVisible(), false);
  for (const width of [1024, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    for (const sub of ['gear', 'characters']) {
      const nav = sub === 'gear' ? '#gearReferenceNavigation' : '#subpanelCharacters';
      await page.locator('[data-equipment-nav="' + sub + '"]:visible').first().click();
      const panel = page.locator(sub === 'gear' ? '#subpanelGear' : '#subpanelCharacters');
      assert.equal(await panel.isVisible(), true);
      assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth), true, `${sub} không tràn ngang ${width}`);
      assert.equal(await page.locator(nav + ' .rune-reference-tabs [aria-current="page"]').getAttribute('data-equipment-nav'), sub);
      assert.equal(await page.locator(nav + ' .rune-reference-tabs').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 3);
      if (sub === 'gear') assert.equal(await page.locator('#gearBagGrid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 5);
      await page.locator('#tabEquip').evaluate(el => el.scrollTop = 0);
      await page.screenshot({ path: resolve(evidence, `${sub}-unified-${width}.png`) });
    }
  }
  await page.locator('#subpanelCharacters [data-equipment-nav="runes"]').click();
  await page.locator('#btnRuneWorkshop').click();
  await page.locator('[data-rune-explore]').click();
  assert.equal(await page.locator('#tabEvents').isVisible(), true);
  assert.deepEqual(errors, []);
  // Fixture thị giác riêng để đối chiếu ảnh: không dùng các cấp này làm bằng chứng kiếm thưởng.
  await page.waitForFunction(() => !window.ArtemisCloud.getState().dirty);
  const { RUNE_IDS } = await import('../lib/runeCatalog.js');
  const visual = sanitizeSave({ ...fixture, selectedHeroId: 'seraph', heroStars: { ...fixture.heroStars, seraph: 1 },
    runes: Object.fromEntries(RUNE_IDS.map((id, index) => [id, ['echo_scythe', 'sharp_arrow', 'rune_valkyrie', 'arrow_rain'].includes(id) ? 7 : ['rune_flame', 'rune_frost', 'dragonflight_sword', 'rabbits_foot', 'ring_of_agony', 'rune_thunder', 'flame_poison_touch'].includes(id) || index < 25 ? 4 : 3])), runeSortByQuality: true, runeTypeFilter: 'all',
    equippedRuneSlots: { etched: [null, null, null], blessing: ['rune_valkyrie', 'rabbits_foot'], enhancement: ['sharp_arrow', 'rune_flame', 'rune_frost', 'dragonflight_sword'], ability: ['arrow_rain', 'ring_of_agony', 'rune_thunder', 'flame_poison_touch'] },
  }).data;
  await db.collection(COLLECTIONS.saves).updateOne({ playerId }, { $set: { data: visual } });
  await page.setViewportSize({ width: 540, height: 1100 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await enter();
  await page.locator('.rune-hero img').evaluate(img => img.decode());
  const heroGeometry = await page.locator('.rune-hero').evaluate(el => {
    const hero = el.getBoundingClientRect(), img = el.querySelector('img').getBoundingClientRect();
    const slots = [...document.querySelectorAll('[data-rune-cat="etched"]')].map(node => node.getBoundingClientRect().top);
    return { heroBottom: hero.bottom, imageBottom: img.bottom, etchedTop: Math.min(...slots) };
  });
  assert.ok(heroGeometry.imageBottom <= heroGeometry.heroBottom + 1, 'ảnh không được ép grid cao hơn khung nhân vật');
  assert.ok(heroGeometry.imageBottom <= heroGeometry.etchedTop + 1, 'nhân vật toàn thân không bị hàng ngọc dưới che chân');
  await page.locator('#tabEquip').evaluate(el => el.scrollTop = 0);
  await page.screenshot({ path: resolve(evidence, 'reference-540.png') });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.locator('#tabEquip').evaluate(el => el.scrollTop = 0);
  await page.screenshot({ path: resolve(evidence, 'reference-360.png') });
  assert.equal(await page.locator('[data-equip-wiki-rune]').count(), 46);
  assert.deepEqual(errors, []);
  const result = { scope: 'Chrome + real HTTP/auth/save + isolated memory DB; 5 seeded rune types, not production or earned loot; separate visual fixture with Seraph and 46 rune types', geometry, heroGeometry, narrowModal: box, actionBox, equipUnequipReplace: true, wrongCategoryBlocked: true, lockedCannotEquip: true, cancelUnchanged: true, keyboardFocus: true, scrollPreserved: scroll, ownershipUnchanged: true, presetOwnedOnly: true, reducedMotion: true, reloadPersisted: true, navigationAndExplore: true, errors };
  await writeFile(resolve(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
}
