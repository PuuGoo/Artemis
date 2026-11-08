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
const root = resolve('public'), evidence = resolve('docs/rune-enchant-evidence');
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
  const registration = await page.request.post(origin + '/api/auth/register', { data: { username: 'enchant_fixture', password: 'fixture-password-only' } });
  assert.equal(registration.status(), 201);
  const playerId = (await registration.json()).player.id;
  const read = async () => (await (await page.request.get(origin + '/api/save')).json()).data;
  const fresh = await read();
  const fixture = { ...fresh, beginnerJourney: { isCompleted: true, skipped: true },
    wikiOtherItems: { ...fresh.wikiOtherItems, enchantium: 100 }, runeEnchantments: {}, runes: { rune_flame: 6, rune_frost: 3, rune_thunder: 7, rune_valkyrie: 11 },
    runeStones: { rune_flame: { epic_2: 1, normal: 2 }, rune_frost: { rare: 2 }, rune_thunder: { legendary: 1 }, rune_valkyrie: { mythic: 3 } },
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
  await page.waitForFunction(() => !window.ArtemisCloud.getState().dirty && !window.ArtemisCloud.getState().saving);
  await page.locator('[data-equip-wiki-rune="rune_flame"]').click();
  assert.equal(await page.locator('[data-rune-enchant="rune_flame"]').isEnabled(),true);
  await page.locator('[data-rune-enchant="rune_flame"]').click();
  await page.waitForFunction(() => window.Archero2FusionAPI.SaveState.runeEnchantments?.rune_flame === 1);
  const after=await read();
  assert.equal(after.runeEnchantments.rune_flame,1);
  assert.equal(after.runeEnchantments.rune_thunder||0,0);
  assert.equal(after.wikiOtherItems.enchantium,90);
  assert.deepEqual(after.runeStones,fixture.runeStones);
  assert.deepEqual(after.equippedRuneSlots,fixture.equippedRuneSlots);
  await page.waitForTimeout(100);
  await page.screenshot({path:resolve(evidence,'enchant-360.png')});
  await page.reload({waitUntil:'domcontentloaded'});await enter();
  assert.equal(await page.evaluate(()=>window.Archero2FusionAPI.SaveState.runeEnchantments.rune_flame),1);
  assert.deepEqual(errors,[]);
  const result={scope:'Chrome + isolated real HTTP/auth/save + memory DB; seeded test inventory, no production',enchantClicked:true,persistedAfterReload:true,level:1,enchantium:90,unrelatedRuneUnchanged:true,stonesPreserved:true,socketsPreserved:true,errors};
  await writeFile(resolve(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
}