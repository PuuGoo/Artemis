// EXP trong lượt: giữ giá trị ngọc thật, tách hoàn toàn khỏi luồng nhận kỹ năng.
(function (root) {
  'use strict';
  function threshold(level) {
    // Safe Valkyrie rooms drop no gems. Total LV10 cost 7218 fits all combat rosters (7176, 7368].
    return Math.round(59 * Math.pow(1.62, Math.max(0, Math.min(8, Math.floor(Number(level) || 1) - 1))));
  }
  // Trả số cấp tăng; chỉ sửa level/xp/xpNext của player, không chạm kỹ năng/save.
  function gain(player, amount) {
    var before = Math.max(1, Math.min(10, Math.floor(Number(player.level) || 1)));
    player.level = before;
    player.xp = Math.max(0, Number.isFinite(player.xp) ? player.xp : 0);
    player.xp += Math.max(0, Number.isFinite(amount) ? amount : 0);
    while (player.level < 10 && player.xp >= threshold(player.level)) {
      player.xp -= threshold(player.level);
      player.level++;
    }
    if (player.level === 10) player.xp = 0;
    player.xpNext = threshold(player.level);
    return player.level - before;
  }
  // Giá trị MỖI ngọc; số ngọc vẫn là 2/quái và 8/trùm ở production.
  function dropValue(isBoss, greedMult) {
    var mult = Number.isFinite(greedMult) ? Math.max(0, greedMult) : 1;
    return Math.round((isBoss ? 35 : 22) * mult);
  }
  root.ArtemisCampaignExp = Object.freeze({ threshold: threshold, gain: gain, dropValue: dropValue });
})(globalThis);
