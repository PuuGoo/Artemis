// End-to-end qua HTTP THẬT: lỗ hổng mint bằng snapshot tự khai đã bị chặn.
//
// Trước bản vá: đăng ký xong, PUT /api/save với gold tăng +500.000 mỗi lần → lọt.
// Nay ngân sách kinh tế nạp theo đồng hồ server nên chỉ mint được theo thời gian.
//
// Dùng DB bộ nhớ + NODE_ENV=test (không phải production, không chạm dữ liệu thật).
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');

const { POST: register } = await import('../api/auth/register.js');
const { GET: getSave, PUT: putSave } = await import('../api/save.js');
const { getMongoDb, COLLECTIONS } = await import('../lib/mongo.js');

const ORIGIN = 'https://artemis.test';

function req(method, path, cookie, body) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function newPlayer() {
  const username = `eco_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const res = await register(req('POST', '/api/auth/register', null, {
    username, password: 'matkhau-rat-dai-2026',
  }));
  assert.equal(res.status, 201, `đăng ký phải 201, nhận ${res.status}`);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  return { cookie, username };
}

test('save mới có ledger và seed đúng 500 vàng / 50 đá', async () => {
  const { cookie } = await newPlayer();
  const res = await getSave(req('GET', '/api/save', cookie));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.gold, 500);
  assert.equal(body.data.gems, 50);

  const db = await getMongoDb();
  // DB bộ nhớ không hỗ trợ truy vấn lồng -> lọc theo playerId (có index unique).
  const doc = await db.collection(COLLECTIONS.saves).findOne({ playerId: body.playerId });
  assert.ok(doc, 'phải có bản ghi save');
  assert.ok(doc.ledger && Number.isFinite(doc.ledger.gold), 'save phải có ledger ngân sách');
  assert.ok(doc.ledger.gold > 0 && doc.ledger.gems > 0, 'seed phải có dự trữ ban đầu');
});

test('P0: PUT tự khai +500.000 vàng bị 422, DB không đổi', async () => {
  const { cookie } = await newPlayer();
  const cur = await (await getSave(req('GET', '/api/save', cookie))).json();
  const data = { ...cur.data, gold: cur.data.gold + 500_000 };

  const res = await putSave(req('PUT', '/api/save', cookie, {
    revision: cur.revision, data,
  }));
  assert.equal(res.status, 422, 'phải bị chặn');
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.code, /ECONOMY_BUDGET|ECONOMY_INVALID/);

  const after = await (await getSave(req('GET', '/api/save', cookie))).json();
  assert.equal(after.data.gold, cur.data.gold, 'vàng trong DB phải giữ nguyên');
  assert.equal(after.revision, cur.revision, 'revision không được tăng');
});

test('P0: bốn lần PUT liên tiếp KHÔNG mint được 2 triệu vàng', async () => {
  const { cookie } = await newPlayer();
  let cur = await (await getSave(req('GET', '/api/save', cookie))).json();
  let minted = 0;

  for (let i = 0; i < 4; i++) {
    const target = cur.data.gold + 500_000;
    const res = await putSave(req('PUT', '/api/save', cookie, {
      revision: cur.revision,
      data: { ...cur.data, gold: target },
    }));
    if (res.status === 200) {
      minted += 500_000;
      cur = await (await getSave(req('GET', '/api/save', cookie))).json();
    } else {
      assert.equal(res.status, 422);
    }
  }
  assert.equal(minted, 0, 'không lần nào lọt');
  assert.ok(cur.data.gold < 30_000, `vàng vẫn ở mức tân thủ, nhận ${cur.data.gold}`);
});

test('tiêu vàng vẫn được (không chặn oan người chơi thật)', async () => {
  const { cookie } = await newPlayer();
  const cur = await (await getSave(req('GET', '/api/save', cookie))).json();
  const res = await putSave(req('PUT', '/api/save', cookie, {
    revision: cur.revision,
    data: { ...cur.data, gold: 0 },
  }));
  assert.equal(res.status, 200, 'tiêu sạch vàng là hợp lệ');
  const after = await (await getSave(req('GET', '/api/save', cookie))).json();
  assert.equal(after.data.gold, 0);
});

test('tăng nhỏ trong ngân sách vẫn qua', async () => {
  const { cookie } = await newPlayer();
  const cur = await (await getSave(req('GET', '/api/save', cookie))).json();
  const res = await putSave(req('PUT', '/api/save', cookie, {
    revision: cur.revision,
    data: { ...cur.data, gold: cur.data.gold + 2_000 },
  }));
  assert.equal(res.status, 200, 'thu nhập bình thường không được chặn');
  const after = await (await getSave(req('GET', '/api/save', cookie))).json();
  assert.equal(after.data.gold, 2_500);
});

test('sau khi tiêu hết ngân sách, lần lưu sau bị chặn cho tới khi đủ thời gian', async () => {
  const { cookie } = await newPlayer();
  let cur = await (await getSave(req('GET', '/api/save', cookie))).json();

  // Tiêu toàn bộ hạn mức một lần: +27.000 vàng.
  const first = await putSave(req('PUT', '/api/save', cookie, {
    revision: cur.revision,
    data: { ...cur.data, gold: 27_500 },
  }));
  assert.equal(first.status, 200);
  cur = await (await getSave(req('GET', '/api/save', cookie))).json();

  // Ngay sau đó mint thêm 27.000 -> phải bị chặn.
  const second = await putSave(req('PUT', '/api/save', cookie, {
    revision: cur.revision,
    data: { ...cur.data, gold: 54_500 },
  }));
  assert.equal(second.status, 422, 'không thể mint thêm ngay lập tức');
  assert.equal((await second.json()).code, 'ECONOMY_BUDGET_GOLD');
});
