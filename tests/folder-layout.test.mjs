import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const moved = [
  [['lib', 'saveSchema.js'], 'lib/save/schema.js'],
  [['lib', 'initialState.js'], 'lib/save/initialState.js'],
  [['lib', 'savePolicy.js'], 'lib/save/policy.js'],
  [['lib', 'saveRepository.js'], 'lib/save/repository.js'],
  [['public', 'arena-renderer.js'], 'public/js/game/rendering/arena-renderer.js'],
];

test('module save/rendering có thư mục sở hữu rõ ràng và không giữ implementation cũ', () => {
  for (const [oldParts, destination] of moved) {
    assert.ok(fs.existsSync(new URL(destination, root)), `thiếu ${destination}`);
    assert.equal(fs.existsSync(new URL(oldParts.join('/'), root)), false, `còn bản cũ ${oldParts.join('/')}`);
  }
});

test('các script local khai báo trong HTML đều trỏ tới file tồn tại sau khi chuyển thư mục', () => {
  for (const file of ['public/index.html', 'public/admin.html']) {
    const html = fs.readFileSync(new URL(file, root), 'utf8');
    for (const match of html.matchAll(/<script\b[^>]*\bsrc=["'](\/[^"']+)["'][^>]*>/g)) {
      assert.ok(fs.existsSync(new URL('public' + match[1], root)), `${file}: thiếu ${match[1]}`);
    }
  }
});
