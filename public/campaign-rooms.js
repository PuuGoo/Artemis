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
    return Number.isFinite(number) ? Math.max(1, Math.min(12, Math.floor(number))) : 1;
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
    if (plan.isBoss) {
      var bossVariant = subBossVariant(chapterId, plan);
      return [{ type: plan.bossType, role: 'boss', isElite: false, pressure: 0,
        counter: bossVariant ? bossVariant.counter : 'Né cảnh báo rồi dừng lại phản công.' }];
    }
    var chapter = chapterNumber(chapterId);
    // Không dùng frost_sentinel/nebula_herald/star_wraith: hiện chưa có nhánh bắn riêng.
    var family = families[(chapter - 1) % families.length];
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
  var themes = ['Sư Tử', 'Bạch Dương', 'Kim Ngưu', 'Song Tử', 'Cự Giải', 'Xử Nữ', 'Thiên Bình', 'Bọ Cạp', 'Nhân Mã', 'Ma Kết', 'Bảo Bình', 'Song Ngư'];
  var titles = ['Vệ Binh', 'Kẻ Dệt Lưới', 'Chấp Pháp', 'Long Vệ'];
  var colors = ['#fb923c', '#c084fc', '#fb7185', '#67e8f9', '#a3e635', '#38bdf8', '#facc15'];
  // Riêng Leo (chương 1) có bốn thủ lĩnh chibi của Thánh Điện Nhật Luân.
  // Giữ type gốc để tái sử dụng AI, hitbox, save và hợp đồng boss hiện hành.
  var leoGuardians = Object.freeze([
    { name: 'Ares – Tướng Quân Hỏa Ngục', color: '#fb923c', skill: 'Hỏa Ngục Toái Trảm',
      counter: 'Tránh quạt lửa trước mặt Ares, vòng ra cạnh sau khi lưỡi rìu phát xạ.' },
    { name: 'Boreas – Tướng Quân Phong Băng', color: '#38bdf8', skill: 'Băng Phong Song Nhận',
      counter: 'Né giữa hai luồng phong băng lệch tâm, phản công khi Boreas hồi sức.' },
    { name: 'Terra – Tướng Quân Đại Địa', color: '#a3e635', skill: 'Địa Chấn Liên Hoàn',
      counter: 'Đọc các đường địa chấn so le, luồn vào khoảng trống rồi phản công.' },
    { name: 'Nyx – Tướng Quân Hư Ảnh', color: '#c084fc', skill: 'Hư Ảnh Giao Thoa',
      counter: 'Tránh hai luồng ma thuật đan nhau, giữ khoảng cách khi Nyx phát xạ.' }
  ]);
  function subBossVariant(chapterId, plan) {
    if (!plan.isBoss || plan.isFinalBoss) return null;
    var chapter = chapterNumber(chapterId), slot = plan.room / 10 - 1;
    var leo = chapter === 1 ? leoGuardians[slot] : null;
    var studio = root.ArtemisContentRuntime?.bossFor(chapter,plan.room);
    return { id: 'chapter_' + chapter + '_subboss_' + (slot + 1), type: plan.bossType,
      name: studio ? studio.name : leo ? leo.name : titles[slot] + ' ' + themes[chapter - 1],
      color: studio ? studio.color : leo ? leo.color : colors[(chapter + slot - 1) % colors.length],
      skill: leo ? leo.skill : null, counter: leo ? leo.counter : 'Né cảnh báo rồi dừng lại phản công.',
      sizeMultiplier: leo ? 1.05 + slot * .05 : 1.02 + slot * .04,
      speedMultiplier: leo ? 1.03 + slot * .03 : 1.02 + slot * .035,
      pattern: { spreadMultiplier: .82 + slot * .09 + (chapter % 3) * .015,
        bulletSpeedMultiplier: .9 + slot * .04, cooldownMultiplier: 1.12 - slot * .025 } };
  }
  // Một kế hoạch đạn duy nhất được BossAttackPatterns.plan / arm / fire / draw
  // dùng chung: preview luôn khớp đúng loạt đạn thực tế.
  function applyLeoPattern(pattern, enemy, player, slot) {
    var angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    var rage = enemy.hp / Math.max(1, enemy.maxHp || enemy.hp) < .35;
    var n = pattern.shots.length, half = (n - 1) / 2;
    var timeScale = [1.22, 1.12, 1, .87][slot] * (rage ? .92 : 1);
    return Object.assign({}, pattern, {
      cooldown: Math.max(1.2, pattern.cooldown * timeScale),
      shots: pattern.shots.map(function(shot, i) {
        var lane = half > 0 ? (i - half) / half : 0;
        var side = i < n / 2 ? -1 : 1;
        var offset, lateral = 0, forward = 0;
        if (slot === 0) { // Quạt khiên: chừa góc phía sau và một khe chính giữa.
          offset = lane * .94 + Math.sign(lane) * .12;
        } else if (slot === 1) { // Hai ấn trái/phải bắn từ hai gốc lệch nhau.
          offset = lane * .66 + side * .22;
          lateral = side * Math.min(12, Math.max(0, enemy.r || 34) * .32);
        } else if (slot === 2) { // Nhịp chém so le, các đường đạn lệch bậc.
          offset = lane * .88 + (i % 2 ? .13 : -.13);
          forward = (i % 3 - 1) * 4;
        } else { // Hai cánh rồng tạo hai luồng đan, vẫn để khoảng né sau lưng.
          offset = lane * 1.08 + side * .11 + (i % 2 ? -.06 : .06);
          lateral = side * Math.min(15, Math.max(0, enemy.r || 34) * .36);
        }
        if (rage) offset *= 1.07;
        return Object.assign({}, shot, {
          x: shot.x + Math.cos(angle) * forward - Math.sin(angle) * lateral,
          y: shot.y + Math.sin(angle) * forward + Math.cos(angle) * lateral,
          angle: angle + offset,
          speed: Math.min(320, shot.speed * (.84 + slot * .04) * (rage ? 1.05 : 1))
        });
      })
    });
  }
  function applyBossPattern(pattern, enemy, player) {
    if (!pattern || !enemy || !enemy.isBoss || !Number.isFinite(enemy.campaignChapter)
      || !Number.isFinite(enemy.campaignRoom) || !player
      || ![enemy.x, enemy.y, player.x, player.y].every(Number.isFinite)) return pattern;
    var variant = subBossVariant(enemy.campaignChapter, basePlan(enemy.campaignChapter, enemy.campaignRoom));
    if (!variant) return pattern;
    if (chapterNumber(enemy.campaignChapter) === 1)
      return applyLeoPattern(pattern, enemy, player, enemy.campaignRoom / 10 - 1);
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
