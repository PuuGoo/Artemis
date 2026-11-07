// ==================== MÔ PHỎNG CÂN BẰNG COMBAT (PARITY VỚI SOURCE) ====================
//
// Nguyên tắc: KHÔNG tự đặt công thức. Mọi hằng số đọc từ public/index.html bằng
// regex; nếu source đổi mà regex không khớp, script NÉM LỖI thay vì tính sai.
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

// ==================== HẰNG SỐ ĐỌC TỪ SOURCE ====================
const BASE_ATK = num(/\((\d+) \+ gearAtk \+ gemAtk/, 'base ATK');
const BASE_HP = num(/\((\d+) \+ gearHp \+ gemHp/, 'base HP');
const MOB_HITS_BASE = num(/const baseHits = ([\d.]+) \+ depth/, 'quái baseHits');
const MOB_HITS_DEPTH = num(/const baseHits = [\d.]+ \+ depth \* ([\d.]+)/, 'quái hits depth');
const MOB_ATK_START = num(/playerMaxHp \/ \((\d+) - depth \* \d+\)/, 'quái atk start');
const MOB_ATK_DEPTH = num(/playerMaxHp \/ \(\d+ - depth \* (\d+)\)/, 'quái atk depth');
const BOSS_HITS_5 = num(/const hitsToKill = roomNum === 5 \? (\d+)/, 'boss hits 5');
const BOSS_HITS_10 = num(/const hitsToKill = roomNum === 5 \? \d+ : \(roomNum === 10 \? (\d+)/, 'boss hits 10');
const BOSS_HITS_FINAL = num(/const hitsToKill = roomNum === 5 \? \d+ : \(roomNum === 10 \? \d+ : (\d+)\)/, 'boss hits final');
const BOSS_DEMON_MULT = num(/bossType === 'demon_king' \? ([\d.]+)/, 'demon mult');
const BOSS_ATK_5 = num(/playerMaxHp \/ \(roomNum === 5 \? (\d+)/, 'boss atk 5');
const BOSS_ATK_10 = num(/playerMaxHp \/ \(roomNum === 5 \? \d+ : \(roomNum === 10 \? (\d+)/, 'boss atk 10');
const BOSS_ATK_FINAL = num(/playerMaxHp \/ \(roomNum === 5 \? \d+ : \(roomNum === 10 \? \d+ : (\d+)\)\)/, 'boss atk final');
const ROOM_MUL_STEP = num(/const roomMul = 1 \+ \(roomNum - 1\) \* ([\d.]+)/, 'roomMul step');
const DEF_K_BASE = num(/const defK = (\d+) \+ 120 \*/, 'defK base');
const DEF_K_PER_ROOM = num(/const defK = \d+ \+ (\d+) \*/, 'defK per room');
const DEF_CAP = num(/Math\.min\((0\.\d+), defFlat \/ \(defFlat \+ defK\)\)/, 'DEF cap');
const MOB_COUNT_BASE = num(/const count = Math\.min\((\d+), 3 \+ Math\.floor\(roomNum \/ 2\)\)/, 'quái max count');
const MOB_COUNT_BASE_N = num(/const count = Math\.min\(\d+, (\d+) \+ Math\.floor\(roomNum \/ 2\)\)/, 'quái base count');

// Hệ số máu theo loại quái (atkMul) — đọc nguyên biểu thức trong source.
const ARCHETYPE_MULT = (() => {
  const m = html.match(/const atkMul = (t === '[^']+'[^;]+?) \* baseHits;/s);
  if (!m) throw new Error('Không tìm thấy atkMul của quái');
  const out = { default: 1 };
  for (const hit of m[1].matchAll(/t === '([a-z_]+)' \? ([\d.]+)/g)) out[hit[1]] = Number(hit[2]);
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
// Boss theo chương (id 4,5,6 có trùm riêng; 1–3 dùng golem/queen/demon_king theo phòng).
const CHAPTER_BOSS = (() => {
  const out = {};
  const re = /Number\(Game\.chapter\.id\) === (\d) \? '([a-z_]+)'/g;
  for (const m of html.matchAll(re)) out[Number(m[1])] = m[2];
  return out;
})();
// Chương: rooms + enemyScale.
const CHAPTERS = (() => {
  const i = html.indexOf('const CHAPTERS = [');
  const j = html.indexOf('\n      ];', i);
  if (i < 0 || j < 0) throw new Error('Không tìm thấy CHAPTERS');
  const blk = html.slice(i, j);
  const ids = [...blk.matchAll(/\n {10}id: (\d+),/g)].map((m) => Number(m[1]));
  const rooms = [...blk.matchAll(/\n {10}rooms: (\d+),/g)].map((m) => Number(m[1]));
  const scale = [...blk.matchAll(/\n {10}enemyScale: ([\d.]+),/g)].map((m) => Number(m[1]));
  return ids.map((id, k) => ({ id, rooms: rooms[k], enemyScale: scale[k] }));
})();

const isBossRoom = (room, maxRooms) => (room % 5 === 0) || (room === maxRooms);
const depthOf = (room, maxRooms) => Math.min(1, (room - 1) / Math.max(1, maxRooms - 1));
const mobCount = (room) => Math.min(MOB_COUNT_BASE, MOB_COUNT_BASE_N + Math.floor(room / 2));

function bossType(chapterId, room, maxRooms) {
  if (CHAPTER_BOSS[chapterId]) return CHAPTER_BOSS[chapterId];
  return room === 5 ? 'golem' : (room === 10 ? 'queen' : 'demon_king');
}

/** HP/ATK một con quái — copy đúng công thức setupRoom(). */
function mobStats({ playerAtk, playerMaxHp, chapter, room, type }) {
  const scale = chapter.enemyScale * (1 + (room - 1) * ROOM_MUL_STEP);
  const depth = depthOf(room, chapter.rooms);
  const baseHits = MOB_HITS_BASE + depth * MOB_HITS_DEPTH;
  const atkMul = (ARCHETYPE_MULT[type] ?? ARCHETYPE_MULT.default) * baseHits;
  const count = mobCount(room);
  return {
    count,
    hp: Math.max(1, Math.round(playerAtk * atkMul * scale)),
    atk: Math.max(1, Math.round(playerMaxHp / (MOB_ATK_START - depth * MOB_ATK_DEPTH) / Math.max(1, Math.sqrt(count / 3)))),
  };
}

/** HP/ATK trùm — copy đúng công thức setupRoom(). */
function bossStats({ playerAtk, playerMaxHp, chapter, room }) {
  const type = bossType(chapter.id, room, chapter.rooms);
  const hits = room === 5 ? BOSS_HITS_5 : (room === 10 ? BOSS_HITS_10 : BOSS_HITS_FINAL);
  const hp = Math.round(playerAtk * hits * chapter.enemyScale * (type === 'demon_king' ? BOSS_DEMON_MULT : 1));
  const atk = Math.max(1, Math.round(playerMaxHp / (room === 5 ? BOSS_ATK_5 : (room === 10 ? BOSS_ATK_10 : BOSS_ATK_FINAL))));
  return { type, hp, atk };
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

// Chương phù hợp với từng hồ sơ (theo tiến trình thiết kế).
const APPROPRIATE = {
  'A.': 1, 'B.': 1, 'C.': 1, 'D.': 1, 'E.': 1, 'F.': 1, 'G.': 5,
};

// ==================== CHẠY ====================
const rows = [];
for (const p of PROFILES) {
  const d = dps(p);
  for (const chapter of CHAPTERS) {
    for (let room = 1; room <= chapter.rooms; room++) {
      if (isBossRoom(room, chapter.rooms)) {
        const b = bossStats({ playerAtk: p.atk, playerMaxHp: p.hp, chapter, room });
        const s = survivability(p, b.atk, chapter.rooms);
        rows.push({
          profile: p.name, profileKey: p.name.slice(0, 2), ch: chapter.id, room,
          kind: room === chapter.rooms ? 'boss cuối' : 'boss-' + room,
          bossType: b.type, enemyHp: b.hp, enemyAtk: b.atk,
          ttk: b.hp / d, hits: s.hits, dr: s.dr, hitsToKill: b.hp / Math.max(1, p.atk),
        });
      } else {
        const types = CHAPTER_ENEMIES[chapter.id] || CHAPTER_ENEMIES[1] || ['slime'];
        // setupRoom chọn type theo (roomNum + i) % types.length -> lấy type phổ biến nhất
        // là type tại i=0 (đại diện trung tính), và type nặng nhất để cảnh báo.
        const type = types[room % types.length];
        const m = mobStats({ playerAtk: p.atk, playerMaxHp: p.hp, chapter, room, type });
        const s = survivability(p, m.atk, chapter.rooms);
        rows.push({
          profile: p.name, profileKey: p.name.slice(0, 2), ch: chapter.id, room,
          kind: 'quái', bossType: type, count: m.count, enemyHp: m.hp, enemyAtk: m.atk,
          ttk: m.hp / d, hits: s.hits, dr: s.dr, hitsToKill: m.hp / Math.max(1, p.atk),
        });
      }
    }
  }
}

// ==================== IN ====================
const verbose = process.argv.includes('--verbose');
console.log('=== HẰNG SỐ ĐỌC TỪ SOURCE ===');
console.log(`  BASE_ATK=${BASE_ATK} BASE_HP=${BASE_HP} roomMul=1+(r-1)*${ROOM_MUL_STEP} DEF K=${DEF_K_BASE}+${DEF_K_PER_ROOM}*rooms cap=${DEF_CAP}`);
console.log(`  Quái: ${MOB_COUNT_BASE_N}+floor(r/2) con (max ${MOB_COUNT_BASE}), HP=atk*(hits)*scale, ATK=maxHp/(${MOB_ATK_START}-depth*${MOB_ATK_DEPTH})/sqrt(n/3)`);
console.log(`  Hệ số quái: ${JSON.stringify(ARCHETYPE_MULT)}`);
console.log(`  Boss theo chương: ${JSON.stringify(CHAPTER_BOSS)} | hits ${BOSS_HITS_5}/${BOSS_HITS_10}/${BOSS_HITS_FINAL}, demon×${BOSS_DEMON_MULT}`);
console.log(`  Chương: ${CHAPTERS.map((c) => `C${c.id}(${c.rooms} phòng ×${c.enemyScale})`).join(' ')}`);
console.log(`  Hồ sơ đo lúc: ${measured.measuredAt}\n`);

console.log('| Hồ sơ | Chương | ATK | HP | Quái TTK | Quái số đòn chết người | Boss TTK | Boss số đòn |');
console.log('|---|---|---|---|---|---|---|---|');
for (const p of PROFILES) {
  for (const ch of CHAPTERS) {
    const first = rows.find((r) => r.profile === p.name && r.ch === ch.id && r.kind === 'quái' && r.room === 1);
    const boss = rows.find((r) => r.profile === p.name && r.ch === ch.id && r.kind === 'boss cuối');
    if (!first || !boss) continue;
    console.log(`| ${p.name} | C${ch.id} | ${p.atk} | ${p.hp} | ${first.ttk.toFixed(2)}s | ${first.hits.toFixed(1)} | ${boss.ttk.toFixed(1)}s | ${boss.hits.toFixed(1)} |`);
  }
}

if (verbose) {
  console.log('\n| Hồ sơ | Ch | Phòng | Loại | HP địch | TTK | Số đòn chịu | DR |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.profile} | C${r.ch} | ${r.room} | ${r.kind}${r.bossType ? '/' + r.bossType : ''} | ${r.enemyHp} | ${r.ttk.toFixed(2)}s | ${r.hits.toFixed(1)} | ${(r.dr * 100).toFixed(1)}% |`);
  }
}

// ==================== KẾT LUẬN ĐO ĐƯỢC ====================
console.log('\n=== KẾT LUẬN ĐO ĐƯỢC ===');
const ok = (cond, msg) => console.log((cond ? '  OK   ' : '  FAIL ') + msg);

// 1. Nâng cấp có làm trận đấu dễ hơn không?
const a1 = rows.find((r) => r.profileKey === 'A.' && r.ch === 1 && r.room === 1);
const f1 = rows.find((r) => r.profileKey === 'F.' && r.ch === 1 && r.room === 1);
console.log(`\n  [1] Cùng phòng C1-P1: hồ sơ A (ATK ${PROFILES[0].atk}) TTK ${a1.ttk.toFixed(2)}s | hồ sơ F (ATK ${PROFILES[5].atk}) TTK ${f1.ttk.toFixed(2)}s`);
console.log(`      Tỉ lệ ATK F/A = ${(PROFILES[5].atk / PROFILES[0].atk).toFixed(1)}× nhưng TTK chỉ giảm ${(a1.ttk / f1.ttk).toFixed(2)}×`);
console.log(`      Số đòn để hạ 1 quái: A ${a1.hitsToKill.toFixed(1)} | F ${f1.hitsToKill.toFixed(1)}`);

// 2. Số đòn người chơi chịu được có tăng khi lên đồ?
const aHits = rows.find((r) => r.profileKey === 'A.' && r.ch === 1 && r.room === 1).hits;
const fHits = rows.find((r) => r.profileKey === 'F.' && r.ch === 1 && r.room === 1).hits;
console.log(`\n  [2] Số đòn quái phải đánh để giết người chơi: A ${aHits.toFixed(1)} | F ${fHits.toFixed(1)}`);
console.log(`      HP tăng ${(PROFILES[5].hp / PROFILES[0].hp).toFixed(1)}× nhưng sát thương quái cũng tăng theo -> gần như không đổi.`);

// 3. Chương sau có khó hơn?
for (const key of ['A.', 'E.']) {
  const c1 = rows.find((r) => r.profileKey === key && r.ch === 1 && r.kind === 'boss cuối');
  const c5 = rows.find((r) => r.profileKey === key && r.ch === 5 && r.kind === 'boss cuối');
  console.log(`\n  [3] ${key} boss cuối: C1 ${c1.ttk.toFixed(1)}s -> C5 ${c5.ttk.toFixed(1)}s (${(c5.ttk / c1.ttk).toFixed(2)}×)`);
}

// 4. Người yếu ở chương cao
const g5 = rows.find((r) => r.profileKey === 'G.' && r.ch === 5 && r.room === 1);
console.log(`\n  [4] Hồ sơ G (starter gear) ở C5-P1: TTK ${g5.ttk.toFixed(2)}s, chịu ${g5.hits.toFixed(1)} đòn`);
console.log(`      -> ${g5.hits < 5 ? 'chết rất nhanh: đúng là "yếu gặp màn cao"' : 'vẫn sống được: chưa đủ áp lực'}`);

// 5. Bất biến kỹ thuật
console.log('');
ok(rows.every((r) => Number.isFinite(r.ttk) && r.ttk > 0), 'Không NaN/Infinity, TTK > 0');
ok(rows.every((r) => r.hits >= 1), 'Số đòn chịu được >= 1');
const bosses = rows.filter((r) => r.kind !== 'quái');
ok(bosses.every((r) => r.ttk <= 120), 'Không trùm nào cần > 120s (không bức tường)');
