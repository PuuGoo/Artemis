// Chrome thật, server loopback + auth/save bộ nhớ; không .env/DB/production.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/save/schema.js';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const evidence = fileURLToPath(new URL('../docs/pixelfx-evidence/', import.meta.url));
await mkdir(evidence, { recursive: true });
let saved = null, revision = 0;
const errors = [], failures = [], results = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = data => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)); };
  if (url.pathname === '/favicon.ico') { res.statusCode = 204; return res.end(); }
  if (url.pathname === '/api/auth/me') return send({ ok: true, authenticated: true, player: { id: 'pixel_fixture', username: 'pixel_fixture' } });
  if (url.pathname === '/api/save' && req.method === 'GET') return send({ ok: true, hasSave: !!saved, data: saved, revision });
  if (url.pathname === '/api/save' && req.method === 'PUT') {
    let body = ''; for await (const chunk of req) body += chunk;
    const checked = sanitizeSave(JSON.parse(body).data);
    if (!checked.ok) { res.statusCode = 422; return send(checked); }
    saved = checked.data; return send({ ok: true, revision: ++revision });
  }
  if (url.pathname.startsWith('/api/')) { res.statusCode = 404; return send({ ok: false }); }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(resolve(publicDir) + sep)) throw Error('outside public');
    res.setHeader('content-type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(9000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) failures.push(r.url()); });
  await page.route('**/*', route => {
    const req = route.request(), url = new URL(req.url());
    return url.origin === origin || (req.method() === 'GET' && ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin)) ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    window.__pixelDraws = [];
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...args) {
      if (img?.src?.includes('/assets/pixelfx/')) window.__pixelDraws.push(img.src.split('/').pop());
      return draw.call(this, img, ...args);
    };
  });
  await page.goto(origin, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.waitForSelector('[data-world-chapter="1"].is-fx-visible');
  const chapters = await page.locator('[data-world-chapter]').count();
  assert.equal(await page.locator('.world-map-effect').count(), chapters);
  const active = page.locator('[data-world-chapter="1"] .world-map-effect');
  assert.equal(await active.evaluate(n => getComputedStyle(n).pointerEvents), 'none');
  assert.equal(await active.evaluate(n => getComputedStyle(n).animationPlayState), 'running');
  const pos = await active.evaluate(n => getComputedStyle(n).backgroundPosition);
  await page.waitForTimeout(350);
  assert.notEqual(await active.evaluate(n => getComputedStyle(n).backgroundPosition), pos);
  assert.equal(await page.locator('[data-world-chapter="19"] .world-map-effect').evaluate(n => getComputedStyle(n).animationPlayState), 'paused');
  for (const width of [1366, 390, 360]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 844 });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(evidence, `map-${width}.png`) });
  }
  await page.locator('[data-world-chapter="2"]').scrollIntoViewIfNeeded();
  await page.locator('[data-world-chapter="2"]').click();
  assert.equal(await page.evaluate(() => window.Archero2FusionAPI.SaveState.selectedChapterIdx), 0);
  assert.ok(await page.locator('#btnStartGame').isDisabled());
  await page.locator('[data-world-map-return]').click();
  assert.equal(await page.locator('#btnStartGame').isDisabled(), false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await active.evaluate(n => getComputedStyle(n).display), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.getElementById('tabBattle').classList.add('battle-motion-low'));
  assert.equal(await active.evaluate(n => getComputedStyle(n).display), 'none');
  await page.evaluate(() => document.getElementById('tabBattle').classList.remove('battle-motion-low'));
  results.push({ name: 'world-map-real-clicks-animation-offscreen-pause-reduced-low-responsive', chapters });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('#btnStartGame').click(); await page.locator('#btnBriefingStart').click();
  await page.waitForSelector('#skillSelectModal:not(.hidden)');
  await page.locator('.skill-choice-card').first().click();
  await page.waitForFunction(() => !window.Archero2FusionAPI.Game.paused);
  const before = await page.evaluate(() => window.Archero2FusionAPI.Game.lastTime);
  await page.waitForTimeout(450);
  const live = await page.evaluate(() => {
    const a = window.Archero2FusionAPI, g = a.Game; a.stopGameLoop();
    return { lastTime: g.lastTime, hp: g.player.hp, enemies: g.enemies.length, running: g.running };
  });
  assert.ok(live.lastTime > before && live.running && live.hp > 0 && live.enemies > 0);
  results.push({ name: 'real-ui-start-and-live-combat', ...live });
  const assets = await page.evaluate(async () => {
    const out = [];
    for (const [id, m] of Object.entries(window.ArtemisPixelFXAtlas)) {
      const img = new Image(); img.src = m.src; await img.decode();
      const c = document.createElement('canvas'); c.width = m.width; c.height = m.height;
      c.getContext('2d').drawImage(img, 0, 0, m.width, m.height, 0, 0, m.width, m.height);
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let visible = 0, transparent = 0;
      for (let i = 3; i < data.length; i += 4) { if (data[i]) visible++; else transparent++; }
      out.push({ id, visible, transparent, width: img.naturalWidth, height: img.naturalHeight });
    }
    return out;
  });
  for (const a of assets) assert.ok(a.visible && a.transparent, a.id);
  results.push({ name: 'real-HTTP-PNG-decode-alpha', assets });
  for (const [chapter, room] of [[1,1], [1,2], [2,1], [3,1], [4,1], [7,1], [19,10]]) {
    await page.evaluate(({ chapter, room }) => {
      const a = window.Archero2FusionAPI, g = a.Game;
      g.chapter = a.getCampaignChapters().find(c => c.id === chapter);
      g.room = room; g.lowGfx = false; g.perfMode = 'high';
      a.setupRoom(room); a.stopGameLoop(); a.renderGame();
    }, { chapter, room });
    await page.waitForTimeout(200);
    const detail = await page.evaluate(() => {
      const a = window.Archero2FusionAPI, g = a.Game;
      const snapshot = JSON.stringify({ player: g.player, enemies: g.enemies, obstacles: g.obstacles, portal: g.portalRect, width: g.width, height: g.height });
      window.__pixelDraws = []; a.renderGame();
      return { unchanged: snapshot === JSON.stringify({ player: g.player, enemies: g.enemies, obstacles: g.obstacles, portal: g.portalRect, width: g.width, height: g.height }), draws: [...new Set(window.__pixelDraws)], enemies: g.enemies.length, biome: ArenaV2.biomeLabel() };
    });
    assert.ok(detail.unchanged && detail.draws.length > 0 && detail.enemies > 0);
    await page.locator('#battleCanvas').screenshot({ path: resolve(evidence, `arena-${chapter}-${room}.png`) });
    results.push({ name: 'production-spawner-renderer-fixture', chapter, room, ...detail });
  }
  const portal = await page.evaluate(async () => {
    const a = window.Archero2FusionAPI, g = a.Game; g.portalOpen = true;
    a.renderGame(); await new Promise(r => setTimeout(r, 150));
    window.__pixelDraws = []; a.renderGame();
    const portal = window.__pixelDraws.includes('portal.png');
    g.lowGfx = true; window.__pixelDraws = []; a.renderGame();
    return { portal, lowDraws: window.__pixelDraws.length };
  });
  assert.ok(portal.portal); assert.equal(portal.lowDraws, 0);
  results.push({ name: 'portal-open-and-low-gfx-fallback', ...portal });
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  const report = { scope: 'Chrome thật; HTTP mock auth/save + sanitizer thật; phòng khác dùng spawner thật nhưng nhảy fixture, không phải vượt chương tự nhiên; không production', results, errors, failures };
  await writeFile(resolve(evidence, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (e) { console.error(JSON.stringify({ error: e.stack, results, errors, failures }, null, 2)); process.exitCode = 1; }
finally { await browser?.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
