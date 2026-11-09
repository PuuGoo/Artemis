// Chrome thật; HTTP/auth/save thật trên DB bộ nhớ, không đọc secrets hay dữ liệu production.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/PuuGoo/AppData/Local/hermes/cache/scratch/artemis-browser/node_modules/playwright-core/index.mjs').href);
const { getMongoDb, COLLECTIONS } = await import('../lib/mongo.js');
const register = await import('../api/auth/register.js');
const saves = await import('../api/save.js');
const auth = await import('../api/auth/me.js');
const root = resolve('public'), evidence = resolve('docs/hero-ui-evidence');
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
    const file = resolve(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(root + sep)) throw Error('outside public');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch (error) { res.writeHead(500); res.end(JSON.stringify({ error: error.message })); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const result = { scope: 'Real Chrome + isolated real HTTP/auth/save + memory DB; seeded onboarding completion only; no production', status: 'RUNNING', viewports: [], errors: [] };
let browser, page;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  page = await browser.newPage({ viewport: { width: 360, height: 740 } });
  page.setDefaultTimeout(10000);
  // Kiểm chứng riêng cơ chế async predicate của browser driver đang cài.
  const predicateProbeStart = Date.now();
  const falsePromise = await page.waitForFunction(async () => false, null, {timeout: 500});
  result.asyncPredicateProbe = { returnedValue: await falsePromise.jsonValue(), elapsedMs: Date.now() - predicateProbeStart,
    explanation: 'Async predicate trả Promise truthy: waitForFunction hoàn tất dù resolved value=false; không poll lại.' };
  page.on('pageerror', error => result.errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin || ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin) ? route.continue() : route.abort();
  });
  const registration = await page.request.post(origin + '/api/auth/register', { data: { username: 'hero_fixture', password: 'fixture-password-only' } });
  assert.equal(registration.status(), 201);
  const playerId = (await registration.json()).player.id;
  const fresh = (await (await page.request.get(origin + '/api/save')).json()).data;
  const fixture = { ...fresh, gold: 100000, heroShards: { ...fresh.heroShards, alex: 1000 },
    heroStars: { ...fresh.heroStars, thor: 3 }, resonanceSlots: {slot1: 'thor', slot2: null},
    runes: {rune_flame: 4}, equippedRuneSlots: {etched:[null,null,null],blessing:[null,null],enhancement:['rune_flame',null,null,null],ability:[null,null,null,null]},
    equippedGear: {...fresh.equippedGear, weapon: {uid:'hero_fixture_bow',templateId:'crimson_bow',quality:'common',level:5,awakening:0,locked:true,favorite:true,sockets:[{gem:'ruby',level:1}],affixes:[{stat:'atk_flat',tier:'C',value:14}]}},
    beginnerJourney: { isCompleted: true, skipped: true } };
  await (await getMongoDb()).collection(COLLECTIONS.saves).updateOne({ playerId }, { $set: { data: fixture } });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Archero2FusionAPI && window.ArtemisCloud?.getState().ready);
  await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
  for (const viewport of [{ width: 360, height: 740 }, { width: 1024, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.locator('#bottomNavBar [data-tab="tabEquip"]').first().click();
    const heroNav = page.locator('#tabEquip [data-equipment-nav="characters"]:visible').first();
    assert.match(await heroNav.innerText(), /Anh hùng/i);
    await heroNav.click();
    await page.locator('#subpanelCharacters').waitFor({ state: 'visible' });
    const panel = page.locator('#charHeroStatsStarSkinPanel');
    await page.locator('#btnOpenHeroRoster').click();
    await page.locator('#tabHeroes').waitFor({state:'visible'});
    const trigger = page.locator('#btnToggleCharStarResonance');
    assert.equal(await panel.isVisible(), false, 'star/resonance initially hidden');
    assert.equal(await page.locator('#stageStarSkinDrawer, #charSubtabHeroGrid, #heroSelectList, #petCardsGrid, [data-pet-id], [data-vn-select-hero]').count(), 0);
    assert.equal(await page.locator('[data-hero-upgrade-disclosure]').count(), 1);
    assert.equal(await page.locator('.btn-upgrade-hero-star').count(), 1);
    const before = await page.evaluate(()=>window.Archero2FusionAPI.SaveState.selectedHeroId);
    await page.locator('#heroRosterGrid [data-hero-pick="atreus"]').click();
    assert.equal(await page.evaluate(()=>window.Archero2FusionAPI.SaveState.selectedHeroId),before,'locked hero cannot be selected');
    assert.equal(await page.locator('#weaponCardsGrid, .select-weapon-btn, [data-weapon-id]').count(), 0);
    assert.equal(await page.getByText('Chọn Vũ Khí Chủ Đạo', { exact: true }).count(), 0);
    const item = { viewport, heroNavLabel: 'Anh hùng → Thẻ Anh Hùng', primaryWeaponSelectorAbsent: true, initiallyClosed: true };
    result.viewports.push(item);
    await trigger.scrollIntoViewIfNeeded();
    item.triggerBox = await trigger.boundingBox();
    assert.ok(item.triggerBox.width >= 44 && item.triggerBox.height >= 44, '44px disclosure target');
    await page.screenshot({ path: resolve(evidence, `hero-${viewport.width}-closed.png`) });
    const geometry = async () => page.evaluate(() => {
      const selectors = '#heroRosterGrid, #heroDetailPanel, #btnToggleCharStarResonance, #charHeroStatsStarSkinPanel, #charHeroStatsStarSkinPanel button';
      const elements = [...document.querySelectorAll(selectors)].filter(el => el.getClientRects().length);
      return { viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth,
        boxes: elements.map(el => { const b = el.getBoundingClientRect(); return { id: el.id || el.getAttribute('data-char-hero') || el.tagName, left: b.left, right: b.right, width: b.width }; }),
        clipped: elements.filter(el => { const b = el.getBoundingClientRect(); return b.left < -1 || b.right > innerWidth + 1; }).map(el => ({ id: el.id, text: el.textContent.trim().slice(0, 80) })) };
    });
    item.closedGeometry = await geometry();
    assert.ok(item.closedGeometry.documentWidth <= viewport.width + 1, 'no page horizontal overflow');
    assert.deepEqual(item.closedGeometry.clipped, [], 'no clipped hero controls');
    await trigger.click();
    await panel.waitFor({ state: 'visible' });
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    item.openedByLabelledButton = true;
    await page.waitForTimeout(400);
    item.openGeometry = await geometry();
    assert.ok(item.openGeometry.documentWidth <= viewport.width + 1, 'no page overflow when expanded');
    assert.deepEqual(item.openGeometry.clipped, [], 'no clipped expanded controls');
    await page.screenshot({ path: resolve(evidence, `hero-${viewport.width}-open.png`) });
    await panel.locator('button').first().focus();
    await page.keyboard.press('Escape');
    assert.equal(await panel.isVisible(), false);
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await trigger.evaluate(el => document.activeElement === el), true, 'Escape restores trigger focus');
    item.escapeClosesAndRestoresFocus = true;
    await trigger.click();
    assert.equal(await panel.isVisible(), true);
    await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();
    await page.locator('#bottomNavBar [data-tab="tabHeroes"]').first().click();
    assert.equal(await panel.isVisible(), false, 're-entry resets disclosure');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    item.reentryClosed = true;
    await trigger.click();
    await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();
    await page.locator('#bottomNavBar [data-tab="tabEquip"]').first().click();
    await page.locator('#tabEquip [data-equipment-nav="characters"]:visible').first().click();
    await page.locator('#btnOpenHeroRoster').click();
    assert.equal(await panel.isVisible(), false, 'main navigation re-entry closed');
    item.mainNavigationReentryClosed = true;
    await page.screenshot({ path: resolve(evidence, `hero-${viewport.width}-reentry.png`) });
  }
  // Fixture nâng cấp có cấp vật liệu rõ ràng, không phải thu nhập chơi tự nhiên.
  const progression = await page.evaluate(() => {
    const api = window.Archero2FusionAPI, S = api.SaveState;
    api.renderLobbyUI(); api.renderHeroRoster();
    return { gold: S.gold, shards: S.heroShards.alex, star: S.heroStars.alex || 0,
      pet: S.selectedPetId, resonance: JSON.stringify(S.resonanceSlots), gear: JSON.stringify(S.equippedGear), sockets: JSON.stringify(S.equippedRuneSlots) };
  });
  await page.locator('#btnToggleCharStarResonance').click();
  await page.locator('#charHeroStatsStarSkinPanel .btn-upgrade-hero-star').click();
  const after = await page.evaluate(() => {
    const S = window.Archero2FusionAPI.SaveState;
    return { gold: S.gold, shards: S.heroShards.alex, star: S.heroStars.alex,
      pet: S.selectedPetId, resonance: JSON.stringify(S.resonanceSlots), gear: JSON.stringify(S.equippedGear), sockets: JSON.stringify(S.equippedRuneSlots) };
  });
  assert.equal(after.star, progression.star + 1);
  assert.equal(progression.gold - after.gold, 500, 'exact gold cost once');
  assert.equal(progression.shards - after.shards, 50, 'exact shard cost once');
  for (const key of ['pet','resonance','gear','sockets']) assert.equal(after[key], progression[key]);
  result.progressionDiagnostics = [];
  page.on('response', async response => {
    if (response.url() === origin + '/api/save' && response.request().method() === 'PUT') {
      result.progressionDiagnostics.push({ status: response.status(), body: await response.json() });
    }
  });
  // Predicate đồng bộ: không trả Promise truthy trước khi debounce/PUT hoàn tất.
  // Neo vào kết quả click đã chụp, không so hai giá trị cùng có thể bị rollback.
  await page.waitForFunction(expectedStar => {
    const state = window.ArtemisCloud.getState();
    return !state.dirty && !state.saving && !state.lastError
      && window.Archero2FusionAPI.SaveState.heroStars.alex === expectedStar;
  }, after.star, {timeout: 15000});
  const persisted = (await (await page.request.get(origin + '/api/save')).json()).data;
  assert.equal(persisted.heroStars.alex, after.star, 'HTTP upgrade star must persist');
  assert.equal(persisted.selectedPetId, after.pet);
  assert.deepEqual(persisted.resonanceSlots, JSON.parse(after.resonance));
  assert.equal(persisted.gold, after.gold);
  assert.equal(persisted.heroShards.alex, after.shards);
  assert.deepEqual(persisted.equippedGear, JSON.parse(after.gear));
  assert.deepEqual(persisted.equippedRuneSlots, JSON.parse(after.sockets));
  assert.deepEqual(persisted.equippedGear.weapon, fixture.equippedGear.weapon);
  assert.deepEqual(persisted.equippedRuneSlots, fixture.equippedRuneSlots);
  assert.deepEqual(persisted.resonanceSlots, fixture.resonanceSlots);
  // Retry snapshot cùng revision phải xung đột CAS, không thanh toán lần hai.
  const saved = await (await page.request.get(origin + '/api/save')).json();
  const staleRetry = await page.request.put(origin + '/api/save', {data:{playerId,revision:saved.revision-1,data:persisted}});
  assert.equal(staleRetry.status(),409);
  const retryRead = await (await page.request.get(origin + '/api/save')).json();
  assert.equal(retryRead.revision,saved.revision);
  assert.deepEqual(retryRead.data,persisted);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.ArtemisCloud?.getState().ready);
  await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
  const reloaded = await page.evaluate(() => {
    const S = window.Archero2FusionAPI.SaveState;
    return {gold:S.gold,shards:S.heroShards.alex,star:S.heroStars.alex,pet:S.selectedPetId,
      resonance:JSON.stringify(S.resonanceSlots),gear:JSON.stringify(S.equippedGear),sockets:JSON.stringify(S.equippedRuneSlots)};
  });
  for (const key of ['gold','shards','star','pet']) assert.equal(reloaded[key],after[key],`reload ${key}`);
  for (const key of ['resonance','gear','sockets']) assert.deepEqual(JSON.parse(reloaded[key]),JSON.parse(after[key]),`reload ${key}`);
  result.progression = { fixtureGold: progression.gold, fixtureShards: progression.shards, before: progression, after,
    persisted: { star: persisted.heroStars.alex, shards: persisted.heroShards.alex, gold: persisted.gold },
    reloaded, staleRetryStatus:staleRetry.status(), exactGoldCost:500,exactShardCost:50,
    preserved:['pet','resonance','gear (including gems/affixes)','13 rune sockets'],
    httpSaveReadBack: true, persistenceStatus:'PASS',
    limitation: 'DB memory trong cùng process: chứng minh HTTP/client/reload, không phải Mongo durability hay production.' };
  assert.deepEqual(result.errors, []);
  result.status = 'PASS';
} catch (error) {
  result.status = 'FAIL'; result.failure = error.stack;
  if (page) await page.screenshot({ path: resolve(evidence, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(resolve(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise(r => server.close(r));
}
