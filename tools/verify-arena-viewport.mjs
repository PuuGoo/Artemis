// Chỉ chạy thủ công sau tích hợp: một Chrome, HTTP thật + DB bộ nhớ, tối đa 60 giây.
// Hợp đồng DOM: battleCanvas, arenaPlayfield, arenaHudHeader, arenaHudFooter, btnArenaSize.
// Hợp đồng runtime: Archero2FusionAPI.Game/stopGameLoop và ArtemisArenaViewport.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {freemem, homedir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {startFixture} from './verify-campaign-http.mjs';

export async function verifyArenaViewport() {
  const evidenceDir = resolve(process.env.TMPDIR || resolve(homedir(), 'AppData/Local/hermes/cache/scratch'), `arena-viewport-${Date.now()}`);
  const report = {status:'RUNNING', scope:'Chrome + loopback production auth/save handlers + isolated memory DB; UI launch and initial skill choice; stopped simulation for geometry/input checks. No production or natural combat claim.', checks:[], errors:[], blockedExternal:[]};
  let browser, fixture, page, timer;
  const check = (name, details = {}) => report.checks.push({name,status:'PASS',...details});
  const near = (a,b,label,tolerance=1) => assert.ok(Number.isFinite(a) && Math.abs(a-b)<=tolerance, `${label}: ${a} != ${b}`);
  const screenshot = async name => {const path=resolve(evidenceDir,`${name}.png`);await page.screenshot({path,timeout:4000});return path;};
  try {
    await mkdir(evidenceDir,{recursive:true});
    report.freeGB=freemem()/1024**3;
    assert.ok(report.freeGB>=3,`BLOCKED: free RAM ${report.freeGB.toFixed(2)} GB < 3 GB`);
    if(process.platform==='win32') {
      const count=execFileSync('powershell.exe',['-NoProfile','-Command',"@(Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'headless|remote-debugging' }).Count"],{encoding:'utf8',timeout:5000}).trim();
      assert.equal(count,'0','BLOCKED: another automation Chrome is running');
    }
    const timedOut = new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('60-second harness budget exhausted')),55000);});
    await Promise.race([timedOut,(async()=>{
      fixture=await startFixture();report.http=fixture.requests;
      const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || resolve(homedir(),'AppData/Local/hermes/cache/scratch/artemis-browser/node_modules/playwright-core/index.mjs')).href);
      browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,timeout:10000,args:['--disable-extensions','--disable-background-networking']});
      const flush = async()=>{
        assert.equal(await page.evaluate(()=>window.ArtemisCloud.flushCheckpoint()),true,'cloud checkpoint acknowledgment');
        await page.waitForFunction(()=>{const s=window.ArtemisCloud.getState();return !s.dirty&&!s.saving&&!s.lastError;});
      };
      const saved = async context=>{const r=await context.request.get(fixture.origin+'/api/save');assert.equal(r.status(),200);return r.json();};
      const launch = async(viewport,mobile=false)=>{
        const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
        context.setDefaultTimeout(6000);context.setDefaultNavigationTimeout(10000);
        await context.route('**/*',route=>{
          const url=new URL(route.request().url());
          if(url.origin!==fixture.origin){report.blockedExternal.push(url.origin);return route.abort();}
          return route.continue();
        });
        page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
        const registration=await context.request.post(fixture.origin+'/api/auth/register',{data:{username:'view_'+randomBytes(5).toString('hex'),password:'fixture-password-only'},timeout:6000});
        assert.equal(registration.status(),201,'fresh isolated account');
        assert.ok((await context.cookies()).some(c=>c.httpOnly),'production HttpOnly auth');
        await page.goto(fixture.origin,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.Archero2FusionAPI&&window.ArtemisCloud?.getState().ready);
        await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());
        await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();
        await page.locator('#btnStartGame').click();await page.locator('#btnBriefingStart').click();
        await page.waitForSelector('#skillSelectModal:not(.hidden)');
        await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());await flush();
        const entry=await saved(context);assert.equal(entry.data.dungeonCheckpoint.boundary,'entry');
        const skill=await page.locator('.skill-choice-card').first().getAttribute('data-skill-id');
        await page.locator('.skill-choice-card').first().click();
        await page.waitForFunction(()=>window.Archero2FusionAPI.Game.runProgression.choicesUsed===1&&!window.Archero2FusionAPI.Game.skillClaimBusy);
        await page.evaluate(()=>window.Archero2FusionAPI.stopGameLoop());await flush();
        const ack=await saved(context);assert.equal(ack.data.dungeonCheckpoint.player.skills[skill],1);
        assert.deepEqual(ack.data.dungeonCheckpoint.runProgression.claimedStages,['start']);
        await page.waitForSelector('#skillSelectModal',{state:'hidden'});
        check(`${mobile?'mobile':'desktop'} real UI launch and first choice HTTP acknowledgment`,{skill});
        return context;
      };
      const settle = async()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const snapshot = async()=>page.evaluate(()=>{
        const g=window.Archero2FusionAPI.Game;
        if(!window.ArtemisArenaViewport)throw Error('Missing ArtemisArenaViewport global: integrate module first');
        const must=id=>{const el=document.getElementById(id);if(!el)throw Error('Missing agreed DOM id: '+id);return el;};
        const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
        const canvas=must('battleCanvas'),header=must('arenaHudHeader'),footer=must('arenaHudFooter'),field=must('arenaPlayfield');
        const ids=['hudStageName','hudRoomText','hudEnemyLeftText','hudNextUp','hudRoomPips','hudLevelBadge','hudLevelText','hudXpRatioText','hudXpBar','btnPauseGame','btnHudGfx','bossHudContainer','bossNameText','bossHpNumbers','bossHpBar','bossIntroBanner','hudHintBanner','hudSkillIcons','hudRunGold','hudVitalsIcon','hudHpText','hudHpPct','hudHpBar','hudHpGhost','btnArenaSize'];
        const hud=ids.map(id=>{const el=must(id);return {id,rect:rect(el),display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility,inHeader:header.contains(el),inFooter:footer.contains(el),text:el.textContent.slice(0,100)};});
        const entity = value=>value==null?null:JSON.parse(JSON.stringify(value, (key,v)=>typeof v==='function'?undefined:v));
        return {world:{width:g.width,height:g.height},canvas:rect(canvas),backing:{width:canvas.width,height:canvas.height},field:rect(field),header:rect(header),footer:rect(footer),hud,viewport:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth},geometry:entity({player:{x:g.player.x,y:g.player.y},pet:g.pet,enemies:g.enemies,obstacles:g.obstacles,portal:g.portalRect}),moduleKeys:Object.keys(window.ArtemisArenaViewport)};
      });
      const layout = (s,width,height,label)=>{
        assert.deepEqual(s.world,{width,height},`${label} logical profile`);
        assert.deepEqual(s.backing,{width,height},`${label} logical canvas backing`);
        assert.ok(s.canvas.width>0&&s.canvas.height>0,`${label} canvas visible`);
        near(s.canvas.width/width,s.canvas.height/height,`${label} uniform display scale`,0.005);
        assert.ok(s.header.bottom<=s.canvas.y+1,`${label} header outside canvas`);
        assert.ok(s.footer.y>=s.canvas.bottom-1,`${label} footer outside canvas`);
        assert.ok(s.canvas.x>=-1&&s.canvas.right<=s.viewport.width+1,`${label} horizontal fit`);
        assert.ok(s.header.y>=-1&&s.footer.bottom<=s.viewport.height+1,`${label} vertical fit`);
        assert.ok(s.viewport.scrollWidth<=s.viewport.width+1,`${label} no page horizontal overflow`);
        for(const h of s.hud) {
          assert.ok(h.inHeader||h.inFooter||['bossIntroBanner','hudHintBanner'].includes(h.id),`${label} preserved HUD position ${h.id}`);
          if(['hudRoomText','hudLevelText','hudXpRatioText','btnPauseGame','btnHudGfx','hudRunGold','hudHpText','btnArenaSize'].includes(h.id)) {
            assert.ok(h.rect.width>0&&h.rect.height>0&&h.display!=='none'&&h.visibility!=='hidden',`${label} HUD visible ${h.id}`);
            assert.ok(h.rect.x>=-1&&h.rect.right<=s.viewport.width+1,`${label} HUD not clipped ${h.id}`);
          }
        }
      };
      const pointer = async(mobile=false)=>{
        const s=await snapshot(),r=s.canvas,delta=mobile?{x:60,y:40}:{x:12,y:8},start={x:r.x+r.width*.4,y:r.y+r.height*.5},end={x:start.x+r.width/s.world.width*delta.x,y:start.y+r.height/s.world.height*delta.y};
        await page.evaluate(()=>{const a=window.Archero2FusionAPI;a.stopGameLoop();if(!a.Game.running)throw Error('UI did not start run');a.Game.paused=false;});
        let cdp;
        if(mobile){cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});}
        else {await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y);}
        try {
          const joy=await page.evaluate(()=>({...window.Archero2FusionAPI.Game.joy}));
          assert.equal(joy.active,true,'real listener activated joystick');
          near(joy.startX,s.world.width*.4,'logical input start x');near(joy.startY,s.world.height*.5,'logical input start y');
          const clamp=Math.min(1,44/Math.hypot(delta.x,delta.y));
          near(joy.currX,s.world.width*.4+delta.x*clamp,'logical input movement x');near(joy.currY,s.world.height*.5+delta.y*clamp,'logical input movement y');
          const mx=joy.currX-joy.startX,my=joy.currY-joy.startY;
          near(joy.dx,mx/Math.hypot(mx,my),'logical joystick direction x',0.001);near(joy.dy,my/Math.hypot(mx,my),'logical joystick direction y',0.001);
          check(`${mobile?'touch':'mouse'} real input maps CSS coordinates to logical world`,{joy,moduleKeys:s.moduleKeys});
        } finally {
          if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else await page.mouse.up();
        }
        assert.deepEqual((await snapshot()).geometry,s.geometry,'stopped input does not advance entities');
      };
      const desktop=await launch({width:1440,height:900});await settle();
      const initial=await snapshot();layout(initial,800,600,'desktop 1440');
      check('desktop 1440 logical profile, uniform canvas and preserved separated HUD',{state:initial,screenshot:await screenshot('desktop-1440')});
      const widths=[];
      for(const width of [1920,1024]) {
        await page.setViewportSize({width,height:900});await settle();
        const s=await snapshot();layout(s,800,600,`desktop ${width}`);assert.deepEqual(s.geometry,initial.geometry,`resize ${width} preserves all captured geometry`);widths.push(s.canvas.width);
        check(`resize ${width} display only`,{state:s,screenshot:await screenshot(`desktop-${width}`)});
      }
      assert.ok(widths[0]>=initial.canvas.width-1&&widths[1]<=initial.canvas.width+1,'width-driven display profile');
      // Cùng chiều cao có thể chạm trần fit: không bắt buộc tăng rộng khi đã height-limited.
      check('width profile is monotonic with viewport width',{widths:{1440:initial.canvas.width,1920:widths[0],1024:widths[1]}});
      await page.setViewportSize({width:1920,height:900});await settle();const before=await snapshot();
      await page.locator('#btnArenaSize').click();await settle();const after=await snapshot();layout(after,800,600,'size toggle');
      assert.deepEqual(after.geometry,before.geometry,'size toggle preserves entities and portal');
      assert.ok(Math.abs(after.canvas.width-before.canvas.width)>1||Math.abs(after.canvas.height-before.canvas.height)>1,'size button actually changes display dimensions');
      check('size toggle changes display, not logical geometry',{before,after,screenshot:await screenshot('desktop-size-toggle')});
      await pointer();await desktop.close();
      const mobile=await launch({width:360,height:740},true);await settle();const phone=await snapshot();layout(phone,480,720,'mobile 360x740');
      check('fresh mobile run uses portrait profile without overflow',{state:phone,screenshot:await screenshot('mobile-360')});
      await pointer(true);await mobile.close();
      assert.deepEqual(report.errors,[],'no uncaught browser errors');
      assert.deepEqual(fixture.requests.filter(r=>r.status>=400),[],'no HTTP handler failures');
      report.status='PASS';
    })()]);
  } catch(error) {report.status=String(error.message).startsWith('BLOCKED:')?'BLOCKED':'FAIL';report.error=error.stack;process.exitCode=1;}
  finally {
    clearTimeout(timer);
    try{await browser?.close();}catch(error){report.cleanupError=error.message;}
    try{await fixture?.close();}catch(error){report.fixtureCleanupError=error.message;}
    await mkdir(evidenceDir,{recursive:true});
    const evidence=resolve(evidenceDir,'evidence.json');await writeFile(evidence,JSON.stringify(report,null,2));
    console.log(JSON.stringify({status:report.status,evidence,checks:report.checks.map(c=>c.name),error:report.error}));
  }
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await verifyArenaViewport();
