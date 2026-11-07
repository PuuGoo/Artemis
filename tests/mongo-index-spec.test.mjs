// Đặc tả chỉ số Mongo — khoá được KHÔNG CẦN server thật.
//
// Vì sao quan trọng: CAS (compare-and-set) và chống trùng tài khoản đều dựa vào
// index. Nếu ai sửa `ensureIndexes` làm mất `unique` hoặc đổi tên, mọi thứ vẫn
// "chạy" trên DB bộ nhớ nhưng production sẽ cho phép 2 save cùng playerId.
//
// Test này gọi ensureIndexes() với một db GIẢ ghi lại lời gọi, nên kiểm được đúng
// ĐẶC TẢ (field + options + name) mà không cần kết nối Mongo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureIndexes, REQUIRED_INDEXES, COLLECTIONS } from '../lib/mongo.js';

function recordingDb() {
  const calls = [];
  return {
    calls,
    collection(name) {
      return {
        createIndex(keys, options) {
          calls.push({ collection: name, keys, options });
          return Promise.resolve(options?.name || 'idx');
        },
      };
    },
  };
}

test('ensureIndexes tạo ĐÚNG bộ chỉ số bắt buộc', async () => {
  const db = recordingDb();
  await ensureIndexes(db);

  assert.equal(db.calls.length, 5, 'phải tạo 5 chỉ số');
  const byName = Object.fromEntries(db.calls.map((c) => [c.options?.name, c]));

  // 1. username duy nhất (không cho 2 tài khoản cùng tên).
  assert.deepEqual(byName.uniq_username.keys, { usernameLower: 1 });
  assert.equal(byName.uniq_username.options.unique, true);
  assert.equal(byName.uniq_username.collection, COLLECTIONS.players);

  // 2. mỗi player chỉ một save — nền tảng của CAS và chống ghi đè.
  assert.deepEqual(byName.uniq_player.keys, { playerId: 1 });
  assert.equal(byName.uniq_player.options.unique, true);
  assert.equal(byName.uniq_player.collection, COLLECTIONS.saves);

  // 3. rate-limit key duy nhất.
  assert.deepEqual(byName.uniq_attempt_key.keys, { key: 1 });
  assert.equal(byName.uniq_attempt_key.options.unique, true);

  // 4. TTL dọn bản ghi đăng nhập sai.
  assert.deepEqual(byName.ttl_attempts.keys, { lastAt: 1 });
  assert.equal(byName.ttl_attempts.options.expireAfterSeconds, 3600);

  // 5. TTL dọn phiên bị thu hồi (đúng bằng hạn token).
  assert.deepEqual(byName.ttl_revoked.keys, { expiresAt: 1 });
  assert.equal(byName.ttl_revoked.options.expireAfterSeconds, 0);
  assert.equal(byName.ttl_revoked.collection, COLLECTIONS.revokedSessions);
});

test('REQUIRED_INDEXES khớp với cái ensureIndexes thực sự tạo', async () => {
  const db = recordingDb();
  await ensureIndexes(db);
  assert.equal(db.calls.length, REQUIRED_INDEXES.length);
  for (const spec of REQUIRED_INDEXES) {
    const hit = db.calls.find((c) => c.options?.name === spec.options.name);
    assert.ok(hit, `thiếu chỉ số ${spec.options.name}`);
    assert.deepEqual(hit.keys, spec.keys, `sai key của ${spec.options.name}`);
    assert.deepEqual(hit.options, spec.options, `sai options của ${spec.options.name}`);
    assert.equal(hit.collection, spec.collection, `sai collection của ${spec.options.name}`);
  }
});

test('lỗi "index đã tồn tại" (85/86) được bỏ qua — deploy lại không sập', async () => {
  const db = {
    collection: () => ({
      createIndex: (keys, options) => {
        if (options.name === 'uniq_username') {
          const e = new Error('Index already exists'); e.code = 85; return Promise.reject(e);
        }
        if (options.name === 'uniq_player') {
          const e = new Error('Index options conflict'); e.code = 86; return Promise.reject(e);
        }
        return Promise.resolve(options.name);
      },
    }),
  };
  await assert.doesNotReject(() => ensureIndexes(db));
});

test('lỗi index KHÁC không bị nuốt (fail-closed)', async () => {
  const db = {
    collection: () => ({
      createIndex: () => {
        const e = new Error('not authorized on artemis to execute command');
        e.code = 13;
        return Promise.reject(e);
      },
    }),
  };
  await assert.rejects(() => ensureIndexes(db), /not authorized/);
});
