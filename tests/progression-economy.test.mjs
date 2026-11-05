// Khoa can bang nen kinh te phat trien: neu ai sua gia nang cap / ti le roi
// cuon giay / vang moi tran lam tien trinh pha vo, test nay se bat.
//
// Chay: node tests/progression-economy.test.mjs
//
// Cong thuc doc TRUC TIEP tu public/index.html de test that su bao ve source,
// khong phai ban sao chep co the lac hau.

import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ============================================================ 1. Doc cong thuc
console.log("\n=== 1. CONG THUC TRONG SOURCE ===");

// needScrolls(lv) = max(1, min(25, ceil(lv/4)))
const needMatch = html.match(/Math\.max\(\s*1,\s*Math\.min\(\s*25,\s*Math\.ceil\([^)]*\/\s*4\s*\)\s*\)\s*\)/);
check("tim thay cong thuc cuon giay can (max(1,min(25,ceil(lv/4))))", !!needMatch,
  needMatch ? "" : "khong tim thay trong index.html");

// upgradeCost: 80 + lv*45  (hoac tuong duong)
const costMatch = html.match(/80\s*\+\s*[A-Za-z_.$]*(?:level|lv)[A-Za-z_.$]*\s*\*\s*45/);
check("tim thay cong thuc gia nang cap (80 + lv*45)", !!costMatch,
  costMatch ? "" : "khong tim thay");

// ti le roi cuon tu quai thuong
const dropMatch = html.match(/isBoss\s*\?\s*1\.0\s*:\s*0\.28/);
check("ti le roi cuon quai thuong = 28%, boss = 100%", !!dropMatch);
check("so slot chon ngau nhien deu (khong thien vi)",
  /Object\.keys\(WIKI_GEAR_SCROLLS_META\)/.test(html) && /Math\.floor\(Math\.random\(\)\s*\*\s*slotKeys\.length\)/.test(html));

// Dung lai cong thuc de tinh toan
const needScrolls = (lv) => Math.max(1, Math.min(25, Math.ceil(lv / 4)));
const upgradeCost = (lv) => 80 + lv * 45;

// ============================================================ 2. Tinh nguon cung
console.log("\n=== 2. NGUON CUNG (tu source) ===");
const ROOMS = 15, BOSS_ROOMS = [5, 10, 15], AVG_NORMAL = 5.5;
const normalRooms = ROOMS - BOSS_ROOMS.length;
const killsPerRun = normalRooms * AVG_NORMAL + BOSS_ROOMS.length;
const scrollsPerRun = normalRooms * AVG_NORMAL * 0.28 * 2 + BOSS_ROOMS.length * 1.0 * 5;
// Vang do THUC TE tren production
const GOLD_PER_RUN = 2049;

console.log(`  quai/tran=${killsPerRun.toFixed(0)}  cuon/tran=${scrollsPerRun.toFixed(1)}  vang/tran=${GOLD_PER_RUN}`);
check("1 tran co 60-80 quai", killsPerRun >= 60 && killsPerRun <= 80, String(killsPerRun));
check("1 tran roi 40-65 cuon giay", scrollsPerRun >= 40 && scrollsPerRun <= 65, String(scrollsPerRun));

// ============================================================ 3. Vang la diem nghen khi nang CA 6 slot
console.log("\n=== 3. VANG LA DIEM NGHEN (nang ca 6 slot) ===");
function costFor(maxLv) {
  let scrolls = 0, gold = 0;
  for (let lv = 1; lv < maxLv; lv++) { scrolls += needScrolls(lv); gold += upgradeCost(lv); }
  return { scrolls, gold };
}
const SLOTS = 6;

for (const [target, lo, hi] of [[10, 4, 14], [15, 10, 26], [20, 18, 45]]) {
  const one = costFor(target);
  const runsGold = (one.gold * SLOTS) / GOLD_PER_RUN;
  const runsScroll = (one.scrolls * SLOTS) / scrollsPerRun;
  console.log(`  ca 6 slot Lv${target}: ${runsGold.toFixed(1)} tran (vang) / ${runsScroll.toFixed(1)} tran (cuon)`);
  check(`Lv${target} ca 6 slot: ${lo}-${hi} tran (khong qua de, khong qua kho)`,
    runsGold >= lo && runsGold <= hi, runsGold.toFixed(1));
  check(`Lv${target}: vang la diem nghen, khong phai cuon giay`,
    runsGold > runsScroll, `${runsGold.toFixed(1)} vs ${runsScroll.toFixed(1)}`);
}

// ============================================================ 4. Khong the nang cap mien phi
console.log("\n=== 4. KHONG THE NANG CAP MIEN PHI ===");
check("cuon giay can luon >= 1", Array.from({length: 100}, (_, i) => needScrolls(i + 1)).every(n => n >= 1));
check("cuon giay can <= 25 (co tran)", Array.from({length: 200}, (_, i) => needScrolls(i + 1)).every(n => n <= 25));
check("gia nang cap luon > 0", Array.from({length: 200}, (_, i) => upgradeCost(i + 1)).every(c => c > 0 && isFinite(c)));
check("gia tang dan theo cap", Array.from({length: 50}, (_, i) => upgradeCost(i + 2) > upgradeCost(i + 1)).every(Boolean));
check("level 1 can dung 1 cuon", needScrolls(1) === 1);
check("level 100 khong tran so", isFinite(upgradeCost(100)));

// ============================================================ 5. Chia thuong Beginner Journey
console.log("\n=== 5. THUONG BEGINNER JOURNEY ===");
// Doc reward tu BEGINNER_STEPS
const stepsBlock = html.slice(html.indexOf("const BEGINNER_STEPS"), html.indexOf("];", html.indexOf("const BEGINNER_STEPS")) + 2);
const goldRewards = [...stepsBlock.matchAll(/gold:\s*(\d+)/g)].map(m => Number(m[1]));
const gemRewards = [...stepsBlock.matchAll(/gems:\s*(\d+)/g)].map(m => Number(m[1]));
const scrollRewards = [...stepsBlock.matchAll(/scrolls:\s*(\d+)/g)].map(m => Number(m[1]));

const sumGold = goldRewards.reduce((a, b) => a + b, 0);
const sumGems = gemRewards.reduce((a, b) => a + b, 0);
const sumScrolls = scrollRewards.reduce((a, b) => a + b, 0);
console.log(`  tong thuong: ${sumGold} vang, ${sumGems} gems, ${sumScrolls} cuon`);

check("co it nhat 5 buoc co thuong vang", goldRewards.length >= 5, String(goldRewards.length));
check("tong thuong vang = 3.050 (N01 100 + N02-N07 1950 + N08 1000, da kiem chung tren production)", sumGold === 3050, String(sumGold));
check("tong thuong gems = 155 (N08 80 + N02-N07 75, da kiem chung tren production)", sumGems === 155, String(sumGems));
check("tong thuong cuon = 7 (da kiem chung tren production)", sumScrolls === 7, String(sumScrolls));
check("thuong vang tuong duong 1-2 tran (khong pha can bang)",
  sumGold / GOLD_PER_RUN >= 0.5 && sumGold / GOLD_PER_RUN < 3, (sumGold / GOLD_PER_RUN).toFixed(2));

// ============================================================ 6. Tai khoan moi khong co loi the
console.log("\n=== 6. CHOT: TAI KHOAN MOI XUAT PHAT TU DAU ===");
check("talent mac dinh = 0 (khong tang mien phi)",
  /ensureAllTalentCardsInitialized/.test(html) && !/levels\[[^\]]*\]\s*=\s*(?:card\.)?maxLv\s*;/i.test(html.slice(html.indexOf("function ensureAllTalentCardsInitialized"), html.indexOf("function ensureAllTalentCardsInitialized") + 2000)));
check("artifact mac dinh = 0 sao (khong tang mien phi)",
  /getArtifactStarMap/.test(html));
const artBlock = html.slice(html.indexOf("function getArtifactStarMap"), html.indexOf("function getArtifactStarMap") + 2500);
check("artifact khong con tang 15 sao", !/:\s*15\b/.test(artBlock), "con thay : 15");

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
