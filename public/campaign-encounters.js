/* Shared browser/server domain. Persist under cp.encounters; never merge into cp.support.
 * Server contract: replay action against PRIOR encounters + authoritative runId/stage,
 * hp/maxHp/catalog/bossDefeated; compare next state AND hp/maxHp/grant exactly.
 * Apply state, HP and devil skill atomically. grant.source='devil' is NOT a skill6
 * choice receipt. Client callbacks must resolve only after durable save acknowledgement.
 */
(function(root) {
  'use strict';
  const ANGEL_STAGES=Object.freeze([9,19,29,39,49]);
  const DEVIL_STAGES=Object.freeze([10,20,30,40]);
  const VALKYRIE_STAGES=Object.freeze([5,15,25,35,45]);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  const kindAt=stage=>ANGEL_STAGES.includes(stage)?'angel':DEVIL_STAGES.includes(stage)?'devil':null;
  function create(runId){if(typeof runId!=='string'||!runId.length||runId.length>160)throw Error('invalid-run');return freeze({version:1,runId,pending:null,receipts:[]});}
  function validState(s,c){return s&&s.version===1&&s.runId===c.runId&&Array.isArray(s.receipts)&&s.receipts.length<=14;}
  function alive(c){return c&&Number.isFinite(c.hp)&&Number.isFinite(c.maxHp)&&c.maxHp>=1&&c.hp>0&&c.hp<=c.maxHp;}
  function strongest(c){
    const ids=(Array.isArray(c.catalog)?c.catalog:[]).filter(s=>s&&typeof s.id==='string'&&s.rarity==='legend'&&(!s.providers||s.providers.includes('devil'))).map(s=>s.id);
    return [...new Set(ids)].sort();
  }
  function makeOffer(c,attempt){
    const kind=kindAt(c.stage),id=`${c.runId}:${kind}:${c.stage}`;
    if(kind==='angel')return {id,stage:c.stage,kind,attempt:0,healRatio:(25+hash(id+':heal')%21)/100,maxHpRatio:.10};
    const pool=strongest(c);if(!pool.length)return null;
    const first=hash(id+':skill')%pool.length;
    const index=attempt&&pool.length>1?(first+1+hash(id+':reroll')%(pool.length-1))%pool.length:first;
    return {id,stage:c.stage,kind,attempt,skillId:pool[index],rarity:'legend',hpCostRatio:.15};
  }
  function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function transition(raw,c,action,choice){
    c=c||{};const original=raw||null;
    const fail=reason=>freeze({ok:false,reason,state:original?clone(original):null,hp:c.hp,maxHp:c.maxHp,grant:null});
    if(!validState(raw,c))return fail('invalid-state');
    if(!alive(c))return fail('invalid-player');
    const kind=kindAt(c.stage);if(!kind)return fail('ineligible-stage');
    if(kind==='devil'&&c.bossDefeated!==true)return fail('boss-alive');
    const id=`${c.runId}:${kind}:${c.stage}`;
    if(raw.receipts.some(r=>r.id===id||r.stage===c.stage))return fail('already-settled');
    const state=clone(raw);let hp=c.hp,maxHp=c.maxHp,grant=null;
    if(action==='offer'){
      if(state.pending&&state.pending.id!==id)return fail('pending-encounter');
      if(state.pending&&(![0,1].includes(state.pending.attempt)||!equal(state.pending,makeOffer(c,state.pending.attempt))))return fail('invalid-offer');
      if(!state.pending)state.pending=makeOffer(c,0);
      if(!state.pending)return fail('no-legend-skill');
    }else{
      const p=state.pending;
      if(!p||p.id!==id)return fail('missing-offer');
      if(![0,1].includes(p.attempt)||!equal(p,makeOffer(c,p.attempt)))return fail('invalid-offer');
      if(action==='reroll'){
        if(kind!=='devil'||p.attempt!==0)return fail('reroll-exhausted');
        state.pending=makeOffer(c,1);
      }else{
        if(action==='refuse')choice='refuse';
        else if(action!=='claim')return fail('invalid-action');
        if(choice!=='refuse'){
          if(kind==='angel'){
            if(choice==='maxHp'){const gain=Math.max(1,Math.round(maxHp*p.maxHpRatio));maxHp+=gain;hp+=gain;}
            else if(choice==='heal')hp=Math.min(maxHp,hp+Math.round(maxHp*p.healRatio));
            else return fail('invalid-choice');
          }else{
            if(choice!=='accept')return fail('invalid-choice');
            const cost=Math.max(1,Math.round(maxHp*p.hpCostRatio));
            if(hp<=cost)return fail('insufficient-hp');
            maxHp=Math.max(1,maxHp-cost);hp=Math.min(maxHp,hp-cost);grant={source:'devil',encounterId:id,stage:c.stage,skillId:p.skillId,rarity:'legend'};
          }
        }
        state.receipts.push({...p,choice,hpBefore:c.hp,maxHpBefore:c.maxHp,hpAfter:hp,maxHpAfter:maxHp,grant});
        state.pending=null;
      }
    }
    return freeze({ok:true,state,hp,maxHp,grant,offer:state.pending});
  }
  const offer=(s,c)=>transition(s,c,'offer');
  const claim=(s,c)=>transition(s,c,'claim',c.choice);
  const refuse=(s,c)=>transition(s,c,'refuse');
  const reroll=(s,c)=>transition(s,c,'reroll');
  function isTouching(player,npc){return !!(player&&npc&&Number.isFinite(player.x)&&Number.isFinite(player.y)&&Number.isFinite(npc.x)&&Number.isFinite(npc.y)&&Math.hypot(player.x-npc.x,player.y-npc.y)<40+Math.max(0,player.r||0));}
  function findPosition(g,kind){
    const helper=root.ArtemisCampaignValkyrie;if(!helper)return null;
    return helper.findPosition(g,kind==='devil'?'portal':'center');
  }
  function draw(ctx,npc,now,low,near){
    if(!npc)return;
    const reduced=!!low || !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(root.ArtemisCampaignNPCArt?.draw(ctx,npc,now,reduced,near,npc.kind==='devil'?'devil':'angel'))return;
    if(npc.kind!=='devil'){if(root.ArtemisCampaignValkyrie)root.ArtemisCampaignValkyrie.draw(ctx,{...npc,label:'Thiên thần',prompt:'Chạm để nhận phước lành'},now,low,near);return;}
    ctx.save();ctx.translate(npc.x,npc.y+(low?0:Math.sin(now*.003)*3));ctx.fillStyle='#b91c1c';
    ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(-19,24);ctx.lineTo(19,24);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(0,-16,12,0,Math.PI*2);ctx.fill();
    for(const s of [-1,1]){ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.moveTo(s*5,-24);ctx.lineTo(s*14,-37);ctx.lineTo(s*13,-19);ctx.fill();}
    ctx.fillStyle='#fde68a';ctx.fillRect(-6,-18,3,3);ctx.fillRect(3,-18,3,3);ctx.textAlign='center';ctx.font='bold 11px system-ui';ctx.fillText(near?'Chạm để lập khế ước':'Ác quỷ',0,45);ctx.restore();
  }
  /* No network stub: persist(result,{action,context}) must acknowledge a real save.
   * onCommitted(result) is the ONLY grant/apply hook; it runs after acknowledgement.
   * getState/getContext must read latest state, not capture a stale checkpoint.
   */
  function createController(options){
    if(!options||typeof options.persist!=='function'||typeof options.onCommitted!=='function')throw Error('Persistence and commit callbacks required');
    const doc=options.document||root.document,host=options.host||doc.body;
    let panel=null,busy=false,disposed=false;
    function close(){if(panel){panel.remove();panel=null;}}
    function message(text){if(panel)panel.querySelector('[data-error]').textContent=text;}
    function render(result){
      close();const p=result.offer;if(!p||disposed)return;
      panel=doc.createElement('section');panel.className='campaign-encounter '+p.kind;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',p.kind==='angel'?'Phước lành thiên thần':'Khế ước ác quỷ');
      const title=doc.createElement('h2');title.textContent=p.kind==='angel'?'PHƯỚC LÀNH':'KHẾ ƯỚC ÁC QUỶ';panel.appendChild(title);
      const cards=doc.createElement('div');cards.className='encounter-cards';panel.appendChild(cards);
      const button=(text,action,choice,card)=>{const b=doc.createElement('button');b.type='button';b.className=card?'encounter-card':'encounter-action';b.textContent=text;b.onclick=()=>act(action,choice);(card?cards:panel).appendChild(b);};
      if(p.kind==='angel'){
        button('♥ Tăng 10% máu tối đa','claim','maxHp',true);
        button(`✚ Hồi ${Math.round(p.healRatio*100)}% máu tối đa`,'claim','heal',true);
      }else{
        const skill=(options.getContext().catalog||[]).find(s=>s.id===p.skillId);
        button(`★ HUYỀN THOẠI · ${skill?skill.name||skill.id:p.skillId}\nNhận kỹ năng · Mất ${Math.max(1,Math.round(result.maxHp*p.hpCostRatio))} HP tối đa`,'claim','accept',true);
        if(p.attempt===0)button('Đổi kỹ năng · 1 lần','reroll');
      }
      button('Từ chối','refuse');const error=doc.createElement('p');error.dataset.error='';error.setAttribute('role','status');panel.appendChild(error);host.appendChild(panel);
    }
    async function act(action,choice){
      if(busy||disposed)return false;busy=true;
      if(panel)panel.querySelectorAll('button').forEach(b=>{b.disabled=true;});
      try{
        const context={...options.getContext(),choice};
        const result=transition(options.getState(),context,action,choice);
        if(!result.ok){message(result.reason==='insufficient-hp'?'Không đủ HP để lập khế ước.':'Không thể nhận lựa chọn này.');return false;}
        const ack=await options.persist(result,{action,context});
        if(ack!==true&&(!ack||ack.ok!==true))throw Error('save-rejected');
        await options.onCommitted(result);
        if(!disposed){if(result.offer)render(result);else close();}return true;
      }catch(error){message('Lưu chưa thành công. Vui lòng thử lại.');if(options.onError)options.onError(error);return false;}
      finally{busy=false;if(panel)panel.querySelectorAll('button').forEach(b=>{b.disabled=false;});}
    }
    return Object.freeze({
      async touch(player,npc){if(disposed||panel||busy||!isTouching(player,npc))return false;const c=options.getContext();if(!npc||npc.kind!==kindAt(c.stage))return false;return act('offer');},
      get isOpen(){return !!panel;},get busy(){return busy;},
      destroy(){disposed=true;close();}
    });
  }
  root.ArtemisCampaignEncounters=Object.freeze({ANGEL_STAGES,DEVIL_STAGES,VALKYRIE_STAGES,kindAt,create,offer,claim,refuse,reroll,transition,isTouching,findPosition,draw,createController});
})(typeof window!=='undefined'?window:globalThis);
