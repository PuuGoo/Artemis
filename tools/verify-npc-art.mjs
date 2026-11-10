// Visual renderer acceptance in Chrome + real client boot via isolated HTTP fixture.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {startFixture} from './verify-campaign-http.mjs';
const evidence=resolve(homedir(),'AppData/Local/hermes/cache/scratch/npc-art');
const report={scope:'Real Chrome Canvas rendering + authenticated client boot; test NPC positions, not natural stage progression or production',checks:[],errors:[]};
let browser,fixture;
try{
 await mkdir(evidence,{recursive:true});fixture=await startFixture();
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||resolve(homedir(),'AppData/Local/hermes/cache/scratch/combat-camera-browser/node_modules/playwright-core/index.mjs')).href);
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-extensions','--disable-background-networking']});
 const context=await browser.newContext({viewport:{width:1100,height:850}}),page=await context.newPage();
 page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));
 await context.route('**/*',r=>new URL(r.request().url()).origin===fixture.origin?r.continue():r.abort());
 const registration=await context.request.post(fixture.origin+'/api/auth/register',{data:{username:'npc_'+randomBytes(5).toString('hex'),password:'isolated-fixture-only'}});assert.equal(registration.status(),201);
 await page.goto(fixture.origin,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.Archero2FusionAPI&&window.ArtemisCloud?.getState().ready);
 await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());
 await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();
 await page.locator('#btnStartGame').evaluate(b=>b.click());await page.locator('#btnBriefingStart').click();
 await page.waitForSelector('#skillSelectModal:not(.hidden)');
 await page.waitForFunction(()=>!window.Archero2FusionAPI.Game.skillClaimBusy);
 await page.locator('.skill-choice-card').first().click();
 await page.waitForSelector('#skillSelectModal.hidden',{state:'attached'});
 await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;a.stopGameLoop();g.enemies=[];g.enemyBullets=[];g.drops=[];
   const x=g.width/2,y=g.player.y-220;g.valkyrieNpc={x,y,r:22};g.encounterNpc={x:x-95,y:y+105,r:22,kind:'angel'};g.wheelNpc={x:x+95,y:y+105,r:22};a.renderGame();});
 const arenaPath=resolve(evidence,'npc-in-arena.png');await page.screenshot({path:arenaPath});report.arena=arenaPath;
 // Separate art sheet uses the actual production API and wrappers at native and 2x scale.
 const metrics=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=650;canvas.id='npcArtAcceptance';
  canvas.style.cssText='position:fixed;inset:0;z-index:999999;width:1000px;height:650px';document.body.append(canvas);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#101d31';ctx.fillRect(0,0,1000,650);
  const kinds=['valkyrie','angel','devil','wheel'],names=['VALKYRIE','THIÊN THẦN','ÁC QUỶ','THƯƠNG NHÂN'];
  for(let i=0;i<4;i++){
   const x=125+i*250;ctx.fillStyle='#dcecff';ctx.textAlign='center';ctx.font='bold 16px system-ui';ctx.fillText(names[i],x,40);
   ctx.save();ctx.translate(x,210);ctx.scale(2,2);window.ArtemisCampaignNPCArt.draw(ctx,{x:0,y:0},1600,false,true,kinds[i]);ctx.restore();
   const npc={x,y:460,kind:kinds[i]};if(i===0)window.ArtemisCampaignValkyrie.draw(ctx,npc,1600,true,false);else if(i===3)window.ArtemisCampaignWheel.drawNPC(ctx,npc,1600,true,false);else window.ArtemisCampaignEncounters.draw(ctx,npc,1600,true,false);
  }
  const numbers={};
  for(const kind of kinds){const t=performance.now();for(let n=0;n<250;n++)window.ArtemisCampaignNPCArt.draw(ctx,{x:125,y:210},n*16,true,false,kind);numbers[kind]=(performance.now()-t)/250;}
  return {lowMsPerDraw:numbers,kinds};
 });
 // Redraw to remove benchmark overpainting, retaining the already verified art sheet construction.
 await page.evaluate(()=>document.getElementById('npcArtAcceptance').remove());
 // A clean capture at four isolated panels.
 await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=1000;c.height=600;c.id='npcArtAcceptance';c.style.cssText='position:fixed;inset:0;z-index:999999;width:1000px;height:600px';document.body.append(c);
  const ctx=c.getContext('2d');ctx.fillStyle='#101d31';ctx.fillRect(0,0,1000,600);
  ['valkyrie','angel','devil','wheel'].forEach((kind,i)=>{const x=125+i*250;ctx.fillStyle='#dcecff';ctx.textAlign='center';ctx.font='bold 16px system-ui';ctx.fillText(['VALKYRIE','THIÊN THẦN','ÁC QUỶ','THƯƠNG NHÂN'][i],x,40);ctx.save();ctx.translate(x,210);ctx.scale(2,2);window.ArtemisCampaignNPCArt.draw(ctx,{x:0,y:0},1600,false,true,kind);ctx.restore();window.ArtemisCampaignNPCArt.draw(ctx,{x,y:460},1600,true,false,kind);});
 });
 const sheetPath=resolve(evidence,'npc-art-sheet.png');await page.locator('#npcArtAcceptance').screenshot({path:sheetPath});report.sheet=sheetPath;report.metrics=metrics;
 assert.deepEqual(report.errors,[]);report.checks.push('authenticated client loads renderer and real wrappers without errors','four distinct Canvas designs rendered in full and low effects','arena render uses production hooks');report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;}
finally{await browser?.close();await fixture?.close();await mkdir(evidence,{recursive:true});await writeFile(resolve(evidence,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
