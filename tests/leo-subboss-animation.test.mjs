import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../public/leo-subboss-animation.js', import.meta.url),'utf8');
const renderer = fs.readFileSync(new URL('../public/js/game/rendering/arena-renderer.js', import.meta.url),'utf8');
const zodiac = fs.readFileSync(new URL('../public/zodiac-chibi-bosses.js', import.meta.url),'utf8');
function context(){
  const draws=[];let depth=0;
  const c = new Proxy({draws,filter:'none'},{
    get(target,prop){
      if(prop==='save')return ()=>{depth++;};
      if(prop==='restore')return ()=>{depth--;assert.ok(depth>=0);};
      if(prop==='drawImage')return (...args)=>draws.push(args);
      if(prop==='depth')return depth;
      if(prop in target)return target[prop];
      return ()=>{};
    },
    set(target,key,value){target[key]=value;return true;}
  });
  return c;
}
function fixture(available=true){
  const canvases=[];
  const links=[];
  class Canvas{
    constructor(){this.width=0;this.height=0;this.ctx=context();}
    getContext(){return available?this.ctx:null;}
    toDataURL(type){assert.equal(type,'image/png');return 'data:image/png;base64,example';}
  }
  const window={document:{createElement(tag){
    if(tag==='a'){const a={click(){links.push(this.download);}};return a;}
    assert.equal(tag,'canvas');
    const c=new Canvas();canvases.push(c);return c;
  }}};
  vm.runInNewContext(script,{window});
  const painterCalls=[];
  const painter=(c,e,ms)=>{
    painterCalls.push({e:{...e},ms});
    c.beginPath();c.ellipse(0,0,20,20,0,0,Math.PI*2);c.fill();
    return true;
  };
  return {api:window.ArtemisLeoSubBossSprites,canvases,links,painter,painterCalls};
}
function boss(room=10,type='golem'){
  return {isBoss:true,campaignChapter:1,campaignRoom:room,type,r:48,
    x:200,y:150,hp:100,maxHp:100,attackTimer:1.2,hitFlashTimer:0};
}

test('Sprite guard is strictly chapter 1 / four Leo lieutenant rooms / original enemy types',()=>{
  const {api}=fixture(),expected=[[10,'golem'],[20,'queen'],[30,'demon_king'],[40,'elder_dragon']];
  assert.equal(Object.keys(api.BOSSES).length,4);
  for(const [room,type] of expected){
    assert.equal(api.eligible(boss(room,type)),true);
    assert.equal(api.eligible({...boss(room,type),campaignChapter:2}),false);
    assert.equal(api.eligible({...boss(room,type),type:'zodiac_leo'}),false);
    assert.equal(api.eligible({...boss(room,type),isBoss:false}),false);
  }
  assert.equal(api.eligible(boss(50,'zodiac_leo')),false);
  assert.equal(api.eligible(boss(9,'golem')),false);
});

test('Every action bakes independent transparent 192px atlas cells, reusing cached frames',()=>{
  const {api,canvases,painter,painterCalls}=fixture();
  assert.deepEqual(Object.keys(api.ACTIONS),['idle','attack','hit','death']);
  const counts=[6,8,4,6];
  Object.keys(api.ACTIONS).forEach((action,i)=>{
    const atlas=api.buildAtlas(20,action,painter);
    assert.equal(atlas.width,192*counts[i]);
    assert.equal(atlas.height,192);
    assert.equal(api.buildAtlas(20,action,painter),atlas);
  });
  assert.equal(canvases.length,4);
  assert.equal(painterCalls.length,24);
  assert.ok(painterCalls.every(x=>x.e.type==='queen' && x.e.campaignChapter===1 && x.e.campaignRoom===20));
  assert.equal(api.frameAt('idle',1020),0);
  assert.equal(api.frameAt('death',99999),5);
});

test('Idle → Attack → Hit → Death choose correct frames without changing game entity',()=>{
  const {api,painter}=fixture(),c=context(),e=boss(),expected=JSON.stringify(e);
  assert.equal(api.drawEntity(c,e,100,painter),true);
  assert.equal(c.draws.at(-1)[1],0);
  e.attackTimer=.5;
  assert.equal(api.drawEntity(c,e,200,painter),true);
  assert.equal(api.drawEntity(c,e,400,painter),true);
  assert.equal(c.draws.at(-1)[1],2*192);
  e.hitFlashTimer=.12;
  assert.equal(api.drawEntity(c,e,450,painter),true);
  assert.equal(api.drawEntity(c,e,550,painter),true);
  assert.equal(c.draws.at(-1)[1],192);
  e.hp=0;
  assert.equal(api.drawEntity(c,e,850,painter),true);
  assert.equal(api.drawEntity(c,e,1900,painter),true);
  assert.equal(c.draws.at(-1)[1],5*192);
  assert.equal(c.depth,0);
  const unchanged=JSON.parse(expected);
  assert.deepEqual(JSON.parse(JSON.stringify(e)),{...unchanged,attackTimer:.5,hitFlashTimer:.12,hp:0});
});

test('Removed boss retains room-scoped death afterimage and never crosses chapters',()=>{
  const {api,painter}=fixture(),c=context(),e=boss(30,'demon_king');
  api.drawEntity(c,e,1000,painter);
  const game={chapter:{id:1},room:30,enemies:[],portalOpen:true};
  assert.equal(api.drawDeathAfterRemoval(c,game,1050,painter),true);
  assert.equal(api.drawDeathAfterRemoval(c,{...game,chapter:{id:2}},1060,painter),false);
  assert.equal(api.drawDeathAfterRemoval(c,{...game,room:40},1100,painter),false);
  assert.equal(c.depth,0);
});

test('Studio can export PNG sprites, while Canvas failure keeps native renderer fallback',()=>{
  const {api,painter,links}=fixture();
  assert.match(api.pngDataUrl(40,'idle',painter),/^data:image\/png/);
  assert.equal(api.downloadPng(40,'attack',painter),true);
  assert.deepEqual(links,['leo-guard-40-attack.png']);
  const broken=fixture(false);
  assert.equal(broken.api.drawEntity(context(),boss(),100,broken.painter),false);
});

test('Real game renderer, shared zodiac script and standalone studio are wired',()=>{
  assert.match(renderer,/ArtemisLeoSubBossSprites\.drawEntity\(c, e, t, drawLeoSubBoss\)/);
  assert.match(renderer,/drawLeoSubBoss\(ctx, e, nowMs, true\)/);
  assert.match(renderer,/ArtemisLeoSubBossSprites\.drawDeathAfterRemoval\(ctx, Game, nowMs, drawLeoSubBoss\)/);
  assert.match(zodiac,/leo-subboss-animation\.js/);
  const studio=fs.readFileSync(new URL('../public/leo-subboss-sprites.html',import.meta.url),'utf8');
  assert.match(studio,/downloadPng\(b.room,view.action,painter\)/);
  assert.match(studio,/requestAnimationFrame\(tick\)/);
});
