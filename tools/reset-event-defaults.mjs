// Reset các mặc định "full đồ" trong ensureWikiEventsState về mức người chơi mới.
// Chạy: node tools/reset-event-defaults.mjs
import fs from "node:fs";

const PATH = new URL("../public/index.html", import.meta.url);
let src = fs.readFileSync(PATH, "utf8");
const before = src;

// [tên biến, giá trị cũ, giá trị mới]
const REPLACEMENTS = [
  // --- Tháp Trời / Đấu Trường / Hang Vàng ---
  ["ev.skyTowerFloor", 125, 0],
  ["ev.skyTowerSubFloor", 0, 0],
  ["ev.arenaRankPts", 2450, 0],
  ["ev.goldCaveDifficulty", 15, 1],
  // --- Đảo Kho Báu ---
  ["ev.islandPoints", 24500, 0],
  ["ev.treasureCoins", 18, 0],
  ["ev.islandRollsCount", 85, 0],
  // --- Câu Cá ---
  ["ev.fishingLures", 45, 0],
  ["ev.fishingSilverTickets", 3600, 0],
  ["ev.fishingGoldTickets", 16, 0],
  ["ev.fishingKingShards", 12, 0],
  ["ev.fishingSnappedLines", 4, 0],
  ["ev.fishingTotalKg", "640.5", 0],
  // --- Rừng Cổ / Người Lùn ---
  ["ev.elfPickaxes", 60, 0],
  ["ev.beerBombs", 6, 0],
  ["ev.gnomeDrills", 5, 0],
  ["ev.shamrocks", 4500, 0],
  ["ev.goldPots", 2400, 0],
  ["ev.worldTreeDepth", 18, 0],
  // --- Triệu Hồi Quỷ / Clash ---
  ["ev.demonSummonTickets", 35, 0],
  ["ev.eonCores", 3, 0],
  ["ev.clashBadges", 6800, 0],
  ["ev.demonTotalSpins", 45, 0],
  ["ev.demonLuckMeter", 45, 0],
  // --- Lễ Hội ---
  ["ev.carnival1Points", 240, 0],
  ["ev.carnival2Points", 180, 0],
];

let total = 0;
for (const [name, oldV, newV] of REPLACEMENTS) {
  const re = new RegExp(
    `(if \\(typeof ${name.replace(/\./g, "\\.")} !== 'number'\\) ${name.replace(/\./g, "\\.")} = )${String(oldV)};`,
    "g"
  );
  const hits = (src.match(re) || []).length;
  if (hits > 0) {
    src = src.replace(re, `$1${newV};`);
    total += hits;
    console.log(`  ${name}: ${oldV} -> ${newV}  (${hits} chỗ)`);
  }
}

// Mảng kỹ năng/tháp/campaignClaimed mặc định
src = src.replace(
  /if \(!Array\.isArray\(ev\.skyTowerRunSkills\)\) ev\.skyTowerRunSkills = \['Tracking Eye', 'Multi-Shot', 'Lightning Bolt'\];/,
  "if (!Array.isArray(ev.skyTowerRunSkills)) ev.skyTowerRunSkills = [];"
);
src = src.replace(
  /if \(!ev\.skyTower25Claimed \|\| typeof ev\.skyTower25Claimed !== 'object'\) ev\.skyTower25Claimed = \{ 25: true, 50: true, 75: true, 100: true \};/,
  "if (!ev.skyTower25Claimed || typeof ev.skyTower25Claimed !== 'object') ev.skyTower25Claimed = {};"
);
src = src.replace(
  /if \(!ev\.campaignClaimedSteps \|\| typeof ev\.campaignClaimedSteps !== 'object'\) ev\.campaignClaimedSteps = \{ 1: 5, 2: 5, 3: 5 \};/,
  "if (!ev.campaignClaimedSteps || typeof ev.campaignClaimedSteps !== 'object') ev.campaignClaimedSteps = {};"
);
src = src.replace(
  /if \(typeof ev\.arenaForceOpen !== 'boolean'\) ev\.arenaForceOpen = true;/,
  "if (typeof ev.arenaForceOpen !== 'boolean') ev.arenaForceOpen = false;"
);
src = src.replace(
  /if \(!ev\.fishingHookedFish\) \{\n\s*ev\.fishingHookedFish = \{ active: false, rarity: 'epic', name: 'Twilight Barracuda', kg: 18\.4, tensionPct: 72, redCycles: 2, distanceM: 68 \};\n\s*\}/,
  "if (!ev.fishingHookedFish) {\n          ev.fishingHookedFish = { active: false, rarity: null, name: null, kg: 0, tensionPct: 0, redCycles: 0, distanceM: 0 };\n        }"
);
src = src.replace(
  /if \(!ev\.selectedArenaRankTab\) ev\.selectedArenaRankTab = 'master';/,
  "if (!ev.selectedArenaRankTab) ev.selectedArenaRankTab = 'bronze';"
);

if (src === before) {
  console.log("Không có thay đổi nào được áp dụng.");
  process.exit(1);
}

fs.writeFileSync(PATH, src);
console.log(`\nĐã sửa ${total} mặc định + các mảng/mốc. Ghi ${PATH.pathname}`);
