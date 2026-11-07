// Kiểm chứng trên MONGODB THẬT (opt-in qua biến môi trường).
//
// Vì sao cần: CAS/unique index mới chỉ được chứng minh trên DB bộ nhớ — đó là mô
// phỏng, không phải bằng chứng về hành vi Mongo thật (khóa, upsert, lỗi 11000,
// TTL). Test này chạy đúng những hành vi đó trên server thật.
//
// CÁCH DÙNG (không bao giờ dùng URI production):
//   TEST_MONGODB_URI=mongodb://127.0.0.1:27017 node --test tests/mongo-real.test.mjs
//   TEST_MONGODB_URI="mongodb+srv://user:pass@cluster/testdb" node --test tests/mongo-real.test.mjs
//
// An toàn:
//   • Chỉ dùng database riêng, tên có tiền tố `artemis_probe_` + timestamp.
//   • Chỉ xoá đúng database do chính nó tạo (dropDatabase ở cuối).
//   • Từ chối chạy nếu URI trỏ tới database tên `artemis`, `prod`, `production`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { ensureIndexes, REQUIRED_INDEXES, COLLECTIONS } from '../lib/mongo.js';

const URI = process.env.TEST_MONGODB_URI;
const skip = URI ? false : 'cần TEST_MONGODB_URI (Mongo thật) — xem docs/audit/artemis-new-player/17-MONGO-REAL.md';

const DB_NAME = `artemis_probe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const FORBIDDEN = /(^|\/)(artemis|prod|production)$/i;

function guard(uri) {
  const afterHost = uri.replace(/^mongodb(\+srv)?:\/\//, '').split('/')[1] || '';
  const dbName = afterHost.split('?')[0];
  if (FORBIDDEN.test(uri) || (dbName && FORBIDDEN.test(dbName))) {
    throw new Error(`Từ chối: URI trỏ tới database production/bảo vệ ("${dbName}"). Dùng database tạm.`);
  }
}

function connect() {
  guard(URI);
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 8000 });
  return client;
}

test('Mongo thật: ensureIndexes tạo đúng chỉ số và idempotent', { skip }, async () => {
  const client = connect();
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    await ensureIndexes(db);
    await ensureIndexes(db);   // chạy lại: phải không ném lỗi

    for (const spec of REQUIRED_INDEXES) {
      const idx = await db.collection(spec.collection).indexes();
      const hit = idx.find((i) => i.name === spec.options.name);
      assert.ok(hit, `thiếu chỉ số ${spec.options.name} trên ${spec.collection}`);
      assert.equal(hit.unique === true, spec.options.unique === true, `unique sai ở ${spec.options.name}`);
      if (spec.options.expireAfterSeconds !== undefined) {
        assert.equal(hit.expireAfterSeconds, spec.options.expireAfterSeconds, `TTL sai ở ${spec.options.name}`);
      }
    }
  } finally {
    await client.db(DB_NAME).dropDatabase();
    await client.close();
  }
});

test('Mongo thật: unique playerId chặn save trùng (mã lỗi 11000)', { skip }, async () => {
  const client = connect();
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    await ensureIndexes(db);
    const saves = db.collection(COLLECTIONS.saves);

    await saves.insertOne({ playerId: 'p1', data: { gold: 500 }, revision: 1 });
    await assert.rejects(
      () => saves.insertOne({ playerId: 'p1', data: { gold: 999 }, revision: 1 }),
      (error) => { assert.equal(error.code, 11000, `phải 11000, nhận ${error.code}`); return true; },
    );
    const count = await saves.countDocuments({ playerId: 'p1' });
    assert.equal(count, 1, 'chỉ được có 1 save');
  } finally {
    await client.db(DB_NAME).dropDatabase();
    await client.close();
  }
});

test('Mongo thật: CAS hai lần ghi song song cùng revision -> đúng MỘT thắng', { skip }, async () => {
  const client = connect();
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    await ensureIndexes(db);
    const saves = db.collection(COLLECTIONS.saves);

    await saves.insertOne({ playerId: 'p2', data: { gold: 500 }, revision: 1 });

    // Đúng điều kiện CAS của api/save.js: { playerId, revision } -> $set revision+1.
    const attempt = (gold) => saves.updateOne(
      { playerId: 'p2', revision: 1 },
      { $set: { data: { gold }, revision: 2 } },
    );
    const [a, b] = await Promise.all([attempt(1000), attempt(2000)]);

    const winners = [a, b].filter((r) => r.matchedCount === 1).length;
    assert.equal(winners, 1, `phải đúng 1 lần ghi thắng, nhận ${winners}`);

    const doc = await saves.findOne({ playerId: 'p2' });
    assert.equal(doc.revision, 2);
    assert.ok([1000, 2000].includes(doc.data.gold), 'dữ liệu phải thuộc về lần ghi thắng');
  } finally {
    await client.db(DB_NAME).dropDatabase();
    await client.close();
  }
});

test('Mongo thật: legacy document không có `revision` vẫn CAS đúng', { skip }, async () => {
  const client = connect();
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    await ensureIndexes(db);
    const saves = db.collection(COLLECTIONS.saves);

    await saves.insertOne({ playerId: 'p3', data: { gold: 500 } });   // không có revision

    // api/save.js dùng: revision: existing.revision === undefined ? { $exists: false } : existing.revision
    const r1 = await saves.updateOne(
      { playerId: 'p3', revision: { $exists: false } },
      { $set: { data: { gold: 900 }, revision: 2 } },
    );
    assert.equal(r1.matchedCount, 1, 'phải khớp document legacy');

    const r2 = await saves.updateOne(
      { playerId: 'p3', revision: { $exists: false } },
      { $set: { data: { gold: 9999 }, revision: 2 } },
    );
    assert.equal(r2.matchedCount, 0, 'lần thứ hai không được khớp (đã có revision)');
  } finally {
    await client.db(DB_NAME).dropDatabase();
    await client.close();
  }
});

test('Mongo thật: TTL xoá phiên bị thu hồi sau khi hết hạn', { skip }, async () => {
  const client = connect();
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    await ensureIndexes(db);
    const col = db.collection(COLLECTIONS.revokedSessions);

    await col.insertOne({ _id: 'jti-old', expiresAt: new Date(Date.now() - 60_000), revokedAt: new Date() });
    await col.insertOne({ _id: 'jti-live', expiresAt: new Date(Date.now() + 3600_000), revokedAt: new Date() });

    // Mongo chạy TTL monitor mỗi ~60s; chờ tối đa 90s nhưng thoát sớm khi đã xoá.
    const deadline = Date.now() + 90_000;
    let still = await col.countDocuments();
    while (still > 1 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      still = await col.countDocuments();
    }
    assert.equal(still, 1, `phải còn 1 bản ghi chưa hết hạn, nhận ${still}`);
    assert.equal(await col.countDocuments({ _id: 'jti-live' }), 1, 'bản ghi còn hạn không được bị xoá');
  } finally {
    await client.db(DB_NAME).dropDatabase();
    await client.close();
  }
});

test('guard: từ chối URI trỏ tới database production', () => {
  assert.throws(() => guard('mongodb://127.0.0.1:27017/artemis'));
  assert.throws(() => guard('mongodb+srv://u:p@c.mongodb.net/production'));
  assert.doesNotThrow(() => guard('mongodb://127.0.0.1:27017/scratch_db'));
});
