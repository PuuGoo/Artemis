import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Script, runInNewContext } from "node:vm";
import { getCampaignSummaries, getCampaignDetail } from "../lib/campaignCatalog.js";
import '../public/campaign-config.js';
import '../public/campaign-rooms.js';
import '../public/campaign-skills.js';
const campaign = globalThis.ArtemisCampaignConfig;
const encounters = globalThis.ArtemisCampaignRooms;

test('catalog projects the real encounter roster, elite modifiers and subboss variants', () => {
  for (const chapter of getCampaignSummaries()) {
    const detail = getCampaignDetail(chapter.id);
    for (const room of detail.roomsDetail) {
      const plan = encounters.roomPlan(chapter.id, room.room);
      const roster = encounters.getRoster(chapter.id, room.room);
      assert.equal(room.archetype, plan.archetype);
      assert.equal(room.rhythm, plan.rhythm);
      assert.equal(room.pressureBudget, plan.pressureBudget);
      assert.equal(room.count, roster.length);
      const projected = room.isBoss ? [room.boss] : room.mobs.flatMap(m => Array(m.quantity).fill(m));
      const expected = roster.map((entry, index) => {
        const mod = encounters.getModifiers(chapter.id, room.room, index);
        return { type:entry.type, role:entry.role, pressure:entry.pressure, isElite:entry.isElite,
          hpMultiplier:mod.hpMultiplier, atkMultiplier:mod.atkMultiplier,
          speedMultiplier:mod.speedMultiplier, sizeMultiplier:mod.sizeMultiplier };
      });
      assert.deepEqual(projected.map(e => ({type:e.type,role:e.role,pressure:e.pressure,isElite:e.isElite,
        hpMultiplier:e.modifiers.hpMultiplier,atkMultiplier:e.modifiers.atkMultiplier,
        speedMultiplier:e.modifiers.speedMultiplier,sizeMultiplier:e.modifiers.sizeMultiplier})), expected);
      if (room.isBoss) {
        const variant = encounters.getModifiers(chapter.id, room.room, 0).bossVariant;
        if (variant) { assert.equal(room.boss.name,variant.name); assert.equal(room.boss.color,variant.color); }
      }
      assert.deepEqual(room.rarityRates, globalThis.ArtemisCampaignSkills.rarityWeights(plan.segment, false));
    }
  }
});

const source = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const catalogCode = fs.readFileSync(new URL("../lib/campaignCatalog.js", import.meta.url), "utf8");
const rendererCode = fs.readFileSync(new URL("../public/js/game/rendering/arena-renderer.js", import.meta.url), "utf8");
const adminHtml = fs.readFileSync(new URL("../public/admin.html", import.meta.url), "utf8");
const adminJs = fs.readFileSync(new URL("../public/admin-campaign.js", import.meta.url), "utf8");
const apiJs = fs.readFileSync(new URL("../api/admin/campaign.js", import.meta.url), "utf8");

function section(src, first, last) {
  const a = src.indexOf(first);
  assert.ok(a >= 0, "Missing " + first);
  const b = src.indexOf(last, a);
  assert.ok(b >= 0, "Missing closing marker for " + first);
  return src.slice(a, b + last.length).replace(/\r\n/g, '\n').trim();
}

test("admin campaign catalog matches actual game definitions", () => {
  for (const [first, last] of [
    ["const CHAPTERS = [", "\n      ];"],
    ["const CAMPAIGN_TUNING = {", "\n      };"],
    ["const ZODIAC_ENEMY_POOLS = ", ";"],
    ["const POOLS = {", "\n  };"],
    ["const BOSS_ARENA = {", ";"],
  ]) {
    const actual = first === 'const POOLS = {' || first === 'const BOSS_ARENA = {' ? rendererCode : source;
    assert.equal(section(catalogCode, first, last), section(actual, first, last), first + " drifted");
  }
});

test("admin monster renderer stays synchronized with game and handles Ch8+", () => {
  assert.match(source, /const ArenaV2 = ArtemisArenaRenderer.create\(\)/);
  assert.match(adminJs, /window.AdminCampaignArenaV2 = window.ArtemisArenaRenderer.create\(\)/);
  assert.match(adminJs, /script.src="\/js\/game\/rendering\/arena-renderer\.js"/);
  assert.doesNotMatch(source, /const BIOMES =/);
});

test("admin UI remains read-only and guarded by existing admin identity", () => {
  assert.match(adminHtml, /id="tabCampaign"/);
  assert.match(adminHtml, /id="adminCampaignPane"/);
  assert.match(adminJs, /\/api\/admin\/campaign/);
  assert.match(apiJs, /await requireAdmin\(request\)/);
  assert.match(apiJs, /export async function GET\(request\)/);
  assert.doesNotMatch(apiJs, /export async function (PATCH|POST|PUT|DELETE)/);
  new Script(adminJs);
  new Script(rendererCode);
});

test("all chapters, every room and all map assets have valid details", () => {
  const list=getCampaignSummaries();
  assert.equal(list.length, 12);
  assert.deepEqual(list.map(x=>x.id),Array.from({length:12},(_,i)=>i+1));
  for(const ch of list) {
    assert.match(ch.mapAsset, /^\/assets\/map-ch\d+[-a-z0-9]*\.svg$/);
    assert.ok(fs.existsSync(new URL("../public" + ch.mapAsset, import.meta.url)), ch.mapAsset);
    const detail = getCampaignDetail(ch.id);
    assert.equal(detail.roomsDetail.length, ch.rooms);
    assert.equal(ch.rooms,campaign.ROOM_COUNT);
    assert.equal(detail.roomsDetail.filter(r=>r.isBoss).length,5);
    assert.deepEqual(detail.valkyrieRooms,[5,15,25,35,45]);
    assert.deepEqual(detail.skillRarities,Array.from(campaign.SKILL_RARITIES));
    assert.ok(detail.enemyRoster.length>=3);
    for(const room of detail.roomsDetail) {
      assert.ok(room.biome, "biome missing C"+ch.id+"R"+room.room);
      const plan=encounters.roomPlan(ch.id,room.room);
      assert.equal(room.isBoss,plan.isBoss);
      assert.equal(room.valkyrie,plan.valkyrie);
      assert.equal(room.segment,plan.segment);
      assert.equal(room.type,plan.type);
      const tuned=campaign.tuning(detail.base,room.room);
      for(const key of ['mobHp','mobAtk','bossHp','bossAtk']) assert.equal(room[key],tuned[key]);
      if(plan.valkyrie) {
        assert.equal(room.count,0);
        assert.deepEqual(room.mobs,[]);
        assert.equal(room.boss,null);
        assert.equal(room.pressure,0);
        assert.equal(room.eliteCount,0);
      }
      if(room.isBoss) {
        assert.ok(room.boss.hp>0 && room.boss.atk>0);
        assert.ok(room.boss.type && room.boss.name);
        assert.equal(room.boss.type,plan.bossType);
      } else {
        assert.equal(room.count,encounters.getRoster(ch.id,room.room).length);
        assert.equal(room.mobs.reduce((sum,m)=>sum+m.quantity,0),room.count);
        assert.ok(room.mobs.every(m=>m.hp>0&&m.atk>0&&m.speed>=0));
      }
    }
  }
  assert.equal(getCampaignDetail(8).roomsDetail[49].boss.hp,102600);
  assert.equal(getCampaignDetail(8).roomsDetail[49].boss.atk,1508);
  assert.equal(getCampaignDetail(12).roomsDetail[49].boss.hp,campaign.tuning(getCampaignDetail(12).base,50).bossHp);
  assert.equal(getCampaignDetail(13),null);
});

test('shared skill rarity identifiers match the actual skill registry', () => {
  const skills=section(source,'const ROGUE_SKILLS = [','\n      ];');
  assert.deepEqual([...new Set([...skills.matchAll(/rarity:\s*'([^']+)'/g)].map(m=>m[1]))].sort(),Array.from(campaign.SKILL_RARITIES).sort());
});

test('admin renders real 50-room detail, five bosses, Valkyrie offers and skill rarities', async () => {
  const nodes = new Map();
  function node(id) {
    if(!nodes.has(id)) nodes.set(id,{innerHTML:'',textContent:'',addEventListener(){},querySelectorAll(){return []}});
    return nodes.get(id);
  }
  const root={innerHTML:'',querySelector(s){return node(s)},querySelectorAll(){return []},addEventListener(){},closest(){return null}};
  const window={};
  runInNewContext(adminJs,{window,document:{hidden:true,addEventListener(){},querySelector(){return null},createElement(){return {dataset:{}}},head:{appendChild(s){if(s.onerror)s.onerror()}}},
    location:{hash:''},performance:{now(){return 0}},console:{warn(){},error(){}},requestAnimationFrame(){return 1},cancelAnimationFrame(){}});
  window.AdminCampaignUI.mount(root,{esc(s){return String(s??'')},num(n){return String(n)},api(url){return Promise.resolve({data:url.includes('?')?{ok:true,chapter:getCampaignDetail(1)}:{ok:true,chapters:getCampaignSummaries()}})}});
  await new Promise(resolve=>setImmediate(resolve));
  const markup=node('#ccDetail').innerHTML;
  assert.match(markup,/50 PHÒNG/);
  assert.match(markup,/5 trùm/);
  assert.match(markup,/Valkyrie/);
  for(const rarity of campaign.SKILL_RARITIES) assert.ok(markup.includes(rarity),rarity);
  assert.match(node('#ccRoomNav').innerHTML,/Valkyrie sau khi dọn phòng/);
  assert.match(node('#ccRoomStats').innerHTML,/Dạng đội hình/);
  assert.match(node('#ccRoomStats').innerHTML,/Áp lực đạn/);
  assert.match(node('#ccEntities').innerHTML,/Vai trò/);
  assert.match(node('#ccEntities').innerHTML,/Bán kính/);
  assert.match(markup,/data-rarity-segment="4"/);
  assert.match(markup,/Phòng nghỉ/);
  assert.doesNotMatch(markup,/phòng 5\/10/);
});

test('admin GET uses the shared catalog while preserving authorization and read-only behavior', async () => {
  let allowed=false;
  const sandbox={URL,requireAdmin:async()=>allowed?{ok:true}:{ok:false,response:{status:403}},
    json:data=>({status:200,data}),fail:(error,status)=>({status,data:{error}}),getCampaignSummaries,getCampaignDetail};
  runInNewContext(apiJs.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'' )+'\nthis.routeGET=GET;',sandbox);
  assert.equal((await sandbox.routeGET({url:'http://local/api/admin/campaign?chapter=1'})).status,403);
  allowed=true;
  const result=await sandbox.routeGET({url:'http://local/api/admin/campaign?chapter=12'});
  assert.equal(result.data.chapter.roomsDetail.length,50);
  assert.equal(result.data.readOnly,true);
  assert.equal((await sandbox.routeGET({url:'http://local/api/admin/campaign?chapter=01'})).status,400);
  assert.equal((await sandbox.routeGET({url:'http://local/api/admin/campaign?chapter=13'})).status,404);
});

test("real Canvas renderer can draw every campaign room and creature without throwing", () => {
  const gradient={ addColorStop() {} };
  const ctx=new Proxy({
    globalAlpha:1,lineWidth:1,canvas:{width:780,height:420},
    createLinearGradient(){return gradient},
    createRadialGradient(){return gradient},
    measureText(){return {width:20}},
  },{
    get(o,k){if(k in o)return o[k];return (...args)=>{
      assert.ok(args.every(x=>typeof x!=="number"||Number.isFinite(x)),"Invalid canvas coordinate: "+String(k));
    };},
    set(o,k,v){o[k]=v;return true;}
  });
  const doc={createElement(){return {width:780,height:420,getContext(){return ctx}}},getElementById(){return null}};
  const context = { document: doc };
  runInNewContext(rendererCode, context);
  const Arena = context.ArtemisArenaRenderer.create();
  assert.ok(Arena && Arena.drawArena && Arena.drawMonster);
  for(const ch of getCampaignSummaries()) {
    for(const room of getCampaignDetail(ch.id).roomsDetail) {
      const enemies=room.isBoss?[{...room.boss,isBoss:true,r:55,x:390,y:170}]:
        room.mobs.map((m,i)=>({...m,isBoss:false,r:m.radius,x:180+i*160,y:170}));
      enemies.forEach(e=>Object.assign(e,{maxHp:e.hp,hitFlashTimer:0,slowTimer:0,burnTimer:0,attackTimer:1.5,vx:0,vy:0}));
      Arena.init({
        chapter:{id:ch.id,rooms:ch.rooms},room:room.room,maxRooms:ch.rooms,
        wallPad:36,width:780,height:420,floorDecals:[],wallTorches:[],obstacles:[],
        enemies,portalRect:{x:370,y:15,w:40,h:46},portalOpen:false,ultraGfx:false
      });
      assert.doesNotThrow(()=>{
        Arena.drawArena(ctx,780,420,36,2600,ch.id);
        enemies.forEach(e=>Arena.drawMonster(ctx,e,2600));
      },"C"+ch.id+"R"+room.room+" cannot render");
    }
  }
});
