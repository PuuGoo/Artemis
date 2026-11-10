import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function load(){const s={};for(const name of ['campaign-config','campaign-rooms','campaign-skills','campaign-wheel']){const p=new URL(`../public/${name}.js`,import.meta.url);if(fs.existsSync(p))vm.runInNewContext(fs.readFileSync(p,'utf8'),s);}return s;}
const plain=x=>JSON.parse(JSON.stringify(x));
test('all 19 chapters generate exactly five empty safe rooms and preserve five bosses',()=>{
 const A=load().ArtemisCampaignRooms;
 for(let c=1;c<=19;c++) for(let r=1;r<=50;r++){
  const safe=[5,15,25,35,45].includes(r),p=A.roomPlan(c,r);
  assert.equal(A.isSafeRoom(r),safe);assert.equal(p.isSafeRoom,safe);
  if(safe){assert.equal(p.type,'safe');assert.equal(p.count,0);assert.equal(p.valkyrie,true);assert.deepEqual(plain(A.getRoster(c,r)),[]);assert.equal(A.getModifiers(c,r,0).hpMultiplier,1);}
  else {assert.ok(p.count>0);assert.equal(p.valkyrie,false);}
  assert.equal(p.isBoss,r%10===0);
 }
});
test('numeric Valkyrie offers only safe rooms, two cards before and after reroll/reload',()=>{
 const A=load().ArtemisCampaignSkills,cat=Array.from({length:6},(_,i)=>({id:'skill'+i,rarity:'common'}));
 assert.equal(A.generateOffer({},cat,{stageId:'start'}).offer.skillIds.length,3);
 for(let r=1;r<=50;r++){
  const x=A.generateOffer({},cat,{stageId:r});assert.equal(x.ok,r%10===5);
  if(x.ok){assert.equal(x.offer.skillIds.length,2);assert.equal(A.rerollOffer(plain(x.state),cat).offer.skillIds.length,2);}
 }
 assert.equal(A.normalizeState({pendingOffer:{stageId:10,provider:'valkyrie',skillIds:['skill0']}},cat).pendingOffer,null);
});
test('wheel selects a deterministic real reward, grants once, reloads claimed receipt',()=>{
 const W=load().ArtemisCampaignWheel;assert.ok(W,'wheel module');
 const seen=new Set();
 for(let n=0;n<200;n++){
  const cp={runId:'run_test_'+n,chapterId:3,room:4,roomCleared:true,boundary:'cleared',runGold:17},save={gearScrolls:{weapon:2,armor:9}};
  const opts={runId:cp.runId,chapter:cp.chapterId,room:cp.room};
  const a=W.prepare(opts);cp.wheel=a;seen.add(a.index);
  assert.deepEqual(plain(W.prepare(opts,plain(a))),plain(a));
  const expected=W.outcome(opts);const granted=W.claim({checkpoint:cp,save});assert.equal(granted.ok,true);
  assert.equal(cp.runGold,17+(expected.kind==='gold'?expected.amount:0));
  assert.equal(save.gearScrolls.weapon,2+(expected.kind==='scroll'?expected.amount:0));assert.equal(save.gearScrolls.armor,9);
  const reloaded=plain({cp,save}),before=JSON.stringify(reloaded);
  assert.equal(W.claim({checkpoint:reloaded.cp,save:reloaded.save}).ok,false);assert.equal(JSON.stringify(reloaded),before);
  assert.equal(W.prepare(opts,reloaded.cp.wheel).status,'claimed');
 }
 assert.equal(seen.size,6);
 assert.deepEqual(plain(W.REWARDS).map(x=>[x.kind,x.amount]),[['gold',1260],['gold',630],['gold',630],['gold',420],['scroll',3],['scroll',6]]);
});
test('wheel session blocks parallel starts, skips same outcome, and retries failed save without grants',async()=>{
 const W=load().ArtemisCampaignWheel,cp={runId:'run_session_123',chapterId:2,room:4,roomCleared:true,boundary:'cleared',runGold:0},save={gearScrolls:{}};
 cp.wheel=W.prepare({runId:cp.runId,chapter:2,room:4});let calls=0;
 const session=W.createSession({checkpoint:cp,save,persist:async()=>{calls++;if(calls===1)throw Error('offline');return true;}});
 const a=session.start(),b=session.start();assert.equal(a,b);assert.equal(session.state,'saving');session.settle();assert.equal(session.state,'saving');
 assert.equal(await a,false);assert.equal(session.state,'error');const paid=JSON.stringify({cp,save});
 assert.equal(await session.start(),true);assert.equal(JSON.stringify({cp,save}),paid);assert.equal(calls,2);
 assert.equal(session.state,'spinning');session.settle();session.settle();assert.equal(session.state,'reward');
 await session.start();assert.equal(calls,2);assert.equal(JSON.stringify({cp,save}),paid);
 const loaded=W.createSession({checkpoint:plain(cp),save:plain(save),persist:()=>assert.fail('claimed reload must not persist')});assert.equal(loaded.state,'reward');await loaded.start();
});
test('wheel rejects unsafe boundaries, forged indexes and mismatched receipt without mutation',()=>{
 const W=load().ArtemisCampaignWheel;assert.ok(W);
 for(const patch of [{roomCleared:false},{room:5},{boundary:'entry'},{chapterId:20}]){
  const cp={runId:'run_test_99',chapterId:1,room:4,roomCleared:true,boundary:'cleared',runGold:0,...patch},save={gearScrolls:{}};
  const before=JSON.stringify({cp,save});assert.equal(W.claim({checkpoint:cp,save}).ok,false);assert.equal(JSON.stringify({cp,save}),before);
 }
 const cp={runId:'run_test_99',chapterId:1,room:4,roomCleared:true,boundary:'cleared',runGold:0};
 cp.wheel=W.prepare({runId:cp.runId,chapter:1,room:14});
 assert.equal(W.claim({checkpoint:cp,save:{gearScrolls:{}}}).ok,false,'receipt must be prepared for this exact room');
 cp.wheel=W.prepare({runId:cp.runId,chapter:1,room:4});cp.wheel.index=(cp.wheel.index+1)%6;
 assert.equal(W.claim({checkpoint:cp,save:{gearScrolls:{}}}).ok,false);
});
