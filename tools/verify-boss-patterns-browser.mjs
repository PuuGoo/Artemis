import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Chrome + fixture localhost: không env file, DB hay tài khoản thật; không cấp quyền sở hữu.
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
const evidence = resolve(root, 'docs/boss-patterns-evidence');
await mkdir(evidence, { recursive: true });
const results = [], errors = [], failedLocal = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ ok: true, authenticated: true, player: { id: 'boss_fixture', username: 'boss_fixture' } }));
    if (url.pathname === '/api/save' && req.method === 'GET') return res.end(JSON.stringify({ ok: true, hasSave: false, data: null, revision: 0 }));
    if (url.pathname === '/api/save' && req.method === 'PUT') return res.end(JSON.stringify({ ok: true, revision: 1 }));
    res.statusCode = 404; return res.end(JSON.stringify({ ok: false }));
  }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir + sep)) throw Error('outside public');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(file)] || 'application/octet-stream');
    let body = await readFile(file);
    if (extname(file) === '.html') {
      // Chỉ bản HTML phục vụ trong fixture được lộ render; không thêm API debug vào production.
      const html = body.toString('utf8'), anchor = 'window.Archero2FusionAPI = {';
      assert.equal(html.split(anchor).length, 2);
      body = html.replace(anchor, 'window.__bossLoopForTest = gameLoop;\n' + anchor);
    }
    res.end(body);
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  page.setDefaultTimeout(7000);
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    return url.origin === origin || (request.method() === 'GET' && ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin)) ? route.continue() : route.abort();
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', res => { if (res.url().startsWith(origin) && res.status() >= 400 && !res.url().includes('/api/')) failedLocal.push(res.url()); });
  await page.goto(origin, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.locator('#btnStartGame').click();
  await page.locator('#btnBriefingStart').click();
  await page.evaluate(() => {
    const a = window.Archero2FusionAPI, g = a.Game;
    a.stopGameLoop();
    a.SaveState.save = () => true;
    window.__saveBefore = JSON.stringify(a.SaveState);
    window.__baseChapter = { ...g.chapter };
    // Đi tắt trạng thái chỉ trong harness. Spawner thật vẫn dựng toàn bộ entity.
    window.__bossRoom = (chapterId, room = 15) => {
      a.stopGameLoop();
      const before = { ...a.SaveState.bestRooms };
      g.chapter = { ...window.__baseChapter, id: chapterId, bossName: 'Trùm kiểm thử' };
      g.maxRooms = 15;
      try { a.setupRoom(room); } finally { a.SaveState.bestRooms = before; }
      g.obstacles = []; g.player.skills = {}; g.player.skillList = [];
      g.player.hero = { id: 'fixture', color: '#a3e635' };
      g.player.attackCooldown = 999; g.player.invulnTimer = 999;
      g.player.x = g.width * .7; g.player.y = g.height * .78;
      g.pet.cooldown = 999;
      g.roomBannerTimer = 0; g.shockwaves = []; g.floatTexts = [];
      const e = g.enemies[0]; e.speed = 0; e.vx = e.vy = 0;
      e.x = g.width * .5; e.y = g.height * .42;
      document.getElementById('bossIntroBanner')?.classList.add('hidden');
      return e;
    };
  });
  const matrix = await page.evaluate(() => {
    const a = window.Archero2FusionAPI, g = a.Game, art = window.BossAttackPatterns;
    const checks = [];
    const cases = [[1, 5], [1, 10], [1, 15], ...Array.from({ length: 16 }, (_, i) => [i + 4, 15])];
    for (const [chapter, room] of cases) {
      const e = window.__bossRoom(chapter, room);
      for (const phase of [0, 1, 2]) for (const rage of [false, true]) {
        e.phaseTimer = phase; e.hp = e.maxHp * (rage ? .2 : 1); e.attackTimer = 0;
        g.enemyBullets = [];
        const plan = art.plan(e, g.player);
        a.updateGame(.001);
        const shotsMatch = g.enemyBullets.length === plan.shots.length && plan.shots.every((s, i) => {
          const b = g.enemyBullets[i];
          return Math.abs(b.vx - Math.cos(s.angle) * s.speed) < 1e-8 && Math.abs(b.vy - Math.sin(s.angle) * s.speed) < 1e-8 && b.dmg === s.dmg && b.r === s.r;
        });
        checks.push({ chapter, type: e.type, phase, rage, shots: plan.shots.length, shotsMatch, cooldownMatch: e.attackTimer === plan.cooldown, phaseMatch: e.phaseTimer === plan.phase });
      }
    }
    return { checks, saveUnchanged: JSON.stringify(a.SaveState) === window.__saveBefore };
  });
  assert.ok(matrix.saveUnchanged);
  assert.ok(matrix.checks.every(x => x.shotsMatch && x.cooldownMatch && x.phaseMatch));
  assert.equal(new Set(matrix.checks.map(x => x.type)).size, 19);
  results.push({ name: 'real-spawner-and-update-boss-shot-matrix', ...matrix });

  // Đo lệnh vẽ từ renderGame thật, không gọi renderer rời rồi coi là gameplay.
  await page.evaluate(() => {
    const art = window.BossAttackPatterns, original = art.draw;
    art.draw = (ctx, e, p, now, quiet) => {
      const lines = [], offsets = [];
      const spy = new Proxy(ctx, {
        get(o, k) {
          if (k === 'lineTo') return (...args) => { lines.push(args); o.lineTo(...args); };
          const value = Reflect.get(o, k, o);
          return typeof value === 'function' ? value.bind(o) : value;
        },
        set(o, k, value) { if (k === 'lineDashOffset') offsets.push(value); return Reflect.set(o, k, value, o); },
      });
      const rendered = original(spy, e, p, now, quiet);
      if (rendered) {
        window.__drawFrames = (window.__drawFrames || 0) + 1;
        const plan = art.plan(e, p);
        window.__drawProbe = { lines: lines.length, expected: plan.shots.length, offsets,
          endpointsMatch: lines.length === plan.shots.length && plan.shots.every((s, i) => Math.abs(lines[i][0] - s.x - Math.cos(s.angle) * s.speed * .95) < 1e-8 && Math.abs(lines[i][1] - s.y - Math.sin(s.angle) * s.speed * .95) < 1e-8) };
      }
      return rendered;
    };
  });
  for (const sample of [
    { name: 'zodiac-radial-desktop', width: 1024, chapter: 8, phase: 2, low: false, reduced: false },
    { name: 'mycelium-fan-desktop', width: 1024, chapter: 7, phase: 0, low: false, reduced: false },
    { name: 'zodiac-dual-mobile', width: 390, chapter: 10, phase: 1, low: true, reduced: false },
    { name: 'eclipse-reduced-motion', width: 390, chapter: 5, phase: 2, low: false, reduced: true },
  ]) {
    await page.setViewportSize({ width: sample.width, height: 900 });
    await page.emulateMedia({ reducedMotion: sample.reduced ? 'reduce' : 'no-preference' });
    await page.evaluate(sample => {
      const g = window.Archero2FusionAPI.Game;
      const e = window.__bossRoom(sample.chapter);
      e.phaseTimer = sample.phase;
      // Khoá đồng hồ trong fixture để chụp trước phát bắn, không sửa nhịp game.
      Object.defineProperty(e, 'attackTimer', { configurable: true, get: () => .2, set() {} });
      g.lowGfx = sample.low; g.perfMode = sample.low ? 'low' : 'high';
      window.__drawProbe = null;
      window.__drawFrames = 0;
      document.getElementById('btnResumeGame').click();
      // stopGameLoop đã huỷ rAF; Resume chỉ bỏ pause, không tự dựng vòng mới.
      g.animId = requestAnimationFrame(window.__bossLoopForTest);
    }, sample);
    await page.waitForFunction(() => window.__drawFrames >= 3);
    const probe = await page.evaluate(() => {
      const a = window.Archero2FusionAPI; a.stopGameLoop();
      const canvas = document.getElementById('battleCanvas');
      const rect = canvas.getBoundingClientRect();
      return { ...window.__drawProbe, loopRenderFrames: window.__drawFrames, running: a.Game.running, paused: a.Game.paused,
        updateError: a.Game._lastUpdateError || null, renderError: a.Game._lastRenderError || null,
        saveUnchanged: JSON.stringify(a.SaveState) === window.__saveBefore, canvasWidth: rect.width };
    });
    assert.ok(probe.lines > 0 && probe.endpointsMatch && probe.saveUnchanged && probe.running && !probe.paused);
    assert.ok(probe.loopRenderFrames >= 3 && !probe.updateError && !probe.renderError);
    assert.ok(probe.offsets.every(x => sample.low || sample.reduced ? x === 0 : x < 0));
    await page.screenshot({ path: resolve(evidence, sample.name + '.png') });
    results.push({ name: sample.name, ...probe });
  }
  assert.equal(errors.length, 0, 'lỗi JavaScript');
  assert.equal(failedLocal.length, 0, 'tài nguyên local lỗi');
  const report = { scope: 'Chrome thật, mock auth/save localhost, spawner/update/render thật với state-jump fixture; không phải chơi hết chương hay production E2E', results, errors, failedLocal };
  await writeFile(resolve(evidence, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ shotCases: matrix.checks.length, distinctBosses: new Set(matrix.checks.map(x => x.type)).size, renders: results.slice(1), errors, failedLocal }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message, completedResults: results.length, errors, failedLocal }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
