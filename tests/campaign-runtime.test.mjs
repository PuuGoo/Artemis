import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);let d=0;for(let i=html.indexOf('{',start);i<html.length;i++){if(html[i]==='{')d++;if(html[i]==='}'&&!--d)return html.slice(start,i+1);}throw Error(name);}
test('chiến dịch boss chỉ ở mốc10; mode săn trùm vẫn mọi phòng',()=>{
 const context={Game:{mode:'campaign',maxRooms:50},getGameMode:id=>({hasChapters:id==='campaign',bossOnly:id==='bossrush'})};
 const config=new URL('../public/campaign-config.js',import.meta.url);if(fs.existsSync(config))vm.runInNewContext(fs.readFileSync(config,'utf8'),context);
 vm.runInNewContext(fn('isBossRoom'),context);
 for(let room=1;room<=50;room++)assert.equal(context.isBossRoom(room,50),room%10===0,'ải '+room);
 context.Game.mode='bossrush';assert.equal(context.isBossRoom(3,5),true);
});
test('LV10 chiến dịch không mở modal từ EXP; gọi trực tiếp không cấp thứ11',()=>{
 assert.match(fn('applyRogueSkill'),/runProgression/);
 assert.match(html,/ArtemisCampaignSkills/);
 const update=fn('updateGame');
 const branch=update.match(/if \(usesCampaignTuning\(\)\) \{\s*ArtemisCampaignExp\.gain\(p, d.val\);\s*\} else \{/);
 assert.ok(branch, 'chiến dịch phải tách EXP khỏi nhánh modal cũ của các mode khác');
});
test('checkpoint lưu phòng sạch và không sinh lại boss khi Continue',()=>{
 const context = vm.createContext({Game:{running:true,chapter:{id:1},room:1,maxRooms:50,player:{hp:100,maxHp:100,atk:10,skills:{}}},SaveState:{selectedChapterIdx:0,save(){}},CHECKPOINT_VERSION:2,usesCampaignTuning:()=>true});
 vm.runInContext(fn('canSaveCheckpoint')+'\n'+fn('saveCheckpoint'),context);
 assert.equal(context.saveCheckpoint(),false,'không lưu giữa combat');
 context.Game.campaignEntrySafe=true;
 assert.equal(context.saveCheckpoint(),true);
 assert.equal(context.SaveState.dungeonCheckpoint.boundary,'entry');
 assert.equal(context.SaveState.dungeonCheckpoint.roomCleared,false);
 context.Game.room=10;context.Game.roomCleared=true;
 assert.equal(context.saveCheckpoint(),true);
 assert.equal(context.SaveState.dungeonCheckpoint.boundary,'cleared');
 assert.equal(context.SaveState.dungeonCheckpoint.roomCleared,true);
 assert.match(fn('continueRun'),/restoreClearedCampaignRoom/);
 assert.doesNotMatch(fn('continueRun'),/applyRogueSkill\(/);
});
