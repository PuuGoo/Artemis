// Nền map thật: chỉ đổi hình, không đổi va chạm/hitbox/toạ độ/save.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const modPath = new URL('public/arena-ground.js', root);
const manifest = JSON.parse(fs.readFileSync(new URL('public/assets/maps/manifest.json', root), 'utf8'));
const html = fs.readFileSync(new URL('public/index.html', root), 'utf8').replace(/\r\n/g, '\n');
const renderer = fs.readFileSync(new URL('public/js/game/rendering/arena-renderer.js', root), 'utf8').replace(/\r\n/g, '\n');

function load() {
  assert.ok(fs.existsSync(modPath), 'thiếu public/arena-ground.js');
  // Image giả đã "tải xong" để kiểm nhánh vẽ thật, không chạm mạng.
  class FakeImage {
    constructor() { this.complete = true; this.naturalWidth = 720; this.naturalHeight = 1440; this.width = 720; this.height = 1440; }
    set src(v) { this._src = v; }
    get src() { return this._src; }
  }
  const ctx = vm.createContext({ console, matchMedia: () => ({ matches: false }), Image: FakeImage });
  vm.runInContext(fs.readFileSync(modPath, 'utf8'), ctx);
  return ctx.ArenaGround;
}

test('mọi map trong manifest có file và là WebP hợp lệ', () => {
  const keys = Object.keys(manifest);
  assert.equal(keys.length, 28, 'cần đủ 28 nền: ' + keys.length);
  for (const [key, meta] of Object.entries(manifest)) {
    const file = new URL('public/assets/maps/' + key + '.webp', root);
    assert.ok(fs.existsSync(file), 'thiếu ' + key);
    const buf = fs.readFileSync(file);
    assert.equal(buf.subarray(0, 4).toString('latin1'), 'RIFF', key + ' không phải RIFF');
    assert.equal(buf.subarray(8, 12).toString('latin1'), 'WEBP', key + ' không phải WebP');
    assert.ok(meta.webp_bytes > 5000, key + ' quá nhỏ');
  }
});

test('chọn nền ổn định theo chương/phòng, không đổi giữa các frame', () => {
  const art = load();
  const seen = new Map();
  for (let ch = 1; ch <= 19; ch++) {
    for (let room = 1; room <= 15; room++) {
      const a = art.pick(ch, room), b = art.pick(ch, room);
      assert.equal(a, b, `không ổn định ch${ch} r${room}`);
      assert.ok(Object.prototype.hasOwnProperty.call(manifest, a), 'khoá lạ: ' + a);
      seen.set(a, (seen.get(a) || 0) + 1);
    }
  }
  assert.ok(seen.size >= 8, 'quá ít nền được dùng: ' + seen.size);
});

test('không tải ảnh khi đang ở chế độ hiệu năng thấp hoặc giảm chuyển động', () => {
  const art = load();
  assert.equal(art.shouldDraw({ lowGfx: true }), false);
  assert.equal(art.shouldDraw({ lowGfx: false, reduceMotion: true }), false);
  assert.equal(art.shouldDraw({ lowGfx: false }), true);
  assert.equal(art.shouldDraw({}), true);
});

test('vẽ một lần mỗi frame, không tạo entity và không sửa Game', () => {
  const art = load();
  const calls = [];
  const c = new Proxy({ globalAlpha: 1 }, {
    get: (o, k) => (k in o ? o[k] : (...args) => calls.push([k, ...args])),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  const game = { lowGfx: false, enemies: [], room: 3 };
  const before = JSON.stringify(game);
  const drew = art.draw(c, 600, 800, 24, 2, 3, game, { image: { width: 720, height: 1440 } });
  assert.equal(drew, true);
  assert.equal(calls.filter(x => x[0] === 'drawImage').length, 1, 'phải chỉ một drawImage/frame');
  assert.ok(calls.every(x => x.slice(1).every(v => typeof v !== 'number' || Number.isFinite(v))));
  assert.equal(JSON.stringify(game), before, 'không được sửa Game');
  // Không tự save/restore: drawArena bọc sẵn, giữ trạng thái canvas cân bằng.
  assert.equal(calls.filter(x => x[0] === 'save').length, 0);
  assert.equal(calls.filter(x => x[0] === 'restore').length, 0);
});

test('phòng đầu mọi chương giữ nền biome, không tải hoặc vẽ lớp ảnh phủ', () => {
  const art = load();
  const c = { globalAlpha: 0.65, fillStyle: '#123456',
    drawImage() { assert.fail('Phòng 1 không được vẽ ảnh phủ'); },
    fillRect() { assert.fail('Phòng 1 không được phủ tối nền biome'); },
  };
  for (let chapter = 1; chapter <= 19; chapter++) {
    const game = { chapter: { id: chapter }, room: 1, lowGfx: false, enemies: [{ hp: 20 }], obstacles: [{ x: 30, y: 40 }] };
    const before = JSON.stringify(game);
    assert.equal(art.draw(c, 600, 800, 24, chapter, 1, game), false);
    assert.equal(JSON.stringify(game), before);
  }
  assert.equal(art._cache.size, 0, 'không tải ảnh nền phòng đầu vào cache');
  assert.equal(c.globalAlpha, 0.65);
  assert.equal(c.fillStyle, '#123456');
});

test('thiếu ảnh thì bỏ qua an toàn, không ném lỗi', () => {
  // Không có Image trong sandbox => không tải được ảnh => phải trả false, không vẽ.
  const bare = vm.createContext({ console, matchMedia: () => ({ matches: false }) });
  vm.runInContext(fs.readFileSync(modPath, 'utf8'), bare);
  let drew = 0;
  const c = { drawImage() { drew++; } };
  assert.equal(bare.ArenaGround.draw(c, 600, 800, 24, 1, 2, { lowGfx: false }), false);
  assert.equal(drew, 0, 'không được vẽ khi thiếu ảnh');
  // Và khi tắt hiệu năng thấp cũng không vẽ.
  const art = load();
  assert.equal(art.draw(c, 600, 800, 24, 1, 2, { lowGfx: true }), false);
  assert.equal(drew, 0);
});

test('game nghỉ lớp ảnh map nhưng giữ renderer biome và HUD', () => {
  assert.doesNotMatch(html, /<script src="\/arena-ground\.js"><\/script>/);
  assert.match(html, /<script src="\/js\/game\/rendering\/arena-renderer\.js"><\/script>/);
  const start = renderer.indexOf('  function drawArena(ctx, w, h, pad, nowMs, chId) {');
  assert.ok(start > 0);
  const end = renderer.indexOf('\n  }', start);
  const body = renderer.slice(start, end);
  assert.doesNotMatch(body, /ArenaGround\.draw\(/);
  assert.match(body, /ctx\.drawImage\(cache\.canvas/);
  for (const id of ['hudLevelText','btnPauseGame','bossHpBar']) assert.ok(html.includes(`id="${id}"`));
});
