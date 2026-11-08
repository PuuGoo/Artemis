import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file = new URL('../public/combat-damage.js', import.meta.url);
function engine() {
  assert.ok(fs.existsSync(file), 'Thiếu pipeline sát thương đã phân tích');
  const c = vm.createContext({});
  vm.runInContext(fs.readFileSync(file, 'utf8'), c);
  return c.CombatDamage;
}
test('fixed-point giữ dịch phải có dấu, làm tròn và low64 riêng với wide multiply', () => {
  const d = engine();
  assert.equal(d.toRaw(1), 65536n);
  assert.equal(d.multiply(-3n, 32768n), -2n);
  assert.equal(d.roundRaw(98304n), 2);
  assert.equal(d.multiplyLow64(1n << 48n, 65536n), 0n);
  assert.equal(d.multiply(1n << 48n, 65536n), 1n << 48n);
});
test('RNG48 giữ endpoints và vẫn tiến seed khi hai bounds bằng nhau', () => {
  const d = engine(), r = d.createRng(0);
  assert.equal(r.next(0, 65536), 0);
  assert.equal(r.state(), 11);
  assert.equal(r.next(7, 7), 7);
  assert.notEqual(r.state(), 11);
  for (let i=0;i<1000;i++) { const v=r.next(0,65536); assert.ok(v>=0&&v<65536); }
});
export {engine};
test('GetDecrease nhân từng hệ số; không lấy defFlat trừ thêm và race có ưu tiên', () => {
  const d=engine();
  const result=d.getDecrease({HurtDecrease:10,HurtDecreasePercent:.5,StandHurtDecrease:5,StandHurtDecreasePercent:.8,BodyHurtDecrease:3,BodyHurtDecreasePercent:.5,HurtReduceForMonsterPercent:.5,HurtReduceForBossPercent:.1}, {targetIsHero:true,ownerRaceFlag:10,attackerType:3});
  assert.equal(result.flat,d.toRaw(18));
  assert.equal(result.coefficient,d.multiplyLow64(d.multiplyLow64(d.multiplyLow64(d.toRaw(.5),d.toRaw(.8)),d.toRaw(.5)),d.toRaw(.5)));
});
test('Crit giữ threshold nghiêm ngặt và floor raw 66191', () => {
  const d=engine(), source={CritRate:.5,SuperCirtRate:.125,CritValue:1,SuperCritValue:1};
  assert.equal(d.resolveCrit(source,{},false,32768).superCrit,false);
  assert.equal(d.resolveCrit(source,{},false,32769).superCrit,true);
  assert.equal(d.resolveCrit(source,{},false,40960).isCrit,false);
  assert.equal(d.resolveCrit(source,{},false,0).multiplier,66191n);
  assert.equal(d.resolveCrit(source,{},false,0,true).isCrit,false);
});
test('module JS khớp vectors từ instruction native: GetDecrease, RNG và crit', () => {
  const d=engine(), v=JSON.parse(fs.readFileSync(new URL('fixtures/native-combat-vectors.json',import.meta.url),'utf8'));
  assert.equal(v.decrease.length,450); assert.equal(v.rng.length,96); assert.equal(v.crit.length,448);
  for (const row of v.decrease) {
    const attrs=Object.fromEntries(v.attribute_names.map((name,i)=>[name,row.attrs[i]/65536]));
    const [ownerRaceFlag,attackerType,hurtType,exHurtAttack,targetIsHero,moving,sword,invincible,invHurt]=row.context;
    const result=d.getDecrease(attrs,{ownerRaceFlag,attackerType,hurtType,exHurtAttack,targetIsHero,moving,swordReduction:sword/65536,invincible,invHurt:invHurt/65536});
    assert.equal(result.flat,BigInt(row.expected[0])); assert.equal(result.coefficient,BigInt(row.expected[1]));
  }
  for (const [seed,low,high,value,state] of v.rng) { const r=d.createRng(seed);assert.equal(r.next(low,high),value);assert.equal(r.state(),state); }
  for (const row of v.crit) {
    const keys=['CritRate','CritValue','SuperCirtRate','SuperCritValue','CriForPlayer','CriValueForPlayer','OwnerRaceFlag'];
    const source=Object.fromEntries(keys.map((k,i)=>[k,row.source[i]/(i===6?1:65536)]));
    const attrs=Object.fromEntries(['CriReduceForPlayerPercent','CriReducePercent','CirHurtReducePercent','CriValueReduceForPlayerPercent'].map((k,i)=>[k,row.attrs[i]/65536]));
    const r=d.resolveCrit(source,attrs,row.hero,row.roll,row.secKill);
    assert.equal(r.isCrit,!!row.expected[0]);assert.equal(r.multiplier,BigInt(row.expected[1]));
  }
});
test('pipeline cuối clamp, giảm flat rồi nhân hệ số, làm tròn và minimum 1', () => {
  const d=engine();
  assert.equal(d.resolve({attack:100,target:{combatAttributes:{HurtDecrease:10,HurtDecreasePercent:.5}},canCrit:false}).hpDamage,45);
  assert.equal(d.resolve({attack:100,source:{FinalHurt:20},canCrit:false}).hpDamage,500);
  assert.equal(d.resolve({attack:100,source:{FinalHurt:-20},canCrit:false}).hpDamage,20);
  assert.equal(d.resolve({attack:1,target:{combatAttributes:{HurtDecrease:100}},canCrit:false}).hpDamage,1);
  for (const attack of [NaN,Infinity,-1,0]) assert.equal(d.resolve({attack,canCrit:false}).hpDamage,0);
});
test('khiên phụ trước, normal sau; shield/body không dùng chung và không sửa HP/save', () => {
  const d=engine(), target={hp:100,shieldHp:30,darkShieldHp:20};
  let r=d.resolve({attack:35,target,canCrit:false});assert.equal(r.hpDamage,0);assert.equal(target.darkShieldHp,0);assert.equal(target.shieldHp,15);assert.equal(target.hp,100);
  r=d.resolve({attack:20,target,canCrit:false});assert.equal(r.hpDamage,5);assert.equal(r.shieldBroken,true);assert.equal(target.shieldHp,0);
  const both={shieldHp:10};r=d.resolve({attack:20,target:both,canCrit:false,context:{hurtShieldAndBody:true}});assert.equal(r.hpDamage,20);assert.equal(r.absorbed,10);
});
test('60 vector khiên native và thứ tự event khi vỡ, không tự cấp buff',()=>{
  const d=engine(),v=JSON.parse(fs.readFileSync(new URL('fixtures/native-combat-vectors.json',import.meta.url),'utf8'));
  assert.equal(v.shield.length,60);
  for(const [hero,normal,extra,damage,absorbed,leftNormal,leftExtra] of v.shield){
    const target={shieldHp:normal,darkShieldHp:extra};
    const hit=d.absorbShield(target,damage);
    assert.equal(hit.absorbed,absorbed);assert.equal(target.shieldHp,leftNormal);assert.equal(target.darkShieldHp,leftExtra);
  }
  const log=[],target={shieldHp:10,shieldBreakBuffId:7,combatFlags:2**35+2**37+4,combatChangeFlags:0};
  const events=Object.fromEntries(['onBreakEffect','onClearFlags','onBreak','onChange','onClear','onBreakBuff'].map(name=>[name,()=>log.push(name)]));
  d.absorbShield(target,10,false,events);
  assert.deepEqual(log,['onBreakEffect','onClearFlags','onBreak','onChange','onClear','onBreakBuff']);
  assert.equal(target.combatFlags,4);assert.equal(target.combatChangeFlags,2**30);assert.equal(target.shieldHp,0);
});
test('toàn ma trận 1440 trường hợp số học cuối khớp mô hình oracle đã kiểm',()=>{
  const d=engine();let count=0;
  const mul=(a,b)=>(a*b)>>16n, rounded=a=>Number((a+32768n)>>16n);
  for(const attack of [0,1,17,100,10000])for(const factor of [13107n,65536n,327680n])for(const flat of [0n,32768n,655360n,13107200n])for(const coefficient of [0n,32768n,65536n])for(const extra of [0n,16384n])for(const both of [false,true])for(const limit of [false,true]){
    const raw=BigInt(attack)*65536n;
    let expected=Math.max(1,rounded(mul(mul(raw,factor)-flat,coefficient)));
    if(extra>=1n&&both)expected=rounded(mul(BigInt(expected)*65536n,65536n+extra));
    if(limit)expected=Math.min(expected,1);
    assert.equal(d.finalize({attackRaw:raw,factorRaw:factor,flatRaw:flat,coefficientRaw:coefficient,extraRaw:extra,hurtShieldAndBody:both,limitHurtToOne:limit}),expected);count++;
  }
  assert.equal(count,1440);
});
test('flags sát thương đặc biệt và RNG run không đưa BigInt vào save/Game',()=>{
  const d=engine(),g={},rng=d.beginRun(g,1),before=JSON.stringify(g);
  assert.equal(d.roll(g),d.createRng(1).next());assert.equal(JSON.stringify(g),before);assert.ok(rng.state()>0);
  assert.equal(d.resolve({attack:100,canCrit:false,context:{limitHurtToOne:true}}).damage,1);
  assert.equal(d.resolve({attack:100,canCrit:false,context:{hurtOnlyOne:true}}).damage,1);
  const target={shieldHp:10};assert.equal(d.resolve({attack:100,target,context:{isUseShield:true}}).damage,0);assert.equal(target.shieldHp,10);
});
