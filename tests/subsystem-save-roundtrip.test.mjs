import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sanitizeSave, MAX_SAVE_BYTES } from '../lib/saveSchema.js';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function between(a, b) { const i=html.indexOf(a), j=html.indexOf(b,i+a.length); assert.ok(i>=0&&j>i); return html.slice(i,j); }
const fields=['gameMode','modeBest','guild','garden','plinko'];
const clone=x=>JSON.parse(JSON.stringify(x));
function runtime() {
  const window={__ARTEMIS_SAVE_READY:true,dispatchEvent(){}};
  const ctx=vm.createContext({window, console, CustomEvent:class{},
    createDefaultEquipped:()=>({weapon:null}),createDefaultBag:()=>[],createDefaultPresets:()=>({}),createDefaultGearLoadouts:()=>({}),
    GEAR_SLOTS_META:{weapon:{}},normalizeGearItem:x=>x||null,HEROES:[]});
  vm.runInContext(between('const SaveState = {','      /**\n       * Ảnh chụp trạng thái mặc định')+';globalThis.S=SaveState;',ctx);
  vm.runInContext(between('const GUILD_NAME_POOL = [','      // ---------- Màn hiển thị ----------'),ctx);
  vm.runInContext(between('const GARDEN_SEEDS = [','      // ==================== MÙA GIẢI (season)'),ctx);
  vm.runInContext(between('const PLINKO_ROWS = 8;','      // ---------------------------------------------------------------------\n      // HIỂN THỊ: canvas'),ctx);
  Object.assign(ctx,{showToast(){},getComputedStats:()=>({baseAtk:100})});
  return {S:ctx.S,window,run:code=>vm.runInContext(code,ctx)};
}
function populated() {
  const f=runtime();
  Object.assign(f.S,{gold:987654321,gems:7654321,stamina:321,playerLevel:177,
    equippedGear:{weapon:{uid:'old_mythic',templateId:'rusty_bow',quality:'mythic',level:100,awakening:6,locked:true,favorite:true,sockets:[],affixes:[]},necklace:null,ring:null,armor:null,helmet:null,boots:null},
    gearBag:[],heroStars:{alex:0,thor:8},starterWeaponGranted:true,
    season:{season:1,career:'ranger',tokens:740,boss:null,bossHp:0,bossMaxHp:0,bossDefeated:false,powerSacrificed:0.04,log:[]}});
  f.run("createGuild('Bang Cũ'); ensureGarden(); buySeed('voidbloom'); plantSeed(0,'voidbloom'); waterPlot(0); plinkoPlay(1000);");
  f.S.gameMode='tower'; f.S.modeBest={endless:37,tower:12,future_mode:5};
  f.S.guild.expedition={floor:123,best:456}; f.S.guild.boss.defeated=true; f.S.guild.boss.hp=0;
  f.S.garden.seeds.sprout=0; f.S.garden.seeds.future_seed=44; f.S.garden.totalHarvest=123456789;
  f.S.garden.weekTask={done:10,target:10,claimed:true};
  return f;
}
test('writer thật -> sanitizer -> load thật giữ 5 subsystem và tài sản save cũ, không seed lại',()=>{
  const f=populated(), expected=clone(f.S);
  f.S.save(); const payload=JSON.parse(f.window.__ARTEMIS_SAVE_BUFFER);
  for(const key of fields) assert.deepEqual(payload[key],expected[key],`writer mất ${key}`);
  const result=sanitizeSave(payload); assert.equal(result.ok,true,result.reason);
  const reload=runtime(); reload.window.__ARTEMIS_SAVE_BUFFER=JSON.stringify(result.data); reload.S.load();
  for(const key of [...fields,'gold','gems','stamina','playerLevel','equippedGear','heroStars','season']) assert.deepEqual(clone(reload.S[key]),expected[key],`load đổi ${key}`);
  reload.run('ensureGarden();ensurePlinko();');
  assert.equal(reload.S.garden.seeds.sprout,0); assert.equal(reload.S.plinko.balls,1);
  assert.equal(reload.S.guild.boss.defeated,true); assert.equal(reload.S.garden.weekTask.claimed,true);
  assert.equal(reload.S.beginnerJourney.startedAt,0);
  reload.S.save(); const again=sanitizeSave(JSON.parse(reload.window.__ARTEMIS_SAVE_BUFFER));
  for(const key of fields) assert.deepEqual(again.data[key],expected[key]);
});
