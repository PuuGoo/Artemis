// VM hors réseau: vraie résolution dégâts, pas un test du seul parseur de bonus.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fixture,html,fn} from './combat-status.test.mjs';

test('damageEnemy applies weapon enchant only to actual weapon context; removes it on unequip',()=>{
 const f=fixture(),e=f.enemy();f.S.runes.sharp_arrow=7;f.S.runeEnchantments={sharp_arrow:5};f.S.equippedRuneSlots.enhancement=['sharp_arrow'];
 const before=JSON.stringify(f.S),hit=(type)=>{const hp=e.hp;f.c.damageEnemy(e,100,false,null,{exHurtAttack:type});return hp-e.hp;};
 assert.equal(hit(4),Math.round((100+15)*(1+.20+.15)*1.075));
 assert.equal(hit(3),Math.round(100*1.075),'meteor không nhận bonus vũ khí');
 assert.equal(JSON.stringify(f.S),before);
 f.S.equippedRuneSlots.enhancement=[];assert.equal(hit(4),100);
});
test('real elemental hit includes generic enchant once, preserves target reduction and crit scope',()=>{
 const f=fixture(),e=f.enemy({DecreaseValue:.2});
 f.S.runes.rune_flame=7;f.S.runeEnchantments={rune_flame:5};f.S.equippedRuneSlots.enhancement=['rune_flame'];
 // canCrit false vẫn cộng flat Fire +5, phần trăm Elemental và minion đúng một lần.
 const hp=e.hp;f.c.damageEnemy(e,100,true,'fire');
 const baseline=fixture(),target=baseline.enemy({DecreaseValue:.2});
 baseline.c.damageEnemy(target,(100*1.5+5)*1.15*1.075,true);
 assert.equal(hp-e.hp,100000-target.hp);assert.equal(f.Game.lastCombatHit.isCrit,false);
 f.S.equippedRuneSlots={ability:['rune_flame']};const next=e.hp;f.c.damageEnemy(e,100,true,'fire');
 const plain=fixture(),other=plain.enemy({DecreaseValue:.2});plain.c.damageEnemy(other,100,true,'fire');
 assert.equal(next-e.hp,100000-other.hp,'ngọc khảm sai loại không khuếch đại');
});
test('real Devil accept listener consumes direct HP without changing maximum; low HP never heals',()=>{
 const a=html.indexOf("document.getElementById('btnAcceptDevil').addEventListener('click', () => {"),b=html.indexOf("document.getElementById('btnDeclineDevil')",a);
 assert.ok(a>=0&&b>a);
 for(const startHp of [1000,50]){
  let click,applied=0;const modal={getAttribute:k=>({'data-devil-skill':'fixture','data-devil-cost-pct':'22.5','data-devil-direct-hp':'true'})[k],classList:{add(){}}};
  const f=fixture();f.p.hp=startHp;Object.assign(f.c,{document:{getElementById:id=>id==='devilModal'?modal:{addEventListener:(_,cb)=>click=cb}},applyRogueSkill:()=>applied++});
  vm.runInContext(html.slice(a,b).replace('// Devil Pact Buttons',''),f.c);click();
  assert.equal(f.p.maxHp,1000);assert.equal(f.p.hp,startHp===1000?775:50);assert.equal(applied,1);assert.equal(f.Game.paused,false);
 }
});
