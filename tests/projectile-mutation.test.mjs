// VM ngoại tuyến: updateGame, sát thương và kill thật; không mạng/DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { loadCampaignDependencies } from './fixtures/campaign-vm.mjs';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
// Opt-in chỉ đọc git để chứng minh cùng regression trên mã trước bản sửa.
const html = (process.env.PROJECTILE_SOURCE_REV
  ? execFileSync('git', ['show', `${process.env.PROJECTILE_SOURCE_REV}:public/index.html`], {cwd:new URL('..', import.meta.url),encoding:'utf8',maxBuffer:4*1024*1024})
  : read('public/index.html')).replace(/\r\n/g, '\n');
function fn(name) {
  const start = html.indexOf(`function ${name}(`);
  const end = html.indexOf('\n      }', start);
  assert.ok(start >= 0 && end > start, name);
  return html.slice(start, end + '\n      }'.length);
}
function fixture() {
  const p = {x:300,y:500,r:12,hp:1000,maxHp:1000,atk:100,critRate:0,skills:{},hero:{id:'alex'},weapon:{color:'#fff'},attackCooldown:10000,facingAngle:0};
  const Game = {player:p,mode:'campaign',chapter:{id:1},room:1,maxRooms:50,width:600,height:800,wallPad:24,keys:{},joy:{active:false},pet:{x:300,y:530,cooldown:10000},enemies:[],obstacles:[],kills:0,running:true,runGold:0};
  for (const k of ['playerBullets','enemyBullets','drops','swords','meteors','artemisHawks','particles','shockwaves','lightningBolts','ambientMotes','afterimages','muzzleFlashes','floorDecals','floatTexts']) Game[k]=[];
  const S={talents:{},runes:{},equippedRuneSlots:{ability:[],etched:[],blessing:[],enhancement:[]},gold:123,save(){}};
  const noop=()=>{};
  const c=vm.createContext({Game,SaveState:S,Math:Object.create(Math),performance:{now:()=>1000},getActiveResonanceHeroIds:()=>({}),getHeroStarLevel:()=>0,getActiveHeroSkin:()=>({}),getEquippedSetCounts:()=>({}),updateInGameHUD:noop,spawnFloatText:noop,spawnParticles:noop,spawnShockwave:noop,spawnSkyLaser:noop,spawnFloorDecal:noop,spawnShatterShards:noop,spawnCombatSlashAndSparks:noop,bumpLifetimeStat:noop,setLifetimeStatMax:noop,recordBestiaryKill:noop,checkAchievements:noop,showRoomClearOverlay:noop,saveCheckpoint:noop,syncContinueButton:noop,spawnCampaignValkyrie:noop,hurtPlayer:noop,document:{getElementById:()=>({textContent:''})},SoundFX:{hitEnemy:noop,enemyDeath:noop,portalOpen:noop},ArtemisObstacleClearance:{moveEntity(e,x,y){e.x+=x;e.y+=y;},resolveEntity:noop},RuneEconomy:{copies:v=>Number(v)||0}});
  c.window=c;
  loadCampaignDependencies(c);
  for(const file of ['rune-wiki-data.js','js/game/runes/rune-modifiers.js','combat-status.js','combat-damage.js']) vm.runInContext(read('public/'+file),c,{filename:file});
  c.Math.random=()=>.99;
  c.collidesObstacle=()=>false;
  vm.runInContext(['hasHeroSkillActive','runeOwned','getEquippedRuneSlots','isRuneEquipped','runeHasEffect','getCombatSourceData','applyEnemyCombatHit','dealEnemySecondaryDamage','getCombatElementalMultiplier','findNearestEnemy','damageEnemy','onEnemyKilled','spawnEnemyBullet','updateGame'].map(fn).join('\n'),c,{filename:'production-projectiles.js'});
  const enemy=(extra={})=>{const e={x:100,y:100,r:14,hp:10,maxHp:10,atk:10,type:'goblin',speed:0,vx:0,vy:0,attackTimer:10000,...extra};Game.enemies.push(e);return e;};
  const bullet=(extra={})=>({x:100,y:100,vx:0,vy:0,r:5,dmg:100,homing:0,bouncesLeft:0,ricochetsLeft:0,pierce:false,hitSet:new Set(),color:'#fff',...extra});
  return {c,Game,p,S,enemy,bullet,tick:dt=>c.updateGame(dt)};
}
test('real campaign last kill resets two bullets without undefined homing or a stalled next frame',()=>{
  const f=fixture(),e=f.enemy(),untouched=f.bullet({x:200,vx:10}),killer=f.bullet();
  const old=f.Game.playerBullets;old.push(untouched,killer);
  assert.doesNotThrow(()=>f.tick(.01));
  assert.equal(f.Game.kills,1);assert.equal(e.deathProcessed,true);assert.equal(f.Game.roomCleared,true);
  assert.notEqual(f.Game.playerBullets,old);assert.equal(f.Game.playerBullets.length,0);
  assert.equal(untouched.x,200,'discarded bullets must not move');
  assert.doesNotThrow(()=>f.tick(.01));assert.equal(f.Game.kills,1);
});
test('discarded piercing ricochet cannot target new-room enemies or splice replacement bullets',()=>{
  const f=fixture();f.enemy();
  const stale=f.bullet({pierce:true,ricochetsLeft:2,vx:10});
  f.Game.playerBullets.push(stale);
  const replacement=f.bullet({x:250});
  const kill=f.c.onEnemyKilled;
  f.c.onEnemyKilled=e=>{
    kill(e); // Giữ kill và reset chiến dịch thật trước khi mô phỏng phòng mới.
    f.Game.playerBullets=[replacement];
    f.enemy({x:150,hp:1000,maxHp:1000});
  };
  f.tick(.01);
  assert.equal(stale.ricochetsLeft,2,'không ricochet sau reset');
  assert.equal(stale.dmg,100);assert.equal(f.Game.playerBullets[0],replacement);
  assert.equal(replacement.x,250);assert.equal(f.Game.enemies[0].hp,1000);
});
test('normal homing, bounce, pierce and ricochet retain their combat values',()=>{
  const f=fixture();f.enemy({x:100,hp:1000,maxHp:1000});const next=f.enemy({x:200,hp:1000,maxHp:1000});
  const b=f.bullet({ricochetsLeft:1,vx:100});f.Game.playerBullets.push(b);
  f.tick(.01);assert.equal(b.ricochetsLeft,0);assert.equal(b.dmg,82);assert.equal(b.vx,100);assert.equal(next.hp,1000);
  const g=fixture();g.enemy({x:200,y:200,hp:1000,maxHp:1000});
  const h=g.bullet({x:100,y:100,vx:100,homing:.5,pierce:true});g.Game.playerBullets.push(h);g.tick(.1);
  assert.ok(h.vy>0);assert.ok(Math.abs(Math.hypot(h.vx,h.vy)-100)<1e-9);
  const wall=g.bullet({x:25,y:300,vx:-100,bouncesLeft:1});g.Game.playerBullets.push(wall);g.tick(.1);
  assert.equal(wall.x,24);assert.equal(wall.vx,100);assert.equal(wall.bouncesLeft,0);
});
test('real last-kill meteor reset stops sibling meteors without reading undefined progress',()=>{
  const f=fixture(),e=f.enemy();
  const untouched={progress:0,targetX:200,targetY:100};
  const killer={progress:1,targetRef:e,targetX:e.x,targetY:e.y};
  f.Game.meteors.push(untouched,killer);
  assert.doesNotThrow(()=>f.tick(.01));
  assert.equal(f.Game.kills,1);assert.equal(f.Game.meteors.length,0);assert.equal(untouched.progress,0);
});
