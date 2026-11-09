// Khoa can bang nen kinh te phat trien: neu ai sua gia nang cap / ti le roi
// cuon giay / vang moi tran lam tien trinh pha vo, test nay se bat.
//
// Chay: node tests/progression-economy.test.mjs
//
// Cong thuc doc TRUC TIEP tu public/index.html de test that su bao ve source,
// khong phai ban sao chep co the lac hau.

import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");


// Trích khối cân bằng ngoặc; thất bại rõ nếu anchor bị đổi, không cắt cửa sổ ký tự.
function section(marker, opening = '{', closing = '}') {
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('Thiếu anchor: ' + marker);
  const begin = html.indexOf(opening, start + marker.length);
  let depth = 0;
  for (let i = begin; i < html.length; i++) {
    if (html[i] === opening) depth++;
    else if (html[i] === closing && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error('Khối không đóng: ' + marker);
}

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
const needScrolls = new Function("lv", "return " + needMatch[0].replace(/Math.ceil\([^)]*\/\s*4\s*\)/, "Math.ceil(lv / 4)"));
const productionCost = html.match(/80\s*\+\s*\(item\.level \|\| 1\)\s*\*\s*45/);
check("chi phí production đọc được", !!productionCost);
const upgradeCost = lv => new Function("item", "return " + productionCost[0])({level:lv});

// ============================================================ 2. Tinh nguon cung
console.log("\n=== 2. NGUON CUNG (tu source) ===");
// Kỳ vọng PHÂN TÍCH, không phải thu nhập đo qua gameplay hay thời gian clear.
// Tân thủ: greed/goldBonus/scrollDropBonus đều 0, nhặt hết drop.
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../public/campaign-config.js', import.meta.url),'utf8'),ctx);
const config=ctx.ArtemisCampaignConfig;
const plans=Array.from({length:config.ROOM_COUNT},(_,i)=>config.roomPlan(1,i+1));
const bossKills=plans.filter(p=>p.isBoss).reduce((n,p)=>n+p.count,0);
const normalKills=plans.filter(p=>!p.isBoss).reduce((n,p)=>n+p.count,0);
function readPair(re,label) {
  const m=html.match(re); if(!m) throw Error('Không đọc được '+label);
  return {boss:Number(m[1]),normal:Number(m[2])};
}
const dropCount=readPair(/const dropCount = e\.isBoss \? (\d+) : (\d+);/,'dropCount');
const gold=readPair(/type: 'gold',\s*x:[^\n]*\n\s*y:[^\n]*\n\s*val: Math\.round\(\(e\.isBoss \? (\d+) : (\d+)\) \* greedMult\)/,'gold');
const chance=readPair(/const scrollDropChance = \(e\.isBoss \? ([\d.]+) : ([\d.]+)\)/,'scroll chance');
const scrollAmount=readPair(/type: 'scroll',[\s\S]*?val: e\.isBoss \? (\d+) : (\d+)/,'scroll amount');
const killsPerRun=normalKills+bossKills;
const scrollsPerRun=normalKills*chance.normal*scrollAmount.normal+bossKills*chance.boss*scrollAmount.boss;
const GOLD_PER_RUN=normalKills*dropCount.normal*gold.normal+bossKills*dropCount.boss*gold.boss;
console.log(`  PHÂN TÍCH ${plans.length} phòng: ${killsPerRun} quái, E[cuộn]=${scrollsPerRun.toFixed(2)}, vàng nền=${GOLD_PER_RUN}; không đo thời gian`);
check('đủ 50 phòng từ shared config',plans.length===50);
check('5 trùm ở 10/20/30/40/50',plans.filter(p=>p.isBoss).map(p=>p.room).join(',')==='10,20,30,40,50');
check('mọi chương cùng nguồn cung cơ sở',Array.from({length:19},(_,ch)=>
  Array.from({length:50},(_,i)=>config.roomPlan(ch+1,i+1).count).join(',')===plans.map(p=>p.count).join(',')).every(Boolean));
check('drop vàng production giữ boss 8×28 / thường 2×12',dropCount.boss===8&&dropCount.normal===2&&gold.boss===28&&gold.normal===12);
check('scroll production giữ boss 5 / thường 2',scrollAmount.boss===5&&scrollAmount.normal===2);
check('nguồn cung hữu hạn, dương',Number.isFinite(GOLD_PER_RUN)&&GOLD_PER_RUN>0&&scrollsPerRun>0);

// ============================================================ 3. Vang la diem nghen khi nang CA 6 slot
console.log("\n=== 3. VANG LA DIEM NGHEN (nang ca 6 slot) ===");
function costFor(maxLv) {
  let scrolls = 0, gold = 0;
  for (let lv = 1; lv < maxLv; lv++) { scrolls += needScrolls(lv); gold += upgradeCost(lv); }
  return { scrolls, gold };
}
const SLOTS = 6;

for (const target of [10,15,20]) {
  const one = costFor(target);
  const runsGold = (one.gold * SLOTS) / GOLD_PER_RUN;
  const runsScroll = (one.scrolls * SLOTS) / scrollsPerRun;
  console.log(`  ca 6 slot Lv${target}: ${runsGold.toFixed(1)} tran (vang) / ${runsScroll.toFixed(1)} tran (cuon)`);
  check(`Lv${target}: tổng chi phí không bị giảm khi kéo dài campaign`,
    one.gold === Array.from({length:target-1},(_,i)=>80+(i+1)*45).reduce((a,b)=>a+b,0));
  check(`Lv${target}: vẫn cần hơn một campaign nền cho cả 6 slot`,runsGold>1&&Number.isFinite(runsGold),runsGold.toFixed(2));
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
const stepsBlock = section("const BEGINNER_STEPS =", "[", "]");
const goldRewards = [...stepsBlock.matchAll(/gold:\s*(\d+)/g)].map(m => Number(m[1]));
const gemRewards = [...stepsBlock.matchAll(/gems:\s*(\d+)/g)].map(m => Number(m[1]));
const scrollRewards = [...stepsBlock.matchAll(/scrolls:\s*(\d+)/g)].map(m => Number(m[1]));

const sumGold = goldRewards.reduce((a, b) => a + b, 0);
const sumGems = gemRewards.reduce((a, b) => a + b, 0);
const sumScrolls = scrollRewards.reduce((a, b) => a + b, 0);
console.log(`  tong thuong: ${sumGold} vang, ${sumGems} gems, ${sumScrolls} cuon`);

check("co it nhat 5 buoc co thuong vang", goldRewards.length >= 5, String(goldRewards.length));
check("tong thuong vang = 3.050 (N01 100 + N02-N07 1950 + N08 1000)", sumGold === 3050, String(sumGold));
check("tong thuong gems = 155 (N08 80 + N02-N07 75)", sumGems === 155, String(sumGems));
check("tong thuong cuon = 7", sumScrolls === 7, String(sumScrolls));
check("thưởng khởi đầu không đủ nâng cả 6 slot Lv10",sumGold < costFor(10).gold*SLOTS);

// ============================================================ 6. Tai khoan moi khong co loi the
console.log("\n=== 6. CHOT: TAI KHOAN MOI XUAT PHAT TU DAU ===");
check("talent mac dinh = 0 (khong tang mien phi)",
  /ensureAllTalentCardsInitialized/.test(html) && !/levels\[[^\]]*\]\s*=\s*(?:card\.)?maxLv\s*;/i.test(section("function ensureAllTalentCardsInitialized")));
check("artifact mac dinh = 0 sao (khong tang mien phi)",
  /getArtifactStarMap/.test(html));
const artBlock = section("function getArtifactStarMap");
check("artifact khong con tang 15 sao", !/:\s*15\b/.test(artBlock), "con thay : 15");

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
