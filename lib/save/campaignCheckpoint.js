// Sổ checkpoint chống phát lại; không xác minh giao tranh phía client.
import '../../public/campaign-support.js';
import '../../public/campaign-wheel.js';
import { validateCampaignEncounterTransition } from './encounterCheckpoint.js';
const wheel = globalThis.ArtemisCampaignWheel;
const support = globalThis.CampaignSupport;
// Receipt verification only: combat between room boundaries remains client-side.
function supportTransition(old, cp, encounterHPTransition = false) {
  const next = support.normalize(cp.support);
  if (cp.support && !equal(cp.support,next)) return 'support_shape';
  const reached = stage => cp.boundary === 'cleared' && stage <= cp.room;
  if (next.finished || !next.receipts.every(r=>reached(r.stage))
      || (next.pending && (!reached(next.pending.stage) || next.pending.stage !== cp.room))) return 'support_stage';
  if (!old || old.runId !== cp.runId) {
    return next.receipts.length || next.pending ? 'support_entry' : null;
  }
  const prev = support.normalize(old.support);
  if (old.support && !cp.support) return 'support_removed';
  if (!prev.receipts.every((r,i)=>equal(r,next.receipts[i]))) return 'support_receipt_rollback';
  const added = next.receipts.slice(prev.receipts.length);
  if (added.length) {
    if (added.length !== 1 || !prev.pending || added[0].stage !== prev.pending.stage
        || cp.room !== old.room || cp.boundary !== old.boundary
        || !equal(cp.player.skills,old.player.skills)
        || !equal(cp.runProgression,old.runProgression)) return 'support_not_offered';
    const claim = support.claim(prev,{stage:added[0].stage,choice:added[0].choice,
      hp:old.player.hp,maxHp:old.player.maxHp});
    if (!claim.ok || !equal(claim.state,next) || claim.hp !== cp.player.hp
        || claim.maxHp !== cp.player.maxHp) return 'support_claim_cost';
  } else {
    if (prev.pending && !equal(prev.pending,next.pending)) return 'support_offer_changed';
    // Heart loot may heal once when the saved clear's outstanding rewards settle.
    const healingOnly = equal(prev,next) && cp.player.maxHp === old.player.maxHp
      && cp.player.hp >= old.player.hp && cp.player.hp <= cp.player.maxHp;
    const settlementHeal = healingOnly && old.rewardSettled === false
      && cp.rewardSettled === true && cp.boundary === 'cleared';
    // Historical receipts authenticate earlier support claims, not HP in later rooms.
    // Keep the claim boundary and pending costs strict; combat HP is not authoritative.
    const beforeSupportHeal = healingOnly && !prev.pending
      && prev.receipts.every(receipt => receipt.stage < cp.room);
    if (old.support && cp.room === old.room && cp.boundary === old.boundary
        && equal(cp.player.skills,old.player.skills) && !settlementHeal && !beforeSupportHeal
        && !encounterHPTransition
        && (cp.player.hp !== old.player.hp || cp.player.maxHp !== old.player.maxHp)) return 'support_hp_replay';
  }
  return null;
}
const stageOK = x => x === 'start' || (Number.isInteger(x) && x >= 5 && x <= 45 && x % 10 === 5);
const legacyStageOK = x => Number.isInteger(x) && x >= 10 && x <= 40 && x % 10 === 0;
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const sum = skills => Object.values(skills || {}).reduce((a,n)=>a+n,0);
const fail = detail => ({ok:false,error:{code:'CAMPAIGN_CHECKPOINT_TRANSITION',error:'Checkpoint chiến dịch không hợp lệ.',detail}});
const subset = (a,b) => a.every(x=>b.includes(x));
function state(cp) {
  const p=cp.runProgression || {};
  return {skills:p.skills || p.acquiredSkills || {},claimed:p.claimedStages || p.claimedValkyrieStages || [],
    skipped:p.skippedValkyrieStages || [],used:p.choicesUsed ?? p.skillChoicesUsed ?? 0,offer:p.pendingOffer || null};
}
// Verify exact deterministic receipts without prepare() repairing foreign/malformed input.
function validWheelReceipt(r, cp) {
  if (!r || Object.keys(r).sort().join(',') !== 'chapter,index,room,runId,status,version') return false;
  const expected = wheel.prepare({runId:r.runId,chapter:r.chapter,room:r.room}, r);
  return !!expected && Object.keys(expected).every(key => r[key] === expected[key])
    && r.runId === cp.runId && r.chapter === cp.chapterId && cp.boundary === 'cleared'
    && cp.roomCleared === true && r.room <= cp.room;
}
// The caller must also enforce the returned scroll delta against gearScrolls.weapon.
export function validateCampaignWheelTransition(old, cp) {
  const has = value => !!value && value.wheel != null;
  const zero = {ok:true,gold:0,scrolls:0};
  const bad = reason => ({ok:false,reason});
  if (!cp) return zero; // Ending a run retires its ID in validateCampaignCheckpoint.
  if (has(cp) && !validWheelReceipt(cp.wheel, cp)) return bad('wheel_receipt');
  if (!old || old.runId !== cp.runId) return has(cp) ? bad('wheel_entry') : zero;
  if (has(old) && !validWheelReceipt(old.wheel, old)) return bad('wheel_previous_receipt');
  if (has(old) && !has(cp)) return bad('wheel_removed');
  if (!has(cp)) return zero;
  const prev = old.wheel, next = cp.wheel;
  if (!prev || next.room !== prev.room) {
    // Debounced saves may first send an unclaimed room-4 receipt at room 5.
    // Carrying a ready receipt grants nothing; claiming still requires the exact saved room below.
    if (next.status !== 'ready' || next.room > cp.room || next.room < old.room || cp.room < old.room
        || (prev && next.room <= prev.room)) return bad('wheel_not_offered');
    return zero;
  }
  if (prev.status === 'claimed' && next.status !== 'claimed') return bad('wheel_replayed');
  if (prev.status === next.status) return zero;
  if (prev.status !== 'ready' || next.status !== 'claimed' || cp.room !== old.room
      || next.room !== cp.room || cp.chapterId !== old.chapterId
      || old.boundary !== 'cleared' || cp.boundary !== 'cleared') return bad('wheel_claim_boundary');
  const reward = wheel.outcome({runId:cp.runId,chapter:cp.chapterId,room:cp.room});
  const gold = reward.kind === 'gold' ? reward.amount : 0;
  if (cp.runGold !== old.runGold + gold) return bad('wheel_gold_delta');
  return {ok:true,gold,scrolls:reward.kind === 'scroll' ? reward.amount : 0};
}

export function validateCampaignCheckpoint(previousLedger, checkpoint) {
  const ledger=structuredClone(previousLedger || {active:null,retired:[]});
  const old=ledger.active;
  if (!checkpoint || checkpoint.v !== 2 || !checkpoint.runId) {
    // Client cũ tiếp tục hoạt động nhưng không được hồi sinh run đã khóa.
    if (old) {ledger.retired=[...new Set([...ledger.retired,old.runId])];ledger.active=null;}
    if (checkpoint && ledger.retired.length) return fail('legacy_downgrade');
    return {ok:true,campaignCheckpoint:ledger,wheelReceiptDelta:{ok:true,gold:0,scrolls:0}};
  }
  const cp=checkpoint, next=state(cp);
  const wheelReceiptDelta = validateCampaignWheelTransition(old, cp);
  if (!wheelReceiptDelta.ok) return fail(wheelReceiptDelta.reason);
  const prevState = old?.runId === cp.runId ? state(old) : null;
  const historicStageOK = x => stageOK(x) || (legacyStageOK(x) && !!prevState
    && (prevState.claimed.includes(x) || prevState.skipped.includes(x) || prevState.offer?.stageId === x));
  const offerStageOK = x => stageOK(x) || (legacyStageOK(x) && prevState?.offer?.stageId === x);
  if (!cp.runProgression || cp.maxRooms !== 50 || !['entry','cleared'].includes(cp.boundary)) return fail('shape');
  if (cp.boundary === 'entry' && (cp.room !== 1 || cp.roomCleared !== false)) return fail('entry');
  if (cp.boundary === 'cleared' && cp.roomCleared !== true) return fail('cleared');
  if (!equal(cp.player.skills,next.skills) || sum(next.skills)>10 || next.used!==sum(next.skills)
      || (cp.runProgression.runSkillLevel ?? next.used)!==next.used || next.claimed.length!==next.used
      || !next.claimed.every(historicStageOK) || !next.skipped.every(x=>historicStageOK(x)&&x!=='start')
      || next.claimed.some(x=>next.skipped.includes(x))) return fail('skill_receipts');
  const reached = x => x==='start' || (cp.boundary==='cleared' && x<=cp.room);
  if (![...next.claimed,...next.skipped].every(reached) || (next.offer && (!offerStageOK(next.offer.stageId)
      || !reached(next.offer.stageId) || next.claimed.includes(next.offer.stageId) || next.skipped.includes(next.offer.stageId)))) return fail('stage');
  if (!old || old.runId!==cp.runId) {
    if (ledger.retired.includes(cp.runId)) return fail('retired_run');
    if (next.used || next.claimed.length || next.skipped.length || cp.boundary!=='entry') return fail('new_run_entry_required');
    if (old) ledger.retired.push(old.runId);
  } else {
    const prev=state(old);
    const sameBoundary=cp.room===old.room && cp.boundary===old.boundary;
    const settling=old.rewardSettled===false && cp.rewardSettled===true && cp.boundary==='cleared';
    if (sameBoundary && old.rewardSettled!==false && cp.rewardSettled===false) return fail('reward_reopened');
    if (cp.chapterId!==old.chapterId || cp.chapterIdx!==old.chapterIdx || cp.room<old.room
        || (old.boundary==='cleared' && cp.boundary==='entry') || cp.kills<old.kills || cp.runGold<old.runGold
        || (sameBoundary && cp.runGold!==old.runGold && !settling && wheelReceiptDelta.gold === 0)) return fail('rollback_or_reward_replay');
    const generating=!prev.offer && next.offer && next.offer.rerollsUsed===0;
    const rerolling=prev.offer && next.offer && next.offer.rerollsUsed===prev.offer.rerollsUsed+1;
    if ((!generating && !rerolling && cp.runProgression.seed!==old.runProgression.seed)
        || !subset(prev.claimed,next.claimed) || !subset(prev.skipped,next.skipped)) return fail('receipt_rollback');
    const skippedAdded=next.skipped.filter(x=>!prev.skipped.includes(x));
    if (skippedAdded.length && (skippedAdded.length!==1 || !prev.offer || prev.offer.stageId!==skippedAdded[0] || next.offer)) return fail('skip_not_offered');
    const added=next.claimed.filter(x=>!prev.claimed.includes(x));
    const changed=new Set([...Object.keys(prev.skills),...Object.keys(next.skills)]);
    const deltas=[...changed].filter(id=>(next.skills[id]||0)!==(prev.skills[id]||0));
    if (added.length) {
      if (added.length!==1 || !prev.offer || prev.offer.stageId!==added[0] || deltas.length!==1
          || !prev.offer.skillIds.includes(deltas[0]) || (next.skills[deltas[0]]||0)!==(prev.skills[deltas[0]]||0)+1
          || next.used!==prev.used+1 || next.offer) return fail('choice_not_offered');
    } else if (deltas.length || next.used!==prev.used) return fail('unreceipted_skill');
    if (prev.offer && !added.length) {
      const skipped=next.skipped.includes(prev.offer.stageId);
      if (!next.offer && !skipped) return fail('offer_lost');
      if (next.offer) {
        if (next.offer.stageId!==prev.offer.stageId || next.offer.provider!==prev.offer.provider
            || next.offer.rerollLimit!==prev.offer.rerollLimit || next.offer.rerollsUsed<prev.offer.rerollsUsed
            || next.offer.rerollsUsed>prev.offer.rerollsUsed+1 || next.offer.rerollsUsed>prev.offer.rerollLimit
            || (next.offer.rerollsUsed===prev.offer.rerollsUsed && !equal(next.offer,prev.offer))) return fail('offer_replay');
      }
    } else if (next.offer && next.offer.rerollsUsed!==0) return fail('new_offer_reroll');
  }
  const encounterTransition=validateCampaignEncounterTransition(old,cp);
  if (!encounterTransition.ok) return fail(encounterTransition.reason);
  const supportError=supportTransition(old,cp,encounterTransition.hpChanged === true);
  if (supportError) return fail(supportError);
  ledger.active=structuredClone(cp);
  return {ok:true,campaignCheckpoint:ledger,wheelReceiptDelta,encounterTransition};
}
