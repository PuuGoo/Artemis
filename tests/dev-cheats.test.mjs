// Test dev cheats gate: mọi nút cheat phải bị ẩn & chặn khi không bật ?dev=1.
// Chạy: node tests/dev-cheats.test.mjs
import fs from "node:fs";

const HTML = new URL("../public/index.html", import.meta.url);
const src = fs.readFileSync(HTML, "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ---------------------------------------------------------------- 1. Cờ
console.log("\n=== 1. CO DEV_CHEATS ===");
check("co DEV_CHEATS", src.includes("const DEV_CHEATS = (function ()"));
check("bat bang ?dev=1", src.includes("q.get('dev') === '1'"));
check("luu vao localStorage de nho", src.includes("localStorage.setItem('artemis_dev', '1')"));
check("doc lai tu localStorage", src.includes("localStorage.getItem('artemis_dev') === '1'"));
check("co devCheatsEnabled()", src.includes("function devCheatsEnabled()"));
check("mac dinh tra false khi loi", /catch \(e\) \{\s*\n\s*return false;/.test(src));

// ---------------------------------------------------------------- 2. Danh sách nút
console.log("\n=== 2. DANH SACH NUT CHEAT ===");
const REQUIRED = [
  "btnMaxAllSystems",       // MAX ĐỒ trên HUD
  "btnWorkshopMaxAll",      // Max Full Đồ trong workshop
  "btnMaxRunSkills",        // Full 18 Kỹ Năng
  "btnMaxAllTalents5Star",  // Max 32 Thẻ Tài Năng
  "btnMaxAllArtifacts15",   // Max 46 Thánh Vật 15★
  "btnMaxAllWikiItems",     // Max vàng/gems/cuộn giấy/chìa khóa
  "btnMaxAllWikiEventsCurrencies", // Max tài nguyên sự kiện
  "btnResetWikiItemsStarter",      // Reset trang bị về mức khởi đầu
  "btnModalMaxUpgradeGear",        // Mythic Lv.100 + 4 gem + 3 SS affix
];
const listStart = src.indexOf("const DEV_CHEAT_BUTTON_IDS = [");
const listEnd = src.indexOf("];", listStart);
const listBody = src.slice(listStart, listEnd);
for (const id of REQUIRED) {
  check(`danh sach an co ${id}`, listBody.includes(`'${id}'`));
}
// btnModalResetLevel KHONG duoc an: do la tinh nang that (hoan cap lay vang)
check("KHONG an btnModalResetLevel (tinh nang that)", !listBody.includes("btnModalResetLevel"));

// ---------------------------------------------------------------- 3. applyDevCheatVisibility
console.log("\n=== 3. HAM AN/HIEN ===");
const applyStart = src.indexOf("function applyDevCheatVisibility()");
check("co applyDevCheatVisibility", applyStart > 0);
const applyBody = src.slice(applyStart, applyStart + 1400);
check("lap qua DEV_CHEAT_BUTTON_IDS", applyBody.includes("for (const id of DEV_CHEAT_BUTTON_IDS)"));
check("an bang class hidden", applyBody.includes("el.classList.add('hidden')"));
check("an bang style display none (chong CSS khac)", applyBody.includes("el.style.display = 'none'"));
check("xu ly nut max-star dong", applyBody.includes("[data-max-star-hero]"));
check("xu ly nut reset-star dong", applyBody.includes("[data-reset-star-hero]"));
check("goi luc script chay", /normalizeStateArrays\(\);\s*\n\s*\/\/[^\n]*\n\s*applyDevCheatVisibility\(\);/.test(src));
check("goi trong renderLobbyUI", src.includes("safeRender('devCheats'"));
check("co toast khi bi chan", src.includes("function blockedCheatNotice()"));

// ---------------------------------------------------------------- 4. Chặn từng handler
console.log("\n=== 4. CHAN TUNG HANDLER ===");
const GUARDED = [
  ["handleMaxAllClick", "function handleMaxAllClick() {"],
  ["grantAllRogueSkillsInRun", "function grantAllRogueSkillsInRun() {"],
];
for (const [name, anchor] of GUARDED) {
  const i = src.indexOf(anchor);
  check(`${name} co guard`, i > 0 && src.slice(i, i + 400).includes("if (!devCheatsEnabled()) { blockedCheatNotice(); return; }"));
}

// Handler dạng arrow inline: kiểm tra trong phạm vi 400 ký tự sau điểm gán
const INLINE = [
  ["btnMaxAllTalents5Star", "const maxTalBtn = document.getElementById('btnMaxAllTalents5Star');"],
  ["btnMaxAllArtifacts15", "const maxAllArtBtn = document.getElementById('btnMaxAllArtifacts15');"],
  ["btnMaxAllWikiItems", "const btnMaxItems = document.getElementById('btnMaxAllWikiItems');"],
  ["btnMaxAllWikiEventsCurrencies", "const btnMaxEv = document.getElementById('btnMaxAllWikiEventsCurrencies');"],
  ["btnResetWikiItemsStarter", "const btnResetItems = document.getElementById('btnResetWikiItemsStarter');"],
  ["btnModalMaxUpgradeGear", "document.getElementById('btnModalMaxUpgradeGear')?.addEventListener('click', () => {"],
  ["btn max hero star", "containerEl.querySelectorAll('.btn-max-hero-star').forEach(btn => {"],
];
for (const [label, anchor] of INLINE) {
  const i = src.indexOf(anchor);
  check(`${label} co guard`, i > 0 && src.slice(i, i + 500).includes("if (!devCheatsEnabled()) { blockedCheatNotice(); return; }"));
}

// ---------------------------------------------------------------- 5. Không còn đường vòng
console.log("\n=== 5. KHONG CON DUONG VONG ===");
// Không được có lời gọi trực tiếp applyMaxAllSystems ngoài 2 chỗ đã biết
const maxAllCalls = [...src.matchAll(/applyMaxAllSystems\(/g)].length;
check("applyMaxAllSystems chi goi o dinh nghia + migration + handler da chan",
  maxAllCalls <= 4, "gap " + maxAllCalls);
// Handler gắn sự kiện vẫn tồn tại nhưng phải gọi hàm đã có guard
check("btnMaxAllSystems van goi handleMaxAllClick (da guard)", src.includes("getElementById('btnMaxAllSystems')?.addEventListener('click', handleMaxAllClick)"));
check("btnWorkshopMaxAll van goi handleMaxAllClick (da guard)", src.includes("getElementById('btnWorkshopMaxAll')?.addEventListener('click', handleMaxAllClick)"));
check("btnMaxRunSkills van goi grantAllRogueSkillsInRun (da guard)", src.includes("getElementById('btnMaxRunSkills')?.addEventListener('click', grantAllRogueSkillsInRun)"));

// ---------------------------------------------------------------- 6. API
console.log("\n=== 6. API KIEM THU ===");
check("export devCheatsEnabled", src.includes("devCheatsEnabled,"));
check("export applyDevCheatVisibility", src.includes("applyDevCheatVisibility"));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
