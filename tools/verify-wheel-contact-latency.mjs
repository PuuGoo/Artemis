// Real production HTTP handlers + isolated memory DB; room/position jumps only.
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {startFixture} from './verify-campaign-http.mjs';
export async function verifyWheelContactLatency(){
 const evidence=resolve(homedir(),'AppData/Local/hermes/cache/scratch/wheel-contact-latency-evidence.json');
 const result={status:'RUNNING',scope:'Real Chrome pointer input and production auth/save handlers on loopback with isolated memory DB. Fixture jumps to room 24, clears enemies using production damage hook, discards loot for wheel setup then restores a real drop to probe existing-NPC contact. No synthetic API responses; PUT delay/transport abort only.',checks:[],errors:[]};
 let fixture,browser,releaseEntry;let holdEntry=false,entryHeld=false,entryReleased=false,abortClaim=false,aborted=0;
 const gate=new Promise(r=>releaseEntry=()=>{entryReleased=true;r();});
 try{
  fixture=await startFixture();result.http=fixture.requests;
  const module=process.env.PLAYWRIGHT_MODULE||resolve(homedir(),'AppData/Local/hermes/cache/scratch/combat-camera-browser/node_modules/playwright-core/index.mjs');
  const {chromium}=await import(pathToFileURL(module).href);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-extensions','--disable-background-networking']});
  const context=await browser.newContext({viewport:{width:1024,height:900}}),page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>result.errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin!==fixture.origin)return route.abort();
   if(url.pathname==='/api/save'&&req.method()==='PUT'){
    const cp=req.postDataJSON()?.data?.dungeonCheckpoint;
    if(holdEntry&&cp?.room===24&&cp?.wheel?.status==='ready'){entryHeld=true;await gate;}
    if(abortClaim&&cp?.room===24&&cp?.wheel?.status==='claimed'){aborted++;return route.abort('internetdisconnected');}
   }
   return route.continue();
  });
  const reg=await context.request.post(fixture.origin+'/api/auth/register',{data:{username:'latency_'+randomBytes(5).toString('hex'),password:'fixture-password-only'}});assert.equal(reg.status(),201);
  const read=async()=>{const r=await context.request.get(fixture.origin+'/api/save');assert.equal(r.status(),200);return r.json();};
  const flush=async()=>assert.equal(await page.evaluate(()=>window.ArtemisCloud.flushCheckpoint()),true,'real checkpoint flush');
  await page.goto(fixture.origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ArtemisCloud?.getState().ready&&window.Archero2FusionAPI);
  await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();await page.evaluate(()=>document.querySelector('#btnStartGame').click());await page.locator('#btnBriefingStart').click();
  await page.waitForSelector('#skillSelectModal:not(.hidden)');await page.locator('.skill-choice-card').first().click();
  await page.waitForFunction(()=>!window.Archero2FusionAPI.Game.skillClaimBusy&&!window.Archero2FusionAPI.Game.paused);await flush();
  const setup=await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;a.stopGameLoop();g.running=true;g.paused=false;a.setupRoom(24);for(const e of [...g.enemies])a.damageEnemy(e,e.maxHp*100,true);window.__wheelRealDrops=g.drops.map(d=>({...d}));const generatedDrops=g.drops.length;g.drops=[];a.updateGame(.001);return {room:g.room,npc:g.wheelNpc,drops:generatedDrops,cleared:g.roomCleared,busy:g.skillClaimBusy,pending:g.pendingClaimId};});
  assert.equal(setup.room,24);assert.equal(setup.cleared,true);assert.ok(setup.npc);assert.ok(setup.drops>0);await flush();
  // Existing NPC + genuine floor reward, repositioned far away for deterministic timing.
  const lootProbe=await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game,d={...window.__wheelRealDrops[0]};g.player.x=g.wheelNpc.x;g.player.y=g.wheelNpc.y;d.x=g.player.x+200;d.y=g.player.y;g.drops=[d];a.updateGame(.001);return {popup:!!document.querySelector('.campaign-wheel-overlay'),drops:g.drops.length,busy:g.skillClaimBusy,pending:g.pendingClaimId,paused:g.paused,npc:!!g.wheelNpc,near:window.ArtemisCampaignWheel.isNear(g.player,g.wheelNpc)};});
  result.checks.push({name:'existing NPC contact with nonempty real loot',status:lootProbe.popup?'PASS':'FAIL',...lootProbe});
  // Current regression may block this probe; keep checking the independent network barrier.
  if(lootProbe.popup)await page.locator('.campaign-wheel-overlay').click({position:{x:5,y:100}});
  await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;g.drops=[];g.player.x=100;g.player.y=g.height-100;g.paused=false;a.updateGame(.001);window.__campaignHTTP.saveCheckpoint();});await flush();
  const before=await read();holdEntry=true;
  const contact=await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;g.player.x=g.wheelNpc.x;g.player.y=g.wheelNpc.y;const t=performance.now();a.updateGame(.001);return {elapsedMs:performance.now()-t,popup:!!document.querySelector('.campaign-wheel-overlay'),busy:g.skillClaimBusy,pending:g.pendingClaimId,paused:g.paused};});
  assert.equal(contact.popup,true,'popup synchronous before entry PUT release');await page.waitForSelector('.campaign-wheel-overlay');
  const deadline=Date.now()+10000;while(!entryHeld&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));assert.equal(entryHeld,true,'entry PUT held by transport gate');assert.equal(entryReleased,false);
  result.checks.push({name:'actual room24 contact paints before entry PUT release',status:'PASS',...contact,entryHeld,entryReleased});
  abortClaim=true;await page.locator('.campaign-wheel-start').click();assert.equal(await page.locator('.campaign-wheel-start').isDisabled(),true);
  const unchanged=await read();assert.deepEqual(unchanged.data.dungeonCheckpoint.wheel,before.data.dungeonCheckpoint.wheel,'held entry and spin have not reached server');
  holdEntry=false;releaseEntry();await page.waitForFunction(()=>document.querySelector('.campaign-wheel-start')?.textContent==='Thử lại',{},{timeout:30000});assert.ok(aborted>0);
  const failed=await read();assert.equal(failed.data.dungeonCheckpoint.wheel.status,'ready','failed transport did not claim on server');
  const localAfterFailure=await page.evaluate(()=>({gold:window.Archero2FusionAPI.Game.runGold,receipt:window.Archero2FusionAPI.Game.campaignWheelReceipt}));
  abortClaim=false;await page.locator('.campaign-wheel-start').click();await page.waitForFunction(()=>document.querySelector('.campaign-wheel-start')?.textContent==='Đang Xoay');
  await page.locator('.campaign-wheel-overlay').click({position:{x:5,y:100}});await page.waitForSelector('.campaign-wheel-reward:not([hidden])');await flush();
  const after=await read(),cp=after.data.dungeonCheckpoint;
  const expected=await page.evaluate(()=>{const g=window.Archero2FusionAPI.Game;return window.ArtemisCampaignWheel.outcome({runId:g.runId,chapter:g.chapter.id,room:g.room});});
  assert.equal(cp.wheel.status,'claimed');assert.equal(cp.runGold,before.data.dungeonCheckpoint.runGold+(expected.kind==='gold'?expected.amount:0));
  assert.equal(after.data.gearScrolls.weapon||0,(before.data.gearScrolls.weapon||0)+(expected.kind==='scroll'?expected.amount:0));
  assert.equal(cp.runGold,localAfterFailure.gold,'retry must not add a second gold reward');assert.deepEqual(cp.wheel,localAfterFailure.receipt);
  result.checks.push({name:'real pointer spin, transport failure and retry grant exact reward once',status:'PASS',aborted,expected,before:{gold:before.data.dungeonCheckpoint.runGold,scrolls:before.data.gearScrolls},after:{gold:cp.runGold,scrolls:after.data.gearScrolls,wheel:cp.wheel}});
  await page.locator('.campaign-wheel-overlay').click({position:{x:5,y:100}});
  await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;g.paused=false;a.updateGame(.001);});await flush();
  const final=await read();assert.deepEqual(final.data.dungeonCheckpoint.wheel,cp.wheel);assert.equal(final.data.dungeonCheckpoint.runGold,cp.runGold);assert.deepEqual(final.data.gearScrolls,after.data.gearScrolls);
  assert.equal(await page.locator('.campaign-wheel-overlay').count(),0);assert.deepEqual(result.errors,[]);
  result.status=result.checks.some(c=>c.status==='FAIL')?'FAIL':'PASS';
 }catch(error){result.status='FAIL';result.error=error.stack;}
 finally{releaseEntry();await browser?.close();await fixture?.close();await mkdir(dirname(evidence),{recursive:true});await writeFile(evidence,JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,evidence,checks:result.checks,error:result.error,httpErrors:result.http?.filter(r=>r.status>=400)},null,2));}
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const r=await verifyWheelContactLatency();if(r.status!=='PASS')process.exitCode=1;}
