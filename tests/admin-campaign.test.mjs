import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Script } from "node:vm";
import { getCampaignSummaries, getCampaignDetail } from "../lib/campaignCatalog.js";

const source = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const catalogCode = fs.readFileSync(new URL("../lib/campaignCatalog.js", import.meta.url), "utf8");
const rendererCode = fs.readFileSync(new URL("../public/admin-campaign-renderer.js", import.meta.url), "utf8");
const adminHtml = fs.readFileSync(new URL("../public/admin.html", import.meta.url), "utf8");
const adminJs = fs.readFileSync(new URL("../public/admin-campaign.js", import.meta.url), "utf8");
const apiJs = fs.readFileSync(new URL("../api/admin/campaign.js", import.meta.url), "utf8");

function section(src, first, last) {
  const a = src.indexOf(first);
  assert.ok(a >= 0, "Missing " + first);
  const b = src.indexOf(last, a);
  assert.ok(b >= 0, "Missing closing marker for " + first);
  return src.slice(a, b + last.length).trim();
}

test("admin campaign catalog matches actual game definitions", () => {
  for (const [first, last] of [
    ["const CHAPTERS = [", "\n      ];"],
    ["const CAMPAIGN_TUNING = {", "\n      };"],
    ["const ZODIAC_ENEMY_POOLS = ", ";"],
    ["const POOLS = {", "\n  };"],
    ["const BOSS_ARENA = {", ";"],
  ]) {
    assert.equal(section(catalogCode, first, last), section(source, first, last), first + " drifted");
  }
});

test("admin monster renderer stays synchronized with game and handles Ch8+", () => {
  const gameArena = section(source, "const ArenaV2 = (() => {", "\n})();");
  assert.ok(rendererCode.includes(gameArena), "Admin sprite render is out of sync with public/index.html");
  assert.match(adminJs, /admin-campaign-renderer\.js/);
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
  assert.equal(list.length, 19);
  assert.deepEqual(list.map(x=>x.id),Array.from({length:19},(_,i)=>i+1));
  for(const ch of list) {
    assert.match(ch.mapAsset, /^\/assets\/map-ch\d+[-a-z0-9]*\.svg$/);
    assert.ok(fs.existsSync(new URL("../public" + ch.mapAsset, import.meta.url)), ch.mapAsset);
    const detail = getCampaignDetail(ch.id);
    assert.equal(detail.roomsDetail.length, ch.rooms);
    assert.equal(detail.roomsDetail.filter(r=>r.isBoss).length, ch.rooms===10?2:3);
    assert.ok(detail.enemyRoster.length>=3);
    for(const room of detail.roomsDetail) {
      assert.ok(room.biome, "biome missing C"+ch.id+"R"+room.room);
      assert.equal(room.isBoss,room.room%5===0||room.room===ch.rooms);
      if(room.isBoss) {
        assert.ok(room.boss.hp>0 && room.boss.atk>0);
        assert.ok(room.boss.type && room.boss.name);
      } else {
        assert.equal(room.count,Math.min(8,3+Math.floor(room.room/2)));
        assert.equal(room.mobs.reduce((sum,m)=>sum+m.quantity,0),room.count);
        assert.ok(room.mobs.every(m=>m.hp>0&&m.atk>0&&m.speed>=0));
      }
    }
  }
  assert.equal(getCampaignDetail(8).roomsDetail[14].boss.hp,102600);
  assert.equal(getCampaignDetail(8).roomsDetail[14].boss.atk,1508);
  assert.equal(getCampaignDetail(19).roomsDetail[14].boss.hp,577021);
  assert.equal(getCampaignDetail(20),null);
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
  const fakeWindow={};
  const Arena = new Function("window","document",rendererCode+"\nreturn window.AdminCampaignArenaV2;")(fakeWindow,doc);
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
