import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load() {
  const context = vm.createContext({});
  for (const file of ['campaign-config.js', 'boss-attack-patterns.js', 'campaign-rooms.js']) {
    const path = new URL(`../public/${file}`, import.meta.url);
    if (fs.existsSync(path)) vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: file });
  }
  assert.ok(context.ArtemisCampaignRooms, 'classic script must publish ArtemisCampaignRooms');
  return context;
}
const plain = value => JSON.parse(JSON.stringify(value));

test('rosters use implemented AI, diverse roles, pressure caps and a quiet room 49', () => {
  const { ArtemisCampaignRooms: rooms } = load();
  const supported = new Set(['slime', 'bat', 'goblin', 'skeleton_mage', 'plant_turret', 'dragon_whelp', 'cloud_wisp', 'sky_sentinel', 'rift_stalker', 'eclipse_oracle', 'obsidian_brute', 'spore_runner', 'mire_shaman', 'hive_guardian']);
  for (let chapter = 1; chapter <= 12; chapter++) {
    for (let room = 1; room <= 50; room++) {
      const plan = rooms.roomPlan(chapter, room);
      const roster = rooms.getRoster(chapter, room);
      assert.equal(roster.length, plan.count);
      if (plan.isBoss) { assert.equal(roster[0].type, plan.bossType); continue; }
      if (plan.isSafeRoom) { assert.equal(roster.length,0); continue; }
      assert.ok(roster.length >= 3 && roster.length <= 8);
      assert.ok(new Set(roster.map(e => e.role)).size >= 2);
      assert.ok(roster.every(e => supported.has(e.type) && e.counter.length > 10));
      assert.ok(roster.reduce((sum, e) => sum + e.pressure, 0) <= plan.pressureBudget + 1e-9);
      assert.deepEqual(plain(roster), plain(rooms.getRoster(chapter, room)));
    }
    const rest = rooms.roomPlan(chapter, 49);
    assert.equal(rest.rhythm, 'rest');
    assert.equal(rest.count, 3);
    assert.ok(rooms.getRoster(chapter, 49).every(e => !e.isElite));
    assert.ok(rooms.getRoster(chapter, 34).some(e => e.role === 'area'));
    assert.ok(rooms.getRoster(chapter, 44).some(e => e.role === 'ranged'));
  }
});

test('elite stages are bounded, absolute-stat multipliers ignore player power and outputs are isolated', () => {
  const { ArtemisCampaignRooms: rooms } = load();
  for (let chapter = 1; chapter <= 12; chapter++) {
    for (let room = 1; room <= 50; room++) {
      const roster = rooms.getRoster(chapter, room);
      const eliteCount = roster.filter(e => e.isElite).length;
      const expected = room >= 21 && room !== 49 && room % 10 !== 0 && !rooms.isSafeRoom(room) ? (room >= 41 ? 2 : 1) : 0;
      assert.equal(eliteCount, expected);
      for (let i = 0; i < roster.length; i++) {
        const mods = rooms.getModifiers(chapter, room, i);
        assert.equal(mods.isElite, roster[i].isElite);
        for (const key of ['hpMultiplier', 'atkMultiplier', 'speedMultiplier', 'sizeMultiplier']) {
          assert.ok(mods[key] >= 1 && mods[key] <= 1.5);
        }
        assert.deepEqual(plain(mods), plain(rooms.getModifiers(chapter, room, i, { atk: 1e15, maxHp: 1e15 })));
      }
    }
  }
  const copy = rooms.getRoster(1, 24);
  copy[0].type = 'unsupported';
  assert.notEqual(rooms.getRoster(1, 24)[0].type, 'unsupported');
  assert.deepEqual(plain(rooms.roomPlan(1, NaN)), plain(rooms.roomPlan(1, 1)));
  assert.deepEqual(plain(rooms.roomPlan(100, 100)), plain(rooms.roomPlan(12, 50)));
});

test('four chapter-owned subboss identities modify real shared patterns without adding bullets', () => {
  const { ArtemisCampaignRooms: rooms, BossAttackPatterns: patterns } = load();
  const identities = new Set();
  for (let chapter = 1; chapter <= 12; chapter++) {
    const signatures = new Set();
    for (const room of [10, 20, 30, 40]) {
      const mods = rooms.getModifiers(chapter, room, 0);
      const boss = mods.bossVariant;
      assert.ok(boss && boss.id && boss.name && /^#[0-9a-f]{6}$/i.test(boss.color));
      identities.add(boss.id);
      assert.equal(boss.type, rooms.roomPlan(chapter, room).bossType);
      assert.ok(mods.sizeMultiplier >= 1 && mods.sizeMultiplier <= 1.5);
      const entity = { isBoss: true, type: boss.type, x: 100, y: 90, hp: 500, maxHp: 1000, atk: 50, phaseTimer: 0, campaignChapter: chapter, campaignRoom: room };
      const player = { x: 200, y: 300 };
      const original = patterns.plan(entity, player);
      const before = plain(original);
      const adjusted = rooms.applyBossPattern(original, entity, player);
      assert.equal(adjusted.shots.length, original.shots.length);
      assert.deepEqual(plain(original), before);
      assert.ok(adjusted.cooldown >= 1);
      for (const shot of adjusted.shots) assert.ok([shot.x, shot.y, shot.angle, shot.speed].every(Number.isFinite));
      assert.ok(adjusted.shots.every(s => s.dmg === entity.atk));
      signatures.add(JSON.stringify(plain(adjusted.shots).map(s => [s.angle, s.speed])));
    }
    assert.equal(signatures.size, 4);
    assert.equal(rooms.getModifiers(chapter, 50).bossVariant, null);
  }
  assert.equal(identities.size, 48);
  const untouched = { shots: [], cooldown: 2 };
  assert.equal(rooms.applyBossPattern(untouched, { isBoss: true }, {}), untouched);
});

test('all 12 chapters have five ten-room archetype segments and unchanged boss/event anchors', () => {
  const { ArtemisCampaignRooms: rooms, ArtemisCampaignConfig: config } = load();
  assert.equal(rooms.ROOM_COUNT, 50);
  for (let chapter = 1; chapter <= 12; chapter++) {
    for (let room = 1; room <= 50; room++) {
      const plan = rooms.roomPlan(chapter, room);
      const base = config.roomPlan(chapter, room);
      assert.equal(plan.segment, Math.floor((room - 1) / 10));
      assert.equal(plan.archetype, ['learning', 'ranged', 'elite', 'control', 'group'][plan.segment]);
      for (const key of ['room', 'isBoss', 'isFinalBoss', 'bossType']) assert.equal(plan[key], base[key]);
    }
  }
});
