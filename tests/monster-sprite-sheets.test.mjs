import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const monster=read('monster-sprite-animation.js'),skill=read('skill-sprite-animation.js');
const renderer=read('js/game/rendering/arena-renderer.js');
const monsterArt=read('monster-art.js'),skillCombat=read('skill-combat-vfx.js');
const studio=read('monster-sprite-studio.html');
function setup({bad=false,motion=false}={}){
 const requested=[];
 class ImageMock{
   constructor(){this.complete=!bad;this.naturalWidth=bad?0:960;this.naturalHeight=bad?0:800;}
   set src(path){
     requested.push(path);
     if(path.includes('elemental')){this.naturalWidth=bad?0:768;this.naturalHeight=bad?0:512;}
     bad?this.onerror?.():this.onload?.();
   }
 }
 const window={Image:ImageMock,matchMedia:()=>({matches:motion})};
 const sandbox=vm.createContext({window,console});
 vm.runInContext(monster,sandbox,{filename:'monster-sprite-animation.js'});
 vm.runInContext(skill,sandbox,{filename:'skill-sprite-animation.js'});
 return {m:window.ArtemisMonsterSprites,s:window.ArtemisSkillSprites,requested};
}
function canvas(){
 const draws=[],state={depth:0};
 const ctx=new Proxy({},{
   get(target,key){
     if(key in target)return target[key];
     return (...args)=>{
       if(key==='drawImage')draws.push(args);
       if(key==='save')state.depth++;
       if(key==='restore')state.depth--;
       assert.ok(state.depth>=0);
       for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v));
     };
   },
   set(target,key,val){target[key]=val;return true;}
 });
 return {ctx,draws,state};
}
function entity(file){
 return {monsterArtFile:file,isBoss:false,type:'slime',r:30,x:100,y:130,hp:80,
   attackTimer:3,hitFlashTimer:0};
}
const room=(e)=>({chapter:{id:1},room:3,mode:'campaign',enemies:[e],lowGfx:false});

test('new assets are valid transparent frame atlases, no placeholder static icon motion',()=>{
 for(const file of ['monster-sprites/slime-blue.svg','monster-sprites/bat-ember.svg']){
   const txt=read('assets/'+file);
   assert.match(txt,/<svg[^>]*width="960"[^>]*height="800"/);
   assert.equal((txt.match(/<g transform="translate\(/g)||[]).length,30);
   assert.ok(txt.includes('opacity='));
   assert.doesNotMatch(txt,/<image\b/,'frames must be drawn independently, not reusing icon images');
 }
 const txt=read('assets/skill-sprites/elemental-projectiles.svg');
 assert.match(txt,/<svg[^>]*width="768"[^>]*height="512"/);
 assert.equal((txt.match(/<g transform="translate\(/g)||[]).length,24);
 assert.doesNotMatch(txt,/<image\b/);
});

test('six frames exist for Idle Attack Hit Death Skill with correct row crops',()=>{
 const {m}=setup(), {ctx,draws,state}=canvas();
 assert.deepEqual(Object.keys(m.ACTIONS),['idle','attack','hit','death','skill']);
 assert.equal(m.CELL,160);assert.equal(m.COLUMNS,6);assert.equal(m.ROWS,5);
 for(const [file] of Object.entries(m.MANIFEST)){
   const e=entity(file),g=room(e);
   assert.equal(m.eligible(e),true);
   assert.equal(m.eligible({...e,isBoss:true}),false);
   assert.equal(m.drawEnemy(ctx,e,1000,g),true);
   assert.equal(draws.at(-1)[2],0,'Idle source row');
   e.attackTimer=.375;
   assert.equal(m.drawEnemy(ctx,e,1100,g),true);
   assert.equal(draws.at(-1)[2],160,'Attack source row');
   assert.equal(draws.at(-1)[1],480,'Attack countdown frame 3');
   e.attackTimer=3;m.drawEnemy(ctx,e,1200,g);
   e.hitFlashTimer=.14;
   m.drawEnemy(ctx,e,1500,g);
   assert.equal(draws.at(-1)[2],320,'Hit source row');
   e.attackTimer=.25;e.isElite=true;e.hitFlashTimer=0;
   m.drawEnemy(ctx,e,2100,g);
   assert.equal(draws.at(-1)[2],640,'Skill source row for elite');
   g.enemies=[];
   assert.equal(m.drawDeaths(ctx,g,2200),1,'Removed monster draws death');
   assert.equal(draws.at(-1)[2],480,'Death source row');
   assert.equal(m.drawDeaths(ctx,g,5000),0,'Death visual expires');
   assert.equal(state.depth,0);
 }
});

test('invalid or unavailable sheets fall back to original image path; no game state mutations',()=>{
 const {m,s}=setup({bad:true}),{ctx}=canvas();
 const file=Object.keys(m.MANIFEST)[0],e=entity(file),g=room(e);
 const unchanged=JSON.stringify({e,g});
 assert.equal(m.drawEnemy(ctx,e,1000,g),false);
 assert.equal(m.drawDeaths(ctx,g,1010),0);
 assert.equal(s.drawProjectile(ctx,{x:5,y:6,vx:1,vy:0,r:6},10,
   {player:{skills:{fire_arrow:1}}}),false);
 assert.equal(JSON.stringify({e,g}),unchanged);
 assert.equal(m.eligible({...e,monsterArtFile:'unknown.png'}),false);
});

test('four skill projectiles crop their actual row and never replace multi-element or sword gameplay',()=>{
 const {s}=setup(),{ctx,draws,state}=canvas();
 for(const [kind,def] of Object.entries(s.ELEMENTS)){
   const bullet={x:100,y:30,vx:220,vy:0,r:6,
     trail:[{x:71,y:30},{x:82,y:30}]};
   const game={player:{skills:{[def.skill]:1}},lowGfx:false};
   const saved=JSON.stringify({bullet,game});
   assert.equal(s.projectileKind(bullet,game),kind);
   assert.equal(s.drawProjectile(ctx,bullet,110,game),true);
   assert.equal(draws.at(-1)[2],def.row*128);
   assert.equal(JSON.stringify({bullet,game}),saved);
 }
 assert.equal(s.projectileKind({isSword:true},{player:{skills:{fire_arrow:1}}}),null);
 assert.equal(s.projectileKind({},{player:{skills:{fire_arrow:1,ice_arrow:1}}}),null);
 assert.equal(s.projectileKind({spriteKind:'bomb'},{player:{skills:{fire_arrow:1}}}),null);
 assert.equal(state.depth,0);
});

test('first wave sprite system is linked to live game and studio; original fallback retained',()=>{
 assert.match(monsterArt,/monster-sprite-animation\.js\?v=atlas-first-wave-20261111/);
 assert.match(renderer,/ArtemisMonsterSprites\?\.drawEnemy\(ctx,e,nowMs,Game\)/);
 assert.match(renderer,/ArtemisMonsterSprites\?\.drawDeaths\(ctx,Game,nowMs\)/);
 assert.match(renderer,/MonsterArt\.draw\(ctx, e\)/);
 assert.match(skillCombat,/ArtemisSkillSprites\?\.drawProjectile\(c,b,now,game\)/);
 assert.match(skillCombat,/skill-sprite-animation\.js\?v=atlas-elements-20261111/);
 assert.match(studio,/Idle · Attack · Hit · Death · Skill/);
 assert.match(studio,/monster-sprite-animation\.js/);
 assert.match(studio,/skill-sprite-animation\.js/);
 for(const code of [monster,skill]){
  assert.doesNotMatch(code,/localStorage|fetch\(|enemy\.hp\s*=|\.damage\s*=|\.atk\s*=/);
 }
});
