import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={};vm.createContext(sandbox);
for(const f of ['campaign-valkyrie.js','campaign-encounters.js'])vm.runInContext(fs.readFileSync(new URL('../public/'+f,import.meta.url),'utf8'),sandbox);
const E=sandbox.ArtemisCampaignEncounters;
const catalog=[{id:'weak',rarity:'rare'},{id:'b',rarity:'legend',name:'B',providers:['devil']},{id:'a',rarity:'legend',providers:['devil']},{id:'c',rarity:'legend',providers:['valkyrie']}];
const context=(stage=9)=>({runId:'run-1',stage,hp:80,maxHp:100,bossDefeated:true,catalog});
const json=x=>JSON.stringify(x);
test('explicit stage schedules, no final devil',()=>{assert.equal(json(E.ANGEL_STAGES),'[9,19,29,39,49]');assert.equal(json(E.DEVIL_STAGES),'[10,20,30,40]');assert.equal(json(E.VALKYRIE_STAGES),'[5,15,25,35,45]');assert.equal(E.kindAt(50),null);});
test('angel deterministic reload and immutable state; exactly one choice',()=>{
 const s=E.create('run-1'),c=context(),a=E.offer(s,c),b=E.offer(s,c);
 assert.equal(json(a),json(b));assert.equal(s.pending,null);assert.ok(Object.isFrozen(a.state.pending));
 assert.equal(json(E.offer(JSON.parse(json(a.state)),c)),json(a));
 assert.ok(a.offer.healRatio>=.25&&a.offer.healRatio<=.45);
 const claim=E.claim(a.state,{...c,choice:'maxHp'});assert.equal(claim.hp,90);assert.equal(claim.maxHp,110);assert.equal(claim.state.receipts.length,1);
 assert.equal(E.claim(claim.state,{...c,choice:'heal'}).reason,'already-settled');
 const heal=E.claim(a.state,{...c,hp:10,choice:'heal'});assert.equal(heal.hp,10+Math.round(100*a.offer.healRatio));assert.equal(heal.maxHp,100);
});
test('devil deterministic strongest actual catalog skill, reroll once, paid receipt',()=>{
 const c=context(10),s=E.create(c.runId),a=E.offer(s,c);
 assert.equal(E.offer(s,{...c,bossDefeated:false}).reason,'boss-alive');
 assert.ok(['a','b'].includes(a.offer.skillId));assert.equal(a.offer.rarity,'legend');
 const r=E.reroll(a.state,c);assert.notEqual(r.offer.skillId,a.offer.skillId);assert.equal(E.reroll(r.state,c).reason,'reroll-exhausted');
 assert.equal(json(E.offer(r.state,c).offer),json(r.offer));
 const claim=E.claim(r.state,{...c,choice:'accept'});assert.equal(claim.hp,65);assert.equal(claim.maxHp,85);assert.equal(claim.grant.source,'devil');assert.equal(claim.grant.skillId,r.offer.skillId);assert.equal(claim.state.receipts[0].grant.skillId,r.offer.skillId);
 assert.equal(E.claim(a.state,{...c,hp:15,choice:'accept'}).reason,'insufficient-hp');
 assert.equal(E.offer(s,{...c,catalog:[]}).reason,'no-legend-skill');
});
test('reject missing offer, tampering, stale stage/run; refusal closes only own encounter',()=>{
 const c=context(10),s=E.create(c.runId),a=E.offer(s,c);
 assert.equal(E.claim(s,{...c,choice:'accept'}).reason,'missing-offer');
 const forged=JSON.parse(json(a.state));forged.pending.skillId='weak';assert.equal(E.claim(forged,{...c,choice:'accept'}).reason,'invalid-offer');
 assert.equal(E.offer(a.state,{...c,stage:19}).reason,'pending-encounter');
 assert.equal(E.offer(a.state,{...c,runId:'other'}).reason,'invalid-state');
 const r=E.refuse(a.state,c);assert.equal(r.hp,c.hp);assert.equal(r.grant,null);assert.equal(r.state.pending,null);assert.equal(r.state.receipts[0].choice,'refuse');assert.equal(E.offer(r.state,c).reason,'already-settled');
});
test('strict physical contact boundary',()=>{assert.equal(E.isTouching({x:0,y:0,r:17},{x:57,y:0}),false);assert.equal(E.isTouching({x:0,y:0,r:17},{x:56.99,y:0}),true);assert.equal(E.isTouching({x:0,y:0,r:17},{x:0,y:200}),false);});
test('reachable placement prefers exact center and portal, never disconnected center',()=>{
 sandbox.ArtemisObstacleClearance={isFree:(x,y,r,o,g)=>x>=r&&y>=r&&x<=g.width-r&&y<=g.height-r};
 const g={player:{x:60,y:60,r:17},width:600,height:800,wallPad:10,obstacles:[],portalRect:{x:260,y:30,w:80,h:30}};
 assert.equal(json(E.findPosition(g,'angel')),json({x:300,y:400,r:22}));assert.equal(json(E.findPosition(g,'devil')),json({x:300,y:125,r:22}));
 sandbox.ArtemisObstacleClearance={isFree:(x,y)=>x<200};
 const p=E.findPosition(g,'angel');assert.ok(p.x<200);assert.ok(p.x>150);
});
function fakeDocument(){
 const elements=[];
 function node(tag){const n={tag,children:[],dataset:{},textContent:'',setAttribute(){},appendChild(c){this.children.push(c);return c;},remove(){this.removed=true;},querySelector(sel){return this.children.find(c=>sel==='[data-error]'&&c.dataset.error==='');},querySelectorAll(){const walk=n=>[...n.children.flatMap(c=>[...(c.tag==='button'?[c]:[]),...walk(c)])];return walk(this);}};elements.push(n);return n;}
 return {createElement:node,body:node('body'),elements};
}
test('UI never opens before contact; real persistence precedes grant and rejects retries safely',async()=>{
 const doc=fakeDocument(),c=context(),events=[];let state=E.create(c.runId),accept=true;
 const controller=E.createController({document:doc,getState:()=>state,getContext:()=>c,persist:async r=>{events.push('persist');if(!accept)throw Error('offline');return {ok:true};},onCommitted:r=>{events.push('commit');state=r.state;}});
 assert.equal(controller.isOpen,false);assert.equal(await controller.touch({x:0,y:0,r:17},{x:100,y:100,kind:'angel'}),false);assert.equal(events.length,0);
 assert.equal(await controller.touch({x:0,y:0,r:17},{x:10,y:10,kind:'angel'}),true);assert.equal(events.join(','),'persist,commit');assert.equal(controller.isOpen,true);
 const panel=doc.body.children.at(-1);accept=false;await panel.querySelectorAll('button')[0].onclick();assert.equal(state.receipts.length,0);assert.equal(controller.isOpen,true);assert.match(panel.querySelector('[data-error]').textContent,/Lưu/);
 accept=true;await panel.querySelectorAll('button')[0].onclick();assert.equal(state.receipts.length,1);assert.equal(controller.isOpen,false);assert.equal(events.join(','),'persist,commit,persist,persist,commit');controller.destroy();
});
test('UI locks concurrent touches until acknowledgement',async()=>{
 const doc=fakeDocument(),c=context(10);let state=E.create(c.runId),release,calls=0;
 const controller=E.createController({document:doc,getState:()=>state,getContext:()=>c,persist:()=>{calls++;return new Promise(r=>release=r);},onCommitted:r=>{state=r.state;}});
 const player={x:0,y:0,r:17},npc={x:1,y:1,kind:'devil'};const first=controller.touch(player,npc);assert.equal(controller.busy,true);assert.equal(await controller.touch(player,npc),false);assert.equal(calls,1);assert.equal(controller.isOpen,false);release(true);assert.equal(await first,true);assert.equal(controller.isOpen,true);controller.destroy();
});
