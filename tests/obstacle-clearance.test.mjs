import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../public/obstacle-clearance.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const globals={window:{}};
vm.runInNewContext(code,globals);
const geo=globals.window.ArtemisObstacleClearance;
const opts={width:780,height:420,wallPad:36};
const cover=[
  {x:96,y:115,w:62,h:54},
  {x:326,y:140,w:62,h:55},
  {x:530,y:125,w:68,h:62},
  {x:229,y:195,w:49,h:46}
];
function valid(e,blocks=cover) {
  assert.ok(geo.isFree(e.x,e.y,e.r,blocks,opts),
    'Monster intersects wall/visible cover at '+JSON.stringify(e));
}
test('image-aware cover clearance extends above tall columns and mushrooms',()=>{
  assert.ok(geo.visualPadding.top>=30,'tall cover requires top overhang');
  const ob={x:100,y:150,w:65,h:60};
  assert.equal(geo.overlapsObstacle(132,116,16,ob),true);
  assert.equal(geo.overlapsObstacle(132,80,16,ob),false);
  assert.equal(geo.overlapsObstacle(132,170,16,ob),true);
});
test('spawn repairs points inside props and near margins, including stationary turrets',()=>{
  const sourcePoints=[[100,120],[330,151],[550,119],[247,210],[35,35],[740,400],[370,96]];
  for(const r of [13,14,16,17,19,20,34]) {
    for(const [x,y] of sourcePoints) {
      const p=geo.findSafeSpawn(x,y,r,cover,opts);
      assert.ok(p, 'No spawn for '+x+','+y+', r='+r);
      valid({...p,r});
    }
  }
  const turret={x:336,y:166,r:20};
  assert.equal(geo.resolveEntity(turret,cover,opts),true);
  valid(turret);
});
test('repeated random wave spawns never intersect cover, bounds, or hero',()=>{
  let seed=493;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  for(let chapter=1;chapter<=19;chapter++){
    const enemies=[];
    const player={x:390,y:325,r:18};
    for(let i=0;i<8;i++){
      const r=[13,14,16,17,19,20][i%6];
      const point=geo.findSafeSpawn(75+random()*630,75+random()*155,r,cover,
        {...opts,player,others:enemies,enemyGap:8,playerGap:18});
      assert.ok(point, 'Missing spawn chapter '+chapter+' enemy '+i);
      const e={...point,r};valid(e);
      assert.ok(Math.hypot(e.x-player.x,e.y-player.y)>r+18);
      enemies.push(e);
    }
  }
});
test('enemy movement slides along obstacles and never tunnels through cover',()=>{
  for(let radius of [13,16,20,34]) {
    for(let j=0;j<20;j++){
      const e={x:90+j*20,y:94,r:radius};
      assert.equal(geo.resolveEntity(e,cover,opts),true);valid(e);
      for(let i=0;i<180;i++){
        const a=(i*17+j*31)*Math.PI/180;
        geo.moveEntity(e,Math.cos(a)*23,Math.sin(a)*23,cover,opts);
        valid(e);
      }
    }
  }
  const e={x:230,y:120,r:16};
  const block=[{x:335,y:100,w:8,h:90}];
  geo.moveEntity(e,350,0,block,opts);
  assert.ok(e.x<335-geo.visualPadding.left-e.r,
    'fast monster tunneled through thin obstacle');
  valid(e,block);
});
test('knockback into a prop is rescued and all collision hooks are wired into game',()=>{
  const e={x:120,y:133,r:17};
  assert.equal(geo.resolveEntity(e,cover,opts),true);
  valid(e);
  assert.match(html,/<script src="\/obstacle-clearance\.js"><\/script>/);
  assert.match(html,/ArtemisObstacleClearance\.findSafeSpawn\(ex, ey, enemyRadius/);
  assert.match(html,/ArtemisObstacleClearance\.moveEntity\(e, e\.vx \* dt, e\.vy \* dt/);
  assert.match(html,/ArtemisObstacleClearance\.resolveEntity\(e, Game\.obstacles/);
  assert.match(html,/if \(!safePos\) throw new Error/);
});
