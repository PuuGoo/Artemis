// Chrome local + auth/save giả lập; không đọc .env, không kết nối DB thật.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const evidence = resolve(process.env.ARTEMIS_EVIDENCE_DIR || fileURLToPath(new URL('../docs/arena-responsive-evidence/', import.meta.url)));
await mkdir(evidence, { recursive: true });
let saved = null, revision = 0;
const errors = [], results = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ ok: true, authenticated: true, player: { id: 'arena_fixture', username: 'arena_fixture' } }));
  if (url.pathname === '/api/save' && req.method === 'GET') return res.end(JSON.stringify({ ok: true, hasSave: !!saved, data: saved, revision }));
  if (url.pathname === '/api/save' && req.method === 'PUT') {
    let body = ''; for await (const chunk of req) body += chunk;
    saved = JSON.parse(body).data;
    return res.end(JSON.stringify({ ok: true, revision: ++revision }));
  }
  if (url.pathname.startsWith('/api/')) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false })); }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(resolve(publicDir) + sep)) throw Error('outside public');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1.25 });
  page.setDefaultTimeout(7000);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin || ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin) ? route.continue() : route.abort();
  });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.locator('#btnStartGame').click();
  await page.locator('#btnBriefingStart').click();
  await page.waitForSelector('#skillSelectModal:not(.hidden)');
  await page.locator('.skill-choice-card').first().click();
  await page.waitForFunction(() => document.getElementById('skillSelectModal').classList.contains('hidden'));
  await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
  for (const room of [1, 10]) {
    await page.evaluate(room => {
      const a = window.Archero2FusionAPI;
      a.Game.running = true; a.Game.paused = false; a.setupRoom(room); a.stopGameLoop();
    }, room);
    const before = await page.evaluate(() => {
      const g = window.Archero2FusionAPI.Game;
      return JSON.stringify({ width: g.width, height: g.height, player: g.player, enemies: g.enemies, obstacles: g.obstacles, portal: g.portalRect });
    });
    for (const [width, height] of [[1366,768], [1280,720], [1536,864], [1920,1080], [390,844], [360,640]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(200);
      const measured = await page.evaluate(() => {
        const a = window.Archero2FusionAPI, g = a.Game;
        a.renderGame();
        const box = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
        const canvas = document.getElementById('battleCanvas');
        return { shell:box('gameArenaView'), canvas:box('battleCanvas'), backing:{ width:canvas.width, height:canvas.height }, view:ArtemisArenaViewport.viewSize(g), state:JSON.stringify({ width:g.width, height:g.height, player:g.player, enemies:g.enemies, obstacles:g.obstacles, portal:g.portalRect }), overflow:document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(measured.state, before, 'resize must preserve live world and entities');
      delete measured.state;
      results.push({ room, width, height, ...measured });
      if (room === 1 && width === 1366) await page.screenshot({ path:resolve(evidence, 'laptop.png') });
      if (room === 10 && width === 1920) await page.screenshot({ path:resolve(evidence, 'boss-desktop.png') });
    }
  }
  await page.setViewportSize({width:1366,height:768});
  await page.locator('#btnPauseGame').click();
  await page.waitForSelector('#summaryModal[data-pause="true"]:not(.hidden)');
  assert.equal(await page.evaluate(() => window.Archero2FusionAPI.Game.paused), true);
  await page.locator('#btnResumeGame').click();
  assert.equal(await page.evaluate(() => window.Archero2FusionAPI.Game.paused), false);
  await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
  assert.deepEqual(errors, []);
  await writeFile(resolve(evidence, 'results.json'), JSON.stringify({ scope:'Chrome local, mock auth/save, stopped loop geometry; not natural combat or production', results, errors }, null, 2));
  console.log(JSON.stringify({ evidence, results, errors }));
  for (const row of results) {
    assert.ok(!row.overflow, 'no horizontal overflow');
    assert.ok(row.shell.x >= -1 && row.shell.y >= -1 && row.shell.x + row.shell.width <= row.width + 1 && row.shell.y + row.shell.height <= row.height + 1, 'shell stays in viewport');
    assert.ok(Math.abs(row.canvas.width / row.canvas.height - row.view.width / row.view.height) < .002, 'uniform canvas scale');
    assert.ok(Math.abs(row.canvas.width - row.shell.width) < 2 && Math.abs(row.canvas.height - row.shell.height) < 2, 'no letterboxing inside shell');
    if (row.width >= 1024 && row.height <= 864) assert.ok(row.canvas.height >= row.height * .93, 'laptop uses at least 93% viewport height');
    assert.ok(Math.abs(row.backing.width - Math.ceil(row.canvas.width * 1.25)) <= 1, 'HiDPI width within CSS subpixel rounding');
    assert.ok(Math.abs(row.backing.height - Math.ceil(row.canvas.height * 1.25)) <= 1, 'HiDPI height within CSS subpixel rounding');
  }
  console.log('PASS: responsive geometry, unchanged physics, HiDPI, real pause/resume clicks');
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
