// Hạt VFX trạng thái từ texture thật: chỉ đổi hình, không đổi sát thương/nhịp.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const modPath = new URL('public/status-vfx.js', root);
const manifest = JSON.parse(fs.readFileSync(new URL('public/assets/vfx/manifest.json', root), 'utf8'));
const html = fs.readFileSync(new URL('public/index.html', root), 'utf8').replaceAll(String.fromCharCode(13), '');
const renderer = fs.readFileSync(new URL('public/js/game/rendering/arena-renderer.js', root), 'utf8').replaceAll(String.fromCharCode(13), '');

function load() {
  assert.ok(fs.existsSync(modPath), 'thiếu public/status-vfx.js');
  class FakeImage {
    constructor() { this.complete = true; this.naturalWidth = 128; this.naturalHeight = 128; }
    set src(v) { this._src = v; }
    get src() { return this._src; }
  }
  const ctx = vm.createContext({ console, Image: FakeImage, matchMedia: () => ({ matches: false }) });
  vm.runInContext(fs.readFileSync(modPath, 'utf8'), ctx);
  return ctx.StatusVFX;
}

test('cả 8 texture tồn tại và là WebP có alpha', () => {
  const slots = Object.keys(manifest);
  assert.equal(slots.length, 8);
  for (const [slot, meta] of Object.entries(manifest)) {
    const file = new URL('public/assets/vfx/' + slot + '.webp', root);
    assert.ok(fs.existsSync(file), 'thiếu ' + slot);
    const buf = fs.readFileSync(file);
    assert.equal(buf.subarray(8, 12).toString('latin1'), 'WEBP');
    // Kích thước file không nói lên nội dung (quầng sáng trơn nén rất nhỏ),
    // nên ngưỡng chỉ chống file rỗng; độ đặc của alpha được kiểm ở test riêng.
    assert.ok(meta.webp_bytes > 300, slot + ' quá nhỏ: ' + meta.webp_bytes);
    assert.equal(meta.mode, 'RGBA', 'phải có alpha: ' + slot);
  }
});

test('mỗi trạng thái có bộ hạt riêng, không dùng lẫn', () => {
  const vfx = load();
  // Mảng từ VM khác realm: so theo giá trị, không so tham chiếu.
  assert.equal(vfx.frames('burn').join(','), 'burn_a,burn_b');
  assert.equal(vfx.frames('poison').join(','), 'poison_a,poison_b');
  assert.equal(vfx.frames('frost').join(','), 'frost_a,frost_b');
  assert.equal(vfx.frames('spark').join(','), 'spark_a');
  assert.equal(vfx.frames('unknown').length, 0);
});

test('mọi texture có nội dung alpha thật, không phải ảnh rỗng', () => {
  // Dùng ffmpeg nếu có để đếm pixel đục; không có thì bỏ qua (không fail oan).
  const ff = 'C:/Users/PuuGoo/AppData/Local/hermes/tools/ffmpeg-9.0.1-win32-x64/bin/ffmpeg.exe';
  if (!fs.existsSync(ff)) return;
  for (const slot of Object.keys(manifest)) {
    const file = fileURLToPath(new URL('public/assets/vfx/' + slot + '.webp', root));
    const out = execFileSync(ff, ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
      { maxBuffer: 40 * 1024 * 1024 });
    const alpha = [];
    for (let i = 3; i < out.length; i += 4) alpha.push(out[i]);
    const opaque = alpha.filter(a => a > 8).length / alpha.length;
    assert.ok(opaque > 0.1, `${slot} gần như trong suốt: ${(opaque * 100).toFixed(1)}%`);
    assert.equal(Math.max(...alpha), 255, slot + ' không có pixel đục hoàn toàn');
  }
});

test('số hạt và nhịp hoàn toàn do hạt giống trạng thái quyết định', () => {
  const vfx = load();
  // Cùng một trạng thái => cùng chuỗi hạt (deterministic), không random mỗi frame.
  const a = vfx.particles({ kind: 'burn', seed: 42, x: 10, y: 20, radius: 18, t: 1.5 });
  const b = vfx.particles({ kind: 'burn', seed: 42, x: 10, y: 20, radius: 18, t: 1.5 });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(a.length >= 3 && a.length <= 9, 'số hạt lạ: ' + a.length);
  // Khác thời điểm => vị trí đổi.
  const c = vfx.particles({ kind: 'burn', seed: 42, x: 10, y: 20, radius: 18, t: 1.7 });
  assert.notEqual(a.map(p => p.dy).join(','), c.map(p => p.dy).join(','));
  // Mọi hạt nằm trong vùng quanh quái, không bay khỏi màn hình.
  for (const p of a) {
    assert.ok(Number.isFinite(p.dx) && Number.isFinite(p.dy));
    assert.ok(Math.abs(p.dx) <= 30 && Math.abs(p.dy) <= 40, 'hạt bay quá xa: ' + JSON.stringify(p));
    assert.ok(p.size > 0 && p.size <= 40);
    assert.ok(p.alpha > 0 && p.alpha <= 1);
  }
});

test('không vẽ khi tắt hiệu năng thấp/giảm chuyển động, và không ném lỗi', () => {
  const vfx = load();
  assert.equal(vfx.shouldDraw({ lowGfx: true }), false);
  const calls = [];
  const c = { globalAlpha: 1, save() {}, restore() {}, drawImage: (...a) => calls.push(a) };
  assert.equal(vfx.draw(c, { kind: 'burn', seed: 1, x: 0, y: 0, radius: 18, t: 0.5 }, { lowGfx: true }), false);
  assert.equal(calls.length, 0);
  // Thiếu kind / không có ảnh => false, không ném.
  assert.equal(vfx.draw(c, { seed: 1, x: 0, y: 0, radius: 18, t: 0.5 }, {}), false);
  // Trạng thái thật => vẽ, có drawImage.
  const drew = vfx.draw(c, { kind: 'poison', seed: 7, x: 100, y: 200, radius: 20, t: 0.9 }, {});
  assert.equal(drew, true);
  assert.ok(calls.length >= 3, 'không vẽ hạt: ' + calls.length);
});

test('renderer production dùng StatusVFX cho cháy và độc', () => {
  assert.match(html, /<script src="\/status-vfx\.js"><\/script>/);
  const start = renderer.indexOf('  function drawMonster(');
  assert.ok(start >= 0);
  const arena = renderer.slice(start, renderer.indexOf('// ---------- Đạn quái:', start));
  assert.match(arena, /StatusVFX\.drawEnemy\(ctx, e, nowMs, Game\)/);
});

test('trạng thái thật chọn đúng texture, giữ seed khi di chuyển và không sửa entity', () => {
  const vfx = load();
  const e = { hp: 100, r: 18, x: 10, y: 20, burnTimer: 1, poisonTimer: 1, slowTimer: 1 };
  const before = JSON.stringify(e);
  const calls = [];
  const c = { globalAlpha: 0.6, drawImage(img, ...args) { calls.push([img.src, ...args]); } };
  assert.equal(vfx.drawEnemy(c, e, 1000, {}), true);
  assert.equal(c.globalAlpha, 0.6);
  assert.equal(JSON.stringify(e), before);
  for (const kind of ['burn', 'poison', 'frost']) assert.ok(calls.some(row => row[0].includes(kind)));
  const first = JSON.stringify(calls);
  calls.length = 0;
  e.x = 50; e.y = 70;
  vfx.drawEnemy(c, e, 1000, {});
  assert.equal(JSON.stringify(calls), first, 'di chuyển không được đổi hạt giống');
  calls.length = 0;
  e.burnTimer = e.poisonTimer = e.slowTimer = 0;
  assert.equal(vfx.drawEnemy(c, e, 1000, {}), false);
  assert.equal(calls.length, 0);
});
