import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('function rollSingleCanonicalChestPull(');
const end = html.indexOf('// Perform a Rune Ruins', start);
assert.ok(start >= 0 && end > start);
function fixture(keys = 500, gems = 10000) {
  const shown = [], toasts = [];
  let writes = 0;
  const templates = Object.fromEntries(['echo', 'celestial', 'phoenix', 'shadow'].map(setId => [setId + '_bow', { id: setId + '_bow', name: 'Cung ' + setId, slot: 'weapon', setId }]));
  const SaveState = { chestKeys: { silver_chest_key: keys, obsidian_chest_key: keys, chromatic_chest_key: keys }, gems, gearBag: [], chestGachaState: {}, save() { writes++; } };
  const document = { activeElement: { isConnected: true, hasAttribute() { return false; } }, querySelector() { return null; } };
  const context = vm.createContext({ SaveState, GEAR_TEMPLATES: templates, WIKI_CHEST_KEYS_META: Object.fromEntries(['silver', 'obsidian', 'chromatic'].map(type => [type + '_chest_key', { gemCost: 100, chestName: 'Rương ' + type, wikiName: type }])), ensureWikiCurrencyAndItemsState() {}, showToast: text => toasts.push(text), SoundFX: { levelUp() {} }, StageHeroAnim: { triggerPose() {} }, renderLobbyUI() {}, formatQualityWithStars: q => q, getGearItemSvgArt: () => '<svg></svg>', document, window: { ArtemisChestResults: { show: payload => shown.push(payload) } }, setTimeout, clearTimeout });
  vm.runInContext(html.slice(start, end), context);
  return { context, SaveState, shown, toasts, writes: () => writes };
}
for (const count of [1, 10, 100]) {
  test(`mở thành công ×${count}: popup dùng chính trang bị đã trao, chỉ trừ chìa và lưu một lần`, () => {
    const f = fixture();
    f.context.executeCanonicalChestPull('chromatic', count);
    assert.equal(f.SaveState.gearBag.length, count);
    assert.equal(f.SaveState.chestKeys.chromatic_chest_key, 500 - count);
    assert.equal(f.SaveState.gems, 10000);
    assert.equal(f.writes(), 1);
    assert.equal(f.shown.length, 1, 'successful chest pull must open one result popup');
    assert.equal(f.shown[0].results.length, count);
    assert.deepEqual(Array.from(f.shown[0].results, r => r.item.uid), [...f.SaveState.gearBag].reverse().map(r => r.uid));
    for (const r of f.shown[0].results) {
      assert.ok(f.SaveState.gearBag.includes(r.item), 'no second roll or fabricated display item');
      assert.equal(r.tpl.id, r.item.templateId);
      assert.equal(r.quality, r.item.quality);
    }
  });
}
test('không đủ tiền: không popup, không mất chìa/đá, không thêm đồ hoặc ghi save', () => {
  const f = fixture(2, 0), before = JSON.stringify(f.SaveState);
  f.context.executeCanonicalChestPull('chromatic', 10);
  assert.equal(JSON.stringify(f.SaveState), before);
  assert.equal(f.shown.length, 0);
  assert.equal(f.writes(), 0);
  assert.equal(f.toasts.length, 1);
});
test('thiếu chìa: chỉ thanh toán số thiếu bằng đá một lần', () => {
  const f = fixture(2, 1000);
  f.context.executeCanonicalChestPull('chromatic', 10);
  assert.equal(f.SaveState.chestKeys.chromatic_chest_key, 0);
  assert.equal(f.SaveState.gems, 200);
  assert.equal(f.SaveState.gearBag.length, 10);
  assert.equal(f.writes(), 1);
  assert.equal(f.shown.length, 1);
});
