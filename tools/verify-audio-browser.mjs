import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Chrome thật + fixture localhost: không DB, không tài khoản thật.
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
const evidence = resolve(root, 'docs/audio-evidence');
await mkdir(evidence, { recursive: true });
const results = [], errors = [], failedLocal = [], audioRequests = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ ok: true, authenticated: true, player: { id: 'audio_fixture', username: 'audio_fixture' } }));
    if (url.pathname === '/api/save' && req.method === 'GET') return res.end(JSON.stringify({ ok: true, hasSave: false, data: null, revision: 0 }));
    if (url.pathname === '/api/save' && req.method === 'PUT') return res.end(JSON.stringify({ ok: true, revision: 1 }));
    res.statusCode = 404; return res.end(JSON.stringify({ ok: false }));
  }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir + sep)) throw Error('outside public');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg' })[extname(file)] || 'application/octet-stream');
    let body = await readFile(file);
    if (extname(file) === '.html') {
      // Chỉ HTML phục vụ trong fixture lộ SoundFX; production không thêm export.
      const html = body.toString('utf8'), anchor = 'window.Archero2FusionAPI = {';
      assert.equal(html.split(anchor).length, 2);
      body = html.replace(anchor, 'window.__soundForTest = SoundFX;\n' + anchor);
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
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-extensions', '--disable-background-networking'],
  });
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  page.setDefaultTimeout(10000);
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    return url.origin === origin || (request.method() === 'GET' && ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin)) ? route.continue() : route.abort();
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', res => {
    if (res.url().endsWith('.mp3')) audioRequests.push({ url: res.url().split('/').pop(), status: res.status() });
    if (res.url().startsWith(origin) && res.status() >= 400 && !res.url().includes('/api/')) failedLocal.push(res.url());
  });
  await page.goto(origin, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));

  // Mở khoá audio bằng thao tác thật rồi mới nạp mẫu.
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.locator('#btnStartGame').click();
  await page.locator('#btnBriefingStart').click();
  await page.waitForTimeout(400);

  const preload = await page.evaluate(async () => {
    const a = window.Archero2FusionAPI;
    const S = a?.SoundFX || window.__soundForTest;
    a.stopGameLoop();
    S.muted = false;
    await S.preload?.();
    return { loaded: Object.keys(S.clips || {}).length, expected: Object.keys(S.clipFiles || {}).length,
      state: S.ctx && S.ctx.state };
  });
  assert.ok(preload.loaded >= 20, 'không nạp được mẫu: ' + JSON.stringify(preload));
  assert.equal(preload.state, 'running');
  results.push({ name: 'preload-real-clips', details: preload });

  // Mỗi mục gameplay phải phát được mẫu thật, không rơi về synth.
  const playback = await page.evaluate(async () => {
    const S = window.__soundForTest || window.Archero2FusionAPI?.SoundFX;
    const attempts = [];
    const orig = { tone: S.playTone };
    let tones = 0, clips = 0;
    // Đếm start thật, không đếm giá trị true (true cũng có thể là chủ động chặn).
    const createSource = S.ctx.createBufferSource.bind(S.ctx);
    S.ctx.createBufferSource = () => {
      const source = createSource();
      const start = source.start.bind(source);
      source.start = (...args) => { start(...args); clips++; };
      return source;
    };
    S.playTone = (...args) => { tones++; return orig.tone.apply(S, args); };
    const originalClip = S.playClip.bind(S);
    await new Promise(r => setTimeout(r, 2300));
    S.lastPlayed = {};
    const beforeHit = clips; S.hitEnemy(false); const hitNormal = clips > beforeHit;
    S.lastPlayed = {};
    const beforeCrit = clips; S.hitEnemy(true); const hitCrit = clips > beforeCrit;
    for (const fn of ['shootBow', 'shootStaff', 'shootClaw', 'playerHurt', 'coinPickup', 'levelUp', 'portalOpen', 'bossSpawn', 'enemyDeath', 'bossDeath', 'victory', 'uiClick', 'uiOpen']) {
      S.lastPlayed = {};
      const before = clips;
      S[fn]();
      attempts.push({ call: fn, sample: clips > before });
      // Giãn như nhịp gameplay thật để voice đã phát xong được giải phóng.
      await new Promise(r => setTimeout(r, 40));
    }
    for (const kind of ['fire', 'ice', 'poison', 'heal', 'sword', 'arrow']) {
      S.lastPlayed = {};
      const before = clips;
      S.skillCast(kind);
      attempts.push({ call: 'skillCast:' + kind, sample: clips > before });
      await new Promise(r => setTimeout(r, 40));
    }
    S.playTone = orig.tone; S.playClip = originalClip;
    S.ctx.createBufferSource = createSource;
    return { attempts, hitNormal, hitCrit, samples: clips, synthFallbacks: tones };
  });
  const missing = playback.attempts.filter(a => !a.sample).map(a => a.call);
  assert.deepEqual(missing, [], 'những tiếng rơi về synth: ' + missing.join(','));
  assert.ok(playback.hitNormal && playback.hitCrit, 'hit thường/crit chưa dùng mẫu');
  results.push({ name: 'all-events-play-real-samples', details: playback });

  // Tắt tiếng: không được tạo nguồn phát nào.
  const muted = await page.evaluate(() => {
    const S = window.__soundForTest || window.Archero2FusionAPI?.SoundFX;
    let started = 0;
    const original = S.ctx.createBufferSource.bind(S.ctx);
    S.ctx.createBufferSource = () => { started++; return original(); };
    S.muted = true;
    S.shootBow(); S.hitEnemy(true); S.coinPickup(); S.victory();
    S.muted = false;
    S.ctx.createBufferSource = original;
    return { started };
  });
  assert.equal(muted.started, 0, 'vẫn phát khi tắt tiếng');
  results.push({ name: 'mute-prevents-playback', details: muted });

  const burst = await page.evaluate(async () => {
    const S = window.__soundForTest;
    await new Promise(r => setTimeout(r, 2300));
    const create = S.ctx.createBufferSource.bind(S.ctx);
    const tone = S.playTone;
    let starts = 0, synth = 0;
    S.ctx.createBufferSource = () => { starts++; return create(); };
    S.playTone = () => { synth++; };
    S.lastPlayed = {};
    for (let i = 0; i < 100; i++) S.hitEnemy(false);
    const result = { starts, synth, active: S.activeVoices };
    S.ctx.createBufferSource = create;
    S.playTone = tone;
    return result;
  });
  assert.equal(burst.starts, 1);
  assert.equal(burst.synth, 0);
  results.push({ name: 'burst-does-not-bypass-limit-with-synth', details: burst });

  // Đếm yêu cầu mạng thật cho mẫu.
  const served = audioRequests.filter(r => r.status === 200).length;
  const notFound = audioRequests.filter(r => r.status >= 400);
  assert.ok(served >= 20, 'server không phục vụ đủ mp3: ' + served);
  assert.equal(notFound.length, 0, 'thiếu file: ' + JSON.stringify(notFound));
  assert.equal(failedLocal.length, 0);
  assert.equal(errors.length, 0, 'lỗi JS: ' + errors.join(' | '));
  results.push({ name: 'http-audio-requests', details: { served, requests: audioRequests.length } });

  const report = { scope: 'Chrome thật + fixture localhost, mock auth/save; mp3 giải mã bằng WebAudio thật, không phải đánh giá thẩm mỹ hay E2E production.', results, audioRequests, errors, failedLocal };
  await writeFile(resolve(evidence, 'verification.json'), JSON.stringify(report, null, 2));
  await page.screenshot({ path: resolve(evidence, 'audio-run.png') });
  console.log(JSON.stringify({ preload, missing, served, errors: errors.length }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message, results, audioRequests: audioRequests.slice(0, 5), errors, failedLocal }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
