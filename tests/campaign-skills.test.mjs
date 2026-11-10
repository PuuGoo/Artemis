import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file = new URL('../public/campaign-skills.js', import.meta.url);
function api() {
  const context = vm.createContext({});
  if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  assert.ok(context.ArtemisCampaignSkills, 'classic global ArtemisCampaignSkills must exist');
  return context.ArtemisCampaignSkills;
}
const plain = value => JSON.parse(JSON.stringify(value));
function catalog() {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('const ROGUE_SKILLS = [');
  const end = html.indexOf('\n      ];', start);
  assert.ok(start >= 0 && end > start);
  return vm.runInNewContext(html.slice(start, end + 9) + ';ROGUE_SKILLS');
}
const skills = catalog();
const tiers = ['common','rare','epic','legend'];
const small = tiers.flatMap(rarity => [0,1,2].map(n => ({id:rarity+n, rarity, providers:['valkyrie']})));
test('pity counts consecutive misses and resets on a naturally high offer, not every fifth encounter', () => {
  const A=api();
  const low=small.filter(s=>s.rarity==='common');
  const high=small.filter(s=>s.rarity==='epic');
  let state={seed:77};
  for(let i=0;i<3;i++) {
    const out=A.generateOffer(state,low,{stageId:`miss-${i}`});
    assert.equal(out.state.pityCounter,i+1);
    state=A.claimOffer(out.state,low,out.offer.skillIds[0]).state;
  }
  const hit=A.generateOffer(state,high,{stageId:'natural-hit'});
  assert.equal(hit.offer.pity,false);
  assert.equal(hit.state.pityCounter,0);
  state=A.claimOffer(hit.state,high,hit.offer.skillIds[0]).state;
  const fifth=A.generateOffer(state,small,{stageId:'fifth'});
  assert.equal(fifth.offer.pity,false,'an earlier epic breaks the miss streak');
  const guaranteed=A.generateOffer({seed:77,pityCounter:4},small,{stageId:'guaranteed'});
  assert.equal(guaranteed.offer.pity,true);
  assert.ok(guaranteed.offer.skillIds.some(id=>/^epic|^legend/.test(id)));
  assert.equal(guaranteed.state.pityCounter,0);
});
test('start offers never count as Valkyrie encounters or consume a miss streak', () => {
  const A=api();
  for(const rarity of ['common','epic']) {
    const pool=small.filter(s=>s.rarity===rarity);
    const out=A.generateOffer({pityCounter:4,valkyrieOffers:3},pool,{stageId:'start'});
    assert.equal(out.offer.pity,false);
    assert.equal(out.state.pityCounter,4);
    assert.equal(out.state.valkyrieOffers,3);
    const roll=A.rerollOffer(plain(out.state),pool);
    assert.equal(roll.state.pityCounter,4);
    assert.equal(roll.state.valkyrieOffers,3);
  }
});
test('reroll resets a miss streak on a high offer without counting the encounter twice', () => {
  const A=api(), high=offer=>offer.skillIds.some(id=>/^epic|^legend/.test(id));
  let found=false;
  for(let seed=0;seed<100;seed++) {
    const out=A.generateOffer({seed,pityCounter:2},small,{stageId:'reroll',heroRerolls:1});
    if(high(out.offer)) continue;
    assert.equal(out.state.pityCounter,3);
    const roll=A.rerollOffer(plain(out.state),small);
    assert.equal(roll.state.valkyrieOffers,1);
    if(high(roll.offer)) {
      assert.equal(roll.state.pityCounter,0);
      assert.equal(A.normalizeState(plain(roll.state),small).pityCounter,0);
      found=true;
      break;
    }
    assert.equal(roll.state.pityCounter,3);
  }
  assert.equal(found,true,'seed search must exercise low -> high reroll');
  const pity=A.generateOffer({seed:77,pityCounter:4},small,{stageId:'pity',heroRerolls:1});
  let roll=pity;
  for(let i=0;i<2;i++) {
    roll=A.rerollOffer(plain(roll.state),small);
    assert.equal(roll.offer.pity,true);
    assert.equal(high(roll.offer),true);
    assert.equal(roll.state.pityCounter,0);
    assert.equal(roll.state.valkyrieOffers,1);
  }
});
test('pity checkpoints clamp to 0..4 and only new non-start Valkyrie encounters affect streaks', () => {
  const A=api();
  for(const [raw,want] of [[undefined,0],[-1,0],[Infinity,0],[NaN,0],['4',0],[99,4],[3.9,3]]) {
    const input={pityCounter:raw};
    assert.equal(A.normalizeState(input,small).pityCounter,want);
    assert.ok(Object.is(input.pityCounter,raw));
  }
  assert.equal(A.normalizeState({valkyrieOffers:4},small).pityCounter,0,'legacy total cannot reconstruct consecutive misses');
  const low=small.filter(s=>s.rarity==='common');
  let state={pityCounter:0};
  for(let i=0;i<4;i++) {
    const out=A.generateOffer(state,low,{stageId:`low-${i}`});
    assert.equal(out.offer.pity,false);
    assert.equal(out.state.pityCounter,i+1);
    const pending=A.generateOffer(plain(out.state),low,{stageId:'ignored'});
    assert.equal(pending.state.pityCounter,i+1);
    const roll=A.rerollOffer(plain(pending.state),low);
    assert.equal(roll.state.pityCounter,i+1);
    state=A.claimOffer(roll.state,low,roll.offer.skillIds[0]).state;
  }
  const fifth=A.generateOffer(state,small,{stageId:'fifth'});
  assert.equal(fifth.offer.pity,true);
  assert.equal(fifth.state.pityCounter,0);
  for(const provider of ['angel','devil']) {
    const pool=small.map(s=>({...s,providers:[provider]}));
    const out=A.generateOffer({pityCounter:3},pool,{stageId:provider,provider});
    assert.equal(out.offer.pity,false);
    assert.equal(out.state.pityCounter,3);
    assert.equal(A.rerollOffer(out.state,pool).state.pityCounter,3);
  }
  const empty=A.generateOffer({pityCounter:3},[],{stageId:'empty'});
  assert.equal(empty.state.pityCounter,3);
  const noHigh=A.generateOffer({pityCounter:4},low,{stageId:'no-high'});
  assert.equal(noHigh.ok,true);
  assert.equal(noHigh.state.pityCounter,4);
});
test('seeded per-slot rarity weights match all five segments over 500000 draws', () => {
  const A = api();
  const rows = [[65,27,7,1],[55,30,12,3],[48,30,17,5],[43,30,20,7],[38,30,24,8]];
  assert.ok(A.RARITY_WEIGHTS, 'rarity table must be implemented');
  assert.deepEqual(plain(A.RARITY_WEIGHTS), rows);
  for (let segment=0; segment<5; segment++) {
    let seed=12345; const counts=[0,0,0,0];
    for(let i=0;i<100000;i++) {
      const d=A.drawSlot(small,{segment},seed); seed=d.seed;
      counts[tiers.indexOf(d.rarity)]++;
    }
    counts.forEach((n,i)=>assert.ok(Math.abs(n/1000-rows[segment][i])<0.65, `${segment}/${i}: ${n}`));
    console.log('slot-simulation',segment,JSON.stringify(counts));
  }
  assert.deepEqual(plain(A.drawSlot(small,{},0)),plain(A.drawSlot(small,{},0)));
  const epicOnly=small.filter(s=>s.rarity==='epic');
  assert.equal(A.drawSlot(epicOnly,{segment:0},42).rarity,'epic');
  assert.equal(A.drawSlot(small,{provider:'angel'},42).skillId,null);
  assert.equal(A.drawSlot(small,{skills:{common0:10,common1:10,common2:10},minRarity:'epic'},42).rarity==='common',false);
  const normal=A.rarityWeights(4), seraph=A.rarityWeights(4,true);
  assert.ok(seraph[3]>normal[3] && seraph[3]<=normal[3]*1.2);
});
test('offers are unique legal persisted choices with starter priority and consecutive-miss pity', () => {
  const A=api();
  assert.equal(typeof A.generateOffer,'function');
  let state=A.normalizeState({seed:77},skills);
  const opts={stageId:'room-1',segment:0,provider:'valkyrie',starterPriority:['multishot']};
  const out=A.generateOffer(state,skills,opts);
  assert.equal(out.ok,true);
  assert.equal(out.offer.skillIds[0],'multishot');
  assert.equal(new Set(out.offer.skillIds).size,3);
  assert.deepEqual(plain(out.state.skills),{});
  assert.equal(out.state.choicesUsed,0);
  const reloaded=A.normalizeState(plain(out.state),skills);
  assert.deepEqual(plain(A.generateOffer(reloaded,skills,{stageId:'room-2',segment:4}).offer),plain(out.offer));
  assert.deepEqual(plain(A.generateOffer(reloaded,skills,opts).state),plain(out.state));
  const pity=A.generateOffer({seed:77,pityCounter:4,valkyrieOffers:4},small,{stageId:'five'});
  assert.ok(pity.offer.skillIds.some(id=>/^epic|^legend/.test(id)));
  assert.equal(pity.state.valkyrieOffers,5);
  assert.equal(A.generateOffer(pity.state,small,{stageId:'five'}).state.valkyrieOffers,5);
  const tiny=[{id:'one',rarity:'common',providers:['angel']}];
  assert.equal(A.generateOffer({},tiny,{stageId:'a'}).ok,false);
  assert.deepEqual(plain(A.generateOffer({},tiny,{stageId:'a',provider:'angel'}).offer.skillIds),['one']);
  assert.equal(A.generateOffer({choicesUsed:10},small,{stageId:'full'}).reason,'budget');
  assert.equal(A.generateOffer({},small,{stageId:''}).reason,'stage');
  const dirty=A.normalizeState({pendingOffer:{stageId:'x',provider:'valkyrie',skillIds:['bogus','common0','common0'],segment:99}},small);
  assert.deepEqual(plain(dirty.pendingOffer.skillIds),['common0']);
});
test('claims dedupe stages, charge every provider, and rerolls cannot bypass budget', () => {
  const A=api();
  assert.equal(typeof A.claimOffer,'function');
  assert.equal(typeof A.rerollOffer,'function');
  let out=A.generateOffer({seed:9},skills,{stageId:'first',heroRerolls:999});
  const frozen=JSON.stringify(out.state);
  assert.equal(A.claimOffer(out.state,skills,'bogus').reason,'choice');
  assert.equal(JSON.stringify(out.state),frozen);
  let roll=A.rerollOffer(out.state,skills);
  assert.equal(roll.ok,true);
  assert.equal(roll.state.pendingOffer.rerollsUsed,1);
  assert.equal(roll.state.choicesUsed,0);
  roll=A.rerollOffer(plain(roll.state),skills);
  assert.equal(roll.ok,true);
  assert.equal(A.rerollOffer(roll.state,skills).reason,'rerolls');
  const def=A.generateOffer({seed:9},skills,{stageId:'default'});
  assert.equal(A.rerollOffer(A.rerollOffer(def.state,skills).state,skills).reason,'rerolls');
  let claim=A.claimOffer(roll.state,skills,roll.offer.skillIds[0]);
  assert.equal(claim.ok,true);
  assert.equal(claim.state.choicesUsed,1);
  assert.equal(claim.state.pendingOffer,null);
  assert.equal(A.claimOffer(claim.state,skills,roll.offer.skillIds[0]).reason,'offer');
  assert.equal(A.generateOffer(claim.state,skills,{stageId:'first'}).reason,'claimed');
  for(let i=1;i<10;i++) {
    out=A.generateOffer(claim.state,skills,{stageId:`step-${i}`,provider:i%2?'angel':'valkyrie'});
    assert.equal(out.ok,true);
    claim=A.claimOffer(out.state,skills,out.offer.skillIds[0]);
    assert.equal(claim.ok,true);
  }
  assert.equal(claim.state.choicesUsed,10);
  assert.equal(Object.values(claim.state.skills).reduce((a,b)=>a+b,0),10);
  assert.equal(A.generateOffer(claim.state,skills,{stageId:'extra',provider:'devil'}).reason,'budget');
  assert.equal(A.rerollOffer({...out.state,choicesUsed:10},skills).reason,'budget');
  assert.equal(A.claimOffer({...out.state,choicesUsed:10},skills,out.offer.skillIds[0]).reason,'budget');
  assert.equal(A.normalizeState({claimedStages:['x','x',null],skills:{}},skills).choicesUsed,1);
});
test('1000 real-catalog runs bound legendary claims and preserve pity after reload/reroll', () => {
  const A=api(), map=new Map(skills.map(s=>[s.id,s]));
  let totalLegend=0, maxLegend=0, overCap=0;
  // Giả định: 10 offer Valkyrie, mỗi segment 2 offer, luôn chọn rarity cao nhất,
  // không starter/Seraph/reroll. Đây là mô phỏng lựa chọn, không phải combat win rate.
  for(let run=0;run<1000;run++) {
    let state={seed:run*12345}, legends=0, misses=0;
    for(let stage=0;stage<10;stage++) {
      const out=A.generateOffer(state,skills,{stageId:`simulation-${stage}`,segment:Math.floor(stage/2)});
      assert.equal(out.ok,true);
      assert.equal(out.offer.pity,misses===4);
      const high=out.offer.skillIds.some(id=>tiers.indexOf(map.get(id).rarity)>=2);
      if(misses===4) assert.equal(high,true);
      misses=high?0:Math.min(4,misses+1);
      assert.equal(out.state.pityCounter,misses);
      const best=out.offer.skillIds.reduce((a,b)=>tiers.indexOf(map.get(a).rarity)>=tiers.indexOf(map.get(b).rarity)?a:b);
      const claim=A.claimOffer(out.state,skills,best);
      assert.equal(claim.ok,true);
      state=claim.state;
      if(map.get(best).rarity==='legend') legends++;
    }
    totalLegend+=legends; maxLegend=Math.max(maxLegend,legends);
    for(const [id,count] of Object.entries(state.skills)) if(count>A.skillCap(map.get(id))) overCap++;
    assert.equal(A.generateOffer(state,skills,{stageId:10}).reason,'budget');
  }
  assert.equal(overCap,0);
  console.log('run-simulation',JSON.stringify({runs:1000,totalLegend,maxLegend,overCap}));
  let pity=A.generateOffer({seed:0,pityCounter:4,valkyrieOffers:4},skills,{stageId:'pity'});
  pity=A.rerollOffer(plain(pity.state),skills);
  assert.ok(pity.offer.skillIds.some(id=>tiers.indexOf(map.get(id).rarity)>=2));
  assert.equal(pity.state.valkyrieOffers,5);
  assert.equal(A.rerollOffer(plain(pity.state),skills).reason,'rerolls');
  const full=Object.fromEntries(skills.map(s=>[s.id,A.skillCap(s)]));
  assert.equal(A.generateOffer({skills:full},skills,{stageId:'full'}).reason,'budget');
});
test('checkpoint normalization enforces total budget and real per-skill caps without mutation', () => {
  const A = api();
  assert.equal(A.MAX_RUN_SKILL_LEVEL, 10);
  assert.equal(A.MAX_SKILL_STACK, 10);
  const raw = {seed: 0, skills: {multishot: 99, sacred_protection: 99, tracking_eye: 99, warriors_breath: 99, unknown: 9}, choicesUsed: -4};
  const before = JSON.stringify(raw);
  const n = A.normalizeState(raw, skills);
  assert.equal(n.skills.multishot, 2);
  assert.equal(n.skills.sacred_protection, 4);
  assert.equal(n.skills.tracking_eye, 1);
  assert.equal(n.skills.warriors_breath, 3);
  assert.equal(n.choicesUsed, 10);
  assert.equal(n.runSkillLevel, 10);
  assert.equal(n.skills.unknown, undefined);
  assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(plain(A.normalizeState(n, skills)), plain(n));
  const lower = [{id:'custom', rarity:'common', maxStack:3}];
  assert.equal(A.normalizeState({skills:{custom:99}}, lower).skills.custom, 3);
  assert.equal(A.normalizeState({choicesUsed:Infinity, skills:{custom:NaN}}, lower).choicesUsed, 0);
  assert.equal(A.normalizeState({choicesUsed:8, skills:{custom:2}}, lower).choicesUsed, 8);
  assert.equal(A.normalizeState({runSkillLevel:10,choicesUsed:0}, lower).choicesUsed,10);
  assert.equal(A.generateOffer({runSkillLevel:10},small,{stageId:'legacy'}).reason,'budget');
  for(const skill of skills) {
    assert.ok(A.skillCap(skill)>=1 && A.skillCap(skill)<=10);
    const out=A.drawSlot([skill],{provider:skill.providers[0],skills:{[skill.id]:A.skillCap(skill)}},1);
    assert.equal(out.skillId,null);
  }
});
