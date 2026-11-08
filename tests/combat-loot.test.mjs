import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../public/combat-loot.js', import.meta.url), 'utf8');
const sandbox = vm.createContext({});
vm.runInContext(source, sandbox);
const loot = sandbox.CombatLoot;
test('trọng số tích lũy khớp từng khoảng kể cả weight 0', () => {
  const entries = [2, 0, 3, 5].map((weight, value) => ({ weight, value }));
  const counts = [0, 0, 0, 0];
  for (let roll = 0; roll < 10; roll++) counts[loot.pickWeighted(entries, () => roll / 10)]++;
  assert.deepEqual(counts, [2, 0, 3, 5]);
});
test('chọn cuộn giữ đúng phân phối đều cũ tại mọi ranh giới', () => {
  const slots = ['weapon', 'armor', 'ring', 'amulet', 'boots', 'helmet'];
  for (let i = 0; i < 6000; i++) {
    const sample = i / 6000;
    assert.equal(loot.pickScrollSlot(slots, () => sample), slots[Math.floor(sample * slots.length)]);
  }
});
test('bảng/rng lỗi không cấp phần thưởng và không sửa bảng', () => {
  for (const entries of [[], [{ weight: -1 }], [{ weight: 0 }], [{ weight: Infinity }], [{ weight: 0.5 }]]) {
    assert.equal(loot.pickWeighted(entries), null);
  }
  const entries = [{ weight: 1, value: 'scroll' }];
  const before = JSON.stringify(entries);
  for (const sample of [-1, 1, NaN, Infinity]) assert.equal(loot.pickWeighted(entries, () => sample), null);
  assert.equal(JSON.stringify(entries), before);
});
test('đường drop production gọi module, giữ xác suất và số lượng', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /src="\/combat-loot\.js"/);
  const start = html.indexOf('const scrollDropChance =');
  const end = html.indexOf('// Remove dead enemies', start);
  const body = html.slice(start, end);
  assert.match(body, /CombatLoot\.pickScrollSlot\(slotKeys\)/);
  assert.match(body, /e\.isBoss \? 1\.0 : 0\.28/);
  assert.match(body, /val: e\.isBoss \? 5 : 2/);
});
