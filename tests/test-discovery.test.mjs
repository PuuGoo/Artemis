import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function discover() {
  const file = new URL('../tools/run-tests.mjs', import.meta.url);
  assert.ok(fs.existsSync(file), 'Cần runner tìm test trong thư mục con');
  return (await import(file)).discoverTestFiles;
}

test('test discovery giữ test cũ và tìm test lồng nhau, không execute lúc liệt kê', async t => {
  const discoverTestFiles = await discover();
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'artemis-discovery-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = ['old.test.mjs', 'save/policy.test.mjs', 'rendering/deep/arena.test.mjs',
    'audit-live.mjs', 'fixtures/example.test.mjs', 'node_modules/vendor.test.mjs'];
  for (const file of files) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'throw Error("không được execute lúc discovery");');
  }
  assert.deepEqual(discoverTestFiles(root).map(file => path.relative(root, file).replaceAll('\\', '/')), [
    'old.test.mjs', 'rendering/deep/arena.test.mjs', 'save/policy.test.mjs',
  ]);
});

test('thư mục không có test trả danh sách rỗng, không fallback sang auto-discovery Node', async t => {
  const discoverTestFiles = await discover();
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'artemis-empty-tests-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(discoverTestFiles(root), []);
});
