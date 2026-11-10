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
const evidence = resolve(root, 'docs/world-map-evidence');
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
  await page.waitForSelector('[data-world-map-scroll]');
  const scroll=page.locator('[data-world-map-scroll]');
  const state=()=>page.evaluate(()=>({top:document.querySelector('[data-world-map-scroll]').scrollTop,selected:window.Archero2FusionAPI.SaveState.selectedChapterIdx}));
  const total=await page.evaluate(()=>window.Archero2FusionAPI.getCampaignChapters().length);
  assert.equal(await page.locator('[data-world-chapter]').count(),total,'every actual chapter rendered');
  results.push({chapterCount:total});
  await page.setViewportSize({width:552,height:1001});
  await page.waitForTimeout(250);
  await page.screenshot({path:resolve(evidence,'current-552.png')});
  let before=await state();
  await scroll.hover(); await page.mouse.wheel(0,-650); await page.waitForTimeout(500);
  let after=await state(); assert.ok(after.top<before.top,'wheel scrolls upward toward later chapters');
  results.push({wheel:{before,after}});
  const r=await scroll.boundingBox();
  before=await state();
  await page.mouse.move(r.x+r.width*.52,r.y+r.height*.4); await page.mouse.down();
  await page.mouse.move(r.x+r.width*.52,r.y+r.height*.7,{steps:12});await page.mouse.up();
  await page.waitForTimeout(120);after=await state();
  assert.ok(after.top<before.top,'left drag scrolls');assert.equal(after.selected,before.selected,'drag does not select');
  results.push({leftDrag:{before,after}});
  const locked=page.locator('[data-world-chapter]').filter({has:page.locator('[data-world-lock]')}).first();
  // Chapter 2 is locked in a new-account fixture, regardless of its art.
  const chapter2=page.locator('[data-world-chapter="2"]');
  await chapter2.scrollIntoViewIfNeeded(); before=await state(); await chapter2.click();
  await page.waitForTimeout(200); after=await state();
  assert.equal(after.selected,before.selected,'locked preview never changes selected save');
  assert.ok(await page.locator('#btnStartGame').isDisabled(),'locked preview cannot launch');
  await page.screenshot({path:resolve(evidence,'locked-552.png')});
  await page.locator('[data-world-map-return]').click();await page.waitForTimeout(500);
  assert.equal(await page.locator('#btnStartGame').isDisabled(),false,'return clears preview');
  results.push({lockedPreviewAndReturn:'PASS'});
  before=await state(); await page.evaluate(()=>window.Archero2FusionAPI.renderLobbyUI());await page.waitForTimeout(250);after=await state();
  assert.ok(Math.abs(after.top-before.top)<2,'render preserves scroll position');
  for(const width of [390,360,1280]){
    await page.setViewportSize({width,height:844});await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
    assert.equal(await page.locator('[data-world-chapter]').count(),total);
    await page.screenshot({path:resolve(evidence,`map-${width}.png`)});
  }
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const tp=await touch.newPage();await tp.goto(origin,{waitUntil:'load'});await tp.waitForSelector('[data-world-map-scroll]');
  const ts=await tp.locator('[data-world-map-scroll]').boundingBox();
  const touchBefore=await tp.locator('[data-world-map-scroll]').evaluate(e=>e.scrollTop);
  const client=await touch.newCDPSession(tp);
  const x=ts.x+ts.width*.52,y=ts.y+ts.height*.35;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+i*25}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tp.waitForTimeout(400);
  const touchAfter=await tp.locator('[data-world-map-scroll]').evaluate(e=>e.scrollTop);
  assert.ok(touchAfter<touchBefore,'native touchscreen swipe scrolls');results.push({touch:{before:touchBefore,after:touchAfter}});
  await touch.close();
  await page.evaluate(()=>window.ArtemisWorldMap.returnToCurrent());
  await page.waitForTimeout(200);
  await page.locator('#btnStartGame').click();assert.ok(await page.locator('#runBriefingModal').isVisible());
  await page.locator('#btnBriefingStart').click();await page.waitForTimeout(1400);
  assert.ok(await page.evaluate(()=>window.Archero2FusionAPI.Game.running),'real combat starts');
  assert.equal(errors.length,0);assert.equal(failedLocal.length,0);
  const report={scope:'Real Chrome, isolated local auth/save fixture, not production',results,errors,failedLocal};
  await writeFile(resolve(evidence,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){console.error(JSON.stringify({error:error.message,results,errors,failedLocal},null,2));process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.close(r));}
