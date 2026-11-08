import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const moduleUrl = new URL('../tools/check-source.mjs', import.meta.url);
async function checker() {
  assert.ok(fs.existsSync(moduleUrl), 'Cần syntax gate bao phủ module và script HTML');
  return import(moduleUrl);
}

function project(t, files) {
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'artemis-check-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

test('syntax gate tìm file đệ quy, không execute module và bỏ qua asset/dependency', async t => {
  const { checkProject } = await checker();
  const root = project(t, {
    'package.json': '{"type":"module"}',
    'api/nested/route.js': 'export function GET() { throw Error("không được execute"); }',
    'lib/policy.js': 'throw Error("không được execute"); export const value = 1;',
    'public/runtime.js': 'throw Error("không được execute");',
    'tools/tool.mjs': 'export const value = 1;',
    'tests/example.test.mjs': 'import test from "node:test";',
    'node_modules/broken.js': 'const =',
    'public/assets/broken.js': 'const =',
  });
  const result = checkProject(root);
  assert.equal(result.files, 5);
  assert.equal(result.inlineScripts, 0);
  assert.deepEqual(result.failures, []);
});

test('syntax gate bắt lỗi classic browser JS và script nhúng, giữ tên file + dòng', async t => {
  const { checkProject } = await checker();
  const root = project(t, {
    'package.json': '{"type":"module"}',
    'lib/broken.js': 'export const = ;',
    'public/broken.js': 'await Promise.resolve();',
    'public/index.html': '<html>\n<body>\n<script>\nconst = ;\n</script></body></html>',
  });
  const result = checkProject(root);
  assert.equal(result.files, 3);
  assert.equal(result.inlineScripts, 1);
  assert.equal(result.failures.length, 3);
  assert.ok(result.failures.some(f => f.file === 'lib/broken.js'));
  assert.ok(result.failures.some(f => f.file === 'public/broken.js'));
  const inline = result.failures.find(f => f.file === 'public/index.html');
  assert.match(inline.message, /index\.html:4/);
});

test('syntax gate hiểu script src, JSON và inline module, không kiểm dữ liệu như JS', async t => {
  const { checkProject } = await checker();
  const root = project(t, {
    'public/index.html': [
      '<script src="https://example.invalid/lib.js"></script>',
      '<script type="application/json">{"not javascript": true}</script>',
      '<script type="module">export const value = await Promise.resolve(1);</script>',
      '<script>const value = 2;</script>',
    ].join('\n'),
  });
  const result = checkProject(root);
  assert.equal(result.inlineScripts, 2);
  assert.deepEqual(result.failures, []);
});
