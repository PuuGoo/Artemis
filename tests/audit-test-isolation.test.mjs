import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['integration.test.mjs', 'admin.test.mjs']) {
  test(`${file}: không đọc credentials .env hoặc xóa rate-limit`, () => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /readFileSync\([^\n]*\.env/);
    assert.doesNotMatch(source, /deleteMany\s*\(/);
  });
  test(`${file}: chỉ chạy khi operator xác nhận môi trường cô lập`, () => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /ARTEMIS_ISOLATED_TESTS/);
    assert.ok(source.indexOf('ARTEMIS_ISOLATED_TESTS') < source.indexOf('const BASE'));
  });
}
