/* Một kế hoạch đạn dùng chung cho bắn và cảnh báo: không nhân sát thương hoặc đổi nhịp AI. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function plan(e, p) {
    if (!e || !p || !e.isBoss || !(e.hp > 0) || ![e.x, e.y, p.x, p.y, e.atk].every(Number.isFinite)) return null;
    const phase = ((Number(e.phaseTimer) || 0) + 1) % 3;
    const angle = Math.atan2(p.y - e.y, p.x - e.x);
    const shots = [];
    const shot = (x, y, a, speed, r) => shots.push({ x, y, angle: a, speed, dmg: e.atk, r });
    let cooldown;
    if (String(e.type).startsWith('zodiac_')) {
      const rage = e.hp / Math.max(1, e.maxHp) < .45;
      const sign = e.zodiacIndex || 0;
      if (phase === 0) {
        const n = rage ? 18 : 14;
        for (let k = 0; k < n; k++) if (k !== 0 && k !== n - 1) shot(e.x, e.y, angle + (k + sign * .27) * TAU / n, rage ? 260 : 220, 6);
      } else if (phase === 1) {
        for (const k of [-3, -2, -1, 1, 2, 3]) shot(e.x, e.y, angle + k * (.16 + sign % 3 * .03), rage ? 305 : 265, 6);
      } else {
        for (let k = -2; k <= 2; k++) {
          shot(e.x - 24, e.y, angle + k * .16 + sign * .035, 285, 6);
          shot(e.x + 24, e.y, angle - k * .16 - sign * .035, 285, 6);
        }
      }
      cooldown = rage ? 1.05 : 1.5;
    } else if (e.type === 'mycelium_queen') {
      const rage = e.hp / Math.max(1, e.maxHp) < .45;
      if (phase === 0) {
        const count = rage ? 18 : 14;
        for (let k = 0; k < count; k++) if (k !== 0 && k !== 1 && k !== count - 1) shot(e.x, e.y, angle + k * TAU / count, rage ? 250 : 205, 7);
      } else if (phase === 1) {
        for (const k of [-3, -2, -1, 1, 2, 3]) shot(e.x, e.y, angle + k * .19, rage ? 290 : 245, 6);
      } else {
        for (const offset of [-.35, -.18, .18, .35]) {
          shot(e.x - 24, e.y, angle + offset, 265, 6);
          shot(e.x + 24, e.y, angle - offset, 265, 6);
        }
      }
      cooldown = rage ? 1 : 1.45;
    } else if (e.type === 'eclipse_sovereign') {
      const rage = e.hp / Math.max(1, e.maxHp) < .5;
      if (phase === 0) {
        const count = rage ? 20 : 16;
        for (let k = 0; k < count; k++) shot(e.x, e.y, angle + k * TAU / count, rage ? 248 : 218, 7);
      } else if (phase === 1) {
        const spread = rage ? 4 : 3;
        for (let k = -spread; k <= spread; k++) shot(e.x, e.y, angle + k * (rage ? .145 : .18), rage ? 305 : 270, 7);
      } else {
        for (let k = 0; k < 8; k++) shot(e.x, e.y, k * Math.PI / 4 + (rage ? Math.PI / 8 : 0), rage ? 285 : 235, 8);
        if (rage) for (const offset of [-.12, .12]) shot(e.x, e.y, angle + offset, 330, 6);
      }
      cooldown = rage ? 1.12 : 1.52;
    } else if (e.type === 'elder_dragon') {
      if (phase === 0) {
        for (let k = 0; k < 12; k++) shot(e.x, e.y, angle + k * TAU / 12, 205, 7);
      } else if (phase === 1) {
        for (let k = -2; k <= 2; k++) shot(e.x, e.y, angle + k * .19, 255, 7);
      } else {
        for (const offset of [-.13, 0, .13]) shot(e.x, e.y, angle + offset, 320, 8);
      }
      cooldown = 1.55;
    } else {
      if (phase === 0) {
        for (let k = 0; k < 8; k++) shot(e.x, e.y, angle + k * TAU / 8, 210, 7);
      } else if (phase === 1) {
        for (let k = -1; k <= 1; k++) shot(e.x, e.y, angle + k * .24, 260, 7);
      } else shot(e.x, e.y, angle, 310, 8);
      cooldown = 1.45;
    }
    return { phase, cooldown, shots };
  }

  function fire(e, p, spawn) {
    const next = plan(e, p);
    if (!next) return false;
    e.phaseTimer = next.phase;
    e.attackTimer = next.cooldown;
    for (const s of next.shots) spawn(s.x, s.y, s.angle, s.speed, s.dmg, s.r);
    return true;
  }

  function draw(c, e, p, now, quiet) {
    if (!e || !(e.attackTimer > 0 && e.attackTimer < .48)) return false;
    const next = plan(e, p);
    if (!next) return false;
    const charge = 1 - e.attackTimer / .48;
    c.save();
    try {
      const width = 1.8 + charge;
      c.setLineDash([6, 7]);
      c.lineDashOffset = quiet || motion.matches ? 0 : -(Number(now) || 0) * .015;
      // Dự báo hướng bắn hiện tại; không vẽ như vùng gây sát thương diện rộng.
      for (const s of next.shots) {
        const length = s.speed * .95;
        const dx = Math.cos(s.angle), dy = Math.sin(s.angle);
        const start = Math.max(12, Number(e.r) || 12);
        c.beginPath();
        c.moveTo(s.x + dx * start, s.y + dy * start);
        c.lineTo(s.x + dx * length, s.y + dy * length);
        c.strokeStyle = '#07111e'; c.lineWidth = width + 2.5; c.globalAlpha = .65;
        c.stroke();
        c.strokeStyle = '#fda4af'; c.lineWidth = width; c.globalAlpha = .5 + charge * .35;
        c.stroke();
      }
      c.setLineDash([]);
      c.strokeStyle = '#fda4af'; c.lineWidth = width;
      c.globalAlpha = .65;
      c.beginPath(); c.arc(e.x, e.y, (Number(e.r) || 12) + 10, -Math.PI / 2, -Math.PI / 2 + charge * TAU); c.stroke();
    } finally { c.restore(); }
    return true;
  }
  root.BossAttackPatterns = { plan, fire, draw };
})(globalThis);
