import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8');

test('save domain không phụ thuộc HTTP, DB, filesystem hay global environment', () => {
  const source = read('lib/save/policy.js');
  const imports = [...source.matchAll(/^import\s+.*?from\s+['"]([^'"]+)['"]/gm)].map(match => match[1]);
  assert.deepEqual(imports.sort(), ['../economy.js', '../economyLedger.js', '../privilegeCards.js', './campaignCheckpoint.js']);
  assert.doesNotMatch(read('lib/save/campaignCheckpoint.js'), /\b(?:process\.env|Date\.now|fetch|Request|Response)\b/);
  assert.doesNotMatch(source, /\b(?:process\.env|Date\.now|fetch|Request|Response)\b/);
});

test('save route không truy vấn Mongo trực tiếp và validate trước commit', () => {
  const source = read('api/save.js');
  assert.match(source, /createSaveRepository\(db\.collection\(COLLECTIONS\.saves\)\)/);
  assert.doesNotMatch(source, /saves\.(?:findOne|insertOne|updateOne|deleteOne|deleteMany)\s*\(/);
  const validation = source.indexOf('const transition = validateSaveTransition');
  const rejection = source.indexOf('if (!transition.ok)', validation);
  const commit = source.indexOf('await saves.commit');
  assert.ok(validation >= 0 && rejection > validation && commit > rejection);
  assert.doesNotMatch(source, /\b(?:validateEconomyDelta|validateEconomyBudget|validateSeasonDelta|normalizeVipPasses)\(/);
});

test('save repository nhận collection, không tự kết nối DB hoặc trả HTTP response', () => {
  const source = read('lib/save/repository.js');
  assert.match(source, /export function createSaveRepository\(saves\)/);
  assert.doesNotMatch(source, /\b(?:getMongoDb|MongoClient|process\.env)\b|\b(?:Request|Response)\s*\(/);
  assert.match(source, /upsert: false/);
});
