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
const evidence = resolve(root, 'docs/native-ui-evidence');
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
  for (const viewport of [{width:562,height:1001},{width:390,height:844},{width:1280,height:900}]) {
    await page.setViewportSize(viewport);
    await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
    await page.waitForTimeout(600);
    const geometry = await page.evaluate(() => {
      const box = id => {const e=document.getElementById(id), r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,visible:!!e.getClientRects().length};};
      return {overflow:document.documentElement.scrollWidth-innerWidth, start:box('btnStartGame'), nav:box('bottomNavBar'), active:document.querySelector('#bottomNavBar [aria-selected="true"]')?.dataset.tab};
    });
    assert.ok(geometry.overflow<=1, 'horizontal overflow');
    assert.ok(geometry.start.visible && geometry.start.height>=44 && geometry.start.bottom<=geometry.nav.y+1, 'start reachable above navigation');
    await page.screenshot({path:resolve(evidence,`campaign-${viewport.width}.png`)});
    results.push({viewport,geometry});
  }
  await page.setViewportSize({width:562,height:1001});
  for (const id of ['tabShopVn','tabEquip','tabBattle','nativeArtifacts','tabEvents']) {
    const tab=page.locator(`#bottomNavBar .grid [data-native-item="${id}"]`);
    assert.equal(await tab.count(),1,`navigation exists: ${id}`);
    await tab.click(); await page.waitForTimeout(250);
    const panelId=id==='nativeArtifacts'?'subpanelArtifacts':id;
    assert.equal(await page.locator(`#${panelId}`).isVisible(),true,`actual panel ${panelId}`);
    await page.screenshot({path:resolve(evidence,`${id}.png`)});
    results.push({tab:id,status:'PASS'});
  }
  await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
  await page.locator('#btnStartGame').click();
  assert.ok(await page.locator('#runBriefingModal').isVisible(),'real start briefing');
  await page.locator('#btnBriefingCancel').click();
  await page.locator('#btnStartGame').click();
  await page.locator('#btnBriefingStart').click();
  await page.waitForTimeout(1800);
  const run=await page.evaluate(()=>({running:window.Archero2FusionAPI.Game.running,enemies:window.Archero2FusionAPI.Game.enemies.length,room:window.Archero2FusionAPI.Game.room}));
  assert.ok(run.running && run.enemies>0,'actual combat starts');
  results.push({realCombatStart:run});
  await page.screenshot({path:resolve(evidence,'combat-start.png')});
  assert.equal(errors.length,0,'JavaScript errors');
  assert.equal(failedLocal.length,0,'missing assets');
  const report={scope:'Real Chrome local with isolated auth/save fixture; not production',results,errors,failedLocal};
  await writeFile(resolve(evidence,'verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} catch(error) {
  console.error(JSON.stringify({error:error.message,results,errors,failedLocal},null,2));process.exitCode=1;
} finally {await browser?.close(); await new Promise(r=>server.close(r));}
