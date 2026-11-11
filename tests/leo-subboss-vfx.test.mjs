import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const vfxSource = readFileSync(new URL('../public/leo-subboss-vfx.js', import.meta.url),'utf8');
const patternsSource = readFileSync(new URL('../public/boss-attack-patterns.js', import.meta.url),'utf8');
const guardsSource = readFileSync(new URL('../public/leo-subboss-animation.js', import.meta.url),'utf8');
const rendererSource = readFileSync(new URL('../public/js/game/rendering/arena-renderer.js', import.meta.url),'utf8');
const loaderSource = readFileSync(new URL('../public/zodiac-chibi-bosses.js', import.meta.url),'utf8');
const studioSource = readFileSync(new URL('../public/leo-subboss-sprites.html', import.meta.url),'utf8');

const types = new Map([[10,'golem'],[20,'queen'],[30,'demon_king'],[40,'elder_dragon']]);
function boss(room) {
  return { isBoss:true,campaignChapter:1,campaignRoom:room,type:types.get(room),
    x:170,y:180,r:42,hp:100,maxHp:100,atk:18,attackTimer:.6,phaseTimer:0 };
}
function fakeCanvas() {
  const calls=[], balance={count:0};
  const ctx=new Proxy({}, {
    get(obj,key) {
      if (key in obj) return obj[key];
      return (...args)=>{
        calls.push({key,args});
        if(key==='save')balance.count++;
        if(key==='restore')balance.count--;
        assert.ok(balance.count>=0,'Canvas save/restore must balance');
        for(const arg of args) if(typeof arg==='number')
          assert.ok(Number.isFinite(arg),'Canvas coordinates must remain finite');
      };
    },
    set(obj,key,value){obj[key]=value;return true;}
  });
  return {ctx,calls,balance};
}
function load(reduced=false) {
  const sandbox=vm.createContext({
    matchMedia:()=>({matches:reduced}),
    ArtemisCampaignRooms:{applyBossPattern:pattern=>pattern}
  });
  vm.runInContext(vfxSource,sandbox,{filename:'leo-subboss-vfx.js'});
  vm.runInContext(patternsSource,sandbox,{filename:'boss-attack-patterns.js'});
  return sandbox;
}

test('four room/type-specific VFX match original guardian assets, never overwrite other monsters',()=>{
  const g=load(),vfx=g.ArtemisLeoSubBossVFX;
  assert.deepEqual(Object.keys(vfx.colorOf(10)).sort(),['edge','light','main','tint']);
  for(const room of types.keys()){
    const entity=boss(room);
    assert.equal(vfx.eligible(entity),true);
    assert.equal(vfx.eligible({...entity,type:'zodiac_leo'}),false);
    assert.equal(vfx.eligible({...entity,campaignChapter:2}),false);
    assert.equal(vfx.eligible({...entity,campaignRoom:50}),false);
    assert.match(vfx.colorOf(room).main,/^#[0-9a-f]{6}$/);
  }
  assert.equal(vfx.colorOf(50),null);
});

test('warning effect draws real boss shot lanes without changing angles, count or timing',()=>{
  const g=load(),vfx=g.ArtemisLeoSubBossVFX;
  for(const room of types.keys()){
    const entity=boss(room),player={x:360,y:200};
    const plan=g.BossAttackPatterns.plan(entity,player);
    assert.ok(plan.shots.length>0);
    const sourceShots=JSON.stringify(plan.shots);
    const prior=JSON.stringify(entity),canvas=fakeCanvas();
    assert.equal(vfx.drawWarning(canvas.ctx,entity,plan,.5,250,false),true);
    assert.ok(canvas.calls.filter(c=>c.key==='lineTo').length>=plan.shots.length*3);
    assert.equal(canvas.balance.count,0);
    assert.equal(JSON.stringify(plan.shots),sourceShots);
    assert.equal(JSON.stringify(entity),prior);
    entity.attackTimer=.4;
    const synced=fakeCanvas();
    assert.equal(g.BossAttackPatterns.draw(synced.ctx,entity,player,250,false),true);
    assert.equal(synced.balance.count,0);
    assert.ok(synced.calls.some(c=>c.key==='rotate'),'element warning hook is live');
    assert.equal(g.BossAttackPatterns.warningDuration,.75);
  }
});

test('aura appears behind and ahead of authentic sprites with no entity mutation',()=>{
  const g=load(),vfx=g.ArtemisLeoSubBossVFX;
  for(const room of types.keys()){
    const entity=boss(room),before=JSON.stringify(entity),draw=fakeCanvas();
    assert.equal(vfx.drawAura(draw.ctx,entity,125,'attack',3,'behind'),true);
    assert.equal(vfx.drawAura(draw.ctx,entity,125,'attack',5,'front'),true);
    assert.equal(draw.balance.count,0);
    assert.ok(draw.calls.some(c=>c.key==='stroke'));
    assert.equal(JSON.stringify(entity),before);
    assert.equal(vfx.drawAura(draw.ctx,entity,130,'death',1,'front'),false);
  }
});

test('real projectiles receive one elemental visual in chapter 1 boss rooms only',()=>{
  const g=load(),vfx=g.ArtemisLeoSubBossVFX;
  for(const room of types.keys()){
    const e=boss(room),bullet={x:240,y:180,r:7,vx:230,vy:10,trail:[{x:220,y:177},{x:232,y:179}]};
    const game={mode:'campaign',chapter:{id:1},room,enemies:[e],portalOpen:false,lowGfx:false};
    const before=JSON.stringify([e,bullet,game.room]),draw=fakeCanvas();
    assert.equal(vfx.drawBullet(draw.ctx,bullet,500,game),true);
    assert.ok(draw.calls.filter(c=>c.key==='fill').length>=2);
    assert.equal(draw.balance.count,0);
    assert.equal(JSON.stringify([e,bullet,game.room]),before);
    assert.equal(vfx.drawBullet(draw.ctx,bullet,500,{...game,chapter:{id:2}}),false);
    assert.equal(vfx.drawBullet(draw.ctx,bullet,500,{...game,room:50}),false);
    assert.equal(vfx.drawBullet(draw.ctx,bullet,500,{...game,enemies:[]}),false);
    assert.equal(vfx.drawBullet(draw.ctx,bullet,500,{...game,portalOpen:true}),false);
    assert.equal(vfx.drawBullet(draw.ctx,bullet,500,{...game,mode:'endless'}),false);
  }
});

test('reduced motion uses static accents, and unloaded/invalid Canvas falls back safely',()=>{
  const g=load(true),vfx=g.ArtemisLeoSubBossVFX,e=boss(40);
  const a=fakeCanvas(),b=fakeCanvas();
  assert.equal(vfx.drawAura(a.ctx,e,100,'attack',4,'behind'),true);
  assert.equal(vfx.drawAura(b.ctx,e,550,'attack',4,'behind'),true);
  assert.deepEqual(a.calls,b.calls,'reduced-motion animation should not vary by timestamp');
  assert.equal(vfx.drawWarning({},e,{shots:[]},.5,0,false),false);
  assert.equal(vfx.drawBullet({}, {x:1,y:2,r:7},0,{chapter:{id:1},room:40,enemies:[e]}),false);
});

test('production game, warning renderer and admin studio load the same VFX module',()=>{
  assert.match(loaderSource,/leo-subboss-vfx\.js\?v=leo-elemental-20261111/);
  assert.match(guardsSource,/ArtemisLeoSubBossVFX\?\.drawAura\(ctx,enemy,now,action,frame,'behind'\)/);
  assert.match(guardsSource,/ArtemisLeoSubBossVFX\?\.drawAura\(ctx,enemy,now,action,frame,'front'\)/);
  assert.match(patternsSource,/ArtemisLeoSubBossVFX\?\.drawWarning\(c,e,next,charge,now,quiet\)/);
  assert.match(rendererSource,/ArtemisLeoSubBossVFX\?\.drawBullet\(ctx,eb,now,Game\)/);
  assert.match(studioSource,/leo-subboss-vfx\.js/);
  assert.match(studioSource,/effects\?\.drawAura\(ctx,stageEnemy,now,v.action,frame,'behind'\)/);
  assert.doesNotMatch(vfxSource,/fetch\(|localStorage|enemy\.hp\s*=|bullet\.dmg\s*=|attackTimer\s*=/);
});
