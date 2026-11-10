// Acceptance only: real Chrome, actual DOM entrypoints, real HTTP handlers, disposable memory DB.
// No dotenv, production connection or dependency install. Run from repo root.
// node tools/verify-reward-browser.mjs (optional PLAYWRIGHT_MODULE / CHROME_PATH)
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');
const modulePath = process.env.PLAYWRIGHT_MODULE || 'C:/Users/NGO DUC PHU/AppData/Local/hermes/cache/scratch/artemis-browser-test/node_modules/playwright-core/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);
const { getMongoDb, COLLECTIONS } = await import('../lib/mongo.js');
const { sanitizeSave } = await import('../lib/save/schema.js');
const handlers = {};
for (const [url, file] of Object.entries({ '/api/auth/register':'../api/auth/register.js', '/api/auth/me':'../api/auth/me.js', '/api/save':'../api/save.js', '/api/shop':'../lib/shop/handler.js', '/api/runes':'../api/runes.js' })) handlers[url] = await import(file);
const publicDir = resolve('public');
const evidence = resolve('docs/reward-evidence');
await mkdir(evidence, {recursive:true});
const result = {scope:'Real Chrome + isolated memory DB + real HTTP handlers; not production or Mongo durability', cases:[], errors:[], requests:[], gaps:[]};
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      const handler = handlers[url.pathname]?.[req.method];
      if (!handler) {res.writeHead(404); return res.end('{}');}
      let body=''; for await (const chunk of req) body+=chunk;
      const response=await handler(new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body})}));
      result.requests.push({path:url.pathname,method:req.method,status:response.status});
      res.writeHead(response.status,Object.fromEntries(response.headers)); return res.end(await response.text());
    }
    const file=resolve(publicDir,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir+sep)) throw Error('outside public');
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg'})[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  } catch(e) {res.writeHead(500);res.end(JSON.stringify({error:e.message}));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser,page;
async function run(name, fn) {
  try {const details=await fn(); result.cases.push({name,status:'passed',...details});}
  catch(error) {result.cases.push({name,status:'failed',error:error.stack,lastSettledPresentation:page?await page.evaluate(()=>window.__rewardCalls?.at(-1)).catch(()=>null):null}); if(page) await page.screenshot({path:resolve(evidence,`${name.replace(/[^\w-]/g,'-')}-failure.png`)}).catch(()=>{});}
  if(page) await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close())).catch(()=>{});
  console.log(name+': '+result.cases.at(-1).status);
}
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-extensions','--disable-background-networking']});
  page=await browser.newPage({viewport:{width:1024,height:900},reducedMotion:'reduce'});
  page.setDefaultTimeout(6000);
  page.on('pageerror',e=>result.errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===origin||['https://cdn.tailwindcss.com','https://fonts.googleapis.com','https://fonts.gstatic.com'].includes(u.origin)?route.continue():route.abort();});
  const registration=await page.request.post(origin+'/api/auth/register',{data:{username:'reward_fixture',password:'fixture-password-only'}});
  assert.equal(registration.status(),201);
  const playerId=(await registration.json()).player.id;
  const fresh=(await (await page.request.get(origin+'/api/save')).json()).data;
  const db=await getMongoDb();
  const fixture=sanitizeSave({...fresh,beginnerJourney:{isCompleted:true,skipped:true},gems:1000000,wishTokens:500,artifactStars:{},runeIntroClaimed:true,wikiOtherItems:{...fresh.wikiOtherItems,shovel:100,promised_relic_shovel:100,dice:100,gold_cave_ticket:10}}).data;
  await db.collection(COLLECTIONS.saves).updateOne({playerId},{$set:{data:fixture}});
  assert.equal((await (await page.request.get(origin+'/api/save')).json()).data.gems,1000000);
  await page.goto(origin,{waitUntil:'load'});
  await page.waitForFunction(()=>window.Archero2FusionAPI&&window.ArtemisCloud?.getState().ready);
  await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());
  const snapshot=()=>page.evaluate(()=>{const s=window.Archero2FusionAPI.SaveState;return JSON.parse(JSON.stringify({gems:s.gems,gold:s.gold,wishTokens:s.wishTokens,stars:s.artifactStars,items:s.wikiOtherItems,keys:s.chestKeys,runes:s.runes,events:s.wikiEventsState,scrolls:s.gearScrolls,ruins:s.runeRuinsState}));});
  const popup=page.locator('dialog[open]').filter({has:page.locator('[class*="-card"]')});
  // Instrumentation records the actual settled presentation payload; never fabricates rewards.
  const instrument=async()=>page.evaluate(()=>{
    if (!window.ArtemisRewardResults?.show) return false;
    if (window.__rewardOriginal) return true;
    window.__rewardCalls=[];
    window.__rewardOriginal=window.ArtemisRewardResults.show;
    window.ArtemisRewardResults={show(options){window.__rewardCalls.push({title:options.title,rewards:options.rewards.map(r=>({...r,art:typeof r.art==='string'?r.art:undefined}))});return window.__rewardOriginal.call(this,options);}};return true;
  });
  const ready=await instrument();
  result.moduleAvailable=ready;
  const lastCall=()=>page.evaluate(()=>window.__rewardCalls?.at(-1));
  const callCount=()=>page.evaluate(()=>window.__rewardCalls?.length||0);
  async function closeAndVerify(after, mode='Escape') {
    if (mode==='Escape') await page.keyboard.press('Escape');
    else await page.locator('dialog[open] button').last().click();
    await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
    assert.deepEqual(await snapshot(),after,'dismissal cannot spend, reroll or grant');
  }
  async function revealClick(selector,check,{mobile=false}={}) {
    assert.ok(await instrument(),'window.ArtemisRewardResults.show unavailable');
    const before=await snapshot(), prior=await callCount();
    await page.locator(selector).click();
    await page.waitForFunction(n=>(window.__rewardCalls?.length||0)>n,prior);
    const dialog=page.locator('dialog[open]'); await dialog.waitFor({state:'visible'});
    assert.equal(await callCount(),prior+1,'one reveal per action');
    const after=await snapshot(), call=await lastCall();
    assert.ok(call.rewards.length>0,'nonempty settled rewards');
    assert.ok(call.rewards.every(r=>r.name&&(Number(r.amount)>0||(Number(r.amount)===0&&r.name.includes('không tăng thêm')))),'actual named rewards or explicitly disclosed star-cap outcomes');
    await check(before,after,call);
    // Use semantic dialog and known structural suffixes, independent of component prefix.
    const cards=dialog.locator('[class$="-card"], [class*="-card "]');
    assert.equal(await cards.count(),call.rewards.length,'every settled reward inspectable');
    await dialog.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode();})));
    assert.equal(await dialog.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true,'artwork decodes');
    const imageCount=await dialog.locator('img').count();
    const missingArtwork=selector.includes('wish-pull')&&imageCount===0;
    if(missingArtwork) result.gaps.push(`${selector}: no image artwork supplied (emoji only); geometry and dismissal still exercised.`);
    if(mobile) for(const {width,height} of [{width:1024,height:900},{width:390,height:600},{width:360,height:480}]) {
      await page.setViewportSize({width,height});
      const b=await dialog.boundingBox();
      assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'dialog fits short viewport');
      assert.ok(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth),'no horizontal overflow');
      // Scroll every scrollable ancestor of the final card, then check it is inspectable.
      await cards.last().evaluate(el=>{for(let p=el.parentElement;p&&p.tagName!=='DIALOG';p=p.parentElement)if(p.scrollHeight>p.clientHeight)p.scrollTop=p.scrollHeight;});
      const last=await cards.last().boundingBox();
      assert.ok(last.y>=b.y-1&&last.y+last.height<=b.y+b.height+1,'last reward inside viewport after scroll');
      const done=dialog.locator('button').last(), footer=await done.boundingBox();
      assert.ok(footer.height>=44,'44px mobile close target');
      assert.ok(last.y+last.height<=footer.y+1,'last reward clears footer');
      for(let i=0;i<4;i++){await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(d=>d.contains(document.activeElement)||document.activeElement===document.body),'keyboard focus trapped');}
      await page.screenshot({path:resolve(evidence,`${selector.replace(/[^\w]/g,'')}-${width}x${height}.png`)});
    }
    await closeAndVerify(after);
    await page.setViewportSize({width:1024,height:900});
    if(mobile) result.gaps.push(`${selector}: mobile 390x600 and 360x480, keyboard trap, final-card footer clearance and Escape no-mutation passed.`);
    assert.ok(!missingArtwork,'wish includes loaded artwork, not only emoji (other checks completed)');
    return {rewardCount:call.rewards.length,rewards:call.rewards,imageCount,singleDebit:true,closeNoMutation:true};
  }
  await page.locator('#bottomNavBar [data-tab="tabShopVn"]').click();
  for(const count of [1,10,100]) await run(`wish-${count}`,()=>revealClick(`[data-vn-wish-pull="${count}"]`,(a,b,c)=>{
    assert.equal(b.gems,a.gems-count*400);assert.equal(b.wishTokens,a.wishTokens);assert.equal(c.rewards.length,count);
    const delta=Object.keys(b.stars).reduce((sum,k)=>sum+(b.stars[k]||0)-(a.stars?.[k]||0),0);
    const expected=Object.values(c.rewards.reduce((m,r)=>{m[r.name]=(m[r.name]||0)+Number(r.amount);return m;},{})).reduce((sum,n)=>sum+n,0);
    assert.equal(expected,delta,'displayed awarded stars match actual inventory delta, including capped outcomes');
    assert.ok(delta>0&&delta<=count,'artifact stars increase, respecting existing 15-star cap');
    result.gaps.push(`wish-${count}: observed star delta ${delta}/${count}; 15-star saturation may prevent one star per displayed draw. Reward-to-artifact ID mapping not exposed in presentation contract.`);
  },{mobile:count===100}));
  await run('wish-failure',async()=>{
    await page.evaluate(()=>window.Archero2FusionAPI.SaveState.gems=0);
    const before=await snapshot(),prior=await callCount();
    await page.locator('[data-vn-wish-pull="100"]').click();
    assert.equal(await callCount(),prior);assert.equal(await page.locator('dialog[open]').count(),0);assert.deepEqual(await snapshot(),before);
    return {failureNoPopupOrMutation:true};
  });
  // Event setup changes fixture state only. Navigation and reward settlement use actual controls.
  async function event(id,category='occasional') {
    await page.setViewportSize({width:1024,height:900});
    await page.locator('#bottomNavBar [data-tab="tabEvents"]').click();
    if (!(await page.locator('#wikiEventsHubMainContainer').isVisible())) await page.locator('#btnToggleFullWiki11Events').click();
    const categoryButton=page.locator(`[data-wiki-event-cat="${category}"]`);await categoryButton.click();
    await page.locator(`[data-select-wiki-event="${id}"]`).click();
  }
  await run('island-dice',async()=>{
    await event('island_treasure');
    return revealClick('#btnIslandRollDice',(a,b,c)=>{assert.equal(b.items.dice,a.items.dice-1);assert.equal(b.gems,a.gems+40);assert.equal(b.events.islandRollsCount,a.events.islandRollsCount+1);assert.equal(c.rewards.find(r=>/gem|đá quý|kim cương/i.test(r.name))?.amount,40);},{mobile:true});
  });
  for(const count of [1,10]) await run(`demon-${count}`,async()=>{
    await event('demon_king_clash');
    await page.evaluate(()=>{window.Archero2FusionAPI.SaveState.wikiEventsState.demonSummonTickets=100;});
    return revealClick(`#btnDemonSpin${count}`,(a,b,c)=>{assert.equal(b.events.demonSummonTickets,a.events.demonSummonTickets-count);assert.equal(b.events.demonTotalSpins,a.events.demonTotalSpins+count);assert.ok(c.rewards.length>=count,'each actual spin represented');});
  });
  await run('fishing-reel',async()=>{
    await event('anglers_bounty');
    await page.evaluate(()=>{window.Archero2FusionAPI.SaveState.wikiEventsState.fishingLures=100;});
    const castBefore=await snapshot();await page.locator('#btnFishingCast1').click();
    const cast=await snapshot();assert.equal(cast.events.fishingLures,castBefore.events.fishingLures-1);
    return revealClick('#btnFishingReelIn',(a,b,c)=>{const fish=a.events.fishingHookedFish;assert.equal(b.events.fishingTotalKg,Number((a.events.fishingTotalKg+fish.kg).toFixed(1)));assert.equal(b.events.fishingLures,a.events.fishingLures);assert.ok(c.rewards.some(r=>r.name.includes(fish.name)),'actual caught fish shown');});
  });
  await run('fishing-ten',async()=>{
    await event('anglers_bounty');
    return revealClick('#btnFishingCast10',(a,b)=>{assert.equal(b.events.fishingLures,a.events.fishingLures-10);assert.equal(b.events.fishingSilverTickets,a.events.fishingSilverTickets+1450);assert.equal(b.events.fishingGoldTickets,a.events.fishingGoldTickets+2);});
  });
  for(const tool of ['pickaxe','bomb','drill']) await run(`world-tree-${tool}`,async()=>{
    await event('world_tree_pulse');
    await page.evaluate(()=>{const e=window.Archero2FusionAPI.SaveState.wikiEventsState;e.elfPickaxes=100;e.beerBombs=100;e.gnomeDrills=100;});
    await page.locator(`[data-wt-tool="${tool}"]`).click();
    const index=await page.evaluate(()=>window.Archero2FusionAPI.SaveState.wikiEventsState.worldTreeGrid.findIndex(c=>!c.cleared&&!['boulder','free_chest'].includes(c.type)));
    assert.ok(index>=0);
    return revealClick(`[data-wt-cell="${index}"]`,(a,b,c)=>{const key={pickaxe:'elfPickaxes',bomb:'beerBombs',drill:'gnomeDrills'}[tool];assert.equal(b.events[key],a.events[key]-1);assert.ok(b.events.shamrocks>a.events.shamrocks);assert.ok(b.events.goldPots>a.events.goldPots);assert.equal(c.rewards.find(r=>/shamrock/i.test(r.name))?.amount,b.events.shamrocks-a.events.shamrocks);});
  });
  await run('rune-board-single',async()=>{
    await page.waitForFunction(()=>!window.ArtemisCloud.getState().dirty);
    await event('rune_ruins','regular');
    const serverBefore=(await (await page.request.get(origin+'/api/save')).json()).data;
    const prior=await callCount();await page.locator('[data-wiki-ruins-cell="0"]').click();
    await page.waitForFunction(n=>window.__rewardCalls.length>n,prior);
    const call=await lastCall();assert.equal(call.rewards.length,1);
    const serverAfter=(await (await page.request.get(origin+'/api/save')).json()).data;
    assert.equal(serverAfter.wikiOtherItems.shovel,serverBefore.wikiOtherItems.shovel-1,'server committed one shovel');
    assert.notDeepEqual(serverAfter.runes,serverBefore.runes,'server committed rune drop');
    await page.keyboard.press('Escape');await page.waitForLoadState('load');
    await page.waitForFunction(()=>window.Archero2FusionAPI&&window.ArtemisCloud?.getState().ready);
    const persisted=(await (await page.request.get(origin+'/api/save')).json()).data;
    assert.deepEqual(persisted.runes,serverAfter.runes,'closing and reload do not duplicate rune');
    return {rewardCount:1,serverSingleDebit:true,serverAward:true,closeNoMutation:true};
  });
  await run('gold-cave-roulette',async()=>{
    await event('gold_cave','regular');await page.locator('#btnGoldCaveStart').click();
    await page.locator('#btnGoldCaveNextWave').click();await page.locator('#btnGoldCaveNextWave').click();
    const before=await snapshot();await page.locator('[data-goldcave-choice="0"]').click();const after=await snapshot();
    assert.equal(after.items.gold_cave_ticket,before.items.gold_cave_ticket,'roulette does not debit entry twice');assert.ok(after.events.goldCaveRun.gold>before.events.goldCaveRun.gold);
    return revealClick('#btnGoldCaveCashout',(a,b,c)=>{assert.equal(b.gold,a.gold+a.events.goldCaveRun.gold);assert.equal(b.events.goldCaveRun,null);assert.equal(c.rewards.find(r=>r.name==='Vàng').amount,b.gold-a.gold);});
  });
  result.gaps.push('No production/deployed verification. Event persistence must be distinguished from local client delta; HTTP save results recorded below.','Promised rune pool, rune x5/x10 VIP, artifact-tab wish x10, legacy wiki inventory actions, bingo, plinko and mystery-mine special branches require additional coverage.');
} catch(error) {result.fatal=error.stack; console.error(error);}
finally {
  result.passed=result.cases.filter(c=>c.status==='passed').length;
  result.failed=result.cases.filter(c=>c.status==='failed').length;
  await writeFile(resolve(evidence,'result.json'),JSON.stringify(result,null,2));
  await writeFile(resolve(evidence,'report.md'),`# Reward browser acceptance\n\n${result.scope}\n\nPassed: ${result.passed}; failed: ${result.failed}. Module available: ${result.moduleAvailable??'not reached'}.\n\n${result.cases.map(c=>`- **${c.status}** ${c.name}${c.error?`: ${c.error.split('\n')[0]}`:''}`).join('\n')}\n\n## Gaps\n${result.gaps.map(g=>'- '+g).join('\n')}\n${result.fatal?'\n## Fatal\n```\n'+result.fatal+'\n```':''}\n\nSee result.json for exact payloads, HTTP status evidence and browser errors. Failed-case screenshots do not imply successful acceptance.\n`);
  if(browser) await browser.close();
  await new Promise(r=>server.close(r));
}
console.log(JSON.stringify({passed:result.passed,failed:result.failed,fatal:result.fatal,moduleAvailable:result.moduleAvailable}));
if(result.failed||result.fatal||result.errors.length) process.exitCode=1;
