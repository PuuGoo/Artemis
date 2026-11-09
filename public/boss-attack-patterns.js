/* Một kế hoạch đạn dùng chung cho bắn và cảnh báo: không nhân sát thương hoặc đổi nhịp AI. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  // Chỉ trùm cuối chiến dịch: hình học theo chủ đề, không dùng chỉ số cung để xoay cùng một vòng đạn.
  // Tia xuất phát sát boss; chừa khe giữa và cả một cung sau lưng để né.
  const campaignShapes = {
    golem: [-1.05, -.7, -.35, .35, .7, 1.05], // Mảnh đá thành ba bậc.
    queen: [-1.2, -.95, -.45, .45, .95, 1.2], // Hai cánh ong.
    demon_king: [-1.3, -.85, -.38, .38, .85, 1.3], // Đinh ba lửa tách đôi.
    elder_dragon: [-.9, -.75, -.6, -.45, .45, .6, .75, .9], // Hai luồng hơi rồng.
    eclipse_sovereign: [-1.5, -1.2, -.9, -.6, .6, .9, 1.2, 1.5], // Vành nhật thực khuyết.
    astral_devourer: [-1.4, -.8, -.3, .5, 1.1], // Xoắn thiên thạch bất đối xứng.
    mycelium_queen: [-1.15, -1, -.85, -.4, .4, .85, 1, 1.15], // Cụm bào tử.
    zodiac_aries: [-.72, -.52, .52, .72], // Hai sừng cừu.
    zodiac_taurus: [-1.25, -1.05, -.85, .85, 1.05, 1.25], // Sừng bò mở rộng.
    zodiac_gemini: [-.95, -.78, -.55, .55, .78, .95], // Hai chòm song sinh.
    zodiac_cancer: [-1.55, -1.4, -.65, .65, 1.4, 1.55], // Càng cua bao hai bên.
    zodiac_leo: [-1.45, -1.1, -.75, -.4, .4, .75, 1.1, 1.45], // Bờm sư tử hình quạt.
    zodiac_virgo: [-1.1, -1, -.9, -.55, -.45, .45, .55, .9, 1, 1.1], // Bó lúa kép.
    zodiac_libra: [-1.35, -.95, -.55, .55, .95, 1.35], // Ba cặp đĩa cân đối xứng.
    zodiac_scorpio: [-1.2, -.9, -.6, .35, .47], // Đuôi chích lệch và ba chân.
    zodiac_sagittarius: [-.58, -.42, -.26, .26, .42, .58], // Hai mũi tên hẹp.
    zodiac_capricorn: [-1.3, -.9, -.7, -.6, .6, .7, .9, 1.3], // Sừng dê dạng bậc.
    zodiac_aquarius: [-1.4, -1.15, -.8, -.35, .35, .65, 1.05, 1.4], // Sóng nước không đều.
    zodiac_pisces: [-1.3, -1.18, -.95, -.62, .42, .75, .98, 1.1] // Hai vây cá lệch nhịp.
  };
  function campaignPlan(e, phase, angle) {
    const ratio = e.hp / (Number.isFinite(e.maxHp) && e.maxHp > 0 ? e.maxHp : e.hp);
    const hpPhase = ratio >= .7 ? 1 : ratio >= .35 ? 2 : 3;
    const shape = campaignShapes[e.type] || [-.8, -.4, .4, .8];
    const spread = [.86, 1, 1.12][phase];
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const shots = shape.map((offset, i) => {
      let forward = 0, side = 0;
      switch (e.type) {
        case 'zodiac_gemini': side = Math.sign(offset) * 22; break;
        case 'zodiac_cancer': forward = 16; side = Math.sign(offset) * 26; break;
        case 'zodiac_virgo': side = (i % 3 - 1) * 16; break;
        case 'zodiac_scorpio': forward = -i * 5; side = Math.sin(i * .65) * 18; break;
        case 'zodiac_sagittarius': forward = i * 5; break;
        case 'zodiac_aquarius': forward = Math.sin(i * 1.2) * 12; side = (i - (shape.length - 1) / 2) * 6; break;
        case 'zodiac_pisces': forward = Math.sign(offset) * 14; side = Math.sign(offset) * 20; break;
      }
      return {
        x: e.x + dx * forward - dy * side, y: e.y + dy * forward + dx * side,
        angle: angle + (offset + Math.sign(offset) * (hpPhase - 1) * .055) * spread,
        speed: 210 + (hpPhase - 1) * 20 + (i % 2) * 15,
        dmg: e.atk, r: 6
      };
    });
    return { phase, hpPhase, cooldown: 1.7 - (hpPhase - 1) * .2, shots };
  }
  function plan(e, p) {
    if (!e || !p || !e.isBoss || !(e.hp > 0) || ![e.x, e.y, p.x, p.y, e.atk].every(Number.isFinite)) return null;
    const phase = ((Number(e.phaseTimer) || 0) + 1) % 3;
    const angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.campaignFinalBoss === true) return campaignPlan(e, phase, angle);
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
    if (e.campaignFinalBoss === true) e.hpPhase = next.hpPhase;
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
