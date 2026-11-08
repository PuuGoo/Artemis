import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMemoryDb, resetMemoryDb } from '../../lib/mongoMemory.js';

const moduleUrl = new URL('../../lib/save/repository.js', import.meta.url);
async function repository() {
  assert.ok(fs.existsSync(moduleUrl), 'Cần repository giữ toàn bộ projection/CAS của save');
  const { createSaveRepository } = await import(moduleUrl);
  resetMemoryDb();
  const saves = createMemoryDb().collection('saves');
  return { repo: createSaveRepository(saves), saves };
}

test('repository CAS chỉ cho một request thắng, không ghi đè snapshot mới hơn', async () => {
  const { repo, saves } = await repository();
  await saves.insertOne({ playerId: 'A', revision: 1, data: { gold: 500 } });
  const existing = await repo.readForValidation('A');
  const results = await Promise.all([501, 502].map(gold => repo.commit(existing, {
    playerId: 'A', revision: 2, data: { gold }, updatedAt: new Date(1000),
  })));
  assert.deepEqual(results.sort(), [false, true]);
  const doc = await repo.find('A');
  assert.equal(doc.revision, 2);
  assert.ok([501, 502].includes(doc.data.gold));
  assert.equal(await repo.find('B'), null);
});

test('repository hỗ trợ revision legacy, first insert race và truyền lỗi DB thật', async () => {
  const { repo, saves } = await repository();
  await saves.insertOne({ playerId: 'legacy', data: { gold: 100 } });
  const legacy = await repo.readForValidation('legacy');
  assert.equal(await repo.commit(legacy, { playerId: 'legacy', revision: 2, data: { gold: 101 } }), true);
  assert.equal(await repo.commit(legacy, { playerId: 'legacy', revision: 2, data: { gold: 999 } }), false);
  const snapshot = { playerId: 'new', revision: 1, data: { gold: 500 }, updatedAt: new Date(1000) };
  const results = await Promise.all([repo.commit(null, snapshot), repo.commit(null, snapshot)]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.deepEqual((await repo.find('new')).createdAt, snapshot.updatedAt);
  const { createSaveRepository } = await import(moduleUrl);
  const failure = new Error('DB unavailable');
  const broken = createSaveRepository({ async insertOne() { throw failure; } });
  await assert.rejects(broken.commit(null, snapshot), error => error === failure);
});

test('repository khôi phục seed có idempotency và đọc đủ field cho policy', async () => {
  const { repo } = await repository();
  const player = { username: 'qa_restore' };
  const docs = await Promise.all([repo.restoreCanonical(player, 'A'), repo.restoreCanonical(player, 'A')]);
  assert.equal(docs[0].data.gold, 500);
  assert.equal(docs[1].revision, 1);
  const existing = await repo.readForValidation('A');
  for (const key of ['gold', 'gems', 'vipCoins', 'aurocite', 'vipPasses', 'runes', 'runeStones', 'runeIntroClaimed', 'runeMythicEnchant', 'lifetimeStats', 'season', 'gameMode', 'modeBest', 'guild', 'garden', 'plinko']) {
    assert.ok(key in existing.data, `projection thiếu ${key}`);
  }
  assert.ok(existing.ledger);
  const conflict = await repo.readConflict('A');
  assert.equal(conflict.revision, 1);
  assert.deepEqual(conflict.data, docs[0].data);
});
