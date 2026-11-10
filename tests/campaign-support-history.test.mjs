import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../public/campaign-skills.js';
import '../public/campaign-support.js';
import '../public/campaign-telemetry.js';
import { sanitizeSave } from '../lib/save/schema.js';
import { validateCampaignCheckpoint } from '../lib/save/campaignCheckpoint.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
function fn(name) {
  const start = html.indexOf(`function ${name}(`), begin = html.indexOf('{', start);
  let depth = 0;
  for (let i = begin; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(name);
}
const skills = globalThis.ArtemisCampaignSkills, support = globalThis.CampaignSupport;
const catalog = [{ id: 'multishot', rarity: 'common' }, { id: 'max_hp_up', rarity: 'common' }];
function runtime() {
  const c = vm.createContext({ Game: {
    running:true, campaignEntrySafe:true, roomCleared:false, room:1, chapter:{id:1},
    maxRooms:50, kills:0, runGold:0, drops:[], runId:'support-history-run',
    player:{hp:60,maxHp:100,atk:10,skills:{},level:1},
    campaignSupport:support.create(), runProgression:skills.normalizeState({seed:42},catalog)
  }, SaveState:{selectedChapterIdx:0,save(){}}, CHECKPOINT_VERSION:2, Date,
  CampaignSupport:support, ArtemisCampaignTelemetry:globalThis.ArtemisCampaignTelemetry,
  usesCampaignTuning:()=>true });
  vm.runInContext(fn('canSaveCheckpoint')+'\n'+fn('saveCheckpoint'),c);
  return c;
}
function save(c, ledger) {
  assert.equal(c.saveCheckpoint(),true);
  const wire=JSON.parse(JSON.stringify(c.SaveState.dungeonCheckpoint));
  const clean=sanitizeSave({dungeonCheckpoint:wire});
  assert.equal(clean.ok,true);
  const result=validateCampaignCheckpoint(ledger,clean.data.dungeonCheckpoint);
  assert.equal(result.ok,true,result.error?.detail);
  return result.campaignCheckpoint;
}
function history() {
  const c=runtime();let ledger=save(c,null);
  Object.assign(c.Game,{room:10,roomCleared:true});
  c.Game.campaignSupport=support.offer(c.Game.campaignSupport,{stage:10,hp:60,maxHp:100,cost:{pct:10,costHp:10,directHp:true}}).state;
  ledger=save(c,ledger);
  const claim=support.claim(c.Game.campaignSupport,{stage:10,choice:'devil',hp:60,maxHp:100});
  c.Game.campaignSupport=claim.state;c.Game.player.hp=claim.hp;c.Game.player.maxHp=claim.maxHp;
  ledger=save(c,ledger);return {c,ledger};
}

test('old support receipts do not freeze natural HP healing at a later skill offer boundary',()=>{
  const {c,ledger:first}=history();
  c.Game.room=15;
  let ledger=save(c,first);
  // Execute the actual production periodic-healing block, not a parallel formula.
  const begin=html.indexOf('const healAmt = Math.max(12, Math.round(p.maxHp * (hasHeroSkillActive');
  const end=html.indexOf('\n            }',begin);
  assert.ok(begin>0 && end>begin);
  c.hasHeroSkillActive=()=>false;c.spawnFloatText=()=>{};
  vm.runInContext('{const p=Game.player;'+html.slice(begin,end)+'\n}}',c);
  c.Game.runProgression=skills.generateOffer(c.Game.runProgression,catalog,{stageId:15,segment:1}).state;
  const generated=JSON.parse(JSON.stringify(c.Game.runProgression));
  ledger=save(c,ledger);ledger=save(c,ledger); // Exact offer acknowledgement retry.
  assert.deepEqual(ledger.active.runProgression,generated);
  c.Game.runProgression=skills.claimOffer(c.Game.runProgression,catalog,generated.pendingOffer.skillIds[0]).state;
  c.Game.player.skills={...c.Game.runProgression.skills};
  ledger=save(c,ledger);
  assert.equal(ledger.active.runProgression.choicesUsed,1);
});

test('support claim plus skill claim must remain two acknowledged transitions',()=>{
  const c=runtime();let ledger=save(c,null);
  Object.assign(c.Game,{room:15,roomCleared:true});
  const offered=skills.generateOffer(c.Game.runProgression,catalog,{stageId:15,segment:1});
  assert.equal(offered.ok,true);
  c.Game.runProgression=offered.state;ledger=save(c,ledger);
  // An acknowledged, unclaimed skill receipt can remain pending at a later support boundary.
  c.Game.room=20;
  c.Game.campaignSupport=support.offer(c.Game.campaignSupport,{stage:20,hp:60,maxHp:100,cost:{pct:10,costHp:10,directHp:true}}).state;
  ledger=save(c,ledger);
  const claim=support.claim(c.Game.campaignSupport,{stage:20,choice:'skip',hp:60,maxHp:100});
  c.Game.campaignSupport=claim.state;
  const chosen=skills.claimOffer(offered.state,catalog,offered.state.pendingOffer.skillIds[0]);
  assert.equal(chosen.ok,true);
  c.Game.runProgression=chosen.state;c.Game.player.skills={...chosen.state.skills};
  c.saveCheckpoint();
  const cp=sanitizeSave({dungeonCheckpoint:JSON.parse(JSON.stringify(c.SaveState.dungeonCheckpoint))}).data.dungeonCheckpoint;
  assert.equal(validateCampaignCheckpoint(ledger,cp).error?.detail,'support_not_offered');
  // Separate acknowledgements succeed and identical retries remain harmless.
  c.Game.runProgression=offered.state;c.Game.player.skills={};
  ledger=save(c,ledger);
  const savedOffer=structuredClone(ledger.active);
  c.Game.runProgression=chosen.state;c.Game.player.skills={...chosen.state.skills};
  ledger=save(c,ledger);ledger=save(c,ledger);
  assert.equal(ledger.active.runProgression.choicesUsed,1);
  assert.equal(ledger.active.support.receipts.length,1);
  assert.equal(validateCampaignCheckpoint(ledger,savedOffer).ok,false,'claim cannot be reopened');
});
