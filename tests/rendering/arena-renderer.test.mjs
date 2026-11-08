// Module production trong VM + canvas spy; không browser, không mạng/DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function load(extra = {}) {
  const file = new URL('../../public/js/game/rendering/arena-renderer.js', import.meta.url);
  assert.ok(fs.existsSync(file), 'Cần một factory renderer dùng chung game/admin');
  const context = vm.createContext(extra);
  context.window = context;
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  return context;
}
function canvas() {
  let depth = 0;
  const images = [], gradient = { addColorStop() {} };
  const ctx = new Proxy({
    save() { depth++; }, restore() { depth--; assert.ok(depth >= 0); },
    drawImage(image) { images.push(image); },
    createLinearGradient() { return gradient; }, createRadialGradient() { return gradient; },
  }, {
    get: (o, key) => key in o ? o[key] : (...args) => {
      assert.ok(args.every(v => typeof v !== 'number' || Number.isFinite(v)), String(key));
    },
    set: (o, key, value) => { o[key] = value; return true; },
  });
  return { ctx, images, depth: () => depth };
}
function game(chapter) {
  return { chapter: { id: chapter }, room: 1, maxRooms: 15, floorDecals: [],
    wallTorches: [], obstacles: [], enemies: [], portalRect: { x: 20, y: 20, w: 40, h: 40 } };
}

test('factory không đụng DOM khi nạp và mỗi instance có Game, biome, cache riêng', () => {
  let created = 0;
  const c = load({ document: {
    createElement() { created++; return { getContext: () => canvas().ctx }; },
    getElementById() { return null; },
  } });
  assert.equal(created, 0, 'chỉ khai báo factory, không tự tạo renderer');
  const a = c.ArtemisArenaRenderer.create(), b = c.ArtemisArenaRenderer.create();
  assert.notEqual(a, b);
  assert.equal(created, 0);
  for (const api of ['init', 'drawArena', 'drawMonster', 'drawEnemyBullet', 'drawTargetReticle', 'biomeLabel', 'tint']) {
    assert.equal(typeof a[api], 'function', api);
  }
  a.init(game(1)); b.init(game(8));
  assert.notEqual(a.biomeLabel(), b.biomeLabel());
  const before = a.biomeLabel(), output = canvas();
  a.drawArena(output.ctx, 600, 800, 24, 1000, 1);
  const firstCanvas = output.images[0], builds = created;
  b.drawArena(output.ctx, 600, 800, 24, 1000, 8);
  assert.notEqual(output.images[1], firstCanvas);
  assert.equal(created, builds + 1);
  a.drawArena(output.ctx, 600, 800, 24, 1100, 1);
  assert.equal(output.images[2], firstCanvas, 'instance khác không xoá cache của game');
  assert.equal(created, builds + 1);
  assert.equal(a.biomeLabel(), before);
  assert.equal(output.depth(), 0);
});

test('renderer thật dùng nền biome ở phòng 1 mọi chương, phòng sau vẫn vẽ ảnh phủ', () => {
  const requested = [];
  class FakeImage {
    constructor() { this.complete = true; this.naturalWidth = 720; }
    set src(value) { this._src = value; requested.push(value); }
    get src() { return this._src; }
  }
  const c = load({ Image: FakeImage, document: {
    createElement() { return { getContext: () => canvas().ctx }; },
    getElementById() { return null; },
  } });
  vm.runInContext(read('public/arena-ground.js'), c);
  for (let chapter = 1; chapter <= 19; chapter++) {
    const g = game(chapter), arena = c.ArtemisArenaRenderer.create();
    arena.init(g);
    const before = JSON.stringify(g), requestsBefore = requested.length, cacheBefore = c.ArenaGround._cache.size;
    const opening = canvas();
    arena.drawArena(opening.ctx, 600, 800, 24, 1000, chapter);
    assert.equal(opening.images.length, 1, `chương ${chapter}: chỉ vẽ nền biome đã cache`);
    assert.equal(requested.length, requestsBefore, 'không tải ảnh phủ phòng đầu');
    assert.equal(c.ArenaGround._cache.size, cacheBefore);
    assert.equal(JSON.stringify(g), before, 'không thay phòng hoặc dữ liệu gameplay');
    assert.equal(opening.depth(), 0);
    if (chapter === 2) assert.equal(arena.biomeLabel(), 'Thung Lũng Dung Nham');

    g.room = 2;
    const laterBefore = JSON.stringify(g), later = canvas();
    arena.drawArena(later.ctx, 600, 800, 24, 1100, chapter);
    assert.equal(later.images.length, 2, `chương ${chapter}: phòng 2 vẫn có ảnh phủ`);
    assert.equal(later.images[1].src, `assets/maps/${c.ArenaGround.pick(chapter, 2)}.webp`);
    assert.equal(JSON.stringify(g), laterBefore);
    assert.equal(later.depth(), 0);

    g.room = 1;
    const back = canvas();
    arena.drawArena(back.ctx, 600, 800, 24, 1200, chapter);
    assert.equal(back.images.length, 1, 'quay lại phòng đầu không dùng ảnh từ cache');
    assert.equal(back.depth(), 0);
  }
});

test('game nạp factory trước bootstrap, không còn bản sao renderer game/admin', () => {
  load();
  const html = read('public/index.html'), admin = read('public/admin-campaign.js');
  const loader = html.indexOf('<script src="/js/game/rendering/arena-renderer.js"></script>');
  const init = html.indexOf('const ArenaV2 = ArtemisArenaRenderer.create();');
  assert.ok(loader >= 0 && init > loader);
  assert.doesNotMatch(html, /function drawArena\(|function drawMonster\(|const BIOMES =/);
  assert.ok(admin.includes('script.src="/js/game/rendering/arena-renderer.js";'));
  assert.match(admin, /window.AdminCampaignArenaV2\s*=\s*window.ArtemisArenaRenderer.create\(\)/);
  assert.doesNotMatch(admin, /admin-campaign-renderer\.js/);
  assert.equal(fs.existsSync(new URL('../../public/admin-campaign-renderer.js', import.meta.url)), false);
});

test('admin loader single-flight tạo instance từ factory thật sau script.onload', async () => {
  const scripts = [];
  const c = load({ document: {
    querySelector() { return null; }, createElement() { return { dataset: {} }; },
    head: { appendChild(script) { scripts.push(script); } },
  } });
  const source = read('public/admin-campaign.js');
  const start = source.indexOf('  function loadRenderer() {');
  const end = source.indexOf('  function buildFakeGame()', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext('var rendererPromise = null;\n' + source.slice(start, end) + '\nthis.loadRenderer = loadRenderer;', c);
  const first = c.loadRenderer(), second = c.loadRenderer();
  assert.equal(first, second);
  const rendererScripts = scripts.filter(s => s.src === '/js/game/rendering/arena-renderer.js');
  assert.equal(rendererScripts.length, 1);
  assert.equal(c.AdminCampaignArenaV2, undefined);
  rendererScripts[0].onload();
  const api = await first;
  assert.equal(api, c.AdminCampaignArenaV2);
  assert.equal(await c.loadRenderer(), api);
  assert.equal(typeof api.drawMonster, 'function');
});
