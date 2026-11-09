// Kiểm thử offline source/VM: nghỉ Tuyệt Kỹ Thần Uy, giữ đòn đánh thường.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function fn(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const end = html.indexOf('\n      }', start);
  assert.ok(end > start, `${name}: kết thúc hàm`);
  return html.slice(start, end + '\n      }'.length);
}

test('Tuyệt Kỹ Thần Uy không còn control, trạng thái, hàm gọi trực tiếp hay cập nhật', () => {
  const retired = /\b(?:btnTriggerUltimate|ultCharge|ultMax|ULT_COST|ULT_REGEN_PER_SEC|updateUltimateCharge|syncUltimateButton|triggerCelestialUltimate)\b|hv2-ult|hv2ult/;
  assert.equal(html.match(retired)?.[0], undefined);
  assert.equal(/THẦN UY TINH HÀ • THIÊN PHẠT|Tuyệt Kỹ Thần Uy/.test(html), false);
});

test('Space không tạo sát thương hoặc chặn mặc định; WASD vẫn nhận keydown/keyup', () => {
  const handlers = {};
  const Game = { running: true, paused: false, player: {}, keys: {}, playerBullets: [], enemies: [{ hp: 100 }] };
  let activations = 0;
  const context = vm.createContext({ Game, triggerCelestialUltimate() { activations++; }, window: { addEventListener(type, handler) { (handlers[type] ||= []).push(handler); } } });
  const listeners = [...html.matchAll(/      window\.addEventListener\('key(?:down|up)', \((?:e|ev)\) => \{[\s\S]*?\n      \}\);/g)];
  assert.ok(listeners.length >= 2);
  for (const [source] of listeners) vm.runInContext(source, context);
  let prevented = false;
  for (let n = 0; n < 3; n++) for (const listener of handlers.keydown) listener({ code: 'Space', preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(Game.playerBullets.length, 0);
  assert.equal(Game.enemies[0].hp, 100);
  assert.equal(activations, 0);
  for (const listener of handlers.keydown) listener({ code: 'KeyW' });
  assert.equal(Game.keys.KeyW, true);
  for (const listener of handlers.keyup) listener({ code: 'KeyW' });
  assert.equal(Game.keys.KeyW, false);
});

test('đòn đánh thường vẫn bắn volley qua đường production, không đổi save anh hùng/ngọc', () => {
  const SaveState = { selectedHeroId: 'artemis', heroStars: { artemis: 3 }, runes: { arrow_rain: 4 }, equippedRuneSlots: { ability: ['arrow_rain'] } };
  const before = JSON.stringify(SaveState);
  const Game = { running: true, paused: false, player: { x: 100, y: 100, skills: {}, weapon: { id: 'bow', color: '#fff' } }, muzzleFlashes: [] };
  const volleys = [];
  let shots = 0;
  const context = vm.createContext({ Game, SaveState, Math, findNearestEnemy: () => ({ x: 200, y: 100 }), SoundFX: { shootBow() { shots++; } }, setTimeout: callback => callback(), spawnVolleyProjectiles: angle => volleys.push(angle) });
  vm.runInContext(fn('firePlayerVolley'), context);
  context.firePlayerVolley();
  assert.deepEqual(volleys, [0]);
  assert.equal(shots, 1);
  assert.equal(Game.muzzleFlashes.length, 1);
  assert.equal(JSON.stringify(SaveState), before);
  assert.match(fn('updateGame'), /firePlayerVolley\(\)/);
  assert.match(html, /id="btnStageShowcaseUlt"/);
  assert.match(html, /function hasHeroSkillActive\(/);
});
