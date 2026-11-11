import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { getCampaignDetail } from '../lib/campaignCatalog.js';

function load() {
  const context = vm.createContext({});
  for (const file of [
    'campaign-config.js',
    'campaign-rooms.js',
    'boss-attack-patterns.js',
    'js/game/rendering/arena-renderer.js'
  ]) vm.runInContext(fs.readFileSync(new URL('../public/' + file, import.meta.url), 'utf8'), context, { filename: file });
  return context;
}
const descriptors = [
  { room: 10, type: 'golem', name: 'Kim Giáp Sư Vệ', skill: 'Khiên Nhật Luân' },
  { room: 20, type: 'queen', name: 'Nhật Ấn Tế Sư', skill: 'Song Ấn Quang Tiễn' },
  { room: 30, type: 'demon_king', name: 'Xích Diệm Đao Vương', skill: 'Xích Diệm Liên Trảm' },
  { room: 40, type: 'elder_dragon', name: 'Thiên Dực Nhật Long', skill: 'Thiên Dực Nhật Triều' }
];
const clean = value => JSON.parse(JSON.stringify(value));
function canvas() {
  const actions = [], state = { depth: 0 };
  const c = new Proxy({}, {
    get(obj,key) {
      if (key in obj) return obj[key];
      return (...args) => {
        if (key === 'save') state.depth++;
        if (key === 'restore') state.depth--;
        assert.ok(state.depth >= 0, 'unbalanced canvas restore');
        for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), key);
        if (['ellipse', 'lineTo', 'fill', 'stroke', 'scale', 'rotate'].includes(key)) actions.push([key, ...args]);
      };
    },
    set(obj,key,value) { obj[key] = value; return true; }
  });
  return { c, actions, state };
}

test('Leo has four original guardians with names, powers and proper chapter-only biome', () => {
  const { ArtemisCampaignRooms: rooms } = load();
  const leo = getCampaignDetail(1), other = getCampaignDetail(2);
  assert.deepEqual(leo.bosses.map(x => x.room), [10,20,30,40,50]);
  const names = [];
  for (const d of descriptors) {
    const plan = rooms.roomPlan(1,d.room);
    const mods = rooms.getModifiers(1,d.room,0);
    const admin = leo.bosses.find(x => x.room === d.room);
    assert.equal(plan.bossType,d.type);
    assert.equal(mods.bossVariant?.name,d.name);
    assert.equal(mods.bossVariant?.skill,d.skill);
    assert.equal(admin.name,d.name);
    assert.equal(leo.roomsDetail[d.room-1].biome,'zodiac_leo');
    assert.ok(admin.counter?.length > 20);
    assert.ok(/^#[0-9a-f]{6}$/i.test(mods.bossVariant?.color));
    assert.ok(mods.speedMultiplier >= 1 && mods.speedMultiplier <= 1.2);
    names.push(admin.name);
  }
  assert.equal(new Set(names).size,4);
  assert.equal(rooms.getModifiers(1,50).bossVariant,null);
  assert.equal(leo.bosses.at(-1).type,'zodiac_leo');
  assert.equal(other.bosses[0].name,'Vệ Binh Bạch Dương');
  assert.notEqual(other.roomsDetail[9].biome,'zodiac_leo');
});

test('all four Leo patterns share actual fire and warning plan with finite, bounded shots', () => {
  const { BossAttackPatterns: attacks } = load();
  const signatures = new Set();
  for (const d of descriptors) for (const phaseTimer of [0,1,2]) for (const hp of [100,32]) {
    const e = { isBoss:true,type:d.type,campaignChapter:1,campaignRoom:d.room,
      x:160,y:160,r:36,hp,maxHp:100,atk:32,phaseTimer,attackTimer:.28 };
    const p = {x:300,y:260}, before=clean(e), planned=attacks.plan(e,p);
    assert.deepEqual(clean(e),before,'plan must not modify boss state');
    assert.ok(planned.cooldown >= 1.2 && planned.cooldown <= 2.5);
    assert.ok(planned.shots.length >= 1 && planned.shots.length <= 12);
    for (const s of planned.shots) {
      assert.ok(Object.values(s).every(Number.isFinite));
      assert.equal(s.dmg,32);
      assert.ok(s.speed > 0 && s.speed <= 320);
      assert.ok(Math.hypot(s.x-e.x,s.y-e.y) <= 48);
    }
    const { c,state }=canvas();
    assert.equal(attacks.draw(c,e,p,1300,false),true);
    assert.equal(state.depth,0);
    assert.deepEqual(clean(e),before,'drawing warning cannot change combat state');
    const spawned=[];
    assert.equal(attacks.fire(e,p,(...args)=>spawned.push(args)),true);
    assert.deepEqual(spawned,clean(planned.shots).map(s=>[s.x,s.y,s.angle,s.speed,s.dmg,s.r]));
    if(phaseTimer===0&&hp===100)signatures.add(JSON.stringify(planned.shots.map(s=>[s.x,s.y,s.angle])));
  }
  assert.equal(signatures.size,4,'four mini-bosses have distinct attack geometry');
});

test('renderer draws four different chibi bodies before MonsterArt, without touching entities', () => {
  const { ArtemisArenaRenderer } = load();
  const renderer = ArtemisArenaRenderer.create();
  const game = { chapter:{id:1},room:10,mode:'campaign', enemies:[], obstacles:[],floorDecals:[],wallTorches:[],portalRect:{x:0,y:0,w:0,h:0}};
  renderer.init(game);
  const fingerprints=new Set();
  for (const d of descriptors) {
    game.room=d.room;
    assert.equal(renderer._debug.pickBiome().id,'zodiac_leo');
    const entity={isBoss:true,type:d.type,campaignChapter:1,campaignRoom:d.room,r:43,
      hp:100,maxHp:100,attackTimer:.3,color:'#fbbf24'};
    const { c,actions,state }=canvas(), before=clean(entity);
    assert.equal(renderer._debug.drawLeoSubBoss(c,entity,1000),true);
    assert.equal(state.depth,0);
    assert.deepEqual(clean(entity),before);
    assert.ok(actions.filter(a=>a[0]==='ellipse').length >= 8,'detailed facial features');
    fingerprints.add(JSON.stringify(actions));
    assert.equal(renderer._debug.drawLeoSubBoss(c,{...entity,campaignChapter:2},1000),false);
    assert.equal(renderer._debug.drawLeoSubBoss(c,{...entity,type:'zodiac_leo'},1000),false);
  }
  assert.equal(fingerprints.size,4);
  const code=fs.readFileSync(new URL('../public/js/game/rendering/arena-renderer.js',import.meta.url),'utf8');
  assert.match(code,/const leoSubBossDrawn = !leoSpriteDrawn && drawLeoSubBoss/);
  assert.match(code,/!leoSpriteDrawn && !leoSubBossDrawn && .*MonsterArt.draw/);
  const admin=fs.readFileSync(new URL('../public/admin-campaign.js',import.meta.url),'utf8');
  assert.match(admin,/campaignChapter:c.id,campaignRoom:roomNo/);
});
