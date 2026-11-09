import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../public/boss-attack-patterns.js', import.meta.url), 'utf8'), context);
const art = context.BossAttackPatterns;
const player = { x: 360, y: 280 };
const boss = (extra = {}) => ({ type: 'elder_dragon', isBoss: true, campaignFinalBoss: true,
  x: 160, y: 180, hp: 100, maxHp: 100, atk: 25, phaseTimer: 2, ...extra });

test('only explicitly marked final bosses expose three HP phases at exact boundaries', () => {
  for (const [hp, expected] of [[140, 1], [100, 1], [70, 1], [69.999, 2], [35, 2], [34.999, 3], [1, 3]]) {
    const e = boss({ hp }), before = JSON.stringify(e);
    const next = art.plan(e, player);
    assert.equal(next.hpPhase, expected, `hp=${hp}`);
    assert.equal(JSON.stringify(e), before, 'planning must be pure');
  }
  for (const campaignFinalBoss of [undefined, false, 1, 'true']) {
    const e = boss({ campaignFinalBoss });
    assert.equal(Object.hasOwn(art.plan(e, player), 'hpPhase'), false);
    art.fire(e, player, () => {});
    assert.equal(Object.hasOwn(e, 'hpPhase'), false);
  }
});

test('marked fire stores the planned HP phase and executes exactly the shared preview', () => {
  const e = boss({ hp: 20 }), before = { ...e }, calls = [];
  const next = art.plan(e, player);
  assert.equal(art.fire(e, player, (...args) => calls.push(args)), true);
  assert.equal(e.hpPhase, 3);
  assert.equal(e.phaseTimer, next.phase);
  assert.equal(e.attackTimer, next.cooldown);
  assert.equal(JSON.stringify(calls), JSON.stringify(next.shots.map(s => [s.x, s.y, s.angle, s.speed, s.dmg, s.r])));
  assert.deepEqual(e, { ...before, hpPhase: 3, phaseTimer: next.phase, attackTimer: next.cooldown });
});

const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const themes = ['golem', 'queen', 'demon_king', 'elder_dragon', 'eclipse_sovereign', 'astral_devourer', 'mycelium_queen'];

test('zodiac identities use thematic formations rather than merely rotating or widening a shared fan', () => {
  const plans = Object.fromEntries(signs.map(s => [s, art.plan(boss({ type: `zodiac_${s}` }), { x: 360, y: 180 })]));
  const origins = p => new Set(p.shots.map(s => `${s.x},${s.y}`)).size;
  assert.equal(origins(plans.aries), 1, 'ram horns share a charge origin');
  assert.equal(origins(plans.gemini), 2, 'twins fire from two bodies');
  assert.equal(origins(plans.cancer), 2, 'crab has two forward claws');
  assert.equal(origins(plans.virgo), 3, 'three wheat sheaves');
  assert.equal(origins(plans.scorpio), plans.scorpio.shots.length, 'segmented curling tail');
  assert.equal(origins(plans.sagittarius), plans.sagittarius.shots.length, 'arrow shafts are staggered along aim');
  assert.equal(origins(plans.aquarius), plans.aquarius.shots.length, 'water wave has spatial crests');
  assert.equal(origins(plans.pisces), 2, 'two separated fish');
  assert.notEqual(plans.gemini.shots[0].y, plans.cancer.shots[0].y);
  assert.ok(plans.sagittarius.shots.every(s => s.y === 180), 'arrow shafts follow aiming axis');
});

const geometry = next => JSON.stringify(next.shots.map(({ x, y, angle }) => [x, y, angle]));

test('marked telegraphs preview every emitted shot without mutating phases or canvas state', () => {
  for (const type of [...themes, ...signs.map(s => `zodiac_${s}`)]) for (const hp of [100, 50, 20]) {
    const e = boss({ type, hp, attackTimer: .2 }), before = JSON.stringify(e), endpoints = [];
    let depth = 0;
    const canvas = new Proxy({}, {
      get: (o, key) => key in o ? o[key] : (...args) => {
        if (key === 'save') depth++;
        if (key === 'restore') depth--;
        if (key === 'lineTo') endpoints.push(args);
        for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a));
      },
      set: (o, key, value) => { o[key] = value; return true; }
    });
    assert.equal(art.draw(canvas, e, player, 1000, true), true);
    const next = art.plan(e, player);
    assert.equal(endpoints.length, next.shots.length);
    next.shots.forEach((s, i) => {
      assert.ok(Math.abs(endpoints[i][0] - s.x - Math.cos(s.angle) * s.speed * .95) < 1e-9);
      assert.ok(Math.abs(endpoints[i][1] - s.y - Math.sin(s.angle) * s.speed * .95) < 1e-9);
    });
    assert.equal(depth, 0);
    assert.equal(JSON.stringify(e), before);
  }
});


function largestGap(shots) {
  const tau = 2 * Math.PI;
  const angles = shots.map(s => (s.angle % tau + tau) % tau).sort((a, b) => a - b);
  return Math.max(...angles.map((a, i) => (angles[(i + 1) % angles.length] + (i === angles.length - 1 ? tau : 0)) - a));
}

test('all 95 campaign encounters stay finite and bounded through all HP phases and attack cycles', () => {
  vm.runInContext(fs.readFileSync(new URL('../public/campaign-config.js', import.meta.url), 'utf8'), context);
  const encounters = [];
  for (let chapter = 1; chapter <= 19; chapter++) for (const room of [10, 20, 30, 40, 50]) {
    const config = context.ArtemisCampaignConfig.roomPlan(chapter, room);
    encounters.push(config);
  }
  assert.equal(encounters.length, 95);
  for (const encounter of encounters) for (const hp of [100, 70, 50, 35, 20]) for (const phaseTimer of [0, 1, 2]) {
    const e = boss({ type: encounter.bossType, campaignFinalBoss: encounter.isFinalBoss, hp, phaseTimer });
    const before = JSON.stringify(e), next = art.plan(e, player);
    assert.equal(JSON.stringify(e), before);
    assert.ok(next.shots.length > 0 && next.shots.length <= 16, e.type);
    assert.ok(Number.isFinite(next.cooldown) && next.cooldown >= 1.2);
    for (const s of next.shots) {
      assert.ok(Object.values(s).every(Number.isFinite), e.type);
      assert.equal(s.dmg, e.atk, 'no damage amplification');
      assert.ok(s.speed > 0 && s.speed <= 320);
      assert.ok(s.r >= 5 && s.r <= 8);
      assert.ok(Math.hypot(s.x - e.x, s.y - e.y) <= 48, 'no remote arena spawn');
    }
    if (encounter.isFinalBoss) {
      assert.ok(largestGap(next.shots) >= 1.5, `${e.type}: broad escape sector`);
      assert.equal(next.hpPhase, hp >= 70 ? 1 : hp >= 35 ? 2 : 3);
    } else assert.equal(Object.hasOwn(next, 'hpPhase'), false);
  }
});


test('every marked zodiac has its own geometry in each attack cycle and HP phase', () => {
  for (const phaseTimer of [0, 1, 2]) for (const hp of [100, 50, 20]) {
    const signatures = signs.map((sign, zodiacIndex) => geometry(art.plan(boss({ type: `zodiac_${sign}`, zodiacIndex, hp, phaseTimer }), player)));
    assert.equal(new Set(signatures).size, signs.length, `distinct signs: ${phaseTimer}/${hp}`);
  }
  for (const type of [...themes, ...signs.map(s => `zodiac_${s}`)]) {
    const signatures = [100, 50, 20].map(hp => geometry(art.plan(boss({ type, hp }), player)));
    assert.equal(new Set(signatures).size, 3, `${type}: HP phases change geometry, not just a label/speed`);
  }
});

test('seven chapter final themes never collapse to the fallback geometry', () => {
  for (const phaseTimer of [0, 1, 2]) for (const hp of [100, 50, 20]) {
    const signatures = [...themes, 'unknown_boss'].map(type => geometry(art.plan(boss({ type, hp, phaseTimer }), player)));
    assert.equal(new Set(signatures).size, themes.length + 1);
  }
});

