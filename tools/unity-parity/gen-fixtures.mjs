#!/usr/bin/env node
// ==================== SINH FIXTURE PARITY TỪ GAME THẬT ====================
// Sinh các bộ save tổng hợp + kết quả getComputedStats()/damage/boss/quái do
// CHÍNH code production tính, rồi ghi ra JSON để test C# đối chiếu.
//
// Chạy: node tools/unity-parity/gen-fixtures.mjs
// Ra:   tools/unity-parity/fixtures/*.json
//
// Nguyên tắc: fixture KHÔNG được viết tay. Nếu viết tay thì test chỉ chứng minh
// C# khớp với niềm tin của người viết, không khớp với production.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadOracle } from "./oracle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "fixtures");
fs.mkdirSync(OUT, { recursive: true });

const { api, window, sandbox } = loadOracle();
const S = api.SaveState;

function write(name, data) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + "\n", "utf8");
  const n = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log("  " + name.padEnd(30) + String(n).padStart(5) + " mục");
}

/** Đặt SaveState về trạng thái trắng như tài khoản mới. */
function resetSave() {
  for (const k of Object.keys(S)) {
    if (typeof S[k] === "function") continue;
    delete S[k];
  }
  S.gold = 0;
  S.gems = 0;
  S.stamina = 0;
  S.playerLevel = 1;
  S.gearLevel = 1;
  S.selectedHeroId = "alex";
  S.selectedWeaponId = "bow";
  S.selectedPetId = "spirit_sword";
  S.selectedChapterIdx = 0;
  S.heroStars = {};
  S.heroShards = {};
  S.artifactStars = {};
  S.talents = {};
  S.talents_autoInit = false;
  S.runes = {};
  S.heroSelectedSkins = {};
  S.unlockedSkins = {};
  S.equippedGear = {};
  S.gearBag = [];
  S.season = { season: 1, career: null, tokens: 0, boss: null, bossHp: 0, bossMaxHp: 0, bossDefeated: false, powerSacrificed: 0, log: [] };
  S.equippedRuneSlots = { etched: [], blessing: [], enhancement: [], ability: [] };
  S.runeQualityTier = "mythic";
  S.runeMythicEnchant = true;
  S.resonanceSlots = { slot1: null, slot2: null };
  S.bestRooms = {};
  S.winsByChapter = {};
  S.lifetimeStats = {};
  S.bestiary = {};
  S.achievementsUnlocked = {};
  S.achievementsClaimed = {};
  S.acquiredSkills = {};
  S.starterSkillIds = [];
  S.presets = {};
  S.gearLoadouts = {};
  S.gearScrolls = { weapon: 0, armor: 0, helmet: 0, ring: 0, necklace: 0, boots: 0 };
  S.chestKeys = {};
  S.wikiOtherItems = {};
  S.wishTokens = 0;
  S.chestGachaState = {};
  S.runeRuinsState = {};
  S.wikiEventsState = {};
  S.gemInventory = {};
  S.salvageMaterials = 0;
  S.stamina = 100;
  S.gameMode = "campaign";
  S.beginnerJourney = { version: 1, startedAt: 0, completedAt: 0, skipped: false, currentStep: "N01", completedSteps: [], claimedRewards: [], isCompleted: false };
  // Bật/tắt các cổng migration: chỉ số phải là của tài khoản mới, không phải
  // bản "max all" mà save cũ từng nhận.
  S.maxedAllVersion = 1;
  S.artemisHeroVersion = 1;
  S.wikiCharactersVersion = 2;
}

/** Chụp kết quả getComputedStats() — chỉ những field số mà Unity phải khớp. */
function snapStats(chapterRooms = 15) {
  if (chapterRooms !== 15) {
    // getComputedStats đọc Game.chapter.rooms cho defK.
    const prev = api.Game.chapter;
    api.Game.chapter = { ...(prev || { id: 1, rooms: 15 }), rooms: chapterRooms };
    const st = api.getComputedStats();
    api.Game.chapter = prev;
    return slim(st);
  }
  return slim(api.getComputedStats());
}

function slim(st) {
  return {
    heroId: st.hero && st.hero.id,
    heroStar: st.heroStar,
    weaponId: st.weapon && st.weapon.id,
    petId: st.pet && st.pet.id,
    baseAtk: st.baseAtk,
    baseHp: st.baseHp,
    baseAspd: st.baseAspd,
    baseCrit: st.baseCrit,
    critDmgMult: st.critDmgMult,
    critDmgBonus: st.critDmgBonus,
    defFlat: st.defFlat,
    dmgReduction: st.dmgReduction,
    gearDodge: st.gearDodge,
    goldBonus: st.goldBonus,
    powerScore: st.powerScore,
    gearAtk: st.gearAtk,
    gearHp: st.gearHp,
  };
}

/** Serialize SaveState thành ảnh chụp thuần dữ liệu (bỏ hàm). */
function saveSnapshot() {
  const out = {};
  for (const k of Object.keys(S)) {
    if (typeof S[k] === "function") continue;
    out[k] = JSON.parse(JSON.stringify(S[k] ?? null));
  }
  return out;
}

// ==================== 1. CÁC CẤU HÌNH CHỈ SỐ ====================
console.log("Sinh fixture từ public/index.html …\n");

const statCases = [];

/** Chạy một kịch bản: áp save, tính, ghi lại cả input lẫn output. */
function statCase(name, mutate, chapterRooms = 15) {
  resetSave();
  try { mutate(S); } catch (e) { console.warn("  ! " + name + ": " + e.message); }
  const input = saveSnapshot();
  const expected = snapStats(chapterRooms);
  statCases.push({ name, chapterRooms, input, expected });
}

statCase("new-account", () => {});

statCase("new-account-chapter3", () => { S.selectedChapterIdx = 2; }, 10);

statCase("hero-artemis", () => {
  S.selectedHeroId = "artemis";
  S.heroStars = { artemis: 3, alex: 1 };
});

statCase("hero-thor-8star", () => {
  S.selectedHeroId = "thor";
  S.heroStars = Object.fromEntries(["thor", "wukong", "cleo", "atreus", "rolla", "nezha", "otta", "hou_yi", "phynx", "loki", "dracoola", "seraph", "mymu", "hela", "helix", "nyanja", "alex", "artemis"].map((id) => [id, 8]));
});

statCase("weapon-staff", () => { S.selectedWeaponId = "staff"; });
statCase("weapon-claw", () => { S.selectedWeaponId = "claw"; });

// Trang bị khởi đầu đầy đủ, Lv.1
statCase("starter-gear-lv1", () => {
  S.gearLevel = 1;
  S.equippedGear = {
    weapon: { uid: "w1", templateId: "rusty_bow", quality: "common", level: 1, awakening: 0, sockets: [], affixes: [] },
    necklace: { uid: "n1", templateId: "wooden_charm", quality: "common", level: 1, awakening: 0, sockets: [], affixes: [] },
    ring: { uid: "r1", templateId: "copper_ring", quality: "common", level: 1, awakening: 0, sockets: [], affixes: [] },
    armor: { uid: "a1", templateId: "cloth_vest", quality: "common", level: 1, awakening: 0, sockets: [], affixes: [] },
    helmet: { uid: "h1", templateId: "leather_cap", quality: "common", level: 1, awakening: 0, sockets: [], affixes: [] },
    boots: { uid: "b1", templateId: "worn_boots", quality: "common", level: 1, awakening: 0, sockets: [], affixes: [] },
  };
});

// Trang bị S-Tier Dragon Knight đầy đủ, phẩm chất cao, có ngọc + phụ tố
statCase("dragonknight-epic-lv10", () => {
  S.gearLevel = 10;
  const mk = (uid, templateId, quality, level, awakening, sockets, affixes) =>
    ({ uid, templateId, quality, level, awakening, sockets, affixes });
  S.equippedGear = {
    weapon: mk("w", "crimson_bow", "epic", 10, 2, ["ruby", "ruby", "amethyst"], [{ type: "atk_pct", val: 6 }, { type: "crit_pct", val: 3 }]),
    necklace: mk("n", "sapphire_pendant", "epic", 10, 1, ["sapphire"], [{ type: "hp_pct", val: 8 }]),
    ring: mk("r", "sun_gold_ring", "epic", 10, 0, ["topaz"], [{ type: "atk_flat", val: 120 }]),
    armor: mk("a", "golden_plate", "epic", 10, 2, ["emerald"], [{ type: "dodge_pct", val: 4 }]),
    helmet: mk("h", "golden_helm", "epic", 10, 0, ["sapphire", "sapphire"], [{ type: "hp_flat", val: 500 }]),
    boots: mk("b", "titan_boots", "rare", 10, 0, [], [{ type: "aspd_pct", val: 5 }]),
  };
});

statCase("oracle-mythic-lv100", () => {
  S.gearLevel = 100;
  const mk = (uid, templateId, quality, level, awakening) =>
    ({ uid, templateId, quality, level, awakening, sockets: ["ruby", "amethyst", "topaz", "sapphire"], affixes: [{ type: "atk_pct", val: 10 }, { type: "crit_pct", val: 5 }, { type: "aspd_pct", val: 6 }] });
  S.equippedGear = {
    weapon: mk("w", "oracle_staff", "mythic", 100, 4),
    necklace: mk("n", "void_prism_necklace", "mythic", 100, 3),
    ring: mk("r", "starlight_ring", "mythic", 100, 2),
    armor: mk("a", "wind_vest", "mythic", 100, 4),
    helmet: mk("h", "astral_crown", "mythic", 100, 1),
    boots: mk("b", "starlight_greaves", "legendary", 80, 3),
  };
});

statCase("talents-maxed", () => {
  S.talents = { refinement: 5, glory: 1, healer: 5, dexterity: 5, might: 5, vitality: 5 };
});

statCase("runes-filled", () => {
  S.equippedRuneSlots = {
    etched: ["arrow_of_echoes", "sharp_arrow"],
    blessing: ["guardian", "resilience"],
    enhancement: ["arrow_rain", "lucky_shadow"],
    ability: ["ability_circle"],
  };
  S.runes = { arrow_of_echoes: 1, sharp_arrow: 2, guardian: 1, resilience: 1, arrow_rain: 1, lucky_shadow: 1, ability_circle: 1 };
});

statCase("artifacts-3star-set", () => {
  S.artifactStars = {
    golden_fleece: 3, golden_mask: 3, goldfinger: 3,
    magic_harp: 6, pans_flute: 6, tidal_conch: 6,
  };
});

statCase("season-career-blade-10sacrifice", () => {
  S.season = { season: 1, career: "blade", tokens: 300, boss: null, bossHp: 0, bossMaxHp: 0, bossDefeated: false, powerSacrificed: 0.10, log: [] };
});

statCase("season-career-guardian", () => {
  S.season = { season: 1, career: "guardian", tokens: 120, boss: null, bossHp: 0, bossMaxHp: 0, bossDefeated: false, powerSacrificed: 0.02, log: [] };
});

statCase("skins-unlocked", () => {
  S.heroSelectedSkins = { artemis: 1 };
  S.unlockedSkins = { artemis_celestial: true, alex_default: true, artemis_legendary: true };
  S.heroStars = { artemis: 2, alex: 1 };
});

statCase("everything-combined", () => {
  S.selectedHeroId = "thor";
  S.weapon_unused = null;
  S.gearLevel = 60;
  S.heroStars = { thor: 5, wukong: 4, alex: 7, artemis: 3 };
  S.talents = { refinement: 3, glory: 1, healer: 2, dexterity: 4, might: 4, vitality: 4 };
  S.equippedRuneSlots = { etched: ["arrow_of_echoes"], blessing: ["guardian"], enhancement: ["arrow_rain"], ability: [] };
  S.runes = { arrow_of_echoes: 1, guardian: 1, arrow_rain: 1 };
  S.artifactStars = { golden_fleece: 9, golden_mask: 9, goldfinger: 9 };
  S.equippedGear = {
    weapon: { uid: "w", templateId: "crimson_bow", quality: "legendary", level: 60, awakening: 3, sockets: ["ruby", "ruby", "ruby", "ruby"], affixes: [{ type: "atk_pct", val: 9 }] },
    necklace: { uid: "n", templateId: "destruction_amulet", quality: "legendary", level: 60, awakening: 2, sockets: ["sapphire"], affixes: [{ type: "hp_pct", val: 12 }] },
    ring: { uid: "r", templateId: "destruction_ring", quality: "legendary", level: 60, awakening: 1, sockets: ["topaz"], affixes: [] },
    armor: { uid: "a", templateId: "destruction_armor", quality: "legendary", level: 60, awakening: 3, sockets: ["emerald"], affixes: [] },
    helmet: { uid: "h", templateId: "destruction_helmet", quality: "epic", level: 60, awakening: 2, sockets: ["sapphire"], affixes: [] },
    boots: { uid: "b", templateId: "destruction_boots", quality: "epic", level: 60, awakening: 2, sockets: [], affixes: [] },
  };
  S.season = { season: 1, career: "ranger", tokens: 180, boss: null, bossHp: 0, bossMaxHp: 0, bossDefeated: false, powerSacrificed: 0.06, log: [] };
});

write("stat-cases.json", statCases);

// ==================== 2. CÔNG THỨC SÁT THƯƠNG ====================
// damageEnemy / hurtPlayer cần một Game đang chạy. Ta dựng tối thiểu qua startNewRun.
const dmgCases = [];

function withPlayer(setup, fn) {
  resetSave();
  // Bật chế độ luyện tập để không cộng tài nguyên/kết thúc trận trong test.
  api.startNewRun("fresh", 0);
  const p = api.Game.player;
  if (!p) throw new Error("startNewRun không tạo player");
  setup(p, api.Game);
  return fn(p, api.Game);
}

/** Dựng một quái giả với đủ field mà damageEnemy đọc. */
function fakeEnemy(over = {}) {
  return {
    isBoss: false, type: "slime", x: 100, y: 100, r: 16,
    hp: 1000000, maxHp: 1000000, atk: 10, speed: 64,
    vx: 0, vy: 0, attackTimer: 1, burnTimer: 0, burnDmg: 0, slowTimer: 0,
    ...over,
  };
}

// Crit tất định: đặt random để luôn < critRate, hoặc luôn >=.
function withRandom(value, fn) {
  const orig = sandbox.Math.random;
  sandbox.Math.random = () => value;
  try { return fn(); } finally { sandbox.Math.random = orig; }
}

/**
 * Đo sát thương: gọi damageEnemy 1 lần và đọc hiệu số HP.
 * Dùng quái có maxHp khổng lồ để không bao giờ chết (tránh nhánh drop/kill).
 */
withPlayer((p) => {
  p.atk = 1000;
  p.critRate = 0;          // không crit
  p.critDmgMult = 1.85;
  p.maxHp = 5000;
  p.hp = 5000;
  p.skills = {};
}, (p) => {
  for (const raw of [100, 250, 1000, 12345.67]) {
    const e = fakeEnemy();
    const before = e.hp;
    withRandom(0.99, () => api.damageEnemy(e, raw, false));
    dmgCases.push({
      kind: "damageEnemy",
      label: "no-crit raw=" + raw,
      raw, isElemental: false, isCrit: false,
      expected: before - e.hp,
    });
  }
});

withPlayer((p) => {
  p.atk = 1000;
  p.critRate = 1.0;        // luôn crit
  p.critDmgMult = 1.85;
  p.maxHp = 5000;
  p.hp = 5000;
  p.skills = {};
}, (p) => {
  for (const raw of [100, 250, 1000]) {
    const e = fakeEnemy();
    const before = e.hp;
    withRandom(0.0, () => api.damageEnemy(e, raw, false));
    dmgCases.push({
      kind: "damageEnemy",
      label: "crit raw=" + raw,
      raw, isElemental: false, isCrit: true,
      critDmgMult: 1.85,
      expected: before - e.hp,
    });
  }
  // critDmgMult tùy biến
  p.critDmgMult = 2.35;
  {
    const e = fakeEnemy();
    const before = e.hp;
    withRandom(0.0, () => api.damageEnemy(e, 500, false));
    dmgCases.push({ kind: "damageEnemy", label: "crit 2.35 raw=500", raw: 500, isCrit: true, critDmgMult: 2.35, expected: before - e.hp });
  }
  // elemental không bao giờ crit
  {
    const e = fakeEnemy();
    const before = e.hp;
    withRandom(0.0, () => api.damageEnemy(e, 500, true));
    dmgCases.push({ kind: "damageEnemy", label: "elemental raw=500", raw: 500, isElemental: true, isCrit: false, expected: before - e.hp });
  }
});

write("damage-cases.json", dmgCases);

// ==================== 3. QUÁI & BOSS THEO PHÒNG ====================
// setupRoom sinh quái bằng công thức; ta đọc lại chỉ số đã sinh.
const roomCases = [];
const CHAPTERS = [
  { idx: 0, id: 1, rooms: 15, enemyScale: 1.0 },
  { idx: 1, id: 2, rooms: 12, enemyScale: 1.45 },
  { idx: 2, id: 3, rooms: 10, enemyScale: 2.0 },
  { idx: 3, id: 4, rooms: 15, enemyScale: 2.35 },
  { idx: 4, id: 5, rooms: 15, enemyScale: 2.62 },
];

// Dùng ATK/HP cố định để công thức có thể tái lập bằng số.
const FIXED_ATK = 12345;
const FIXED_MAXHP = 67890;

for (const ch of CHAPTERS) {
  resetSave();
  // Mở khoá tiến trình: startNewRun TỪ CHỐI chương bị khoá (isChapterLocked) và
  // trả về false, khiến fixture lặng lẽ dùng lại chương 1 — đúng cái bẫy đã làm
  // hỏng lần sinh fixture đầu tiên. Đánh dấu đã thắng mọi chương trước.
  S.winsByChapter = {};
  for (const prev of CHAPTERS) {
    if (prev.id < ch.id) S.winsByChapter[prev.id] = 1;
  }
  // startNewRun(reason) KHÔNG nhận chỉ số chương — nó đọc
  // SaveState.selectedChapterIdx. Truyền tham số thứ hai chỉ bị bỏ qua, khiến
  // fixture lặng lẽ dùng chương 1.
  S.selectedChapterIdx = ch.idx;
  const started = api.startNewRun("fresh");
  if (started === false) throw new Error("Không vào được chương " + ch.id + " (bị khoá?)");
  if (api.Game.chapter && api.Game.chapter.id !== ch.id) {
    throw new Error("Sai chương: muốn " + ch.id + " nhưng Game.chapter = " + api.Game.chapter.id);
  }
  const p = api.Game.player;
  p.atk = FIXED_ATK;
  p.maxHp = FIXED_MAXHP;
  p.hp = FIXED_MAXHP;

  for (let room = 1; room <= ch.rooms; room++) {
    api.setupRoom(room);
    const enemies = (api.Game.enemies || []).map((e) => ({
      isBoss: !!e.isBoss,
      type: e.type,
      hp: e.hp,
      maxHp: e.maxHp,
      atk: e.atk,
      speed: e.speed,
      r: e.r,
    }));
    roomCases.push({
      chapterIdx: ch.idx,
      chapterId: ch.id,
      rooms: ch.rooms,
      enemyScale: ch.enemyScale,
      room,
      maxRooms: api.Game.maxRooms,
      playerAtk: FIXED_ATK,
      playerMaxHp: FIXED_MAXHP,
      isBossRoom: api.isBossRoom(room, api.Game.maxRooms),
      enemies,
    });
  }
}

write("room-cases.json", roomCases);

// ==================== 4. THƯỞNG ====================
const rewardCases = [];
for (const ch of CHAPTERS) {
  for (const victory of [true, false]) {
    for (const room of [1, 5, ch.rooms]) {
      rewardCases.push({
        chapterId: ch.id,
        rooms: ch.rooms,
        victory,
        room,
        expectedGold: victory ? 350 * ch.id : room * 20,
        expectedGems: victory ? 40 * ch.id : Math.floor(room * 2),
      });
    }
  }
}
write("reward-cases.json", rewardCases);

console.log("\nFixture sẵn sàng tại tools/unity-parity/fixtures/");
console.log("Tổng: " + statCases.length + " cấu hình chỉ số · " + dmgCases.length + " ca sát thương · " + roomCases.length + " phòng · " + rewardCases.length + " ca thưởng");
