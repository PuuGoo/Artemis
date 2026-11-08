// Offline: kiểm tra lớp âm thanh mẫu thật (không phát tiếng, không mạng, không save).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const html = fs.readFileSync(new URL('public/index.html', root), 'utf8').replace(/\r\n/g, '\n');
const audioDir = new URL('public/assets/audio/', root);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', audioDir), 'utf8'));

test('mọi file trong manifest tồn tại và là MP3 hợp lệ', () => {
  const slots = Object.keys(manifest);
  assert.ok(slots.length >= 20, 'cần bộ âm thanh dùng được: ' + slots.length);
  for (const [slot, meta] of Object.entries(manifest)) {
    const file = new URL(meta.file, audioDir);
    assert.ok(fs.existsSync(file), 'thiếu file ' + slot);
    const bytes = fs.readFileSync(file);
    assert.ok(bytes.length > 500, slot + ' quá nhỏ');
    // ID3 hoặc frame sync MPEG
    const id3 = bytes.subarray(0, 3).toString('latin1') === 'ID3';
    const sync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    assert.ok(id3 || sync, slot + ' không phải MP3');
    assert.ok(meta.seconds > 0 && meta.seconds < 30, slot + ' thời lượng lạ');
  }
});

// Chạy SoundFX thật trong VM với AudioContext giả ghi lại lệnh.
function fixture() {
  const calls = [];
  const buffers = new Map();
  const sources = [];
  class FakeBuffer { constructor(name) { this.name = name; this.duration = 1; } }
  const ctx = {
    state: 'running', currentTime: 0, destination: {},
    createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() { calls.push(['osc']); }, stop() {} }; },
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 1 }, connect() {} }; },
    createBufferSource() {
      const node = { buffer: null, connect() {}, start(t) { calls.push(['sample', this.buffer && this.buffer.name, t]); } };
      sources.push(node);
      return node;
    },
    decodeAudioData(arrayBuffer) {
      const name = Buffer.from(arrayBuffer).toString('latin1').slice(0, 40);
      const buffer = new FakeBuffer(name);
      buffers.set(name, buffer);
      return Promise.resolve(buffer);
    },
    resume() { this.state = 'running'; },
  };
  const fetched = [];
  const sandbox = {
    window: { AudioContext: function () { return ctx; } },
    document: { addEventListener() {}, getElementById() { return null; } },
    console,
    setTimeout,
    fetch(url) {
      fetched.push(String(url));
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode('ID3' + String(url)).buffer) });
    },
    SaveState: { saveSettings: {} },
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const start = html.indexOf('      const SoundFX = {');
  const end = html.indexOf('\n      };', start) + '\n      };'.length;
  assert.ok(start > 0 && end > start, 'không tìm thấy SoundFX');
  vm.runInContext(html.slice(start, end) + '\nthis.__sfx = SoundFX;', context);
  return { sfx: context.__sfx, calls, fetched, ctx, sources };
}

test('SoundFX dùng mẫu thật khi đã tải, giữ synth làm dự phòng', async () => {
  const f = fixture();
  assert.equal(typeof f.sfx.preload, 'function', 'thiếu preload');
  await f.sfx.preload();
  assert.ok(f.fetched.some(u => u.includes('assets/audio/shoot_bow.mp3')), 'không tải mẫu bắn cung');
  const before = f.calls.length;
  f.sfx.shootBow();
  assert.ok(f.calls.slice(before).some(c => c[0] === 'sample'), 'không phát mẫu thật');
});

test('tắt tiếng thì không phát gì; giới hạn số tiếng đồng thời', async () => {
  const f = fixture();
  await f.sfx.preload();
  f.sfx.muted = true;
  const before = f.calls.length;
  f.sfx.hitEnemy(false);
  f.sfx.coinPickup();
  assert.equal(f.calls.length, before, 'vẫn phát khi tắt tiếng');
  f.sfx.muted = false;
  for (let i = 0; i < 40; i++) f.sfx.hitEnemy(false);
  const playing = f.calls.filter(c => c[0] === 'sample').length;
  assert.equal(playing, 1, 'cùng thời điểm chỉ được một mẫu trúng đòn');
  assert.equal(f.calls.filter(c => c[0] === 'osc').length, 0, 'không lách giới hạn bằng synth');
});

test('giới hạn voice ngắn/dài độc lập, giải phóng đúng khi kết thúc', async () => {
  const f = fixture();
  await f.sfx.preload();
  for (let i = 0; i < f.sfx.maxVoices + 5; i++) {
    f.ctx.currentTime = i;
    f.sfx.shootBow();
  }
  assert.equal(f.sfx.activeVoices, f.sfx.maxVoices);
  assert.equal(f.calls.filter(c => c[0] === 'osc').length, 0);
  f.sfx.victory();
  assert.equal(f.sfx.activeStingers, 1);
  const source = f.sources[0];
  source.onended();
  source.onended();
  assert.equal(f.sfx.activeVoices, f.sfx.maxVoices - 1, 'onended lặp không giảm hai lần');
  f.ctx.currentTime++;
  f.sfx.shootBow();
  assert.equal(f.sfx.activeVoices, f.sfx.maxVoices);
});

test('thiếu mẫu vẫn dùng synth, start lỗi không rò ngân sách voice', async () => {
  const f = fixture();
  f.sfx.shootBow();
  assert.equal(f.calls.filter(c => c[0] === 'osc').length, 1);
  await f.sfx.preload();
  f.ctx.createBufferSource = () => ({ connect() {}, start() { throw new Error('start failed'); } });
  f.sfx.shootBow();
  assert.equal(f.sfx.activeVoices, 0);
  assert.equal(f.sfx.lastPlayed.shootBow, undefined, 'start lỗi không ghi cooldown');
});

test('âm thanh mới có mặt trong game và gọi đúng sự kiện', () => {
  for (const slot of ['enemyDeath', 'victory', 'skillCast']) assert.ok(new RegExp(slot + '\\s*\\(').test(html), 'thiếu ' + slot);
  // Hạ địch gọi động theo isBoss để trùm có tiếng riêng.
  assert.match(html, /SoundFX\[e\.isBoss \? 'bossDeath' : 'enemyDeath'\]\(\)/);
  assert.match(html, /SoundFX\.victory\(/);
  assert.match(html, /SoundFX\.skillCast\?\.\(/);
  assert.match(html, /SoundFX\.preload\?\.\(\)/);
  assert.match(html, /clipBase: 'assets\/audio\/'/);
  // Mọi file game tham chiếu phải có thật trong manifest đã trích.
  const referenced = [...html.matchAll(/'([a-z_]+\.mp3)'/g)].map(m => m[1]);
  assert.ok(referenced.length >= 20, 'quá ít mẫu được nối');
  const files = new Set(Object.values(manifest).map(m => m.file));
  for (const name of referenced) assert.ok(files.has(name), 'game tham chiếu file không có: ' + name);
});
