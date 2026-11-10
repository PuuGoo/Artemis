import { isDeepStrictEqual as equal } from 'node:util';
import '../../public/campaign-encounters.js';
import '../../public/campaign-legend-catalog.js';
const encounters=globalThis.ArtemisCampaignEncounters;
export const ENCOUNTER_LEGEND_CATALOG=globalThis.ArtemisCampaignLegendCatalog;
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const str=(x,n)=>typeof x==='string'&&x.length>0&&x.length<=n;
const hp=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=1e12;
const ids=new Set(ENCOUNTER_LEGEND_CATALOG.filter(s=>s.providers.includes('devil')).map(s=>s.id));
function offer(raw){
  if(!object(raw)||!str(raw.id,200)||!Number.isInteger(raw.stage)||encounters.kindAt(raw.stage)!==raw.kind)return null;
  if(raw.kind==='angel'){
    if(raw.attempt!==0||!Number.isFinite(raw.healRatio)||raw.healRatio<.25||raw.healRatio>.45||raw.maxHpRatio!==.1)return null;
    return {id:raw.id,stage:raw.stage,kind:raw.kind,attempt:0,healRatio:raw.healRatio,maxHpRatio:.1};
  }
  if(![0,1].includes(raw.attempt)||!ids.has(raw.skillId)||raw.rarity!=='legend'||raw.hpCostRatio!==.15)return null;
  return {id:raw.id,stage:raw.stage,kind:raw.kind,attempt:raw.attempt,skillId:raw.skillId,rarity:'legend',hpCostRatio:.15};
}
function receipt(raw){
  const p=offer(raw);if(!p||!['refuse',...(p.kind==='angel'?['heal','maxHp']:['accept'])].includes(raw.choice)
    ||!['hpBefore','maxHpBefore','hpAfter','maxHpAfter'].every(k=>hp(raw[k])))return null;
  let grant=null;
  if(p.kind==='devil'&&raw.choice==='accept'){
    const g=raw.grant;if(!object(g)||g.source!=='devil'||g.encounterId!==p.id||g.stage!==p.stage||g.skillId!==p.skillId||g.rarity!=='legend')return null;
    grant={source:'devil',encounterId:p.id,stage:p.stage,skillId:p.skillId,rarity:'legend'};
  }else if(raw.grant!==null)return null;
  return {...p,choice:raw.choice,hpBefore:raw.hpBefore,maxHpBefore:raw.maxHpBefore,hpAfter:raw.hpAfter,maxHpAfter:raw.maxHpAfter,grant};
}
// Malformed input stays an invalid bounded sentinel: never repair it into an award.
export function sanitizeCheckpointEncounters(raw){
  if(!object(raw)||raw.version!==1||!str(raw.runId,160)||!Array.isArray(raw.receipts)||raw.receipts.length>9)return {};
  const pending=raw.pending===null?null:offer(raw.pending);
  if(raw.pending!==null&&!pending)return {};
  const receipts=raw.receipts.map(receipt);if(receipts.some(r=>!r))return {};
  return {version:1,runId:raw.runId,pending,receipts};
}
const context=(cp,player=cp.player,stage=cp.room)=>({runId:cp.runId,stage,hp:player.hp,maxHp:player.maxHp,
  catalog:ENCOUNTER_LEGEND_CATALOG,bossDefeated:cp.boundary==='cleared'&&cp.roomCleared===true});
function validState(s,cp){
  if(!equal(s,sanitizeCheckpointEncounters(s))||s.runId!==cp.runId)return false;
  let last=0;
  for(const r of s.receipts){
    if(r.stage<=last||r.stage>cp.room||cp.boundary!=='cleared')return false;last=r.stage;
    const c=context(cp,{hp:r.hpBefore,maxHp:r.maxHpBefore},r.stage);
    let replay=encounters.offer(encounters.create(cp.runId),c);
    if(r.attempt===1)replay=encounters.reroll(replay.state,c);
    replay=encounters.transition(replay.state,c,'claim',r.choice);
    if(!replay.ok||!equal(replay.state.receipts[0],r))return false;
  }
  if(s.pending){
    if(s.pending.stage!==cp.room||s.pending.stage<=last||cp.boundary!=='cleared')return false;
    let replay=encounters.offer({...encounters.create(cp.runId),receipts:s.receipts},context(cp));
    if(s.pending.attempt===1&&replay.ok)replay=encounters.reroll(replay.state,context(cp));
    if(!replay.ok||!equal(replay.state.pending,s.pending))return false;
  }
  return true;
}
const noChange=()=>({ok:true,action:null,hpChanged:false,grant:null});
export function validateCampaignEncounterTransition(old,cp){
  const bad=reason=>({ok:false,reason});
  if(!cp)return noChange();
  const has=Object.hasOwn(cp,'encounters'),same=old?.runId===cp.runId;
  if(!has)return same&&Object.hasOwn(old,'encounters')?bad('encounter_removed'):noChange();
  const next=cp.encounters;
  if(!validState(next,cp))return bad('encounter_shape');
  const prev=same&&Object.hasOwn(old,'encounters')?old.encounters:encounters.create(cp.runId);
  if(!same)return equal(next,prev)?noChange():bad('encounter_entry');
  if(!validState(prev,old))return bad('encounter_previous_state');
  if(!prev.receipts.every((r,i)=>equal(r,next.receipts[i])))return bad('encounter_receipt_rollback');
  if(equal(prev,next))return noChange();
  if(cp.room!==old.room||cp.boundary!==old.boundary||cp.boundary!=='cleared'||!cp.roomCleared||!old.roomCleared)return bad('encounter_boundary');
  // An encounter may alter HP and its receipt only, never regular skill progression or loot.
  const strip=p=>{const {hp,maxHp,...rest}=p;return rest;};
  if(!equal(strip(cp.player),strip(old.player))||!equal(cp.runProgression,old.runProgression)
    ||['runGold','kills','rewardSettled','support','wheel'].some(k=>!equal(cp[k],old[k])))return bad('encounter_side_effect');
  const added=next.receipts.slice(prev.receipts.length);
  let action,choice;
  if(added.length){if(added.length!==1||!prev.pending)return bad('encounter_not_offered');action='claim';choice=added[0].choice;}
  else if(!prev.pending){action='offer';}
  else {action='reroll';}
  const result=encounters.transition(prev,context(cp,old.player),action,choice);
  if(!result.ok||!equal(result.state,next)||result.hp!==cp.player.hp||result.maxHp!==cp.player.maxHp)return bad('encounter_replay');
  return {ok:true,action,choice:choice??null,hpChanged:result.hp!==old.player.hp||result.maxHp!==old.player.maxHp,
    hp:result.hp,maxHp:result.maxHp,grant:result.grant,receipt:added[0]||null};
}
