import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const source=read('monster-sprite-animation.js');
const studio=read('monster-sprite-studio.html');
const loader=read('monster-art.js');
const config=read('campaign-config.js');
const roster=read('campaign-rooms.js');

function setup(){
  const requests=[];
  class ImageMock {
    constructor(){this.complete=true;this.naturalWidth=960;this.naturalHeight=800;}
    set src(s){requests.push(s);this.onload?.();}
  }
  const window={Image:ImageMock,matchMedia:()=>({matches:false})};
  vm.runInNewContext(source,{window});
  return {api:window.ArtemisMonsterSprites,requests};
}
const types=['slime','goblin','plant_turret','skeleton_mage'];
const names=[
  'Ấu Sư Nhật Quang','Sư Vệ Hoàng Kim','Pháo Đài Nhật Luân','Tư Tế Sư Tử'
];
const makeEnemy=(type)=>({
  type,isBoss:false,campaignChapter:1,campaignRoom:3,
  monsterArtFile:'Icon_SmilmeSmall_ccca1d.png',
  r:24,x:150,y:120,hp:80,maxHp:80,attackTimer:1.4,hitFlashTimer:0
});
const game=(chapter,room,enemies)=>({mode:'campaign',chapter:{id:chapter},room,
  enemies,lowGfx:false});
function canvas(){
 const draws=[],t={depth:0};
 return {draws,t,ctx:{
   save(){t.depth++;},restore(){t.depth--;assert.ok(t.depth>=0);},
   translate(){},rotate(){},scale(){},
   drawImage(...args){draws.push(args);}
 }};
}

test('four distinct original Leo identities are mapped by combat archetype only in chapter 1',()=>{
 const {api}=setup(),files=new Set();
 assert.equal(Object.keys(api.LEO_CHAPTER_ONE).length,4);
 for(let i=0;i<types.length;i++){
  const e=makeEnemy(types[i]),g=game(1,3,[e]);
  const before=JSON.stringify({e,g});
  const file=api.spriteFileFor(e,g);
  files.add(file);
  assert.ok(file.startsWith('leo_'));
  assert.equal(api.MANIFEST[file].chapter,1);
  assert.equal(api.nameFor(e,g),names[i]);
  assert.equal(api.eligible(e,g),true);
  assert.equal(api.eligible({...e,isBoss:true},g),false);
  assert.equal(JSON.stringify({e,g}),before,'selecting art cannot change combat');
  assert.equal(api.spriteFileFor(e,game(2,3,[e])),e.monsterArtFile);
  assert.equal(api.spriteFileFor(e,{mode:'endless',chapter:{id:1},room:3}),e.monsterArtFile);
 }
 assert.equal(files.size,4,'every AI role has unique visual identity');
 assert.equal(api.spriteFileFor(makeEnemy('dragon_whelp'),game(1,3,[])),null);
});

test('every 960x800 Leo sheet contains 30 separately drawn frames in all five states',()=>{
 const {api}=setup();
 for(const type of types){
  const entry=api.LEO_CHAPTER_ONE[type],meta=api.MANIFEST[entry.file];
  const xml=read(meta.path.replace(/^\//,''));
  assert.match(xml,/xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(xml,/width="960" height="800"/);
  assert.equal((xml.match(/data-action=/g)||[]).length,30);
  for(const action of Object.keys(api.ACTIONS)){
    assert.equal((xml.match(new RegExp('data-action="'+action+'"','g'))||[]).length,6,
      meta.name+': '+action+' count');
    assert.equal(api.ACTIONS[action].count,6);
  }
  assert.doesNotMatch(xml,/<image\b/i,'do not rotate a single static icon as animation');
  assert.ok(xml.includes('stroke='),'must contain proper outlines');
  assert.ok(xml.includes('fill='),'must include actual painted character layers');
 }
});

test('all four character sprites draw and animate real gameplay frames using existing enemy timers',()=>{
 const {api,requests}=setup(),{draws,ctx,t}=canvas();
 for(const type of types){
  const e=makeEnemy(type),g=game(1,3,[e]),file=api.LEO_CHAPTER_ONE[type].file;
  const original=JSON.stringify({e,g});
  assert.equal(api.drawEnemy(ctx,e,1000,g),true);
  assert.equal(draws.at(-1)[2],0,'Idle row');
  assert.equal(requests.at(-1),api.MANIFEST[file].path);
  e.attackTimer=.375;
  api.drawEnemy(ctx,e,1120,g);
  assert.equal(draws.at(-1)[2],type==='skeleton_mage'||type==='plant_turret'?640:160);
  e.attackTimer=2; api.drawEnemy(ctx,e,1350,g);
  e.hitFlashTimer=.16;api.drawEnemy(ctx,e,1660,g);
  assert.equal(draws.at(-1)[2],320,'Hit row');
  g.enemies=[];
  assert.equal(api.drawDeaths(ctx,g,1750),1);
  assert.equal(draws.at(-1)[2],480,'Death row');
  assert.equal(api.drawDeaths(ctx,g,3900),0,'Death expires');
  assert.equal(t.depth,0);
  // Only game timestamps/changes above differ; visual rendering did not write AI stats.
  assert.equal(e.hp,80);
  assert.equal(e.maxHp,80);
  assert.equal(e.type,type);
  assert.ok(original.includes(type));
 }
});

test('chapter 1 roster across fifty rooms is made solely from four mapped regular roles; bosses stay intact',()=>{
 const sandbox=vm.createContext({});
 vm.runInContext(config,sandbox);
 vm.runInContext(roster,sandbox);
 const rooms=sandbox.ArtemisCampaignRooms,used=new Set();
 for(let room=1;room<=50;room++){
  const entries=rooms.getRoster(1,room);
  if(room%10===0){
    assert.equal(entries.length,1,'boss room '+room);
    assert.equal(entries[0].role,'boss','subboss and final boss stay untouched');
    continue;
  }
  if(room%10===5){assert.equal(entries.length,0,'Valkyrie room '+room);continue;}
  for(const e of entries){
    assert.ok(types.includes(e.type),'unknown Leo regular enemy '+e.type);
    used.add(e.type);
  }
 }
 assert.equal(used.size,4,'all four different Leo minions appear over 50 rooms');
});

test('studio displays real Leo group first, renderer loads new edition and old chapters retain atlases',()=>{
 assert.match(studio,/leoMonsters/);
 assert.match(studio,/Thánh Điện Nhật Luân/);
 assert.match(studio,/Chương 1/);
 assert.match(studio,/monster-sprite-animation\.js\?v=leo-royal-minions-20261111/);
 assert.match(loader,/monster-sprite-animation\.js\?v=leo-royal-minions-20261111/);
 assert.match(source,/Icon_SmilmeSmall_ccca1d\.png/);
 assert.match(source,/Icon_Bat_Gray_4f8a9c\.png/);
 for(const s of [source,studio])assert.doesNotMatch(s,/\.hp\s*=|\.atk\s*=|\.damage\s*=/);
});
