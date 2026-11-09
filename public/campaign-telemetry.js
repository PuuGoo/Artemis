/* Đo lường riêng từng lượt; không đọc/ghi tài sản hoặc lưu trữ của tài khoản. */
(function (root) {
  'use strict';
  const MAX = 1e12;
  const n = (v, cap = MAX) => typeof v === 'number' && Number.isFinite(v) ? Math.min(cap, Math.max(0, v)) : 0;
  const key = v => typeof v === 'string' ? v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'unknown' : 'unknown';
  const add = (a, b) => n(n(a) + n(b));
  function bucket(map, id, amount) {
    id = key(id);
    if (['__proto__', 'constructor', 'prototype'].includes(id)) id = 'unknown';
    if (!Object.hasOwn(map, id) && Object.keys(map).length >= 31) id = 'other';
    map[id] = add(map[id], amount);
  }
  function begin(options = {}) {
    const stats = options.stats || {};
    return {version:1, activeCombatSeconds:0, damageDealt:0, damageTaken:0,
      incomingByKind:{projectile:0,contact:0,status:0,unknown:0}, incomingByEnemy:{}, damageByEnemy:{},
      lastAttacker:null, failedRoom:1, stats:{baseAtk:n(stats.baseAtk),baseAspd:n(stats.baseAspd),baseHp:n(stats.baseHp)}};
  }
  function tick(s, seconds, context = {}) {
    if (!context.running || context.paused || context.menuOpen || !(context.enemiesAlive > 0)) return s;
    s.activeCombatSeconds = add(s.activeCombatSeconds, n(seconds, 60));
    if (context.room > 0) s.failedRoom = Math.max(1, Math.floor(n(context.room, 10000)));
    return s;
  }
  function loss(event) { return Math.min(n(event.amount), n(event.hpBefore)); }
  function recordDamage(s, event = {}) {
    const amount = loss(event);
    s.damageDealt = add(s.damageDealt, amount);
    bucket(s.damageByEnemy, event.enemy?.type, amount);
    if (event.enemy?.isBoss && n(event.enemy.maxHp) > 0) {
      s.bossDamagePercent = n((n(event.enemy.maxHp) - n(event.enemy.hp)) / n(event.enemy.maxHp) * 100, 100);
    }
    return s;
  }
  function recordIncoming(s, event = {}) {
    const amount = loss(event);
    if (!amount) return s;
    const kind = ['projectile','contact','status'].includes(event.kind) ? event.kind : 'unknown';
    const enemyType = key(event.source?.type);
    s.damageTaken = add(s.damageTaken, amount);
    s.incomingByKind[kind] = add(s.incomingByKind[kind], amount);
    bucket(s.incomingByEnemy, enemyType, amount);
    s.lastAttacker = {enemyType,kind,isBoss:!!event.source?.isBoss,amount};
    if (event.room > 0) s.failedRoom = Math.max(1, Math.floor(n(event.room,10000)));
    return s;
  }
  function summarize(s, context = {}) {
    const kind = s.lastAttacker?.kind;
    const boss = s.lastAttacker?.isBoss || n(s.bossDamagePercent) > 0;
    const tuning = context.tuning;
    const baselineDps = n(s.stats.baseAtk * s.stats.baseAspd);
    const benchmarks = tuning && n(tuning.mobHp) && n(tuning.bossHp) ? {
      mobHp:n(tuning.mobHp),mobAtk:n(tuning.mobAtk),bossHp:n(tuning.bossHp),bossAtk:n(tuning.bossAtk),baselineDps,
      estimatedMobSeconds:baselineDps ? n(tuning.mobHp / baselineDps) : 0,
      note:'Ước tính từ cấu hình phòng và ATK × tốc đánh; chưa tính chí mạng, kỹ năng, né và thời gian di chuyển.'
    } : null;
    const suggestions = [
      {category:'dodge',text:kind === 'status' ? 'Rời vùng hiệu ứng gây sát thương trước khi dừng lại bắn.' : kind === 'contact' ? 'Giữ khoảng cách để tránh quái áp sát; đi vòng rồi dừng ngắn để bắn.' : boss ? 'Quan sát báo đòn của trùm, né ngang và chỉ dừng bắn sau khi trùm vừa ra đòn.' : 'Né ngang đường đạn; di chuyển vòng và chỉ dừng một nhịp ngắn để bắn.'},
      {category:'upgrade',text: s.lastAttacker && s.lastAttacker.amount >= s.stats.baseHp * .3 ? 'Đòn cuối lấy nhiều máu: kiểm tra HP, DEF và cường hóa trang bị đang có bằng vật liệu sẵn có.' : 'Kiểm tra vũ khí đang trang bị và cường hóa bằng vật liệu sẵn có nếu đủ; không cần đổi trang bị để thử lại.'},
      {category:'build',text:kind === 'status' || kind === 'contact' ? 'Trong lượt sau, ưu tiên kỹ năng Khiên hoặc Né khi được đề nghị để có thêm thời gian giữ vị trí.' : 'Chọn kỹ năng sát thương cùng hướng với bộ đang dùng; cân bằng thêm Khiên hoặc HP nếu khó sống sót.'}
    ];
    return {...s, failedRoom:context.room > 0 ? Math.max(1,Math.floor(n(context.room,10000))) : s.failedRoom,
      bossDamagePercent:n(s.bossDamagePercent,100),benchmarks,suggestions,
      labels:{effectiveDps:'Sát thương hiệu dụng / giây',activeCombatSeconds:'Thời gian chiến đấu',damageTaken:'Sát thương đã nhận',failedRoom:'Phòng dừng chân',bossDamagePercent:'Máu trùm đã mất',lastAttacker:'Nguồn đòn cuối'}, stats:{...s.stats}, incomingByKind:{...s.incomingByKind},incomingByEnemy:{...s.incomingByEnemy},
      damageByEnemy:{...s.damageByEnemy},lastAttacker:s.lastAttacker ? {...s.lastAttacker} : null,
      effectiveDps:s.activeCombatSeconds > 0 ? n(s.damageDealt / s.activeCombatSeconds) : 0};
  }
  // Checkpoint chỉ chứa danh sách trường đo lường cho phép, không chứa tài sản.
  function normalize(value) {
    const v = value && typeof value === 'object' && value.version === 1 ? value : {};
    const s = begin({stats:v.stats});
    for (const field of ['activeCombatSeconds','damageDealt','damageTaken']) s[field] = n(v[field]);
    s.failedRoom = Math.max(1,Math.floor(n(v.failedRoom,10000)));
    s.bossDamagePercent = n(v.bossDamagePercent,100);
    for (const kind of Object.keys(s.incomingByKind)) s.incomingByKind[kind] = n(v.incomingByKind?.[kind]);
    for (const field of ['incomingByEnemy','damageByEnemy']) {
      const map = v[field];
      if (map && typeof map === 'object') {
        let count = 0;
        for (const id in map) {
          if (!Object.hasOwn(map,id)) continue;
          bucket(s[field],id,n(map[id]));
          if (++count >= 128) break;
        }
      }
    }
    if (v.lastAttacker && typeof v.lastAttacker === 'object') {
      const a = v.lastAttacker;
      s.lastAttacker = {enemyType:key(a.enemyType),kind:['projectile','contact','status'].includes(a.kind) ? a.kind : 'unknown',isBoss:!!a.isBoss,amount:n(a.amount)};
    }
    return s;
  }
  function checkpoint(s) { return normalize(s); }
  root.ArtemisCampaignTelemetry = Object.freeze({begin,tick,recordDamage,recordIncoming,summarize,normalize,checkpoint});
})(globalThis);
