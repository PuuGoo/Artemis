// Thăm dò chiến đấu tự nhiên có giới hạn; không cấp tài nguyên hay sửa thực thể.
import {startFixture} from './verify-campaign-http.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {freemem} from 'node:os';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const evidence=resolve(root,'docs/campaign-natural-evidence.json');
const budgetSeconds=Math.max(20,Math.min(240,Number(process.env.CAMPAIGN_PROBE_SECONDS)||80));
const result={status:'RUNNING',scope:'One canonical fresh account; natural production combat, real keyboard/UI, loopback real auth/save handlers with isolated memory DB. Not production, Mongo durability, full chapter completion or win rate.',budgetSeconds:80,mutations:'Only registration, real UI clicks and keyboard inputs; no damage hooks, HP/ATK edits, invulnerability, teleports, room jumps or resource grants.',errors:[],choices:[],samples:[],blockedExternalRequests:0};
let fixture,browser,page,held=[],started=0;
result.budgetSeconds=budgetSeconds;
const watchdog=setTimeout(()=>{console.error('Natural probe hard deadline');process.exit(2);},(budgetSeconds+35)*1000);
const snapshot=()=>page.evaluate(()=>{
  const {Game:g,SaveState:s}=window.Archero2FusionAPI,p=g.player;
  return {room:g.room,maxRooms:g.maxRooms,chapter:g.chapter?.id,running:g.running,paused:g.paused,roomCleared:g.roomCleared,kills:g.kills,runGold:g.runGold,width:g.width,height:g.height,wallPad:g.wallPad,portal:g.portalRect,portalOpen:g.portalOpen,npc:g.valkyrieNpc?{x:g.valkyrieNpc.x,y:g.valkyrieNpc.y,state:g.valkyrieNpc.state}:null,drops:g.drops.length,player:p?{x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,atk:p.atk,aspd:p.aspd,speed:p.speed,level:p.level,skills:{...p.skills}}:null,enemies:g.enemies.map(e=>({type:e.type,isBoss:e.isBoss,hp:e.hp,maxHp:e.maxHp,x:e.x,y:e.y})),account:{hero:s.selectedHeroId,gold:s.gold,gems:s.gems,scrolls:s.scrolls},cloud:window.ArtemisCloud.getState()};
});
async function keys(next){for(const k of held)if(!next.includes(k))await page.keyboard.up(k);for(const k of next)if(!held.includes(k))await page.keyboard.down(k);held=next;}
try {
  result.freeGBBeforeBrowser=freemem()/1024**3;assert.ok(result.freeGBBeforeBrowser>=3,'BLOCKED: free RAM below 3 GB');
  fixture=await startFixture();result.http=fixture.requests;
  const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/PuuGoo/AppData/Local/hermes/cache/scratch/artemis-browser/node_modules/playwright-core/index.mjs').href);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-extensions','--disable-background-networking']});
  const context=await browser.newContext({viewport:{width:1024,height:900}});page=await context.newPage();page.setDefaultTimeout(8000);
  page.on('pageerror',e=>result.errors.push(e.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==fixture.origin){result.blockedExternalRequests++;return route.abort();}return route.continue();});
  const registration=await context.request.post(fixture.origin+'/api/auth/register',{data:{username:'natural_'+randomBytes(5).toString('hex'),password:'fixture-password-only'}});
  result.registrationStatus=registration.status();assert.equal(registration.status(),201);assert.ok((await context.cookies()).some(c=>c.httpOnly));
  await page.goto(fixture.origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.Archero2FusionAPI&&window.ArtemisCloud?.getState().ready);
  const initial=await context.request.get(fixture.origin+'/api/save');assert.equal(initial.status(),200);result.canonicalSave=(await initial.json()).data;
  await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();await page.locator('#btnStartGame').click();await page.locator('#btnBriefingStart').click();
  await page.waitForSelector('#skillSelectModal:not(.hidden)');
  let waypoint=0,restUntil=0,room=1;
  started=Date.now();result.startedAt=new Date(started).toISOString();
  while(Date.now()-started<budgetSeconds*1000){
    const supportSkip=page.locator('#campaignSupportChoices [data-support="skip"]');
    if(await supportSkip.isVisible())await supportSkip.click();
    const cards=page.locator('#skillSelectModal:not(.hidden) .skill-choice-card:not([disabled])');
    if(await cards.count()){
      await keys([]);const card=cards.first(),skill=await card.getAttribute('data-skill-id');await card.click();result.choices.push({elapsedSeconds:(Date.now()-started)/1000,skill});
      await page.waitForTimeout(150);
    }
    const s=await snapshot();s.elapsedSeconds=(Date.now()-started)/1000;result.samples.push(s);
    if(!result.initialCombat&&s.player)result.initialCombat=s;
    if(!s.running||s.player?.hp<=0){result.stopReason=s.player?.hp<=0?'natural_death':'run_finished';break;}
    if(s.paused){await keys([]);await page.waitForTimeout(150);continue;}
    if(room!==s.room){room=s.room;waypoint=0;restUntil=0;}
    const p=s.player,pad=Math.max(s.wallPad+65,85),points=[[pad,pad],[s.width-pad,pad],[s.width-pad,s.height-pad],[pad,s.height-pad]];
    let target=points[waypoint];
    if(s.roomCleared){restUntil=0;target=s.npc?.state==='spawned'?[s.npc.x,s.npc.y]:[s.portal.x+s.portal.w/2,s.portal.y+s.portal.h/2];}
    const dx=target[0]-p.x,dy=target[1]-p.y;
    if(!s.roomCleared&&Math.hypot(dx,dy)<30&&Date.now()>=restUntil){waypoint=(waypoint+1)%4;restUntil=Date.now()+(p.hp/p.maxHp<.45?450:900);}
    if(Date.now()<restUntil)await keys([]);
    else await keys([...(Math.abs(dx)>16?[dx>0?'KeyD':'KeyA']:[]),...(Math.abs(dy)>16?[dy>0?'KeyS':'KeyW']:[])]);
    await page.waitForTimeout(200);
  }
  await keys([]);result.final=await snapshot();result.elapsedSeconds=(Date.now()-started)/1000;result.stopReason??=budgetSeconds+'_second_budget';
  await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());
  const samples=result.samples,first=result.initialCombat,last=result.final;
  const cleared=[...new Set(samples.filter(s=>s.roomCleared).map(s=>s.room))];
  const bossRooms=[...new Set(samples.filter(s=>s.enemies.some(e=>e.isBoss)).map(s=>s.room))];
  result.metrics={roomsReached:Math.max(...samples.map(s=>s.room)),roomsObservedCleared:cleared,roomsClearedCount:cleared.length,kills:last.kills,hpStart:first.player.hp,hpEnd:last.player.hp,maxHp:last.player.maxHp,runGold:last.runGold,runGoldPerMinute:last.runGold*60/result.elapsedSeconds,accountGoldDelta:last.account.gold-first.account.gold,accountGoldPerMinute:(last.account.gold-first.account.gold)*60/result.elapsedSeconds,bossRoomsReached:bossRooms,bossDamageObserved:bossRooms.map(room=>({room,maxObservedHpDeficit:Math.max(0,...samples.filter(s=>s.room===room).flatMap(s=>s.enemies.filter(e=>e.isBoss).map(e=>e.maxHp-e.hp)))})),bossDamageNote:bossRooms.length?'Maximum observed boss HP deficit per room; sampled, not exact cumulative damage.':'No boss reached; boss damage not measured.',minObservedHp:Math.min(...samples.map(s=>s.player.hp)),observedHpDrops:samples.reduce((n,s,i)=>n+(i?Math.max(0,samples[i-1].player.hp-s.player.hp):0),0)};
  result.status=result.errors.length?'FAIL':'PASS';result.outcome=cleared.length?'bounded_natural_combat_measured':'room_1_not_cleared_within_probe';
  const persisted=await context.request.get(fixture.origin+'/api/save');result.persistedStatus=persisted.status();if(persisted.ok()){const v=await persisted.json();result.persisted={revision:v.revision,gold:v.data?.gold,checkpoint:v.data?.dungeonCheckpoint};}
} catch(error){result.status=String(error.message).startsWith('BLOCKED')?'BLOCKED':'FAIL';result.error=error.stack;process.exitCode=1;}
finally {
  if(page)try{await keys([]);}catch{}
  await browser?.close();await fixture?.close();clearTimeout(watchdog);
  result.http=result.http?.map(r=>({...r,...(r.error?{error:{code:r.error.code,detail:r.error.detail,error:r.error.error,serverRevision:r.error.serverRevision}}:{})}));
  result.httpFailures=result.http?.filter(r=>r.status>=400);
  result.combatMeasurementStatus=result.metrics?'PASS':'NOT TESTED';
  if(result.httpFailures?.length){result.status='FAIL';result.integrationBlocker='Natural room-5 offer claim/loot checkpoint PUT rejected with HTTP 422 CAMPAIGN_CHECKPOINT_TRANSITION rollback_or_reward_replay; local choice applied once but modal remains paused, cloud dirty/conflict. Repeated clicks are attempts, not repeated skill grants.';process.exitCode=1;}
  if(result.metrics){result.metrics.firstClearSeconds=result.metrics.roomsObservedCleared.map(room=>({room,seconds:result.samples.find(s=>s.room===room&&s.roomCleared).elapsedSeconds}));result.metrics.persistedTelemetry=result.persisted?.checkpoint?.telemetry;result.metrics.persistedRunGold=result.persisted?.checkpoint?.runGold;result.metrics.goldRateNote='Client-observed gold per wall-clock minute, including transitions/modal stall; persisted checkpoint may lag because of integration failure.';}
  result.freeGBAfter=freemem()/1024**3;
  await mkdir(dirname(evidence),{recursive:true});await writeFile(evidence,JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:result.status,outcome:result.outcome,evidence,elapsedSeconds:result.elapsedSeconds,metrics:result.metrics,choices:result.choices,errors:result.errors,error:result.error,httpFailures:result.httpFailures}));
}
