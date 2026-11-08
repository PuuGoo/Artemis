// Offline VM: thực thi damageEnemy/updateGame thật; không tài khoản, mạng hay save thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = read('public/index.html').replace(/\r\n/g, '\n');
function fn(name) {
  const source = name === 'drawMonster' ? read('public/js/game/rendering/arena-renderer.js').replace(/\r\n/g, '\n') : html;
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  const boundary = name === 'drawMonster' ? '\n  }' : '\n      }';
  const end = source.indexOf(boundary, start);
  assert.ok(end > start, name + ' boundary');
  return source.slice(start, end + boundary.length);
}
function fixture({ skills = {}, hero = 'alex' } = {}) {
  const p = { x:300,y:500,r:12,hp:1000,maxHp:1000,atk:100,critRate:0,skills,hero:{id:hero},weapon:{color:'#fff'},attackCooldown:10000,facingAngle:0 };
  const Game = { player:p,width:600,height:800,wallPad:24,keys:{},joy:{active:false},pet:{x:300,y:530,cooldown:10000},enemies:[],obstacles:[],kills:0 };
  for (const k of ['playerBullets','enemyBullets','drops','swords','meteors','artemisHawks','particles','shockwaves','lightningBolts','ambientMotes','afterimages','muzzleFlashes','floorDecals','floatTexts']) Game[k]=[];
  const S = { runes:{},equippedRuneSlots:{ability:[],etched:[],blessing:[],enhancement:[]},gold:123,selectedHeroId:hero,save(){throw Error('unexpected save');} };
  const c=vm.createContext({Game,SaveState:S,Math:Object.create(Math),performance:{now:()=>1000},getActiveResonanceHeroIds:()=>({}),getHeroStarLevel:()=>0,getActiveHeroSkin:()=>({}),getEquippedSetCounts:()=>({}),updateUltimateCharge(){},updateInGameHUD(){},spawnFloatText(){},spawnParticles(){},spawnShockwave(){},spawnSkyLaser(){},spawnCombatSlashAndSparks(){},SoundFX:{hitEnemy(){}},hurtPlayer(){p.hp-=10;},ArtemisObstacleClearance:{moveEntity(e,x,y){e.x+=x;e.y+=y;},resolveEntity(){}},RuneEconomy:{copies:v=>Number(v)||0}});
  c.Math.random=()=>.99;
  c.collidesObstacle=()=>false;
  if (fs.existsSync(new URL('../public/combat-status.js',import.meta.url))) vm.runInContext(read('public/combat-status.js'),c);
  vm.runInContext(read('public/combat-damage.js'),c);
  vm.runInContext(['hasHeroSkillActive','runeOwned','getEquippedRuneSlots','isRuneEquipped','runeHasEffect','getCombatSourceData','applyEnemyCombatHit','dealEnemySecondaryDamage','getCombatElementalMultiplier','findNearestEnemy','damageEnemy','spawnEnemyBullet','updateGame','clearRunState'].map(fn).join('\n'),c);
  c.onEnemyKilled=e=>{assert.ok(!e.testKilled,'death once');e.testKilled=true;Game.kills++;Game.enemies=Game.enemies.filter(x=>x.hp>0);};
  const enemy=(extra={})=>{const e={x:100,y:100,r:14,hp:100000,maxHp:100000,atk:10,type:'goblin',speed:0,vx:0,vy:0,attackTimer:10000,...extra};Game.enemies.push(e);return e;};
  return {c,Game,p,S,enemy,tick:dt=>c.updateGame(dt),hit:(e,d=100,el=false)=>c.damageEnemy(e,d,el)};
}
test('fire uses elapsed time, not RNG: nine ticks over 3s at .01/.033/.1 partitions',()=>{
  const losses=[];
  for(const step of [.01,.033,.1]){
    const f=fixture({skills:{fire_arrow:1}}),e=f.enemy();f.hit(e);const start=e.hp;
    let t=0;while(t<3-1e-10){const dt=Math.min(step,3-t);f.tick(dt);t+=dt;}
    losses.push(start-e.hp);assert.ok(Math.abs(e.burnTimer)<1e-8);
  }
  assert.deepEqual(losses,[252,252,252]);
});
test('Venom primary impact adds elemental 0.5 ATK; poison ticks once/sec until death without stacking or postponement',()=>{
  const f=fixture({skills:{venom_arrow:1}}),e=f.enemy();f.hit(e);
  assert.equal(e.hp,99850);assert.equal(e.poisonActive,true);
  f.tick(.6);f.hit(e);f.tick(.4);assert.equal(e.hp,99675);
  f.tick(4);assert.equal(e.hp,99575);
  const hp=e.hp;f.hit(e,100,true);assert.equal(e.hp,hp-100);
  f.tick(1);assert.equal(e.hp,hp-125);
  const plain=fixture(),other=plain.enemy();plain.hit(other);plain.tick(5);
  assert.equal(other.hp,99900);assert.ok(!other.poisonActive);
});
test('DoT death cannot move, contact-hit or shoot; next enemy still updates after removal',()=>{
  const f=fixture(),dead=f.enemy({x:300,y:500,hp:5,speed:100,burnTimer:1,burnDmg:10,burnTick:.3,attackTimer:0}),next=f.enemy({speed:100,type:'bat'});
  f.tick(.1);
  assert.equal(f.Game.kills,1);assert.equal(dead.x,300);assert.equal(dead.y,500);
  assert.equal(f.p.hp,1000);assert.equal(f.Game.enemyBullets.length,0);assert.ok(next.x>100);
  f.tick(.1);f.hit(dead);assert.equal(f.Game.kills,1);
});
test('slow reduces actual displacement to 55% for regular mobs, bats and bosses including inherited velocity',()=>{
  for(const kind of [{type:'goblin'},{type:'bat'},{type:'boss',isBoss:true}]){
    const moves=[];
    for(const slow of [0,2]){
      const f=fixture(),e=f.enemy({x:100,y:500,speed:100,vx:100,slowTimer:slow,...kind});f.tick(.1);moves.push(e.x-100);
    }
    assert.ok(Math.abs(moves[1]/moves[0]-.55)<1e-9,JSON.stringify({kind,moves}));
  }
});
test('Flame-Poison Touch requires owned/equipped rank 4, ignites and poisons without frost',()=>{
  for(const [rank,equipped,active] of [[0,true,false],[3,true,false],[4,false,false],[4,true,true]]){
    const f=fixture(),e=f.enemy();f.S.runes.flame_poison_touch=rank;
    if(equipped)f.S.equippedRuneSlots.ability=['flame_poison_touch'];
    f.tick(1.64);assert.equal(e.hp,100000);f.tick(.01);
    assert.equal(!!e.poisonActive,active);assert.equal((e.burnTimer||0)>0,active);
    assert.ok(!(e.slowTimer>0));
    if(active){assert.equal(e.burnDmg,15);assert.equal(e.poisonDmg,20);assert.ok(e.hp<100000);}
  }
});
test('Frost-Thunder Touch has a separate clock, slow + lightning only; combined 3s budget stays below legacy mixed Touch',()=>{
  const f=fixture(),target=f.enemy(),near=f.enemy({x:130});
  f.S.runes={rune_thunder:4};f.S.equippedRuneSlots.ability=['rune_thunder'];
  f.Game.flamePoisonTouchTimer=1.64;
  f.tick(1.64);assert.equal(target.hp+near.hp,200000);f.tick(.01);
  assert.ok(near.slowTimer>0);assert.ok(!near.burnTimer&&!near.poisonActive);
  assert.equal(200000-target.hp-near.hp,135);assert.ok(f.Game.lightningBolts.length>0);
  const both=fixture(),e=both.enemy(),neighbor=both.enemy({x:130});
  both.S.runes={flame_poison_touch:4,rune_thunder:4};both.S.equippedRuneSlots.ability=['flame_poison_touch','rune_thunder'];
  both.tick(1.64);both.tick(.01);
  // Ngừng khảm chỉ trong fixture để đo trọn 3s của một lần kích hoạt.
  both.S.equippedRuneSlots.ability=[];
  for(let n=0;n<300;n++)both.tick(.01);
  const damage=200000-e.hp-neighbor.hp;
  assert.equal(damage,375);assert.ok(damage<=90+45*9);
});
test('Cleo + Blaze preserves the stronger burn and refresh never postpones its next tick',()=>{
  const f=fixture({hero:'cleo',skills:{fire_arrow:1}}),e=f.enemy();f.hit(e);
  assert.equal(e.burnDmg,38);f.tick(.2);f.hit(e);const hp=e.hp;
  f.tick(1/3-.2);assert.equal(hp-e.hp,38);
  f.c.CombatStatus.applyBurn(e,10,1);assert.equal(e.burnDmg,38);assert.ok(e.burnTimer>1);
  f.tick(3);f.c.CombatStatus.applyBurn(e,10,1);assert.equal(e.burnDmg,10);
});
test('room and run reset remove Touch clocks, preserve save and clear enemy-local poison',()=>{
  const f=fixture(),e=f.enemy();f.c.CombatStatus.applyPoison(e,25);f.Game.flamePoisonTouchTimer=1.6;f.Game.frostThunderTouchTimer=1.6;
  const before=JSON.stringify(f.S);f.c.clearRunState();
  assert.equal(f.Game.flamePoisonTouchTimer,0);assert.equal(f.Game.frostThunderTouchTimer,0);
  assert.equal(f.Game.enemies.length,0);assert.equal(JSON.stringify(f.S),before);
  // Dựng phòng bằng spawner thật, không sao chép quy tắc reset.
  Object.assign(f.c,{MonsterArt:{assignRoom(){}},isBossRoom:()=>false,usesCampaignTuning:()=>false,document:{getElementById:()=>({classList:{add(){},remove(){}}})},hideBossIntro(){}});
  f.c.ArtemisObstacleClearance.findSafeSpawn=(x,y)=>({x,y});
  Object.assign(f.Game,{chapter:{id:1,enemyScale:1},maxRooms:15,pet:{},flamePoisonTouchTimer:1.6,frostThunderTouchTimer:1.6});f.S.talents={};f.S.bestRooms={1:1};
  const roomSave=JSON.stringify(f.S);vm.runInContext(fn('setupRoom'),f.c);f.c.setupRoom(1);
  assert.equal(f.Game.flamePoisonTouchTimer,0);assert.equal(f.Game.frostThunderTouchTimer,0);
  assert.ok(f.Game.enemies.every(e=>!e.poisonActive&&!e.burnTimer));assert.equal(JSON.stringify(f.S),roomSave);
});
function canvas(){
  const log=[];let depth=0;const gradient={addColorStop(){}};
  const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:(...a)=>{if(k==='save')depth++;if(k==='restore')depth--;for(const v of a)if(typeof v==='number')assert.ok(Number.isFinite(v),k);log.push([k,...a]);if(String(k).startsWith('create'))return gradient;},set:(o,k,v)=>{o[k]=v;log.push([k,v]);return true;}});
  return {ctx,log,depth:()=>depth};
}
test('actual map monster renderer paints bounded fire/ice/poison status shapes, no motion decoration in quiet modes',()=>{
  for(const mode of ['normal','low','reduced']){
    const f=fixture();f.c.matchMedia=()=>({matches:mode==='reduced'});vm.runInContext(read('public/skill-combat-vfx.js'),f.c);
    Object.assign(f.c,{curBiome:{},visOf:()=>({t0:0,face:1,landed:true}),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),AURA_T:{},skinOf:()=>null,TAU:Math.PI*2,drawBody(){},orb(){},MonsterArt:{draw:()=>true}});
    f.Game.lowGfx=mode==='low';vm.runInContext(fn('drawMonster'),f.c);
    const e=f.enemy({burnTimer:3,slowTimer:2,poisonActive:true});
    const draw=t=>{const a=canvas(),before=JSON.stringify(e);f.c.drawMonster(a.ctx,e,t);assert.equal(JSON.stringify(e),before);assert.equal(a.depth(),0);return a;};
    const a=draw(2000);for(const color of ['#fb923c','#7dd3fc','#a3e635'])assert.ok(a.log.some(x=>x[0]==='strokeStyle'&&x[1]===color),mode+color);
    assert.ok(a.log.filter(x=>x[0]==='arc'&&x[3]===7).length>=3,'ba huy hiệu trạng thái đủ lớn để đọc trên nền map');
    const local=t=>{const a=canvas();f.c.SkillCombatVfx.status(a.ctx,e,t,f.Game);assert.equal(a.depth(),0);assert.ok(a.log.length<150);assert.ok(!a.log.some(x=>/^create|drawImage/.test(x[0])));return a.log;};
    if(mode==='normal')assert.notDeepEqual(local(0),local(1000));else assert.deepEqual(local(0),local(1000));
    const none=canvas();f.c.SkillCombatVfx.status(none.ctx,{...e,hp:0},0,f.Game);assert.equal(none.log.length,0);
  }
});
export {fixture,fn,html,read};
test('burn expiry clips overshoot, pays its fractional tail once and never resurrects; poison is partition invariant',()=>{
  for(const step of [.01,.033,.1]){
    const f=fixture(),e=f.enemy();f.c.CombatStatus.applyBurn(e,30,2.5);
    let t=0;while(t<3-1e-9){const dt=Math.min(step,3-t);f.tick(dt);t+=dt;}
    assert.equal(100000-e.hp,225);f.tick(1);assert.equal(e.hp,99775);
    f.c.CombatStatus.applyPoison(e,25);t=0;while(t<4-1e-9){const dt=Math.min(step,4-t);f.tick(dt);t+=dt;}
    assert.equal(e.hp,99675);
  }
});
test('secondary poison cannot crit, recursively enchant or repeat a kill; real hero signature counters stay primary-only',()=>{
  const f=fixture({hero:'cleo',skills:{venom_arrow:1,fire_arrow:1,ice_arrow:1}}),e=f.enemy({hp:140,maxHp:140});f.p.critRate=1;
  f.hit(e,1);assert.equal(f.Game.cleoFireHitCount,1);assert.equal(e.poisonDmg,25);
  const burn=e.burnTimer;f.hit(e,1,true);assert.equal(e.burnTimer,burn);assert.equal(f.Game.cleoFireHitCount,1);
  e.hp=10;f.tick(1);assert.equal(f.Game.kills,1);f.hit(e);assert.equal(f.Game.kills,1);
});
test('Rolla slow and Cleo burn use the shared update path without changing ownership or save',()=>{
  for(const hero of ['rolla','cleo']){
    const f=fixture({hero}),e=f.enemy({x:100,y:500,type:'bat',speed:100});const before=JSON.stringify(f.S);f.hit(e);
    const hp=e.hp;f.tick(1/3);
    if(hero==='rolla'){assert.ok(e.slowTimer>0);assert.ok(Math.abs(e.x-100-100*.55/3)<1e-8);}
    else assert.equal(hp-e.hp,38);
    assert.equal(JSON.stringify(f.S),before);
  }
});
test('Freeze cannot shorten Rolla frost; a slow expiring mid-step only reduces the active fraction of movement/attack clock',()=>{
  const rolla=fixture({hero:'rolla',skills:{ice_arrow:1}}),r=rolla.enemy();rolla.hit(r);assert.equal(r.slowTimer,3.2);
  const f=fixture(),e=f.enemy({x:100,y:500,type:'bat',speed:100,slowTimer:.05,attackTimer:10});f.tick(.1);
  assert.ok(Math.abs(e.x-107.75)<1e-9);assert.ok(Math.abs(e.attackTimer-9.9225)<1e-9);assert.equal(e.slowTimer,0);
});

test('Hỏa Độc Ấn chỉ tăng cháy từ Epic và độc từ Legendary khi đã sở hữu/khảm',()=>{
  for(const [rank,equipped,fire,impact,poison] of [
    [0,true,28,50,25],[3,true,28,50,25],[4,false,28,50,25],
    [4,true,42,50,25],[6,true,42,50,25],[7,true,42,75,38],[11,true,42,75,38],
  ]){
    const f=fixture({skills:{fire_arrow:1,venom_arrow:1}}),e=f.enemy();
    vm.runInContext(read('public/rune-economy.js'),f.c);
    f.S.runes.rune_flame=rank;
    if(equipped)f.S.equippedRuneSlots.enhancement=['rune_flame'];
    const before=JSON.stringify(f.S);
    f.hit(e);assert.equal(100000-e.hp,100+impact,`impact rank=${rank}/eq=${equipped}`);
    const hp=e.hp;f.tick(1);assert.equal(hp-e.hp,3*fire+poison,`tick rank=${rank}/eq=${equipped}`);
    assert.equal(e.burnDmg,28,'lưu raw potency, không nhân trước rồi nhân lại mỗi nhịp');
    assert.equal(e.poisonDmg,25);
    assert.equal(JSON.stringify(f.S),before,'đọc bonus không sửa save');
  }
});

test('Ấn không khuếch đại đòn vật lý, sét hay nguồn chưa định danh; sai nhóm ô không có tác dụng',()=>{
  const f=fixture(),e=f.enemy();
  f.S.runes.rune_flame=11;f.S.equippedRuneSlots.enhancement=['rune_flame'];
  for(const [secondary,element,expected] of [[false,'fire',100],[true,null,100],[true,'lightning',100],[true,'fire',150],[true,'poison',150]]){
    const hp=e.hp;f.c.damageEnemy(e,100,secondary,element);assert.equal(hp-e.hp,expected);
  }
  f.S.equippedRuneSlots.enhancement=[];f.S.equippedRuneSlots.ability=['rune_flame'];
  const hp=e.hp;f.c.damageEnemy(e,100,true,'fire');assert.equal(hp-e.hp,100);
});

test('số sát thương trên map chỉ ghi LỬA/ĐỘC khi handler nhận đúng nguyên tố',()=>{
  const f=fixture({skills:{fire_arrow:1,venom_arrow:1}}),e=f.enemy();
  f.S.runes.rune_flame=7;f.S.equippedRuneSlots.enhancement=['rune_flame'];
  const text=[];f.c.spawnFloatText=(...args)=>text.push(args);
  f.hit(e);f.tick(1);
  assert.ok(text.some(a=>a[2]==='LỬA 42'&&a[3]==='#fb923c'));
  assert.ok(text.some(a=>a[2]==='ĐỘC 38'&&a[3]==='#a3e635'));
  const next=f.enemy({x:130});text.length=0;f.c.damageEnemy(next,10,true);
  assert.ok(text.some(a=>a[2]==='10'),'nguồn trung tính không bị gán lửa theo màu');
  assert.ok(!text.some(a=>/LỬA|ĐỘC/.test(a[2])));
});

test('lửa Nezha dùng cùng bonus Ấn cho sát thương chạm và DoT, không nhân hai lần',()=>{
  const f=fixture({hero:'nezha'}),e=f.enemy({x:300,y:500});
  f.S.runes.rune_flame=4;f.S.equippedRuneSlots.enhancement=['rune_flame'];
  f.p.speed=100;f.Game.keys.KeyD=true;f.tick(.22);
  assert.equal(100000-e.hp,63,'lửa chạm 42 × 1.5');
  assert.equal(e.burnDmg,25,'potency vẫn raw');
  f.Game.keys={};const hp=e.hp;f.tick(1/3-.22);
  assert.equal(hp-e.hp,38,'nhịp lửa 25 × 1.5 làm tròn một lần');
});

test('Ấn giữ potency mạnh nhất, đổi khảm không nhân dồn và nhịp chí tử chỉ ghi một lần chết',()=>{
  const f=fixture({hero:'cleo',skills:{fire_arrow:1}}),e=f.enemy();
  f.S.runes.rune_flame=4;f.S.equippedRuneSlots.enhancement=['rune_flame'];
  f.hit(e);assert.equal(e.burnDmg,38);const hp=e.hp;f.tick(1/3);assert.equal(hp-e.hp,57);
  f.hit(e);assert.equal(e.burnDmg,38);
  f.S.equippedRuneSlots.enhancement=[];const next=e.hp;f.tick(1/3);assert.equal(next-e.hp,38);
  f.S.equippedRuneSlots.enhancement=['rune_flame'];e.hp=50;f.tick(1/3);
  assert.equal(f.Game.kills,1);f.tick(1);assert.equal(f.Game.kills,1);
});

test('hồ sơ Ấn tách tác dụng đã làm khỏi wiki và không quảng cáo nổ Mythic đang hoạt động',()=>{
  const f=fixture();let modal;
  const node={focus(){}};
  f.c.document={querySelector:()=>null,createElement:()=>modal={setAttribute(){},addEventListener(){},querySelector:s=>s.includes('img')||s.includes('equip')||s.includes('ruins')?null:node},body:{appendChild(){}}};
  f.c.RUNES_DATA=[{id:'rune_flame',name:'Ấn',type:'enhancement'}];f.c.RuneWikiData={rune_flame:{name:'Seal',effects:{},base:'ATK'}};
  f.c.RuneEconomy.tier=()=>'epic';f.c.runeImage=()=>'';vm.runInContext(fn('openRuneDetailPopup'),f.c);
  f.c.openRuneDetailPopup('rune_flame');
  assert.match(modal.innerHTML,/data-rune-combat-note/);
  assert.match(modal.innerHTML,/Epic.*50%.*Legendary.*50%/);
  assert.match(modal.innerHTML,/chưa.*nổ Mythic/i);
});

test('Hỏa Độc Chạm + Ấn tăng đúng DoT theo thời gian, không biến Băng Lôi thành lửa',()=>{
  for(const step of [.01,.033,.1]){
    const f=fixture(),e=f.enemy();
    f.S.runes={rune_flame:7,flame_poison_touch:4};
    f.S.equippedRuneSlots.ability=['flame_poison_touch'];f.S.equippedRuneSlots.enhancement=['rune_flame'];
    f.tick(1.64);f.tick(.01);
    const hp=e.hp;f.S.equippedRuneSlots.ability=[];
    let elapsed=0;while(elapsed<3-1e-10){const dt=Math.min(step,3-elapsed);f.tick(dt);elapsed+=dt;}
    // 9 nhịp × round(15×1.5) + 3 nhịp × (20×1.5), potency không được scale sẵn.
    assert.equal(hp-e.hp,9*Math.round(15*1.5)+3*30);assert.equal(e.burnDmg,15);assert.equal(e.poisonDmg,20);
  }
  const f=fixture(),e=f.enemy();f.S.runes={rune_flame:11,rune_thunder:4};
  f.S.equippedRuneSlots.ability=['rune_thunder'];f.S.equippedRuneSlots.enhancement=['rune_flame'];
  f.tick(1.65);assert.equal(100000-e.hp,90);assert.ok(!e.burnTimer&&!e.poisonActive);
});
