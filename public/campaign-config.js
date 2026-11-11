// Quy tắc chiến dịch thuần dữ liệu, dùng chung cho game và danh mục quản trị.
(function (root) {
  'use strict';
  var ROOM_COUNT = 50;
  var zodiac = ['leo', 'aries', 'taurus', 'gemini', 'cancer', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  var subBosses = ['golem', 'queen', 'demon_king', 'elder_dragon'];
  function roomNumber(room) {
    return Math.max(1, Math.min(ROOM_COUNT, Math.floor(Number(room) || 1)));
  }
  function mobCount(room) {
    return Math.min(8, 3 + Math.floor((roomNumber(room) - 1) / 10));
  }
  function bossType(chapterId, room) {
    room = roomNumber(room);
    if (room % 10 !== 0) return null;
    if (room < ROOM_COUNT) return subBosses[room / 10 - 1];
    var chapter = Math.floor(Number(chapterId) || 1);
    return chapter >= 1 && chapter <= zodiac.length ? 'zodiac_' + zodiac[chapter - 1] : null;
  }
  function roomPlan(chapterId, room) {
    room = roomNumber(room);
    var boss = bossType(chapterId, room);
    var finalBoss = room === ROOM_COUNT;
    return {
      room: room, segment: Math.floor((room - 1) / 10),
      type: finalBoss ? 'finalBoss' : boss ? 'boss' : 'normal',
      isBoss: !!boss, isFinalBoss: finalBoss, bossType: boss,
      valkyrie: room < ROOM_COUNT && room % 5 === 0,
      count: boss ? 1 : mobCount(room)
    };
  }
  // Giữ biên độ HP/ATK cũ; trải đều theo 50 phòng, không đọc lực chiến người chơi.
  function tuning(base, room) {
    var depth = (roomNumber(room) - 1) / (ROOM_COUNT - 1);
    return {
      mobHp: Math.round(base.mobHp * (1 + depth * 1.2)),
      mobAtk: Math.round(base.mobAtk * (1 + depth * 0.5)),
      bossHp: Math.round(base.bossHp * (1 + depth * 0.35)),
      bossAtk: Math.round(base.bossAtk * (1 + depth * 0.3)), depth: depth
    };
  }
  root.ArtemisCampaignConfig = Object.freeze({
    ROOM_COUNT: ROOM_COUNT, roomPlan: roomPlan, bossType: bossType, mobCount: mobCount,
    tuning: tuning, getTuning: tuning,
    SKILL_RARITIES: Object.freeze(['common', 'rare', 'epic', 'legend'])
  });
})(globalThis);
