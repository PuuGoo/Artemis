import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/save/schema.js';

// Harness local rõ ràng: không MongoDB, không credentials, không ghi production.
// Chạy: PLAYWRIGHT_MODULE=<absolute .../playwright-core/index.mjs> node tools/audit-new-player-browser.mjs
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(root, 'docs/audit/artemis-new-player/evidence');
await mkdir(evidence, { recursive: true });
let player = 'local_fixture_a';
const saves = new Map();
const calls = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname.startsWith('/api/')) {
    calls.push({method:req.method,path:url.pathname,player});
    if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ok:true,authenticated:true,player:{id:player,username:player}}));
    if (url.pathname === '/api/save' && req.method === 'GET') {
      const s = saves.get(player);
      return res.end(JSON.stringify(s ? {ok:true,hasSave:true,...s} : {ok:true,hasSave:false,data:null,revision:0}));
    }
    if (url.pathname === '/api/save' && req.method === 'PUT') {
      let body = ''; for await (const c of req) body += c;
      const input = JSON.parse(body), old = saves.get(player);
      if (input.revision !== (old?.revision || 0)) { res.statusCode=409; return res.end(JSON.stringify({conflict:true,revision:old?.revision || 0})); }
      const checked = sanitizeSave(input.data);
      if (!checked.ok) { res.statusCode=422; return res.end(JSON.stringify({ok:false,error:checked.reason})); }
      const s = {data:checked.data,revision:(old?.revision || 0)+1}; saves.set(player,s);
      return res.end(JSON.stringify({ok:true,revision:s.revision}));
    }
    res.statusCode=404; return res.end(JSON.stringify({ok:false}));
  }
  try {
    const path = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = resolve(root, 'public', path);
    if (!file.startsWith(resolve(root,'public')+'/') && !file.startsWith(resolve(root,'public')+'\\')) throw Error('outside public');
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.svg':'image/svg+xml'})[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode=404; res.end('not found'); }
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({executablePath:process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context = await browser.newContext({viewport:{width:1280,height:900}});
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url());
  const assetOrigins = ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
  return (url.origin === origin || (request.method() === 'GET' && assetOrigins.includes(url.origin))) ? route.continue() : route.abort();
});
const page = await context.newPage();
const errors = [];
page.on('pageerror',e=>errors.push(e.message));
const results=[];
async function record(name, fn) {
 try { const details = await fn(); results.push({name,status:'PASS',details}); }
 catch(e) { results.push({name,status:'FAIL',error:e.message}); }
}
async function ready() {
 await page.goto(origin,{waitUntil:'load'});
 await page.waitForFunction(()=>window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'), {timeout:20000}).catch(async error=>{ console.log(JSON.stringify({errors,calls,diagnostic:await page.evaluate(()=>({url:location.href,text:document.body?.innerText?.slice(-1500),api:!!window.Archero2FusionAPI,cloud:window.ArtemisCloud?.getState()}))},null,2));throw error; });
}
try {
 await ready();
 await record('INIT: trạng thái fresh fixture (mock auth/save, không phải đăng ký thật)',async()=>{
  const s = await page.evaluate(()=>{const a=window.Archero2FusionAPI,s=a.SaveState;return {level:s.playerLevel,gold:s.gold,gems:s.gems,energy:s.stamina,hero:s.selectedHeroId,stars:s.heroStars,bag:s.gearBag,equipped:s.equippedGear,talents:s.talents,stats:((v)=>({baseAtk:v.baseAtk,baseHp:v.baseHp,baseAspd:v.baseAspd,baseCrit:v.baseCrit,powerScore:v.powerScore,defFlat:v.defFlat,dmgReduction:v.dmgReduction}))(a.getComputedStats())};});
  assert.equal(s.level,1); assert.equal(s.gold,500); assert.equal(s.gems,50); assert.equal(s.energy,20); assert.equal(s.bag.length,0); assert.ok(Object.values(s.equipped).every(x=>x===null));
  return s;
 });
 await record('Hero UI không chọn tướng chưa sở hữu qua stage/character/arrows',async()=>{
  const report=await page.evaluate(()=>{
   const a=window.Archero2FusionAPI,s=a.SaveState,original=s.selectedHeroId;
   const checks=[];
   try {
    for(const selector of ['.stage-quick-hero-btn[data-stage-hero="thor"]','.char-subtab-hero-btn[data-char-hero="thor"]','#btnStagePrevHero','#btnStageNextHero']) {
     a.renderLobbyUI();const el=document.querySelector(selector);
     if(!el) throw new Error('Missing required ownership UI: '+selector);
     el.click();checks.push({selector,selected:s.selectedHeroId,expected:original});
    }
   } finally {s.selectedHeroId=original;s.save();a.renderLobbyUI();}
   return checks;
  });
  for(const check of report)assert.equal(check.selected,check.expected,check.selector);
  return report;
 });
 await record('N01 activation + initial mission render', async()=>{
   const result=await page.evaluate(()=>{const a=window.Archero2FusionAPI; a.activateBeginnerJourney();a.renderBeginnerJourneyUI();return JSON.parse(JSON.stringify(a.SaveState.beginnerJourney));});
   assert.ok(result.startedAt>0); return result;
 });
 await page.screenshot({path:resolve(evidence,'local-fixture-lobby.png')});
 await record('N03 tiến độ sau cloud save/reload mock server',async()=>{
   const before=await page.evaluate(()=>{const a=window.Archero2FusionAPI; a.BeginnerHooks.onLoot(7);a.SaveState.save();return JSON.parse(JSON.stringify(a.SaveState.beginnerJourney));});
   await page.waitForTimeout(2200);
   await ready();
   const after=await page.evaluate(()=>JSON.parse(JSON.stringify(window.Archero2FusionAPI.SaveState.beginnerJourney)));
   assert.equal(after._lootCount,before._lootCount); assert.equal(after._lootCount,7);return {before,after};
 });
 await record('A/B fixture cách ly sau reload cùng browser',async()=>{
   const goldA=await page.evaluate(()=>window.Archero2FusionAPI.SaveState.gold);
   player='local_fixture_b'; await ready();
   const b=await page.evaluate(()=>{const s=window.Archero2FusionAPI.SaveState;return {gold:s.gold,journey:s.beginnerJourney,bag:s.gearBag};});
   assert.equal(b.gold,500);assert.equal(b.journey.startedAt,0);assert.equal(b.bag.length,0);
   player='local_fixture_a';await ready();const a=await page.evaluate(()=>({gold:window.Archero2FusionAPI.SaveState.gold,loot:window.Archero2FusionAPI.SaveState.beginnerJourney._lootCount}));
   assert.equal(a.gold,goldA);assert.equal(a.loot,7);return {a,b};
 });
 const stepHooks = {N01:'onDialogueDone',N02:'onRoomCleared',N03:'onLoot',N04:'onGearEquipped',N05:'onGearUpgraded',N06:'onSkillPicked',N07:'onChapterCleared',N08:'onFinalStepDone'};
 for (const [id, hook] of Object.entries(stepHooks)) {
  await record(`${id}: hook/reward/duplicate/reload — không giả là chơi hết chương`, async()=>{
   const outcome=await page.evaluate(({id,hook})=>{
    const a=window.Archero2FusionAPI, s=a.SaveState, step=a.BEGINNER_STEPS.find(x=>x.id===id);
    const before={gold:s.gold,gems:s.gems};
    const early=a.claimBeginnerReward(id);
    a.BeginnerHooks[hook](id==='N03'?3:id==='N07'?1:undefined);
    const claimed=a.claimBeginnerReward(id);
    const after={gold:s.gold,gems:s.gems};
    const duplicate=a.claimBeginnerReward(id);
    const itemCount=()=>s.gearBag.length+Object.values(s.equippedGear).filter(Boolean).length;
    const count=itemCount();
    a.BeginnerHooks[hook](id==='N03'?3:id==='N07'?1:undefined);
    a.SaveState.save();
    return {early,claimed,duplicate,before,after,reward:step.reward,count,afterDuplicateCount:itemCount(),journey:JSON.parse(JSON.stringify(s.beginnerJourney))};
   },{id,hook});
   assert.equal(outcome.early,false);assert.equal(outcome.claimed,true);assert.equal(outcome.duplicate,false);
   assert.equal(outcome.after.gold-outcome.before.gold,outcome.reward.gold||0);assert.equal(outcome.after.gems-outcome.before.gems,outcome.reward.gems||0);
   assert.equal(outcome.afterDuplicateCount,outcome.count);
   await page.waitForTimeout(1800);await ready();
   const restored=await page.evaluate(()=>JSON.parse(JSON.stringify(window.Archero2FusionAPI.SaveState.beginnerJourney)));
   assert.ok(restored.completedSteps.includes(id));assert.ok(restored.claimedRewards.includes(id));
   return {outcome,restored};
  });
 }
 await record('Trận đầu chạy loop và nhân vật finite',async()=>{
   await page.evaluate(()=>window.Archero2FusionAPI.startNewRun());
   await page.waitForTimeout(1200);
   const firstTime = await page.evaluate(()=>window.Archero2FusionAPI.Game.lastTime);
   await page.waitForTimeout(300);
   const state=await page.evaluate(()=>{const g=window.Archero2FusionAPI.Game,c=document.getElementById('battleCanvas'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let colored=0;for(let i=0;i<pixels.length;i+=400){if(pixels[i]||pixels[i+1]||pixels[i+2])colored++;}return {running:g.running,paused:g.paused,room:g.room,enemyCount:g.enemies.length,player:{x:g.player.x,y:g.player.y,hp:g.player.hp,maxHp:g.player.maxHp,atk:g.player.atk},lastTime:g.lastTime,coloredSamples:colored};});
   assert.equal(state.running,true);assert.equal(state.paused,false);assert.ok(state.lastTime>firstTime);assert.ok(state.coloredSamples>0);assert.ok(state.enemyCount>0);assert.ok(Number.isFinite(state.player.x)&&Number.isFinite(state.player.hp));return state;
 });
 await page.screenshot({path:resolve(evidence,'local-fixture-first-battle.png')});
 await record('Hostname công khai giả lập: dev query/storage không cấp tài nguyên', async()=>{
  const publicContext=await browser.newContext();
  await publicContext.addInitScript(()=>localStorage.setItem('artemis_dev','1'));
  await publicContext.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin==='https://audit.invalid') {
    const response=await fetch(origin+url.pathname+url.search);
    return route.fulfill({status:response.status,headers:{'content-type':response.headers.get('content-type')||'text/plain'},body:Buffer.from(await response.arrayBuffer())});
   }
   if(route.request().method()==='GET' && ['https://cdn.tailwindcss.com','https://fonts.googleapis.com','https://fonts.gstatic.com'].includes(url.origin)) return route.continue();
   return route.abort();
  });
  try {
   const publicPage=await publicContext.newPage();
   publicPage.on('pageerror',e=>errors.push('public-host fixture: '+e.message));
   await publicPage.goto('https://audit.invalid/?dev=1');
   await publicPage.waitForFunction(()=>window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
   const result=await publicPage.evaluate(()=>{const a=window.Archero2FusionAPI,s=a.SaveState,before=JSON.stringify({gold:s.gold,gems:s.gems,gear:s.gearBag,eq:s.equippedGear});a.SaveState.applyMaxAllSystems(true);for(const id of ['btnTopAddGold','btnTopAddGem','btnRefillStamina'])document.getElementById(id)?.click();return {enabled:a.devCheatsEnabled(),unchanged:before===JSON.stringify({gold:s.gold,gems:s.gems,gear:s.gearBag,eq:s.equippedGear})};});
   assert.equal(result.enabled,false);assert.equal(result.unchanged,true);return result;
  } finally {await publicContext.close();}
 });
 const output={time:new Date().toISOString(),browser:browser.version(),scope:'LOCAL MOCK AUTH/SAVE ONLY. Không đăng ký account thật, không kiểm chứng Mongo persistence hoặc auth server.',results,errors,calls,savedPlayers:[...saves.keys()]};
 await writeFile(resolve(evidence,'local-browser.json'),JSON.stringify(output,null,2));
 console.log(JSON.stringify(output,null,2));
 if(results.some(x=>x.status==='FAIL') || errors.length) process.exitCode=1;
} finally { await browser.close();await new Promise(r=>server.close(r)); }
