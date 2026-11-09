// HTTP/auth/save thật, DB bộ nhớ cô lập; chỉ chèn test handle vào HTML phục vụ.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {freemem,homedir} from 'node:os';
import assert from 'node:assert/strict';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function startFixture() {
  process.env.NODE_ENV='test'; process.env.DB_BACKEND='memory';
  process.env.JWT_SECRET=randomBytes(32).toString('hex');
  assert.equal(process.env.NODE_ENV,'test'); assert.equal(process.env.DB_BACKEND,'memory');
  const handlers={'/api/auth/register':await import('../api/auth/register.js'),'/api/auth/me':await import('../api/auth/me.js'),'/api/save':await import('../api/save.js')};
  const requests=[],root=resolve(repo,'public');
  const server=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname.startsWith('/api/')) {
        const handler=handlers[url.pathname]?.[req.method];
        if(!handler){res.writeHead(404);return res.end('{}');}
        let body='';for await(const c of req)body+=c;
        const response=await handler(new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body})}));
        const text=await response.text();
        requests.push({method:req.method,path:url.pathname,status:response.status,...(response.status>=400?{error:JSON.parse(text)}:{})});
        res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(text);
      }
      const file=resolve(root,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)));
      if(!file.startsWith(root+sep))throw Error('outside public');
      let body=await readFile(file);
      if(extname(file)==='.html') {
        const html=body.toString(),anchor='window.Archero2FusionAPI = {';
        assert.ok(html.includes(anchor),'test handle injection anchor missing');
        body=html.replace(anchor,'window.__campaignHTTP={saveCheckpoint,continueRun,ROGUE_SKILLS};\n'+anchor)
          .replace('</head>','<style>.hidden{display:none!important}</style></head>');
      }
      res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg'})[extname(file)]||'application/octet-stream');
      res.end(body);
    } catch(error){res.writeHead(500);res.end(JSON.stringify({error:error.message}));}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {origin:`http://127.0.0.1:${server.address().port}`,requests,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
export async function verifyCampaignHTTP() {
  const evidence=resolve(homedir(),'AppData/Local/hermes/cache/scratch/campaign-http-evidence.json');
  const result={status:'RUNNING',scope:'Real Chrome + loopback HTTP production auth/save handlers + test-only memory DB; fixture room jump and damage hooks, not natural combat, Mongo durability or production',checks:[],errors:[]};
  let fixture,browser;
  try {
    const freeGB=freemem()/1024**3;result.freeGB=freeGB;
    assert.ok(freeGB>=3,`BLOCKED: free RAM ${freeGB.toFixed(2)} GB below 3 GB`);
    if(process.platform==='win32') {
      const running=execFileSync('powershell.exe',['-NoProfile','-Command',"@(Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'headless|remote-debugging' }).Count"],{encoding:'utf8'}).trim();
      assert.equal(running,'0','BLOCKED: another automation browser exists');
    }
    fixture=await startFixture();result.http=fixture.requests;
    const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/PuuGoo/AppData/Local/hermes/cache/scratch/artemis-browser/node_modules/playwright-core/index.mjs').href);
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-extensions','--disable-background-networking']});
    const context=await browser.newContext({viewport:{width:1024,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);
    page.on('pageerror',e=>result.errors.push(e.message));
    let dropClaim=false,droppedClaims=0;
    await page.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==fixture.origin)return route.abort();
      if(dropClaim&&url.pathname==='/api/save'&&request.method()==='PUT'&&request.postDataJSON()?.data?.dungeonCheckpoint?.runProgression?.choicesUsed===2){droppedClaims++;return route.abort('internetdisconnected');}
      return route.continue();
    });
    const registration=await context.request.post(fixture.origin+'/api/auth/register',{data:{username:'campaign_'+randomBytes(5).toString('hex'),password:'fixture-password-only'}});
    assert.equal(registration.status(),201);
    assert.ok((await context.cookies()).some(c=>c.httpOnly),'real HTTP-only session cookie');
    const read=async()=>{const response=await context.request.get(fixture.origin+'/api/save');assert.equal(response.status(),200);return response.json();};
    const boot=async()=>{await page.goto(fixture.origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.Archero2FusionAPI&&window.ArtemisCloud?.getState().ready);await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());};
    const flush=async()=>{const ok=await page.evaluate(()=>window.ArtemisCloud.flushCheckpoint());if(!ok)throw Error('Checkpoint flush failed: '+JSON.stringify(fixture.requests.filter(r=>r.status>=400)));await page.waitForFunction(()=>{const s=window.ArtemisCloud.getState();return !s.dirty&&!s.saving&&!s.lastError;});};
    const state=()=>page.evaluate(()=>{const g=window.Archero2FusionAPI.Game;return {room:g.room,enemies:g.enemies.length,drops:g.drops.length,npc:g.valkyrieNpc,cleared:g.roomCleared,skills:g.player.skills,maxHp:g.player.maxHp,level:g.player.level,runGold:g.runGold,kills:g.kills,progression:g.runProgression,busy:g.skillClaimBusy};});
    await boot();
    await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();await page.locator('#btnStartGame').click();await page.locator('#btnBriefingStart').click();
    await page.waitForSelector('#skillSelectModal:not(.hidden)');await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());
    await flush();
    const entry=await read();assert.equal(entry.data.dungeonCheckpoint.boundary,'entry');assert.equal(entry.data.dungeonCheckpoint.runProgression.pendingOffer.stageId,'start');
    result.checks.push({name:'entry offer saved by real PUT then GET',status:'PASS',checkpoint:entry.data.dungeonCheckpoint});
    const first=await page.locator('.skill-choice-card').first().getAttribute('data-skill-id');
    await page.locator('.skill-choice-card').first().click();await page.waitForFunction(()=>window.Archero2FusionAPI.Game.runProgression.choicesUsed===1&&!window.Archero2FusionAPI.Game.skillClaimBusy);await flush();
    const chosen=await read();assert.equal(chosen.data.dungeonCheckpoint.player.skills[first],1);assert.deepEqual(chosen.data.dungeonCheckpoint.runProgression.claimedStages,['start']);
    result.checks.push({name:'entry first choice persisted',status:'PASS',skill:first});
    await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;a.stopGameLoop();g.running=true;g.paused=false;a.setupRoom(5);for(const e of [...g.enemies])a.damageEnemy(e,e.maxHp*100,true);g.drops=[];window.__campaignHTTP.saveCheckpoint();});
    const clear=await state();assert.equal(clear.cleared,true);assert.equal(clear.enemies,0);assert.equal(clear.progression.pendingOffer.stageId,5);await flush();
    const roomSaved=await read();assert.equal(roomSaved.data.dungeonCheckpoint.rewardSettled,true);
    await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;if(!g.valkyrieNpc)throw Error('room 5 NPC missing');g.player.x=g.valkyrieNpc.x;g.player.y=g.valkyrieNpc.y;a.updateGame(.001);});
    await page.waitForSelector('#skillSelectModal:not(.hidden)');await flush();
    result.checks.push({name:'room 5 NPC proximity opens production interaction modal',status:'PASS'});
    result.checks.push({name:'room 5 production clear hooks, loot explicitly discarded fixture',status:'PASS',state:clear});
    await boot();await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();await page.locator('#btnContinueRun').click();await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());
    const continued=await state();assert.equal(continued.enemies,0);assert.equal(continued.drops,0);assert.equal(continued.cleared,true);assert.deepEqual(continued.skills,clear.skills);assert.deepEqual(continued.progression.pendingOffer,clear.progression.pendingOffer);assert.equal(continued.maxHp,clear.maxHp);assert.ok(continued.level<=10);
    result.checks.push({name:'reload Continue preserves offer skills maxHP and caps without respawn',status:'PASS',state:continued});
    // Continue có thể mở lại offer; nếu chưa mở thì tương tác NPC qua update thật.
    if(!await page.locator('#skillSelectModal').isVisible())await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;if(!g.valkyrieNpc)throw Error('room 5 NPC missing');g.player.x=g.valkyrieNpc.x;g.player.y=g.valkyrieNpc.y;a.updateGame(.001);});
    await page.waitForSelector('#skillSelectModal:not(.hidden)');
    await page.locator('#btnRerollSkills').click();await flush();const rerolled=await state();assert.equal(rerolled.progression.pendingOffer.rerollsUsed,1);
    await page.locator('#btnRerollSkills').click();assert.deepEqual((await state()).progression.pendingOffer,rerolled.progression.pendingOffer);
    result.checks.push({name:'one reroll; second attempt cannot reroll again',status:'PASS',offer:rerolled.progression.pendingOffer});
    await context.setOffline(true);await page.evaluate(()=>window.__campaignHTTP.saveCheckpoint());await page.locator('.skill-choice-card').first().click();await page.waitForFunction(()=>!window.Archero2FusionAPI.Game.skillClaimBusy);assert.equal((await state()).progression.choicesUsed,1);await context.setOffline(false);
    // Mất mạng sau khi áp dụng cục bộ: không tạo phản hồi API giả.
    dropClaim=true;await page.locator('.skill-choice-card').first().click();await page.waitForFunction(()=>!window.Archero2FusionAPI.Game.skillClaimBusy);const pending=await state();assert.equal(pending.progression.choicesUsed,2);assert.ok(droppedClaims>0);assert.equal((await read()).data.dungeonCheckpoint.runProgression.choicesUsed,1);
    dropClaim=false;await page.locator('.skill-choice-card').first().click();await page.waitForFunction(()=>!window.Archero2FusionAPI.Game.skillClaimBusy);await flush();const retried=await state(),persisted=await read();assert.deepEqual(retried.skills,pending.skills);assert.equal(retried.progression.choicesUsed,2);assert.deepEqual(persisted.data.dungeonCheckpoint.runProgression,retried.progression);assert.deepEqual(persisted.data.dungeonCheckpoint.player.skills,retried.skills);
    result.checks.push({name:'offline before claim and failed post-apply PUT retry grant once',status:'PASS',droppedClaims,state:retried});
    await boot();await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();await page.locator('#btnContinueRun').click();await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());const final=await state();assert.equal(final.enemies,0);assert.equal(final.drops,0);assert.deepEqual(final.skills,retried.skills);assert.equal(final.maxHp,retried.maxHp);assert.deepEqual(final.progression.claimedStages,['start',5]);await flush();assert.deepEqual((await read()).data.dungeonCheckpoint.runProgression,final.progression);
    assert.equal(final.npc,null);assert.equal(final.runGold,retried.runGold);assert.equal(final.kills,retried.kills);
    assert.ok(final.level<=10);assert.ok(Object.values(final.skills).reduce((n,v)=>n+v,0)<=10);
    const skillCaps=await page.evaluate(()=>Object.fromEntries(window.__campaignHTTP.ROGUE_SKILLS.map(s=>[s.id,window.ArtemisCampaignSkills.skillCap(s)])));
    for(const [id,stacks] of Object.entries(final.skills))assert.ok(stacks<=skillCaps[id],`skill cap ${id}`);
    result.checks.push({name:'claimed reload has no duplicate skills enemies loot or NPC',status:'PASS',state:final});assert.deepEqual(result.errors,[]);result.status='PASS';
  } catch(error){result.status='FAIL';result.error=error.stack;process.exitCode=1;}
  finally {await browser?.close();await fixture?.close();await mkdir(dirname(evidence),{recursive:true});await writeFile(evidence,JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,evidence,checks:result.checks.map(c=>c.name),error:result.error,httpFailures:result.http?.filter(r=>r.status>=400)}));}
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await verifyCampaignHTTP();
