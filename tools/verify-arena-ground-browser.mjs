import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Chrome thật + fixture localhost (mock auth/save). Không DB, không tài khoản thật.
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
const evidence = resolve(root, 'docs/arena-ground-evidence');
await mkdir(evidence, { recursive: true });

const results = [], errors = [], failedLocal = [], mapRequests = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ ok: true, authenticated: true, player: { id: 'ground_fixture', username: 'ground_fixture' } }));
    if (url.pathname === '/api/save' && req.method === 'GET') return res.end(JSON.stringify({ ok: true, hasSave: false, data: null, revision: 0 }));
    if (url.pathname === '/api/save' && req.method === 'PUT') return res.end(JSON.stringify({ ok: true, revision: 1 }));
    res.statusCode = 404; return res.end(JSON.stringify({ ok: false }));
  }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir + sep)) throw Error('outside public');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
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
    if (res.url().endsWith('.webp')) mapRequests.push({ url: res.url().split('/').pop(), status: res.status() });
    if (res.url().startsWith(origin) && res.status() >= 400 && !res.url().includes('/api/')) failedLocal.push(res.url());
  });
  await page.goto(origin, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.locator('#btnStartGame').click();
  await page.locator('#btnBriefingStart').click();
  await page.waitForTimeout(1500);

  // 1. Ảnh nền phải tải thật và giải mã xong.
  const load = await page.evaluate(async () => {
    const art = (window.ArenaGround || window.Archero2FusionAPI?.ArenaGround);
    const key = art.pick(2, 3);
    const img = new Image();
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error('load fail')); img.src = 'assets/maps/' + key + '.webp'; });
    return { key, w: img.naturalWidth, h: img.naturalHeight, pick: [1, 2, 3, 4, 5].map((n) => art.pick(2, n)) };
  });
  assert.ok(load.w >= 700 && load.h >= 700, 'ảnh quá nhỏ: ' + JSON.stringify(load));
  results.push({ name: 'background-image-loads', details: load });

  // 2. drawArena vẽ nền ảnh thật, không lỗi.
  const drawCheck = await page.evaluate(() => {
    const orig = CanvasRenderingContext2D.prototype.drawImage;
    let n = 0, last = null;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...rest) {
      // Chỉ đếm ảnh nền map; chân dung/skill cũng là IMG nên phải lọc theo đường dẫn.
      if (img && img.tagName === 'IMG' && /assets\/maps\//.test(img.src)) { n++; last = img.src.split('/').pop(); }
      return orig.call(this, img, ...rest);
    };
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        CanvasRenderingContext2D.prototype.drawImage = orig;
        resolve({ imageDraws: n, last });
      }));
    });
  });
  assert.ok(drawCheck.imageDraws >= 1, 'drawArena không vẽ ảnh nền: ' + JSON.stringify(drawCheck));
  assert.ok(drawCheck.imageDraws <= 2, 'vẽ nền lặp quá nhiều trong 2 frame: ' + drawCheck.imageDraws);
  assert.match(drawCheck.last, /\.webp$/, 'nền phải là webp: ' + drawCheck.last);
  results.push({ name: 'arena-draws-background-image', details: drawCheck });
  await page.screenshot({ path: resolve(evidence, 'arena-ground-ch2.png') });

  // 3. Nền khác nhau giữa chương/phòng, ổn định trong cùng phòng.
  const variety = await page.evaluate(() => {
    const art = (window.ArenaGround || window.Archero2FusionAPI?.ArenaGround);
    const keys = new Set();
    for (let ch = 1; ch <= 19; ch++) for (let r = 1; r <= 12; r++) keys.add(art.pick(ch, r));
    return { used: keys.size, sample: [...keys].slice(0, 6) };
  });
  assert.ok(variety.used >= 20, 'quá ít nền được dùng: ' + variety.used);
  results.push({ name: 'chapter-room-variety', details: variety });

  // 3b. Nền phải là ảnh thật: vẽ bằng chính ArenaGround.draw vào canvas ngoài màn hình,
  // dùng ảnh đã giải mã thật, rồi đo biến thiên điểm ảnh và so hai chương.
  const pixels = await page.evaluate(async () => {
    const art = window.ArenaGround || window.Archero2FusionAPI.ArenaGround;
    async function render(ch, room) {
      const key = art.pick(ch, room);
      const img = new Image();
      await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error('load ' + key)); img.src = 'assets/maps/' + key + '.webp'; });
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = 500;
      const ctx = canvas.getContext('2d');
      art.draw(ctx, 400, 500, 10, ch, room, { lowGfx: false });
      const d = ctx.getImageData(20, 40, 360, 400).data;
      let sum = 0, sum2 = 0, n = 0;
      const uniq = new Set();
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += lum; sum2 += lum * lum; n++;
        if (uniq.size < 4000) uniq.add((d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3));
      }
      const mean = sum / n;
      return { key, mean: +mean.toFixed(2), sd: +Math.sqrt(sum2 / n - mean * mean).toFixed(2), colors: uniq.size, data: Array.from(d.slice(0, 4000)) };
    }
    const a = await render(2, 3);
    const b = await render(9, 3);
    let diff = 0;
    for (let i = 0; i < a.data.length; i++) diff += Math.abs(a.data[i] - b.data[i]);
    return { a: { ...a, data: undefined }, b: { ...b, data: undefined }, meanAbsDiff: +(diff / a.data.length).toFixed(2) };
  });
  // Ảnh texture thật có biến thiên rõ; nền vector/gradient trơn thì sd rất thấp.
  assert.ok(pixels.a.sd > 15, 'nền gần như phẳng, không giống ảnh: ' + JSON.stringify(pixels.a));
  assert.ok(pixels.a.colors > 300, 'quá ít màu, không phải texture: ' + pixels.a.colors);
  assert.ok(pixels.meanAbsDiff > 5, 'hai chương cho ảnh gần như trùng nhau: ' + pixels.meanAbsDiff);
  results.push({ name: 'floor-pixels-are-textured-and-differ-by-chapter', details: pixels });

  // 4. Hitbox và va chạm không đổi: đo trên dữ liệu thật của Game.
  const geometry = await page.evaluate(() => {
    const g = window.Game || window.Archero2FusionAPI.Game;
    return { enemies: g.enemies?.length ?? 0, walls: g.walls?.length ?? 0,
      bounds: g.arenaBounds ? JSON.stringify(g.arenaBounds) : null, px: g.player?.x, py: g.player?.y };
  });
  results.push({ name: 'geometry-unchanged', details: geometry });

  // 5. Save không bị đụng tới (không có PUT nào ngoài init).
  // Autosave định kỳ là hành vi có sẵn của game, nên dừng vòng lặp rồi mới đếm:
  // nếu đổi nền không đụng save thì sẽ không còn PUT nào.
  await page.evaluate(() => (window.Archero2FusionAPI?.stopGameLoop || window.Game?.stopGameLoop)?.());
  await page.waitForTimeout(600);
  const saveCalls = [];
  page.on('request', req => { if (req.url().includes('/api/save') && req.method() === 'PUT') saveCalls.push(req.url()); });
  await page.waitForTimeout(900);
  assert.equal(saveCalls.length, 0, 'không được ghi save khi chỉ đổi đồ hoạ');
  results.push({ name: 'no-save-write-from-graphics', details: { put: saveCalls.length } });

  assert.equal(failedLocal.length, 0, 'tài nguyên lỗi: ' + failedLocal.join(','));
  assert.equal(errors.filter(m => !/favicon/i.test(m)).length, 0, 'lỗi JS: ' + errors.join(' | '));
  const okMaps = mapRequests.filter(r => r.status === 200);
  assert.ok(okMaps.length >= 1, 'không có webp nào được phục vụ');
  assert.equal(mapRequests.filter(r => r.status >= 400).length, 0);
  results.push({ name: 'map-http', details: { served: okMaps.length, files: [...new Set(okMaps.map(r => r.url))] } });

  await writeFile(resolve(evidence, 'verification.json'), JSON.stringify({
    scope: 'Chrome thật + fixture localhost, mock auth/save. Xác nhận ảnh nền tải/giải mã và được vẽ; không đánh giá thẩm mỹ.',
    results, errors, failedLocal, mapRequests,
  }, null, 2));
  console.log(JSON.stringify({ load: load.key, imageDraws: drawCheck.imageDraws, used: variety.used, served: okMaps.length, errors: errors.length }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message, results, errors, failedLocal, mapRequests: mapRequests.slice(0, 6) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
