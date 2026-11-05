// Khoá lại Sổ Tay Quái Vật (bestiary): dữ liệu, ghi nhận, UI, persist.
//
// Chạy: node tests/bestiary.test.mjs
import fs from "node:fs";
import { sanitizeSave } from "../lib/saveSchema.js";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../lib/saveSchema.js", import.meta.url), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ============================================================ 1. Dữ liệu
console.log("\n=== 1. DU LIEU BESTIARY ===");
const bStart = html.indexOf("const BESTIARY = [");
const bEnd = html.indexOf("\n      ];", bStart) + 8;
const bBlock = html.slice(bStart, bEnd);
const entries = (bBlock.match(/id: '(slime|goblin|skeleton_mage|plant_turret|bat|golem|queen|demon_king)'/g) || []).length;
check("co 8 loai quai/trum", entries === 8, String(entries));
for (const id of ["slime", "goblin", "skeleton_mage", "plant_turret", "bat", "golem", "queen", "demon_king"]) {
  check(`co loai '${id}'`, bBlock.includes(`id: '${id}'`));
}
for (const field of ["name", "icon", "tier", "color", "lore", "behavior", "threat"]) {
  const n = (bBlock.match(new RegExp(field + ":", "g")) || []).length;
  check(`moi loai co '${field}' (${n}/8)`, n === 8, `${n}/8`);
}
check("co loai TRÙM", bBlock.includes("TRÙM'") || bBlock.includes("TRÙM CUỐI"));
check("co indexed lookup", /const BESTIARY_BY_ID = Object\.fromEntries/.test(html));

// ============================================================ 2. Ghi nhận
console.log("\n=== 2. GHI NHAN KHI HA GUC ===");
check("co ham recordBestiaryKill", /function recordBestiaryKill\(type, isBoss\)/.test(html));
check("tang 'seen'", /rec\.seen = \(rec\.seen \|\| 0\) \+ 1/.test(html));
check("tang 'killed'", /rec\.killed = \(rec\.killed \|\| 0\) \+ 1/.test(html));
check("ghi firstAt lan dau", /if \(!rec\.firstAt\) rec\.firstAt = Date\.now\(\)/.test(html));
check("onEnemyKilled goi recordBestiaryKill",
  /function onEnemyKilled\(e\)[\s\S]{0,300}?recordBestiaryKill\(e\.type/.test(html));
check("co ham getBestiaryRecord", /function getBestiaryRecord\(type\)/.test(html));
check("co ham getBestiaryDiscoveredCount", /function getBestiaryDiscoveredCount\(\)/.test(html));

// ============================================================ 3. State + persist
console.log("\n=== 3. STATE & PERSIST ===");
check("SaveState co 'bestiary: {}'", /bestiary: \{\},/.test(html));
check("SaveState.save() ghi bestiary", /bestiary: this\.bestiary,/.test(html));
check("normalizeStateArrays bao dam bestiary la object", /ensureObj\('bestiary', \{\}\)/.test(html));
check("server schema validate bestiary", /const bestiary = \{\};/.test(schema));
check("server gioi han 64 loai", /BESTIARY_MAX_TYPES = 64/.test(schema));
check("server giu bestiaryCollapsed", /typeof raw\.bestiaryCollapsed === "boolean"/.test(schema));
check("server tra bestiary trong data", /^\s+bestiary,$/m.test(schema));

// Chạy thật sanitizeSave
const ok = sanitizeSave({
  bestiary: { goblin: { seen: 3, killed: 3, firstAt: 111 }, slime: { seen: 1, killed: 1, firstAt: 5 } },
  bestiaryCollapsed: true,
});
check("sanitizeSave giu nguyen du lieu hop le",
  ok.ok && ok.data.bestiary.goblin.killed === 3 && ok.data.bestiary.slime.seen === 1);
check("sanitizeSave giu bestiaryCollapsed", ok.data.bestiaryCollapsed === true);
const junk = sanitizeSave({ bestiary: { bad: "notobj", ok: { killed: "abc", seen: -5 } } });
check("sanitizeSave loai ban ghi khong phai object", !junk.data.bestiary.bad);
check("sanitizeSave clamp so am/khong phai so", junk.data.bestiary.ok.killed === 0 && junk.data.bestiary.ok.seen === 0);
check("sanitizeSave chiu duoc bestiary khong ton tai", sanitizeSave({}).data.bestiary !== undefined);

// ============================================================ 4. UI
console.log("\n=== 4. UI ===");
check("co bestiaryPanel trong DOM", html.includes('id="bestiaryPanel"'));
check("co ham renderBestiaryUI", /function renderBestiaryUI\(\)/.test(html));
check("renderLobbyUI goi renderBestiaryUI", /safeRender\('bestiary', \(\) => renderBestiaryUI\(\)\)/.test(html));
check("hien '??? ' khi chua kham pha", html.includes("???") && /bs-unknown/.test(html));
check("co lop bs-unknown", /\.bs-card\.bs-unknown/.test(html));
check("hien so lan ha guc", /bs-count/.test(html));
check("hien do nguy hiem", /bs-threat/.test(html));
check("hien mo ta (lore)", /bs-lore/.test(html));
check("hien chieu thuc", /bs-behavior/.test(html));
check("co the loai trum (vien do)", /\.bs-card\.bs-boss/.test(html));
check("co thanh tien trinh kham pha", /bs-progress-fill/.test(html));
check("co nut Thu/Mo", /btnToggleBestiary/.test(html));
check("thu/mo luu vao state", /SaveState\.bestiaryCollapsed = !collapsed/.test(html));

// ============================================================ 5. Không bịa dữ liệu
console.log("\n=== 5. KHONG BIA DU LIEU ===");
check("con chua ha guc KHONG hien ten that",
  /const known = rec && rec\.killed > 0/.test(html));
check("chi hien ten khi known", /if \(!known\)[\s\S]{0,400}?bs-unknown/.test(html));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
