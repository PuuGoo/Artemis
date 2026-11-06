import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../lib/mongo.js', import.meta.url), 'utf8');
const indexFunction = source.slice(source.indexOf('async function ensureIndexes(db)'));
function runIndexes(code) {
  const error = Object.assign(new Error('isolated index creation failed'), {code});
  const createIndex = async () => { if (code) throw error; return 'index'; };
  const context = {COLLECTIONS:{players:'players',saves:'saves',loginAttempts:'login_attempts'}};
  const fn = runInNewContext(indexFunction + '; ensureIndexes;', context);
  return fn({collection:()=>({createIndex})});
}
for (const code of [13, 91, 11000]) {
  test(`Mongo index failure ${code} không được nuốt`, async()=>{
    await assert.rejects(runIndexes(code), e=>e.code===code);
  });
}
test('Index tạo thành công không bị chặn', async()=>{await runIndexes(0);});
