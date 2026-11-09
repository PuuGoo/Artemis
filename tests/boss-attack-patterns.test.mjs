import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { originalBossAttack } from './fixtures/boss-attacks-before-extraction.mjs';

const source = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

const moduleUrl = new URL('../public/boss-attack-patterns.js', import.meta.url);
function patterns(media = { matches: false }) {
  assert.ok(fs.existsSync(moduleUrl), 'thiếu bộ mẫu đòn dùng chung cho bắn và cảnh báo');
  const ctx = vm.createContext({ matchMedia: () => media });
  vm.runInContext(fs.readFileSync(moduleUrl, 'utf8'), ctx);
  return ctx.BossAttackPatterns;
}

// Oracle cố định trước khi tách, không dùng module mới để tự sinh expected.
function currentAttack(enemy, player) {
  const bullets = [];
  const e = JSON.parse(JSON.stringify(enemy));
  const p = { ...player };
  originalBossAttack(e, p, (x, y, angle, speed, dmg, r) => bullets.push({ x, y, angle, speed, dmg, r }));
  return { e, bullets };
}

test('kế hoạch đòn/cảnh báo khớp nhánh bắn production của mọi boss, cả thường và cuồng nộ', () => {
  const art = patterns();
  const bosses = ['golem', 'queen', 'demon_king', 'elder_dragon', 'eclipse_sovereign', 'astral_devourer', 'mycelium_queen',
    ...['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'].map(x => `zodiac_${x}`)];
  for (const type of bosses) for (const phaseTimer of [0, 1, 2]) for (const hp of [100, 70, 50, 35, 20]) {
    const e = { type, phaseTimer, isBoss: true, x: 100, y: 160, hp, maxHp: 100, atk: 55,
      zodiacIndex: type.startsWith('zodiac_') ? bosses.indexOf(type) - 7 : 0 };
    const p = { x: 330, y: 440 };
    const before = JSON.stringify(e);
    const expected = currentAttack(e, p), actual = art.plan(e, p);
    assert.equal(JSON.stringify(actual.shots), JSON.stringify(expected.bullets), `${type}/${phaseTimer}/${hp}`);
    assert.equal(actual.cooldown, expected.e.attackTimer);
    assert.equal(actual.phase, expected.e.phaseTimer);
    assert.equal(JSON.stringify(e), before, 'preview không sửa boss');
  }
});

test('cảnh báo giữ khe né của zodiac và không nhận entity chết/sai tọa độ', () => {
  const art = patterns();
  const e = { type: 'zodiac_aries', isBoss: true, x: 100, y: 100, hp: 100, maxHp: 100, atk: 10, phaseTimer: 2, zodiacIndex: 0 };
  const p = { x: 200, y: 100 };
  const plan = art.plan(e, p);
  assert.equal(plan.shots.length, 12);
  assert.ok(plan.shots.every(s => Math.abs(s.angle) > .01));
  assert.equal(art.plan({ ...e, hp: 0 }, p), null);
  assert.equal(art.plan({ ...e, x: NaN }, p), null);
  assert.equal(art.plan(e, { x: Infinity, y: 2 }), null);
});

test('bắn thực thi đúng kế hoạch và chỉ đổi phase/cooldown của boss', () => {
  const art = patterns();
  const e = { type: 'elder_dragon', isBoss: true, x: 80, y: 90, hp: 100, maxHp: 100, atk: 40, phaseTimer: 0 };
  const p = { x: 300, y: 400 }, before = JSON.stringify(e), playerBefore = JSON.stringify(p);
  const next = art.plan(e, p), shots = [];
  assert.equal(art.fire(e, p, (...args) => shots.push(args)), true);
  assert.equal(JSON.stringify(shots), JSON.stringify(next.shots.map(s => [s.x, s.y, s.angle, s.speed, s.dmg, s.r])));
  assert.equal(JSON.stringify({ ...e, phaseTimer: 0, attackTimer: undefined }), before);
  assert.equal(JSON.stringify(p), playerBefore);
  assert.equal(e.attackTimer, next.cooldown);
  assert.equal(e.phaseTimer, next.phase);
});

test('renderer cảnh báo vẽ đúng hướng, không sửa entity và cân bằng trạng thái canvas', () => {
  const art = patterns();
  for (const quiet of [false, true]) {
    const e = { type: 'zodiac_aries', isBoss: true, x: 100, y: 100, r: 20, hp: 100, maxHp: 100, atk: 55, phaseTimer: 2, zodiacIndex: 0, attackTimer: .2 };
    const p = { x: 300, y: 100 }, before = JSON.stringify(e), calls = [];
    let depth = 0;
    const c = new Proxy({}, { get: (o, k) => k in o ? o[k] : ((...args) => {
      if (k === 'save') depth++;
      if (k === 'restore') depth--;
      for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a));
      calls.push([k, ...args]);
    }), set: (o, k, v) => { o[k] = v; return true; } });
    assert.equal(art.draw(c, e, p, 1000, quiet), true);
    const lines = calls.filter(a => a[0] === 'lineTo');
    const shots = art.plan(e, p).shots;
    assert.equal(lines.length, shots.length);
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      assert.ok(Math.abs(lines[i][1] - (s.x + Math.cos(s.angle) * s.speed * .95)) < 1e-9);
      assert.ok(Math.abs(lines[i][2] - (s.y + Math.sin(s.angle) * s.speed * .95)) < 1e-9);
    }
    assert.equal(quiet ? c.lineDashOffset === 0 : c.lineDashOffset < 0, true);
    assert.equal(depth, 0);
    assert.equal(JSON.stringify(e), before);
    assert.equal(art.draw(c, { ...e, attackTimer: 1 }, p, 1000, quiet), false);
  }
});

test('renderer bỏ qua entity thiếu thay vì làm chết vòng render', () => {
  const art = patterns();
  assert.equal(art.draw({}, null, { x: 1, y: 2 }, 0, true), false);
});

test('giảm chuyển động hệ thống và lowGfx giữ cảnh báo nhưng không cuộn nét đứt', () => {
  const media = { matches: false }, art = patterns(media);
  const e = { type: 'golem', isBoss: true, x: 100, y: 160, r: 20, hp: 100, maxHp: 100, atk: 55, phaseTimer: 0, attackTimer: .2 };
  const p = { x: 300, y: 400 };
  const c = new Proxy({}, { get: (o, k) => k in o ? o[k] : (() => {}), set: (o, k, v) => { o[k] = v; return true; } });
  assert.equal(art.draw(c, e, p, 1000, false), true);
  assert.ok(c.lineDashOffset < 0);
  media.matches = true;
  assert.equal(art.draw(c, e, p, 2000, false), true);
  assert.equal(c.lineDashOffset, 0);
  media.matches = false;
  assert.equal(art.draw(c, e, p, 3000, true), true);
  assert.equal(c.lineDashOffset, 0);
});

test('tia cảnh báo có viền tối dưới nét hồng để không chìm trên sàn sáng', () => {
  const art = patterns(), strokes = [];
  const c = new Proxy({}, { get: (o, k) => k in o ? o[k] : (() => { if (k === 'stroke') strokes.push({ color: o.strokeStyle, width: o.lineWidth }); }), set: (o, k, v) => { o[k] = v; return true; } });
  const e = { type: 'golem', isBoss: true, x: 100, y: 160, r: 20, hp: 100, maxHp: 100, atk: 55, phaseTimer: 0, attackTimer: .2 };
  art.draw(c, e, { x: 300, y: 400 }, 1000, false);
  assert.equal(strokes[0].color, '#07111e');
  assert.equal(strokes[1].color, '#fda4af');
  assert.ok(strokes[0].width > strokes[1].width);
});

test('nhánh bắn và cảnh báo production thực sự gọi cùng một bộ mẫu', () => {
  assert.ok(source.includes('<script src="/boss-attack-patterns.js"></script>'), 'trang thật phải tải module');
  const start = source.indexOf('            if (e.isBoss) {', source.indexOf('// Ranged Attacks'));
  const end = source.indexOf("            } else if (e.type === 'spore_runner')", start);
  const warningStart = source.indexOf('// Boss Attack Telegraph Warning Sightlines');
  const warningEnd = source.indexOf('// 10. Animated Drops', warningStart);
  assert.ok(start >= 0 && end > start && warningStart >= 0 && warningEnd > warningStart);
  const art = patterns();
  let fires = 0, draws = 0;
  const shared = { ...art, fire(...args) { fires++; return art.fire(...args); }, draw(...args) { draws++; return art.draw(...args); } };
  const types = ['golem', 'queen', 'demon_king', 'elder_dragon', 'eclipse_sovereign', 'astral_devourer', 'mycelium_queen',
    ...Array.from({ length: 12 }, (_, i) => `zodiac_${i}`)];
  let cases = 0;
  for (const type of types) for (const phaseTimer of [0, 1, 2]) for (const hp of [100, 70, 50, 35, 20]) {
    const e = { type, isBoss: true, x: 100, y: 160, r: 20, hp, maxHp: 100, atk: 55, phaseTimer, zodiacIndex: types.indexOf(type) - 7, attackTimer: .2 };
    const p = { x: 330, y: 440 }, expected = currentAttack(e, p), bullets = [], endpoints = [];
    const before = JSON.stringify(e);
    const c = new Proxy({}, { get: (o, k) => k in o ? o[k] : ((...args) => { if (k === 'lineTo') endpoints.push(args); }), set: (o, k, v) => { o[k] = v; return true; } });
    vm.runInNewContext(source.slice(warningStart, warningEnd), { Game: { player: p, enemies: [e], lowGfx: true }, ctx: c, nowMs: 1000, window: { BossAttackPatterns: shared } });
    assert.equal(JSON.stringify(e), before, 'cảnh báo không sửa boss');
    assert.equal(endpoints.length, expected.bullets.length, type + '/telegraph');
    for (let i = 0; i < endpoints.length; i++) {
      const s = expected.bullets[i];
      assert.ok(Math.abs(endpoints[i][0] - s.x - Math.cos(s.angle) * s.speed * .95) < 1e-9);
      assert.ok(Math.abs(endpoints[i][1] - s.y - Math.sin(s.angle) * s.speed * .95) < 1e-9);
    }
    vm.runInNewContext(`const ang = Math.atan2(p.y - e.y, p.x - e.x);\n${source.slice(start, end)}\n}`, {
      e, p, window: { BossAttackPatterns: shared }, spawnEnemyBullet(x, y, angle, speed, dmg, r) { bullets.push({ x, y, angle, speed, dmg, r }); },
    });
    assert.equal(JSON.stringify(bullets), JSON.stringify(expected.bullets), type + '/actual-shot');
    assert.equal(e.attackTimer, expected.e.attackTimer);
    assert.equal(e.phaseTimer, expected.e.phaseTimer);
    cases++;
  }
  assert.equal(fires, cases);
  assert.equal(draws, cases);
});
