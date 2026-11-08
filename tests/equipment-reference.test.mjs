import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('hai trang dùng thanh điều hướng cùng biểu tượng, đúng tab và giữ mục phụ', () => {
  const ctx = vm.createContext({});
  vm.runInContext(read('public/js/game/runes/rune-workspace.js'), ctx);
  for (const active of ['gear', 'characters']) {
    const markup = ctx.ArtemisRuneWorkspace.navigationMarkup(active);
    assert.equal((markup.match(/aria-current="page"/g) || []).length, 1);
    assert.match(markup, new RegExp(`data-equipment-nav="${active}" aria-current="page"`));
    for (const id of ['characters', 'gear', 'runes', 'artifacts', 'items']) assert.ok(markup.includes(`data-equipment-nav="${id}"`));
    assert.equal((markup.match(/<svg /g) || []).length, 3);
  }
});

test('điều hướng ủy quyền gọi handler thật, không thay đổi cơ chế trang bị', () => {
  const html = read('public/index.html').replace(/\r\n/g, '\n');
  const start = html.indexOf("document.addEventListener('click', event => {\n        const target = event.target.closest('[data-equipment-nav]')");
  assert.ok(start > 0);
  const end = html.indexOf("document.querySelectorAll('.gear-subtab-btn').forEach", start);
  let listener, destination, clicks = 0;
  vm.runInNewContext(html.slice(start, end), { document: {
    addEventListener: (type, handler) => { assert.equal(type, 'click'); listener = handler; },
    querySelector: selector => { destination = selector; return { click() { clicks++; } }; },
  } });
  for (const id of ['gear', 'characters', 'runes', 'artifacts', 'items']) {
    listener({ target: { closest: () => ({ dataset: { equipmentNav: id } }) } });
    assert.equal(destination, `#tabEquip > .gear-subnav [data-gear-subtab="${id}"]`);
  }
  assert.equal(clicks, 5);
  listener({ target: { closest: () => null } });
  assert.equal(clicks, 5);
  assert.match(html, /navigationMarkup\('characters'\)/);
  assert.match(html, /navigationMarkup\('gear'\)/);
});

test('CSS cùng nền đài ngọc, bề rộng 600px, kho năm cột cả trên điện thoại', () => {
  const css = read('public/equipment-reference.css');
  assert.match(read('public/index.html'), /href="\/equipment-reference.css"/);
  assert.match(css, /rune-altar\.svg/);
  assert.match(css, /max-width:600px/);
  assert.match(css, /#gearBagGrid \{ grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(css, /safe-area-inset-bottom/);
});
