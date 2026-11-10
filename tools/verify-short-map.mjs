import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {startFixture} from './verify-campaign-http.mjs';
const evidence=resolve(homedir(),'AppData/Local/hermes/cache/scratch/short-map');
const report={scope:'Chrome production setupRoom across campaign rooms, isolated HTTP memory DB; geometry fixtures not natural combat',errors:[]};
let fixture,browser;
try{
 await mkdir(evidence,{recursive:true});fixture=await startFixture();
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||resolve(homedir(),'AppData/Local/hermes/cache/scratch/combat-camera-browser/node_modules/playwright-core/index.mjs')).href);
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-extensions','--disable-background-networking']});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.errors.push(e.message));await context.route('**/*',r=>new URL(r.request().url()).origin===fixture.origin?r.continue():r.abort());
 const r=await context.request.post(fixture.origin+'/api/auth/register',{data:{username:'short_'+randomBytes(5).toString('hex'),password:'isolated-fixture-only'}});assert.equal(r.status(),201);
 await page.goto(fixture.origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.Archero2FusionAPI&&window.ArtemisCloud?.getState().ready);
 await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();await page.locator('#btnStartGame').evaluate(b=>b.click());await page.locator('#btnBriefingStart').click();
 await page.waitForSelector('#skillSelectModal:not(.hidden)');await page.waitForFunction(()=>!window.Archero2FusionAPI.Game.skillClaimBusy);await page.locator('.skill-choice-card').first().click();await page.waitForSelector('#skillSelectModal.hidden',{state:'attached'});
 report.geometry=await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;a.stopGameLoop();return{width:g.width,height:g.height,spawn:{x:g.player.x,y:g.player.y},portal:g.portalRect,speed:g.player.speed,distance:g.player.y-(g.portalRect.y+g.portalRect.h/2)};});
 assert.ok(Math.abs(report.geometry.distance/(1200-95-29)-.6)<1e-9,'travel distance exactly 60%');assert.equal(report.geometry.width,480);
 // Verify Continue geometry in a fresh page, not merely on the warmed-up Game object.
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.Archero2FusionAPI&&window.ArtemisCloud?.getState().ready);await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();await page.locator('#btnContinueRun').evaluate(b=>b.click());
 report.continue=await page.evaluate(()=>{const a=window.Archero2FusionAPI;a.stopGameLoop();return{width:a.Game.width,height:a.Game.height,speed:a.Game.player.speed};});assert.equal(report.continue.height,report.geometry.height);assert.equal(report.continue.speed,report.geometry.speed);
 // Await any restored offer acknowledgment before synthetic room sampling.
 await page.waitForFunction(()=>!window.Archero2FusionAPI.Game.skillClaimBusy);
 report.rooms=await page.evaluate(()=>{
 const a=window.Archero2FusionAPI,g=a.Game;a.stopGameLoop();const rows=[];
 for(let room=1;room<=50;room++){
  g.running=true;g.paused=false;a.setupRoom(room);a.stopGameLoop();
  const obstacles=g.obstacles||[],radius=g.player.r,pad=g.wallPad+radius;
  const free=(x,y)=>x>=pad&&x<=g.width-pad&&y>=pad&&y<=g.height-pad&&!obstacles.some(o=>{const nx=Math.max(o.x,Math.min(x,o.x+o.w)),ny=Math.max(o.y,Math.min(y,o.y+o.h));return(x-nx)**2+(y-ny)**2<radius**2;});
  const step=8,sx=Math.round(g.player.x/step),sy=Math.round(g.player.y/step),queue=[[sx,sy]],seen=new Set([sx+','+sy]);let reachable=false;
  for(let i=0;i<queue.length;i++){const[x,y]=queue[i];if(y*step<=g.portalRect.y+g.portalRect.h+radius+step&&Math.abs(x*step-g.width/2)<g.portalRect.w/2){reachable=true;break;}for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,key=nx+','+ny;if(!seen.has(key)&&free(nx*step,ny*step)){seen.add(key);queue.push([nx,ny]);}}}
  rows.push({room,reachable,spawnFree:free(g.player.x,g.player.y),enemies:g.enemies.length,allEnemiesInBounds:g.enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&e.x>=0&&e.x<=g.width&&e.y>=0&&e.y<=g.height),obstacles:obstacles.length});
 }
 g.paused=true;return rows;
 });
 assert.equal(report.rooms.length,50);assert.deepEqual(report.rooms.filter(r=>!r.reachable||!r.spawnFree||!r.allEnemiesInBounds),[],'every room has clear entrance and reachable portal');
 report.portalTransition=await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;g.running=true;g.paused=false;a.setupRoom(1);a.stopGameLoop();g.enemies=[];g.drops=[];g.roomCleared=true;g.portalOpen=true;g.player.x=g.width/2;g.player.y=g.portalRect.y+g.portalRect.h+20;a.updateGame(.001);return{room:g.room,height:g.height};});assert.equal(report.portalTransition.room,2,'real portal update advances room');
 await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;g.running=true;g.paused=false;a.setupRoom(1);a.stopGameLoop();a.renderGame();});
 report.screenshot=resolve(evidence,'short-map-mobile.png');await page.screenshot({path:report.screenshot});assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;}
finally{await browser?.close();await fixture?.close();await mkdir(evidence,{recursive:true});await writeFile(resolve(evidence,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
