import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/save/schema.js';
import { validateCampaignCheckpoint } from '../lib/save/campaignCheckpoint.js';
import '../public/campaign-encounters.js';
const domain=globalThis.ArtemisCampaignEncounters;
const runId='encounter-test-01';
function checkpoint(room=9){return {v:2,runId,chapterId:1,chapterIdx:0,room,maxRooms:50,boundary:'cleared',roomCleared:true,rewardSettled:true,kills:10,runGold:0,player:{hp:50,maxHp:100,skills:{}},runProgression:{skills:{},claimedStages:[],skippedValkyrieStages:[],choicesUsed:0,seed:1},support:{version:1,pending:null,receipts:[],finished:false}};}
const validate=(old,next)=>validateCampaignCheckpoint({active:old,retired:[]},next);
const catalog=globalThis.ArtemisCampaignLegendCatalog;
const ctx=cp=>({runId,stage:cp.room,hp:cp.player.hp,maxHp:cp.player.maxHp,bossDefeated:cp.roomCleared,catalog});
function step(cp,action,choice){const r=domain.transition(cp.encounters,ctx(cp),action,choice);assert.equal(r.ok,true);return {...structuredClone(cp),encounters:r.state,player:{...cp.player,hp:r.hp,maxHp:r.maxHp}};}
function base(room=9){const cp=checkpoint(room);cp.support=globalThis.CampaignSupport.normalize(null);cp.encounters=domain.create(runId);return cp;}
function ok(old,next){const result=validate(old,next);assert.equal(result.ok,true,JSON.stringify(result));return result;}
function bad(old,next){assert.equal(validate(old,next).ok,false);}
test('empty encounter adoption is allowed without touching legacy skill budget',()=>{
 const old=checkpoint();old.support=globalThis.CampaignSupport.normalize(null);ok(old,{...old,encounters:domain.create(runId)});
});
test('angel exact offer and max HP claim replay, duplicate save is idempotent',()=>{
 const old=base(),offered=step(old,'offer');ok(old,offered);
 const claimed=step(offered,'claim','maxHp'),result=ok(offered,claimed);
 assert.equal(claimed.player.hp,60);assert.equal(claimed.player.maxHp,110);assert.equal(result.encounterTransition.hpChanged,true);assert.equal(result.encounterTransition.grant,null);ok(claimed,claimed);
 bad(offered,{...claimed,player:{...claimed.player,hp:61}});bad(claimed,offered);
});
test('angel heal and refusal require a saved offer',()=>{
 for(const choice of ['heal','refuse']){const old=base(),offered=step(old,'offer'),claimed=step(offered,'claim',choice);ok(offered,claimed);bad(old,claimed);}
});
test('devil deterministic reroll and exact HP-only grant without progression change',()=>{
 const old=base(10),offered=step(old,'offer');ok(old,offered);
 const rerolled=step(offered,'reroll');ok(offered,rerolled);assert.notEqual(offered.encounters.pending.skillId,rerolled.encounters.pending.skillId);
 const claimed=step(rerolled,'claim','accept'),result=ok(rerolled,claimed);
 assert.equal(claimed.player.hp,35);assert.equal(claimed.player.maxHp,85);
 assert.equal(result.encounterTransition.grant.skillId,rerolled.encounters.pending.skillId);
 assert.deepEqual(claimed.runProgression,old.runProgression);bad(offered,claimed);
 const forged=structuredClone(offered);forged.encounters.pending.skillId='power_trio';bad(old,forged);
 bad(rerolled,{...claimed,player:{...claimed.player,maxHp:100}});
});
test('rejects removal, forged prior receipts, boundary jumps, reroll resets and non-HP side effects',()=>{
 const old=base(10),offered=step(old,'offer'),rerolled=step(offered,'reroll'),claimed=step(rerolled,'claim','accept');
 const removed=structuredClone(claimed);delete removed.encounters;bad(claimed,removed);
 bad(rerolled,offered);bad(old,{...offered,room:20});
 for(const alter of [cp=>cp.player.atk=999,cp=>cp.runGold++,cp=>cp.kills++,cp=>cp.rewardSettled=false,cp=>cp.encounters.receipts[0].grant.skillId='power_trio']){const forged=structuredClone(claimed);alter(forged);bad(rerolled,forged);}
 const insufficient={...offered,player:{...offered.player,hp:15}};bad(insufficient,step(offered,'claim','accept'));
});
test('all nine encounter stages survive real schema and ledger round trips',()=>{
 let old=base(9);
 for(const stage of [9,10,19,20,29,30,39,40,49]){
   const reached={...structuredClone(old),room:stage};ok(old,reached);old=reached;
   for(const action of ['offer','claim']){
     const next=step(old,action,domain.kindAt(stage)==='angel'?'maxHp':'accept');
     const sanitized=sanitizeSave({dungeonCheckpoint:next});assert.equal(sanitized.ok,true);
     const clean=sanitized.data.dungeonCheckpoint;
     // The real pipeline always compares sanitized checkpoints on both sides.
     const prior=sanitizeSave({dungeonCheckpoint:old}).data.dungeonCheckpoint;
     ok(prior,clean);old=clean;
   }
 }
 assert.equal(old.encounters.receipts.length,9);
 const removed=structuredClone(old);removed.encounters.receipts.shift();bad(old,removed);
 const entry={...base(),room:1,boundary:'entry',roomCleared:false};ok(null,entry);
 const preclaim=step(step(base(),'offer'),'claim','heal');bad(null,{...entry,encounters:preclaim.encounters});
});
test('schema bounds malformed encounter input without silently granting',()=>{
 for(const value of [null,[],{...domain.create(runId),receipts:Array(100).fill({})},{...domain.create(runId),pending:{skillId:'bogus'}}]){
 const cp=base();cp.encounters=value;const sanitized=sanitizeSave({dungeonCheckpoint:cp}).data.dungeonCheckpoint;
 assert.deepEqual(sanitized.encounters,{});bad(base(),sanitized);
 }
 const cp=base();cp.player.skills={atk_boost:11};assert.equal(sanitizeSave({dungeonCheckpoint:cp}).ok,false);
});
test('catalog metadata matches every real ROGUE_SKILLS legend',async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const source=html.slice(html.indexOf('const ROGUE_SKILLS = [')+'const ROGUE_SKILLS = '.length);const end=source.indexOf('\n      ];');
 const real=runInNewContext('('+source.slice(0,end+8).trim()+')');
 assert.deepEqual(JSON.parse(JSON.stringify(real.filter(s=>s.rarity==='legend').map(({id,name,rarity,providers})=>({id,name,rarity,providers})))),JSON.parse(JSON.stringify(catalog)));
});
test('schema preserves bounded empty encounters and legacy omission',()=>{
 const cp=checkpoint();cp.encounters=domain.create(runId);
 assert.deepEqual(sanitizeSave({dungeonCheckpoint:cp}).data.dungeonCheckpoint.encounters,cp.encounters);
 delete cp.encounters;assert.equal(Object.hasOwn(sanitizeSave({dungeonCheckpoint:cp}).data.dungeonCheckpoint,'encounters'),false);
});
