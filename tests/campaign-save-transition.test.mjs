import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/campaign-skills.js';
import '../public/campaign-support.js';
import '../public/campaign-telemetry.js';
const support = globalThis.CampaignSupport;
const telemetry = globalThis.ArtemisCampaignTelemetry;
const progression = globalThis.ArtemisCampaignSkills;
const { validateCampaignCheckpoint } = await import('../lib/save/campaignCheckpoint.js');
const { sanitizeSave } = await import('../lib/save/schema.js');

test('schema uses actual bounded support and telemetry normalizers, optional for legacy',()=>{
  const cp=checkpoint();
  cp.support={receipts:[{stage:10,choice:'devil'},{stage:20,choice:'devil'},{stage:30,choice:'devil'},{stage:40,choice:'devil'}],damageBonus:999,skills:{multishot:9}};
  cp.telemetry={version:1,damageTaken:1e20,damageDealt:-1,stats:{baseAtk:Infinity},gold:999,
    incomingByEnemy:Object.fromEntries(Array.from({length:200},(_,i)=>['enemy'+i,1e20]))};
  const out=clean(cp);
  assert.deepEqual(out.support,support.normalize(cp.support));
  assert.ok(out.support.damageBonus<=0.15);
  assert.deepEqual(out.telemetry,telemetry.normalize(cp.telemetry));
  assert.ok(Object.keys(out.telemetry.incomingByEnemy).length<=32);
  assert.equal(Object.hasOwn(clean(checkpoint()),'support'),false);
  assert.equal(Object.hasOwn(clean(checkpoint()),'telemetry'),false);
});
const catalog = ['max_hp_up','multishot','attack_boost','pierce'].map(id=>({id,rarity:'common',providers:['valkyrie']}));

test('schema retains only entry room one or cleared v2 boundaries and known receipt stages',()=>{
  const bad=checkpoint();bad.room=2;
  assert.equal(sanitizeSave({dungeonCheckpoint:bad}).data.dungeonCheckpoint,null);
  const cp=checkpoint();cp.runProgression.claimedStages=['start',5,6,45,50,'bogus'];
  const out=sanitizeSave({dungeonCheckpoint:cp}).data.dungeonCheckpoint;
  assert.deepEqual(out.runProgression.claimedStages,['start',5,45]);
  assert.equal(out.runProgression.pendingOffer,null,'chosen stage must not reopen');
});

test('raw checkpoint protocol rejects unknown stages and over-budget skills',()=>{
  const cp=checkpoint();cp.runProgression.pendingOffer.stageId=6;
  assert.equal(validateCampaignCheckpoint(null,cp).ok,false);
  const huge=checkpoint();huge.player.skills={max_hp_up:11};huge.runProgression.skills={max_hp_up:11};
  assert.equal(validateCampaignCheckpoint(null,huge).ok,false);
});

function checkpoint(runId = 'campaign-test-run-1') {
  return { v:2, runId, boundary:'entry', roomCleared:false, rewardSettled:true, room:1, maxRooms:50,
    chapterId:1, chapterIdx:0, kills:0, runGold:0, savedAt:Date.now(),
    player:{hp:100,maxHp:100,atk:10,skills:{},level:1},
    runProgression:{version:1,seed:42,skills:{},choicesUsed:0,runSkillLevel:0,claimedStages:[],
      skippedValkyrieStages:[],pendingOffer:{stageId:'start',provider:'valkyrie',skillIds:['multishot','max_hp_up'],rerollLimit:1,rerollsUsed:0}} };
}
function clean(cp) {return sanitizeSave({dungeonCheckpoint:cp}).data.dungeonCheckpoint;}
function accept(ledger,cp) {
  const result=validateCampaignCheckpoint(ledger,clean(cp));
  assert.equal(result.ok,true,result.error?.detail);
  return result.campaignCheckpoint;
}
function reject(ledger,cp) {assert.equal(validateCampaignCheckpoint(ledger,clean(cp)).ok,false);}
function update(cp,result) {
  assert.equal(result.ok,true,result.reason);
  const next=structuredClone(cp);next.runProgression=result.state;next.player.skills={...result.state.skills};return next;
}
test('clear before loot allows one positive settlement and no reopening or replay',()=>{
  let cp=checkpoint(),ledger=accept(null,cp);
  Object.assign(cp,{boundary:'cleared',roomCleared:true,room:5,rewardSettled:false});
  ledger=accept(ledger,cp);
  assert.equal(clean(cp).rewardSettled,false);
  const early=structuredClone(cp);early.runGold=10;reject(ledger,early);
  const paid=structuredClone(cp);paid.runGold=10;paid.rewardSettled=true;
  ledger=accept(ledger,paid);ledger=accept(ledger,paid);
  assert.equal(ledger.active.rewardSettled,true);
  const replay=structuredClone(paid);replay.runGold++;reject(ledger,replay);
  const reopen=structuredClone(paid);reopen.rewardSettled=false;reject(ledger,reopen);
  reject(ledger,cp);
  const later=structuredClone(paid);later.room=6;later.rewardSettled=false;
  ledger=accept(ledger,later);
  later.rewardSettled=true;ledger=accept(ledger,later); // Empty loot is legal.
  later.runGold++;reject(ledger,later);
});
test('post-clear heart loot heals once when reward settlement closes',()=>{
  let {cp,ledger}=offeredSupport(10,undefined,false);
  const healed=structuredClone(cp);healed.rewardSettled=true;healed.player.hp=75;
  ledger=accept(ledger,healed);
  assert.equal(ledger.active.player.hp,75);
  assert.deepEqual(ledger.active.support,cp.support);
  accept(ledger,healed); // Identical settlement retries remain harmless.
});
test('passive healing before any support offer does not look like a support replay',()=>{
  const cp=checkpoint();cp.support=support.create();cp.player.hp=60;
  const ledger=accept(null,cp);
  const healed=structuredClone(cp);healed.player.hp=72;
  const after=accept(ledger,healed);
  assert.equal(after.active.player.hp,72);
});
test('production generate, reroll, claim and NPC skip round trip through schema and ledger',()=>{
  let cp=checkpoint();cp.runProgression=progression.normalizeState({seed:42},catalog);
  let ledger=accept(null,cp);
  cp=update(cp,progression.generateOffer(cp.runProgression,catalog,{stageId:'start',starterPriority:['max_hp_up']}));
  assert.notEqual(cp.runProgression.seed,42);
  ledger=accept(ledger,cp);
  const beforeReroll=structuredClone(cp);
  cp=update(cp,progression.rerollOffer(cp.runProgression,catalog));
  assert.notEqual(cp.runProgression.seed,beforeReroll.runProgression.seed);
  ledger=accept(ledger,cp);reject(ledger,beforeReroll);
  const exhausted=structuredClone(cp);exhausted.runProgression.pendingOffer.rerollsUsed++;
  assert.equal(validateCampaignCheckpoint(ledger,exhausted).ok,false,'raw over-limit reroll rejected');
  assert.equal(progression.rerollOffer(cp.runProgression,catalog).ok,false);
  cp=update(cp,progression.claimOffer(cp.runProgression,catalog,cp.runProgression.pendingOffer.skillIds[0]));
  ledger=accept(ledger,cp);
  const changedSeed=structuredClone(cp);changedSeed.runProgression.seed++;reject(ledger,changedSeed);
  Object.assign(cp,{boundary:'cleared',roomCleared:true,room:5,rewardSettled:false});
  ledger=accept(ledger,cp);
  const unoffered=structuredClone(cp);unoffered.runProgression.skippedValkyrieStages=[5];reject(ledger,unoffered);
  cp=update(cp,progression.generateOffer(cp.runProgression,catalog,{stageId:5,segment:1}));
  ledger=accept(ledger,cp); // NPC spawn saves the generated offer before skip.
  const offered=structuredClone(cp);
  cp.runProgression.pendingOffer=null;cp.runProgression.skippedValkyrieStages=[5];
  ledger=accept(ledger,cp);reject(ledger,offered);
  const badSkipSeed=structuredClone(cp);badSkipSeed.runProgression.seed++;reject(ledger,badSkipSeed);
});
function offeredSupport(stage=10,choiceCost={pct:10,costHp:10,directHp:false},rewardSettled=true) {
  let cp=checkpoint(),ledger=accept(null,cp);
  Object.assign(cp,{boundary:'cleared',roomCleared:true,room:stage,rewardSettled});
  cp.player.hp=60;
  cp.support=support.offer(support.create(),{stage,hp:60,maxHp:100,cost:choiceCost}).state;
  ledger=accept(ledger,cp);
  return {cp,ledger};
}
function claimSupport(cp,choice) {
  const next=structuredClone(cp);
  const result=support.claim(cp.support,{stage:cp.support.pending.stage,choice,hp:cp.player.hp,maxHp:cp.player.maxHp});
  assert.equal(result.ok,true);
  next.support=result.state;next.player.hp=result.hp;next.player.maxHp=result.maxHp;
  return next;
}
test('support requires saved pending, immutable offer and one reached receipt',()=>{
  let {cp,ledger}=offeredSupport();
  assert.deepEqual(ledger.active.support,cp.support);
  const changed=structuredClone(cp);changed.support.pending.cost.pct=0;changed.support.pending.cost.costHp=0;reject(ledger,changed);
  const lost=structuredClone(cp);lost.support.pending=null;reject(ledger,lost);
  const future=structuredClone(cp);future.support.pending.stage=20;reject(ledger,future);
  const forged=structuredClone(cp);forged.support.receipts=[{stage:10,choice:'angel'},{stage:20,choice:'devil'}];forged.support.pending=null;reject(ledger,forged);
  const unoffered=checkpoint();let fresh=accept(null,unoffered);
  Object.assign(unoffered,{boundary:'cleared',roomCleared:true,room:10});
  unoffered.support={...support.create(),receipts:[{stage:10,choice:'skip'}]};reject(fresh,unoffered);
  const entry=checkpoint('campaign-support-entry');entry.support=cp.support;reject(null,entry);
});
test('support claims use stored cost and cannot replay, rewrite or remove receipts',()=>{
  for(const choice of ['angel','devil','skip']) {
    const {cp,ledger}=offeredSupport(10,{pct:10,costHp:10,directHp:true});
    const paid=claimSupport(cp,choice);
    const bad=structuredClone(paid);bad.player.hp++;reject(ledger,bad);
    const badMax=structuredClone(paid);badMax.player.maxHp++;reject(ledger,badMax);
    const after=accept(ledger,paid);accept(after,paid);
    reject(after,cp);
    const replay=structuredClone(paid);replay.player.hp++;reject(after,replay);
    const changed=structuredClone(paid);changed.support.receipts[0].choice=choice==='angel'?'skip':'angel';reject(after,changed);
    const missing=structuredClone(paid);delete missing.support;reject(after,missing);
    const extra=structuredClone(paid);extra.player.skills={multishot:1};extra.runProgression.skills={multishot:1};reject(ledger,extra);
    const later=structuredClone(paid);later.room=11;later.player.hp=20;accept(after,later); // Not authoritative combat validation.
  }
});
test('settlement healing cannot repeat, inflate max HP or bypass a support claim cost',()=>{
  for (const claimed of [false,true]) {
    let {cp,ledger}=offeredSupport(10,{pct:10,costHp:10,directHp:true},false);
    if (claimed) {cp=claimSupport(cp,'devil');ledger=accept(ledger,cp);}
    const inflated=structuredClone(cp);inflated.rewardSettled=true;inflated.player.maxHp++;
    assert.equal(validateCampaignCheckpoint(ledger,clean(inflated)).error?.detail,'support_hp_replay');
    const damaged=structuredClone(cp);damaged.rewardSettled=true;damaged.player.hp--;
    assert.equal(validateCampaignCheckpoint(ledger,clean(damaged)).error?.detail,'support_hp_replay');
    const aboveMax=clean(cp);aboveMax.rewardSettled=true;aboveMax.player.hp=cp.player.maxHp+1;
    assert.equal(validateCampaignCheckpoint(ledger,aboveMax).error?.detail,'support_hp_replay');
    if (!claimed) {
      const unpaid=claimSupport(cp,'devil');unpaid.rewardSettled=true;unpaid.player.hp=cp.player.hp;
      assert.equal(validateCampaignCheckpoint(ledger,clean(unpaid)).error?.detail,'support_claim_cost');
    }
    const healed=structuredClone(cp);healed.rewardSettled=true;healed.player.hp++;
    ledger=accept(ledger,healed);
    const repeated=structuredClone(healed);repeated.player.hp++;
    assert.equal(validateCampaignCheckpoint(ledger,clean(repeated)).error?.detail,'support_hp_replay');
    const reopened=structuredClone(healed);reopened.rewardSettled=false;
    assert.equal(validateCampaignCheckpoint(ledger,clean(reopened)).error?.detail,'reward_reopened');
    if (!claimed) ledger=accept(ledger,claimSupport(healed,'devil'));
  }
});
test('empty support healing cannot inflate max HP or alter a newly generated offer',()=>{
  const cp=checkpoint();cp.support=support.create();cp.player.hp=60;
  const ledger=accept(null,cp);
  const inflated=structuredClone(cp);inflated.player.maxHp++;
  assert.equal(validateCampaignCheckpoint(ledger,clean(inflated)).error?.detail,'support_hp_replay');
  const clear=structuredClone(cp);Object.assign(clear,{boundary:'cleared',roomCleared:true,room:10});
  const after=accept(ledger,clear);
  const offer=structuredClone(clear);offer.player.hp++;
  const generated=support.offer(clear.support,{stage:10,hp:clear.player.hp,maxHp:clear.player.maxHp,
    cost:{pct:10,costHp:10,directHp:true}});
  assert.equal(generated.ok,true);offer.support=generated.state;
  assert.equal(validateCampaignCheckpoint(after,clean(offer)).error?.detail,'support_hp_replay');
});
test('all four support stages claim once, bonus derived and no skill budget consumed',()=>{
  let cp=checkpoint();cp.support=support.create();let ledger=accept(null,cp);
  for(const stage of [10,20,30,40]) {
    Object.assign(cp,{boundary:'cleared',roomCleared:true,room:stage});
    cp.support=support.offer(cp.support,{stage,hp:cp.player.hp,maxHp:cp.player.maxHp,cost:{pct:0,costHp:0,directHp:false}}).state;
    ledger=accept(ledger,cp);cp=claimSupport(cp,'devil');ledger=accept(ledger,cp);
    assert.equal(cp.support.receipts.length,stage/10);
    assert.equal(ledger.active.runProgression.choicesUsed,0);
  }
  assert.equal(ledger.active.support.damageBonus,0.15);
});
async function harness(fn) {
  let ledger=null, current={playerId:'unit-player',revision:0,data:{}};
  const get=async()=>structuredClone(current);
  const put=async(cur,data)=>{
    const validation=sanitizeSave(data);
    if (!validation.ok) return {status:422,body:validation.error};
    const sanitized=validation.data;
    const result=validateCampaignCheckpoint(ledger,sanitized.dungeonCheckpoint);
    if (!result.ok) return {status:422,body:result.error};
    ledger=result.campaignCheckpoint;
    current={...current,revision:current.revision+1,data:sanitized};
    return {status:200,body:structuredClone(current)};
  };
  await fn({get,put});
}

test('schema + ledger persists entry start offer and claim, rejects replay and unoffered skill', async()=>harness(async({get,put})=>{
  let cur=await get(); const cp=checkpoint();
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:cp})).status,200);
  cur=await get(); assert.equal(cur.data.dungeonCheckpoint?.boundary,'entry');
  assert.equal(cur.data.dungeonCheckpoint?.runId,cp.runId);
  assert.equal(cur.data.dungeonCheckpoint.runProgression.pendingOffer.stageId,'start');
  const chosen=structuredClone(cur.data.dungeonCheckpoint);
  chosen.player.skills={multishot:1};Object.assign(chosen.runProgression,{skills:{multishot:1},choicesUsed:1,runSkillLevel:1,claimedStages:['start'],pendingOffer:null});
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:chosen})).status,200);
  cur=await get();assert.deepEqual(cur.data.dungeonCheckpoint.runProgression.claimedStages,['start']);
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:cp})).status,422);
  const fakeSkip=structuredClone(chosen);fakeSkip.boundary='cleared';fakeSkip.roomCleared=true;fakeSkip.room=5;fakeSkip.runProgression.skippedValkyrieStages=[5];
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:fakeSkip})).status,422,'skip requires acknowledged offer');
  const forged=structuredClone(chosen);forged.player.skills={multishot:2};forged.runProgression.skills={multishot:2};
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:forged})).status,422);
  let after=await get();assert.equal(after.revision,cur.revision);assert.deepEqual(after.data.dungeonCheckpoint.player.skills,{multishot:1});
  const cleared=structuredClone(chosen);Object.assign(cleared,{boundary:'cleared',roomCleared:true,room:5,runGold:10,kills:12});
  cleared.runProgression.pendingOffer={stageId:5,provider:'valkyrie',skillIds:['max_hp_up'],rerollLimit:1,rerollsUsed:0};
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:cleared})).status,200);
  cur=await get();assert.equal((await put(cur,cur.data)).status,200,'identical retry is harmless');cur=await get();
  const bad=structuredClone(cleared);bad.player.skills={multishot:1,attack_boost:1};
  Object.assign(bad.runProgression,{skills:bad.player.skills,claimedStages:['start',5],choicesUsed:2,runSkillLevel:2,pendingOffer:null});
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:bad})).status,422,'cannot choose known but unoffered skill');
  const reward=structuredClone(cleared);reward.runGold=20;
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:reward})).status,422,'same room cannot grant another run reward');
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:chosen})).status,422,'room cannot roll back');
  const claim=structuredClone(cleared);claim.player.skills={multishot:1,max_hp_up:1};
  Object.assign(claim.runProgression,{skills:claim.player.skills,claimedStages:['start',5],choicesUsed:2,runSkillLevel:2,pendingOffer:null});
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:claim})).status,200);cur=await get();
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:cleared})).status,422,'cannot reopen claimed stage');
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:null})).status,200);cur=await get();
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:claim})).status,422,'reset retires runId');
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:checkpoint('campaign-test-run-2')})).status,200);
  after=await get();assert.equal(after.data.dungeonCheckpoint.runId,'campaign-test-run-2');
}));

test('schema + ledger accepts all six available choices and rejects unoffered extras below the ten-skill cap',async()=>harness(async({get,put})=>{
  let cur=await get(), cp=checkpoint('campaign-budget-run');
  cp.runProgression.pendingOffer.skillIds=['max_hp_up'];
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:cp})).status,200);
  assert.equal(progression.MAX_RUN_SKILL_LEVEL,10,'the skill cap is independent of available NPC opportunities');
  for (const [index,stage] of ['start',5,15,25,35,45].entries()) {
    cur=await get();cp=structuredClone(cur.data.dungeonCheckpoint);
    if(stage!=='start') {
      Object.assign(cp,{boundary:'cleared',roomCleared:true,room:stage});
      cp.runProgression.pendingOffer={stageId:stage,provider:'valkyrie',skillIds:['max_hp_up'],rerollLimit:1,rerollsUsed:0};
      assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:cp})).status,200);cur=await get();
    }
    cp.player.skills={max_hp_up:index+1};
    Object.assign(cp.runProgression,{skills:cp.player.skills,choicesUsed:index+1,runSkillLevel:index+1,
      claimedStages:[...cp.runProgression.claimedStages,stage],pendingOffer:null});
    assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:cp})).status,200);
  }
  cur=await get();assert.equal(cur.data.dungeonCheckpoint.runProgression.choicesUsed,6);
  assert.deepEqual(cur.data.dungeonCheckpoint.runProgression.claimedStages,['start',5,15,25,35,45]);
  cp=structuredClone(cur.data.dungeonCheckpoint);cp.player.skills.multishot=1;cp.runProgression.skills.multishot=1;
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:cp})).status,422);
}));

test('legacy v1 checkpoint round trips without the v2 progression protocol',async()=>harness(async({get,put})=>{
  let cur=await get();const cp={...checkpoint(),v:1,room:12,maxRooms:15};delete cp.runId;delete cp.runProgression;
  assert.equal((await put(cur,{...cur.data,dungeonCheckpoint:cp})).status,200);cur=await get();
  assert.equal(cur.data.dungeonCheckpoint.v,1);assert.equal(cur.data.dungeonCheckpoint.room,12);
}));
