import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
function fn(name){const s=html.indexOf('function '+name+'(');assert.ok(s>=0);let d=0;for(let i=html.indexOf('{',s);i<html.length;i++){if(html[i]==='{')d++;if(html[i]==='}'&&!--d)return html.slice(s,i+1);}throw Error(name);}
function harness(){const c={Game:{running:true,roomCleared:false,room:1,maxRooms:50,chapter:{id:1},runId:'fixture-run-1',campaignEntrySafe:true,runProgression:{pendingOffer:{stageId:'start',skillIds:['atk_boost']}},player:{hp:775,maxHp:775,atk:164,skills:{},level:1}},SaveState:{selectedChapterIdx:0,save(){}},CHECKPOINT_VERSION:2,usesCampaignTuning:()=>true,Date,JSON,Math};vm.runInNewContext(fn('canSaveCheckpoint')+'\n'+fn('saveCheckpoint'),c);return c;}
test('initial offer is persisted at an explicit safe entry boundary, not discarded',()=>{const c=harness();assert.equal(c.saveCheckpoint(),true);assert.equal(c.SaveState.dungeonCheckpoint.boundary,'entry');assert.equal(c.SaveState.dungeonCheckpoint.roomCleared,false);assert.equal(c.SaveState.dungeonCheckpoint.runId,c.Game.runId);assert.equal(c.SaveState.dungeonCheckpoint.runProgression.pendingOffer.stageId,'start');});
test('entry checkpoint cannot be saved once room combat begins or player is dead',()=>{const c=harness();c.Game.campaignEntrySafe=false;assert.equal(c.saveCheckpoint(),false);c.Game.campaignEntrySafe=true;c.Game.player.hp=0;assert.equal(c.saveCheckpoint(),false);});
test('cleared room remains resumable and carries the same run identity',()=>{const c=harness();c.Game.roomCleared=true;c.Game.room=35;assert.equal(c.saveCheckpoint(),true);assert.equal(c.SaveState.dungeonCheckpoint.boundary,'cleared');assert.equal(c.SaveState.dungeonCheckpoint.roomCleared,true);});
