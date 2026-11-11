import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/leo-subboss-animation.js',import.meta.url),'utf8');
function ctx(){
  const draws=[];let depth=0;
  const c={draws,save(){depth++;},restore(){depth--;assert.ok(depth>=0);},
    translate(){},drawImage(...args){draws.push(args);},get depth(){return depth;}};
  return c;
}
function fixture(loaded=true){
  const urls=[],links=[],canvases=[];
  class ImageMock{
    constructor(){this.complete=loaded;this.naturalWidth=loaded?1152:0;this.naturalHeight=loaded?768:0;}
    set src(value){urls.push(value);if(loaded)this.onload?.();else this.onerror?.();}
  }
  class CanvasMock{
    constructor(){this.width=0;this.height=0;this.ctx=ctx();}
    getContext(){return this.ctx;}
    toDataURL(type){assert.equal(type,'image/png');return 'data:image/png;base64,example';}
  }
  const window={Image:ImageMock,document:{createElement(name){
    if(name==='a')return {click(){links.push(this.download);}};
    assert.equal(name,'canvas');const canvas=new CanvasMock();canvases.push(canvas);return canvas;
  }}};
  vm.runInNewContext(source,{window});
  return {api:window.ArtemisLeoSubBossSprites,urls,links,canvases};
}
const boss=(room=10,type='golem')=>({isBoss:true,campaignChapter:1,
  campaignRoom:room,type,r:48,x:200,y:150,hp:100,maxHp:100,attackTimer:1.2,hitFlashTimer:0});

test('only the four original chapter 1 boss entity types use imported sprite art',()=>{
  const {api}=fixture();
  const expected=[[10,'golem','Ares'],[20,'queen','Boreas'],[30,'demon_king','Terra'],[40,'elder_dragon','Nyx']];
  assert.equal(Object.keys(api.BOSSES).length,4);
  for(const [room,type,name] of expected){
    assert.equal(api.eligible(boss(room,type)),true);
    assert.ok(api.BOSSES[room].name.startsWith(name));
    assert.equal(api.eligible({...boss(room,type),campaignChapter:2}),false);
    assert.equal(api.eligible({...boss(room,type),type:'zodiac_leo'}),false);
    assert.equal(api.eligible({...boss(room,type),isBoss:false}),false);
    assert.equal(api.isReady(room),true);
    assert.match(api.BOSSES[room].path,/^\/assets\/leo-guardians\/(ares|boreas|terra|nyx)\.png$/);
  }
  assert.equal(api.eligible(boss(50,'zodiac_leo')),false);
  assert.equal(api.eligible(boss(9,'golem')),false);
});

test('all four states crop the right frame rows from actual 6x4 PNG atlases',()=>{
  const {api,urls}=fixture(),c=ctx();
  assert.deepEqual(Object.keys(api.ACTIONS),['idle','attack','hit','death']);
  const def=[['idle',6,0],['attack',6,1],['hit',4,2],['death',6,3]];
  def.forEach(([action,count,row])=>{
    assert.equal(api.ACTIONS[action].count,count);
    assert.equal(api.drawFrame(c,20,action,count-1,42),true);
    const params=c.draws.at(-1);
    assert.equal(params[1],(count-1)*192);
    assert.equal(params[2],row*192);
    assert.equal(params[3],192);
    assert.equal(params[4],192);
  });
  assert.equal(urls.length,1,'image must load and cache once per boss');
  assert.equal(api.frameAt('idle',6*170),0);
  assert.equal(api.frameAt('death',99999),5);
});

test('gameplay signals drive Idle, Attack, Hit, Death without mutating the entity',()=>{
  const {api}=fixture(),c=ctx(),e=boss(),original=JSON.parse(JSON.stringify(e));
  assert.equal(api.drawEntity(c,e,100),true);
  assert.equal(c.draws.at(-1)[2],0);
  e.attackTimer=.5;
  assert.equal(api.drawEntity(c,e,200),true);
  assert.equal(api.drawEntity(c,e,420),true);
  assert.equal(c.draws.at(-1)[1],2*192);
  assert.equal(c.draws.at(-1)[2],192);
  e.hitFlashTimer=.12;
  api.drawEntity(c,e,450);
  api.drawEntity(c,e,550);
  assert.equal(c.draws.at(-1)[2],2*192);
  assert.equal(c.draws.at(-1)[1],192);
  e.hp=0;
  api.drawEntity(c,e,850);
  api.drawEntity(c,e,1900);
  assert.equal(c.draws.at(-1)[2],3*192);
  assert.equal(c.draws.at(-1)[1],5*192);
  assert.equal(c.depth,0);
  assert.deepEqual(JSON.parse(JSON.stringify(e)),{...original,attackTimer:.5,hitFlashTimer:.12,hp:0});
});

test('sprite death afterimage remains in the defeated boss room only',()=>{
  const {api}=fixture(),c=ctx(),e=boss(30,'demon_king');
  assert.equal(api.drawEntity(c,e,1000),true);
  const game={chapter:{id:1},room:30,enemies:[],portalOpen:true};
  assert.equal(api.drawDeathAfterRemoval(c,game,1050),true);
  assert.equal(c.draws.at(-1)[2],3*192);
  assert.equal(api.drawDeathAfterRemoval(c,{...game,chapter:{id:2}},1060),false);
  assert.equal(api.drawDeathAfterRemoval(c,{...game,room:40},1100),false);
  assert.equal(c.depth,0);
});

test('missing images use existing vector fallback; Studio exports real sprite rows',()=>{
  const broken=fixture(false),e=boss();
  assert.equal(broken.api.drawEntity(ctx(),e,100),false);
  assert.equal(broken.api.buildAtlas(10,'idle'),null);
  const {api,canvases,links}=fixture(true);
  const a=api.buildAtlas(40,'attack');
  assert.equal(a.width,6*192);assert.equal(a.height,192);
  assert.equal(a.ctx.draws.at(-1)[2],1*192);
  assert.match(api.pngDataUrl(40,'idle'),/^data:image\/png/);
  assert.equal(api.downloadPng(40,'death'),true);
  assert.deepEqual(links,['leo-nyx-death.png']);
  assert.ok(canvases.length>=3);
});

test('every production PNG has the RGBA-capable transparent sheet contract',()=>{
  for(const name of ['ares','boreas','terra','nyx']){
    const file=fs.readFileSync(new URL('../public/assets/leo-guardians/'+name+'.png',import.meta.url));
    assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(file.readUInt32BE(16),1152);
    assert.equal(file.readUInt32BE(20),768);
    assert.ok([3,6].includes(file[25]),'palette or RGBA PNG');
    assert.ok(file.includes(Buffer.from('tRNS')) || file[25]===6,'transparency is present');
    assert.ok(file.length>50_000);
  }
});

test('renderer and Admin Sprite Studio use the new real image pipeline',()=>{
  const renderer=fs.readFileSync(new URL('../public/js/game/rendering/arena-renderer.js',import.meta.url),'utf8');
  const zodiac=fs.readFileSync(new URL('../public/zodiac-chibi-bosses.js',import.meta.url),'utf8');
  const studio=fs.readFileSync(new URL('../public/leo-subboss-sprites.html',import.meta.url),'utf8');
  assert.match(renderer,/ArtemisLeoSubBossSprites\.drawEntity\(c, e, t, drawLeoSubBoss\)/);
  assert.match(renderer,/ArtemisLeoSubBossSprites\.drawDeathAfterRemoval\(ctx, Game, nowMs, drawLeoSubBoss\)/);
  assert.match(zodiac,/leo-subboss-animation\.js/);
  assert.match(studio,/downloadPng\(b.room,view.action,painter\)/);
  assert.match(studio,/Attack: 6 khung/);
});
