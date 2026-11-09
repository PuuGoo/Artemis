import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const modulePath = new URL('../public/arena-viewport.js', import.meta.url);
function load() {
  assert.ok(fs.existsSync(modulePath), 'production arena viewport module exists');
  const sandbox = { console }; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(modulePath, 'utf8'), sandbox);
  return sandbox.ArtemisArenaViewport;
}
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function body(name) {
  const start = html.indexOf(`function ${name}(`); assert.ok(start >= 0);
  let i = html.indexOf('{', start), depth = 1, j = i+1;
  for (; depth && j < html.length; j++) { if (html[j] === '{') depth++; if (html[j] === '}') depth--; }
  return html.slice(start,j);
}
function production(overrides = {}) {
  const game = {width:800,height:600,running:true,paused:false,portalRect:{x:356,y:12,w:88,h:34},joy:{}};
  const canvas = {width:800,height:600,style:{},getBoundingClientRect:()=>({left:100,top:50,width:400,height:300})};
  const field = {getBoundingClientRect:()=>({width:1100,height:700})};
  const button = {dataset:{},setAttribute(k,v){this[k]=v;}};
  const sandbox = {Game:game,canvas,window:{innerWidth:1440},document:{getElementById(id){return ({arenaPlayfield:field,gameArenaView:field,btnArenaSize:button})[id];}}, ...overrides};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(modulePath,'utf8'),sandbox);
  vm.runInContext(['resizeCanvas','handlePointerStart','handlePointerMove'].map(body).join('\n'),sandbox);
  return {sandbox,game,canvas,button};
}
test('production resize keeps world and portal identity while fitting canvas', () => {
  const {sandbox,game,canvas} = production(); const before = JSON.stringify(game), portal = game.portalRect;
  sandbox.resizeCanvas();
  assert.equal(JSON.stringify(game),before); assert.equal(game.portalRect,portal);
  assert.equal(canvas.width,800); assert.equal(canvas.height,600);
  assert.ok(parseFloat(canvas.style.width)>0);
  sandbox.ArtemisArenaViewport.beginRun(game,390);
  game.player={x:240,y:625,r:17}; game.obstacles=[{x:40,y:90,w:20,h:100}];
  const mobile=JSON.stringify(game), mobilePortal=game.portalRect;
  for (const mode of ['fit','large','fit']) {
    if (sandbox.ArtemisArenaViewport.getMode() !== mode) sandbox.ArtemisArenaViewport.toggleMode();
    sandbox.window.innerWidth=1920; sandbox.resizeCanvas();
    assert.equal(JSON.stringify(game),mobile); assert.equal(game.portalRect,mobilePortal);
    assert.equal(canvas.width,480); assert.equal(canvas.height,720);
  }
});
test('production pointer start and drag use logical coordinates and 44-unit joystick radius', () => {
  const {sandbox,game} = production();
  sandbox.handlePointerStart(200,125); assert.equal(game.joy.startX,200); assert.equal(game.joy.startY,150);
  sandbox.handlePointerMove(230,125); assert.equal(game.joy.currX,244); assert.equal(game.joy.dx,1);
});
test('production fallback resize works in legacy VM without module and never changes geometry', () => {
  const {sandbox,game} = production(); delete sandbox.ArtemisArenaViewport;
  const before = JSON.stringify(game); sandbox.resizeCanvas(); assert.equal(JSON.stringify(game),before);
});
test('header and footer are siblings outside playfield, boss space is reserved, and vitals are unique', () => {
  const section = html.slice(html.indexOf('<section id="gameArenaView"'),html.indexOf('</section>',html.indexOf('<section id="gameArenaView"')));
  assert.match(section, /id="arenaHudHeader"/); assert.match(section, /id="arenaPlayfield"/); assert.match(section, /id="arenaHudFooter"/);
  assert.ok(section.indexOf('id="arenaHudHeader"') < section.indexOf('id="arenaPlayfield"'));
  assert.ok(section.indexOf('id="arenaHudFooter"') < section.indexOf('id="hudHpText"'));
  assert.equal((html.match(/id="hudHpText"/g)||[]).length,1);
  const cssPath = new URL('../public/arena-viewport.css',import.meta.url);
  assert.ok(fs.existsSync(cssPath)); const css=fs.readFileSync(cssPath,'utf8');
  assert.match(css, /#arenaHudHeader[\s\S]*?grid-template-rows/);
  assert.match(css, /#bossHudContainer\.hidden[\s\S]*?visibility:\s*hidden/);
  assert.match(html,/src="\/arena-viewport.js"/); assert.match(html,/href="\/arena-viewport.css"/);
});
test('fresh start chooses profile before resizing and continue does not rechoose', () => {
  const start=body('startNewRun');
  assert.match(start,/reason !== 'continue'[\s\S]*?ArtemisArenaViewport.beginRun/);
  assert.ok(start.indexOf('ArtemisArenaViewport.beginRun') < start.indexOf('resizeCanvas()'));
});
test('display preference persists locally, labels target action, and blocked storage is safe', () => {
  const sandbox={localStorage:{value:'large',getItem(key){assert.equal(key,'artemis.arenaSize');return this.value;},setItem(key,v){assert.equal(key,'artemis.arenaSize');this.value=v;}}};
  vm.createContext(sandbox); const source=fs.readFileSync(modulePath,'utf8'); vm.runInContext(source,sandbox);
  const api=sandbox.ArtemisArenaViewport, button={dataset:{},setAttribute(k,v){this[k]=v;}};
  assert.equal(api.getMode(),'large'); api.syncButton(button); assert.equal(button.textContent,'Vừa màn hình');
  api.toggleMode(); api.syncButton(button); assert.equal(api.getMode(),'fit'); assert.equal(button.textContent,'Hiển thị lớn');
  assert.equal(sandbox.localStorage.value,'fit'); assert.match(button.title,/Vừa màn hình/);
  sandbox.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  vm.runInContext(source,sandbox); assert.equal(sandbox.ArtemisArenaViewport.getMode(),'fit'); sandbox.ArtemisArenaViewport.toggleMode();
  const {sandbox: productionContext,game,canvas}=production();
  const before=JSON.stringify(game); let click;
  const originalLookup=productionContext.document.getElementById;
  productionContext.document.getElementById=id=>id==='btnArenaSize' ? {...button,addEventListener(type,handler){assert.equal(type,'click');click=handler;}} : originalLookup(id);
  const listener=html.match(/document\.getElementById\('btnArenaSize'\)\?\.addEventListener\('click', \(\) => \{[\s\S]*?\n      \}\);/);
  assert.ok(listener,'production size button listener exists');
  vm.runInContext(listener[0],productionContext); click();
  assert.equal(productionContext.ArtemisArenaViewport.getMode(),'large');
  assert.ok(parseFloat(canvas.style.width)>0); assert.equal(JSON.stringify(game),before);
});
test('uniform fit contains the entire canvas with centered letterboxing in both modes', () => {
  const api = load();
  for (const [w,h] of [[800,600],[480,720]]) for (const [aw,ah] of [[1400,700],[360,400],[100,50],[0,0]]) {
    for (const mode of ['fit','large']) {
      const fit = api.fitLayout(aw, ah, w, h, mode);
      assert.ok(fit.width <= aw + 1e-8 && fit.height <= ah + 1e-8);
      assert.equal(fit.left, (aw-fit.width)/2); assert.equal(fit.top, (ah-fit.height)/2);
      if (aw && ah) assert.ok(Math.abs(fit.width / fit.height - w/h) < 1e-8);
    }
    if (aw && ah) assert.ok(api.fitLayout(aw,ah,w,h,'large').width > api.fitLayout(aw,ah,w,h,'fit').width);
  }
});
test('fresh run selects desktop or mobile logical profile once', () => {
  const api = load();
  for (const [width, w, h] of [[1440,800,600], [768,800,600], [390,480,720]]) {
    const game = { width: 12, height: 12 };
    api.beginRun(game, width);
    assert.equal(game.width, w); assert.equal(game.height, h);
    assert.equal(game.portalRect.x, w / 2 - 44);
  }
});
