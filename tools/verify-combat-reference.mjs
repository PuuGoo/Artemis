import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/save/schema.js';

// Chrome thật + auth/save bộ nhớ: không DB, không tài khoản thật, không đọc .env.
// PLAYWRIGHT_MODULE=<đường dẫn playwright-core/index.mjs> node tools/verify-battle-hub.mjs [--baseline]
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
const evidence = resolve(root, 'docs/combat-reference-evidence');
await mkdir(evidence, { recursive: true });
const baselineOnly = process.argv.includes('--baseline');
const baselineHtml = baselineOnly ? execFileSync('git', ['show', 'dc0b831:public/index.html'], { cwd: root, maxBuffer: 4 * 1024 * 1024 }).toString('utf8') : null;
let saved = null;
let revision = 0;
const results = [];
const errors = [];
const failedLocal = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ ok: true, authenticated: true, player: { id: 'battle_ui_fixture', username: 'battle_ui_fixture' } }));
    if (url.pathname === '/api/save' && req.method === 'GET') return res.end(JSON.stringify(saved ? { ok: true, hasSave: true, data: saved, revision } : { ok: true, hasSave: false, data: null, revision: 0 }));
    if (url.pathname === '/api/save' && req.method === 'PUT') {
      let body = ''; for await (const chunk of req) body += chunk;
      const input = JSON.parse(body);
      const checked = sanitizeSave(input.data);
      if (!checked.ok) { res.statusCode = 422; return res.end(JSON.stringify({ ok: false, error: checked.reason })); }
      saved = checked.data; revision++;
      return res.end(JSON.stringify({ ok: true, revision }));
    }
    res.statusCode = 404; return res.end(JSON.stringify({ ok: false }));
  }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir + sep)) throw Error('outside public');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' })[extname(file)] || 'application/octet-stream');
    res.end(baselineHtml && url.pathname === '/' ? baselineHtml : await readFile(file));
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(7000);
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const allowed = ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
    return url.origin === origin || (request.method() === 'GET' && allowed.includes(url.origin)) ? route.continue() : route.abort();
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', res => { if (res.url().startsWith(origin) && res.status() >= 400 && !res.url().includes('/api/')) failedLocal.push(res.url()); });
  await page.goto(origin, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
  await page.setViewportSize({width:390,height:844});
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.locator('#btnStartGame').click();await page.locator('#btnBriefingStart').click();
  await page.waitForSelector('#skillSelectModal:not(.hidden)');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.skill-choice-card').count(),3);
  await page.screenshot({path:resolve(evidence,'entry-skills-390.png')});
  await page.locator('.skill-choice-card').first().click();await page.waitForTimeout(200);
  for(const room of [5,15,25,35,45]){
    const data=await page.evaluate(room=>{const a=window.Archero2FusionAPI,g=a.Game;a.stopGameLoop();g.running=true;g.paused=false;a.setupRoom(room);return {enemies:g.enemies.length,bullets:g.enemyBullets.length,drops:g.drops.length,npc:!!g.valkyrieNpc,room:g.room};},room);
    assert.equal(data.enemies,0);assert.equal(data.bullets,0);assert.equal(data.drops,0);assert.equal(data.npc,true);results.push(data);
  }
  await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;a.setupRoom(5);g.player.x=g.valkyrieNpc.x;g.player.y=g.valkyrieNpc.y;a.updateGame(.01);a.renderGame();});
  await page.waitForSelector('#skillSelectModal:not(.hidden)');assert.equal(await page.locator('.skill-choice-card').count(),2);
  await page.screenshot({path:resolve(evidence,'valkyrie-390.png')});
  await page.locator('.skill-choice-card').first().click();await page.waitForTimeout(150);
  const camera=await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;a.setupRoom(6);g.player.y=1100;a.renderGame();const bottom=ArtemisArenaViewport.camera(g,1000).y;g.player.y=180;for(let i=1;i<=30;i++)ArtemisArenaViewport.camera(g,1000+i*50);a.renderGame();return{bottom,top:ArtemisArenaViewport.camera(g).y,width:g.width,height:g.height};});
  assert.ok(camera.bottom>camera.top);results.push({camera});
  await page.screenshot({path:resolve(evidence,'corridor-390.png')});
  await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;a.setupRoom(4);g.enemies=[];g.drops=[];g.roomCleared=true;g.portalOpen=true;g.paused=false;a.updateGame(.01);g.player.x=g.wheelNpc.x;g.player.y=g.wheelNpc.y;a.updateGame(.01);});
  await page.waitForSelector('.campaign-wheel-overlay');await page.screenshot({path:resolve(evidence,'wheel-390.png')});
  await page.locator('.campaign-wheel-start').click();await page.waitForTimeout(150);
  await page.locator('.campaign-wheel-overlay').click({position:{x:5,y:100}});
  await page.waitForSelector('.campaign-wheel-reward:not([hidden])');await page.screenshot({path:resolve(evidence,'wheel-reward-390.png')});
  assert.equal(errors.length,0);assert.equal(failedLocal.length,0);
  const report={scope:'Chrome local fixture mocked auth/save, actual client code; not production',results,errors,failedLocal};await writeFile(resolve(evidence,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){console.error(JSON.stringify({error:error.message,results,errors,failedLocal},null,2));process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.close(r));}
