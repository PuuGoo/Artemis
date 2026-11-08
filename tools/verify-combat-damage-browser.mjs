// Chrome + localhost/mock auth/save; chỉ fixture, không tài khoản hoặc DB thật.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),publicDir=resolve(root,'public');
const output=resolve(root,'docs/combat-damage-evidence');
await mkdir(output,{recursive:true});
const vectors=JSON.parse(await readFile(resolve(root,'tests/fixtures/native-combat-vectors.json'),'utf8'));
const superSeed=vectors.rng.find(row=>row[1]===0&&row[2]===65536&&row[3]===65535)[0];
const errors=[],failed=[],results=[];
const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname.startsWith('/api/')){
    res.setHeader('Content-Type','application/json');
    if(u.pathname==='/api/auth/me')return res.end(JSON.stringify({ok:true,authenticated:true,player:{id:'damage_fixture',username:'damage_fixture'}}));
    if(u.pathname==='/api/save'&&req.method==='GET')return res.end(JSON.stringify({ok:true,hasSave:false,data:null,revision:0}));
    if(u.pathname==='/api/save'&&req.method==='PUT')return res.end(JSON.stringify({ok:true,revision:1}));
    res.statusCode=404;return res.end(JSON.stringify({ok:false}));
  }
  try{
    const file=resolve(publicDir,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1)));
    if(!file.startsWith(publicDir+sep))throw Error('outside public');
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg'})[extname(file)]||'application/octet-stream');
    let body=await readFile(file);
    if(extname(file)==='.html'){
      const html=body.toString('utf8'),anchor='window.Archero2FusionAPI = {';
      assert.equal(html.split(anchor).length,2);
      body=html.replace(anchor,'window.__combatFixture={damageEnemy,hurtPlayer,updateGame,renderGame,setupRoom};\n'+anchor);
    }
    res.end(body);
  }catch{res.statusCode=404;res.end('not found');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.ARTEMIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-extensions','--disable-background-networking','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:900,height:900}});
  page.setDefaultTimeout(8000);
  await page.route('**/*',route=>{
    const r=route.request(),u=new URL(r.url());
    return u.origin===origin||(r.method()==='GET'&&['https://cdn.tailwindcss.com','https://fonts.googleapis.com','https://fonts.gstatic.com'].includes(u.origin))?route.continue():route.abort();
  });
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400&&!r.url().includes('/api/'))failed.push(r.url());});
  await page.goto(origin,{waitUntil:'load',timeout:20000});
  await page.waitForFunction(()=>window.Archero2FusionAPI&&!document.documentElement.classList.contains('cloud-locked'));
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.locator('#btnStartGame').click();await page.locator('#btnBriefingStart').click();
  await page.waitForTimeout(1000);
  const before=await page.evaluate(()=>{const g=window.Archero2FusionAPI.Game;return{time:g.lastTime,enemies:g.enemies.length,kills:g.kills};});
  await page.waitForTimeout(1200);
  const live=await page.evaluate(()=>{const g=window.Archero2FusionAPI.Game;return{time:g.lastTime,enemies:g.enemies.length,kills:g.kills,hp:g.player.hp,lastHit:g.lastCombatHit||null};});
  assert.ok(before.enemies>0&&live.time>before.time,'loop phải sống sau khi vào trận từ UI');
  results.push({name:'natural-ui-start-and-loop',before,after:live});
  const handlers=await page.evaluate(seed=>{
    const a=window.Archero2FusionAPI,g=a.Game,t=window.__combatFixture,d=window.CombatDamage;
    a.stopGameLoop();
    const p=g.player,e=g.enemies[0];
    if(!e)throw Error('thiếu quái từ spawner thật');
    // Thay stat chỉ trên entity của fixture, không sửa SaveState/ownership.
    Object.assign(p,{hero:{id:'fixture'},skills:{},critRate:0,critDmgMult:1.85,atk:100,hp:1000,maxHp:1000,gearDodge:0,dmgReduction:0,invulnTimer:0,alexNextGuaranteedCrit:false});
    Object.assign(e,{hp:10000,maxHp:10000,artemisMarked:false,combatAttributes:{HurtDecrease:10,HurtDecreasePercent:.5}});
    t.damageEnemy(e,100);const primary={loss:10000-e.hp,...g.lastCombatHit};
    const hp=e.hp;t.damageEnemy(e,100,true,'fire');const dot={loss:hp-e.hp,...g.lastCombatHit};
    e.combatAttributes={};e.darkShieldHp=20;e.shieldHp=30;
    const ehp=e.hp;t.damageEnemy(e,35,true);const enemyShield={loss:ehp-e.hp,normal:e.shieldHp,extra:e.darkShieldHp,...g.lastCombatHit};
    Object.assign(p,{darkShieldHp:20,shieldHp:30,combatAttributes:{}});
    t.hurtPlayer(35);const playerShield={hp:p.hp,normal:p.shieldHp,extra:p.darkShieldHp,...g.lastCombatHit};
    p.invulnTimer=0;t.hurtPlayer(20);const spill={hp:p.hp,...g.lastCombatHit};
    p.shieldHp=0;p.darkShieldHp=0;p.invulnTimer=0;p.dmgReduction=.5;p.combatAttributes={HurtDecrease:10};
    const php=p.hp;t.hurtPlayer(100);const defense={loss:php-p.hp,...g.lastCombatHit};
    e.darkShieldHp=0;e.shieldHp=0;
    p.combatSourceData={CritRate:0,CritValue:2,SuperCirtRate:1,SuperCritValue:1};d.beginRun(g,seed);
    const chp=e.hp;t.damageEnemy(e,100);const superCrit={loss:chp-e.hp,...g.lastCombatHit};
    t.renderGame();
    return{primary,dot,enemyShield,playerShield,spill,defense,superCrit,fixtureEntityStats:true};
  },superSeed);
  assert.equal(handlers.primary.loss,45);assert.equal(handlers.dot.loss,45);
  assert.equal(handlers.enemyShield.loss,0);assert.equal(handlers.enemyShield.normal,15);assert.equal(handlers.enemyShield.extra,0);
  assert.equal(handlers.playerShield.hp,1000);assert.equal(handlers.playerShield.normal,15);
  assert.equal(handlers.spill.hp,995);assert.equal(handlers.defense.loss,45);
  assert.equal(handlers.superCrit.superCrit,true);assert.equal(handlers.superCrit.loss,300);
  results.push({name:'production-handlers-with-entity-fixtures',details:handlers});
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  await writeFile(resolve(output,'browser.json'),JSON.stringify({scope:'Chrome/local mock auth-save. UI launch and live loop; numeric handler probes use explicit fixture entity stats. No production account or database.',results,errors,failed},null,2));
  console.log(JSON.stringify({results,errors,failed}));
}finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
