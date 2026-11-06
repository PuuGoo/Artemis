#!/usr/bin/env node
// ==================== SINH DỮ LIỆU TĨNH CHO UNITY ====================
// Chạy CHÍNH script game trong oracle headless rồi xuất ra JSON cho
// unity-client. Đây là cách duy nhất giữ 250+ mục (hero, gear, rune, artifact,
// skill, talent, quái) khớp với bản web mà không chép tay.
//
// Chạy: node tools/unity-parity/extract-data.mjs
// Ra:   unity-client/Assets/Artemis/Resources/ArtemisData/*.json
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadOracle } from "./oracle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(ROOT, "unity-client", "Assets", "Artemis", "Resources", "ArtemisData");

fs.mkdirSync(OUT, { recursive: true });

const { api, window, sandbox } = loadOracle();

/**
 * Bóc bảng dữ liệu khai báo bằng `const X = [...]` trong script (không export).
 * Được đánh giá TRONG sandbox của oracle để các tham chiếu như
 * makeWikiHeroPortraitURI() phân giải được.
 */
function readConstArray(name) {
  const html = fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8");
  const marker = "const " + name;
  const i = html.indexOf(marker);
  if (i < 0) throw new Error("Không thấy " + name);
  const eq = html.indexOf("[", i);
  let depth = 0, end = -1, inStr = null;
  for (let k = eq; k < html.length; k++) {
    const c = html[k];
    if (inStr) {
      if (c === "\\") { k++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") { inStr = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { end = k; break; } }
  }
  if (end < 0) throw new Error("Không tìm thấy cuối mảng " + name);
  return evalInSandbox("(" + html.slice(eq, end + 1) + ")");
}

function evalInSandbox(expr) {
  // Một số bảng dữ liệu gọi helper chỉ tồn tại trong closure của IIFE
  // (makeWikiHeroPortraitURI). Ở scope global ta cấp stub trả null — chính
  // xác những field đó (avatar SVG, backstory) bị loại bỏ khi xuất JSON.
  if (typeof sandbox.makeWikiHeroPortraitURI !== "function") {
    sandbox.makeWikiHeroPortraitURI = () => null;
  }
  return new vm.Script(expr, { filename: "extract:" + expr.slice(0, 40) }).runInContext(sandbox);
}

function writeJson(file, data) {
  const p = path.join(OUT, file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
  const size = fs.statSync(p).size;
  console.log("  " + file.padEnd(34) + (Array.isArray(data) ? data.length + " mục" : Object.keys(data).length + " khoá").padStart(10) + "  " + (size / 1024).toFixed(1) + " KB");
  return p;
}

/** Cắt field trình bày (SVG, lore, màu) khỏi hero — Unity lấy visual từ asset riêng. */
function slimHero(h) {
  return {
    id: h.id,
    name: h.name,
    rarity: h.rarity,
    title: h.title,
    skillName: h.skillName,
    role: h.role,
    bonusAtk: h.bonusAtk,
    bonusHp: h.bonusHp,
    globalAllBonus: h.globalAllBonus || null,
    // Star list được giữ vì nó là NGUỒN của milestone text + resonance unlock.
    wikiStarList: (h.wikiStarList || []).map((s) => ({ star: s.star, text: s.text })),
  };
}

console.log("Sinh dữ liệu Unity từ public/index.html …\n");

writeJson("chapters.json", readConstArray("CHAPTERS").map((c) => ({
  id: c.id,
  name: c.name,
  modeLabel: c.modeLabel,
  desc: c.desc,
  rooms: c.rooms,
  enemyScale: c.enemyScale,
  difficulty: c.difficulty,
  difficultyLabel: c.difficultyLabel,
  themeName: c.themeName,
  bossIcon: c.bossIcon,
  bossName: c.bossName,
  bossType: c.bossType || null,
  unlock: c.unlock || null,
  mapAsset: c.mapAsset,
  mapRegion: c.mapRegion,
  mapTagline: c.mapTagline,
  accent: c.accent,
  accent2: c.accent2,
  floorColor1: c.floorColor1,
  floorColor2: c.floorColor2,
  wallColor: c.wallColor,
})));

writeJson("gameModes.json", api.GAME_MODES.map((m) => ({
  id: m.id, name: m.name, icon: m.icon, color: m.color, desc: m.desc, rules: m.rules,
  hasChapters: !!m.hasChapters, endless: !!m.endless, bossOnly: !!m.bossOnly,
  practice: !!m.practice, maxRooms: m.maxRooms ?? null,
})));

writeJson("heroes.json", readConstArray("HEROES").map(slimHero));
writeJson("weapons.json", readConstArray("WEAPONS"));
writeJson("pets.json", readConstArray("PETS"));
writeJson("talents.json", readConstArray("TALENT_CARDS_DATA"));

// Kỹ năng: MỘT mảng ROGUE_SKILLS 72 mục, mỗi mục có `rarity` riêng.
writeJson("skills.json", readConstArray("ROGUE_SKILLS"));

writeJson("gearQualities.json", api.GEAR_QUALITIES);
writeJson("gearTemplates.json", api.GEAR_TEMPLATES);
writeJson("gearSlots.json", api.GEAR_SLOTS_META);
writeJson("fusionRecipes.json", api.FUSION_RECIPES);
writeJson("gems.json", readConstObject("GEM_META"));

function readConstObject(name) {
  const html = fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8");
  const i = html.indexOf("const " + name);
  if (i < 0) throw new Error("Không thấy " + name);
  const eq = html.indexOf("{", i);
  let depth = 0, end = -1, inStr = null;
  for (let k = eq; k < html.length; k++) {
    const c = html[k];
    if (inStr) {
      if (c === "\\") { k++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") { inStr = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = k; break; } }
  }
  if (end < 0) throw new Error("Không tìm thấy cuối object " + name);
  // eslint-disable-next-line no-new-func
  return Function("return (" + html.slice(eq, end + 1) + ");")();
}

writeJson("runes.json", readConstArray("RUNES"));
writeJson("runeBaseStats.json", readConstObject("RUNE_BASE_STATS_BY_TYPE"));
writeJson("gearSets.json", readConstObject("GEAR_SET_META"));
writeJson("heroSkins.json", readConstObject("HERO_SKINS"));
writeJson("affixPool.json", readConstObject("AFFIX_POOL"));
writeJson("artifacts.json", readConstArray("ARTIFACTS"));
writeJson("artifactSets.json", readConstArray("ARTIFACT_SETS_DATA"));
writeJson("bestiary.json", api.BESTIARY);
writeJson("starMilestones.json", api.HERO_STAR_MILESTONES);
writeJson("season.json", {
  careers: api.SEASON_CAREERS,
  bosses: api.SEASON_BOSSES,
  shop: api.SEASON_SHOP,
});
writeJson("garden.json", {
  seeds: api.GARDEN_SEEDS,
  produce: api.GARDEN_PRODUCE,
  shop: api.GARDEN_SHOP,
});
writeJson("plinko.json", { rows: api.PLINKO_ROWS, mults: api.PLINKO_MULTS });
writeJson("guild.json", { ranks: api.GUILD_RANKS, maxMembers: api.GUILD_MAX_MEMBERS });
writeJson("beginnerJourney.json", api.BEGINNER_STEPS);
writeJson("achievements.json", api.ACHIEVEMENTS);

console.log("\nXong. Thư mục: " + path.relative(ROOT, OUT));
