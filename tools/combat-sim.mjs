// Mo phong can bang combat tren 5 ho so — tinh TTK / Hits To Die tu CHINH
// cong thuc trong source (doc bang regex), khong dung browser, khong ghi save.
//
// Chay: node tools/combat-sim.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

function num(re, label) {
  const m = html.match(re);
  if (!m) throw new Error("Khong tim thay trong source: " + label);
  return Number(m[1]);
}

// ==================== HANG SO DOC TU SOURCE ====================
const BASE_ATK = num(/\((\d+) \+ gearAtk \+ gemAtk/, "base ATK");
const BASE_HP = num(/\((\d+) \+ gearHp \+ gemHp/, "base HP");
const MOB_HITS_BASE = num(/const baseHits = ([\d.]+) \+ depth/, "quai baseHits");
const MOB_HITS_DEPTH = num(/const baseHits = [\d.]+ \+ depth \* ([\d.]+)/, "quai hits depth");
const MOB_ATK_START = num(/playerMaxHp \/ \((\d+) - depth \* \d+\)/, "quai atk start");
const MOB_ATK_DEPTH = num(/playerMaxHp \/ \(\d+ - depth \* (\d+)\)/, "quai atk depth");
const BOSS_HITS_5 = num(/const hitsToKill = roomNum === 5 \? (\d+)/, "boss hits 5");
const BOSS_HITS_10 = num(/const hitsToKill = roomNum === 5 \? \d+ : \(roomNum === 10 \? (\d+)/, "boss hits 10");
const BOSS_HITS_FINAL = num(/const hitsToKill = roomNum === 5 \? \d+ : \(roomNum === 10 \? \d+ : (\d+)\)/, "boss hits final");
const BOSS_DEMON_MULT = num(/bossType === 'demon_king' \? ([\d.]+)/, "demon mult");
const BOSS_ATK_5 = num(/playerMaxHp \/ \(roomNum === 5 \? (\d+)/, "boss atk 5");
const BOSS_ATK_10 = num(/playerMaxHp \/ \(roomNum === 5 \? \d+ : \(roomNum === 10 \? (\d+)/, "boss atk 10");
const BOSS_ATK_FINAL = num(/playerMaxHp \/ \(roomNum === 5 \? \d+ : \(roomNum === 10 \? \d+ : (\d+)\)\)/, "boss atk final");
const ROOM_MUL_STEP = num(/const roomMul = 1 \+ \(roomNum - 1\) \* ([\d.]+)/, "roomMul step");
const DEF_K_BASE = num(/const defK = (\d+) \+ 120 \*/, "defK base");
const DEF_K_PER_ROOM = num(/const defK = \d+ \+ (\d+) \*/, "defK per room");
const DEF_CAP = num(/Math\.min\((0\.\d+), defFlat \/ \(defFlat \+ defK\)\)/, "DEF cap");

const CHAPTERS = [
  { id: 1, rooms: 15, enemyScale: 1.0 },
  { id: 2, rooms: 12, enemyScale: 1.45 },
  { id: 3, rooms: 10, enemyScale: 2.0 },
];

// ==================== CONG THUC (theo source) ====================
function depthOf(room, maxRooms) {
  return Math.min(1, (room - 1) / Math.max(1, maxRooms - 1));
}
/** Quái thường: HP neo theo ATK người chơi -> TTK ổn định. */
function mobHp(playerAtk, room, maxRooms, enemyScale, atkMul = 1) {
  const scale = enemyScale * (1 + (room - 1) * ROOM_MUL_STEP);
  const baseHits = MOB_HITS_BASE + depthOf(room, maxRooms) * MOB_HITS_DEPTH;
  return playerAtk * baseHits * atkMul * scale;
}
/** Quái thường: ATK neo theo MaxHP người chơi -> số đòn chịu được ổn định. */
function mobAtk(playerMaxHp, room, maxRooms, count = 3) {
  const hits = MOB_ATK_START - depthOf(room, maxRooms) * MOB_ATK_DEPTH;
  return playerMaxHp / hits / Math.sqrt(count / 3);
}
/** Boss: HP = playerAtk * hitsToKill * chapterMul. */
function bossHp(playerAtk, room, enemyScale, isDemon) {
  const hits = room === 5 ? BOSS_HITS_5 : (room === 10 ? BOSS_HITS_10 : BOSS_HITS_FINAL);
  return playerAtk * hits * enemyScale * (isDemon ? BOSS_DEMON_MULT : 1);
}
/** Boss: ATK = playerMaxHp / soDon (9 / 7 / 5). */
function bossAtk(playerMaxHp, room) {
  const hits = room === 5 ? BOSS_ATK_5 : (room === 10 ? BOSS_ATK_10 : BOSS_ATK_FINAL);
  return playerMaxHp / hits;
}
function dps(p) {
  const avgCrit = 1 + p.crit * (p.critMult - 1);
  return p.atk * p.aspd * avgCrit;
}
function survivability(p, incomingAtk, maxRooms) {
  const defK = DEF_K_BASE + DEF_K_PER_ROOM * maxRooms;
  const dr = Math.min(DEF_CAP, p.def / (p.def + defK));
  const effective = incomingAtk * (1 - dr);
  return { dr, effective, hits: Math.max(1, p.hp / Math.max(1, effective)) };
}

// ==================== HO SO NGUOI CHOI ====================
// So lieu do that tu getComputedStats() tren trinh duyet sau khi sua cong thuc.
const PROFILES = [
  { name: "1.Tan thu (common Lv.1)", atk: 173, hp: 751, crit: 0.22, critMult: 1.85, aspd: 1.94, def: 0 },
  { name: "2.Sau HD (fine Lv.10)", atk: 991, hp: 3889, crit: 0.22, critMult: 1.85, aspd: 1.94, def: 27 },
  { name: "3.Qua C1 (rare Lv.30)", atk: 4845, hp: 16602, crit: 0.36, critMult: 2.10, aspd: 2.20, def: 93 },
  { name: "4.Mid (epic Lv.60)", atk: 15833, hp: 50152, crit: 0.46, critMult: 2.35, aspd: 2.62, def: 185 },
  { name: "5.Late (mythic Lv.100)", atk: 71484, hp: 224920, crit: 0.70, critMult: 2.60, aspd: 3.13, def: 313 },
];

// ==================== CHAY MO PHONG ====================
const rows = [];
for (const p of PROFILES) {
  const d = dps(p);
  for (const ch of CHAPTERS) {
    // Quái thường: đầu / giữa / cuối chương (bỏ phòng trùm)
    const mobRooms = [1, Math.ceil(ch.rooms / 2), Math.max(1, ch.rooms - 1)]
      .filter((r, i, a) => a.indexOf(r) === i && r < ch.rooms && r % 5 !== 0);
    for (const r of mobRooms) {
      const hp = mobHp(p.atk, r, ch.rooms, ch.enemyScale);
      const atk = mobAtk(p.hp, r, ch.rooms, 3);
      const s = survivability(p, atk, ch.rooms);
      rows.push({ profile: p.name, ch: ch.id, room: r, kind: "quai", ttk: hp / d, hits: s.hits, dr: s.dr });
    }
    // Boss: phòng 5 và phòng cuối
    const bossRooms = [5, ch.rooms].filter((v, i, a) => a.indexOf(v) === i && v <= ch.rooms);
    for (const r of bossRooms) {
      const isFinal = r === ch.rooms;
      const isDemon = ch.id === 3 && isFinal;
      // Phòng cuối dùng mốc hitsToKill cuối (40), không phải mốc phòng 5
      const hp = bossHp(p.atk, isFinal ? 999 : r, ch.enemyScale, isDemon);
      const atk = bossAtk(p.hp, isFinal ? 999 : r);
      const s = survivability(p, atk, ch.rooms);
      rows.push({ profile: p.name, ch: ch.id, room: r, kind: isFinal ? "boss cuoi" : "boss-5",
        ttk: hp / d, hits: s.hits, dr: s.dr });
    }
  }
}

// ==================== IN BANG ====================
console.log("=== HANG SO DOC TU SOURCE ===");
console.log(`  BASE_ATK=${BASE_ATK}  BASE_HP=${BASE_HP}  roomMul=1+(r-1)*${ROOM_MUL_STEP}`);
console.log(`  Quai: HP=atk*(${MOB_HITS_BASE}+depth*${MOB_HITS_DEPTH})*scale  ATK=maxHp/(${MOB_ATK_START}-depth*${MOB_ATK_DEPTH})`);
console.log(`  Boss: HP=atk*hits(${BOSS_HITS_5}/${BOSS_HITS_10}/${BOSS_HITS_FINAL})*chapterMul  ATK=maxHp/(${BOSS_ATK_5}/${BOSS_ATK_10}/${BOSS_ATK_FINAL})`);
console.log(`  DEF K=${DEF_K_BASE}+${DEF_K_PER_ROOM}*rooms cap=${DEF_CAP}\n`);
console.log("| Ho so | Ch | Phong | Loai | TTK | Hits | DR |");
console.log("|---|---|---|---|---|---|---|");
for (const r of rows) {
  console.log(`| ${r.profile} | C${r.ch} | ${r.room} | ${r.kind} | ${r.ttk.toFixed(2)}s | ${r.hits.toFixed(1)} | ${(r.dr * 100).toFixed(1)}% |`);
}

// ==================== KIEM TRA TIEU CHI ====================
console.log("\n=== KIEM TRA TIEU CHI ===");
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "  OK   " : "  FAIL ") + msg); if (!cond) fails++; };

const mobs = rows.filter(r => r.kind === "quai");
const bosses = rows.filter(r => r.kind !== "quai");

ok(mobs.every(r => r.ttk >= 0.2), "Moi quai thuong TTK >= 0.2s");
ok(mobs.every(r => r.ttk <= 8), "Moi quai thuong TTK <= 8s");
ok(mobs.every(r => r.hits >= 3), "Nguoi choi chiu it nhat 3 don quai");
ok(bosses.every(r => r.ttk <= 60), "Moi boss TTK <= 60s (khong buoc tuong)");
ok(bosses.every(r => r.hits >= 4), "Nguoi choi chiu it nhat 4 don boss");

// Boss phai du lau de co tran dau THAT khi nguoi choi o dung tam chuong.
// (Nguoi choi qua manh so voi chuong thi giet nhanh la dung thiet ke —
//  khong the doi boss Chuong 1 tru duoc mot tai khoan Lv.100 mythic.)
const APPROPRIATE = {
  "1.Tan thu (common Lv.1)": 1,
  "2.Sau HD (fine Lv.10)": 1,
  "3.Qua C1 (rare Lv.30)": 2,
  "4.Mid (epic Lv.60)": 3,
  "5.Late (mythic Lv.100)": 3,
};
for (const [name, chId] of Object.entries(APPROPRIATE)) {
  const at = bosses.filter(r => r.profile === name && r.ch === chId);
  if (!at.length) continue;
  ok(at.every(r => r.ttk >= 4), `${name} o dung chuong C${chId}: moi boss TTK >= 4s (${at.map(r => r.ttk.toFixed(1)).join("/")}s)`);
}
// Boss khong duoc chet duoi 1s o dung tam chuong (quai thuong chet nhanh la
// dung thiet ke roguelike — chi boss moi can du lau de co tran dau that).
for (const [name, chId] of Object.entries(APPROPRIATE)) {
  const at = bosses.filter(r => r.profile === name && r.ch === chId);
  if (!at.length) continue;
  ok(at.every(r => r.ttk > 1), `${name} o dung chuong C${chId}: khong boss nao chet duoi 1s`);
}

// Chuong sau kho hon: cung ho so, boss phong 5 cua C3 phai lau hon C1
for (const p of PROFILES) {
  const c1 = rows.find(r => r.profile === p.name && r.ch === 1 && r.kind === "boss-5");
  const c3 = rows.find(r => r.profile === p.name && r.ch === 3 && r.kind === "boss-5");
  if (c1 && c3) ok(c3.ttk > c1.ttk, `${p.name}: boss C3 (${c3.ttk.toFixed(1)}s) > C1 (${c1.ttk.toFixed(1)}s)`);
}
// Boss cuoi lau hon boss phong 5 trong cung chuong
for (const p of PROFILES) {
  const b5 = rows.find(r => r.profile === p.name && r.ch === 1 && r.kind === "boss-5");
  const bf = rows.find(r => r.profile === p.name && r.ch === 1 && r.kind === "boss cuoi");
  if (b5 && bf) ok(bf.ttk > b5.ttk, `${p.name}: boss cuoi C1 (${bf.ttk.toFixed(1)}s) > boss P5 (${b5.ttk.toFixed(1)}s)`);
}
// Trang bi tot hon -> giet nhanh hon
const t1 = mobHp(173, 1, 15, 1.0) / dps(PROFILES[0]);
const t5 = mobHp(71484, 1, 15, 1.0) / dps(PROFILES[4]);
ok(t5 < t1, `Nguoi manh hon giet quai nhanh hon (${t5.toFixed(2)}s < ${t1.toFixed(2)}s)`);
ok(rows.every(r => Number.isFinite(r.ttk) && Number.isFinite(r.hits) && r.ttk > 0 && r.hits > 0), "Khong NaN/Infinity");

console.log("\n" + (fails === 0 ? "TAT CA TIEU CHI DAT" : fails + " tieu chi KHONG dat"));
process.exit(fails > 0 ? 1 : 0);
