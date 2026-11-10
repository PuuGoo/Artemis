import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/save/schema.js';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadCampaignDependencies } from './fixtures/campaign-vm.mjs';

const flags = ['runeReviveUsed', 'reviveSkillUsed', 'mymuOverdrawUsed'];

const source = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
function productionFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const begin = source.indexOf('{', start);
  let depth = 0;
  for (let i = begin; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

function runtime(player = {}) {
  const context = {
    Game: { running: true, roomCleared: true, chapter: {id: 1}, room: 10,
      maxRooms: 50, kills: 42, runGold: 900, drops: [],
      player: {hp: 700, maxHp: 1000, atk: 164, aspd: 2, level: 4, xp: 20,
        xpNext: 100, skills: {revive: 1}, speed: 260, ...player}},
    SaveState: {selectedChapterIdx: 0, gold: 12345, save() {}}, CHECKPOINT_VERSION: 2, Date,
    ROGUE_SKILLS: [{id: 'revive', maxStack: 1, rarity: 'epic'}],
    usesCampaignTuning: () => true,
    startNewRun(reason) {
      assert.equal(reason, 'continue');
      context.Game.player = {skills: {}, maxHp: 1000, atk: 100};
    },
    applyRogueSkill() { assert.fail('Continue must not reapply skill effects'); },
    spawnCampaignValkyrie() {}, spawnCampaignWheel() {}, openCampaignOffer() {}, updateInGameHUD() {},
    syncContinueButton() {}, showToast() {},
  };
  vm.createContext(context);
  loadCampaignDependencies(context);
  context.usesCampaignTuning = () => true;
  context.Game.runProgression = context.ArtemisCampaignSkills.normalizeState({skills: {revive: 1}}, context.ROGUE_SKILLS);
  vm.runInContext(['canSaveCheckpoint', 'saveCheckpoint', 'getUsableCheckpoint',
    'restoreClearedCampaignRoom', 'continueRun'].map(productionFunction).join('\n'), context);
  return context;
}

test('production save → sanitizer → Continue preserves consumed flags without reapplying skills', () => {
  const context = runtime(Object.fromEntries(flags.map(flag => [flag, true])));
  assert.equal(context.saveCheckpoint(), true);
  for (let round = 0; round < 2; round++) {
    for (const flag of flags) assert.equal(context.SaveState.dungeonCheckpoint.player[flag], true, `serialized ${flag}`);
    const result = sanitizeSave({dungeonCheckpoint: JSON.parse(JSON.stringify(context.SaveState.dungeonCheckpoint))});
    assert.equal(result.ok, true);
    context.SaveState.dungeonCheckpoint = result.data.dungeonCheckpoint;
    assert.equal(context.continueRun(), true);
    for (const flag of flags) assert.equal(context.Game.player[flag], true, `restored ${flag}`);
    assert.equal(context.Game.player.skills.revive, 1);
    assert.equal(context.Game.player.atk, 164);
    assert.equal(context.Game.player.maxHp, 1000);
    assert.equal(context.Game.player.hp, 700);
    assert.equal(context.SaveState.gold, 12345);
  }
});

for (const v of [2, 1]) {
  test(`v${v} checkpoint defaults missing, false and malformed flags to false`, () => {
    for (const value of [undefined, false, null, 'true', 'false', 1, 0, {}, []]) {
      const player = cleanPlayer(v, Object.fromEntries(flags.map(flag => [flag, value])));
      for (const flag of flags) assert.equal(player[flag], false, `${flag}: ${JSON.stringify(value)}`);
    }
  });
}

function cleanPlayer(v, player) {
  const result = sanitizeSave({ dungeonCheckpoint: {
    v, room: 2, maxRooms: 50, roomCleared: true,
    player: { hp: 80, maxHp: 100, ...player },
  } });
  assert.equal(result.ok, true);
  assert.ok(result.data.dungeonCheckpoint);
  return result.data.dungeonCheckpoint.player;
}

for (const v of [2, 1]) {
  test(`v${v} checkpoint preserves consumed revive/overdraw flags independently`, () => {
    for (const flag of flags) {
      const player = cleanPlayer(v, { [flag]: true });
      assert.equal(player[flag], true, flag);
      assert.equal(cleanPlayer(v, player)[flag], true, `${flag} survives repeat sanitization`);
    }
  });
}
