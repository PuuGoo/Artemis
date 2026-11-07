// Persistence cho 5 hệ: gameMode, modeBest, guild, garden, plinko.
//
// Nguyên tắc được khóa bằng test:
//   1. Writer của client LUÔN ghi key (null khi chưa mở) để phân biệt
//      "chưa từng có" với "đã xoá".
//   2. Sanitizer chỉ sinh key khi client gửi -> save cũ giữ nguyên hình dạng,
//      không bị "hồi sinh" dữ liệu mặc định của hệ mới.
//   3. Dữ liệu bẩn (prototype pollution, mảng quá dài, kiểu sai) bị lọc, không
//      làm sập và không ghi giá trị vô lý.
//   4. Dữ liệu hợp lệ của người chơi cũ (đồ mạnh, nhiều tài nguyên) không đổi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { sanitizeSave } from '../lib/saveSchema.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const writerStart = html.indexOf('save() {\n          // ==================== KHOA GHI');
const writerEnd = html.indexOf('\n      };\n      /**', writerStart);
assert.ok(writerStart >= 0 && writerEnd > writerStart, 'không tìm thấy writer SaveState.save()');
const writerBody = html.slice(writerStart, writerEnd);

/** Chạy đúng thân hàm save() thật của game với state cho trước. */
function write(state) {
  const window = { __ARTEMIS_SAVE_READY: true, dispatchEvent() {} };
  const save = runInNewContext('({' + writerBody + '}).save', { window, console, CustomEvent: class {} });
  save.call(state);
  return JSON.parse(window.__ARTEMIS_SAVE_BUFFER);
}

// ---------------------------------------------------------------------------
// 1. Writer
// ---------------------------------------------------------------------------

test('writer luôn ghi 5 key hệ mở rộng, kể cả khi chưa có dữ liệu', () => {
  // SaveState luôn có sẵn cả 5 field: gameMode 'campaign', modeBest {}, ba hệ
  // còn lại null cho tới khi người chơi mở chúng.
  const payload = write({
    gold: 500, gems: 50,
    gameMode: 'campaign', modeBest: {}, guild: null, garden: null, plinko: null,
  });
  assert.equal(payload.gameMode, 'campaign');
  assert.deepEqual(payload.modeBest, {});
  // null = "chưa mở hệ thống", khác với thiếu key = "client cũ".
  for (const key of ['guild', 'garden', 'plinko']) {
    assert.ok(Object.hasOwn(payload, key), `writer phải ghi key ${key}`);
    assert.equal(payload[key], null, `${key} phải là null khi chưa mở`);
  }
});

test('writer giữ nguyên dữ liệu 5 hệ đang có trong state', () => {
  const state = {
    gold: 12345,
    gameMode: 'endless',
    modeBest: { endless: 44, tower: 7 },
    guild: { name: 'Bang Thử', level: 2 },
    garden: { plots: [], totalHarvest: 99 },
    plinko: { balls: 3, totalWon: 4000 },
  };
  const payload = write(state);
  assert.equal(payload.gameMode, 'endless');
  assert.deepEqual(payload.modeBest, { endless: 44, tower: 7 });
  assert.deepEqual(payload.guild, { name: 'Bang Thử', level: 2 });
  assert.deepEqual(payload.garden, { plots: [], totalHarvest: 99 });
  assert.deepEqual(payload.plinko, { balls: 3, totalWon: 4000 });
});

// ---------------------------------------------------------------------------
// 2. Tương thích save cũ
// ---------------------------------------------------------------------------

test('save cũ không có 4 hệ thì sanitizer không tự thêm key', () => {
  const legacy = sanitizeSave({ gold: 203374, gems: 40, bestRooms: { 1: 15 } }).data;
  for (const key of ['modeBest', 'guild', 'garden', 'plinko']) {
    assert.equal(Object.hasOwn(legacy, key), false, `không được tự seed ${key} cho save cũ`);
  }
  // gameMode luôn có vì đó là lựa chọn chế độ, mặc định 'campaign'.
  assert.equal(legacy.gameMode, 'campaign');
  assert.equal(legacy.gold, 203374);
});

test('client mới gửi null thì sanitizer ghi null (xoá có chủ đích vẫn hoạt động)', () => {
  const data = sanitizeSave({ gold: 500, guild: null, garden: null, plinko: null, modeBest: {} }).data;
  assert.equal(data.guild, null);
  assert.equal(data.garden, null);
  assert.equal(data.plinko, null);
  assert.deepEqual(data.modeBest, {});
});

// ---------------------------------------------------------------------------
// 3. Round-trip dữ liệu hợp lệ
// ---------------------------------------------------------------------------

const guildFull = {
  name: 'Bang Cũ',
  level: 4,
  exp: 1234,
  notice: 'Chào mừng',
  createdAt: 1790000000000,
  members: [
    { id: 'gm_0_abc', name: 'Tôi', rank: 'leader', power: 5200, contribution: 300, bossDamage: 1200, isPlayer: true },
    { id: 'gm_1_def', name: 'Chiến Binh 01', rank: 'elder', power: 4100, contribution: 120, bossDamage: 0, isPlayer: false },
  ],
  boss: { week: 2, hp: 0, maxHp: 9000, defeated: true, attempts: 3 },
  expedition: { floor: 12, best: 15 },
  log: [{ t: 1790000000000, text: 'Bang được thành lập.' }],
};

const gardenFull = {
  plots: [
    { id: 0, seedId: 'voidbloom', plantedAt: 1790000000000, watered: true, readyAt: 1790000900000 },
    { id: 1, seedId: null, plantedAt: 0, watered: false, readyAt: 0 },
  ],
  seeds: { sprout: 0, voidbloom: 2 },
  produce: { leaf: 12, petal: 3, dew: 1, essence: 0 },
  totalHarvest: 88,
  weekTask: { done: 10, target: 10, claimed: true },
  raidsRepelled: 5,
};

const plinkoFull = {
  balls: 42,
  history: [{ bin: 4, mult: 0.35, bet: 200, win: 70, t: 1790000000000 }],
  totalWon: 15000,
  bestMult: 8.5,
  bet: 1000,
};

test('guild/garden/plinko hợp lệ sống qua sanitize và giữ đúng giá trị', () => {
  const input = {
    gold: 9000000,
    gems: 9000,
    guild: guildFull,
    garden: gardenFull,
    plinko: plinkoFull,
    modeBest: { endless: 37, tower: 12 },
  };
  const out = sanitizeSave(input).data;
  assert.deepEqual(out.guild, guildFull);
  assert.deepEqual(out.garden, gardenFull);
  assert.deepEqual(out.plinko, plinkoFull);
  assert.deepEqual(out.modeBest, { endless: 37, tower: 12 });
  assert.equal(out.gold, 9000000);
  assert.equal(out.gems, 9000);
});

test('sanitize là idempotent: chạy hai lần cho cùng kết quả', () => {
  const once = sanitizeSave({ guild: guildFull, garden: gardenFull, plinko: plinkoFull, modeBest: { endless: 37 } }).data;
  const twice = sanitizeSave(once).data;
  assert.deepEqual(twice.guild, once.guild);
  assert.deepEqual(twice.garden, once.garden);
  assert.deepEqual(twice.plinko, once.plinko);
  assert.deepEqual(twice.modeBest, once.modeBest);
});

// ---------------------------------------------------------------------------
// 4. Dữ liệu bẩn
// ---------------------------------------------------------------------------

test('prototype pollution trong 5 hệ không làm ô nhiễm Object.prototype', () => {
  const poison = JSON.parse('{"__proto__":{"pwned":true},"name":"Bang"}');
  const data = sanitizeSave({ guild: poison, garden: poison, plinko: poison, modeBest: poison }).data;
  assert.equal({}.pwned, undefined);
  assert.equal(Object.prototype.pwned, undefined);
  // Key độc hại bị bỏ, không thành modeBest
  assert.equal(Object.hasOwn(data.modeBest, '__proto__'), false);
});

test('mảng quá dài bị cắt, không phình save', () => {
  const members = Array.from({ length: 500 }, (_, i) => ({ id: `gm_${i}`, name: `M${i}`, power: 1 }));
  const data = sanitizeSave({
    guild: { name: 'Bang', members, log: Array.from({ length: 500 }, () => ({ t: 1, text: 'x' })) },
    garden: { plots: Array.from({ length: 500 }, (_, i) => ({ id: i, seedId: 'sprout', plantedAt: 1, readyAt: 2 })) },
    plinko: { history: Array.from({ length: 500 }, () => ({ bin: 1, mult: 1, bet: 1, win: 1, t: 1 })) },
  }).data;
  assert.equal(data.guild.members.length, 20);
  assert.equal(data.guild.log.length, 60);
  assert.equal(data.garden.plots.length, 6);
  assert.equal(data.plinko.history.length, 20);
});

test('giá trị phi lý bị chặn, không sinh NaN/âm trong save', () => {
  const data = sanitizeSave({
    guild: {
      name: 'Bang',
      level: -5,
      exp: Number.NaN,
      members: [{ id: 'gm_0', power: Number.POSITIVE_INFINITY, contribution: -100 }],
      boss: { hp: 500, maxHp: 100, defeated: true },
      expedition: { floor: Number.NEGATIVE_INFINITY },
    },
    garden: {
      plots: [{ id: 99, seedId: 'sprout', plantedAt: 500, readyAt: 100 }],
      seeds: { sprout: Number.NaN },
      produce: { leaf: -3 },
      weekTask: { done: -1, target: 0 },
    },
    plinko: { balls: -1, bestMult: Number.POSITIVE_INFINITY, bet: Number.NaN },
  }).data;

  assert.equal(data.guild.level, 1);
  assert.equal(data.guild.exp, 0);
  assert.equal(data.guild.members[0].power, 0, 'Infinity không được lưu thành số vô hạn');
  assert.equal(data.guild.members[0].contribution, 0);
  assert.equal(data.guild.boss.maxHp, 100);
  assert.equal(data.guild.boss.hp, 100, 'HP trùm không được vượt maxHp');
  assert.equal(data.guild.boss.defeated, false, 'chỉ coi là hạ khi HP thật sự về 0');
  assert.equal(data.guild.expedition.floor, 0);
  assert.equal(data.garden.plots[0].readyAt, 500, 'readyAt không được trước plantedAt');
  assert.equal(Object.hasOwn(data.garden.seeds, 'sprout'), false, 'NaN không tạo seed');
  assert.equal(data.garden.produce.leaf, 0);
  assert.equal(data.garden.weekTask.done, 0);
  assert.equal(data.garden.weekTask.target, 1);
  assert.equal(data.plinko.balls, 0);
  assert.equal(data.plinko.bestMult, 0);
  assert.equal(data.plinko.bet, 200);
});

test('guild thiếu tên hoặc sai kiểu -> null thay vì object rác', () => {
  assert.equal(sanitizeSave({ guild: { name: '   ' } }).data.guild, null);
  assert.equal(sanitizeSave({ guild: 'Bang' }).data.guild, null);
  assert.equal(sanitizeSave({ guild: [] }).data.guild, null);
  assert.equal(sanitizeSave({ garden: 'x' }).data.garden, null);
  assert.equal(sanitizeSave({ plinko: 5 }).data.plinko, null);
});

test('ô vườn không có hạt thì mốc thời gian bị xoá về 0', () => {
  const data = sanitizeSave({
    garden: { plots: [{ id: 0, seedId: null, plantedAt: 999, watered: true, readyAt: 1234 }] },
  }).data;
  const plot = data.garden.plots[0];
  assert.equal(plot.seedId, null);
  assert.equal(plot.plantedAt, 0);
  assert.equal(plot.watered, false);
  assert.equal(plot.readyAt, 0);
});

test('gameMode lạ bị đưa về campaign, không ghi chuỗi tuỳ ý', () => {
  assert.equal(sanitizeSave({ gameMode: 'godmode' }).data.gameMode, 'campaign');
  assert.equal(sanitizeSave({ gameMode: { evil: true } }).data.gameMode, 'campaign');
  assert.equal(sanitizeSave({ gameMode: 'endless' }).data.gameMode, 'endless');
});
