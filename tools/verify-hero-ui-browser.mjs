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
  page.on('pageerror', error => result.errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin || ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin) ? route.continue() : route.abort();
  });
  const registration = await page.request.post(origin + '/api/auth/register', { data: { username: 'hero_fixture', password: 'fixture-password-only' } });
  assert.equal(registration.status(), 201);
  const playerId = (await registration.json()).player.id;
  const fresh = (await (await page.request.get(origin + '/api/save')).json()).data;
  await (await getMongoDb()).collection(COLLECTIONS.saves).updateOne({ playerId }, { $set: { data: { ...fresh, beginnerJourney: { isCompleted: true, skipped: true } } } });
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
    const trigger = page.locator('#subpanelCharacters > .max-w-3xl').last().getByRole('button', { name: '⭐ Nâng sao & cộng hưởng', exact: true });
    assert.equal(await panel.isVisible(), false, 'star/resonance initially hidden');
    assert.equal(await page.locator('#stageStarSkinDrawer').isVisible(), false);
    assert.equal(await page.locator('#weaponCardsGrid, .select-weapon-btn, [data-weapon-id]').count(), 0);
    assert.equal(await page.getByText('Chọn Vũ Khí Chủ Đạo', { exact: true }).count(), 0);
    const item = { viewport, heroNavLabel: await heroNav.innerText(), primaryWeaponSelectorAbsent: true, initiallyClosed: true };
    result.viewports.push(item);
    await trigger.scrollIntoViewIfNeeded();
    item.triggerBox = await trigger.boundingBox();
    assert.ok(item.triggerBox.width >= 44 && item.triggerBox.height >= 44, '44px disclosure target');
    await page.screenshot({ path: resolve(evidence, `hero-${viewport.width}-closed.png`) });
    const geometry = async () => page.evaluate(() => {
      const selectors = '#subpanelCharacters, #characterStageControls, #vnCharactersAuthenticShowcase, #charSubtabHeroGrid, #charSubtabHeroGrid > *, #btnToggleCharStarResonance, #charHeroStatsStarSkinPanel, #charHeroStatsStarSkinPanel button';
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
    await page.locator('#tabEquip [data-equipment-nav="gear"]:visible').first().click();
    await page.locator('#tabEquip [data-equipment-nav="characters"]:visible').first().click();
    assert.equal(await panel.isVisible(), false, 're-entry resets disclosure');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    item.reentryClosed = true;
    const stageTrigger = page.locator('#btnToggleStageStarSkin');
    await stageTrigger.scrollIntoViewIfNeeded();
    item.stageTriggerBox = await stageTrigger.boundingBox();
    assert.ok(item.stageTriggerBox.width >= 44 && item.stageTriggerBox.height >= 44, '44px stage disclosure target');
    await stageTrigger.click();
    assert.equal(await page.locator('#stageStarSkinDrawer').isVisible(), true);
    await page.locator('#stageStarSkinDrawer button').first().focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#stageStarSkinDrawer').isVisible(), false);
    assert.equal(await stageTrigger.evaluate(el => document.activeElement === el), true);
    item.stageDisclosureVerified = true;
    await trigger.click();
    await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();
    await page.locator('#bottomNavBar [data-tab="tabEquip"]').first().click();
    await page.locator('#tabEquip [data-equipment-nav="characters"]:visible').first().click();
    assert.equal(await panel.isVisible(), false, 'main navigation re-entry closed');
    item.mainNavigationReentryClosed = true;
    await page.screenshot({ path: resolve(evidence, `hero-${viewport.width}-reentry.png`) });
  }
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
