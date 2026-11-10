import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/campaign-wheel.js';
import {sanitizeSave} from '../lib/save/schema.js';
import {validateCampaignCheckpoint,validateCampaignWheelTransition} from '../lib/save/campaignCheckpoint.js';
const W=globalThis.ArtemisCampaignWheel;
const clean=cp=>sanitizeSave({dungeonCheckpoint:cp}).data.dungeonCheckpoint;
function entry(runId='wheel-server-run-1') {
 return {v:2,runId,boundary:'entry',roomCleared:false,rewardSettled:true,room:1,maxRooms:50,
 chapterId:1,chapterIdx:0,kills:0,runGold:17,player:{hp:100,maxHp:100,atk:10,skills:{}},
 runProgression:{version:1,seed:42,skills:{},choicesUsed:0,runSkillLevel:0,claimedStages:[],skippedValkyrieStages:[],pendingOffer:null}};
}
function accept(ledger,cp) {
 const r=validateCampaignCheckpoint(ledger,clean(cp));assert.equal(r.ok,true,r.error?.detail);return r;
}
function ready(runId,room=4) {
 const cp=entry(runId);let ledger=accept(null,cp).campaignCheckpoint;
 Object.assign(cp,{room,boundary:'cleared',roomCleared:true});
 ledger=accept(ledger,cp).campaignCheckpoint;
 cp.wheel=W.prepare({runId:cp.runId,chapter:cp.chapterId,room},null);
 ledger=accept(ledger,cp).campaignCheckpoint;
 return {cp,ledger};
}
test('real client claims every deterministic prize, server accepts exact gold and exposes scrolls once',()=>{
 const seen=new Set();
 for(let n=0;n<150;n++) {
  const {cp,ledger}=ready('wheel-server-run-'+n);
  const paid=structuredClone(cp),save={gearScrolls:{weapon:7}};
  const claim=W.claim({checkpoint:paid,save});assert.equal(claim.ok,true);
  const reward=claim.reward;seen.add(reward.index);
  const out=accept(ledger,paid);
  assert.deepEqual(out.wheelReceiptDelta,{ok:true,gold:reward.kind==='gold'?reward.amount:0,scrolls:reward.kind==='scroll'?reward.amount:0});
  assert.equal(save.gearScrolls.weapon-7,out.wheelReceiptDelta.scrolls);
  assert.deepEqual(accept(out.campaignCheckpoint,paid).wheelReceiptDelta,{ok:true,gold:0,scrolls:0});
  assert.equal(W.claim({checkpoint:paid,save}).ok,false);
  const replay=structuredClone(paid);replay.runGold+=reward.amount;
  assert.equal(validateCampaignCheckpoint(out.campaignCheckpoint,clean(replay)).ok,false);
  for(const delta of [-1,1]) {
   const bad=structuredClone(paid);bad.runGold+=delta;
   assert.equal(validateCampaignCheckpoint(ledger,clean(bad)).ok,false);
  }
 }
 assert.deepEqual([...seen].sort(),[0,1,2,3,4,5]);
});
test('malformed/foreign/index forged/removed receipts fail closed through schema, without repair',()=>{
 const {cp,ledger}=ready();
 for(const mutate of [p=>delete p.wheel,p=>p.wheel=null,p=>p.wheel.index=(p.wheel.index+1)%6,
 p=>p.wheel.runId='foreign-run-123',p=>p.wheel.chapter=2,p=>p.wheel.room=14,
 p=>p.wheel.status='paid',p=>p.wheel.version=2,p=>p.wheel.index=String(p.wheel.index),
 p=>p.wheel.extra=1,p=>p.wheel={},p=>p.wheel={...p.wheel,status:{nested:true}}]) {
  const bad=structuredClone(cp);mutate(bad);
  assert.equal(validateCampaignCheckpoint(ledger,clean(bad)).ok,false);
 }
 const paid=structuredClone(cp);assert.equal(W.claim({checkpoint:paid,save:{}}).ok,true);
 const after=accept(ledger,paid).campaignCheckpoint;
 assert.equal(validateCampaignCheckpoint(after,clean(cp)).ok,false);
});
test('requires saved ready receipt and same cleared boundary; no new run preclaim',()=>{
 const {cp,ledger}=ready();
 const paid=structuredClone(cp);W.claim({checkpoint:paid,save:{}});
 assert.equal(validateCampaignCheckpoint({active:{...ledger.active,wheel:undefined},retired:[]},clean(paid)).ok,false);
 const later=structuredClone(paid);later.room=5;
 assert.equal(validateCampaignCheckpoint(ledger,clean(later)).ok,false);
 const fresh=entry('wheel-server-fresh');fresh.wheel=cp.wheel;
 assert.equal(validateCampaignCheckpoint(null,clean(fresh)).ok,false);
 assert.equal(validateCampaignWheelTransition(null,clean(paid)).ok,false);
 const future=structuredClone(cp);future.wheel=W.prepare({runId:cp.runId,chapter:1,room:14});
 assert.equal(validateCampaignCheckpoint(ledger,clean(future)).ok,false);
});
test('receipt survives later rooms, advances to each next wheel, rejects past-room resurrection',()=>{
 let {cp,ledger}=ready();
 for(const room of [4,14,24,34,44]) {
  if(room!==4) {
   cp.room=room;cp.wheel=W.prepare({runId:cp.runId,chapter:1,room},cp.wheel);
   ledger=accept(ledger,cp).campaignCheckpoint;
  }
  W.claim({checkpoint:cp,save:{}});ledger=accept(ledger,cp).campaignCheckpoint;
  cp.room=room+1;ledger=accept(ledger,cp).campaignCheckpoint;
  const back=structuredClone(cp);back.wheel.status='ready';
  assert.equal(validateCampaignCheckpoint(ledger,clean(back)).ok,false);
 }
 const ended=accept(ledger,null).campaignCheckpoint;
 assert.equal(validateCampaignCheckpoint(ended,clean(cp)).ok,false);
});
test('claim gold remains exact even while normal loot settlement closes',()=>{
 const {cp,ledger}=ready();cp.rewardSettled=false;ledger.active.rewardSettled=false;
 const paid=structuredClone(cp);W.claim({checkpoint:paid,save:{}});paid.rewardSettled=true;
 accept(ledger,paid);
 const inflated=structuredClone(paid);inflated.runGold++;
 assert.equal(validateCampaignCheckpoint(ledger,clean(inflated)).ok,false);
});
test('null receipt is optional before encounter but cannot erase a saved wheel',()=>{
 const cp=entry();cp.wheel=null;accept(null,cp);
 const {cp:offered,ledger}=ready();offered.wheel=null;
 assert.equal(validateCampaignCheckpoint(ledger,clean(offered)).ok,false);
});
test('new numeric offers only safe stages, legacy existing claims and pending offers finish safely',()=>{
 for(const stage of [5,15,25,35,45,10,20,30,40]) {
  const cp=entry();let ledger=accept(null,cp).campaignCheckpoint;
  Object.assign(cp,{room:stage,boundary:'cleared',roomCleared:true});
  ledger=accept(ledger,cp).campaignCheckpoint;
  cp.runProgression.pendingOffer={stageId:stage,provider:'valkyrie',skillIds:['max_hp_up'],segment:0,seraph:false,pity:false,rerollLimit:1,rerollsUsed:0};
  assert.equal(validateCampaignCheckpoint(ledger,clean(cp)).ok,stage%10===5);
 }
 const cp=entry();Object.assign(cp,{room:10,boundary:'cleared',roomCleared:true});
 cp.runProgression.pendingOffer={stageId:10,provider:'valkyrie',skillIds:['max_hp_up'],segment:0,seraph:false,pity:false,rerollLimit:1,rerollsUsed:0};
 let ledger={active:clean(cp),retired:[]};ledger=accept(ledger,cp).campaignCheckpoint;
 cp.player.skills={max_hp_up:1};Object.assign(cp.runProgression,{skills:{max_hp_up:1},choicesUsed:1,runSkillLevel:1,claimedStages:[10],pendingOffer:null});
 ledger=accept(ledger,cp).campaignCheckpoint;cp.room=11;accept(ledger,cp);
});
