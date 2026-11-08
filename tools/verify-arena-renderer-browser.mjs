// Chrome thật + HTTP fixture local; auth/save/admin giả lập, không Mongo/production.
// PLAYWRIGHT_MODULE=<playwright-core/index.mjs> node tools/verify-arena-renderer-browser.mjs
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { getCampaignSummaries, getCampaignDetail } from '../lib/campaignCatalog.js';

assert.ok(process.env.PLAYWRIGHT_MODULE, 'Cần PLAYWRIGHT_MODULE trỏ tới playwright-core đã cài');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public'), output = resolve(root, 'docs/arena-renderer-evidence');
const errors = [], failedLocal = [], rendererRequests = [], results = [];
let revision = 0;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/favicon.ico') { res.statusCode = 204; return res.end(); }
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('content-type', 'application/json');
    const send = data => res.end(JSON.stringify(data));
    if (url.pathname === '/api/auth/me') return send({ ok: true, authenticated: true, player: { id: 'arena_fixture', username: 'arena_fixture' } });
    if (url.pathname === '/api/save' && req.method === 'GET') return send({ ok: true, playerId: 'arena_fixture', hasSave: false, data: null, revision: 0 });
    if (url.pathname === '/api/save' && req.method === 'PUT') { req.resume(); return send({ ok: true, revision: ++revision }); }
    if (url.pathname === '/api/admin/stats') return send({ ok: true, players: { total: 0 }, economy: {}, saves: {}, gameplay: {} });
    if (url.pathname === '/api/admin/players') return send({ ok: true, rows: [], page: 1, pages: 1, total: 0 });
    if (url.pathname === '/api/admin/campaign') return send(url.searchParams.has('chapter')
      ? { ok: true, chapter: getCampaignDetail(Number(url.searchParams.get('chapter'))), readOnly: true }
      : { ok: true, chapters: getCampaignSummaries(), readOnly: true });
    res.statusCode = 404; return send({ ok: false });
  }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir + sep)) throw Error('outside public');
    res.setHeader('content-type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
      '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  page.setDefaultTimeout(8000);
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const allowed = url.origin === origin || (request.method() === 'GET' && ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin));
    return allowed ? route.continue() : route.abort();
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== origin) return;
    if (url.pathname === '/js/game/rendering/arena-renderer.js') rendererRequests.push({ page: page.url().includes('admin.html') ? 'admin' : 'game', status: response.status() });
    if (response.status() >= 400) failedLocal.push(url.pathname);
  });
  await page.goto(origin, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.locator('#btnStartGame').click();
  await page.locator('#btnBriefingStart').click();
  await page.waitForFunction(() => window.Archero2FusionAPI.Game.running && window.Archero2FusionAPI.Game.enemies.length > 0);
  const before = await page.evaluate(() => window.Archero2FusionAPI.Game.lastTime);
  await page.waitForTimeout(500);
  const game = await page.evaluate(() => {
    const api = window.Archero2FusionAPI, g = api.Game;
    api.stopGameLoop();
    const canvas = document.getElementById('battleCanvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0; const colors = new Set();
    for (let i = 0; i < pixels.length; i += 64) {
      if (pixels[i + 3]) painted++;
      colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
    const saveBefore = JSON.stringify(api.SaveState);
    const preview = window.ArtemisArenaRenderer.create();
    preview.init({ chapter: { id: 8 }, room: 1, maxRooms: 15 });
    const currentBiome = ArenaV2.biomeLabel();
    const previewBiome = preview.biomeLabel();
    return { time: g.lastTime, enemies: g.enemies.length, hp: g.player.hp,
      painted, colors: colors.size, currentBiome, previewBiome,
      independent: preview !== ArenaV2 && currentBiome === ArenaV2.biomeLabel(),
      saveUnchanged: JSON.stringify(api.SaveState) === saveBefore };
  });
  assert.ok(game.time > before && game.enemies > 0 && game.hp > 0, 'game loop phải chạy qua đường UI thật');
  assert.ok(game.painted > 100 && game.colors > 20, 'battle canvas không được rỗng/đơn sắc');
  assert.ok(game.independent && game.saveUnchanged);
  assert.notEqual(game.currentBiome, game.previewBiome);
  results.push({ name: 'game-ui-bootstrap-live-loop-and-independent-factory', details: game });

  // Dùng cùng page/browser, navigation dừng hoàn toàn app game trước khi mở admin.
  await page.goto(origin + '/admin.html#campaign', { waitUntil: 'load', timeout: 15000 });
  await page.waitForFunction(() => window.AdminCampaignArenaV2 && document.querySelector('#ccArena'));
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#ccArena');
    return canvas && canvas.getContext('2d').getImageData(100, 100, 1, 1).data[3] > 0;
  });
  const admin = await page.evaluate(() => {
    const canvas = document.querySelector('#ccArena');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0; const colors = new Set();
    for (let i = 0; i < data.length; i += 64) {
      if (data[i + 3]) painted++;
      colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    }
    return { painted, colors: colors.size, biome: window.AdminCampaignArenaV2.biomeLabel(),
      sharedScriptCount: document.querySelectorAll('script[src="/js/game/rendering/arena-renderer.js"]').length,
      legacyScriptCount: document.querySelectorAll('script[src="/admin-campaign-renderer.js"]').length };
  });
  assert.ok(admin.painted > 100 && admin.colors > 20, 'admin canvas không được rỗng/đơn sắc');
  assert.equal(admin.sharedScriptCount, 1);
  assert.equal(admin.legacyScriptCount, 0);
  assert.deepEqual(rendererRequests.map(row => row.status), [200, 200]);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedLocal, []);
  results.push({ name: 'admin-real-ui-dynamic-shared-renderer-load-and-canvas', details: admin });
  await mkdir(output, { recursive: true });
  const report = { scope: 'Chrome thật; HTTP fixture local mock auth/save/admin; không DB/production; không chứng minh vượt chương',
    results, rendererRequests, errors, failedLocal };
  await writeFile(resolve(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise(ok => server.close(ok));
}
