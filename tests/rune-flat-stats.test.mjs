import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const slice = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
function stats(id, cat, rank) {
  const c = vm.createContext({ window: {}, SaveState: { runes: { [id]: rank } },
    getEquippedRuneSlots: () => ({ [cat]: [id] }), runeOwned: () => rank > 0,
    runeHasEffect: () => false });
  vm.runInContext(fs.readFileSync(new URL('../public/rune-wiki-data.js', import.meta.url), 'utf8'), c);
  c.RuneWikiData = c.window.RuneWikiData;
  vm.runInContext(fs.readFileSync(new URL('../public/rune-economy.js', import.meta.url), 'utf8'), c);
  c.RuneEconomy = c.window.RuneEconomy;
  vm.runInContext(slice('const RUNE_BASE_STATS_BY_TYPE =', '// Màu phẩm chất') +
    slice('function computeTotalEquippedRunesStats()', 'function equipRuneIntoCategorySlot(') +
    `\nglobalThis.result = computeTotalEquippedRunesStats();`, c);
  return c.result;
}
test('Rare flat properties are added on top of category base stats, and kept at higher tiers', () => {
  assert.equal(stats('guardian', 'blessing', 3).atk, 96);
  assert.equal(stats('rune_valkyrie', 'blessing', 3).hp, 384);
  assert.equal(stats('arrow_rain', 'ability', 3).hp, 440);
  assert.equal(stats('sharp_arrow', 'enhancement', 3).atk, 110);
  assert.equal(stats('sharp_arrow', 'enhancement', 7).atk, 450);
  assert.equal(stats('sharp_arrow', 'enhancement', 2).atk, 40);
});
test('Normal/Fine Blessing and Etched do not fabricate base stats for Wiki N/A', () => {
  for (const rank of [1, 2]) {
    assert.equal(stats('guardian', 'blessing', rank).atk, 0);
    assert.equal(stats('guardian', 'blessing', rank).hp, 0);
    assert.equal(stats('echo_scythe', 'etched', rank).hp, 0);
  }
  // Fine Khắc Ấn vẫn có thuộc tính riêng +100 Công, không phải chỉ số nền giả.
  assert.equal(stats('echo_scythe', 'etched', 2).atk, 100);
});
