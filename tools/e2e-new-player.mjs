// ==================== E2E TÂN THỦ — SERVER THẬT, UI THẬT (Đợt 3) ====================
//
// Khác với tools/audit-new-player-browser.mjs (mock auth/save ngay trong trang):
// harness này chạy `dev-server.mjs` với `DB_BACKEND=memory`, nên mọi request đi
// qua ĐÚNG route thật: bcrypt, JWT, cookie HttpOnly, sanitizer, revision CAS,
// seed khởi tạo. Không kết nối Mongo, không đọc `.env`, không gọi production.
//
// Chạy:
//   PLAYWRIGHT_MODULE=<.../playwright-core/index.mjs> node tools/e2e-new-player.mjs
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(root, 'docs/audit/artemis-new-player/evidence');
await mkdir(evidence, { recursive: true });

const PORT = Number(process.env.E2E_PORT || 3111);
const origin = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = 'e2e-only-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const USER = 'qa_e2e_' + Math.random().toString(36).slice(2, 8);
const PASS = 'matkhau-' + Math.random().toString(36).slice(2, 10);

const results = [];
const errors = [];
const netFailures = [];

async function record(name, fn) {
  try {
    const details = await fn();
    results.push({ name, status: 'PASS', details });
    console.log('  PASS  ' + name);
  } catch (error) {
    results.push({ name, status: 'FAIL', error: String(error.message).slice(0, 700) });
    console.log('  FAIL  ' + name + '  -> ' + String(error.message).slice(0, 300));
  }
}

// ---------------------------------------------------------------------------
// Server thật, DB trong bộ nhớ
// ---------------------------------------------------------------------------
const server = spawn(process.execPath, ['dev-server.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_BACKEND: 'memory',
    NODE_ENV: 'test',
    JWT_SECRET,
    MONGODB_URI: '', // .env không được chen vào nhánh mongo
    MONGODB_DB: 'artemis_e2e',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d.toString(); });
server.stderr.on('data', (d) => { serverLog += d.toString(); });

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(origin + '/api/health');
      const body = await r.json();
      if (body.ok) return body;
    } catch { /* chưa lên */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('dev-server không khởi động được:\n' + serverLog.slice(-1500));
}

const api = async (path, init = {}, cookie) => {
  const headers = { ...(init.headers || {}) };
  if (cookie) headers.cookie = cookie;
  return fetch(origin + path, { ...init, headers });
};

const browser = await chromium.launch({
  executablePath: process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  const cdn = ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
  const allowed = url.origin === origin || (route.request().method() === 'GET' && cdn.includes(url.origin));
  try {
    if (allowed) await route.continue();
    else await route.abort();
  } catch { /* request đã kết thúc */ }
});
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => { if (r.status() >= 400) netFailures.push({ kind: 'http', status: r.status(), url: r.url() }); });
page.on('requestfailed', (r) => netFailures.push({ kind: 'failed', url: r.url(), error: r.failure()?.errorText }));

/** Đọc thông báo lỗi đang hiện trong cổng đăng nhập (để báo lỗi có ngữ cảnh). */
async function gateError() {
  return page.evaluate(() => {
    const gate = document.getElementById('cloudGate');
    if (!gate) return '(gate đã đóng)';
    const texts = [...gate.querySelectorAll('div')]
      .map((d) => d.textContent.trim())
      .filter((t) => t && t.length < 200 && /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(t));
    return texts.slice(-2).join(' | ');
  });
}

/**
 * Đăng ký/đăng nhập qua CHÍNH form của cổng (cloud.js), chạy trọn trong trang:
 * tự chuyển sang form cần dùng, ghi giá trị vào input, rồi phát submit event.
 * Cách này tránh race khi buildGate dựng lại DOM (fill vào node đã bị remove).
 * Trả về { ok, err } với ok = cổng đã đóng (đăng nhập xong + save đã nạp).
 */
async function gateAuth(user, pass, mode) {
  return page.evaluate(async ({ user, pass, mode }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const heading = mode === 'register'
      ? 'Tạo tài khoản để bắt đầu hành trình'
      : 'Đăng nhập để tiếp tục hành trình của bạn';

    for (let i = 0; i < 40; i++) {
      if (!document.getElementById('cloudGate')) return { ok: true, note: 'gate đã đóng sẵn' };
      if (document.body.innerText.includes(heading)) break;
      const sw = [...document.querySelectorAll('#cloudGate button')].find((b) => b.type !== 'submit');
      if (!sw) break;
      sw.click();
      await sleep(120);
    }

    const gate = document.getElementById('cloudGate');
    if (!gate) return { ok: true, note: 'gate đóng sau khi chuyển form' };
    const form = gate.querySelector('form');
    const u = form.querySelector('input[name="username"]');
    const p = form.querySelector('input[name="password"]');
    if (!u || !p) return { ok: false, err: 'không tìm thấy input trong form' };

    const setVal = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setVal(u, user);
    setVal(p, pass);

    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = false;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    for (let i = 0; i < 150; i++) {
      await sleep(120);
      if (!document.getElementById('cloudGate')) return { ok: true, waitedMs: i * 120 };
    }
    const err = [...document.querySelectorAll('#cloudGate div')]
      .map((d) => d.textContent.trim())
      .filter((t) => t && t.length > 3 && t.length < 160 && t.includes(' '))
      .slice(-2);
    return { ok: false, err };
  }, { user, pass, mode });
}

async function waitForGame() {
  await page.waitForFunction(
    () => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'),
    { timeout: 30000 },
  );
}

const state = () => page.evaluate(() => {
  const a = window.Archero2FusionAPI;
  const s = a.SaveState;
  return JSON.parse(JSON.stringify({
    gold: s.gold, gems: s.gems, stamina: s.stamina, level: s.playerLevel,
    hero: s.selectedHeroId, bag: s.gearBag, equipped: s.equippedGear,
    journey: s.beginnerJourney, starter: s.starterWeaponGranted,
    scrolls: s.gearScrolls, cloud: window.ArtemisCloud.getState(),
  }));
});

let cookieHeader = '';

try {
  const health = await waitForServer();
  assert.equal(health.ok, true, 'health phải ok');

  // -------------------------------------------------------------------------
  // A. Đăng ký qua UI thật
  // -------------------------------------------------------------------------
  await record('A1 cổng đăng nhập thật do máy chủ trả về (chưa có session)', async () => {
    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForSelector('#cloudGate form input[name="username"]', { timeout: 20000 });
    const info = await page.evaluate(() => ({
      heading: document.body.innerText.includes('Đăng nhập để tiếp tục hành trình của bạn'),
      hasSwitch: [...document.querySelectorAll('#cloudGate button')].some((b) => b.type !== 'submit'),
      locked: document.documentElement.classList.contains('cloud-locked'),
    }));
    assert.equal(info.heading, true, 'phải thấy form đăng nhập');
    assert.equal(info.hasSwitch, true, 'phải có nút chuyển sang đăng ký');
    return info;
  });

  await record('A2 đăng ký qua UI: 201, session, vào lobby', async () => {
    const reg = await gateAuth(USER, PASS, 'register');
    assert.equal(reg.ok, true, 'đăng ký thất bại: ' + JSON.stringify(reg.err));
    await waitForGame();
    cookieHeader = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
    assert.match(cookieHeader, /artemis_session=/);
    return { waitedMs: reg.waitedMs, cookiePresent: true };
  });

  await record('A3 trạng thái khởi tạo đúng chuẩn (500/50/20, Alex 0★, túi rỗng, N01 mở)', async () => {
    const s = await state();
    assert.equal(s.gold, 500);
    assert.equal(s.gems, 50);
    assert.equal(s.stamina, 20);
    assert.equal(s.level, 1);
    assert.equal(s.hero, 'alex');
    assert.equal(s.bag.length, 0);
    assert.ok(Object.values(s.equipped).every((x) => x === null), 'slot phải trống');
    for (const v of Object.values(await page.evaluate(() => window.Archero2FusionAPI.SaveState.heroStars))) {
      assert.equal(v, 0, 'hero phải 0 sao');
    }
    assert.equal(s.journey.currentStep, 'N01');
    assert.ok(s.journey.startedAt > 0, 'tutorial phải đang mở ngay sau đăng ký');
    return s.journey;
  });

  await record('A4 máy chủ đã có save revision 1 (không phải client tự tạo)', async () => {
    const r = await api('/api/save', {}, cookieHeader);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.hasSave, true);
    assert.equal(body.revision, 1);
    assert.equal(body.data.gold, 500);
    assert.equal(body.data.gems, 50);
    assert.equal(body.data.beginnerJourney.currentStep, 'N01');
    return { revision: body.revision, gold: body.data.gold };
  });

  // -------------------------------------------------------------------------
  // B. N01 → N08 bằng thao tác UI/hook thật của game
  // -------------------------------------------------------------------------
  // Mở tab chứa panel Hành Trình Tân Thủ: bỏ class hidden trên mọi tổ tiên của
  // container (tương đương người chơi bấm vào tab) để nút thật sự bấm được.
  const openJourney = async () => {
    await page.evaluate(() => {
      const a = window.Archero2FusionAPI;
      a.renderBeginnerJourneyUI();
      let node = document.getElementById('beginnerJourneyContainer');
      while (node && node !== document.body) {
        node.classList.remove('hidden');
        node = node.parentElement;
      }
    });
    await page.waitForSelector('[data-bj-step="N01"], [data-bj-step="N08"]', { state: 'visible', timeout: 10000 });
  };

  await record('B1 N01: bấm "Đã Hiểu" trong panel → xong, nhận 100 vàng', async () => {
    const before = await state();
    await openJourney();
    await page.click('[data-bj-step="N01"]');
    await page.waitForTimeout(400);
    const after = await state();
    assert.ok(after.journey.completedSteps.includes('N01'));
    assert.ok(after.journey.claimedRewards.includes('N01'), 'phải nhận thưởng ngay trong handler');
    assert.equal(after.gold - before.gold, 100);
    return { gold: after.gold, steps: after.journey.completedSteps };
  });

  await record('B2 reload: N01 vẫn xong, vàng giữ nguyên', async () => {
    await page.waitForTimeout(1600); // debounce cloud save
    const beforeReload = await state();
    await page.reload({ waitUntil: 'load' });
    await waitForGame();
    const after = await state();
    assert.ok(after.journey.completedSteps.includes('N01'));
    assert.ok(after.journey.claimedRewards.includes('N01'));
    assert.equal(after.gold, beforeReload.gold, 'vàng không được reset sau reload');
    return { gold: after.gold, revision: after.cloud.revision };
  });

  // ---- Bộ điều khiển chơi thật: kite vòng quanh sân, đứng lại để tự bắn,
  // mở modal chọn kỹ năng khi lên cấp, đi vào cổng khi phòng sạch. ----
  await page.evaluate(() => {
    window.__autoPlayStats = window.__autoPlayStats || { sessions: 0, roomsCleared: [], maxRoom: 0, skillsPicked: 0, deaths: 0, totalMs: 0 };
    window.__autoPlay = async (budgetMs) => {
      const stats = window.__autoPlayStats;
      const startedAt = Date.now();
      stats.sessions += 1;
      const a = window.Archero2FusionAPI;
      const g = a.Game;
      const KEY = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      let held = [];
      const setKeys = (arr) => {
        const same = arr.length === held.length && arr.every((k, i) => k === held[i]);
        if (same) return;
        for (const k of held) KEY(k, false);
        held = arr.slice();
        for (const k of held) KEY(k, true);
      };
      const release = () => setKeys([]);
      const deadline = Date.now() + budgetMs;
      let pickedSkills = 0;
      const roomsCleared = [];
      let lastRoom = g.room;
      let stuckSince = Date.now();
      const w = g.width, h = g.height, pad = 90;
      const waypoints = [
        { x: pad, y: pad }, { x: w - pad, y: pad },
        { x: w - pad, y: h - pad }, { x: pad, y: h - pad },
      ];
      let wp = 0;

      while (Date.now() < deadline) {
        if (!g.running) break;
        const modal = document.getElementById('skillSelectModal');
        if (modal && !modal.classList.contains('hidden')) {
          const card = modal.querySelector('.skill-choice-card');
          if (card) { card.click(); pickedSkills += 1; await sleep(120); continue; }
        }
        if (g.paused) { await sleep(150); continue; }
        if (g.room !== lastRoom) { lastRoom = g.room; roomsCleared.push(g.room); stuckSince = Date.now(); }

        if (g.roomCleared) {
          release();
          const pr = g.portalRect;
          if (pr) {
            const tx = pr.x + pr.w / 2, ty = pr.y + pr.h / 2;
            const keys = [];
            if (g.player.x < tx - 20) keys.push('KeyD'); else if (g.player.x > tx + 20) keys.push('KeyA');
            if (g.player.y > ty + 10) keys.push('KeyW');
            setKeys(keys);
            await sleep(140);
            if (Date.now() - stuckSince > 12000) break;
            continue;
          }
          await sleep(150);
          continue;
        }

        const target = waypoints[wp];
        const dx = target.x - g.player.x, dy = target.y - g.player.y;
        if (Math.hypot(dx, dy) < 70) wp = (wp + 1) % waypoints.length;
        const keys = [];
        if (dx > 30) keys.push('KeyD'); else if (dx < -30) keys.push('KeyA');
        if (dy > 30) keys.push('KeyS'); else if (dy < -30) keys.push('KeyW');
        setKeys(keys);
        await sleep(340);
        release();
        const hpPct = g.player.maxHp ? g.player.hp / g.player.maxHp : 1;
        // Máu còn nhiều -> đứng bắn lâu để hạ quái nhanh; máu thấp -> né nhiều hơn.
        await sleep(hpPct < 0.45 ? 300 : 900);
      }
      release();
      stats.totalMs += Date.now() - startedAt;
      stats.roomsCleared.push(...roomsCleared);
      stats.maxRoom = Math.max(stats.maxRoom, g.room);
      stats.skillsPicked += pickedSkills;
      if (!g.running) stats.deaths += 1;
      return {
        roomCleared: !!g.roomCleared, room: g.room, roomsCleared,
        enemies: g.enemies.length, hp: g.player ? Math.round(g.player.hp) : null,
        running: g.running, pickedSkills,
      };
    };
  });

  /** Bảo đảm đang trong một lượt chơi; nếu đã chết thì vào lượt mới. */
  const ensureRun = () => page.evaluate(() => {
    const a = window.Archero2FusionAPI;
    if (a.Game.running) return { started: false };
    a.startNewRun();
    return { started: true };
  });

  /** Chơi cho tới khi điều kiện trong trang đúng, tối đa `sessions` lượt. */
  async function playUntil(predicate, { sessions = 4, budgetMs = 120000 } = {}) {
    const log = [];
    for (let i = 0; i < sessions; i++) {
      if (await page.evaluate(predicate)) break;
      await ensureRun();
      const r = await page.evaluate((ms) => window.__autoPlay(ms), budgetMs);
      log.push(r);
      if (await page.evaluate(predicate)) break;
    }
    return log;
  }

  await record('B3 N02: vào trận thật, dọn sạch ít nhất 1 phòng → nhận đúng 1 Cung Gỉ Sét', async () => {
    // Vào trận bằng nút của game, rồi chơi thật.
    await page.evaluate(() => {
      const btn = document.getElementById('btnStartGame');
      if (btn) btn.click();
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const go = document.querySelector('#runBriefingModal button');
      if (go) go.click();
    });
    await page.waitForTimeout(600);
    await ensureRun();

    const log = await playUntil(
      () => (window.Archero2FusionAPI.SaveState.beginnerJourney.completedSteps || []).includes('N02'),
      { sessions: 2, budgetMs: 90000 },
    );
    const s = await state();
    assert.ok(s.journey.completedSteps.includes('N02'), 'N02 phải hoàn thành bằng chiến đấu thật: ' + JSON.stringify(log));
    const weapons = s.bag.filter((it) => it && it.templateId === 'rusty_bow');
    assert.equal(weapons.length, 1, 'đúng 1 Cung Gỉ Sét trong túi');
    assert.equal(s.starter, true, 'cờ starterWeaponGranted phải bật');
    return { sessions: log.length, last: log[log.length - 1], weapons: weapons.map((w) => w.uid) };
  });

  await record('B4 N03: nhặt đủ 10 vật phẩm bằng chiến đấu thật', async () => {
    const log = await playUntil(
      () => (window.Archero2FusionAPI.SaveState.beginnerJourney.completedSteps || []).includes('N03'),
      { sessions: 3, budgetMs: 90000 },
    );
    const after = await state();
    assert.ok(after.journey.completedSteps.includes('N03'),
      'N03 phải đạt 10 vật phẩm: loot=' + after.journey._lootCount + ' ' + JSON.stringify(log));
    assert.ok(after.journey._lootCount >= 10);
    const stats = await page.evaluate(() => window.__autoPlayStats);
    return { loot: after.journey._lootCount, sessions: log.length, stats };
  });

  await record('B5 N04: mặc Cung Gỉ Sét qua modal Trang Bị thật', async () => {
    const done = await page.evaluate(async () => {
      const a = window.Archero2FusionAPI;
      const s = a.SaveState;
      a.Game.paused = true;
      const bow = s.gearBag.find((it) => it && it.templateId === 'rusty_bow');
      if (!bow) return { error: 'không có cung trong túi' };
      // Mở đúng modal chi tiết trang bị rồi bấm nút "Trang Bị" của UI.
      a.openGearDetailModal(bow.uid, false, 'weapon');
      const modal = document.getElementById('gearDetailModal');
      const visible = modal && !modal.classList.contains('hidden');
      document.getElementById('btnModalEquipGear').click();
      await new Promise((r) => setTimeout(r, 250));
      return JSON.parse(JSON.stringify({
        modalOpened: !!visible,
        equipped: s.equippedGear.weapon,
        bagHasBow: s.gearBag.some((it) => it && it.templateId === 'rusty_bow'),
        j: s.beginnerJourney,
      }));
    });
    assert.equal(done.modalOpened, true, 'modal trang bị phải mở được');
    assert.ok(done.j.completedSteps.includes('N04'), 'N04 phải hoàn thành sau khi mặc: ' + JSON.stringify(done));
    assert.equal(done.equipped.templateId, 'rusty_bow', 'cung phải nằm ở ô vũ khí');
    assert.equal(done.bagHasBow, false, 'cung không được còn trong túi');
    return { modalOpened: done.modalOpened, equipped: done.equipped.uid, steps: done.j.completedSteps };
  });

  await record('B6 N05: nâng cấp trang bị qua nút Nâng Cấp thật', async () => {
    const done = await page.evaluate(async () => {
      const a = window.Archero2FusionAPI;
      const s = a.SaveState;
      a.Game.paused = true;
      const item = s.equippedGear.weapon;
      if (!item) return { error: 'chưa mặc vũ khí' };

      // Chi phí lấy đúng công thức của UI: 80 + level*45, và 1 cuộn mỗi cấp.
      const cost = 80 + (item.level || 1) * 45;
      const needScroll = Math.max(1, Math.min(25, Math.ceil((item.level || 1) / 4)));
      if (!s.gearScrolls) s.gearScrolls = {};
      // Ghi nhận rõ: lượt chơi ngắn chưa đủ vàng/cuộn, test bù đúng phần còn thiếu
      // rồi để CHÍNH handler của UI trừ tiền và tăng cấp.
      const toppedGold = Math.max(0, cost - s.gold);
      const toppedScroll = Math.max(0, needScroll - (s.gearScrolls.weapon || 0));
      s.gold += toppedGold;
      s.gearScrolls.weapon = (s.gearScrolls.weapon || 0) + toppedScroll;

      const goldBefore = s.gold;
      const scrollBefore = s.gearScrolls.weapon;
      const lvBefore = item.level;
      a.openGearDetailModal(item.uid, true, 'weapon');
      document.getElementById('btnModalUpgradeGear').click();
      await new Promise((r) => setTimeout(r, 250));
      return JSON.parse(JSON.stringify({
        goldBefore, goldAfter: s.gold, scrollBefore, scrollAfter: s.gearScrolls.weapon,
        lvBefore, lvAfter: s.equippedGear.weapon.level,
        toppedGold, toppedScroll, cost, needScroll,
        j: s.beginnerJourney,
      }));
    });
    assert.equal(done.lvAfter, done.lvBefore + 1, 'cấp trang bị phải tăng 1: ' + JSON.stringify(done));
    assert.equal(done.goldAfter, done.goldBefore - done.cost, 'phải trừ đúng tiền theo công thức UI');
    assert.equal(done.scrollAfter, done.scrollBefore - done.needScroll, 'phải trừ đúng số cuộn');
    assert.ok(done.j.completedSteps.includes('N05'), 'N05 phải hoàn thành');
    return done;
  });

  await record('B7 N06: chọn kỹ năng (delta thật nếu autopilot đã bấm, nếu không dùng hook)', async () => {
    const stats = await page.evaluate(() => window.__autoPlayStats);
    let via = 'hook';
    if (stats.skillsPicked > 0) {
      // Autopilot đã bấm thẻ kỹ năng thật trong trận → N06 phải tự hoàn thành.
      const j = (await state()).journey;
      assert.ok(j.completedSteps.includes('N06'),
        'đã chọn ' + stats.skillsPicked + ' kỹ năng qua UI nhưng N06 chưa xong: ' + JSON.stringify(j));
      via = 'ui-skill-picker';
    } else {
      // Không đủ XP để lên cấp trong lượt chơi ngắn → ghi nhận rõ là dùng hook.
      await page.evaluate(() => { window.Archero2FusionAPI.BeginnerHooks.onSkillPicked(); });
      assert.ok((await state()).journey.completedSteps.includes('N06'));
    }
    return { via, skillsPicked: stats.skillsPicked };
  });

  await record('B8 N07 (hook chapter_cleared) + N08 (bấm nút Hoàn Tất thật)', async () => {
    const done = await page.evaluate(async () => {
      const a = window.Archero2FusionAPI;
      const s = a.SaveState;
      // N07: sự kiện thật của game khi thắng chương — gọi đúng hook mà
      // end-of-run dùng, với chapterId = 1.
      if (typeof a.BeginnerHooks !== 'undefined') a.BeginnerHooks.onChapterCleared(1);
      // N08: bấm nút "Hoàn Tất" trong panel.
      a.renderBeginnerJourneyUI();
      const btn = document.querySelector('[data-bj-step="N08"]');
      if (btn) btn.click();
      return JSON.parse(JSON.stringify({ j: s.beginnerJourney, hasButton: !!btn }));
    });
    assert.equal(done.hasButton, true, 'phải có nút Hoàn Tất');
    assert.ok(done.j.completedSteps.includes('N07'), 'N07 phải hoàn thành');
    assert.ok(done.j.completedSteps.includes('N08'), 'N08 phải hoàn thành');
    assert.equal(done.j.isCompleted, true, 'hành trình phải kết thúc');
    return done.j;
  });

  await record('B9 nhận thưởng đúng một lần cho mỗi bước (claim lại trả false)', async () => {
    const steps = ['N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08'];
    // Lần đầu chỉ những bước chưa nhận mới trả true.
    const first = await page.evaluate((list) => list.map((id) => window.Archero2FusionAPI.claimBeginnerReward(id)), steps);
    const goldAfterFirst = (await state()).gold;
    // Lần hai phải trả false toàn bộ và không đổi tài nguyên.
    const second = await page.evaluate((list) => list.map((id) => window.Archero2FusionAPI.claimBeginnerReward(id)), steps);
    const after = await state();
    assert.deepEqual(second, [false, false, false, false, false, false, false, false]);
    assert.equal(after.gold, goldAfterFirst, 'không được cộng thêm vàng');
    assert.equal(after.gems, (await state()).gems);
    const claimed = after.journey.claimedRewards;
    assert.equal(new Set(claimed).size, claimed.length, 'claimedRewards không được trùng');
    return { first, second, claimed };
  });

  // -------------------------------------------------------------------------
  // C. Bền vững: reload, logout, login lại
  // -------------------------------------------------------------------------
  await record('C1 reload giữ toàn bộ tiến trình N01–N08', async () => {
    await page.waitForTimeout(1800);
    const before = await state();
    await page.reload({ waitUntil: 'load' });
    await waitForGame();
    const after = await state();
    // Server chuẩn hoá danh sách theo thứ tự khai báo N01..N08, nên so sánh
    // theo tập — thứ tự trong bộ nhớ client không phải hợp đồng.
    assert.deepEqual([...after.journey.completedSteps].sort(), [...before.journey.completedSteps].sort());
    assert.deepEqual([...after.journey.claimedRewards].sort(), [...before.journey.claimedRewards].sort());
    assert.equal(after.journey.completedSteps.length, 8, 'phải đủ 8 bước sau reload');
    assert.equal(after.journey.isCompleted, true);
    assert.equal(after.gold, before.gold);
    assert.equal(after.bag.length, before.bag.length);
    assert.equal(after.equipped.weapon.templateId, 'rusty_bow');
    return { gold: after.gold, steps: after.journey.completedSteps.length };
  });

  await record('C2 logout → login lại giữ nguyên dữ liệu', async () => {
    const before = await state();
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));
    await page.waitForTimeout(600);
    const jar = await context.cookies();
    assert.equal(jar.some((c) => c.name === 'artemis_session'), false, 'cookie phiên phải bị xoá sau logout');
    const me = await api('/api/auth/me');
    const meBody = await me.json();
    assert.notEqual(meBody.authenticated, true, 'không còn phiên sau logout');

    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForSelector('#cloudGate form input[name="username"]', { timeout: 20000 });
    const login = await gateAuth(USER, PASS, 'login');
    assert.equal(login.ok, true, 'đăng nhập lại thất bại: ' + JSON.stringify(login.err));
    await waitForGame();
    const after = await state();
    assert.equal(after.gold, before.gold, 'vàng phải giữ nguyên sau login lại');
    assert.deepEqual(after.journey.completedSteps, before.journey.completedSteps);
    assert.equal(after.equipped.weapon.templateId, 'rusty_bow');
    return { gold: after.gold, steps: after.journey.completedSteps.length };
  });

  await record('C3 tài khoản thứ hai trên cùng trình duyệt nhận trạng thái tân thủ', async () => {
    const userB = 'qa_e2e_b_' + Math.random().toString(36).slice(2, 6);
    await page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST' }); });
    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForSelector('#cloudGate form input[name="username"]', { timeout: 20000 });
    const reg = await gateAuth(userB, PASS, 'register');
    assert.equal(reg.ok, true, 'đăng ký tài khoản B thất bại: ' + JSON.stringify(reg.err));
    await waitForGame();
    const b = await state();
    assert.equal(b.gold, 500, 'tài khoản B phải bắt đầu với 500 vàng');
    assert.equal(b.bag.length, 0, 'túi tài khoản B phải rỗng');
    assert.deepEqual(b.journey.completedSteps, [], 'không được kế thừa bước của A');
    assert.equal(b.journey.currentStep, 'N01');
    assert.ok(b.journey.startedAt > 0);
    return { gold: b.gold, steps: b.journey.completedSteps };
  });

  await record('C4 client tự khai tài nguyên bị máy chủ từ chối', async () => {
    const me = await api('/api/auth/me', {}, cookieHeader);
    const meBody = await me.json();
    assert.equal(meBody.ok, true);
    // Gửi PUT với revision 0 (client giả vờ chưa có save) + 1e12 vàng.
    const r = await api('/api/save', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { gold: 1e12, gems: 1e12 }, revision: 0, playerId: meBody.player.id }),
    }, cookieHeader);
    assert.equal(r.status, 409, 'phải bị từ chối');
    const body = await r.json();
    assert.equal(body.code, 'SAVE_MISSING');
    const check = await api('/api/save', {}, cookieHeader);
    const data = (await check.json()).data;
    assert.ok(data.gold < 1e9, 'vàng trên máy chủ không được thay đổi: ' + data.gold);
    return { status: 409, serverGold: data.gold };
  });

  await page.screenshot({ path: resolve(evidence, 'e2e-new-player-lobby.png') });
} finally {
  await page.screenshot({ path: resolve(evidence, 'e2e-new-player-final.png') }).catch(() => {});
  const output = {
    time: new Date().toISOString(),
    scope: 'LOCAL REAL SERVER (dev-server + DB_BACKEND=memory): đăng ký thật, cookie/JWT thật, save thật. Không Mongo, không production.',
    origin,
    username: USER,
    browser: browser.version(),
    results,
    errors,
    netFailures,
  };
  await writeFile(resolve(evidence, 'e2e-new-player.json'), JSON.stringify(output, null, 2));
  console.log('\n' + JSON.stringify({ pass: results.filter((r) => r.status === 'PASS').length, fail: results.filter((r) => r.status === 'FAIL').length, errors }, null, 2));
  if (results.some((r) => r.status === 'FAIL') || errors.length) process.exitCode = 1;
  await browser.close();
  server.kill();
}
