// ==================== KHỞI TẠO TÀI KHOẢN MỚI (Đợt 1) ====================
//
// Khóa các hành vi:
//   1. Seed tân thủ do MÁY CHỦ sinh, khớp giá trị mặc định của client
//      (gold 500, gems 50, stamina 20, Alex 0★, túi rỗng, N01 đang mở).
//   2. Đăng ký tạo luôn snapshot revision 1 + đánh dấu initVersion.
//   3. Bản ghi save bị mất trên tài khoản đã đánh dấu -> GET khôi phục seed,
//      KHÔNG trả hasSave=false để client tự dựng state.
//   4. PUT revision 0 trên tài khoản đã đánh dấu bị từ chối (chặn việc tự khai
//      tài nguyên ở lần lưu đầu).
//   5. Tài khoản CŨ không có marker giữ nguyên hành vi (không hồi quy).
//   6. Client cũ không gửi field mới -> server giữ giá trị đang có trong DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sanitizeSave } from '../lib/saveSchema.js';
import { validateEconomyBudget } from '../lib/economyLedger.js';
import { normalizeVipPasses, hasVipPass } from '../lib/privilegeCards.js';
import { validateEconomyDelta, validateSeasonDelta } from '../lib/economy.js';
import { validateCredentials, normalizeUsername, usernameKey } from '../lib/auth.js';
import {
  NEW_ACCOUNT_INIT_VERSION,
  buildCanonicalNewAccountData,
  buildCanonicalNewAccountSave,
} from '../lib/initialState.js';

const ROOT = new URL('..', import.meta.url);
const fileURL = (rel) => new URL(rel, import.meta.url);

/** Bỏ import/export để chạy được thân route trong VM (giữ nguyên logic). */
function readSource(rel) {
  const lines = fs.readFileSync(fileURL(rel), 'utf8').split('\n');
  const out = [];
  let skipping = false;
  for (const line of lines) {
    if (!skipping && /^import\b/.test(line)) {
      if (/;\s*$/.test(line)) continue;
      skipping = true;
      continue;
    }
    if (skipping) {
      if (/;\s*$/.test(line)) skipping = false;
      continue;
    }
    out.push(line.replace(/^export\s+/, ''));
  }
  return out.join('\n');
}
const clone = (v) => structuredClone(v);

// ---------------------------------------------------------------------------
// Mock Mongo tối thiểu: đủ cho register.js và save.js
// ---------------------------------------------------------------------------
function mockDb() {
  const stores = { players: [], saves: [] };

  const players = {
    async insertOne(doc) {
      if (stores.players.some((p) => p.usernameLower === doc.usernameLower)) {
        throw Object.assign(new Error('duplicate username'), { code: 11000 });
      }
      const _id = `p${stores.players.length + 1}`;
      stores.players.push({ _id, ...clone(doc) });
      return { insertedId: _id, acknowledged: true };
    },
    async findOne(query) {
      const hit = stores.players.find((p) => (query._id ? p._id === String(query._id) : true));
      return hit ? clone(hit) : null;
    },
  };

  const matchesSave = (doc, query) => {
    if (!doc) return false;
    if (query.playerId !== undefined && doc.playerId !== query.playerId) return false;
    if (query.revision !== undefined) {
      if (query.revision && typeof query.revision === 'object') return !('revision' in doc);
      return doc.revision === query.revision;
    }
    return true;
  };

  const saves = {
    writes: 0,
    failNextInsert: false,
    all: () => clone(stores.saves),
    async insertOne(doc) {
      if (saves.failNextInsert) {
        saves.failNextInsert = false;
        throw new Error('mongo tam thoi loi');
      }
      if (stores.saves.some((s) => s.playerId === doc.playerId)) {
        throw Object.assign(new Error('duplicate player save'), { code: 11000 });
      }
      saves.writes += 1;
      stores.saves.push(clone(doc));
      return { acknowledged: true };
    },
    async findOne(query, options = {}) {
      const doc = stores.saves.find((s) => matchesSave(s, query));
      if (!doc) return null;
      if (!options.projection) return clone(doc);
      const projected = {};
      for (const key of Object.keys(options.projection)) {
        const [root, child] = key.split('.');
        if (!(root in doc)) continue;
        if (child) {
          if (doc[root] && child in doc[root]) (projected[root] ||= {})[child] = clone(doc[root][child]);
        } else projected[root] = clone(doc[root]);
      }
      return projected;
    },
    async updateOne(query, update, options = {}) {
      const doc = stores.saves.find((s) => matchesSave(s, query));
      if (!doc) {
        if (!options.upsert) return { matchedCount: 0 };
        throw Object.assign(new Error('duplicate player save'), { code: 11000 });
      }
      saves.writes += 1;
      Object.assign(doc, clone(update.$set));
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };

  return {
    db: { collection: (name) => (name === 'players' ? players : saves) },
    stores,
    saves,
  };
}

const COLLECTIONS = { players: 'players', saves: 'saves', loginAttempts: 'login_attempts' };

function loadRoute(source, extra) {
  const context = vm.createContext({ console, Response, Request, JSON, Date, Number, Object, Array, Math, structuredClone, ...extra });
  // Chỉ gắn những handler thực sự có trong file để không ReferenceError.
  const handlers = ['GET', 'PUT', 'POST', 'DELETE'].filter((name) => new RegExp(`(async\\s+)?function\\s+${name}\\b`).test(source));
  vm.runInContext(`${source}\nthis.route = { ${handlers.join(', ')} };`, context);
  return context.route;
}

function registerRoute(mock) {
  const source = readSource('../api/auth/register.js');
  return loadRoute(source, {
    getMongoDb: async () => mock.db,
    COLLECTIONS,
    json: (body, status = 200) => new Response(JSON.stringify(body), { status }),
    fail: (error, status) => new Response(JSON.stringify({ ok: false, error }), { status }),
    readJsonBody: async (request) => ({ ok: true, data: await request.json() }),
    bumpRateLimit: async () => ({ allowed: true }),
    clientIp: () => '127.0.0.1',
    hashPassword: async (pw) => `hashed:${pw}`,
    signSession: async () => 'signed-token',
    sessionCookie: () => 'artemis_session=signed-token; Path=/',
    validateCredentials,
    normalizeUsername,
    usernameKey,
    NEW_ACCOUNT_INIT_VERSION,
    buildCanonicalNewAccountSave,
  });
}

function saveRoute(mock, who) {
  const source = readSource('../api/save.js');
  return loadRoute(source, {
    getMongoDb: async () => mock.db,
    COLLECTIONS,
    getCurrentPlayer: async () => who,
    json: (body, status = 200) => new Response(JSON.stringify(body), { status }),
    fail: (error, status) => new Response(JSON.stringify({ ok: false, error }), { status }),
    readJsonBody: async (request) => ({ ok: true, data: await request.json() }),
    bumpRateLimit: async () => ({ allowed: true }),
    clientIp: () => '127.0.0.1',
    sanitizeSave,
    MAX_SAVE_BYTES: 400 * 1024,
    validateEconomyDelta,
    validateSeasonDelta,
    // Ngân sách kinh tế (Đợt 6) — save.js gọi tới, phải có trong sandbox vm.
    validateEconomyBudget,
    normalizeVipPasses,
    hasVipPass,
    NEW_ACCOUNT_INIT_VERSION,
    buildCanonicalNewAccountSave,
  });
}

const playerDoc = (extra = {}) => ({ _id: 'player-1', username: 'qa_artemis', ...extra });

// ---------------------------------------------------------------------------
// 1. Seed khớp giá trị mặc định của client
// ---------------------------------------------------------------------------

/** Đọc SaveState defaults thật từ public/index.html. */
function clientDefaults() {
  const html = fs.readFileSync(fileURL('../public/index.html'), 'utf8').replace(/\r\n/g, '\n');
  const start = html.indexOf('const SaveState = {');
  const end = html.indexOf('      * Ảnh chụp trạng thái mặc định', start);
  assert.ok(start >= 0 && end > start, 'không tìm thấy SaveState defaults');
  const block = html.slice(start, html.lastIndexOf('};', end) + 2);
  const ctx = vm.createContext({
    createDefaultEquipped: () => ({ weapon: null, necklace: null, ring: null, armor: null, helmet: null, boots: null }),
    createDefaultBag: () => [],
    createDefaultPresets: () => ({
      1: { weapon: null, necklace: null, ring: null, armor: null, helmet: null, boots: null },
      2: { weapon: null, necklace: null, ring: null, armor: null, helmet: null, boots: null },
      3: { weapon: null, necklace: null, ring: null, armor: null, helmet: null, boots: null },
    }),
    createDefaultGearLoadouts: () => ({}),
  });
  vm.runInContext(block.replace('const SaveState =', 'globalThis.S ='), ctx);
  // Chuẩn hoá qua JSON: object tạo trong VM context có prototype khác realm,
  // deepStrictEqual sẽ báo lệch dù giá trị giống hệt.
  return JSON.parse(JSON.stringify(ctx.S));
}

const HERO_ROSTER = [
  'thor', 'wukong', 'cleo', 'atreus', 'rolla', 'nezha', 'otta', 'hou_yi',
  'phynx', 'loki', 'dracoola', 'seraph', 'mymu', 'hela', 'helix', 'nyanja',
  'alex', 'artemis',
];

test('seed tân thủ khớp giá trị mặc định của client ở mọi field dùng chung', () => {
  const defaults = clientDefaults();
  const seed = buildCanonicalNewAccountData({ now: 1790000000000 });

  // season: sanitize luôn chuẩn hoá null -> object rỗng (hợp đồng riêng).
  // beginnerJourney: seed CỐ Ý bật tutorial nên startedAt khác 0.
  const intentional = new Set(['season', 'beginnerJourney']);
  const shared = Object.keys(seed).filter((k) => k in defaults && !intentional.has(k));
  assert.ok(shared.length > 20, `chỉ so được ${shared.length} field`);
  for (const key of shared) {
    assert.deepEqual(seed[key], defaults[key], `seed lệch default ở "${key}"`);
  }
});

test('seed có đúng trạng thái tân thủ theo thiết kế', () => {
  const seed = buildCanonicalNewAccountData({ now: 1790000000000 });
  assert.equal(seed.gold, 500);
  assert.equal(seed.gems, 50);
  assert.equal(seed.stamina, 20);
  assert.equal(seed.playerLevel, 1);
  assert.equal(seed.selectedHeroId, 'alex');
  assert.equal(seed.starterWeaponGranted, false);
  assert.equal(seed.gearBag.length, 0);
  for (const slot of ['weapon', 'necklace', 'ring', 'armor', 'helmet', 'boots']) {
    assert.equal(seed.equippedGear[slot], null, `slot ${slot} phải trống`);
  }
  assert.ok(Object.values(seed.heroStars).every((v) => v === 0), 'mọi hero phải 0 sao');
  assert.ok(Object.values(seed.heroShards).every((v) => v === 0), 'không có mảnh hero');
  assert.equal(seed.beginnerJourney.currentStep, 'N01');
  assert.equal(seed.beginnerJourney.startedAt, 1790000000000, 'tutorial phải đang mở');
  assert.deepEqual(seed.beginnerJourney.completedSteps, []);
  // Cờ phiên bản phải có, nếu thiếu client sẽ chạy migration cấp tài nguyên.
  assert.equal(seed.maxedAllVersion, 1);
  assert.equal(seed.wikiCharactersVersion, 2);
});

test('seed không có tài sản nào ngoài phần khởi đầu', () => {
  const seed = buildCanonicalNewAccountData();
  assert.equal(seed.salvageMaterials, 0);
  assert.deepEqual(seed.talents, { might: 0, vitality: 0, alacrity: 0, healer: 0, greed: 0, valkyrie_favor: 0 });
  assert.deepEqual(seed.runes, { rune_flame: 0, rune_frost: 0, rune_thunder: 0, rune_valkyrie: 0 });
  assert.deepEqual(seed.bestRooms, {});
  assert.deepEqual(seed.winsByChapter, {});
  assert.deepEqual(seed.unlockedSkins, { artemis_default: true });
  assert.equal(seed.guild, null);
  assert.equal(seed.garden, null);
  assert.equal(seed.plinko, null);
});

test('roster hero trong seed khớp danh sách hero của client', () => {
  // Nguồn chuẩn là heroStars mặc định trong SaveState — chính là roster mà
  // client dùng để tính sao. Nếu client thêm hero mới mà seed chưa cập nhật,
  // test này fail ngay (không cần regex trên object literal HEROES).
  const defaults = clientDefaults();
  assert.deepEqual(Object.keys(buildCanonicalNewAccountData().heroStars), Object.keys(defaults.heroStars));
  for (const id of HERO_ROSTER) {
    assert.ok(id in defaults.heroStars, `thiếu hero ${id} trong defaults`);
  }
});

test('seed ổn định: sanitize lại cho cùng dữ liệu', () => {
  const seed = buildCanonicalNewAccountData();
  assert.deepEqual(sanitizeSave(seed).data, seed);
});

// ---------------------------------------------------------------------------
// 2. Đăng ký gieo seed
// ---------------------------------------------------------------------------

test('đăng ký tạo player có initVersion và save chuẩn revision 1', async () => {
  const mock = mockDb();
  const route = registerRoute(mock);
  const response = await route.POST(new Request('http://offline.invalid/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'qa_artemis', password: 'matkhau-du-dai' }),
  }));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);

  const player = mock.stores.players[0];
  assert.equal(player.initVersion, NEW_ACCOUNT_INIT_VERSION);
  assert.equal(player.usernameLower, 'qa_artemis');

  const save = mock.stores.saves[0];
  assert.equal(save.playerId, player._id);
  assert.equal(save.revision, 1);
  assert.equal(save.data.gold, 500);
  assert.equal(save.data.gems, 50);
  assert.equal(save.data.beginnerJourney.currentStep, 'N01');
  assert.ok(save.data.beginnerJourney.startedAt > 0);
});

test('đăng ký không ghi mật khẩu thô', async () => {
  const mock = mockDb();
  const route = registerRoute(mock);
  await route.POST(new Request('http://offline.invalid/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'qa_artemis', password: 'matkhau-du-dai' }),
  }));
  assert.equal(mock.stores.players[0].passwordHash, 'hashed:matkhau-du-dai');
  assert.equal(JSON.stringify(mock.stores.players).includes('"matkhau-du-dai"'), false);
});

// ---------------------------------------------------------------------------
// 3. GET khôi phục seed
// ---------------------------------------------------------------------------

test('tài khoản đã đánh dấu mà mất save -> GET khôi phục seed, không trả hasSave=false', async () => {
  const mock = mockDb();
  const route = saveRoute(mock, playerDoc({ initVersion: NEW_ACCOUNT_INIT_VERSION }));
  const response = await route.GET({});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.hasSave, true, 'phải khôi phục thay vì coi là tài khoản mới');
  assert.equal(body.revision, 1);
  assert.equal(body.playerId, 'player-1');
  assert.equal(body.data.gold, 500);
  assert.equal(body.data.beginnerJourney.startedAt > 0, true);
  // Và bản ghi đã được ghi lại thật vào DB.
  assert.equal(mock.stores.saves.length, 1);
});

test('tài khoản cũ (không marker) mà thiếu save -> vẫn hasSave=false, không ghi gì', async () => {
  const mock = mockDb();
  const route = saveRoute(mock, playerDoc());
  const body = await (await route.GET({})).json();
  assert.equal(body.hasSave, false);
  assert.equal(body.data, null);
  assert.equal(mock.stores.saves.length, 0);
});

test('GET hai lần liên tiếp trên tài khoản mất save không tạo bản ghi trùng', async () => {
  const mock = mockDb();
  const route = saveRoute(mock, playerDoc({ initVersion: NEW_ACCOUNT_INIT_VERSION }));
  await route.GET({});
  await route.GET({});
  assert.equal(mock.stores.saves.length, 1);
});

// ---------------------------------------------------------------------------
// 4. PUT revision 0 bị chặn
// ---------------------------------------------------------------------------

test('tài khoản đã đánh dấu không được tự khai snapshot ở lần lưu đầu', async () => {
  const mock = mockDb();
  const route = saveRoute(mock, playerDoc({ initVersion: NEW_ACCOUNT_INIT_VERSION }));
  const response = await route.PUT(new Request('http://offline.invalid/api/save', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: { gold: 1e12, gems: 1e12 }, revision: 0 }),
  }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, 'SAVE_MISSING');
  assert.equal(mock.stores.saves.length, 0, 'không được ghi snapshot client tự khai');
});

test('tài khoản cũ giữ nguyên đường lưu đầu tiên (không hồi quy)', async () => {
  const mock = mockDb();
  const route = saveRoute(mock, playerDoc());
  const response = await route.PUT(new Request('http://offline.invalid/api/save', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: { gold: 500, gems: 50, beginnerJourney: { startedAt: 0 } }, revision: 0 }),
  }));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.equal(mock.stores.saves[0].revision, 1);
});

// ---------------------------------------------------------------------------
// 5. Client cũ không xoá dữ liệu hệ mới
// ---------------------------------------------------------------------------

test('client cũ (không gửi field) không xoá vườn/bang/plinko đang có', async () => {
  const mock = mockDb();
  const seeded = buildCanonicalNewAccountSave({ playerId: 'player-1', username: 'qa_artemis' });
  seeded.data.garden = { plots: [], seeds: { sprout: 3 }, produce: { leaf: 4, petal: 0, dew: 0, essence: 0 }, totalHarvest: 4, weekTask: { done: 1, target: 10, claimed: false }, raidsRepelled: 0 };
  seeded.data.guild = { name: 'Bang Cũ', level: 1, exp: 0, notice: '', createdAt: 1, members: [], boss: { week: 1, hp: 0, maxHp: 100, defeated: false, attempts: 0 }, expedition: { floor: 0, best: 0 }, log: [] };
  seeded.data.plinko = { balls: 5, history: [], totalWon: 1000, bestMult: 3.2, bet: 200 };
  seeded.data.modeBest = { endless: 21 };
  mock.stores.saves.push(clone(seeded));

  const route = saveRoute(mock, playerDoc({ initVersion: NEW_ACCOUNT_INIT_VERSION }));
  // Payload kiểu client cũ: không có 5 field mới.
  const legacyPayload = { gold: 500, gems: 50, beginnerJourney: { startedAt: 1, currentStep: 'N01' } };
  const response = await route.PUT(new Request('http://offline.invalid/api/save', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: legacyPayload, revision: 1 }),
  }));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));

  const saved = mock.stores.saves[0].data;
  assert.equal(saved.garden.seeds.sprout, 3);
  assert.equal(saved.guild.name, 'Bang Cũ');
  assert.equal(saved.plinko.balls, 5);
  assert.equal(saved.modeBest.endless, 21);
});

test('client mới gửi null rõ ràng thì xoá được (không bị giữ lại)', async () => {
  const mock = mockDb();
  const seeded = buildCanonicalNewAccountSave({ playerId: 'player-1', username: 'qa_artemis' });
  seeded.data.garden = { plots: [], seeds: {}, produce: { leaf: 0, petal: 0, dew: 0, essence: 0 }, totalHarvest: 9, weekTask: { done: 0, target: 10, claimed: false }, raidsRepelled: 0 };
  mock.stores.saves.push(clone(seeded));

  const route = saveRoute(mock, playerDoc({ initVersion: NEW_ACCOUNT_INIT_VERSION }));
  const response = await route.PUT(new Request('http://offline.invalid/api/save', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      data: { gold: 500, gems: 50, garden: null, guild: null, plinko: null, modeBest: {}, beginnerJourney: { startedAt: 1 } },
      revision: 1,
    }),
  }));
  assert.equal(response.status, 200);
  const saved = mock.stores.saves[0].data;
  assert.equal(saved.garden, null);
  assert.equal(saved.guild, null);
  assert.equal(saved.plinko, null);
});

// ---------------------------------------------------------------------------
// 6. Đăng ký vẫn thành công khi bước ghi save lỗi
// ---------------------------------------------------------------------------

test('ghi save lúc đăng ký lỗi -> player vẫn được tạo và GET khôi phục được', async () => {
  const mock = mockDb();
  mock.saves.failNextInsert = true;

  const route = registerRoute(mock);
  const response = await route.POST(new Request('http://offline.invalid/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'qa_artemis', password: 'matkhau-du-dai' }),
  }));
  assert.equal(response.status, 201, 'lỗi ghi save không được biến đăng ký thành 500');
  assert.equal(mock.stores.players.length, 1);
  assert.equal(mock.stores.saves.length, 0, 'lần ghi đầu đã lỗi');

  // GET trên chính tài khoản đó phải khôi phục seed.
  const saveHandler = saveRoute(mock, { ...mock.stores.players[0] });
  const body = await (await saveHandler.GET({})).json();
  assert.equal(body.hasSave, true);
  assert.equal(body.data.gold, 500);
  assert.equal(body.revision, 1);
});
