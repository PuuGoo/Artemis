import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf("document.querySelectorAll('.skill-choice-card').forEach(btn => {");
const source = html.slice(start, html.indexOf('\n      function applyRogueSkill(', start)).replace(/\n      }\s*$/, '');
function harness() {
  const cards = ['first', 'second'].map(id => ({dataset: {}, attrs: {},
    getAttribute() { return id; }, setAttribute(k,v) { this.attrs[k]=v; }, removeAttribute(k) { delete this.attrs[k]; },
    querySelector() { return {textContent:''}; }, addEventListener(_,fn) { this.click=fn; }}));
  const modal = {classList:{add() { modal.hidden=true; }}};
  const Game = {runId:'run', runProgression:{pendingOffer:{skillIds:['first','second']}}, paused:true,
    skillClaimBusy:true, campaignOfferPendingAck:true, campaignOfferAckPromise:new Promise(()=>{})};
  let grants=0;
  const snapshots=[], tracked=[];
  const context = vm.createContext({Game, document:{querySelectorAll:()=>cards,getElementById:()=>modal},
    window:{ArtemisCloud:{enqueueCheckpoint() { snapshots.push(structuredClone(Game.runProgression)); return new Promise(()=>{}); }}},
    usesCampaignTuning:()=>true, saveCheckpoint:()=>true,
    watchSkillClaimSync(request,promise) { tracked.push({request,promise}); },
    applyRogueSkill() { grants++; Game.runProgression={pendingOffer:null,skills:{first:1}}; return true; },
    performance:{now:()=>1}, showToast() {}, updateInGameHUD() {}});
  vm.runInContext(source,context);
  return {Game,cards,modal,snapshots,tracked,grants:()=>grants};
}
test('click grants and resumes synchronously before unresolved offer network', () => {
  const h=harness(); h.cards[0].click();
  assert.equal(h.grants(),1,'must grant in click task');
  assert.equal(h.modal.hidden,true); assert.equal(h.Game.paused,false);
  assert.equal(h.snapshots.length,2,'OFFER then CLAIM captured before gameplay');
  assert.deepEqual(h.snapshots[0].pendingOffer.skillIds,['first','second']);
  assert.equal(h.snapshots[1].pendingOffer,null); assert.equal(h.tracked.length,1);
});
test('rapid double taps cannot grant twice', () => {
  const h=harness(); h.cards[0].click(); h.cards[0].click(); h.cards[1].click();
  assert.equal(h.grants(),1); assert.equal(h.snapshots.length,2);
});
const watcherStart = html.indexOf('function watchSkillClaimSync(');
const watcherSource = html.slice(watcherStart, html.indexOf('\n      function openCampaignOffer(', watcherStart));
function syncHarness({retryable = true} = {}) {
  const elements = new Map();
  const make = () => ({style:{},children:[],append(...xs) { this.children.push(...xs); },
    remove() { elements.delete(this.id); },setAttribute(){},addEventListener(_,fn){this.click=fn;}});
  const Game={runId:'run',paused:false,pendingClaimId:'first'};
  let retryResult=false;
  const context=vm.createContext({Game,performance:{now:()=>2},document:{
    getElementById:id=>elements.get(id),createElement:()=>make(),body:{append(el){elements.set(el.id,el);}}},
    window:{location:{reload(){}},ArtemisCloud:{getState:()=>({lastErrorRetryable:retryable}),flushCheckpoint:async()=>retryResult}}});
  vm.runInContext(watcherSource,context);
  return {Game,elements,watch:context.watchSkillClaimSync,setRetry:value=>retryResult=value};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('transient failure shows retry banner without pausing or claiming saved',async()=>{
  const h=syncHarness(); h.watch({runId:'run'},Promise.resolve(false)); await tick();
  assert.equal(h.Game.paused,false); assert.equal(h.Game.pendingClaimId,'first');
  const banner=h.elements.get('skillClaimSyncBanner'); assert.ok(banner);
  h.setRetry(true); await banner.children[1].click(); await tick();
  assert.equal(h.Game.pendingClaimId,null); assert.equal(h.elements.size,0);
});
test('online recovery retries transport without applying the skill again',async()=>{
  const h=syncHarness();h.watch({runId:'run'},Promise.resolve(false));await tick();
  h.setRetry(true);await h.Game.skillClaimSync.retry();await tick();
  assert.equal(h.Game.pendingClaimId,null);assert.equal(h.Game.paused,false);
});
test('fatal rejection pauses gameplay and only offers authoritative reload',async()=>{
  const h=syncHarness({retryable:false});h.watch({runId:'run'},Promise.resolve(false));await tick();
  assert.equal(h.Game.paused,true);assert.equal(h.Game.skillClaimFatal,true);
  assert.equal(h.elements.get('skillClaimSyncBanner').children[1].textContent,'Tải lại dữ liệu máy chủ');
});
test('late rejection from replaced run cannot pause the new run',async()=>{
  const h=syncHarness({retryable:false});let resolve;const p=new Promise(r=>resolve=r);
  h.watch({runId:'run'},p);h.Game.runId='replacement';resolve(false);await tick();
  assert.equal(h.Game.paused,false);assert.equal(h.elements.size,0);
});
test('existing immutable offer capture is reused while acknowledgement pending', () => {
  const h=harness();
  h.Game.campaignOfferSnapshot={progression:h.Game.runProgression,promise:h.Game.campaignOfferAckPromise};
  h.cards[0].click(); assert.equal(h.snapshots.length,1);
  assert.equal(h.snapshots[0].pendingOffer,null); assert.equal(h.grants(),1);
});
