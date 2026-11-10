import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
function body(name,next){const start=html.indexOf(`      ${name}`);assert.ok(start>=0,name);return html.slice(start,html.indexOf(`      ${next}`,start));}
test('wheel contact paints before pending entry checkpoint acknowledgement',async()=>{
 let opened=0,released=false,resolve;const entry=new Promise(r=>resolve=r);
 const context={Game:{paused:false,wheelNpc:{},skillClaimBusy:false,joy:{}},SaveState:{dungeonCheckpoint:{},save(){}},saveCheckpoint(){return true;},window:{ArtemisCloud:{enqueueCheckpoint:()=>entry}},ArtemisCampaignWheel:{open(){opened++;return {};}}};
 vm.createContext(context);vm.runInContext(body('async function openCampaignWheel()','function spawnCampaignValkyrie()'),context);
 const opening=context.openCampaignWheel();assert.equal(opened,1,'dialog must paint synchronously, not wait for PUT');assert.equal(released,false);resolve(true);released=true;assert.equal(await opening,true);
});
test('existing wheel NPC contact is not delayed by remaining floor loot',()=>{
 let opened=0;const p={x:100,y:100,r:17};const g={roomCleared:true,drops:[{type:'gold',x:300,y:300,val:1}],wheelNpc:{x:100,y:100},paused:false};
 const start=html.indexOf('        // Check Portal Walk-In when Room is Cleared');
 const end=html.indexOf('        if (Game.portalOpen',start);assert.ok(start>0&&end>start);
 vm.runInNewContext('(function(){'+html.slice(start,end)+'})()',{Game:g,p,settleClearedRoomLoot(){g.drops=[];},spawnCampaignEncounter(){},spawnCampaignWheel(){},ArtemisCampaignWheel:{isNear:()=>true},openCampaignWheel(){opened++;}});
 assert.equal(opened,1,'touching an existing NPC must not wait for Game.drops.length === 0');
});
test('settling contact loot grants each real drop exactly once',()=>{
 const Game={roomCleared:true,runGold:0,drops:[{type:'gold',val:10},{type:'xp',val:3},{type:'heart',val:5},{type:'scroll',slot:'helmet',val:2}],player:{hp:50,maxHp:100,goldBonus:.2,x:100,y:100}};
 const SaveState={gold:0,gearScrolls:{}};let hooks=0,saves=0,xp=0;
 const c={Game,SaveState,SoundFX:{coinPickup(){}},usesCampaignTuning:()=>true,ArtemisCampaignExp:{gain(_p,n){xp+=n;}},spawnFloatText(){},ensureWikiCurrencyAndItemsState(){},WIKI_GEAR_SCROLLS_META:{helmet:{shortName:'Helmet Scroll'}},BeginnerHooks:{onLoot(){hooks++;}},saveCheckpoint(){saves++;},updateInGameHUD(){}};
 vm.createContext(c);vm.runInContext(body('function collectFloorDrop(d)','async function openCampaignWheel()'),c);c.settleClearedRoomLoot();c.settleClearedRoomLoot();
 assert.equal(Game.runGold,12);assert.equal(SaveState.gold,12);assert.equal(xp,3);assert.equal(Game.player.hp,55);assert.equal(SaveState.gearScrolls.helmet,2);assert.equal(hooks,4);assert.equal(saves,1);assert.equal(Game.drops.length,0);
});
test('entry checkpoint gate permits cleared living room 24 independently of loot and claim flags',()=>{
 const context={Game:{running:true,roomCleared:true,player:{hp:1},chapter:{id:1},room:24,maxRooms:50,drops:[{}],skillClaimBusy:true,pendingClaimId:'pending'},usesCampaignTuning:()=>true};vm.createContext(context);
 vm.runInContext(body('function canSaveCheckpoint()','/** Gọi khi phòng vừa sạch'),context);assert.equal(context.canSaveCheckpoint(),true);
});
test('wheel currently refuses a busy skill claim synchronously',async()=>{
 const context={Game:{paused:false,wheelNpc:{},skillClaimBusy:true},ArtemisCampaignWheel:{open(){assert.fail('busy claim opened wheel');}}};vm.createContext(context);vm.runInContext(body('async function openCampaignWheel()','function spawnCampaignValkyrie()'),context);assert.equal(await context.openCampaignWheel(),false);
});
