import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf("        container.querySelectorAll('[data-wt-cell]')");
const end = html.indexOf('        const btnWtNextFl', start);
function act({ type = 'soil', tool = 'pickaxe', tapsLeft = 1, pickaxes = 10, cleared = false, index = 7 } = {}) {
  const calls = [];
  const ev = { worldTreeTool: tool, worldTreeDepth: 18, elfPickaxes: pickaxes, beerBombs: 10, gnomeDrills: 10, shamrocks: 19, goldPots: 23,
    worldTreeGrid: Array.from({ length: 30 }, () => ({ type: 'soil', cleared: false })) };
  Object.assign(ev.worldTreeGrid[index], { type, tapsLeft, cleared });
  const btn = { getAttribute: () => String(index) };
  let saved = false;
  vm.runInNewContext(html.slice(start, end), { ev, container: { querySelectorAll: () => [btn] }, SaveState: { save() { saved = true; } },
    SoundFX: { levelUp() {}, coinPickup() {} }, renderLobbyUI() {}, showToast() {}, window: { ArtemisRewardResults: { show(options) { assert.ok(saved, 'settled state saved before reveal'); calls.push(options); } } } });
  btn.onclick();
  return { ev, calls };
}
for (const entry of [
  { label: 'free chest', type: 'free_chest', shamrock: 250, gold: 120, cost: 0 },
  { label: 'bomb 3x3', tool: 'bomb', shamrock: 1620, gold: 855, cost: 0 },
  { label: 'drill column', tool: 'drill', shamrock: 1000, gold: 550, cost: 0 },
  { label: 'multi tap', type: 'treasure_multi', tapsLeft: 3, shamrock: 160, gold: 80, cost: 1 },
  { label: 'last multi tap', type: 'treasure_multi', tapsLeft: 1, shamrock: 120, gold: 60, cost: 1 },
  { label: 'normal pickaxe', shamrock: 120, gold: 60, cost: 1 },
]) test(`World Tree ${entry.label} presents exact committed grants`, () => {
  const { ev, calls } = act(entry);
  assert.equal(calls.length, 1);
  assert.equal(ev.shamrocks, 19 + entry.shamrock);
  assert.equal(ev.goldPots, 23 + entry.gold);
  assert.equal(ev.elfPickaxes, 10 - entry.cost);
  assert.equal(calls[0].rewards.length, 2);
  assert.equal(calls[0].rewards.find(r => r.name === 'Shamrock').amount, entry.shamrock);
  assert.equal(calls[0].rewards.find(r => r.name === 'Gold Pot').amount, entry.gold);
});
for (const entry of [{ type: 'boulder' }, { type: 'free_chest', pickaxes: 0 }, { cleared: true }]) test(`World Tree blocked ${JSON.stringify(entry)} has no reveal`, () => {
  const { ev, calls } = act(entry);
  assert.equal(calls.length, 0);
  assert.equal(ev.shamrocks, 19);
  assert.equal(ev.goldPots, 23);
});
test('fishing reel identifies the caught fish on its actual ticket reward', () => {
  const start = html.indexOf('        const btnFishReel =');
  const end = html.indexOf('        const btnFishSnap', start);
  const source = html.slice(start, end > start ? end : start + 4000);
  const line = source.split('\n').find(line => line.includes('window.ArtemisRewardResults?.show'));
  let result;
  vm.runInNewContext(line.trim(), { hk: { name: 'Fixture fish', kg: 1.5, rarity: 'epic' }, silverGain: 220, goldGain: 0,
    window: { ArtemisRewardResults: { show(options) { result = options; } } } });
  assert.ok(result.rewards.some(reward => reward.name.includes('Fixture fish')));
  assert.equal(result.rewards[0].amount, 220);
});
test('idle fishing hook with null rarity renders safely without creating a catch', () => {
  const line = html.split('\n').find(line => line.includes('Trạng Thái Cần Câu:'));
  const hk = { rarity: null, name: 'Chưa có cá', kg: 0 };
  const output = vm.runInNewContext('`' + line.trim() + '`', { hk });
  assert.ok(output.includes('Chưa có cá'));
  assert.ok(!output.includes('undefined'));
});
