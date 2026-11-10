import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function load() {
  const s = {}; vm.createContext(s);
  for (const name of ['arena-viewport', 'enemy-pressure', 'boss-attack-patterns']) {
    const path = new URL(`../public/${name}.js`, import.meta.url);
    assert.ok(fs.existsSync(path), `${name} exists`);
    vm.runInContext(fs.readFileSync(path, 'utf8'), s);
  }
  return s;
}
const enemy = (type = 'goblin') => ({type, hp:100, atk:10, x:240, y:400, r:20});
test('room framing is compact or expansive with finite reversible camera and fixed physics', () => {
  const {ArtemisArenaViewport:a}=load();
  const g={room:1};a.beginRun(g);g.player={x:240,y:1050};
  const portal=g.portalRect;
  assert.equal(a.roomFraming(g).occupancy,.78);
  let applied;const ctx={canvas:{width:960,height:1706},setTransform(...args){applied=args;}};
  a.applyViewportTransform(ctx,g);
  assert.equal(applied[0],2);assert.equal(applied[4],0);assert.equal(applied[5],0);
  const el={style:{setProperty(k,v){this[k]=v;}},dataset:{}};a.syncFrame(g,el);
  assert.equal(el.style['--arena-frame-height'],'78dvh');
  g.room=10;assert.equal(a.roomFraming(g).occupancy,.93);
  for (const room of [1,2,5,10,15,20,49,50]) {
    g.room=room;
    for(const y of [60,600,1140]) {
      g.player.y=y;
      const c=a.camera(g,room*100);
      assert.ok(Object.values(c).every(Number.isFinite));
      assert.ok(c.x>=0 && c.y>=0 && c.x+c.width<=480.000001 && c.y+c.height<=1200.000001);
      const rect={left:10,top:20,width:360,height:640};
      const q=a.worldToScreen(g,rect,240,y),p=a.screenToWorld(g,rect,q.x,q.y);
      assert.ok(Math.abs(p.x-240)<1e-7 && Math.abs(p.y-y)<1e-7);
      a.fitLayout(320,568,g.width,g.height);a.fitLayout(1920,1080,g.width,g.height);
      assert.equal(g.width,480);assert.equal(g.height,1200);assert.equal(g.portalRect,portal);
    }
  }
});
test('runtime locks warnings before firing, limits pressure and cancels dead or safe sources', () => {
  const {ArtemisEnemyPressure:a}=load();
  const g={room:1,running:true,player:{x:240,y:650},enemies:Array.from({length:8},()=>enemy()),enemyBullets:[]};
  a.prepareRoom(g);let now=0;const events=[];
  const spawn=(...args)=>{events.push({now,args});g.enemyBullets.push({});};
  for(let i=0;i<15;i++){now+=.1;a.update(g,.1,spawn);}
  assert.equal(events.length,0,'initial delay plus complete warning');
  for(let i=0;i<200;i++){now+=.1;a.update(g,.1,spawn);}
  assert.ok(events.length>0 && events.length<=64);
  assert.ok(events[0].now>=1.55);
  assert.ok(events.every(e=>e.args.length===7 && e.args[6].hp>0));
  g.room=5;a.update(g,.1,spawn);assert.equal(g.enemies.length,0);assert.equal(g.enemyBullets.length,0);
  const dead=enemy();g.room=2;g.enemies=[dead];a.prepareRoom(g);
  for(let i=0;i<12;i++)a.update(g,.1,spawn);
  dead.hp=0;const count=events.length;
  for(let i=0;i<100;i++)a.update(g,.1,spawn);
  assert.equal(events.length,count);
});
test('boss warnings freeze their target and require a warning even when initial timer is overdue', () => {
  const {BossAttackPatterns:a}=load(),e={...enemy('golem'),isBoss:true,maxHp:100,phaseTimer:0,attackTimer:-.1};
  const p={x:240,y:650};const bullets=[];
  assert.equal(a.fire(e,p,(...s)=>bullets.push(s)),false);
  assert.equal(bullets.length,0);assert.ok(e.attackTimer>=.65);
  e.attackTimer=.4;
  const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});a.draw(ctx,e,p,1000,false);
  p.x=450;e.attackTimer=0;
  assert.equal(a.fire(e,p,(...s)=>bullets.push(s)),true);
  assert.ok(bullets.length>0);
  assert.ok(bullets.every(s=>s.every(Number.isFinite)));
  const expected=a.plan({...e,phaseTimer:0},{x:240,y:650});
  assert.equal(bullets[0][2],expected.shots[0].angle,'fire keeps the announced angle after player dodges');
});
test('size hook grows the collision radius and warning snapshot stays fixed while player moves', () => {
  const {ArtemisEnemyPressure:a}=load();
  for(const type of Object.keys(a.profiles)) assert.ok(a.sizeMultiplier(type)>1.2 && a.sizeMultiplier(type)<1.5);
  const e=enemy(),g={room:1,player:{x:240,y:650},enemies:[e],enemyBullets:[]};
  a.prepareRoom(g);let shot;
  for(let i=0;i<9;i++)a.update(g,.1,(...s)=>shot=s);
  g.player.x=10;
  for(let i=0;i<9;i++)a.update(g,.1,(...s)=>{shot??=s;});
  assert.equal(shot[2],Math.PI/2,'burst aims where warning began, not where dodge ended');
  const frozen=shot.slice(0,6);
  assert.ok(frozen.every(Number.isFinite));
});
test('each archetype has deterministic bounded readable pressure independent of account', () => {
  const {ArtemisEnemyPressure: a} = load();
  assert.ok(Object.keys(a.profiles).length >= 17);
  for (const type of Object.keys(a.profiles)) for (let cycle=0;cycle<12;cycle++) {
    const e=enemy(type), p={x:240,y:650};
    const plan=a.plan(e,p,{room:12,cycle});
    assert.equal(JSON.stringify(plan),JSON.stringify(a.plan(e,{...p,atk:999999,vip:99},{room:12,cycle})));
    assert.ok(plan.warning >= .65 && plan.warning <= .9);
    assert.ok(plan.cooldown >= 1.35 && plan.cooldown <= 2.5);
    assert.ok(plan.cooldown-plan.warning >= .65);
    assert.ok(plan.shots.length >= 1 && plan.shots.length <= 8);
    for (const shot of plan.shots) {
      assert.ok(Object.values(shot).every(Number.isFinite));
      assert.ok(shot.speed>=190 && shot.speed<=290);
      assert.ok(shot.delay>=0 && shot.delay<=.3);
    }
  }
  for (const room of [5,15,25,35,45]) assert.equal(a.plan(enemy(),{x:1,y:1},{room}),null);
  assert.equal(a.plan({...enemy(),x:NaN},{x:1,y:1}),null);
});
