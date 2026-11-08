import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
function block(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a);
  return html.slice(a, b);
}
function run(code, id, rank, dt = 0, random = 0) {
  const Game = { enemies: [{ x: 0, y: 0, hp: 100 }], meteors: [], playerBullets: [] };
  const p = { x: 0, y: 0, atk: 100 };
  const hits = [], swords = [];
  const ctx = vm.createContext({ Game, p, dt, Math: Object.assign(Object.create(Math), { random: () => random }),
    SaveState: { runes: { [id]: rank } }, RuneEconomy: { copies: x => x },
    runeHasEffect: (key, min = 4) => key === id && rank >= min,
    damageEnemy: (...args) => hits.push(args), spawnFloatingSword: () => swords.push(1),
    spawnFloatText() {}, spawnParticles() {}, findNearestEnemy: () => Game.enemies[0] });
  vm.runInContext(code, ctx);
  return { Game, p, hits, swords, ctx };
}
test('Sword of Time: Epic 3s, Legendary 1.5s; double swords only at Mythic', () => {
  const code = block('// Sword of Time [Ability Rune]', '// Star of Time [Ability Rune]');
  assert.equal(run(code, 'sword_of_time', 4, 1.5).swords.length, 0);
  assert.equal(run(code, 'sword_of_time', 4, 3).swords.length, 1);
  assert.equal(run(code, 'sword_of_time', 7, 1.5).swords.length, 1);
  assert.equal(run(code, 'sword_of_time', 11, 1.5, .49).swords.length, 2);
  assert.equal(run(code, 'sword_of_time', 11, 1.5, .5).swords.length, 1);
});
test('Star of Time: Epic 10s, Legendary 5s, Mythic double meteor chance', () => {
  const code = block('// Star of Time [Ability Rune]', '// Hỏa Độc:');
  assert.equal(run(code, 'star_of_time', 4, 5).Game.meteors.length, 0);
  assert.equal(run(code, 'star_of_time', 4, 10).Game.meteors.length, 1);
  assert.equal(run(code, 'star_of_time', 7, 5).Game.meteors.length, 1);
  assert.equal(run(code, 'star_of_time', 11, 5, .49).Game.meteors.length, 2);
});
test('Sprite Assist: 40% Epic, 80% Legendary', () => {
  const code = block('// Sprite Assist [Mythic Etched Rune]', '// Energy Ring [Epic Skill]');
  assert.equal(run(code, 'sprite_assist', 4, 0, .5).Game.playerBullets.length, 0);
  assert.equal(run(code, 'sprite_assist', 4, 0, .39).Game.playerBullets.length, 1);
  assert.equal(run(code, 'sprite_assist', 7, 0, .79).Game.playerBullets.length, 1);
});
test('Star of Fury summons exactly 3 at Epic and 7 at Mythic, even against one enemy', () => {
  const code = block('// Star of Fury [Mythic Ability Rune]', '// Wukong [Monkey Brethren]');
  assert.equal(run(code, 'star_of_fury', 4).Game.meteors.length, 3);
  assert.equal(run(code, 'star_of_fury', 11).Game.meteors.length, 7);
});
test('Echo Scythe cooldown is run-local: no second volley before 5s', () => {
  const code = block('// Echo Scythe [Mythic Etched Rune]', '// Sprite Assist [Mythic Etched Rune]');
  const h = run(code, 'echo_scythe', 4);
  assert.equal(h.Game.playerBullets.length, 1);
  vm.runInContext(code, h.ctx);
  assert.equal(h.Game.playerBullets.length, 1);
});
test('Ring of Agony: no damage at Epic, Legendary 1s and Mythic 0.5s', () => {
  const code = block('// Ring of Agony [Ability Rune]', '// Sword of Time [Ability Rune]');
  assert.equal(run(code, 'ring_of_agony', 4, 1).hits.length, 0);
  assert.equal(run(code, 'ring_of_agony', 7, .5).hits.length, 0);
  assert.equal(run(code, 'ring_of_agony', 7, 1).hits.length, 1);
  assert.equal(run(code, 'ring_of_agony', 11, .5).hits.length, 1);
});
