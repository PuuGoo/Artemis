// Handler production trong VM; không tài khoản, mạng hoặc save thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fixture,fn,read} from './combat-status.test.mjs';
function combat(options) {
  const f=fixture(options);
  vm.runInContext(read('public/combat-damage.js'),f.c);
  f.c.SoundFX.playerHurt=()=>{};
  f.c.getGameMode=()=>({practice:false});
  vm.runInContext(fn('hurtPlayer'),f.c);
  return f;
}
test('đòn chính, DoT và sát thương phụ đi qua giảm flat/hệ số của mục tiêu',()=>{
  const f=combat(), e=f.enemy({combatAttributes:{HurtDecrease:10,HurtDecreasePercent:.5}});
  f.hit(e); assert.equal(100000-e.hp,45);
  const hp=e.hp;f.hit(e,100,true);assert.equal(hp-e.hp,45);
  assert.equal(f.Game.lastCombatHit.direction,'enemy');
});
test('hurtPlayer dùng DEF Artemis như hệ số; không trừ defFlat lần hai',()=>{
  const f=combat();f.p.dmgReduction=.5;f.p.defFlat=9999;
  f.p.combatAttributes={HurtDecrease:10};
  const save=JSON.stringify(f.S);f.c.hurtPlayer(100);
  assert.equal(f.p.hp,955);assert.equal(JSON.stringify(f.S),save);
});
test('khiên hero chặn HP và không kích hiệu ứng mất HP; phần dư mới vào HP',()=>{
  const f=combat({skills:{wounded_warrior:1}});f.p.darkShieldHp=20;f.p.shieldHp=30;
  f.c.hurtPlayer(35);assert.equal(f.p.hp,1000);assert.equal(f.p.darkShieldHp,0);assert.equal(f.p.shieldHp,15);assert.ok(!f.p.woundedWarriorTimer);
  f.p.invulnTimer=0;f.c.hurtPlayer(20);assert.equal(f.p.hp,995);assert.equal(f.p.shieldHp,0);assert.equal(f.p.woundedWarriorTimer,5);
});
test('passive Cleo không xuyên giảm sát thương và xử lý chết đúng một lần',()=>{
  const f=combat({hero:'cleo'}), primary=f.enemy({maxHp:1000,hp:50}), target=f.enemy({maxHp:2000,hp:100,combatAttributes:{HurtDecreasePercent:.5}});
  f.Game.cleoFireHitCount=11;f.hit(primary,1);
  assert.equal(f.Game.kills,1);assert.equal(target.hp,0);
  f.hit(target);assert.equal(f.Game.kills,1);
});
test('đạn vũ khí mang context thật tới GetDecrease khi va chạm trong updateGame',()=>{
  const f=combat();
  Object.assign(f.p.weapon,{id:'bow',projSpeed:10});
  const e=f.enemy({combatAttributes:{MainWeaponHurtDecreasePercent:.25}});
  vm.runInContext(fn('createPlayerBullet'),f.c);f.c.createPlayerBullet(e.x,e.y,0);
  assert.equal(f.Game.playerBullets[0].exHurtAttack,4);
  f.tick(0);assert.equal(e.hp,99975);
});
test('va chạm body có giảm riêng; projectile giữ source của quái lúc bắn',()=>{
  const f=combat();f.p.combatAttributes={BodyHurtDecrease:10,BodyHurtDecreasePercent:.5};
  f.c.hurtPlayer(100,{source:{isBoss:true},attackerType:3});assert.equal(f.p.hp,955);
  const e=f.enemy({type:'goblin',x:100,y:100,attackTimer:0});f.tick(.01);
  assert.ok(f.Game.enemyBullets.length>0);assert.equal(f.Game.enemyBullets[0].source,e);
});
