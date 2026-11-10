// Renderer production trong VM; không mạng, DB hay save người chơi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load({ reduced = false, broken = false } = {}) {
  const requests = [];
  class Image {
    constructor() { this.complete = true; this.naturalWidth = broken ? 0 : 2048; }
    set src(value) { requests.push(value); this._src = value; if (broken) this.onerror?.(); }
  }
  const c = vm.createContext({ Image, matchMedia: () => ({ matches: reduced }) });
  c.window = c;
  const file = new URL('../public/campaign-pixelfx.js', import.meta.url);
  assert.ok(fs.existsSync(file), 'cần renderer Pixelfx dùng chung cho sân và bản đồ chương');
  vm.runInContext(fs.readFileSync(file, 'utf8'), c);
  return { fx: c.ArtemisPixelFX, requests, c };
}
function canvas() {
  const calls = []; let depth = 0;
  return { calls, depth: () => depth, ctx: {
    globalAlpha: 0.7, imageSmoothingEnabled: true,
    save() { depth++; this.alpha = this.globalAlpha; },
    restore() { depth--; this.globalAlpha = this.alpha; },
    drawImage(...args) { calls.push(args); assert.ok(args.slice(1).every(Number.isFinite)); },
  } };
}

test('Pixelfx atlas vẽ theo thời gian, giữ nguyên Game và trạng thái canvas', () => {
  const { fx, c } = load();
  c.ArtemisPixelFXAtlas = { torch: { src: '/assets/pixelfx/torch.png', width: 72, height: 120, columns: 8, frames: 24, fps: 12 } };
  const spy = canvas(), state = { room: 1, lowGfx: false, enemies: [{ hp: 10 }] }, before = JSON.stringify(state);
  assert.equal(fx.drawSprite(spy.ctx, 'torch', 10, 20, 72, 120, 0, .8), true);
  assert.equal(fx.drawSprite(spy.ctx, 'torch', 10, 20, 72, 120, 1000, .8), true);
  assert.notDeepEqual(spy.calls[0].slice(1, 3), spy.calls[1].slice(1, 3));
  assert.equal(spy.depth(), 0); assert.equal(spy.ctx.globalAlpha, .7);
  assert.equal(JSON.stringify(state), before);
});

test('chế độ nhẹ/giảm chuyển động không tải atlas; lỗi ảnh không tải lặp', () => {
  for (const reduced of [false, true]) {
    const { fx, c, requests } = load({ reduced });
    c.ArtemisPixelFXAtlas = { fog: { src: '/fog.png', width: 160, height: 90, columns: 8, frames: 96, fps: 8 } };
    const spy = canvas();
    assert.equal(fx.drawAtmosphere(spy.ctx, 800, 600, 24, 1000, { lowGfx: !reduced }, { ambient: 'dust' }), false);
    assert.equal(requests.length, 0);
  }
  const { fx, c, requests } = load({ broken: true });
  c.ArtemisPixelFXAtlas = { torch: { src: '/missing.png', width: 72, height: 120, columns: 8, frames: 24, fps: 12 } };
  for (let i = 0; i < 5; i++) assert.equal(fx.drawSprite(canvas().ctx, 'torch', 0, 0, 72, 120, 1000), false);
  assert.equal(requests.length, 1);
});

test('khí quyển chọn effect theo biome, không sửa gameplay và không dùng trong mode khác', () => {
  const { fx, c } = load();
  c.ArtemisPixelFXAtlas = Object.fromEntries(['leaves', 'rays', 'snow', 'fog', 'aurora'].map(id => [id,
    { src: '/' + id + '.png', width: 160, height: 90, columns: 8, frames: 96, fps: 8 }]));
  const g = { mode: 'campaign', room: 8, enemies: [{ hp: 900 }], obstacles: [{ x: 99, y: 87 }] }, before = JSON.stringify(g);
  for (const ambient of ['fireflies', 'snow', 'stars', 'dust']) {
    const spy = canvas();
    assert.equal(fx.drawAtmosphere(spy.ctx, 800, 600, 24, 1000, g, { ambient }), true);
    assert.ok(spy.calls.length >= 1 && spy.calls.length <= 2);
    assert.equal(spy.depth(), 0);
  }
  assert.equal(JSON.stringify(g), before);
  assert.equal(fx.drawAtmosphere(canvas().ctx, 800, 600, 24, 1000, { mode: 'arena' }, { ambient: 'stars' }), false);
});

test('renderer sân production gọi Pixelfx, vẫn giữ lớp nền biome và fallback', () => {
  const renderer = fs.readFileSync(new URL('../public/js/game/rendering/arena-renderer.js', import.meta.url), 'utf8');
  for (const hook of ['drawAtmosphere', 'drawTorch', 'drawPortal']) assert.ok(renderer.includes('ArtemisPixelFX?.' + hook), hook);
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('src="/campaign-pixelfx.js"') < html.indexOf('src="/js/game/rendering/arena-renderer.js"'));
});

test('bản đồ đảo có hiệu ứng inert, theo dõi vùng nhìn thấy và giữ khóa chương', () => {
  const map = fs.readFileSync(new URL('../public/campaign-world-map.js', import.meta.url), 'utf8');
  assert.ok(map.includes('world-map-effect'));
  assert.ok(map.includes('IntersectionObserver'));
  assert.ok(map.includes("setAttribute('aria-hidden','true')"));
  assert.ok(map.includes("original.click()"));
  assert.ok(map.includes("original.dataset.locked !== '1'"));
  const css = fs.readFileSync(new URL('../public/campaign-pixelfx.css', import.meta.url), 'utf8');
  for (const rule of ['pointer-events:none', 'prefers-reduced-motion', 'battle-motion-low', 'is-fx-visible', 'combat-immersive']) assert.ok(css.includes(rule), rule);
});

test('đuốc/cổng giữ fallback và không thay hình học; cache ảnh tối đa 4 atlas', () => {
  const { fx, c, requests } = load();
  c.ArtemisPixelFXAtlas = Object.fromEntries(['torch','portal','fog','snow','rays','aurora'].map(id => [id,
    { src: '/' + id + '.png', width: 152, height: 116, columns: 8, frames: 36, fps: 15 }]));
  const game = { mode:'campaign',portalOpen:false }, rect = {x:30,y:40,w:40,h:60}, before = JSON.stringify(rect);
  const spy = canvas();
  assert.equal(fx.drawPortal(spy.ctx,rect,1000,game),false);
  assert.equal(requests.length,0);
  assert.equal(fx.drawTorch(spy.ctx,{x:50,y:60,phase:0},1000,game,{torchStyle:'crystal'}),false);
  assert.equal(fx.drawTorch(spy.ctx,{x:50,y:60,phase:0},1000,game,{torchStyle:'flame'}),true);
  game.portalOpen = true;
  assert.equal(fx.drawPortal(spy.ctx,rect,1000,game),true);
  assert.equal(JSON.stringify(rect),before);
  for(const id of ['fog','snow','rays','aurora']) fx.drawSprite(spy.ctx,id,0,0,152,116,1000);
  const count = requests.length;
  fx.drawSprite(spy.ctx,'torch',0,0,152,116,1000);
  assert.equal(requests.length,count+1,'atlas cũ đã được đẩy khỏi cache giới hạn');
  assert.equal(fx.drawSprite(spy.ctx,'unknown',0,0,152,116,1000),false);
  assert.equal(fx.drawSprite(spy.ctx,'torch',NaN,0,152,116,1000),false);
  assert.equal(spy.depth(),0);
});

test('module Pixelfx chạy trong renderer production cho mọi chương/phòng, cân bằng canvas và bất biến Game', () => {
  const { c } = load();
  vm.runInContext(fs.readFileSync(new URL('../public/campaign-pixelfx-atlas.js',import.meta.url),'utf8'),c);
  const gradient = {addColorStop(){}};
  let depth = 0, draws = 0;
  const ctx = new Proxy({globalAlpha:1,
    save(){depth++;},restore(){assert.ok(--depth>=0);},
    drawImage(...args){draws++;assert.ok(args.slice(1).every(Number.isFinite));},
    createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},
  },{get:(o,k)=>k in o?o[k]:(...args)=>assert.ok(args.every(v=>typeof v!=='number'||Number.isFinite(v))),set:(o,k,v)=>{o[k]=v;return true;}});
  c.document={createElement(){return {getContext:()=>ctx};},getElementById(){return null;}};
  vm.runInContext(fs.readFileSync(new URL('../public/js/game/rendering/arena-renderer.js',import.meta.url),'utf8'),c);
  for(let chapter=1;chapter<=19;chapter++) for(const room of [1,2,10,50]) {
    const g={mode:'campaign',chapter:{id:chapter},room,maxRooms:50,width:800,height:600,lowGfx:false,
      floorDecals:[],wallTorches:[{x:60,y:55,phase:0}],obstacles:[],enemies:[],portalOpen:true,portalRect:{x:370,y:30,w:60,h:60}};
    const before=JSON.stringify(g), renderer=c.ArtemisArenaRenderer.create(), count=draws;
    renderer.init(g);renderer.drawArena(ctx,800,600,24,1200,chapter);
    assert.ok(draws>count+1,`ch${chapter}/r${room}: có nền và hiệu ứng`);
    assert.equal(depth,0);assert.equal(JSON.stringify(g),before);
  }
});
