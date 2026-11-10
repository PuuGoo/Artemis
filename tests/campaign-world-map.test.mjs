import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sanitizeSave } from '../lib/save/schema.js';
const sourceURL = new URL('../public/campaign-world-map.js', import.meta.url);
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
function load() {
  assert.ok(existsSync(sourceURL), 'world map implementation must exist');
  const document = {readyState:'loading', addEventListener(){}, scripts:[{textContent:html}], querySelectorAll(){return [];}};
  const window = {};
  vm.runInNewContext(readFileSync(sourceURL,'utf8'), {document,window,console});
  return window.ArtemisWorldMap;
}
test('world map discovers every real chapter without fabricating extra destinations', () => {
  const api = load();
  const start = html.indexOf('const CHAPTERS = [');
  const end = html.indexOf('const CampaignConfig', start);
  const expected = [...html.slice(start,end).matchAll(/^          id: (\d+),/gm)].map(m=>Number(m[1]));
  assert.deepEqual(Array.from(api.getChapters(), ch=>ch.id), expected);
  assert.equal(expected.length,19);
  assert.equal(api.getChapters()[0].themeName,'Đá Cổ');
  assert.equal(api.getChapters().at(-1).unlock.chapterId,18);
});
test('unlock copy uses the real previous-chapter win, never invented hard mode', () => {
  const map = load();
  assert.deepEqual(Array.from(map.requirements(map.getChapters()[0])),[]);
  assert.deepEqual(Array.from(map.requirements(map.getChapters()[1])),['Thắng Chương 1','Hạ trùm cuối Chương 1']);
});

test('real Chrome fixture: complete map, live handlers, scrolling and rerender preservation', {skip:!process.env.PLAYWRIGHT_MODULE,timeout:90000}, async () => {
  const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
  const publicDir = fileURLToPath(new URL('../public/',import.meta.url));
  let saved = null, revision = 0;
  const server = createServer(async (req,res) => {
    const url = new URL(req.url,'http://localhost');
    res.setHeader('Content-Type','application/json');
    if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ok:true,authenticated:true,player:{id:'world_map_fixture',username:'world_map_fixture'}}));
    if (url.pathname === '/api/save' && req.method === 'GET') return res.end(JSON.stringify({ok:true,hasSave:!!saved,data:saved,revision}));
    if (url.pathname === '/api/save' && req.method === 'PUT') {
      let body=''; for await(const chunk of req) body+=chunk;
      const result = sanitizeSave(JSON.parse(body).data);
      if (!result.ok) {res.statusCode=422;return res.end(JSON.stringify(result));}
      saved=result.data; revision++; return res.end(JSON.stringify({ok:true,revision}));
    }
    if (url.pathname.startsWith('/api/')) {res.statusCode=404;return res.end('{}');}
    try {
      const file=resolve(publicDir,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)));
      if (!file.startsWith(resolve(publicDir)+sep)) throw Error('outside public');
      res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[extname(file)]||'application/octet-stream');
      res.end(await readFile(file));
    } catch {res.statusCode=404;res.end('not found');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  const errors=[];
  try {
    browser=await chromium.launch({executablePath:process.env.ARTEMIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage({viewport:{width:552,height:900}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
    if (!await page.evaluate(()=>!!window.ArtemisWorldMap)) {
      await page.addStyleTag({url:'/campaign-world-map.css'});
      await page.addScriptTag({url:'/campaign-world-map.js'});
    }
    await page.locator('#bottomNavBar .grid [data-tab="tabBattle"]').click();
    await page.waitForSelector('[data-world-chapter="1"]');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-world-chapter]').count(),19);
    assert.deepEqual(await page.locator('[data-world-chapter]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.worldChapter))),Array.from({length:19},(_,i)=>19-i));
    const scroll=page.locator('[data-world-map-scroll]');
    assert.ok(await scroll.evaluate(e=>e.scrollHeight>e.clientHeight*4));
    assert.ok(await scroll.evaluate(e=>e.scrollTop>3000),'initial scroll reaches current chapter');
    const initial=await scroll.evaluate(e=>e.scrollTop);
    await scroll.hover(); await page.mouse.wheel(0,-650); await page.waitForTimeout(250);
    const wheeled=await scroll.evaluate(e=>e.scrollTop);
    assert.ok(wheeled<initial-100,'native wheel scroll');
    await page.evaluate(()=>window.Archero2FusionAPI.renderLobbyUI());
    await page.waitForTimeout(200);
    assert.ok(Math.abs(await scroll.evaluate(e=>e.scrollTop)-wheeled)<2,'scroll persists after real lobby renderer');
    // Drag is tested in an unobstructed portion, while fixed side rails remain overlaid.
    const box=await scroll.boundingBox();
    const x=box.x+box.width*.51,y=box.y+box.height*.45;
    const beforeDrag=await scroll.evaluate(e=>e.scrollTop);
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+120,{steps:10});await page.mouse.up();
    assert.ok(await scroll.evaluate(e=>e.scrollTop)<beforeDrag-50,'left mouse dragging scrolls');
    assert.equal(await page.evaluate(()=>window.Archero2FusionAPI.SaveState.selectedChapterIdx),0,'drag never selects a chapter');
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    const beforeTouch=await scroll.evaluate(e=>e.scrollTop);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let step=1;step<=8;step++) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+step*14}]});
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(200);
    assert.ok(await scroll.evaluate(e=>e.scrollTop)<beforeTouch-30,'native touch pan scrolls');
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await cdp.detach();
    await page.evaluate(()=>{const v=document.querySelector('[data-world-map-scroll]');v.scrollTop=0;});
    await page.waitForTimeout(100);
    assert.ok(await page.locator('.campaign-world-map').evaluate(e=>e.classList.contains('is-locked-region')),'locked region becomes purple');
    await page.locator('[data-world-chapter="19"]').dispatchEvent('click');
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>window.Archero2FusionAPI.SaveState.selectedChapterIdx),0);
    assert.equal(await page.locator('#btnStartGame').isDisabled(),true);
    assert.equal(await page.locator('[data-world-chapter="19"] .world-map-requirements > span').count(),2);
    await page.locator('[data-world-map-return]').click();
    assert.equal(await page.locator('#btnStartGame').isDisabled(),false);
    assert.ok(await scroll.evaluate(e=>e.scrollTop>3000));
    await page.evaluate(()=>{const a=window.Archero2FusionAPI;a.SaveState.winsByChapter[1]=1;a.renderLobbyUI();});
    await page.waitForTimeout(100);
    await page.locator('[data-world-chapter="2"]').dispatchEvent('click');
    assert.equal(await page.evaluate(()=>window.Archero2FusionAPI.SaveState.selectedChapterIdx),1,'unlocked handler writes real selected index');
    assert.equal(await page.locator('[data-world-chapter="1"] .world-map-stars').count(),1);
    assert.equal(await page.locator('[data-world-chapter="2"] .world-map-stars').count(),0);
    await page.locator('[data-world-chapter="2"]').focus();
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.worldChapter),'3');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#btnStartGame').isDisabled(),true,'keyboard can preview locked chapter');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#btnStartGame').isDisabled(),false);
    await page.evaluate(()=>{const a=window.Archero2FusionAPI;a.SaveState.gameMode='endless';a.renderMapSelect();});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-world-map-scroll]').count(),0);
    assert.equal(await page.locator('.battle-mode-stage').isVisible(),true);
    await page.evaluate(()=>{const a=window.Archero2FusionAPI;a.SaveState.gameMode='campaign';a.renderMapSelect();});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-world-chapter]').count(),19);
    assert.deepEqual(errors,[]);
    console.log('Real Chrome fixture PASS: 19 chapters, wheel, drag, locked preview, return, selection, keyboard, mode switching, render preservation.');
  } finally {await browser?.close();await new Promise(r=>server.close(r));}
});
