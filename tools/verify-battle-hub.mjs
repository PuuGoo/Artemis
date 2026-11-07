import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/saveSchema.js';

// Chrome thật + auth/save bộ nhớ: không DB, không tài khoản thật, không đọc .env.
// PLAYWRIGHT_MODULE=<đường dẫn playwright-core/index.mjs> node tools/verify-battle-hub.mjs [--baseline]
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
const evidence = resolve(root, 'docs/battle-hub-evidence');
await mkdir(evidence, { recursive: true });
const baselineOnly = process.argv.includes('--baseline');
const baselineHtml = baselineOnly ? execFileSync('git', ['show', 'dc0b831:public/index.html'], { cwd: root, maxBuffer: 4 * 1024 * 1024 }).toString('utf8') : null;
let saved = null;
let revision = 0;
const results = [];
const errors = [];
const failedLocal = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ ok: true, authenticated: true, player: { id: 'battle_ui_fixture', username: 'battle_ui_fixture' } }));
    if (url.pathname === '/api/save' && req.method === 'GET') return res.end(JSON.stringify(saved ? { ok: true, hasSave: true, data: saved, revision } : { ok: true, hasSave: false, data: null, revision: 0 }));
    if (url.pathname === '/api/save' && req.method === 'PUT') {
      let body = ''; for await (const chunk of req) body += chunk;
      const input = JSON.parse(body);
      const checked = sanitizeSave(input.data);
      if (!checked.ok) { res.statusCode = 422; return res.end(JSON.stringify({ ok: false, error: checked.reason })); }
      saved = checked.data; revision++;
      return res.end(JSON.stringify({ ok: true, revision }));
    }
    res.statusCode = 404; return res.end(JSON.stringify({ ok: false }));
  }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir + sep)) throw Error('outside public');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' })[extname(file)] || 'application/octet-stream');
    res.end(baselineHtml && url.pathname === '/' ? baselineHtml : await readFile(file));
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(7000);
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const allowed = ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
    return url.origin === origin || (request.method() === 'GET' && allowed.includes(url.origin)) ? route.continue() : route.abort();
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', res => { if (res.url().startsWith(origin) && res.status() >= 400 && !res.url().includes('/api/')) failedLocal.push(res.url()); });
  await page.goto(origin, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.waitForTimeout(450);
  const geometry = () => page.evaluate(() => {
    const box = selector => {
      const e = document.querySelector(selector), r = e?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, visible: !!e.getClientRects().length } : null;
    };
    const tab = document.getElementById('tabBattle');
    const start = document.getElementById('btnStartGame');
    const r = start.getBoundingClientRect();
    return {
      width: innerWidth, documentOverflow: document.documentElement.scrollWidth - innerWidth,
      tabOverflow: tab.scrollWidth - tab.clientWidth, tabHeight: tab.clientHeight, contentHeight: tab.scrollHeight,
      start: box('#btnStartGame'), map: box('.ms-stage'), legacy: box('#chapterSelectStrip'),
      startAtLoad: r.top >= 0 && r.bottom <= document.getElementById('bottomNavBar').getBoundingClientRect().top,
      topmost: document.elementFromPoint(r.x + r.width / 2, Math.min(innerHeight - 1, r.y + r.height / 2))?.closest('button') === start,
      modes: [...document.querySelectorAll('[data-mode-pick]')].map(e => ({ name: e.innerText, height: e.getBoundingClientRect().height })),
    };
  });
  results.push({ name: baselineOnly ? 'baseline-desktop' : 'desktop', details: await geometry() });
  if (baselineOnly) {
    await page.screenshot({ path: resolve(evidence, 'before-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.getElementById('tabBattle').scrollTop = 0);
    results.push({ name: 'baseline-mobile', details: await geometry() });
    await page.screenshot({ path: resolve(evidence, 'before-mobile.png') });
  } else {
    await page.screenshot({ path: resolve(evidence, 'after-desktop.png') });
    for (const width of [1024, 390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => document.getElementById('tabBattle').scrollTop = 0);
      const g = await geometry();
      assert.ok(g.documentOverflow <= 1 && g.tabOverflow <= 1, `tràn ngang tại ${width}`);
      assert.ok(g.start.height >= 44 && g.startAtLoad && g.topmost, `nút bắt đầu không dùng được tại ${width}`);
      assert.ok(g.modes.every(x => x.height >= 44));
      results.push({ name: `geometry-${width}`, details: g });
      if (width === 390) await page.screenshot({ path: resolve(evidence, 'after-mobile.png') });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#battleChapterPicker summary').click();
    const before = await page.evaluate(() => window.Archero2FusionAPI.SaveState.selectedChapterIdx);
    await page.locator('[data-map-tab="1"]').click();
    assert.equal(await page.evaluate(() => window.Archero2FusionAPI.SaveState.selectedChapterIdx), before);
    assert.equal(await page.locator('#btnStartGame').isDisabled(), true);
    assert.equal(await page.locator('#btnContinueRun').isVisible(), false);
    await page.locator('#btnBattleReturnChapter').click();
    assert.equal(await page.locator('#btnStartGame').isDisabled(), false);
    await page.locator('#battleChapterPicker summary').click();
    results.push({ name: 'locked-preview-return', status: 'PASS' });
    await page.locator('#battlePrepDetails summary').click();
    assert.ok(await page.locator('#heroSelectList').isVisible());
    const initialHero = await page.evaluate(() => window.Archero2FusionAPI.SaveState.selectedHeroId);
    assert.equal(await page.locator('.hero-card-btn[data-hero-id="thor"]').getAttribute('aria-disabled'), 'true');
    // Thử handler dù thao tác bình thường bị aria-disabled chặn.
    await page.locator('.hero-card-btn[data-hero-id="thor"]').dispatchEvent('click');
    assert.equal(await page.evaluate(() => window.Archero2FusionAPI.SaveState.selectedHeroId), initialHero);
    await page.locator('#battlePrepDetails summary').click();
    results.push({ name: 'prepare-and-ownership', status: 'PASS' });
    await page.locator('#btnBattleHelp').click();
    assert.ok(await page.locator('#guideModal').isVisible());
    await page.locator('#btnCloseGuide').click();
    await page.locator('#msBtnBestiary').click();
    assert.ok(await page.locator('#bestiaryModal').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#bestiaryModal').isVisible(), false);
    results.push({ name: 'help-and-bestiary', status: 'PASS' });
    for (const id of ['endless', 'tower', 'bossrush', 'practice', 'campaign']) {
      await page.locator(`[data-mode-pick="${id}"]`).click();
      await page.locator('#btnStartGame').click();
      assert.ok(await page.locator('#runBriefingModal').isVisible());
      const modeName = await page.evaluate(id => window.Archero2FusionAPI.GAME_MODES.find(m => m.id === id).name, id);
      assert.ok((await page.locator('#runBriefingCard').innerText()).includes(id === 'campaign' ? 'Đá Cổ' : modeName));
      if (id === 'practice') assert.ok((await page.locator('#runBriefingCard').innerText()).includes('Không nhận vàng'));
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'btnBriefingStart');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#runBriefingModal').isVisible(), false);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'btnStartGame');
    }
    results.push({ name: 'five-mode-briefings-keyboard', status: 'PASS' });
    const animation = await page.evaluate(() => ({ orbit: getComputedStyle(document.querySelector('.battle-map-orbit')).animationName, aura: getComputedStyle(document.querySelector('.ms-aura')).animationName }));
    assert.notEqual(animation.orbit, 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await page.evaluate(() => [...document.querySelectorAll('#tabBattle *')].filter(e => getComputedStyle(e).animationName !== 'none').length);
    assert.equal(reduced, 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#bottomNavBar .grid [data-tab="tabHeroes"]').click();
    const paused = await page.evaluate(() => getComputedStyle(document.querySelector('.battle-map-orbit')).animationPlayState);
    assert.equal(paused, 'paused');
    await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
    results.push({ name: 'motion', details: { animation, reducedAnimations: reduced, hiddenPlayState: paused } });
    await page.locator('#btnStartGame').click();
    await page.locator('#btnBriefingCancel').click();
    assert.equal(await page.locator('#runBriefingModal').isVisible(), false);
    await page.locator('#btnStartGame').click();
    await page.locator('#btnBriefingStart').click();
    await page.waitForTimeout(2200);
    const run = await page.evaluate(() => {
      const a = window.Archero2FusionAPI, g = a.Game, canvas = document.getElementById('battleCanvas');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let filled = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) filled++;
      return { running: g.running, paused: g.paused, room: g.room, enemies: g.enemies.length, hp: g.player?.hp, lastTime: g.lastTime, filledPixels: filled };
    });
    assert.ok(run.running && run.enemies > 0 && run.filledPixels > 0 && run.lastTime > 0);
    await page.screenshot({ path: resolve(evidence, 'battle-start.png') });
    results.push({ name: 'real-start-smoke-not-complete-playthrough', details: run });
    assert.equal(errors.length, 0, 'lỗi JavaScript');
    assert.equal(failedLocal.length, 0, 'tài nguyên local tải lỗi');
  }
  const report = { scope: 'Chrome local + mocked auth/save, không phải production E2E', results, errors, failedLocal };
  await writeFile(resolve(evidence, baselineOnly ? 'baseline.json' : 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message, results, errors, failedLocal }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
