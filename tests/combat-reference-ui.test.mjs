import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/combat-reference-ui.js', import.meta.url), 'utf8');
class Element {
  constructor(tag='div') { this.tagName=tag; this.children=[]; this.attrs={}; this.dataset={}; this.listeners={}; this.hidden=false; this.textContent=''; this.disabled=false; const classes=new Set(); this.classList={add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)}; }
  get firstElementChild(){ return this.children[0]; }
  append(...els){ for(const e of els){ e.parentElement=this; this.children.push(e); } }
  prepend(...els){ for(const e of els)e.parentElement=this; this.children.unshift(...els); }
  after(...els){ const p=this.parentElement; p.children.splice(p.children.indexOf(this)+1,0,...els); for(const e of els)e.parentElement=p; }
  replaceChildren(...els){ this.children=[]; this.append(...els); }
  remove(){const p=this.parentElement;if(p)p.children=p.children.filter(e=>e!==this);}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  click(){if(!this.disabled)for(const fn of this.listeners.click||[])fn({});}
  focus(){this.focused=true;}
  querySelectorAll(selector){const all=this.children.flatMap(e=>[e,...e.querySelectorAll(selector)]);return all.filter(e=>selector==='.skill-choice-card'?e.classList.contains('skill-choice-card'):e.tagName===selector);}
  querySelector(s){return this.querySelectorAll(s)[0];}
}
function fixture(){
 const frame=new Element(), modal=new Element(), panel=new Element(), choices=new Element(), reroll=new Element('button');
 modal.classList.add('hidden');frame.append(modal);modal.append(panel);panel.append(choices,reroll);
 const ids={app:frame,skillSelectModal:modal,skillChoicesContainer:choices,btnRerollSkills:reroll};
 const document={createElement:tag=>new Element(tag),getElementById:id=>ids[id],activeElement:reroll};
 const context=vm.createContext({document,console});vm.runInContext(source,context);
 const api=context.ArtemisCombatReferenceUI;
 const state={campaign:true,offer:{stageId:'start',rerollLimit:1,rerollsUsed:0},skills:{fire:2},catalog:[{id:'fire',name:'Hỏa Diệm',desc:'Đạn thiêu đốt địch',rarity:'rare'}]};
 for(let i=0;i<3;i++){ const card=new Element('button');card.classList.add('skill-choice-card');card.dataset.skillId='fire';choices.append(card); }
 api.install({frame,getState:()=>state});
 return {api,state,frame,modal,panel,choices,reroll,context};
}
test('remaining uses authoritative limits, including hero bonus and unknown state',()=>{
 const {api}=fixture();assert.equal(api.remaining({rerollLimit:1,rerollsUsed:0}),1);assert.equal(api.remaining({rerollLimit:1,rerollsUsed:1}),0);assert.equal(api.remaining({rerollLimit:2,rerollsUsed:0}),2);assert.equal(api.remaining(undefined),null);
});
test('learned abilities come from live stacks and catalog, never reference placeholders',()=>{
 const {api}=fixture();const data=api.learnedEntries({fire:2,ice:0,unknown:1},[{id:'fire',name:'Hỏa Diệm',desc:'Actual'}]);
 assert.equal(data.length,2);assert.equal(data[0].level,2);assert.equal(data[0].name,'Hỏa Diệm');assert.equal(data[1].name,'unknown');
});
test('decorating preserves original cards, listeners and authoritative offer size',()=>{
 const {api,state,choices,modal,reroll}=fixture();const card=choices.children[0];let claims=0,rolls=0;card.addEventListener('click',()=>claims++);reroll.addEventListener('click',()=>rolls++);
 api.sync();assert.equal(choices.children[0],card);card.click();reroll.click();assert.equal(claims,1);assert.equal(rolls,1);assert.equal(modal.dataset.referenceCount,'3');assert.equal(modal.dataset.referenceOffer,'entry');
 choices.children.pop();state.offer.stageId=5;api.sync();assert.equal(modal.dataset.referenceCount,'2');assert.equal(modal.dataset.referenceOffer,'valkyrie');
 state.offer.rerollsUsed=1;api.sync();assert.equal(reroll.disabled,true);reroll.click();assert.equal(rolls,1);
});
test('learned drawer reads current state each time and text never executes HTML',()=>{
 const {api,state,modal,panel}=fixture();modal.classList.remove('hidden');api.sync();
 const button=panel.children.find(e=>e.className==='acr-learned-button');const drawer=panel.children.find(e=>e.className==='acr-learned');
 button.click();assert.equal(drawer.hidden,false);assert.equal(drawer.children[1].children[0].textContent,'Hỏa Diệm · Bậc 2');
 drawer.children.at(-1).click();state.skills.fire=3;button.click();assert.equal(drawer.children[1].children[0].textContent,'Hỏa Diệm · Bậc 3');
 modal.classList.add('hidden');api.sync();assert.equal(drawer.hidden,true);
});
test('campaign reroll state cannot override other modes cost and disabled handler',()=>{
 const {api,state,reroll}=fixture();state.campaign=false;reroll.textContent='Đổi Kỹ Năng (15 💎)';reroll.disabled=true;api.sync();assert.equal(reroll.textContent,'Đổi Kỹ Năng (15 💎)');assert.equal(reroll.disabled,true);
});
test('nested loading remains in app frame until all actual operations settle',async()=>{
 const {api,frame}=fixture();frame.setAttribute('aria-busy','false');const a=api.beginLoading(),b=api.beginLoading();assert.equal(frame.children.length,2);assert.equal(frame.children[1].id,'combatReferenceLoading');assert.equal(frame.getAttribute('aria-busy'),'true');api.endLoading(a);assert.equal(frame.children.length,2);api.endLoading(a);assert.equal(frame.children.length,2);api.endLoading(b);assert.equal(frame.children.length,1);assert.equal(frame.getAttribute('aria-busy'),'false');
 let resolve;const ready=new Promise(r=>resolve=r);const operation=api.withLoading(()=>ready);await Promise.resolve();assert.equal(frame.children.length,2);resolve('ready');assert.equal(await operation,'ready');assert.equal(frame.children.length,1);
});
test('loading cleanup runs after failure and does not fabricate time-based progress',async()=>{
 const {api,frame}=fixture();await assert.rejects(api.withLoading(()=>{throw new Error('readiness failed');}),/readiness failed/);assert.equal(frame.children.length,1);assert.equal(frame.getAttribute('aria-busy'),null);assert.doesNotMatch(source,/setTimeout|setInterval/);
});
test('preload is shared and withLoading waits for actual image load',async()=>{
 const {api,context,frame}=fixture();let image;context.Image=class{constructor(){image=this;}set src(value){this.url=value;}};
 const first=api.preload();assert.equal(api.preload(),first);let done=false;const operation=api.withLoading(()=>42).then(v=>{done=true;return v;});await Promise.resolve();assert.equal(done,false);assert.equal(frame.children.length,2);image.onload();assert.equal(await operation,42);assert.equal(frame.children.length,1);
});
