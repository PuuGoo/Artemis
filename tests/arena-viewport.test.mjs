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
  assert.equal(canvas.width,Math.ceil(parseFloat(canvas.style.width)));
  assert.equal(canvas.height,Math.ceil(parseFloat(canvas.style.height)));
  assert.ok(parseFloat(canvas.style.width)>0);
  sandbox.ArtemisArenaViewport.beginRun(game,390);
  game.player={x:240,y:625,r:17}; game.obstacles=[{x:40,y:90,w:20,h:100}];
  const mobile=JSON.stringify(game), mobilePortal=game.portalRect;
  for (const mode of ['fit','large','fit']) {
    if (sandbox.ArtemisArenaViewport.getMode() !== mode) sandbox.ArtemisArenaViewport.toggleMode();
    sandbox.window.innerWidth=1920; sandbox.resizeCanvas();
    assert.equal(JSON.stringify(game),mobile); assert.equal(game.portalRect,mobilePortal);
    assert.equal(canvas.width,Math.ceil(parseFloat(canvas.style.width)));
    assert.equal(canvas.height,Math.ceil(parseFloat(canvas.style.height)));
  }
});
test('production backing follows display pixels with DPR capped at two', () => {
  for (const dpr of [1,1.25,2,3,undefined,NaN]) {
    const {sandbox,canvas,game}=production();
    sandbox.window.devicePixelRatio=dpr;
    const before=JSON.stringify(game);
    sandbox.resizeCanvas();
    const density=Number.isFinite(dpr) ? Math.min(2,Math.max(1,dpr)) : 1;
    assert.equal(canvas.width,Math.ceil(parseFloat(canvas.style.width)*density));
    assert.equal(canvas.height,Math.ceil(parseFloat(canvas.style.height)*density));
    assert.equal(JSON.stringify(game),before);
  }
});
test('production pointer start and drag use logical coordinates and 44-unit joystick radius', () => {
  const {sandbox,game} = production();
  sandbox.handlePointerStart(200,125); assert.equal(game.joy.startX,200); assert.equal(game.joy.startY,150);
  sandbox.handlePointerMove(230,125); assert.equal(game.joy.currX,244); assert.equal(game.joy.dx,1);
});
test('render resets HiDPI transform each frame, clears before shake and balances state', () => {
  const {sandbox,game,canvas}=production();
  Object.assign(game,{wallPad:24,shakeTime:1,shakeMag:8,lowGfx:true,player:null,joy:{},_vignetteCache:{w:800,h:600}});
  for (const key of ['shockwaves','enemies','drops','afterimages','muzzleFlashes','playerBullets','enemyBullets','lightningBolts','meteors','ambientMotes','particles','floatTexts']) game[key]=[];
  canvas.width=1600; canvas.height=1200;
  let transform=[1,0,0,1,0,0],stack=[],events=[];
  const gradient={addColorStop(){}};
  const ctx=new Proxy({
    canvas,
    save(){stack.push([...transform]);},restore(){assert.ok(stack.length);transform=stack.pop();},
    setTransform(...args){transform=args;events.push(['transform',...args]);},
    clearRect(...args){events.push(['clear',...args]);},
    translate(x,y){transform[4]+=x*transform[0];transform[5]+=y*transform[3];events.push(['shake']);},
    createRadialGradient(){return gradient;},createLinearGradient(){return gradient;}
  },{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  sandbox.ctx=ctx; sandbox.performance={now:()=>1000};
  sandbox.ArenaV2={drawArena(){events.push(['arena',...transform]);}};
  vm.runInContext(body('renderGame'),sandbox);
  for(let frame=0;frame<2;frame++) {
    events=[];sandbox.renderGame();
    assert.equal(stack.length,0);
    assert.deepEqual(events[0],['transform',2,0,0,2,0,0]);
    assert.deepEqual(events[1],['clear',0,0,800,600]);
    assert.ok(events.findIndex(e=>e[0]==='shake')>1);
    assert.equal(events.find(e=>e[0]==='arena')[1],2);
    assert.equal(events.filter(e=>e[0]==='transform').length,1);
  }
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
test('legacy display preference cannot change portrait framing and blocked storage is safe', () => {
  const sandbox={localStorage:{value:'large',getItem(key){assert.equal(key,'artemis.arenaSize');return this.value;},setItem(key,v){assert.equal(key,'artemis.arenaSize');this.value=v;}}};
  vm.createContext(sandbox); const source=fs.readFileSync(modulePath,'utf8'); vm.runInContext(source,sandbox);
  const api=sandbox.ArtemisArenaViewport, button={dataset:{},setAttribute(k,v){this[k]=v;}};
  assert.equal(api.getMode(),'fit'); api.syncButton(button); assert.equal(button.textContent,'Khung dọc');
  const beforeLayout=api.fitLayout(1100,700,480,1200);
  api.toggleMode(); api.syncButton(button); assert.equal(api.getMode(),'large'); assert.equal(button.textContent,'Khung dọc');
  assert.equal(button.dataset.mode,'large'); assert.match(button['aria-label'],/9:16/);
  assert.deepEqual(api.fitLayout(1100,700,480,1200),beforeLayout);
  assert.equal(sandbox.localStorage.value,'large','obsolete stored preference is not rewritten');
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
test('uniform fit contains the viewport with identical centered framing in both modes', () => {
  const api = load();
  for (const [w,h] of [[800,600],[480,720],[480,1200]]) for (const [aw,ah] of [[1400,700],[360,400],[100,50],[0,0]]) {
    for (const mode of ['fit','large']) {
      const fit = api.fitLayout(aw, ah, w, h, mode);
      assert.ok(fit.width <= aw + 1e-8 && fit.height <= ah + 1e-8);
      assert.equal(fit.left, (aw-fit.width)/2); assert.equal(fit.top, (ah-fit.height)/2);
      const view=api.viewSize({width:w,height:h});
      if (aw && ah) assert.ok(Math.abs(fit.width / fit.height - view.width/view.height) < 1e-8);
    }
    assert.deepEqual(api.fitLayout(aw,ah,w,h,'large'),api.fitLayout(aw,ah,w,h,'fit'));
  }
});
test('fresh run selects the same tall world and portrait viewport on desktop and mobile', () => {
  const api = load();
  for (const width of [1440,768,390]) {
    const w=480,h=1200;
    const game = { width: 12, height: 12 };
    api.beginRun(game, width);
    assert.equal(game.width, w); assert.equal(game.height, h);
    assert.equal(game.portalRect.x, w / 2 - 44);
    assert.equal(api.viewSize(game).width,480);
    assert.ok(Math.abs(api.viewSize(game).height-853.3333333333334)<1e-8);
  }
});

test('portrait camera follows up and back down without changing room geometry', () => {
  const api=load(),game={room:1};api.beginRun(game);
  game.player={x:240,y:1105};
  const portal=game.portalRect, entrance=api.camera(game,0);
  assert.ok(entrance.y>0);
  game.player.y=95;
  const top=api.camera(game,100);
  assert.ok(top.y<entrance.y,'camera follows player upwards');
  game.player.y=1105;
  const back=api.camera(game,200);
  assert.ok(back.y>top.y,'camera also follows player back down');
  assert.ok(back.y<=game.height-back.height);
  assert.equal(game.width,480);assert.equal(game.height,1200);assert.equal(game.portalRect,portal);
  const rect={left:100,top:50,width:240,height:426.6666666666667};
  const screen=api.worldToScreen(game,rect,game.player.x,game.player.y);
  const world=api.screenToWorld(game,rect,screen.x,screen.y);
  assert.ok(Math.abs(world.x-game.player.x)<1e-8 && Math.abs(world.y-game.player.y)<1e-8);
});
