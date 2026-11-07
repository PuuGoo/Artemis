// ==================== MÔ PHỎNG CÂN BẰNG COMBAT (PARITY VỚI SOURCE) ====================
//
// Nguyên tắc: KHÔNG tự đặt công thức. Mọi hằng số đọc từ public/index.html bằng
// regex; nếu source đổi mà regex không khớp, script NÉM LỖI thay vì tính sai.
//
// Hai chế độ được mô phỏng:
//   • Chiến dịch: địch dùng bảng TUYỆT ĐỐI `CAMPAIGN_TUNING` — không neo theo chỉ
//     số người chơi, nên nâng cấp phải làm trận đấu dễ hơn thật.
//   • Vô Tận/Tháp: vẫn thích ứng theo người chơi (giữ công thức cũ).
//
// Chạy: node tools/combat-sim.mjs            (dùng tools/combat-profiles.json)
//       node tools/combat-sim.mjs --verbose  (in thêm từng phòng)
//
// Hồ sơ người chơi lấy từ tools/measure-profiles.mjs — đo bằng
// getComputedStats() thật trên Chrome local, không gõ tay.
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const profilesPath = new URL('./combat-profiles.json', import.meta.url);

function num(re, label) {
  const m = html.match(re);
  if (!m) throw new Error('Không tìm thấy trong source: ' + label);
  return Number(m[1]);
}
function block(startMarker, endMarker, label) {
  const i = html.indexOf(startMarker);
  if (i < 0) throw new Error('Không tìm thấy trong source: ' + label);
  const j = html.indexOf(endMarker, i);
  if (j < 0) throw new Error('Không tìm thấy phần kết của: ' + label);
  return html.slice(i, j + endMarker.length);
}

// ==================== HẰNG SỐ ĐỌC TỪ SOURCE ====================
const BASE_ATK = num(/\((\d+) \+ gearAtk \+ gemAtk/, 'base ATK');
const BASE_HP = num(/\((\d+) \+ gearHp \+ gemHp/, 'base HP');
const MOB_COUNT_BASE = num(/const count = Math\.min\((\d+), 3 \+ Math\.floor\(roomNum \/ 2\)\)/, 'quái max count');
const MOB_COUNT_BASE_N = num(/const count = Math\.min\(\d+, (\d+) \+ Math\.floor\(roomNum \/ 2\)\)/, 'quái base count');
const DEF_K_BASE = num(/const defK = (\d+) \+ 120 \*/, 'defK base');
const DEF_K_PER_ROOM = num(/const defK = \d+ \+ (\d+) \*/, 'defK per room');
const DEF_CAP = num(/Math\.min\((0\.\d+), defFlat \/ \(defFlat \+ defK\)\)/, 'DEF cap');

// Bảng tuyệt đối của chiến dịch — nguồn sự thật mới cho độ khó campaign.
const CAMPAIGN_TUNING = (() => {
  const blk = block('const CAMPAIGN_TUNING = {', '};', 'CAMPAIGN_TUNING');
  const out = {};
  for (const m of blk.matchAll(/(\d): \{ mobHp: (\d+), mobAtk: (\d+), bossHp: (\d+), bossAtk: (\d+) \}/g)) {
    out[Number(m[1])] = {
      mobHp: Number(m[2]), mobAtk: Number(m[3]),
      bossHp: Number(m[4]), bossAtk: Number(m[5]),
    };
  }
  if (Object.keys(out).length !== 7) throw new Error('CAMPAIGN_TUNING phải có 7 chương, đọc được ' + Object.keys(out).length);
  return out;
})();

// Hệ số độ sâu trong getCampaignTuning.
const DEPTH = (() => {
  const blk = block('function getCampaignTuning(chapterId, room, maxRooms) {', '\n      }', 'getCampaignTuning');
  const grab = (re, label) => {
    const m = blk.match(re);
    if (!m) throw new Error('Không đọc được độ sâu: ' + label);
    return Number(m[1]);
  };
  return {
    mobHp: grab(/mobHp: Math\.round\(t\.mobHp \* \(1 \+ depth \* ([\d.]+)\)\)/, 'mobHp'),
    mobAtk: grab(/mobAtk: Math\.round\(t\.mobAtk \* \(1 \+ depth \* ([\d.]+)\)\)/, 'mobAtk'),
    bossHp: grab(/bossHp: Math\.round\(t\.bossHp \* \(1 \+ depth \* ([\d.]+)\)\)/, 'bossHp'),
    bossAtk: grab(/bossAtk: Math\.round\(t\.bossAtk \* \(1 \+ depth \* ([\d.]+)\)\)/, 'bossAtk'),
  };
})();

// Công thức THÍCH ỨNG (Vô Tận/Tháp) — vẫn phải parity.
const ADAPTIVE = {
  hitsBase: num(/const baseHits = ([\d.]+) \+ depth/, 'quái baseHits'),
  hitsDepth: num(/const baseHits = [\d.]+ \+ depth \* ([\d.]+)/, 'quái hits depth'),
  mobAtkStart: num(/playerMaxHp \/ \((\d+) - depth \* \d+\)/, 'quái atk start'),
  mobAtkDepth: num(/playerMaxHp \/ \(\d+ - depth \* (\d+)\)/, 'quái atk depth'),
  bossHits5: num(/const hitsToKill = roomNum === 5 \? (\d+)/, 'boss hits 5'),
  bossHits10: num(/const hitsToKill = roomNum === 5 \? \d+ : \(roomNum === 10 \? (\d+)/, 'boss hits 10'),
  bossHitsFinal: num(/const hitsToKill = roomNum === 5 \? \d+ : \(roomNum === 10 \? \d+ : (\d+)\)/, 'boss hits final'),
  bossAtk5: num(/playerMaxHp \/ \(roomNum === 5 \? (\d+)/, 'boss atk 5'),
  bossAtk10: num(/playerMaxHp \/ \(roomNum === 5 \? \d+ : \(roomNum === 10 \? (\d+)/, 'boss atk 10'),
  bossAtkFinal: num(/playerMaxHp \/ \(roomNum === 5 \? \d+ : \(roomNum === 10 \? \d+ : (\d+)\)\)/, 'boss atk final'),
  roomMulStep: num(/const roomMul = 1 \+ \(roomNum - 1\) \* ([\d.]+)/, 'roomMul step'),
  demonMult: num(/bossType === 'demon_king' \? ([\d.]+)/, 'demon mult'),
};

// Hệ số máu theo loại quái (typeMul) — đọc nguyên biểu thức trong source.
const ARCHETYPE_MULT = (() => {
  const m = html.match(/const typeMul = \({([^}]+)}\)\[t\] \|\| 1\.0;/s);
  if (!m) throw new Error('Không tìm thấy typeMul của quái');
  const out = { default: 1 };
  for (const hit of m[1].matchAll(/([a-z_]+): ([\d.]+)/g)) out[hit[1]] = Number(hit[2]);
  return out;
})();

// Bảng quái theo chương (types array trong setupRoom).
const CHAPTER_ENEMIES = (() => {
  const out = {};
  const re = /Game\.chapter && Number\(Game\.chapter\.id\) === (\d)\s*\?\s*\[([^\]]+)\]/g;
  for (const m of html.matchAll(re)) {
    out[Number(m[1])] = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  }
  if (!Object.keys(out).length) throw new Error('Không tìm thấy bảng quái theo chương');
  return out;
})();

// Boss theo chương (C4–C6 có trùm riêng; C1–C3 dùng golem/queen/demon_king theo phòng).
const CHAPTER_BOSS = (() => {
  const out = {};
  const re = /Number\(Game\.chapter\.id\) === (\d) \? '([a-z_]+)'/g;
  for (const m of html.matchAll(re)) out[Number(m[1])] = m[2];
  return out;
})();

// Chương: rooms + enemyScale.
const CHAPTERS = (() => {
  const blk = block('const CHAPTERS = [', '\n      ];', 'CHAPTERS');
  const ids = [...blk.matchAll(/\n {10}id: (\d+),/g)].map((m) => Number(m[1]));
  const rooms = [...blk.matchAll(/\n {10}rooms: (\d+),/g)].map((m) => Number(m[1]));
  const scale = [...blk.matchAll(/\n {10}enemyScale: ([\d.]+),/g)].map((m) => Number(m[1]));
  return ids.map((id, k) => ({ id, rooms: rooms[k], enemyScale: scale[k] }));
})();

const isBossRoom = (room, maxRooms) => (room % 5 === 0) || (room === maxRooms);
const depthOf = (room, maxRooms) => Math.min(1, Math.max(0, (room - 1) / Math.max(1, maxRooms - 1)));
const mobCount = (room) => Math.min(MOB_COUNT_BASE, MOB_COUNT_BASE_N + Math.floor(room / 2));

function bossType(chapterId, room) {
  if (CHAPTER_BOSS[chapterId]) return CHAPTER_BOSS[chapterId];
  return room === 5 ? 'golem' : (room === 10 ? 'queen' : 'demon_king');
}

/** Bảng tuyệt đối — copy đúng getCampaignTuning(). */
function campaignTuning(chapterId, room, maxRooms) {
  const t = CAMPAIGN_TUNING[Number(chapterId)] || CAMPAIGN_TUNING[1];
  const depth = depthOf(room, maxRooms);
  return {
    mobHp: Math.round(t.mobHp * (1 + depth * DEPTH.mobHp)),
    mobAtk: Math.round(t.mobAtk * (1 + depth * DEPTH.mobAtk)),
    bossHp: Math.round(t.bossHp * (1 + depth * DEPTH.bossHp)),
    bossAtk: Math.round(t.bossAtk * (1 + depth * DEPTH.bossAtk)),
  };
}

/** HP/ATK quái trong CHIẾN DỊCH — không phụ thuộc người chơi. */
function campaignMob({ chapter, room, type }) {
  const t = campaignTuning(chapter.id, room, chapter.rooms);
  const count = mobCount(room);
  const typeMul = ARCHETYPE_MULT[type] ?? ARCHETYPE_MULT.default;
  return {
    count,
    hp: Math.max(1, Math.round(t.mobHp * typeMul)),
    atk: Math.max(1, Math.round(t.mobAtk / Math.max(1, Math.sqrt(count / 3)))),
  };
}

/** HP/ATK trùm trong CHIẾN DỊCH. */
function campaignBoss({ chapter, room }) {
  const t = campaignTuning(chapter.id, room, chapter.rooms);
  const type = bossType(chapter.id, room);
  return {
    type,
    hp: Math.round(t.bossHp * (type === 'demon_king' ? ADAPTIVE.demonMult : 1)),
    atk: Math.max(1, t.bossAtk),
  };
}

/** HP/ATK quái trong VÔ TẬN/THÁP (thích ứng) — giữ nguyên công thức cũ. */
function adaptiveMob({ playerAtk, playerMaxHp, chapter, room, type }) {
  const depth = depthOf(room, chapter.rooms);
  const baseHits = ADAPTIVE.hitsBase + depth * ADAPTIVE.hitsDepth;
  const count = mobCount(room);
  const scale = chapter.enemyScale * (1 + (room - 1) * ADAPTIVE.roomMulStep);
  const typeMul = ARCHETYPE_MULT[type] ?? ARCHETYPE_MULT.default;
  return {
    count,
    hp: Math.max(1, Math.round(playerAtk * typeMul * baseHits * scale)),
    atk: Math.max(1, Math.round(playerMaxHp / (ADAPTIVE.mobAtkStart - depth * ADAPTIVE.mobAtkDepth) / Math.max(1, Math.sqrt(count / 3)))),
  };
}

const dps = (p) => p.atk * p.aspd * (1 + p.crit * (p.critMult - 1));
function survivability(p, incomingAtk, maxRooms) {
  const defK = DEF_K_BASE + DEF_K_PER_ROOM * maxRooms;
  const dr = Math.min(DEF_CAP, p.def / (p.def + defK));
  const effective = incomingAtk * (1 - dr);
  return { dr, effective, hits: Math.max(1, p.hp / Math.max(1, effective)) };
}

// ==================== HỒ SƠ (ĐO THẬT) ====================
if (!fs.existsSync(profilesPath)) {
  throw new Error('Thiếu tools/combat-profiles.json — chạy tools/measure-profiles.mjs trước.');
}
const measured = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
const PROFILES = measured.profiles;

// ==================== CHẠY ====================
const verbose = process.argv.includes('--verbose');
const rows = [];

for (const p of PROFILES) {
  const d = dps(p);
  for (const chapter of CHAPTERS) {
    for (let room = 1; room <= chapter.rooms; room++) {
      if (isBossRoom(room, chapter.rooms)) {
        const b = campaignBoss({ chapter, room });
        const s = survivability(p, b.atk, chapter.rooms);
        rows.push({
          profile: p.name, profileKey: p.name.slice(0, 2), ch: chapter.id, room, kind: 'boss',
          bossType: b.type, enemyHp: b.hp, enemyAtk: b.atk,
          ttk: b.hp / d, hits: s.hits, dr: s.dr, hitsToKill: b.hp / Math.max(1, p.atk),
        });
      } else {
        const types = CHAPTER_ENEMIES[chapter.id] || CHAPTER_ENEMIES[1] || ['slime'];
        // setupRoom chọn type theo (roomNum + i) % types.length -> lấy đại diện theo phòng.
        const type = types[room % types.length];
        const m = campaignMob({ chapter, room, type });
        const s = survivability(p, m.atk, chapter.rooms);
        rows.push({
          profile: p.name, profileKey: p.name.slice(0, 2), ch: chapter.id, room, kind: 'quái',
          bossType: type, count: m.count, enemyHp: m.hp, enemyAtk: m.atk,
          ttk: m.hp / d, hits: s.hits, dr: s.dr, hitsToKill: m.hp / Math.max(1, p.atk),
        });
      }
    }
  }
}

// ==================== IN ====================
console.log('=== HẰNG SỐ ĐỌC TỪ SOURCE ===');
console.log(`  BASE_ATK=${BASE_ATK} BASE_HP=${BASE_HP} DEF K=${DEF_K_BASE}+${DEF_K_PER_ROOM}*rooms cap=${DEF_CAP}`);
console.log(`  Quái: ${MOB_COUNT_BASE_N}+floor(r/2) con (max ${MOB_COUNT_BASE})`);
console.log(`  CHIẾN DỊCH (tuyệt đối): ${CHAPTERS.map((c) => `C${c.id} ${CAMPAIGN_TUNING[c.id].mobHp}HP/${CAMPAIGN_TUNING[c.id].mobAtk}ATK`).join(' · ')}`);
console.log(`  Độ sâu: mobHp +${DEPTH.mobHp} mobAtk +${DEPTH.mobAtk} bossHp +${DEPTH.bossHp} bossAtk +${DEPTH.bossAtk}`);
console.log(`  Hệ số quái: ${JSON.stringify(ARCHETYPE_MULT)}`);
console.log(`  Vô hạn (thích ứng): baseHits ${ADAPTIVE.hitsBase}+depth*${ADAPTIVE.hitsDepth}, atk ${ADAPTIVE.mobAtkStart}-depth*${ADAPTIVE.mobAtkDepth}`);
console.log(`  Chương: ${CHAPTERS.map((c) => `C${c.id}(${c.rooms} phòng)`).join(' ')}`);
console.log(`  Hồ sơ đo lúc: ${measured.measuredAt}\n`);

console.log('| Hồ sơ | ATK | HP | C1 TTK | C1 số đòn chịu | C6 TTK | C6 số đòn chịu |');
console.log('|---|---|---|---|---|---|---|');
for (const p of PROFILES) {
  const c1 = rows.find((r) => r.profile === p.name && r.ch === 1 && r.kind === 'quái' && r.room === 1);
  const c6 = rows.find((r) => r.profile === p.name && r.ch === 6 && r.kind === 'quái' && r.room === 1);
  console.log(`| ${p.name} | ${p.atk} | ${p.hp} | ${c1.ttk.toFixed(2)}s | ${c1.hits.toFixed(1)} | ${c6.ttk.toFixed(2)}s | ${c6.hits.toFixed(1)} |`);
}

console.log('\n| Hồ sơ | Chương | Trùm cuối | HP trùm | ATK trùm | TTK | Số đòn chịu |');
console.log('|---|---|---|---|---|---|---|');
for (const p of PROFILES) {
  for (const ch of CHAPTERS) {
    const boss = rows.find((r) => r.profile === p.name && r.ch === ch.id && r.kind === 'boss' && r.room === ch.rooms);
    if (!boss) continue;
    console.log(`| ${p.name.slice(0, 2)} | C${ch.id} | ${boss.bossType} | ${boss.enemyHp} | ${boss.enemyAtk} | ${boss.ttk.toFixed(1)}s | ${boss.hits.toFixed(1)} |`);
  }
}

if (verbose) {
  console.log('\n| Hồ sơ | Ch | Phòng | Loại | HP địch | ATK địch | TTK | Số đòn chịu | DR |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.profileKey} | C${r.ch} | ${r.room} | ${r.kind}/${r.bossType} | ${r.enemyHp} | ${r.enemyAtk} | ${r.ttk.toFixed(2)}s | ${r.hits.toFixed(1)} | ${(r.dr * 100).toFixed(1)}% |`);
  }
}

// ==================== BẤT BIẾN ====================
console.log('\n=== BẤT BIẾN (chiến dịch) ===');
const results = [];
const ok = (cond, msg) => { results.push({ cond, msg }); console.log((cond ? '  OK   ' : '  FAIL ') + msg); };
const pick = (key, ch, room) => rows.find((r) => r.profileKey === key && r.ch === ch && r.room === room);

const A = PROFILES.find((p) => p.name.startsWith('A.'));
const E = PROFILES.find((p) => p.name.startsWith('E.'));
const F = PROFILES.find((p) => p.name.startsWith('F.'));
const G = PROFILES.find((p) => p.name.startsWith('G.'));

const a1 = pick('A.', 1, 1), f1 = pick('F.', 1, 1);

// 1. Nâng cấp phải làm trận đấu dễ hơn THẬT.
const ttkGain = a1.ttk / f1.ttk;
ok(ttkGain >= 8, `ATK A→F (${A.atk}→${F.atk}) giảm TTK ${ttkGain.toFixed(1)}× (yêu cầu ≥ 8×)`);

// 2. Nâng HP phải tăng số đòn chịu được.
const hpGain = f1.hits / a1.hits;
ok(hpGain >= 2, `HP A→F tăng số đòn chịu ${hpGain.toFixed(1)}× (yêu cầu ≥ 2×)`);

// 3. Người yếu ở chương cao phải CHẾT NHANH.
const g5 = pick('G.', 5, 1);
ok(g5.hits <= 5, `hồ sơ G ở C5-P1 chỉ chịu ${g5.hits.toFixed(1)} đòn (yêu cầu ≤ 5)`);

// 4. Người mới ở C1 giết quái trong 1,5–3,5 đòn.
ok(a1.hitsToKill >= 1.5 && a1.hitsToKill <= 3.5,
  `tân thủ C1-P1 cần ${a1.hitsToKill.toFixed(1)} đòn hạ 1 quái (yêu cầu 1,5–3,5)`);

// 5. Trùm chương 1 phải 12–30s với hồ sơ tân thủ.
const bossC1 = rows.find((r) => r.profileKey === 'A.' && r.ch === 1 && r.kind === 'boss' && r.room === CHAPTERS[0].rooms);
ok(bossC1.ttk >= 12 && bossC1.ttk <= 30, `trùm cuối C1: ${bossC1.ttk.toFixed(1)}s (yêu cầu 12–30s)`);

// 6. Chương sau nguy hiểm hơn chương trước (cùng hồ sơ).
const bossC3 = rows.find((r) => r.profileKey === 'A.' && r.ch === 3 && r.kind === 'boss' && r.room === CHAPTERS[2].rooms);
ok(bossC3.hits < bossC1.hits, `trùm C3 nguy hiểm hơn C1 (${bossC3.hits.toFixed(1)} < ${bossC1.hits.toFixed(1)} đòn)`);

// 7. Người mạnh ở chương cũ phải thấy rõ sức mạnh.
const e1 = pick('E.', 1, 1);
const eBoss1 = rows.find((r) => r.profileKey === 'E.' && r.ch === 1 && r.kind === 'boss' && r.room === CHAPTERS[0].rooms);
ok(e1.ttk < a1.ttk / 4, `E giết quái C1 nhanh hơn tân thủ ${(a1.ttk / e1.ttk).toFixed(1)}× (yêu cầu > 4×)`);
ok(eBoss1.hits > bossC1.hits, `E chịu trùm C1 tốt hơn tân thủ (${eBoss1.hits.toFixed(1)} > ${bossC1.hits.toFixed(1)} đòn)`);

// 8. Bất biến kỹ thuật.
ok(rows.every((r) => Number.isFinite(r.ttk) && r.ttk > 0), 'không NaN/Infinity, TTK > 0');
ok(rows.every((r) => r.hits >= 1), 'số đòn chịu được ≥ 1');
// Trùm phải vừa sức với hồ sơ ĐÚNG TẦM của chương đó (10–60s), và người yếu ở
// chương cao phải bị chặn thật (không thể gặm trùm cuối bằng đồ tân thủ).
const APPROPRIATE = { 1: 'A.', 2: 'B.', 3: 'D.', 4: 'E.', 5: 'E.', 6: 'E.', 7: 'E.' };
for (const ch of CHAPTERS) {
  const key = APPROPRIATE[ch.id];
  const boss = rows.find((r) => r.profileKey === key && r.ch === ch.id && r.kind === 'boss' && r.room === ch.rooms);
  const prof = PROFILES.find((x) => x.name.startsWith(key));
  ok(boss.ttk >= 10 && boss.ttk <= 60,
    `trùm C${ch.id} với hồ sơ ${key.trim()} (ATK ${prof.atk}): ${boss.ttk.toFixed(1)}s (yêu cầu 10–60s)`);
}
const gBossC6 = rows.find((r) => r.profileKey === 'G.' && r.ch === 6 && r.kind === 'boss' && r.room === CHAPTERS[5].rooms);
ok(gBossC6.ttk > 120, `đồ tân thủ không gặm được trùm C6 (${gBossC6.ttk.toFixed(0)}s > 120s) — đúng là cổng tiến trình`);

// 9. Địch KHÔNG phụ thuộc chỉ số người chơi trong chiến dịch.
const sameRoom = rows.filter((r) => r.kind === 'quái' && r.ch === 3 && r.room === 3);
const sameEnemy = sameRoom.every((r) => r.enemyHp === sameRoom[0].enemyHp && r.enemyAtk === sameRoom[0].enemyAtk);
ok(sameEnemy, 'cùng chương+phòng: mọi hồ sơ gặp ĐÚNG cùng quái (HP/ATK không đổi theo người chơi)');

// 10. Vô Tận vẫn thích ứng (không bị đổi hành vi).
const endlessRoom = CHAPTERS[0].rooms + 20;
const endA = adaptiveMob({ playerAtk: A.atk, playerMaxHp: A.hp, chapter: CHAPTERS[0], room: endlessRoom, type: 'slime' });
const endF = adaptiveMob({ playerAtk: F.atk, playerMaxHp: F.hp, chapter: CHAPTERS[0], room: endlessRoom, type: 'slime' });
ok(endA.hp !== endF.hp, `Vô Tận vẫn neo người chơi (HP ${endA.hp} vs ${endF.hp})`);

const failed = results.filter((r) => !r.cond).length;
console.log(`\n=== ${results.length - failed} PASS / ${failed} FAIL ===`);
if (failed) process.exitCode = 1;
