// Khoa lai cac lo hong "bam nhieu lan = tai nguyen mien phi".
//
// Chay: node tests/free-resource.test.mjs
//
// Ba lo hong da va:
//   1. btnTopAddGold / btnTopAddGem / btnRefillStamina — moi click +500 vang /
//      +50 da quy / +300 vang & day nang luong, KHONG gioi han, khong nam trong
//      danh sach chan dev-cheat => nguoi choi that bam duoc vo han.
//   2. summonHeroShards() — neu thieu 50 da quy thi TU CONG +500 roi tru 50
//      => lai rong +450 da quy + 100 manh tuong MOI LAN BAM, vo gioi han.
//   3. resetHeroStarToOne() — dat sao ve 0 kem 1.600 manh, khong co guard.

import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

function block(fnName, len = 2600) {
  const i = html.indexOf("function " + fnName);
  if (i < 0) return "";
  return html.slice(i, i + len);
}

// =============================================== 1. Ba nút viện trợ
console.log("\n=== 1. NUT VIEN TRO (btnTopAddGold / btnTopAddGem / btnRefillStamina) ===");
const cheatListStart = html.indexOf("const DEV_CHEAT_BUTTON_IDS = [");
const cheatList = html.slice(cheatListStart, html.indexOf("];", cheatListStart));

check("btnTopAddGold nam trong danh sach chan", cheatList.includes("'btnTopAddGold'"));
check("btnTopAddGem nam trong danh sach chan", cheatList.includes("'btnTopAddGem'"));
check("btnRefillStamina nam trong danh sach chan", cheatList.includes("'btnRefillStamina'"));

// Moi handler phai co guard tang ham
for (const [id, fn] of [
  ["btnTopAddGold", "SaveState.gold += 500"],
  ["btnTopAddGem", "SaveState.gems += 50"],
  ["btnRefillStamina", "SaveState.stamina = 30"],
]) {
  const i = html.indexOf("document.getElementById('" + id + "')");
  const handler = html.slice(i, i + 700);
  check(`${id}: handler co guard devCheatsEnabled`, /if \(!devCheatsEnabled\(\)\)/.test(handler));
  check(`${id}: guard chay TRUOC khi cong tai nguyen`,
    handler.indexOf("devCheatsEnabled()") < handler.indexOf(fn.split("+= ")[0].trim()) ||
    handler.indexOf("devCheatsEnabled()") < handler.indexOf(fn));
}

// =============================================== 2. summonHeroShards
console.log("\n=== 2. summonHeroShards (truoc day TANG da quy khi thieu) ===");
const summon = block("summonHeroShards");
check("tim thay ham summonHeroShards", summon.length > 100);
check("KHONG con dong tu cong 500 da quy", !/SaveState\.gems\s*\+=\s*500/.test(summon),
  "van con 'SaveState.gems += 500'");
check("co kiem tra thieu da quy", /SaveState\.gems\s*\|\|\s*0\)\s*<\s*gemCost|SaveState\.gems\s*<\s*gemCost/.test(summon));
check("thieu thi bao loi va return", /showToast\([^)]*Cần[^)]*\)[\s\S]{0,120}?return/.test(summon));
check("du thi tru dung gemCost", /SaveState\.gems\s*=\s*Math\.max\(0,\s*SaveState\.gems\s*-\s*gemCost\)/.test(summon));
check("du thi cong manh tuong", /getHeroShardsCount\(heroId\)\s*\+\s*amount/.test(summon));

// Toan file: khong con cho nao tu cong da quy khi thieu
const selfGrant = [...html.matchAll(/if\s*\(\s*SaveState\.(?:gems|gold)\s*<\s*[^)]{1,40}\)\s*\{\s*SaveState\.(?:gems|gold)\s*\+=/g)];
check("khong con mau 'thieu X thi tu cong X' trong toan file", selfGrant.length === 0,
  selfGrant.length + " cho");

// =============================================== 3. resetHeroStarToOne
console.log("\n=== 3. resetHeroStarToOne (tang 1.600 manh mien phi) ===");
const resetFn = block("resetHeroStarToOne");
check("tim thay resetHeroStarToOne", resetFn.length > 100);
check("co guard devCheatsEnabled", /if \(!devCheatsEnabled\(\)\)\s*\{\s*blockedCheatNotice\(\);\s*return;/.test(resetFn));
check("guard chay truoc khi cong manh",
  resetFn.indexOf("devCheatsEnabled()") < resetFn.indexOf("heroShards[heroId] = Math.max"));

// =============================================== 4. Các hàm cheat đã có guard từ trước
console.log("\n=== 4. CAC HAM CHEAT KHAC VAN CO GUARD ===");
for (const fn of ["maxSingleHeroStarAndSkins"]) {
  const b = block(fn, 600);
  check(`${fn} co guard devCheatsEnabled`, /devCheatsEnabled\(\)/.test(b));
}
// applyMaxAllSystems la class METHOD (khong phai function) — tim theo ten method
const amasIdx = html.indexOf("applyMaxAllSystems(resetSets");
check("applyMaxAllSystems (class method) co guard devCheatsEnabled",
  amasIdx > 0 && /devCheatsEnabled\(\)/.test(html.slice(amasIdx, amasIdx + 600)));

// =============================================== 5. Không có đường vòng
console.log("\n=== 5. KHONG CO DUONG VONG ===");
check("devCheatsEnabled doc tu query string, khong tu localStorage",
  /function devCheatsEnabled/.test(html) && /dev=1|devCheats|URLSearchParams|location\.search/.test(
    block("devCheatsEnabled", 500)));
check("applyDevCheatVisibility duoc goi sau renderLobbyUI",
  /renderLobbyUI[\s\S]{0,600}?applyDevCheatVisibility\(\)/.test(html) ||
  /applyDevCheatVisibility\(\)[\s\S]{0,200}?renderLobbyUI/.test(html) ||
  (html.match(/applyDevCheatVisibility\(\)/g) || []).length >= 2,
  "chi goi 1 lan");

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
