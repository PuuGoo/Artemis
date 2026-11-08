// Chrome thật, API thật và DB bộ nhớ riêng; không đọc .env hay gọi production.
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
const register = await import('../api/auth/register.js');
const saves = await import('../api/save.js');
const shop = await import('../lib/shop/handler.js');
const auth = await import('../api/auth/me.js');
const publicDir = resolve('public');
const evidence = resolve('docs/shop-evidence');
await mkdir(evidence, { recursive: true });
const handlers = { '/api/auth/register': register, '/api/auth/me': auth, '/api/save': saves, '/api/shop': shop };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      const handler = handlers[url.pathname]?.[req.method];
      if (!handler) { res.writeHead(404); return res.end('{}'); }
      let body = ''; for await (const chunk of req) body += chunk;
      const request = new Request(url, { method: req.method, headers: req.headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body }) });
      const response = await handler(request);
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
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin || ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin) ? route.continue() : route.abort();
  });
  const response = await page.request.post(origin + '/api/auth/register', { data: { username: 'shop_browser_fixture', password: 'fixture-password-only' } });
  assert.equal(response.status(), 201);
  await page.goto(origin, { waitUntil: 'load' });
  await page.waitForFunction(() => window.Archero2FusionAPI && window.ArtemisCloud?.getState().ready);
  await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
  await page.locator('#bottomNavBar [data-tab="tabShopVn"]').click();
  await page.locator('[data-vip-offer="ds_1"]').waitFor();
  await page.locator('[data-vn-topup-tab="gold"]').click();
  const before = await (await page.request.get(origin + '/api/save')).json();
  await page.locator('[data-vip-offer="gold_6420"]').scrollIntoViewIfNeeded();
  const scrollBefore = await page.locator('#vnShopMainContainer .sv2-body').evaluate(el => el.scrollTop);
  assert.ok(scrollBefore > 0, 'test phải bắt đầu ở khu vực mua phía dưới');
  let dialogText = '';
  page.once('dialog', async dialog => { dialogText = dialog.message(); await dialog.dismiss(); });
  await page.locator('[data-vip-offer="gold_6420"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-vip-offer="gold_6420"]').disabled);
  assert.match(dialogText, /Giá: 20 Kim Cương/);
  assert.match(dialogText, /Phần thưởng/);
  assert.match(dialogText, /Số dư sau mua: 30 Kim Cương/);
  const scrollAfterCancel = await page.locator('#vnShopMainContainer .sv2-body').evaluate(el => el.scrollTop);
  assert.ok(Math.abs(scrollAfterCancel - scrollBefore) <= 1, `hủy popup làm nhảy vị trí: ${scrollBefore} -> ${scrollAfterCancel}`);
  const cancelled = await (await page.request.get(origin + '/api/save')).json();
  assert.equal(cancelled.data.gems, before.data.gems);
  assert.equal(cancelled.data.gold, before.data.gold);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-vip-offer="gold_6420"]').click();
  await page.waitForFunction(() => window.ArtemisCloud.getPendingShopOffer() === null && document.querySelector('details article'));
  const after = await (await page.request.get(origin + '/api/save')).json();
  assert.equal(after.data.gems, before.data.gems - 20);
  assert.equal(after.data.gold, before.data.gold + 6420);
  const scrollAfterBuy = await page.locator('#vnShopMainContainer .sv2-body').evaluate(el => el.scrollTop);
  assert.ok(Math.abs(scrollAfterBuy - scrollBefore) <= 1, `mua làm nhảy vị trí: ${scrollBefore} -> ${scrollAfterBuy}`);
  const history = await (await page.request.get(origin + '/api/shop')).json();
  assert.equal(history.history.length, 1);
  await page.locator('#vnShopMainContainer details summary').click();
  assert.match(await page.locator('#vnShopMainContainer details').innerText(), /Số dư sau mua: 30 Kim Cương/);
  await page.locator('#vnShopMainContainer details').screenshot({ path: resolve(evidence, 'history.png') });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.ArtemisCloud?.getState().ready);
  await page.locator('#bottomNavBar [data-tab="tabShopVn"]').click();
  await page.locator('#vnShopMainContainer details article').waitFor({ state: 'attached' });
  assert.equal(await page.locator('#vnShopMainContainer details article').count(), 1);
  assert.deepEqual(errors, []);
  const result = { scope: 'Chrome + real HTTP handlers + isolated memory DB; not production/Mongo durability', before: { gold: before.data.gold, gems: before.data.gems }, after: { gold: after.data.gold, gems: after.data.gems }, scrollBefore, scrollAfterCancel, scrollAfterBuy, cancelledWithoutDebit: true, historyAfterReload: 1, dialogText, errors };
  await writeFile(resolve(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
}
