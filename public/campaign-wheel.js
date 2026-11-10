/* Vòng quay chiến dịch: classic script, không API giả hoặc localStorage.
 * Receipt+reward phải được persist nguyên tử bởi caller/server trước animation.
 * Server dùng cùng outcome (runId/chapter/room), không nhận index do client chọn.
 */
(function(root){
 'use strict';
 const REWARDS=Object.freeze([
  {kind:'gold',amount:1260},{kind:'gold',amount:630},{kind:'gold',amount:630},
  {kind:'gold',amount:420},{kind:'scroll',amount:3},{kind:'scroll',amount:6}
 ].map(Object.freeze));
 const isEncounterRoom=room=>Number.isInteger(room)&&room>=4&&room<=44&&room%10===4;
 function valid(o){return o&&typeof o.runId==='string'&&/^[a-zA-Z0-9_:-]{8,100}$/.test(o.runId)&&Number.isInteger(o.chapter)&&o.chapter>=1&&o.chapter<=19&&isEncounterRoom(o.room);}
 function outcome(o){
  if(!valid(o))return null;
  // FNV-1a uint32; stable across browser/server, no mutable progression seed.
  const key='campaign-wheel-v1|'+o.runId+'|'+o.chapter+'|'+o.room;let hash=2166136261;
  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619)>>>0;
  const index=hash%REWARDS.length;return {...REWARDS[index],index};
 }
 function prepare(o,raw){
  const reward=outcome(o);if(!reward)return null;
  const same=raw&&raw.version===1&&raw.runId===o.runId&&raw.chapter===o.chapter&&raw.room===o.room;
  if(same&&(raw.index!==reward.index||!['ready','claimed'].includes(raw.status)))return null;
  return {version:1,runId:o.runId,chapter:o.chapter,room:o.room,index:reward.index,status:same?raw.status:'ready'};
 }
 function claim({checkpoint:cp,save}){
  if(!cp||!save||cp.roomCleared!==true||cp.boundary!=='cleared')return {ok:false,reason:'boundary'};
  const o={runId:cp.runId,chapter:cp.chapterId,room:cp.room},reward=outcome(o),receipt=prepare(o,cp.wheel);
  if(!reward||!cp.wheel||!receipt||receipt.status==='claimed'||cp.wheel.runId!==o.runId||cp.wheel.chapter!==o.chapter||cp.wheel.room!==o.room)return {ok:false,reason:'receipt'};
  if(!Number.isSafeInteger(cp.runGold)||cp.runGold<0||cp.runGold+reward.amount>1e12)return {ok:false,reason:'balance'};
  if(reward.kind==='scroll'){
   const current=save.gearScrolls&&save.gearScrolls.weapon||0;
   if(!Number.isSafeInteger(current)||current<0||current+reward.amount>1e9)return {ok:false,reason:'balance'};
   save.gearScrolls={...(save.gearScrolls||{}),weapon:current+reward.amount};
  }else cp.runGold+=reward.amount;
  cp.wheel={...receipt,status:'claimed'};
  return {ok:true,reward,receipt:cp.wheel};
 }
 function label(r){return (r.kind==='gold'?'Xu':'Cuộn vũ khí')+' ×'+r.amount;}
 function findPosition(g){return root.ArtemisCampaignValkyrie?root.ArtemisCampaignValkyrie.findPosition(g):null;}
 function isNear(player,npc){return !!(player&&npc&&Math.hypot(player.x-npc.x,player.y-npc.y)<=((player.r||17)+(npc.r||22)+30));}
 function drawNPC(ctx,npc,now,low,near){
  if(!npc)return;ctx.save();ctx.translate(npc.x,npc.y);ctx.fillStyle='#713f12';ctx.fillRect(-19,8,38,15);
  for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,22,i*Math.PI/3,(i+1)*Math.PI/3);ctx.closePath();ctx.fillStyle=['#d9f99d','#e9d5ff','#fef3c7','#bae6fd','#fecdd3','#bbf7d0'][i];ctx.fill();}
  ctx.strokeStyle='#fbbf24';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#ef4444';ctx.beginPath();ctx.moveTo(-6,-29);ctx.lineTo(6,-29);ctx.lineTo(0,-16);ctx.closePath();ctx.fill();
  // Người dẫn vòng quay đội mũ cao, luôn vẽ trong canvas thật.
  ctx.fillStyle='#38bdf8';ctx.beginPath();ctx.arc(-34,0,10,0,Math.PI*2);ctx.fill();ctx.fillRect(-42,7,16,16);
  ctx.fillStyle='#172554';ctx.fillRect(-45,-13,22,5);ctx.fillRect(-41,-26,14,15);
  ctx.textAlign='center';ctx.font='bold 11px system-ui';ctx.fillStyle='#fef3c7';ctx.fillText(near?'Chạm để quay':'Vòng Quay',0,43);ctx.restore();
 }
 // Independent state machine: animation/skip never calls claim twice.
 function createSession(opts){
  let state=opts.checkpoint.wheel&&opts.checkpoint.wheel.status==='claimed'?'reward':'ready',reward=outcome({runId:opts.checkpoint.runId,chapter:opts.checkpoint.chapterId,room:opts.checkpoint.room}),error='';
  let pending=null;
  function start(){
   if(state!=='ready'&&state!=='error')return pending||Promise.resolve(false);
   state='saving';error='';
   if(opts.checkpoint.wheel.status!=='claimed'){
    const result=claim(opts);if(!result.ok){state='error';error='Không thể nhận thưởng: '+result.reason;return Promise.resolve(false);}reward=result.reward;
   }
   pending=Promise.resolve().then(()=>opts.persist(opts.checkpoint,opts.save)).then(ok=>{
    if(ok===false)throw new Error('save');state='spinning';return true;
   }).catch(()=>{state='error';error='Chưa lưu được thưởng. Nhấn để thử lại.';return false;});
   return pending;
  }
  return {start,settle(){if(state==='spinning')state='reward';},get state(){return state;},get reward(){return reward;},get error(){return error;}};
 }
 let active=null;
 function open(opts){
  if(active)return active;
  if(!opts||typeof opts.persist!=='function'||!root.document)return null;
  const cp=opts.checkpoint,o=cp&&{runId:cp.runId,chapter:cp.chapterId,room:cp.room};
  if(!cp||cp.roomCleared!==true||cp.boundary!=='cleared')return null;
  const receipt=prepare(o,cp.wheel);if(!receipt)return null;cp.wheel=receipt;
  const session=createSession(opts),doc=root.document,overlay=doc.createElement('div');
  overlay.className='campaign-wheel-overlay';overlay.innerHTML='<section class="campaign-wheel-panel" role="dialog" aria-modal="true" aria-label="Vòng Quay"><h2>Vòng Quay</h2><div class="campaign-wheel-stage"><div class="campaign-wheel-pointer"></div><div class="campaign-wheel-disc"></div></div><button class="campaign-wheel-start">Bắt Đầu</button><p class="campaign-wheel-help">Nhấn chỗ trống để đóng</p><div class="campaign-wheel-reward" role="status" hidden><h3>Thưởng đã nhận</h3><strong></strong><p>Nhấn chỗ trống để đóng</p></div></section>';
  const disc=overlay.querySelector('.campaign-wheel-disc'),button=overlay.querySelector('button'),banner=overlay.querySelector('.campaign-wheel-reward'),help=overlay.querySelector('.campaign-wheel-help');
  REWARDS.forEach((r,i)=>{const item=doc.createElement('span');item.className='campaign-wheel-prize';item.style.transform='rotate('+(i*60+30)+'deg) translateY(calc(min(310px,82vw,100vh - 280px) * -.34)) rotate(90deg)';item.textContent=(r.kind==='gold'?'🪙 ':'📜 ')+label(r);disc.appendChild(item);});
  let timer=null,closed=false;
  function showReward(){if(closed)return;session.settle();disc.style.transition='transform .16s ease-out';disc.style.transform='rotate('+(1800-(session.reward.index*60+30))+'deg)';banner.hidden=false;banner.querySelector('strong').textContent=label(session.reward);button.textContent='Đã nhận';button.disabled=true;}
  function close(){if(closed)return;closed=true;if(timer)root.clearTimeout(timer);overlay.remove();active=null;if(opts.onClose)opts.onClose();}
  button.addEventListener('click',async()=>{
   button.disabled=true;button.textContent='Đang lưu…';
   if(!await session.start()){button.disabled=false;button.textContent='Thử lại';help.textContent=session.error;return;}
   if(closed)return;button.textContent='Đang Xoay';disc.style.transition='transform 3.8s cubic-bezier(.12,.65,.1,1)';disc.style.transform='rotate('+(1800-(session.reward.index*60+30))+'deg)';timer=root.setTimeout(showReward,3900);
  });
  overlay.addEventListener('click',e=>{
   if(e.target.closest('button')||e.target.closest('.campaign-wheel-disc'))return;
   if(session.state==='spinning'){if(timer)root.clearTimeout(timer);showReward();}
   else if(session.state==='reward'||session.state==='ready')close();
  });
  doc.body.appendChild(overlay);active={close,session,element:overlay};if(session.state==='reward')showReward();return active;
 }
 root.ArtemisCampaignWheel=Object.freeze({REWARDS,isEncounterRoom,outcome,prepare,claim,createSession,findPosition,isNear,drawNPC,open});
})(typeof window!=='undefined'?window:globalThis);
