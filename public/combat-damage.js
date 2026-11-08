/* Số học combat phục hồi từ nhánh native mặc định; không chứa payload/game SDK. */
(function (root) {
  'use strict';
  const Q = 65536n;
  const finite = (v, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  function toRaw(value, fallback = 0) {
    const scaled = Math.round(finite(value, fallback) * Number(Q));
    // Giữ miền đầu vào chính xác của Number; không đưa Infinity/NaN vào BigInt.
    return BigInt(Math.max(-Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, scaled)));
  }
  const multiply = (a, b) => BigInt.asIntN(64, (a * b) >> 16n);
  const multiplyLow64 = (a, b) => BigInt.asIntN(64, a * b) >> 16n;
  const roundRaw = raw => Number((raw + Q / 2n) >> 16n);
  function createRng(seed) {
    let state = BigInt.asUintN(48, BigInt(Math.trunc(finite(seed))));
    return {
      next(a = 0, b = 65536) {
        a = Math.trunc(finite(a)); b = Math.trunc(finite(b));
        state = BigInt.asUintN(48, state * 25214903917n + 11n);
        const low = Math.min(a, b), range = BigInt(Math.abs(b - a));
        return low + Number(((state >> 32n) * range) >> 16n);
      },
      state: () => Number(state)
    };
  }
  const runs = new WeakMap();
  function beginRun(game, seed = Math.floor(Math.random() * 281474976710656)) {
    const rng = createRng(seed);
    runs.set(game, rng);
    return rng;
  }
  function roll(game) {
    const rng = runs.get(game) || beginRun(game);
    return rng.next();
  }
  const attribute = (attrs, name, fallback = 0) => toRaw(attrs?.[name], fallback);
  function getDecrease(attrs = {}, context = {}) {
    let flat = attribute(attrs, 'HurtDecrease');
    let coefficient = attribute(attrs, 'HurtDecreasePercent', 1);
    const apply = value => { coefficient = multiplyLow64(coefficient, value); };
    const applyAttr = name => apply(attribute(attrs, name, 1));
    const race = finite(context.ownerRaceFlag) >>> 0;
    if (context.targetIsHero) {
      if (!context.moving) {
        applyAttr('StandHurtDecreasePercent');
        flat = BigInt.asIntN(64, flat + attribute(attrs, 'StandHurtDecrease'));
      }
      if (context.attackerType === 3) {
        flat = BigInt.asIntN(64, flat + attribute(attrs, 'BodyHurtDecrease'));
        applyAttr('BodyHurtDecreasePercent');
      } else if (context.attackerType === 1) applyAttr('BulletHurtDecreasePercent');
      const raceAttr = race & 2 ? 'HurtReduceForMonsterPercent'
        : race & 8 ? 'HurtReduceForBossPercent'
          : race & 4 ? 'HurtReduceForElitePercent'
            : race & 0x58090 ? 'HurtReduceForPlayerPercent' : null;
      if (raceAttr) applyAttr(raceAttr);
      applyAttr(race & 32 ? 'HurtReduceForFlyPercent' : 'HurtReduceForGroundPercent');
      if (context.swordReduction) apply(Q - toRaw(context.swordReduction));
    }
    const invHurt = toRaw(context.invHurt);
    if (invHurt >= 1n && context.invincible) apply(invHurt);
    const elementAttr = {2:'FireHurtDecreasePercent',3:'PoisonHurtDecreasePercent',4:'IceHurtDecreasePercent',5:'ThunderHurtDecreasePercent'}[context.hurtType];
    if (elementAttr) applyAttr(elementAttr);
    if ([2,3,4,5,8].includes(context.hurtType)) applyAttr('ElementHurtDecreasePercent');
    const extraAttr = {1:'RotateBallHurtDecreasePercent',2:'SwardHurtDecreasePercent',3:'StarHurtDecreasePercent',4:'MainWeaponHurtDecreasePercent',5:'SpriteHurtDecreasePercent',6:'PlantHurtDecreasePercent',7:'RotateBallHurtDecreasePercent'}[context.exHurtAttack];
    if (extraAttr) applyAttr(extraAttr);
    const vulnerability = {1:'BallVulnerabilityPercent',2:'FlySwardVulnerabilityPercent',3:'StarFallVulnerabilityPercent',5:'SpriteVulnerabilityPercent',7:'BallVulnerabilityPercent'}[context.exHurtAttack];
    if (vulnerability) apply(Q + attribute(attrs, vulnerability));
    // Cầu nối chỉ số Artemis: không gán DEF lần nữa vào giảm flat.
    for (const modifier of context.coefficientModifiers || []) apply(toRaw(modifier, 1));
    return { flat, coefficient };
  }
  function resolveCrit(source = {}, attrs = {}, targetIsHero = false, sample = 0, secKill = false) {
    const normal = { isCrit:false, superCrit:false, multiplier:Q };
    if (secKill || !Number.isInteger(sample) || sample < 0 || sample >= 65536) return normal;
    const playerResistance = targetIsHero && ((finite(source.OwnerRaceFlag) >>> 0) & 0x58090) !== 0;
    let threshold = attribute(source, 'CritRate') - attribute(attrs, 'CriReducePercent');
    if (targetIsHero) threshold += attribute(source, 'CriForPlayer');
    if (playerResistance) threshold -= attribute(attrs, 'CriReduceForPlayerPercent');
    const value = BigInt(sample);
    if (value >= threshold + attribute(source, 'SuperCirtRate')) return normal;
    let multiplier = attribute(source, 'CritValue', 1.85) - attribute(attrs, 'CirHurtReducePercent');
    if (targetIsHero) multiplier += attribute(source, 'CriValueForPlayer');
    if (playerResistance) multiplier -= attribute(attrs, 'CriValueReduceForPlayerPercent');
    const superCrit = value > threshold;
    if (superCrit) multiplier += attribute(source, 'SuperCritValue');
    return { isCrit:true, superCrit, multiplier:multiplier < 66191n ? 66191n : multiplier };
  }
  function finalize({ attackRaw, factorRaw, flatRaw, coefficientRaw, extraRaw = 0n, hurtShieldAndBody = false, limitHurtToOne = false }) {
    const raw = multiply(BigInt.asIntN(64, multiply(attackRaw, factorRaw) - flatRaw), coefficientRaw);
    let damage = Math.max(1, roundRaw(raw));
    if (extraRaw >= 1n && hurtShieldAndBody) damage = roundRaw(multiply(toRaw(damage), Q + extraRaw));
    return limitHurtToOne && damage > 1 ? 1 : damage;
  }
  function absorbShield(target, damage, both = false, events = {}) {
    const normal = Math.max(0, finite(target.shieldHp));
    const extra = Math.max(0, finite(target.darkShieldHp));
    const total = normal + extra, absorbed = Math.min(total, Math.max(0, damage));
    const broken = total > 0 && total <= damage;
    const change = () => {
      if (typeof target.combatChangeFlags === 'number') target.combatChangeFlags = Number(BigInt(Math.trunc(target.combatChangeFlags)) | (1n << 30n));
      events.onChange?.(target);
    };
    if (broken) {
      events.onBreakEffect?.(target);
      if (typeof target.combatFlags === 'number') target.combatFlags = Number(BigInt(Math.trunc(target.combatFlags)) & ~((1n << 35n) | (1n << 37n)));
      events.onClearFlags?.(target);
      events.onBreak?.(target);
      change();
      if ('shieldHp' in target) target.shieldHp = 0;
      if ('darkShieldHp' in target) target.darkShieldHp = 0;
      events.onClear?.(target);
      // Chỉ chuyển callback; không suy ID buff thương mại thành skill Artemis.
      if (finite(target.shieldBreakBuffId) >= 1) events.onBreakBuff?.(target, target.shieldBreakBuffId);
    } else if (total > 0) {
      if (extra > 0) {
        target.darkShieldHp = Math.max(0, extra - damage);
        change();
      }
      if (extra < damage || extra === 0) {
        if ('shieldHp' in target) target.shieldHp = Math.max(0, normal - Math.max(0, damage - extra));
        change();
      }
    }
    return { absorbed, hpDamage:both ? damage : Math.max(0, damage - absorbed), shieldBroken:broken };
  }
  function resolve({ attack, source = {}, target = {}, context = {}, canCrit = true, critRoll = 0, shieldEvents = {} } = {}) {
    const empty = { damage:0, hpDamage:0, absorbed:0, isCrit:false, superCrit:false, shieldBroken:false };
    if (!(finite(attack) > 0)) return empty;
    const attrs = target.combatAttributes || {};
    const crit = canCrit ? resolveCrit(source, attrs, !!context.targetIsHero, critRoll, !!context.secKill) : { isCrit:false, superCrit:false, multiplier:Q };
    let base = roundRaw(multiply(toRaw(attack), crit.multiplier));
    if (context.isUseShield) return { ...empty, isCrit:crit.isCrit, superCrit:crit.superCrit };
    let damage;
    if (context.hurtOnlyOne) {
      damage = context.hurtShieldAndBody && toRaw(context.extraHurtPercent) >= 1n ? roundRaw(Q + toRaw(context.extraHurtPercent)) : 1;
    } else {
      const raw = multiply(toRaw(base), Q + attribute(attrs, 'VulnerabilityPercent'));
      let factor = Q + attribute(source, 'FinalHurt') - attribute(attrs, 'FinaHurtReducePercent');
      // [0.2,5] từ Consts; lượng tử hóa .2 theo quy ước đầu vào web, chưa claim parser gốc.
      factor = factor < toRaw(.2) ? toRaw(.2) : factor > 5n * Q ? 5n * Q : factor;
      const decrease = getDecrease(attrs, context);
      damage = finalize({attackRaw:raw,factorRaw:factor,flatRaw:decrease.flat,coefficientRaw:decrease.coefficient,extraRaw:toRaw(context.extraHurtPercent),hurtShieldAndBody:!!context.hurtShieldAndBody,limitHurtToOne:!!context.limitHurtToOne});
    }
    const shield = absorbShield(target, damage, !!context.hurtShieldAndBody, shieldEvents);
    return { damage, ...shield, isCrit:crit.isCrit, superCrit:crit.superCrit };
  }
  root.CombatDamage = { toRaw, multiply, multiplyLow64, roundRaw, createRng, beginRun, roll, getDecrease, resolveCrit, finalize, absorbShield, resolve };
})(globalThis);
