// Biên soạn đội hình chiến dịch; không đọc chỉ số hoặc thay đổi save người chơi.
(function (root) {
  'use strict';
  var archetypes = ['learning', 'ranged', 'elite', 'control', 'group'];
  // Vai trò mô tả AI đang có: area ép vị trí bằng vòng đạn, không tự thêm choáng/trói.
  var families = [
    ['slime', 'goblin', 'plant_turret', 'skeleton_mage'],
    ['dragon_whelp', 'sky_sentinel', 'cloud_wisp', 'dragon_whelp'],
    ['rift_stalker', 'eclipse_oracle', 'obsidian_brute', 'eclipse_oracle'],
    ['bat', 'goblin', 'plant_turret', 'skeleton_mage'],
    ['spore_runner', 'mire_shaman', 'hive_guardian', 'mire_shaman']
  ];
  var pressures = { slime: 0, bat: 0, goblin: 1 / 2.1, skeleton_mage: 3 / 2.5,
    plant_turret: 4 / 2.3, dragon_whelp: 3 / 2.05, sky_sentinel: 3 / 2.6,
    cloud_wisp: 6 / 2.8, rift_stalker: 3 / 2.25, eclipse_oracle: 5 / 2.75,
    obsidian_brute: 8 / 3.1, spore_runner: 2 / 2.1, mire_shaman: 5 / 2.8,
    hive_guardian: 8 / 3 };
  function chapterNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.max(1, Math.min(19, Math.floor(number))) : 1;
  }
  function isSafeRoom(room) { return Number.isInteger(room) && room >= 5 && room <= 45 && room % 10 === 5; }
  function basePlan(chapterId, room) {
    var plan = root.ArtemisCampaignConfig.roomPlan(chapterNumber(chapterId), room);
    return Object.assign({}, plan, { isSafeRoom: isSafeRoom(plan.room),
      valkyrie: isSafeRoom(plan.room), type: isSafeRoom(plan.room) ? 'safe' : plan.type,
      archetype: archetypes[plan.segment],
      rhythm: isSafeRoom(plan.room) ? 'safe' : plan.room === 49 ? 'rest' : plan.isBoss ? 'boss' : 'combat',
      pressureBudget: plan.room === 49 ? 4.5 : 5 + plan.segment });
  }
  function getRoster(chapterId, room) {
    var plan = basePlan(chapterId, room);
    if (plan.isSafeRoom) return [];
    if (plan.isBoss) return [{ type: plan.bossType, role: 'boss', isElite: false, pressure: 0,
      counter: 'Né cảnh báo rồi dừng lại phản công.' }];
    var chapter = chapterNumber(chapterId);
    // Không dùng frost_sentinel/nebula_herald/star_wraith: hiện chưa có nhánh bắn riêng.
    var family = families[chapter <= 3 ? 0 : chapter <= 7 ? chapter - 3 : (chapter - 8) % families.length];
    var sequences = [[0, 1, 0, 3], [1, 0, 3, 1], [3, 0, 1, 0], [2, 0, 1, 0], [2, 0, 1, 3, 0]];
    var sequence = plan.rhythm === 'rest' ? [0, 1, 0] : sequences[plan.segment];
    var target = plan.rhythm === 'rest' ? 3 : Math.min(8, plan.count + (plan.segment === 4 ? 1 : 0));
    var roster = [], pressure = 0;
    for (var i = 0; i < target; i++) {
      var slot = sequence[i % sequence.length], type = family[slot];
      var weight = pressures[type];
      // Giảm số lượng thay vì tăng đạn; ba vị trí đầu luôn nằm trong ngân sách.
      if (pressure + weight > plan.pressureBudget && roster.length >= 3) break;
      var role = slot === 0 ? 'chaser' : slot === 2 ? 'area' : 'ranged';
      roster.push({ type: type, role: role, pressure: weight, isElite: false,
        counter: role === 'chaser' ? 'Giữ khoảng cách và vòng qua vật cản.' : role === 'area'
          ? 'Rời tâm vòng đạn, tận dụng khe hở.' : 'Nấp sau vật cản rồi phản công khi hết loạt.' });
      pressure += weight;
    }
    var eliteCount = plan.segment >= 2 && plan.rhythm !== 'rest' ? (plan.segment === 4 ? 2 : 1) : 0;
    for (var n = 0; n < eliteCount; n++) roster[n].isElite = true;
    return roster;
  }
  function getModifiers(chapterId, room, index) {
    var plan = basePlan(chapterId, room);
    var roster = getRoster(chapterId, room);
    var entry = roster[Math.max(0, Math.min(roster.length - 1, Math.floor(Number(index) || 0)))];
    if (!entry) return { isElite: false, eliteStage: 0, bossVariant: null, hpMultiplier: 1, atkMultiplier: 1, speedMultiplier: 1, sizeMultiplier: 1 };
    var stage = entry.isElite ? plan.segment - 1 : 0;
    var variant = subBossVariant(chapterId, plan);
    return { isElite: entry.isElite, eliteStage: stage, bossVariant: variant,
      hpMultiplier: 1 + stage * .15, atkMultiplier: 1 + stage * .06,
      speedMultiplier: variant ? variant.speedMultiplier : 1 + stage * .04,
      sizeMultiplier: variant ? variant.sizeMultiplier : 1 + stage * .04 };
  }
  var themes = ['Đá Cổ', 'Dung Nham', 'Hư Không', 'Thiên Không', 'Nhật Thực', 'Tinh Hà', 'Sợi Nấm',
    'Bạch Dương', 'Kim Ngưu', 'Song Tử', 'Cự Giải', 'Sư Tử', 'Xử Nữ', 'Thiên Bình', 'Bọ Cạp', 'Nhân Mã', 'Ma Kết', 'Bảo Bình', 'Song Ngư'];
  var titles = ['Vệ Binh', 'Kẻ Dệt Lưới', 'Chấp Pháp', 'Long Vệ'];
  var colors = ['#fb923c', '#c084fc', '#fb7185', '#67e8f9', '#a3e635', '#38bdf8', '#facc15'];
  function subBossVariant(chapterId, plan) {
    if (!plan.isBoss || plan.isFinalBoss) return null;
    var chapter = chapterNumber(chapterId), slot = plan.room / 10 - 1;
    return { id: 'chapter_' + chapter + '_subboss_' + (slot + 1), type: plan.bossType,
      name: titles[slot] + ' ' + themes[chapter - 1], color: colors[(chapter + slot - 1) % colors.length],
      sizeMultiplier: 1.02 + slot * .04, speedMultiplier: 1.02 + slot * .035,
      pattern: { spreadMultiplier: .82 + slot * .09 + (chapter % 3) * .015,
        bulletSpeedMultiplier: .9 + slot * .04, cooldownMultiplier: 1.12 - slot * .025 } };
  }
  // Gọi từ BossAttackPatterns.plan cho CẢ fire/draw; không bọc riêng fire làm sai cảnh báo.
  // Entity phải được setupRoom gắn campaignChapter/campaignRoom, mode khác không bị đổi.
  function applyBossPattern(pattern, enemy, player) {
    if (!pattern || !enemy || !enemy.isBoss || !Number.isFinite(enemy.campaignChapter)
      || !Number.isFinite(enemy.campaignRoom) || !player
      || ![enemy.x, enemy.y, player.x, player.y].every(Number.isFinite)) return pattern;
    var variant = subBossVariant(enemy.campaignChapter, basePlan(enemy.campaignChapter, enemy.campaignRoom));
    if (!variant) return pattern;
    var angle = Math.atan2(player.y - enemy.y, player.x - enemy.x), mods = variant.pattern;
    return Object.assign({}, pattern, { cooldown: Math.max(1, pattern.cooldown * mods.cooldownMultiplier),
      shots: pattern.shots.map(function (shot) {
        var delta = Math.atan2(Math.sin(shot.angle - angle), Math.cos(shot.angle - angle));
        return Object.assign({}, shot, { angle: angle + delta * mods.spreadMultiplier,
          speed: shot.speed * mods.bulletSpeedMultiplier });
      }) });
  }
  function roomPlan(chapterId, room) {
    var plan = basePlan(chapterId, room);
    plan.count = getRoster(chapterId, room).length;
    return plan;
  }
  root.ArtemisCampaignRooms = Object.freeze({ ROOM_COUNT: 50, isSafeRoom: isSafeRoom, roomPlan: roomPlan, getRoster: getRoster, getModifiers: getModifiers, applyBossPattern: applyBossPattern });
})(globalThis);
