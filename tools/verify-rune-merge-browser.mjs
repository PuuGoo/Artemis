// Chrome thật + HTTP/auth/save thật; dữ liệu thử nghiệm nằm hoàn toàn trong DB bộ nhớ.
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
const register = await import('../api/auth/register.js');
const saves = await import('../api/save.js');
const auth = await import('../api/auth/me.js');
const runes = await import('../api/runes.js');
const root = resolve('public'), evidence = resolve('docs/rune-merge-evidence');
await mkdir(evidence, { recursive: true });
const handlers = { '/api/auth/register': register, '/api/auth/me': auth, '/api/save': saves, '/api/runes': runes };
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
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin || ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin) ? route.continue() : route.abort();
  });
  const registration = await page.request.post(origin + '/api/auth/register', { data: { username: 'merge_fixture', password: 'fixture-password-only' } });
  assert.equal(registration.status(), 201);
  const playerId = (await registration.json()).player.id;
  const read = async () => (await (await page.request.get(origin + '/api/save')).json()).data;
  const fresh = await read();
  const fixture = { ...fresh, beginnerJourney: { isCompleted: true, skipped: true },
    runes: { rune_flame: 4, rune_frost: 3, rune_thunder: 7, rune_valkyrie: 11 },
    runeStones: { rune_flame: { epic: 3, normal: 2 }, rune_frost: { rare: 2 }, rune_thunder: { legendary: 1 }, rune_valkyrie: { mythic: 3 } },
    equippedRuneSlots: { etched: [], blessing: ['rune_valkyrie'], enhancement: ['rune_flame'], ability: ['rune_thunder'] } };
  await (await getMongoDb()).collection(COLLECTIONS.saves).updateOne({ playerId }, { $set: { data: fixture } });
  const enter = async () => {
    await page.waitForFunction(() => window.Archero2FusionAPI && window.ArtemisCloud?.getState().ready);
    await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
    await page.locator('#bottomNavBar [data-tab="tabEquip"]').first().click();
    if (!await page.locator('#subpanelRunes').isVisible()) await page.locator('#tabEquip [data-equipment-nav="runes"]:visible').first().click();
  };
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await enter();
  await page.locator('#btnRuneWorkshop').click();
  assert.equal(await page.locator('[data-rune-merge="rune_flame"][data-merge-tier="normal"]').isDisabled(), true);
  assert.equal(await page.locator('[data-rune-merge="rune_valkyrie"]').isDisabled(), true);
  await page.waitForFunction(() => !window.ArtemisCloud.getState().dirty && !window.ArtemisCloud.getState().saving);
  await page.locator('[data-rune-merge="rune_flame"][data-merge-tier="epic"]').click();
  await page.waitForFunction(() => window.Archero2FusionAPI.SaveState.runes.rune_flame === 5);
  const after = await read();
  assert.equal(after.runeStones.rune_flame.epic, 0);
  assert.equal(after.runeStones.rune_flame.epic_1, 1);
  assert.deepEqual(after.equippedRuneSlots, fixture.equippedRuneSlots);
  assert.equal(after.gems, fixture.gems);
  assert.equal(after.gold, fixture.gold);
  const art = await page.locator('.rune-inventory-glyph > img.rune-crystal-art').evaluateAll(async imgs => {
    await Promise.all(imgs.map(img => img.decode()));
    return imgs.map(img => ({ src: img.getAttribute('src'), width: img.getBoundingClientRect().width, parent: img.parentElement.getBoundingClientRect().width, naturalWidth: img.naturalWidth }));
  });
  assert.ok(art.every(img => img.width > img.parent * .9 && img.naturalWidth > 0));
  assert.ok(art.some(img => img.src.endsWith('Rune_skill_50.png')));
  assert.ok(art.some(img => img.src.endsWith('Rune_grow_41.png')));
  await page.locator('#tabEquip').evaluate(el => el.scrollTop = 0);
  await page.screenshot({ path: resolve(evidence, 'merged-360.png') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await enter();
  assert.equal(await page.evaluate(() => window.Archero2FusionAPI.SaveState.runes.rune_flame), 5);
  assert.deepEqual(errors, []);
  const result = { scope: 'Chrome + isolated real HTTP/auth/save + memory DB; seeded stones, not production', mergeClicked: true, persistedAfterReload: true, insufficientDisabled: true, mythicDisabled: true, resourcesUnchanged: true, equippedPreserved: true, art, errors };
  await writeFile(resolve(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
}
