// Chrome thật với auth/save mock, không tài khoản/database production.
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const publicDir=resolve('public'),errors=[],results=[];let saved=null,revision=0;
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
  res.setHeader('Content-Type','application/json');
  if(url.pathname==='/api/auth/me')return res.end(JSON.stringify({ok:true,authenticated:true,player:{id:'campaign_fixture',username:'campaign_fixture'}}));
  if(url.pathname==='/api/save'&&req.method==='GET')return res.end(JSON.stringify({ok:true,hasSave:!!saved,data:saved,revision}));
  if(url.pathname==='/api/save'&&req.method==='PUT'){let b='';for await(const c of req)b+=c;saved=JSON.parse(b).data;revision++;return res.end(JSON.stringify({ok:true,revision}));}
  return res.end(JSON.stringify({ok:true}));
 }
 try{
  const file=resolve(publicDir,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)));
  if(!file.startsWith(publicDir+sep))throw Error('path');
  let body=await fs.readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(file)]||'application/octet-stream');
  if(extname(file)==='.html')body=body.toString().replace('window.Archero2FusionAPI = {','window.__campaignTest={renderGame,spawnCampaignValkyrie,openCampaignOffer,restoreClearedCampaignRoom};\nwindow.Archero2FusionAPI = {');
  res.end(body);
 }catch{res.statusCode=404;res.end('not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-extensions','--disable-background-networking']});
 const page=await browser.newPage({viewport:{width:1024,height:900}});page.setDefaultTimeout(10000);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.text().startsWith('campaign:'))console.log(m.text());});
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin||/https:\/\/(cdn.tailwindcss.com|fonts.googleapis.com|fonts.gstatic.com)/.test(route.request().url())?route.continue():route.abort());
 console.log('browser: navigate');
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForFunction(()=>window.Archero2FusionAPI&&!document.documentElement.classList.contains('cloud-locked'));
 console.log('browser: booted');
 await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();await page.locator('#btnStartGame').click();await page.locator('#btnBriefingStart').click();
 await page.waitForSelector('#skillSelectModal:not(.hidden)');assert.equal(await page.locator('.skill-choice-card').count(),3);
 await page.locator('.skill-choice-card').first().click();
 await page.waitForSelector('#skillSelectModal.hidden',{state:'attached'});
 results.push(await page.evaluate(()=>{const a=window.Archero2FusionAPI;a.stopGameLoop();return {name:'start-real-ui',room:a.Game.room,max:a.Game.maxRooms,choices:a.Game.runProgression.choicesUsed,paused:a.Game.paused};}));
 assert.equal(results[0].max,50);assert.equal(results[0].choices,1);assert.equal(results[0].paused,false);
 console.log('browser: start UI passed');
 const report=await page.evaluate(()=>{
  const a=window.Archero2FusionAPI,g=a.Game,t=window.__campaignTest;const checks=[];
  a.SaveState.save=()=>true;
  window.ArtemisCloud.flushCheckpoint = null;
  // Giết fixture bằng handler production: bằng chứng luồng clear, không phải cân bằng.
  for(const room of [1,5,10,15,20,25,30,35,40,45,49,50]){
   console.log('campaign: room '+room);
   g.maxRooms=50;g.running=true;g.paused=false;a.setupRoom(room);
   const boss=g.enemies.find(e=>e.isBoss);const expected=room%10===0;
   if(!!boss!==expected)throw Error('boss mốc '+room);
   for(const e of [...g.enemies])a.damageEnemy(e,e.maxHp*100,true);
   if(!g.roomCleared)throw Error('clear '+room);
   if(room%5===0&&room<50){
    if(!g.valkyrieNpc)throw Error('NPC '+room);
    g.drops=[];g.player.x=g.valkyrieNpc.x;g.player.y=g.valkyrieNpc.y;
    a.updateGame(.001);
    if(!g.paused)throw Error('interaction '+room);
    const before=g.runProgression.choicesUsed;
    document.querySelector('.skill-choice-card').click();
    if(g.runProgression.choicesUsed!==before+1||g.paused)throw Error('claim '+room);
   }
   checks.push({room,boss:boss?.type||null,choices:g.runProgression.choicesUsed});
  }
  g.drops=[];g.player.x=g.portalRect.x+g.portalRect.w/2;g.player.y=g.portalRect.y+5;
  a.updateGame(.001);
  if(g.running || !(a.SaveState.winsByChapter[1]>0))throw Error('victory portal did not finish chapter');
  const victory={running:g.running,wins:a.SaveState.winsByChapter[1],nextUnlocked:!a.isChapterLocked(a.CHAPTERS?.[1] || {unlock:{type:'chapterWin',chapterId:1}})};
  document.getElementById('chapterVictoryModal')?.classList.add('hidden');
  g.running=true;g.paused=false;
  const matrix=[];
  for(let chapter=1;chapter<=19;chapter++)for(const room of [10,20,30,40,50]){
   console.log('campaign: boss '+chapter+'/'+room);
   g.chapter={...g.chapter,id:chapter};a.setupRoom(room);const e=g.enemies[0];
   if(!e?.isBoss||!Number.isFinite(e.hp)||e.hp<=0||e.atk<=0)throw Error('boss invalid');
   matrix.push({chapter,room,type:e.type,hp:e.hp,atk:e.atk});
  }
  g.floatTexts=[];g.particles=[];g.roomBannerTimer=0;g.muzzleFlashes=[];g.enemyBullets=[];
  document.getElementById('bossIntroBanner')?.classList.add('hidden');
  document.getElementById('roomClearOverlay')?.classList.add('hidden');
  t.renderGame();
  return {checks,matrix,victory,updateError:g._lastUpdateError||null,renderError:g._lastRenderError||null};
 });
 console.log('browser: state matrix returned');
 assert.equal(report.matrix.length,95);assert.equal(errors.length,0);assert.equal(report.updateError,null);assert.equal(report.renderError,null);
 await fs.mkdir('docs/campaign-50-evidence',{recursive:true});await page.screenshot({path:'docs/campaign-50-evidence/desktop.png'});
 await page.setViewportSize({width:360,height:740});await page.evaluate(()=>window.__campaignTest.renderGame());await page.screenshot({path:'docs/campaign-50-evidence/mobile.png'});
 await fs.writeFile('docs/campaign-50-evidence/browser.json',JSON.stringify({scope:'Chrome mock auth/save; real UI start and handler-driven state jumps, not natural combat, not real save API',results,...report,errors},null,2));
 console.log(JSON.stringify({results,checks:report.checks,bossCases:report.matrix.length,errors}));
}catch(e){console.error(JSON.stringify({error:e.message,errors,results}));process.exitCode=1;}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
