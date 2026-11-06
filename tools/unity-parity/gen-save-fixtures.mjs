#!/usr/bin/env node
// ==================== FIXTURE SAVE ROUND-TRIP ====================
// Sinh các bộ save ĐẠI DIỆN (tài khoản mới, tài khoản tiến xa, save cũ thiếu
// field, save có field lạ) rồi chạy qua CHÍNH sanitizeSave() của server để biết
// hình dạng dữ liệu thật mà Unity phải đọc/ghi lại không mất mát.
//
// Chạy: node tools/unity-parity/gen-save-fixtures.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeSave, BEGINNER_STEP_IDS } from "../../lib/saveSchema.js";
import { loadOracle } from "./oracle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "fixtures", "save-cases.json");

const { api } = loadOracle();
const S = api.SaveState;

function snapshot() {
  const out = {};
  for (const k of Object.keys(S)) {
    if (typeof S[k] === "function") continue;
    out[k] = JSON.parse(JSON.stringify(S[k] ?? null));
  }
  return out;
}

function reset() {
  for (const k of Object.keys(S)) {
    if (typeof S[k] !== "function") delete S[k];
  }
  S.gold = 0; S.gems = 0; S.stamina = 0; S.gearLevel = 1;
  S.selectedHeroId = "alex"; S.selectedWeaponId = "bow"; S.selectedPetId = "spirit_sword";
  S.selectedChapterIdx = 0;
  S.heroStars = {}; S.heroShards = {}; S.artifactStars = {}; S.talents = {};
  S.runes = {}; S.heroSelectedSkins = {}; S.unlockedSkins = {};
  S.equippedGear = {}; S.gearBag = []; S.bestRooms = {}; S.winsByChapter = {};
  S.lifetimeStats = {}; S.bestiary = {}; S.achievementsUnlocked = {}; S.achievementsClaimed = {};
  S.acquiredSkills = {}; S.starterSkillIds = []; S.presets = {}; S.gearLoadouts = {};
  S.gearScrolls = { weapon: 0, armor: 0, helmet: 0, ring: 0, necklace: 0, boots: 0 };
  S.chestKeys = {}; S.wikiOtherItems = {}; S.wishTokens = 0; S.chestGachaState = {};
  S.runeRuinsState = {}; S.wikiEventsState = {}; S.gemInventory = {}; S.salvageMaterials = 0;
  S.maxedAllVersion = 1; S.artemisHeroVersion = 1; S.wikiCharactersVersion = 2;
  S.beginnerJourney = { version: 1, startedAt: 0, completedAt: 0, skipped: false, currentStep: "N01", completedSteps: [], claimedRewards: [], isCompleted: false };
  S.season = { season: 1, career: null, tokens: 0, boss: null, bossHp: 0, bossMaxHp: 0, bossDefeated: false, powerSacrificed: 0, log: [] };
  S.dungeonCheckpoint = null;
  S.equippedRuneSlots = { etched: [], blessing: [], enhancement: [], ability: [] };
  S.resonanceSlots = { slot1: null, slot2: null };
}

const cases = [];

function addCase(name, build, note) {
  reset();
  build(S);
  const raw = snapshot();
  const check = sanitizeSave(raw);
  cases.push({
    name,
    note,
    // Input thô (cái client gửi lên) và output đã qua server.
    input: raw,
    sanitizedOk: check.ok,
    sanitized: check.ok ? check.data : null,
    bytes: check.ok ? check.bytes : null,
    // Bản mà mạng trả về khi GET: chính là `sanitized`.
  });
  console.log("  " + name.padEnd(34) + (check.ok ? check.bytes + " B" : "BỊ TỪ CHỐI: " + check.reason));
}

console.log("Sinh fixture save …\n");

addCase("new-account", () => {}, "tài khoản trắng, mọi field rỗng");

addCase("new-account-with-progress", (s) => {
  s.gold = 1450; s.gems = 70; s.gearLevel = 4;
  s.bestRooms = { 1: 7 };
  s.lifetimeStats = { runs: 3, wins: 0, kills: 41, goldEarned: 1450, deepestRoom: 7, roomsCleared: 9 };
  s.beginnerJourney = {
    version: 1, startedAt: 1762300000000, completedAt: 0, skipped: false,
    currentStep: "N04", completedSteps: ["N01", "N02", "N03"], claimedRewards: ["N01", "N02"], isCompleted: false,
  };
}, "tài khoản mới chơi được vài phòng, có Hành Trình Tân Thủ");

addCase("mid-game-gear", (s) => {
  s.gold = 250000; s.gems = 1200; s.gearLevel = 30;
  s.selectedHeroId = "artemis"; s.selectedWeaponId = "staff";
  s.heroStars = { alex: 3, artemis: 4 };
  s.heroSelectedSkins = { artemis: 1 };
  s.unlockedSkins = { artemis_celestial: true, alex_default: true };
  s.talents = { refinement: 3, glory: 1, dexterity: 4 };
  s.equippedGear = {
    weapon: { uid: "w1", templateId: "crimson_bow", quality: "epic", level: 25, awakening: 2, locked: false, favorite: true, sockets: ["ruby", "amethyst"], affixes: [{ type: "atk_pct", val: 6 }, { type: "crit_pct", val: 3 }] },
    necklace: { uid: "n1", templateId: "sapphire_pendant", quality: "rare", level: 20, awakening: 0, sockets: ["sapphire"], affixes: [] },
    ring: { uid: "r1", templateId: "sun_gold_ring", quality: "rare", level: 20, awakening: 0, sockets: [], affixes: [{ type: "hp_pct", val: 8 }] },
    armor: { uid: "a1", templateId: "golden_plate", quality: "epic", level: 22, awakening: 1, sockets: [], affixes: [] },
    helmet: { uid: "h1", templateId: "golden_helm", quality: "legendary", level: 28, awakening: 3, sockets: [], affixes: [] },
    boots: { uid: "b1", templateId: "titan_boots", quality: "uncommon", level: 15, awakening: 0, sockets: [], affixes: [] },
  };
  s.gearBag = [
    { uid: "b1", templateId: "rusty_bow", quality: "common", level: 1, awakening: 0 },
    { uid: "b2", templateId: "oracle_staff", quality: "legendary", level: 30, awakening: 2, sockets: ["topaz"] },
  ];
  s.bestRooms = { 1: 15, 2: 8 };
  s.winsByChapter = { 1: 2 };
  s.season = { season: 1, career: "blade", tokens: 180, boss: "ironhide", bossHp: 4000, bossMaxHp: 12000, bossDefeated: false, powerSacrificed: 0.06, log: [{ t: 1762300000000, text: "Chọn nghề Kiếm Sĩ" }] };
}, "giữa game: trang bị epic/legendary, season đang chạy, có boss mùa");

addCase("late-game-full", (s) => {
  s.gold = 9e9; s.gems = 4e5; s.gearLevel = 100;
  const all = ["thor", "wukong", "cleo", "atreus", "rolla", "nezha", "otta", "hou_yi", "phynx", "loki", "dracoola", "seraph", "mymu", "hela", "helix", "nyanja", "alex", "artemis"];
  s.heroStars = Object.fromEntries(all.map((id) => [id, 8]));
  s.heroShards = Object.fromEntries(all.map((id) => [id, 5000]));
  s.artifactStars = { golden_fleece: 15, golden_mask: 15, goldfinger: 15 };
  s.talents = { refinement: 5, glory: 1, healer: 5, dexterity: 5, might: 5, vitality: 5 };
  s.runes = { arrow_of_echoes: 3, sharp_arrow: 5, guardian: 2, arrow_rain: 4, lucky_shadow: 2, ability_circle: 3 };
  s.equippedRuneSlots = {
    etched: ["arrow_of_echoes", "sharp_arrow"], blessing: ["guardian"],
    enhancement: ["arrow_rain", "lucky_shadow"], ability: ["ability_circle", "ability_circle"],
  };
  s.bestRooms = { 1: 15, 2: 12, 3: 10, 4: 15, 5: 15 };
  s.winsByChapter = { 1: 9, 2: 5, 3: 3, 4: 1, 5: 1 };
  s.lifetimeStats = { runs: 300, wins: 19, kills: 25000, goldEarned: 9e9, deepestRoom: 15, roomsCleared: 900, chaptersCleared: 5 };
  s.achievementsUnlocked = { a1: 1762300000000, a2: 1762300000000 };
  s.achievementsClaimed = { a1: 1762300000000 };
  s.beginnerJourney = { version: 1, startedAt: 1762000000000, completedAt: 1762300000000, skipped: false, currentStep: "N08", completedSteps: BEGINNER_STEP_IDS.slice(), claimedRewards: BEGINNER_STEP_IDS.slice(), isCompleted: true };
  s.dungeonCheckpoint = {
    v: 1, chapterIdx: 4, chapterId: 5, room: 11, maxRooms: 15, kills: 63, runGold: 900, savedAt: 1762400000000,
    player: { hp: 900000, maxHp: 1000000, atk: 40000, aspd: 3.1, critRate: 0.7, critDmgMult: 2.4, defFlat: 300, dmgReduction: 0.12, level: 14, xp: 40, xpNext: 400, skills: { wounded_warrior: 2, charged_arrow: 1, pierce: 1 } },
  };
}, "cuối game: mọi hero 8★, checkpoint phòng 11 chương 5");

addCase("legacy-missing-version-fields", (s) => {
  // Save từ bản rất cũ: thiếu 3 field version + nhiều field mới.
  delete s.maxedAllVersion;
  delete s.artemisHeroVersion;
  delete s.wikiCharactersVersion;
  s.gold = 500;
  delete s.beginnerJourney;
  delete s.season;
  delete s.bestiary;
  delete s.achievementsUnlocked;
}, "save cũ thiếu field version — server phải tự điền, không được coi là save hỏng");

addCase("legacy-partial-gear", (s) => {
  // Trang bị từ bản cũ: thiếu level/awakening/locked/favorite/sockets.
  s.equippedGear = {
    weapon: { uid: "old1", templateId: "rusty_bow", quality: "common" },
    armor: { uid: "old2", templateId: "cloth_vest", quality: "uncommon" },
  };
  s.gearBag = [{ uid: "old3", templateId: "wooden_charm", quality: "rare" }];
}, "trang bị cũ thiếu nhiều field optional");

addCase("unknown-fields", (s) => {
  s.gold = 100;
  s.somethingFromTheFuture = { a: 1, b: [1, 2, 3] };
  s.anotherUnknown = "keep-me";
}, "save có field lạ — server LỌC BỎ; Unity cũng không được giả định chúng tồn tại");

addCase("garden-and-plinko", (s) => {
  s.gold = 5000;
  s.garden = { plots: [{ seed: "carrot", readyAt: 1762400000000 }], harvested: 12 };
  s.plinko = { plays: 7, won: 900 };
  s.modeBest = { endless: 23, tower: 4 };
  s.gameMode = "endless";
}, "garden/plinko/modeBest/gameMode KHÔNG nằm trong whitelist server — kiểm chứng chúng bị lọc");

const rejected = cases.filter((c) => !c.sanitizedOk).map((c) => c.name);
if (rejected.length) {
  console.error("\nCẢNH BÁO: các ca sau bị server từ chối:", rejected.join(", "));
}

fs.writeFileSync(OUT, JSON.stringify(cases, null, 1) + "\n", "utf8");
console.log("\nĐã ghi " + path.relative(process.cwd(), OUT) + " (" + cases.length + " ca)");

// In ra những field bị server lọc, để tài liệu khỏi phải suy đoán.
console.log("\nField bị server lọc khỏi save:");
for (const c of cases) {
  if (!c.sanitizedOk) continue;
  const inKeys = new Set(Object.keys(c.input));
  const outKeys = new Set(Object.keys(c.sanitized));
  const dropped = [...inKeys].filter((k) => !outKeys.has(k));
  const added = [...outKeys].filter((k) => !inKeys.has(k));
  if (dropped.length) console.log("  " + c.name + " — bỏ: " + dropped.join(", "));
  if (added.length) console.log("  " + c.name + " — thêm: " + added.join(", "));
}
