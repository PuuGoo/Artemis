import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sanitizeSave } from '../lib/save/schema.js';
import { buildCanonicalNewAccountData } from '../lib/save/initialState.js';

const checkpoint = (extra = {}) => ({ v: 2, room: 49, maxRooms: 50,
  roomCleared: true, player: { hp: 90, maxHp: 100, level: 99 }, ...extra });
const clean = cp => {
  const result = sanitizeSave({ dungeonCheckpoint: cp });
  assert.equal(result.ok, true);
  return result.data.dungeonCheckpoint;
};

test('initial choice receipt survives sanitizer without allowing another starter', () => {
  const cp = clean(checkpoint({runProgression:{skills:{atk_boost:1},choicesUsed:1,claimedStages:['start'],pendingOffer:null}}));
  assert.deepEqual(cp.runProgression.claimedStages, ['start']);
});

test('v2 preserves the cleared boundary and clamps campaign room/level limits', () => {
  const cp = clean(checkpoint({ maxRooms: 999 }));
  assert.equal(cp.v, 2);
  assert.equal(cp.maxRooms, 50);
  assert.equal(cp.room, 49);
  assert.equal(cp.roomCleared, true);
  assert.equal(cp.player.level, 10);
  assert.equal(clean(checkpoint({ room: 50 })), null);
  assert.equal(clean(checkpoint({ roomCleared: false })), null);
  assert.equal(clean(checkpoint({ roomCleared: 'true' })), null);
});

test('legacy v1 checkpoints retain slug skills, old caps and optional cleared flag', () => {
  const cp = clean(checkpoint({ v: 1, room: 100, maxRooms: 200,
    player: { maxHp: 200, hp: 140, level: 999, skills: { legacy_future_slug: 30 } } }));
  assert.equal(cp.room, 100);
  assert.equal(cp.maxRooms, 200);
  assert.equal(cp.player.level, 999);
  assert.equal(cp.player.skills.legacy_future_slug, 20);
  assert.equal(clean({ room: 2, maxRooms: 15, player: { maxHp: 10 } }).v, 1);
});

test('v2 whitelist matches real catalog and enforces a total ten-stack budget', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('const ROGUE_SKILLS = [');
  const end = html.indexOf('\n      ];', start);
  assert.ok(start >= 0 && end > start);
  const catalog = vm.runInNewContext(html.slice(start, end + 9) + ';ROGUE_SKILLS');
  for (const { id } of catalog) {
    assert.equal(clean(checkpoint({ player: { maxHp: 10, skills: { [id]: 1 } } })).player.skills[id], 1, id);
  }
  const raw = checkpoint({ player: { maxHp: 100, skills: {
    invented_slug: 10, multishot: 99, sacred_protection: 99, tracking_eye: 99,
    warriors_breath: 99, atk_boost: 99,
  } } });
  const before = JSON.stringify(raw);
  const cp = clean(raw);
  assert.equal(cp.player.skills.invented_slug, undefined);
  assert.equal(cp.player.skills.multishot, 2);
  assert.equal(cp.player.skills.sacred_protection, 4);
  assert.equal(cp.player.skills.tracking_eye, 1);
  assert.equal(Object.values(cp.player.skills).reduce((a, b) => a + b, 0), 10);
  assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(clean(cp), cp);
});

test('v2 progression preserves safe proposed event fields without accepting arbitrary payloads', () => {
  const raw = checkpoint({ runProgression: {
    skillChoicesUsed: 999, acquiredSkills: { atk_boost: 99, unknown: 9 },
    claimedValkyrieStages: [5, 5, 10, 11, 45, 50, '15', -5],
    skippedValkyrieStages: [10, 15, 20, 45, 100], pityCounter: 99,
    encounter: { stage: 25, state: 'offered', offers: ['atk_boost', 'unknown', '<bad>', 'max_hp_up', 'atk_boost'], rerollsUsed: 999, injected: {} },
    injected: { gold: 999 },
  } });
  const cp = clean(raw), p = cp.runProgression;
  assert.ok(p);
  assert.equal(p.skillChoicesUsed, 10);
  assert.deepEqual(p.acquiredSkills, { atk_boost: 10 });
  assert.deepEqual(p.claimedValkyrieStages, [5, 10, 45]);
  assert.deepEqual(p.skippedValkyrieStages, [15, 20]);
  assert.equal(p.pityCounter, 4);
  assert.deepEqual(p.encounter, { stage: 25, state: 'offered', offers: ['atk_boost', 'max_hp_up'], rerollsUsed: 2 });
  assert.equal(p.injected, undefined);
  assert.deepEqual(clean(cp), cp);
});

test('v2 retains the actual skill module state contract for deterministic resume', () => {
  const cp = clean(checkpoint({ runProgression: {
    version: 1, seed: 4294967295, skills: { multishot: 2, sacred_protection: 3 },
    choicesUsed: 6, runSkillLevel: 6, claimedStages: [5, 10], valkyrieOffers: 7,
    pendingOffer: { stageId: 15, provider: 'valkyrie', segment: 1, seraph: true, pity: false,
      skillIds: ['atk_boost', 'max_hp_up'], rerollLimit: 2, rerollsUsed: 1 },
  } }));
  assert.deepEqual(cp.runProgression, {
    version: 1, seed: 4294967295, skills: { multishot: 2, sacred_protection: 3 },
    choicesUsed: 6, runSkillLevel: 6, claimedStages: [5, 10], valkyrieOffers: 7,
    pendingOffer: { stageId: 15, provider: 'valkyrie', segment: 1, seraph: true, pity: false,
      skillIds: ['atk_boost', 'max_hp_up'], rerollLimit: 2, rerollsUsed: 1 },
  });
});

test('v2 restores finite bounded movement, dodge, damage and shield side effects', () => {
  const cp = clean(checkpoint({ player: { maxHp: 100, hp: 999, speed: 999,
    gearDodge: 99, dodge: 99, mainWepDmgMult: 999, dmgCatMult: 999, sacredShieldStacks: 99 } }));
  assert.equal(cp.player.hp, 100);
  assert.equal(cp.player.speed, 390);
  assert.equal(cp.player.gearDodge, 0.65);
  assert.equal(cp.player.dodge, 0.65);
  assert.equal(cp.player.mainWepDmgMult, 100);
  assert.equal(cp.player.dmgCatMult, 100);
  assert.equal(cp.player.sacredShieldStacks, 4);
  for (const value of [NaN, Infinity, -Infinity, {}, [], [3], true, '999']) {
    const p = clean(checkpoint({ player: { maxHp: 100, speed: value, gearDodge: value,
      mainWepDmgMult: value, dmgCatMult: value, sacredShieldStacks: value } })).player;
    assert.equal(p.speed, 240);
    assert.equal(p.gearDodge, 0);
    assert.equal(p.mainWepDmgMult, 1);
    assert.equal(p.dmgCatMult, 1);
    assert.equal(p.sacredShieldStacks, 0);
    assert.ok(Object.values(p).filter(x => typeof x === 'number').every(Number.isFinite));
  }
});

test('migrating only the checkpoint preserves all sanitized account assets', () => {
  const source = { ...buildCanonicalNewAccountData({ now: 123456789 }), gold: 125000, gems: 2700,
    heroStars: { artemis: 3 }, heroShards: { artemis: 117 },
    runes: { rune_flame: 12 }, runeStones: { fire: 7 } };
  const before = sanitizeSave({ ...source, dungeonCheckpoint: checkpoint({ v: 1 }) }).data;
  const after = sanitizeSave({ ...source, dungeonCheckpoint: checkpoint() }).data;
  delete before.dungeonCheckpoint;
  delete after.dungeonCheckpoint;
  assert.deepEqual(after, before);
  assert.equal(after.gold, 125000);
  assert.equal(after.heroStars.artemis, 3);
  assert.equal(after.runes.rune_flame, 12);
});

test('server skill caps and integer normalization agree with the actual module', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../public/campaign-skills.js', import.meta.url), 'utf8'), context);
  for (const [id, cap] of Object.entries(context.ArtemisCampaignSkills.LOWER_CAPS)) {
    const p = clean(checkpoint({ player: { maxHp: 10, skills: { [id]: 99 } } })).player;
    assert.equal(p.skills[id], cap, id);
  }
  for (const value of [NaN, Infinity, {}, [], [3], true, '3', -1]) {
    assert.deepEqual(clean(checkpoint({ player: { maxHp: 10, skills: { atk_boost: value } } })).player.skills, {});
  }
  assert.equal(clean(checkpoint({ player: { maxHp: 10, skills: { atk_boost: 1.9 } } })).player.skills.atk_boost, 1);
});
