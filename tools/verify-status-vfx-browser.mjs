import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Chrome thật + fixture localhost (mock auth/save). Không DB, không tài khoản thật.
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
const evidence = resolve(root, 'docs/status-vfx-evidence');
await mkdir(evidence, { recursive: true });

const results = [], errors = [], failedLocal = [], vfxRequests = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ ok: true, authenticated: true, player: { id: 'vfx_fixture', username: 'vfx_fixture' } }));
    if (url.pathname === '/api/save' && req.method === 'GET') return res.end(JSON.stringify({ ok: true, hasSave: false, data: null, revision: 0 }));
    if (url.pathname === '/api/save' && req.method === 'PUT') return res.end(JSON.stringify({ ok: true, revision: 1 }));
    res.statusCode = 404; return res.end(JSON.stringify({ ok: false }));
  }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir + sep)) throw Error('outside public');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' })[extname(file)] || 'application/octet-stream');
    let body = await readFile(file);
    if (extname(file) === '.html') {
      const html = body.toString('utf8');
      const anchor = 'window.Archero2FusionAPI = {';
      assert.equal(html.split(anchor).length, 2);
      body = html.replace(anchor, 'window.__renderVfxTest = renderGame;\n' + anchor);
    }
    res.end(body);
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--disable-extensions', '--disable-background-networking'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  page.setDefaultTimeout(12000);
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    return url.origin === origin || (request.method() === 'GET' && ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin))
      ? route.continue() : route.abort();
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', res => {
    if (res.url().includes('/assets/vfx/')) vfxRequests.push({ url: res.url().split('/').pop(), status: res.status() });
    if (res.url().startsWith(origin) && res.status() >= 400 && !res.url().includes('/api/')) failedLocal.push(res.url());
  });
  await page.goto(origin, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.locator('#btnStartGame').click();
  await page.locator('#btnBriefingStart').click();
  await page.waitForTimeout(1200);

  // 1. Texture VFX tải được và có alpha thật (đo pixel).
  const textures = await page.evaluate(async () => {
    const vfx = window.StatusVFX || window.Archero2FusionAPI?.StatusVFX;
    const slots = Object.keys(vfx.SETS).flatMap(k => vfx.SETS[k]);
    const out = [];
    for (const slot of slots) {
      const img = new Image();
      await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error('load ' + slot)); img.src = 'assets/vfx/' + slot + '.webp'; });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let opaque = 0, maxA = 0;
      for (let i = 3; i < d.length; i += 4) { if (d[i] > 8) opaque++; if (d[i] > maxA) maxA = d[i]; }
      out.push({ slot, w: c.width, h: c.height, opaquePct: +(100 * opaque / (d.length / 4)).toFixed(1), maxA });
    }
    return out;
  });
  assert.equal(textures.length, 8, 'thiếu texture: ' + textures.length);
  for (const t of textures) {
    assert.ok(t.opaquePct > 10, t.slot + ' gần như trong suốt');
    assert.equal(t.maxA, 255, t.slot + ' không có pixel đục');
  }
  results.push({ name: 'all-vfx-textures-load-with-alpha', details: textures });

  // 2. Gắn trạng thái lên quái thật rồi xác nhận renderer vẽ hạt.
  const drawing = await page.evaluate(async () => {
    const a = window.Archero2FusionAPI;
    const g = window.Game || a.Game;
    const vfx = window.StatusVFX || a.StatusVFX;
    const enemy = g.enemies[0];
    if (!enemy) return { error: 'không có quái' };
    // Dừng update để không gặp modal lên cấp/auto-lowGfx giữa phép đo.
    // Vẫn gọi chính renderGame production qua handle chỉ tồn tại trong fixture.
    a.stopGameLoop();
    g.lowGfx = false;
    for (const slot of ['burn_a', 'burn_b', 'poison_a', 'poison_b', 'frost_a', 'frost_b']) {
      const img = new Image();
      img.src = 'assets/vfx/' + slot + '.webp';
      await img.decode();
      vfx._cache.set(slot, img);
    }
    const orig = CanvasRenderingContext2D.prototype.drawImage;
    let n = 0;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...rest) {
      if (img && img.tagName === 'IMG' && /assets\/vfx\//.test(img.src)) n++;
      return orig.call(this, img, ...rest);
    };
    const diag = {
      lowGfx: g.lowGfx, reduceMotion: g.reduceMotion,
      prefersReduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
      shouldDraw: vfx.shouldDraw(g), enemies: g.enemies.length,
      running: !!g.running, paused: !!g.paused, hasVfx: typeof window.StatusVFX,
    };
    enemy.burnTimer = 4; enemy.burnDmg = 1;
    enemy.poisonActive = true; enemy.poisonTimer = 4; enemy.poisonDmg = 1;
    enemy.slowTimer = 4;
    const before = n;
    window.__renderVfxTest();
    const burnDraws = n - before;
    const perKind = {};
    for (const kind of ['burn', 'poison', 'frost']) {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      const m0 = n;
      vfx.draw(ctx, { kind, seed: 5, x: 100, y: 100, radius: 20, t: 0.6 }, g);
      perKind[kind] = n - m0;
    }
    CanvasRenderingContext2D.prototype.drawImage = orig;
    return { burnDraws, perKind, burnTimer: enemy.burnTimer, poisonTimer: enemy.poisonTimer, diag };
  });
  assert.ok(!drawing.error, drawing.error);
  assert.ok(drawing.burnDraws >= 3, 'renderer không vẽ hạt trạng thái: ' + JSON.stringify(drawing));
  for (const kind of ['burn', 'poison', 'frost']) assert.ok(drawing.perKind[kind] >= 3, kind + ' không vẽ được: ' + drawing.perKind[kind]);
  results.push({ name: 'status-particles-render-on-real-enemy', details: drawing });
  await page.screenshot({ path: resolve(evidence, 'status-vfx.png') });

  // 3. Gọi lớp vẽ không được thay đổi dữ liệu combat của quái.
  const dmg = await page.evaluate(() => {
    const g = window.Game || window.Archero2FusionAPI.Game;
    const e = g.enemies[0];
    const before = JSON.stringify(e);
    const c = document.createElement('canvas').getContext('2d');
    window.StatusVFX.drawEnemy(c, e, performance.now(), g);
    return { unchanged: before === JSON.stringify(e) };
  });
  assert.equal(dmg.unchanged, true);
  results.push({ name: 'drawing-does-not-mutate-enemy', details: dmg });

  // 4. Hiệu năng thấp: không vẽ hạt.
  const lowGfx = await page.evaluate(() => {
    const vfx = window.StatusVFX || window.Archero2FusionAPI.StatusVFX;
    let n = 0;
    const c = { drawImage() { n++; } };
    const drew = vfx.draw(c, { kind: 'burn', seed: 1, x: 0, y: 0, radius: 20, t: 0.5 }, { lowGfx: true });
    return { drew, n };
  });
  assert.equal(lowGfx.drew, false);
  assert.equal(lowGfx.n, 0);
  results.push({ name: 'low-gfx-skips-particles', details: lowGfx });

  assert.equal(failedLocal.length, 0, 'tài nguyên lỗi: ' + failedLocal.join(','));
  assert.equal(errors.filter(m => !/favicon/i.test(m)).length, 0, 'lỗi JS: ' + errors.join(' | '));
  const servedOk = new Set(vfxRequests.filter(r => r.status === 200).map(r => r.url));
  assert.ok(servedOk.size >= 6, 'không tải đủ texture: ' + servedOk.size);
  assert.equal(vfxRequests.filter(r => r.status >= 400).length, 0);
  results.push({ name: 'vfx-http', details: { served: servedOk.size, files: [...servedOk] } });

  await writeFile(resolve(evidence, 'verification.json'), JSON.stringify({
    scope: 'Chrome thật + fixture localhost, mock auth/save. Xác nhận texture tải/giải mã và hạt được vẽ trên quái thật; không đánh giá thẩm mỹ.',
    results, errors, failedLocal, vfxRequests,
  }, null, 2));
  console.log(JSON.stringify({ textures: textures.length, burnDraws: drawing.burnDraws, perKind: drawing.perKind, served: servedOk.size, errors: errors.length }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message, results, errors, failedLocal, vfxRequests: vfxRequests.slice(0, 6) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
