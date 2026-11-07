import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Browser thật, fixture local: không đọc env file, không DB hay tài khoản thật.
// PLAYWRIGHT_MODULE=<playwright-core/index.mjs> node tools/verify-combat-status-browser.mjs
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
const evidence = resolve(root, 'docs/combat-status-evidence');
await mkdir(evidence, { recursive: true });
const results = [], errors = [], failedLocal = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ ok: true, authenticated: true, player: { id: 'status_fixture', username: 'status_fixture' } }));
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
      const html = body.toString('utf8'), anchor = 'window.Archero2FusionAPI = {';
      assert.equal(html.split(anchor).length, 2);
      // Chỉ fixture lộ vòng lặp để nối lại rAF sau stopGameLoop; không thêm export production.
      body = html.replace(anchor, 'window.__statusLoopForTest = gameLoop;\n' + anchor);
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
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const a = window.Archero2FusionAPI;
    a.stopGameLoop();
    // Mọi sửa fixture sau đây chỉ trong RAM, writer đã bị chặn trước khi sửa.
    a.SaveState.save = () => true;
    window.__statusSaveBefore = JSON.stringify(a.SaveState);
  });
  const probe = await page.evaluate(() => {
    const a = window.Archero2FusionAPI, g = a.Game;
    function fresh() {
      g.room = 1; a.setupRoom(1);
      // Sàn trống để tách tác động trạng thái khỏi va chạm chướng ngại.
      g.obstacles = [];
      g.playerBullets = []; g.enemyBullets = []; g.drops = [];
      g.meteors = []; g.player.skills = {}; g.player.skillList = [];
      g.player.critRate = 0; g.player.moving = true; g.player.hero = { id: 'fixture', color: '#a3e635' };
      g.player.x = g.width * .8; g.player.y = g.height * .8;
      g.player.attackCooldown = 999; g.player.invulnTimer = 999;
      const e = g.enemies[0]; e.hp = e.maxHp = 10000;
      e.x = g.width * .35; e.y = g.height * .35; e.speed = 0; e.attackTimer = 999;
      g.enemies = [e];
      return e;
    }
    const e = fresh();
    g.player.skills.venom_arrow = 1;
    a.damageEnemy(e, 1, false);
    const afterHit = e.hp;
    g.player.skills = {};
    for (let i = 0; i < 40; i++) a.updateGame(.025);
    const afterSecond = e.hp;
    const slow = fresh();
    slow.type = 'goblin'; slow.speed = 50; slow.vx = slow.vy = 0;
    const x = slow.x, y = slow.y;
    a.updateGame(.05);
    const normalDistance = Math.hypot(slow.x - x, slow.y - y);
    slow.x = x; slow.y = y; slow.vx = slow.vy = 0; slow.slowTimer = 2;
    a.updateGame(.05);
    const slowedDistance = Math.hypot(slow.x - x, slow.y - y);
    return { afterHit, afterSecond, poisonTickDamage: afterHit - afterSecond, normalDistance, slowedDistance,
      saveUnchanged: JSON.stringify(a.SaveState) === window.__statusSaveBefore };
  });
  results.push({ name: 'production-damage-and-update-with-run-only-fixture', details: probe });
  assert.ok(probe.poisonTickDamage > 0, 'Độc Tiễn không gây DoT trong update thật');
  assert.ok(probe.slowedDistance < probe.normalDistance, 'quái thường không chậm lại');
  assert.ok(probe.saveUnchanged, 'probe sửa save');
  const sealMatrix = await page.evaluate(() => {
    const a = window.Archero2FusionAPI, g = a.Game, s = a.SaveState;
    const originalRunes = s.runes, originalSlots = s.equippedRuneSlots;
    const checks = [];
    try {
      for (const [rank, equipped, fire, impact, poison] of [
        [0, true, 28, 50, 25], [3, true, 28, 50, 25], [4, false, 28, 50, 25],
        [4, true, 42, 50, 25], [6, true, 42, 50, 25], [7, true, 42, 75, 38], [11, true, 42, 75, 38],
      ]) {
        s.runes = { rune_flame: rank };
        s.equippedRuneSlots = { ability: [], etched: [], blessing: [], enhancement: equipped ? ['rune_flame'] : [] };
        g.room = 1; a.setupRoom(1); g.obstacles = [];
        const e = g.enemies[0]; g.enemies = [e];
        e.hp = e.maxHp = 10000; e.speed = 0; e.attackTimer = 999;
        g.player.skills = { fire_arrow: 1, venom_arrow: 1 };
        g.player.atk = 100; g.player.critRate = 0; g.player.attackCooldown = 999;
        g.player.hero = { id: 'fixture', color: '#a3e635' }; g.pet.cooldown = 999;
        g.player.invulnTimer = 999; g.floatTexts = [];
        a.damageEnemy(e, 100, false);
        const initialDamage = 10000 - e.hp, hp = e.hp;
        for (let i = 0; i < 40; i++) a.updateGame(.025);
        const secondDamage = hp - e.hp;
        checks.push({ rank, equipped, initialDamage, secondDamage,
          matches: initialDamage === 100 + impact && secondDamage === fire * 3 + poison,
          labels: g.floatTexts.filter(t => /LỬA|ĐỘC/.test(t.text)).map(t => t.text) });
      }
    } finally { s.runes = originalRunes; s.equippedRuneSlots = originalSlots; }
    return { checks, saveUnchanged: JSON.stringify(s) === window.__statusSaveBefore };
  });
  assert.ok(sealMatrix.saveUnchanged && sealMatrix.checks.every(x => x.matches));
  assert.ok(sealMatrix.checks.at(-1).labels.includes('LỬA 42') && sealMatrix.checks.at(-1).labels.includes('ĐỘC 38'));
  results.push({ name: 'flame-poison-seal-real-damage-rank-and-ownership-gates', details: sealMatrix });
  // Chuẩn bị trạng thái trên entity do spawner thật dựng, rồi cho renderer thực chạy.
  await page.evaluate(() => {
    const a = window.Archero2FusionAPI, g = a.Game;
    g.room = 1; a.setupRoom(1); g.player.skills = { venom_arrow: 1, fire_arrow: 1, ice_arrow: 1 };
    g.player.critRate = 0; g.player.atk = 40; g.player.attackCooldown = 999;
    g.player.hero = { id: 'fixture', color: '#a3e635' };
    for (const e of g.enemies) { e.hp = e.maxHp = 10000; e.speed = 0; e.attackTimer = 999; a.damageEnemy(e, 1, false); }
    g.lowGfx = false;
    window.__statusRenderFrames = 0;
    const art = window.SkillCombatVfx, original = art.status;
    art.status = (...args) => { window.__statusRenderFrames++; return original(...args); };
    document.getElementById('summaryModal')?.classList.add('hidden');
    document.getElementById('btnResumeGame').click();
    g.animId = requestAnimationFrame(window.__statusLoopForTest);
  });
  await page.waitForFunction(() => window.__statusRenderFrames >= 9);
  await page.waitForTimeout(375);
  const run = await page.evaluate(() => {
    const a = window.Archero2FusionAPI, g = a.Game;
    a.stopGameLoop();
    const canvas = document.getElementById('battleCanvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let filled = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) filled++;
    return { running: g.running, paused: g.paused, enemies: g.enemies.length, filledPixels: filled,
      statusDrawCalls: window.__statusRenderFrames, updateError: g._lastUpdateError || null, renderError: g._lastRenderError || null,
      saveUnchanged: JSON.stringify(a.SaveState) === window.__statusSaveBefore };
  });
  assert.ok(run.running && !run.paused && run.enemies > 0 && run.filledPixels > 0);
  assert.ok(run.statusDrawCalls >= 9 && !run.updateError && !run.renderError);
  assert.ok(run.saveUnchanged);
  await page.screenshot({ path: resolve(evidence, 'status-combat.png') });
  results.push({ name: 'production-renderer-browser-smoke', details: run });
  // Mở hồ sơ từ UI thật, kể cả khi chưa sở hữu: xem tham chiếu không được cấp rune.
  const ownershipBefore = await page.evaluate(() => JSON.stringify(window.Archero2FusionAPI.SaveState.runes));
  await page.evaluate(() => document.getElementById('btnReturnLobby').click());
  await page.locator('#bottomNavBar [data-tab="tabEquip"]').first().click();
  await page.locator('#tabEquip [data-gear-subtab="runes"]').click();
  await page.locator('[data-equip-wiki-rune="rune_flame"]').click();
  const note = page.locator('[data-rune-combat-note]');
  await note.waitFor({ state: 'visible' });
  const noteText = await note.innerText();
  assert.match(noteText, /Epic.*50%.*Legendary.*50%/s);
  assert.match(noteText, /chưa triển khai nổ Mythic/i);
  assert.equal(await page.evaluate(() => JSON.stringify(window.Archero2FusionAPI.SaveState.runes)), ownershipBefore);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: resolve(evidence, 'seal-detail-mobile.png') });
  await page.locator('[data-rune-popup-close]').click();
  assert.equal(await page.locator('.rune-detail-modal').count(), 0);
  results.push({ name: 'seal-detail-real-ui-flow', noteText, ownershipUnchanged: true, closeWorks: true });
  assert.equal(errors.length, 0, 'lỗi JS');
  assert.equal(failedLocal.length, 0, 'tài nguyên local lỗi');
  const report = { scope: 'Chrome thật với mock auth/save local; state jump/run fixture, không phải chơi hết chương hay production E2E', results, errors, failedLocal };
  await writeFile(resolve(evidence, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message, results, errors, failedLocal }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
