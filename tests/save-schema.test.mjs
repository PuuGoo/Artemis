// Test chong mat du lieu: moi field SaveState.save() ghi ra PHAI duoc schema giu lai.
// Lop loi nay tung lam mat gearScrolls/chestKeys/wishTokens va max toan bo tai nguyen.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeSave } from "../lib/saveSchema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ---- 1. Trich danh sach field tu payload cua SaveState.save() ----
// Kien truc moi: save() tao bien `payload = JSON.stringify({...})` roi dat vao
// window.__ARTEMIS_SAVE_BUFFER. KHONG con localStorage.setItem de trich.
const m = html.match(/const payload = JSON\.stringify\(\{([\s\S]*?)\n            \}\);/);
check("tim thay SaveState.save() tao payload trong index.html", !!m);

const body = m ? m[1] : "";
const gameFields = new Set();
// Chi lay key o CAP NGOAI CUNG cua object save (bo qua key long trong
// resonanceSlots/resonanceSlots.slot1... va cac object con khac).
(function extractTopLevelKeys(src) {
  let depth = 0;
  let inStr = null;
  let buf = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "{" || ch === "[" || ch === "(") { depth++; continue; }
    if (ch === "}" || ch === "]" || ch === ")") { depth--; continue; }
    if (depth === 0) {
      if (/[A-Za-z0-9_$]/.test(ch)) { buf += ch; continue; }
    }
    if (depth === 0 && buf) {
      // Sau ten key phai la ':' (key: value) hoac ',' / newline (shorthand)
      const rest = src.slice(i).replace(/^\s+/, "");
      if (rest.startsWith(":") || rest.startsWith(",") || rest.startsWith("}")) {
        // Key hop le phai bat dau bang chu cai/gach duoi (bo qua gia tri so nhu "1,")
        if (/^[A-Za-z_$]/.test(buf)) gameFields.add(buf);
      }
      buf = "";
    } else if (buf && depth !== 0) {
      buf = "";
    }
  }
  if (buf) gameFields.add(buf);
})(body);

console.log("\n  Field game ghi ra: " + gameFields.size + " -> " + [...gameFields].join(", "));

// ---- 2. Dung mau du lieu co DU moi field, kiem tra schema giu lai ----
const sample = {};
for (const f of gameFields) sample[f] = 1;
sample.playerName = "x";
sample.selectedHeroId = "artemis";
sample.selectedWeaponId = "bow";
sample.selectedPetId = "spirit_sword";
sample.sortMode = "quality";
sample.achievementFilter = "all";
for (const f of ["resonanceSlots", "heroStars", "heroShards", "heroSelectedSkins", "unlockedSkins",
  "equippedGear", "presets", "gearLoadouts", "gearScrolls", "wikiOtherItems",
  "chestGachaState", "runeRuinsState", "wikiEventsState", "runes", "talents",
  "bestRooms", "lifetimeStats", "winsByChapter", "achievementsUnlocked",
  "achievementsClaimed", "gemInventory"]) {
  if (f in sample) sample[f] = {};
}
sample.gearBag = [];
// dungeonCheckpoint: null la gia tri HOP LE (chua co checkpoint). Test phai
// dung mau that su co the khoi phuc duoc, neu khong sanitizer tra null dung
// va bi bao nham la "field bi roi".
sample.dungeonCheckpoint = {
  v: 1, chapterIdx: 0, chapterId: 1, room: 5, maxRooms: 15,
  kills: 10, runGold: 100, savedAt: Date.now(),
  player: { hp: 500, maxHp: 1000, atk: 100, aspd: 1, critRate: 0.1,
            critDmgMult: 1.85, defFlat: 0, dmgReduction: 0, level: 2,
            xp: 0, xpNext: 100, skills: {} },
};

const result = sanitizeSave(sample);
check("sanitizeSave chap nhan mau", result.ok === true, result.reason);

const saved = new Set(Object.keys(result.data || {}));
const missing = [...gameFields].filter((f) => !saved.has(f));

console.log("");
check("KHONG field nao cua game bi roi", missing.length === 0, "roi: " + missing.join(", "));

// ---- 3. Gia tri that su duoc giu (khong chi key rong) ----
console.log("\n  Kiem tra gia tri cu the:");
const values = {
  // chestKeys la object trong game -> kiem tra rieng o phan KIEU ben duoi.
  wishTokens: 13, salvageMaterials: 4200,
  maxedAllVersion: 1, artemisHeroVersion: 1, wikiCharactersVersion: 2,
};
const withValues = Object.assign({}, sample, values);
const r2 = sanitizeSave(withValues);
for (const [k, v] of Object.entries(values)) {
  check(`  ${k} = ${v} duoc giu`, r2.data?.[k] === v, "got " + r2.data?.[k]);
}
check("gearScrolls giu object", typeof r2.data?.gearScrolls === "object" && r2.data.gearScrolls !== null);
check("chestGachaState giu object", typeof r2.data?.chestGachaState === "object");
check("runeRuinsState giu object", typeof r2.data?.runeRuinsState === "object");
check("wikiEventsState giu object", typeof r2.data?.wikiEventsState === "object");
check("wikiOtherItems giu object", typeof r2.data?.wikiOtherItems === "object");

// ---- 4. Khong co maxedAllVersion -> mac dinh phai la 1 (tranh applyMaxAllSystems) ----
const noVersion = sanitizeSave({ gold: 100 });
check("thieu maxedAllVersion -> mac dinh 1", noVersion.data?.maxedAllVersion === 1, "got " + noVersion.data?.maxedAllVersion);
check("thieu wikiCharactersVersion -> mac dinh 2", noVersion.data?.wikiCharactersVersion === 2);
check("thieu artemisHeroVersion -> mac dinh 1", noVersion.data?.artemisHeroVersion === 1);

// ---- 5. KIEM TRA KIEU: dung kieu that cua tung field trong game ----
// Lop loi tung lam mat chestKeys (object bi doi thanh 0) va unlockedSkins (boolean -> 1).
console.log("\n  Kiem tra KIEU du lieu that:");
const typed = sanitizeSave({
  chestKeys: { silver_chest_key: 150, obsidian_chest_key: 120, chromatic_chest_key: 99 },
  wishTokens: 9,
  gearScrolls: { weapon: 5, armor: 3 },
  wikiOtherItems: { shovel: 120, gold_cave_ticket: 30 },
  chestGachaState: { epicPity: 0, sTierPity: 2 },
  runeRuinsState: { foundSturdyIcons: 4 },
  wikiEventsState: { skyTowerFloor: 125, arenaRankPts: 2450 },
  unlockedSkins: { artemis_default: true, artemis_celestial: true },
  salvageMaterials: 5000,
  gemInventory: { ruby: 2, sapphire: 3 },
});

check("chestKeys giu object (khong thanh 0)",
  typeof typed.data?.chestKeys === "object" && typed.data.chestKeys?.silver_chest_key === 150,
  JSON.stringify(typed.data?.chestKeys));
check("chestKeys giu du 3 loai",
  Object.keys(typed.data?.chestKeys || {}).length === 3,
  JSON.stringify(typed.data?.chestKeys));
check("wishTokens giu number = 9", typed.data?.wishTokens === 9, "got " + typed.data?.wishTokens);
check("gearScrolls giu gia tri weapon:5", typed.data?.gearScrolls?.weapon === 5);
check("gearScrolls giu gia tri armor:3", typed.data?.gearScrolls?.armor === 3);
check("wikiOtherItems giu shovel:120", typed.data?.wikiOtherItems?.shovel === 120);
check("chestGachaState giu sTierPity:2", typed.data?.chestGachaState?.sTierPity === 2);
check("runeRuinsState giu foundSturdyIcons:4", typed.data?.runeRuinsState?.foundSturdyIcons === 4);
check("wikiEventsState giu skyTowerFloor:125", typed.data?.wikiEventsState?.skyTowerFloor === 125);
check("wikiEventsState giu arenaRankPts:2450", typed.data?.wikiEventsState?.arenaRankPts === 2450);
check("unlockedSkins giu BOOLEAN true (khong phai 1)",
  typed.data?.unlockedSkins?.artemis_default === true,
  "got " + JSON.stringify(typed.data?.unlockedSkins));
check("salvageMaterials giu number", typed.data?.salvageMaterials === 5000);
check("gemInventory giu number", typed.data?.gemInventory?.ruby === 2);

// Gia tri rac phai bi loai (khong lam hong save)
const dirty = sanitizeSave({
  chestKeys: { silver_chest_key: "abc", obsidian_chest_key: 50 },
  unlockedSkins: { a: "yes", b: false, c: true },
  __proto__: { hacked: true },
});
// sanitizeMixedRecord giu nguyen kieu goc (string duoc phep) de khong lam mat
// du lieu long nhau nhu lastPullResults / gridRevealed. So van duoc giu dung.
check("chestKeys giu gia tri so hop le", dirty.data?.chestKeys?.obsidian_chest_key === 50,
  JSON.stringify(dirty.data?.chestKeys));
check("chestKeys khong lam mat key", dirty.data?.chestKeys && "silver_chest_key" in dirty.data.chestKeys);
check("unlockedSkins chi giu true", Object.keys(dirty.data?.unlockedSkins || {}).length === 1);
check("khong bi prototype pollution", !({}).hacked);

// Kiem tra long nhau: array phai duoc giu nguyen (loi lam shop/event trang)
const nested = sanitizeSave({
  chestGachaState: { epicPity: 3, sTierPity: 1, lastPullResults: [{ id: "a" }, { id: "b" }] },
  runeRuinsState: { foundSturdyIcons: 2, gridRewards: 5, gridRevealed: [1, 0, 1, 1] },
});
check("lastPullResults giu ARRAY (khong thanh 0)",
  Array.isArray(nested.data?.chestGachaState?.lastPullResults),
  typeof nested.data?.chestGachaState?.lastPullResults);
check("lastPullResults giu du 2 phan tu",
  nested.data?.chestGachaState?.lastPullResults?.length === 2);
check("gridRevealed giu ARRAY (khong undefined)",
  Array.isArray(nested.data?.runeRuinsState?.gridRevealed),
  typeof nested.data?.runeRuinsState?.gridRevealed);
check("gridRevealed giu du 4 phan tu",
  nested.data?.runeRuinsState?.gridRevealed?.length === 4);
check("epicPity van la number", nested.data?.chestGachaState?.epicPity === 3);

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
