import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function harness({ owned = 4, equipped = false, selected = null, hostile = false } = {}) {
  const ctx = vm.createContext({ document: { getElementById: () => scroller } });
  const scroller = { scrollTop: 391 };
  vm.runInContext(read('public/rune-economy.js') + '\n' + read('public/js/game/runes/rune-workspace.js'), ctx);
  const state = { runes: { rune_flame: owned }, runeTypeFilter: 'all' };
  const slots = { etched: [], blessing: [], enhancement: equipped ? ['rune_flame'] : [], ability: [] };
  const options = {
    data: [{ id: 'rune_flame', type: 'enhancement', name: hostile ? '<img src=x onerror=alert(1)>' : 'Ấn' }, { id: 'rune_thunder', type: 'ability', name: 'Sấm Sét' }],
    categories: { etched: { slots: 3 }, blessing: { slots: 2 }, enhancement: { slots: 4 }, ability: { slots: 4 } },
    wiki: { rune_flame: { base: 'ATK', effects: { Epic: '<script>bad()</script>' } }, rune_thunder: { base: 'HP', effects: {} } },
    getState: () => state, getSlots: () => slots, getSelected: () => selected,
    getTotals: () => ({ atk: 120, hp: 480 }), getHero: () => ({ name: 'Alex', avatar: 'assets/alex.png' }),
    getBaseStats: () => ({ atk: 120, hp: 480 }), tier: () => ({ id: 'epic', style: '--tier-color:#c084fc;' }), image: () => 'assets/rune.png', fallback() {},
    onSelectSlot() {}, onClearSelection() {}, onFilter() {}, onSort() {}, onEquip() {}, onUnequip() {}, onExplore() {}, onPreset() {},
  };
  return { view: ctx.ArtemisRuneWorkspace.create(options), state, slots, scroller };
}
test('chi tiết ngọc gắn/tháo/khám phá theo sở hữu, không thay đổi dữ liệu khi xem', () => {
  for (const owned of [0, 4]) for (const equipped of [false, true]) {
    if (!owned && equipped) continue;
    const h = harness({ owned, equipped }), before = JSON.stringify([h.state, h.slots]);
    const markup = h.view.detailMarkup('rune_flame');
    assert.equal(markup.includes('data-rune-popup-equip'), owned > 0 && !equipped);
    assert.equal(markup.includes('data-rune-popup-unequip'), equipped);
    assert.equal(markup.includes('data-rune-popup-ruins'), owned === 0);
    assert.equal(JSON.stringify([h.state, h.slots]), before);
    assert.match(markup, /Tham khảo/);
    assert.match(markup, /data-rune-combat-note/);
  }
});
test('ô khác nhóm không thể gắn; dữ liệu tham khảo và tên được escape', () => {
  const h = harness({ selected: { cat: 'ability', index: 2 }, hostile: true });
  const markup = h.view.detailMarkup('rune_flame');
  assert.match(markup, /data-rune-popup-equip[^>]* disabled/);
  assert.match(markup, /Ô đang chọn khác nhóm/);
  assert.match(markup, /&lt;img/);
  assert.match(markup, /&lt;script&gt;/);
  assert.doesNotMatch(markup, /<script>|onerror=alert\(1\)>/);
});
test('bảng 13 ô, kho mặc định chỉ ngọc sở hữu, giữ vị trí cuộn và bộ nhanh thu gọn', () => {
  const h = harness(), nodes = { '.rune-filter-row': { scrollLeft: 61 }, '.rune-presets': { open: true }, '#btnRuneSortQuality': {}, '#btnRuneWorkshop': {} };
  const container = { innerHTML: '', querySelector: key => nodes[key], querySelectorAll: () => [] };
  h.view.render(container);
  assert.equal((container.innerHTML.match(/data-rune-slot=/g) || []).length, 13);
  assert.equal((container.innerHTML.match(/data-equip-wiki-rune=/g) || []).length, 1);
  assert.match(container.innerHTML, /data-rune-scope="owned" aria-pressed="true"/);
  assert.match(container.innerHTML, /class="rune-presets" open/);
  assert.equal(h.scroller.scrollTop, 391);
  assert.equal(nodes['.rune-filter-row'].scrollLeft, 61);
});
test('kho mới có empty state thật, không tự cấp ngọc', () => {
  const h = harness({ owned: 0 });
  const container = { innerHTML: '', querySelector: () => ({ addEventListener() {} }), querySelectorAll: () => [] };
  h.view.render(container);
  assert.match(container.innerHTML, /Kho ngọc còn trống/);
  assert.doesNotMatch(container.innerHTML, /data-equip-wiki-rune=/);
  assert.equal(h.state.runes.rune_flame, 0);
});
test('mẫu ảnh dùng đài 13 ô, kho 5 cột và ba tab dưới đài; không giả khóa ô hay cấp ngọc', () => {
  const h = harness();
  const container = { innerHTML: '', querySelector: () => ({ addEventListener() {} }), querySelectorAll: () => [] };
  h.view.render(container);
  assert.match(container.innerHTML, /rune-altar\.svg/);
  assert.equal((container.innerHTML.match(/data-rune-nav=/g) || []).length, 3);
  assert.match(container.innerHTML, /id="btnRuneWorkshop"/);
  assert.equal((container.innerHTML.match(/class="rune-crystal"/g) || []).length, 14);
  assert.doesNotMatch(container.innerHTML, /data-rune-slot=[^>]*disabled/);
});
test('module được nối vào luồng thật và CSS giới hạn ở workspace/modal', () => {
  const html = read('public/index.html'), css = read('public/rune-reference.css');
  assert.match(html, /src="\/js\/game\/runes\/rune-workspace.js"/);
  assert.match(html, /getRuneWorkspace\(\)\.render\(runeGrid\)/);
  assert.match(html, /onEquip: equipRuneIntoCategorySlot/);
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /safe-area-inset-bottom/);
});
test('xưởng hiển thị nguyên liệu đúng bậc, chỉ mở ghép khi đủ 3 và chặn Mythic', () => {
  const h = harness();
  h.state.runeStones = { rune_flame: { normal: 2, epic: 3, mythic: 8 } };
  const markup = h.view.mergeMarkup('rune_flame');
  assert.match(markup, /data-merge-tier="normal" disabled/);
  assert.match(markup, /data-merge-tier="epic">Ghép 3 → 1/);
  assert.match(markup, /data-merge-tier="mythic" disabled/);
  assert.match(markup, /Sử Thi ×3 → Sử Thi \+1/);
  assert.match(markup, /Không tốn vàng hoặc đá quý/);
});
