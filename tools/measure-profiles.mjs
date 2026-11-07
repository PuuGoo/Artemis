// ==================== ĐO HỒ SƠ NGƯỜI CHƠI TỪ GAME THẬT ====================
//
// Vấn đề của tools/combat-sim.mjs cũ: 5 hồ sơ ATK/HP được gõ tay, không ai
// chứng minh chúng đến từ `getComputedStats()`. Nay script này mở game thật
// (Chrome local), dựng từng hồ sơ bằng cách MẶC ĐỒ THẬT rồi đọc
// `getComputedStats()` — tức là đúng hàm mà trận đấu dùng.
//
// Chạy:
//   PLAYWRIGHT_MODULE=<.../playwright-core/index.mjs> node tools/measure-profiles.mjs
//
// Kết quả: tools/combat-profiles.json (dùng lại bởi combat-sim.mjs).
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Server tĩnh + API giả tối thiểu: chỉ cần game khởi động được, KHÔNG ghi save
// (mọi thay đổi trang bị đều nằm trong bộ nhớ và bị bỏ khi đóng trình duyệt).
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/auth/me') {
      return res.end(JSON.stringify({ ok: true, authenticated: true, player: { id: 'local_measure', username: 'local_measure' } }));
    }
    if (url.pathname === '/api/save' && req.method === 'GET') {
      // hasSave:false -> client dựng state tân thủ, không ghi gì lên đĩa.
      return res.end(JSON.stringify({ ok: true, playerId: 'local_measure', hasSave: false, data: null, revision: 0 }));
    }
    if (url.pathname === '/api/save' && req.method === 'PUT') {
      return res.end(JSON.stringify({ ok: true, revision: 1 }));
    }
    res.statusCode = 404;
    return res.end(JSON.stringify({ ok: false }));
  }
  try {
    const p = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = resolve(root, 'public', p);
    if (!file.startsWith(resolve(root, 'public') + '/') && !file.startsWith(resolve(root, 'public') + '\\')) {
      throw new Error('outside public');
    }
    res.setHeader('content-type', ({ '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  const cdn = ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
  const allowed = url.origin === origin || (route.request().method() === 'GET' && cdn.includes(url.origin));
  try { await (allowed ? route.continue() : route.abort()); } catch { /* đã xong */ }
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(origin, { waitUntil: 'load' });
await page.waitForFunction(
  () => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'),
  { timeout: 30000 },
);

/**
 * Dựng một hồ sơ trong game rồi đọc chỉ số thật.
 * `gear` là mảng [templateId, quality, level]; hero mặc định Alex.
 */
async function measure(name, build) {
  const result = await page.evaluate(({ build }) => {
    const a = window.Archero2FusionAPI;
    const s = a.SaveState;
    const tpl = a.GEAR_TEMPLATES;

    // Reset về tân thủ rồi áp cấu hình của hồ sơ.
    const slots = ['weapon', 'necklace', 'ring', 'armor', 'helmet', 'boots'];
    s.equippedGear = { weapon: null, necklace: null, ring: null, armor: null, helmet: null, boots: null };
    s.gearBag = [];
    s.heroStars = { alex: 0 };
    s.talents = {};
    s.runes = { rune_flame: 0, rune_frost: 0, rune_thunder: 0, rune_valkyrie: 0 };
    s.selectedHeroId = build.hero || 'alex';
    s.playerLevel = build.playerLevel || 1;

    const makeItem = (templateId, quality, level) => {
      const t = tpl[templateId];
      if (!t) throw new Error('không có templateId: ' + templateId);
      return { uid: 'm_' + templateId, templateId, quality, level, awakening: 0, locked: false, favorite: false, sockets: [], affixes: [] };
    };
    for (const [slotKey, item] of Object.entries(build.gear || {})) {
      s.equippedGear[slotKey] = makeItem(item[0], item[1], item[2]);
    }
    if (build.heroStars) s.heroStars = { ...build.heroStars };
    if (build.talents) s.talents = { ...build.talents };
    if (build.gearLevel) s.gearLevel = build.gearLevel;

    const st = a.getComputedStats();
    return {
      atk: st.baseAtk,
      hp: st.baseHp,
      aspd: st.baseAspd,
      crit: st.baseCrit,
      critMult: st.critDmgMult || st.baseCritMult || 1.85,
      def: st.defFlat || 0,
      dmgReduction: st.dmgReduction || 0,
      powerScore: st.powerScore,
      hero: s.selectedHeroId,
      heroStar: (s.heroStars || {})[s.selectedHeroId] || 0,
    };
  }, { build });

  console.log(`  ${name.padEnd(34)} ATK ${String(result.atk).padStart(7)}  HP ${String(result.hp).padStart(8)}  ASPD ${result.aspd}  CRIT ${result.crit}  DEF ${result.def}`);
  return { name, ...result };
}

// ---------------------------------------------------------------------------
// Hồ sơ A–G theo đúng kế hoạch Đợt 4
// ---------------------------------------------------------------------------
const PROFILES = [];
console.log('\n=== ĐO getComputedStats() TRÊN GAME THẬT ===');

// A — tân thủ tay không
PROFILES.push(await measure('A. Tân thủ (tay không, Alex 0★)', { hero: 'alex' }));

// B — vừa nhận Cung Gỉ Sét (rusty_bow), chưa nâng cấp
PROFILES.push(await measure('B. Starter (Cung Gỉ Sét Lv.1)', {
  hero: 'alex',
  gear: { weapon: ['rusty_bow', 'common', 1] },
}));

// C — nâng cấp nhẹ: cung Lv.5 + vài món uncommon
PROFILES.push(await measure('C. Nâng cấp đầu (Lv.5 + uncommon)', {
  hero: 'alex',
  gear: {
    weapon: ['rusty_bow', 'uncommon', 5],
    armor: ['cloth_vest', 'uncommon', 4],
    boots: ['worn_boots', 'uncommon', 4],
  },
}));

// D — giữa chương 1: rare Lv.15 toàn bộ
PROFILES.push(await measure('D. Giữa chương 1 (rare Lv.15)', {
  hero: 'alex', heroStars: { alex: 2 },
  gear: {
    weapon: ['rusty_bow', 'rare', 15],
    necklace: ['wooden_charm', 'rare', 15],
    ring: ['copper_ring', 'rare', 15],
    armor: ['cloth_vest', 'rare', 15],
    helmet: ['leather_cap', 'rare', 15],
    boots: ['worn_boots', 'rare', 15],
  },
}));

// E — cuối chương 1: epic Lv.30 + hero 4★
PROFILES.push(await measure('E. Cuối chương 1 (epic Lv.30, 4★)', {
  hero: 'alex', heroStars: { alex: 4 },
  gear: {
    weapon: ['rusty_bow', 'epic', 30],
    necklace: ['wooden_charm', 'epic', 30],
    ring: ['copper_ring', 'epic', 30],
    armor: ['cloth_vest', 'epic', 30],
    helmet: ['leather_cap', 'epic', 30],
    boots: ['worn_boots', 'epic', 30],
  },
}));

// F — người chơi cũ quay lại màn đầu: mythic Lv.100 + 8★
PROFILES.push(await measure('F. Người cũ quay lại (mythic Lv.100, 8★)', {
  hero: 'alex', heroStars: { alex: 8 },
  gear: {
    weapon: ['rusty_bow', 'mythic', 100],
    necklace: ['wooden_charm', 'mythic', 100],
    ring: ['copper_ring', 'mythic', 100],
    armor: ['cloth_vest', 'mythic', 100],
    helmet: ['leather_cap', 'mythic', 100],
    boots: ['worn_boots', 'mythic', 100],
  },
}));

// G — yếu đứng ở chương cao: tay không + cung Lv.1 nhưng chơi C5
PROFILES.push(await measure('G. Yếu ở chương cao (starter gear)', {
  hero: 'alex',
  gear: { weapon: ['rusty_bow', 'common', 1] },
}));

const out = {
  measuredAt: new Date().toISOString(),
  source: 'getComputedStats() trong public/index.html, đo trên Chrome local',
  note: 'Hồ sơ dựng bằng cách mặc đồ thật qua SaveState; KHÔNG ghi save, KHÔNG dùng dữ liệu người chơi.',
  browser: browser.version(),
  errors,
  profiles: PROFILES,
};
await writeFile(resolve(root, 'tools/combat-profiles.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\nĐã ghi tools/combat-profiles.json (${PROFILES.length} hồ sơ). errors=${JSON.stringify(errors)}`);

await browser.close();
await new Promise((r) => server.close(r));
if (errors.length) process.exitCode = 1;
