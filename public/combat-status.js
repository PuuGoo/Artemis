/* Trạng thái chỉ sống trên quái của lượt chơi; không đọc/ghi save. */
(function (root) {
  'use strict';
  const EPS = 1e-9;
  function applyBurn(e, tickDamage, duration) {
    if (!(e.hp > 0)) return;
    if (!(e.burnTimer > 0)) { e.burnTick = 0; e.burnDmg = 0; }
    e.burnDmg = Math.max(e.burnDmg || 0, tickDamage);
    e.burnTimer = Math.max(e.burnTimer || 0, duration);
  }
  function tickBurn(e, dt, damage) {
    if (!(e.burnTimer > 0) || !(e.hp > 0)) { e.burnTick = 0; return; }
    const active = Math.min(Math.max(0, dt), e.burnTimer);
    e.burnTimer = Math.max(0, e.burnTimer - active);
    if (e.burnTimer < EPS) e.burnTimer = 0;
    // Giữ ngân sách cũ: 3 nhịp/giây; chỉ tích thời gian thực sự còn cháy.
    e.burnTick = (e.burnTick || 0) + active;
    while (e.burnTick + EPS >= 1 / 3 && e.hp > 0) {
      e.burnTick = Math.max(0, e.burnTick - 1 / 3);
      damage(e, e.burnDmg, true, 'fire');
    }
    // Đuôi thời lượng lẻ (ví dụ 2,5s) không mất sát thương và không kéo dài sang khung sau.
    if (!e.burnTimer && e.burnTick > EPS && e.hp > 0) damage(e, e.burnDmg * e.burnTick * 3, true, 'fire');
    if (!e.burnTimer || e.hp <= 0) e.burnTick = 0;
  }
  function applyPoison(e, dps, duration = Infinity) {
    if (!(e.hp > 0)) return;
    if (!e.poisonActive) { e.poisonTick = 0; e.poisonDmg = 0; e.poisonTimer = 0; }
    e.poisonActive = true;
    // Một lớp độc mạnh nhất; đánh lại không cộng lớp hay dời nhịp đang chạy.
    e.poisonDmg = Math.max(e.poisonDmg, dps);
    e.poisonTimer = Math.max(e.poisonTimer, duration);
  }
  function tickPoison(e, dt, damage) {
    if (!e.poisonActive || !(e.hp > 0)) return;
    const active = Math.min(Math.max(0, dt), e.poisonTimer);
    e.poisonTimer = Math.max(0, e.poisonTimer - active);
    if (e.poisonTimer < EPS) e.poisonTimer = 0;
    e.poisonTick = (e.poisonTick || 0) + active;
    while (e.poisonTick + EPS >= 1 && e.hp > 0) {
      e.poisonTick = Math.max(0, e.poisonTick - 1);
      damage(e, e.poisonDmg, true, 'poison');
    }
    if (!e.poisonTimer && e.poisonTick > EPS && e.hp > 0) damage(e, e.poisonDmg * e.poisonTick, true, 'poison');
    if (!e.poisonTimer || e.hp <= 0) { e.poisonActive = false; e.poisonTick = 0; }
  }
  root.CombatStatus = { applyBurn, tickBurn, applyPoison, tickPoison };
})(globalThis);
