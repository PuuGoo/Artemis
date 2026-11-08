import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sanitizeSave } from '../lib/save/schema.js';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/gear-workspace.css', import.meta.url), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return html.slice(a, b);
}
const previewSource = section('function previewGearDecision(', 'function renderGearDecision(');
test('bỏ giao diện nâng cao không làm rơi dữ liệu ngọc/dòng phụ từ save máy chủ', () => {
  const raw = { uid: 'legacy_item', templateId: 'crimson_bow', quality: 'common', level: 5, awakening: 0, locked: true, favorite: true, sockets: [{ gem: 'ruby', level: 1 }], affixes: [{ stat: 'atk_flat', tier: 'C', value: 14 }] };
  const before = sanitizeSave({ gearBag: [raw] }).data;
  const item = structuredClone(before.gearBag[0]);
  const ctx = vm.createContext({ console, GEAR_TEMPLATES: { crimson_bow: {} }, GEAR_QUALITIES: { common: { maxAwakening: 0 } } });
  vm.runInContext(section('function normalizeGearItem(', 'function buildMaxSocketsForTemplate('), ctx);
  ctx.normalizeGearItem(item);
  const after = sanitizeSave({ gearBag: [item] }).data;
  assert.deepEqual(after.gearBag, before.gearBag);
});
test('xem trước kế thừa cấp vị trí, không đổi object, cấp đồ hay ghi save', () => {
  const current = { templateId: 'old', level: 12 }, candidate = { templateId: 'new', level: 2 };
  const equipped = { weapon: current };
  const SaveState = { equippedGear: equipped, save() { assert.fail('preview must not save'); } };
  const ctx = vm.createContext({ SaveState,
    getComputedStats: () => ({ baseAtk: SaveState.equippedGear.weapon.level * (SaveState.equippedGear.weapon.templateId === 'new' ? 20 : 10), baseHp: 100 }),
    getEquippedSetCounts: () => ({ old: SaveState.equippedGear.weapon.templateId === 'old' ? 2 : 1 }),
  });
  vm.runInContext(previewSource, ctx);
  const result = ctx.previewGearDecision(candidate, 'weapon');
  assert.equal(result.level, 12);
  assert.equal(result.before.baseAtk, 120);
  assert.equal(result.after.baseAtk, 240);
  assert.equal(result.beforeSets.old, 2);
  assert.equal(result.afterSets.old, 1);
  assert.equal(SaveState.equippedGear, equipped);
  assert.equal(current.level, 12);
  assert.equal(candidate.level, 2);
  assert.equal(ctx.previewGearDecision(current, 'weapon', true).after.baseAtk, 130);
  assert.equal(current.level, 12);
});
test('xem trước khôi phục bộ thật ngay cả khi hàm tính chỉ số lỗi', () => {
  const equipped = { weapon: { level: 4 } }, SaveState = { equippedGear: equipped };
  let calls = 0;
  const ctx = vm.createContext({ SaveState, getEquippedSetCounts: () => ({}), getComputedStats: () => {
    if (++calls > 1) throw Error('fixture failure'); return {};
  } });
  vm.runInContext(previewSource, ctx);
  assert.throws(() => ctx.previewGearDecision({ level: 1 }, 'weapon'), /fixture failure/);
  assert.equal(SaveState.equippedGear, equipped);
});
test('bảng quyết định cảnh báo mất mốc bộ và escape tên trang bị', () => {
  const el = {};
  const ctx = vm.createContext({ document: { getElementById: () => el }, SaveState: { equippedGear: { weapon: { templateId: 'old', level: 10 } } },
    GEAR_TEMPLATES: { old: { name: '<img src=x>' } }, GEAR_SET_META: { oracle: { name: 'Oracle', desc2: 'Tăng công' } },
    previewGearDecision: () => ({ before: { baseAtk: 100, baseHp: 1000 }, after: { baseAtk: 90, baseHp: 1200 }, beforeSets: { oracle: 2 }, afterSets: { oracle: 1 }, level: 10 }),
  });
  vm.runInContext(section('function gearTextSafe(', 'function getAllOwnedGearByUid(') + section('function renderGearDecision(', 'function openGearDetailModal('), ctx);
  ctx.renderGearDecision({ level: 1 }, 'weapon', false);
  assert.match(el.innerHTML, /Mất Oracle/);
  assert.match(el.innerHTML, /gear-loss/);
  assert.match(el.innerHTML, /Kế thừa cấp 10/);
  assert.match(el.innerHTML, /&lt;img/);
  assert.doesNotMatch(el.innerHTML, /<img/);
});
test('kho chỉ giữ trang bị, cường hóa và ghép; không còn lối vào tính năng nâng cao', () => {
  const removed = ['gearWorkshop', 'gearWorkshopContent', 'gearLoadoutControls', 'btnQuickEquipBest', 'btnOpenGearChest', 'btnGearCompare', 'btnGemWorkshop', 'btnBulkSalvage', 'btnAutoBuildAdvanced', 'btnGearReforge', 'btnGearLoadouts', 'btnGearEvolution', 'btnWorkshopMaxAll', 'btnModalMaxUpgradeGear', 'btnModalOpenReforge', 'btnModalResetLevel', 'btnModalToggleFavorite', 'btnModalToggleLock', 'btnModalAscendChaotic'];
  for (const id of removed) assert.ok(!html.includes(`id="${id}"`), `lối vào đã bỏ: ${id}`);
  assert.doesNotMatch(html, /data-loadout-preset=/);
  const api = section('window.Archero2FusionAPI = {', '// ===== API gỡ lỗi');
  for (const name of ['renderReforgeTool', 'runAdvancedAutoBuild', 'renderGearLoadoutManager', 'saveCurrentGearLoadout', 'applyGearLoadout', 'deleteGearLoadout']) assert.ok(!api.includes(name), name);
  assert.match(html, /id="btnModalUpgradeGear"/);
  assert.match(html, /id="btnModalEquipGear"/);
  assert.match(html, /id="btnOpenBlacksmith"/);
  assert.match(html, /<dialog id="gearDetailModal"/);
  assert.match(html, /modal\.showModal\(\)/);
  assert.match(html, /modal\.close\(\)/);
  assert.match(html, /id="gearModalMergeProtected"/);
  assert.match(css, /repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /safe-area-inset-bottom/);
});
