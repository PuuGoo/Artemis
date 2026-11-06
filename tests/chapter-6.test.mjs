// Regression checks cho gameplay Chương 6: Tinh Hải Băng Ngục.
// Chạy: node tests/chapter-6.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const map = fs.readFileSync(new URL("../public/assets/map-ch6-frost-cosmos.svg", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, condition, extra = "") {
  if (condition) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? " -> " + extra : "")); }
}
function blockAfter(source, marker, nextMarker) {
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const end = nextMarker ? source.indexOf(nextMarker, start + marker.length) : -1;
  return source.slice(start, end < 0 ? source.length : end);
}

console.log("\n=== CHAPTER 6: WORLD DATA ===");
const chapters = blockAfter(html, "const CHAPTERS = [", "\n      ];");
check("Chapter 6 exists as ID 6", /id: 6,/.test(chapters));
check("15 rooms and unlock after Chapter 5", /id: 6,[\s\S]{0,700}?rooms: 15,[\s\S]{0,500}?chapterId: 5/.test(chapters));
check("unique map art and boss name", chapters.includes("map-ch6-frost-cosmos.svg") && chapters.includes("Cửu Diệu Tinh Long"));
check("three original Chapter 6 biomes are registered", ["frostfall", "aurora_shelf", "glacier_spire"].every(id => html.includes("def('" + id + "'")));
check("Chapter 6 cycles through its own biome pool", /6: \['frostfall', 'aurora_shelf', 'glacier_spire', 'frostfall'\]/.test(html));
check("boss arena maps to the Ninth Star Dragon", /ninth_star_dragon: 'ninth_star_arena'/.test(html));

console.log("\n=== CHAPTER 6: ENEMIES & ART ===");
const bestiary = blockAfter("const BESTIARY = [", "\n      ];");
for (const id of ["frostfang_wolf", "aurora_wisp", "prism_knight", "ninth_star_dragon"]) {
  check("Bestiary entry " + id, bestiary.includes("id: '" + id + "'"));
}
for (const sprite of ["drawFrostfangWolf", "drawAuroraWisp", "drawPrismKnight", "drawNinthStarDragon"]) {
  check("custom Canvas sprite " + sprite, html.includes("function " + sprite + "("));
}
check("all three enemies have drawBody routing", ["frostfang_wolf", "aurora_wisp", "prism_knight"].every(id => html.includes("ty === '" + id + "'")));
check("boss sprite registered in BOSSFN", /ninth_star_dragon: drawNinthStarDragon/.test(html));
check("map SVG is valid 1200x600", map.trimStart().startsWith("<svg") && map.includes('viewBox="0 0 1200 600"') && map.includes("</svg>"));
check("map uses layered gradients, glow and depth", (map.match(/<(linear|radial)Gradient/g) || []).length >= 7 && (map.match(/<path/g) || []).length >= 15 && map.includes("<filter "));

console.log("\n=== CHAPTER 6: COMBAT INTEGRATION ===");
const setup = blockAfter("function setupRoom(roomNum)", "function updateInGameHUD");
check("boss spawn selects Ninth Star Dragon for Chapter 6", /chapterId === 6 \? 'ninth_star_dragon'/.test(setup));
check("boss title and color are defined", setup.includes("TRÙM CUỐI: CỬU DIỆU TINH LONG") && setup.includes("ninth_star_dragon"));
check("normal spawn pool contains the three new enemies", /\['frostfang_wolf', 'aurora_wisp', 'prism_knight'\]/.test(setup));
check("monster stat scaling includes each new enemy", ["frostfang_wolf", "aurora_wisp", "prism_knight"].every(id => setup.includes(id)));
const combat = blockAfter("if (e.type === 'ninth_star_dragon')", "} else if (e.type === 'eclipse_sovereign')");
check("boss has three distinct attack phases", combat.includes("e.phaseTimer === 0") && combat.includes("e.phaseTimer === 1") && combat.includes("for (let k = 0; k < 9; k++)"));
check("boss enters rage below 50% HP", /e\.hp \/ Math\.max\(1, e\.maxHp\) < 0\.5/.test(combat) && combat.includes("enraged ? 1.18 : 1.58"));
const attacks = blockAfter("} else if (e.type === 'frostfang_wolf')", "} else if (e.type === 'rift_stalker')");
check("each new monster has its own projectile pattern", ["frostfang_wolf", "aurora_wisp", "prism_knight"].every(id => attacks.includes(id)));

console.log("\n================ " + pass + " PASS / " + fail + " FAIL ================\n");
process.exit(fail > 0 ? 1 : 0);
