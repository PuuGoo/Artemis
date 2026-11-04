// ==================== SCHEMA SAVE SNAPSHOT (server-side) ====================
// Client gui len toan bo SaveState. Server phai kiem tra lai tu dau: khong tin client.
// Nguyen tac: whitelist field, gioi han so luong, gioi han do sau, gioi han kich thuoc.

export const MAX_SAVE_BYTES = 400 * 1024;
export const MAX_BAG_ITEMS = 400;
export const MAX_LOADOUTS = 40;
export const MAX_STR = 200;

const GEAR_SLOTS = ["weapon", "necklace", "ring", "armor", "helmet", "boots"];
const QUALITIES = new Set(["common", "uncommon", "rare", "epic", "legendary", "mythic"]);

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function clampNum(v, min, max, def = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampFloat(v, min, max, def = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function safeStr(v, max = MAX_STR) {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

function safeId(v, max = 80) {
  const s = safeStr(v, max);
  return /^[A-Za-z0-9_-]{1,80}$/.test(s) ? s : "";
}

function safeBool(v) {
  return v === true;
}

/** Gioi han do sau + so key de tranh object qua lon hoac prototype pollution. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function sanitizeGearItem(raw) {
  if (!isPlainObject(raw)) return null;
  const templateId = safeId(raw.templateId);
  if (!templateId) return null;
  const quality = QUALITIES.has(raw.quality) ? raw.quality : "common";
  const sockets = Array.isArray(raw.sockets)
    ? raw.sockets.slice(0, 6).map((s) => (isPlainObject(s) ? {
        gem: safeId(s.gem, 40) || null,
        level: clampNum(s.level, 0, 99, 0),
      } : null)).filter(Boolean)
    : [];
  const affixes = Array.isArray(raw.affixes)
    ? raw.affixes.slice(0, 12).map((a) => (isPlainObject(a) ? {
        stat: safeId(a.stat, 40) || null,
        tier: safeId(a.tier, 20) || null,
        value: clampFloat(a.value, 0, 1000, 0),
      } : null)).filter(Boolean)
    : [];
  return {
    uid: safeId(raw.uid) || `u_${Math.random().toString(36).slice(2, 10)}`,
    templateId,
    quality,
    awakening: clampNum(raw.awakening, 0, 10, 0),
    level: clampNum(raw.level, 1, 200, 1),
    locked: safeBool(raw.locked),
    favorite: safeBool(raw.favorite),
    sockets,
    affixes,
  };
}

function sanitizeEquipped(raw) {
  const out = {};
  for (const slot of GEAR_SLOTS) {
    out[slot] = isPlainObject(raw) ? sanitizeGearItem(raw[slot]) : null;
  }
  return out;
}

function sanitizeUidMap(raw) {
  const out = {};
  for (const slot of GEAR_SLOTS) {
    const v = isPlainObject(raw) ? raw[slot] : null;
    out[slot] = typeof v === "string" ? (safeId(v) || null) : null;
  }
  return out;
}

function sanitizeNumericRecord(raw, { keys = null, min = 0, max = 1e9 } = {}) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  const entries = keys ? keys.map((k) => [k, raw[k]]) : Object.entries(raw);
  for (const [k, v] of entries) {
    if (typeof k !== "string" || FORBIDDEN_KEYS.has(k)) continue;
    const key = safeId(k, 40) || safeStr(k, 40);
    if (!key) continue;
    if (!Number.isFinite(Number(v))) continue;
    out[key] = clampNum(v, min, max, 0);
  }
  return out;
}

/** Giu nguyen kieu boolean (vd unlockedSkins: {artemis_default: true}). */
function sanitizeBoolRecord(raw, { maxKeys = 200 } = {}) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (n++ >= maxKeys) break;
    if (typeof k !== "string" || FORBIDDEN_KEYS.has(k)) continue;
    const key = safeId(k, 40) || safeStr(k, 40);
    if (!key) continue;
    if (v === true || v === 1) out[key] = true;
  }
  return out;
}

/**
 * Chuyen SaveState tu client thanh document an toan de luu.
 * Tra ve { ok, data, reason }.
 */
export function sanitizeSave(raw) {
  if (!isPlainObject(raw)) return { ok: false, reason: "Save khong hop le." };
  const bytes = Buffer.byteLength(JSON.stringify(raw), "utf8");
  if (bytes > MAX_SAVE_BYTES) {
    return { ok: false, reason: `Save qua lon (${bytes} byte, toi da ${MAX_SAVE_BYTES}).` };
  }

  const bagRaw = Array.isArray(raw.gearBag) ? raw.gearBag : [];
  if (bagRaw.length > MAX_BAG_ITEMS) {
    return { ok: false, reason: `Tui do qua ${MAX_BAG_ITEMS} vat pham.` };
  }
  const gearBag = bagRaw.map(sanitizeGearItem).filter(Boolean);

  // Presets: { "1"|"2"|"3": slot->uid }
  const presets = {};
  if (isPlainObject(raw.presets)) {
    for (const k of Object.keys(raw.presets).slice(0, 6)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      presets[safeStr(k, 3)] = sanitizeUidMap(raw.presets[k]);
    }
  }

  // Loadouts: { id: { id, name, slots, createdAt } }
  const gearLoadouts = {};
  if (isPlainObject(raw.gearLoadouts)) {
    for (const [k, v] of Object.entries(raw.gearLoadouts).slice(0, MAX_LOADOUTS)) {
      const id = safeId(k) || safeId(v?.id);
      if (!id || !isPlainObject(v)) continue;
      gearLoadouts[id] = {
        id,
        name: safeStr(v.name, 60),
        slots: sanitizeUidMap(v.slots),
        createdAt: clampNum(v.createdAt, 0, 4102444800000, Date.now()),
      };
    }
  }

  const lifetimeStats = sanitizeNumericRecord(raw.lifetimeStats, { max: 1e12 });
  const winsByChapter = sanitizeNumericRecord(raw.winsByChapter, { max: 1e6 });

  const achievementsUnlocked = sanitizeNumericRecord(raw.achievementsUnlocked, { max: 4102444800000 });
  const achievementsClaimed = sanitizeNumericRecord(raw.achievementsClaimed, { max: 4102444800000 });

  const starterSkillIds = Array.isArray(raw.starterSkillIds)
    ? raw.starterSkillIds.slice(0, 80).map((x) => safeId(x, 40)).filter(Boolean)
    : [];

  const data = {
    // ---- Co phien ban: BAT BUOC phai luu, neu thieu SaveState.load() se tuong
    //      la save cu va chay applyMaxAllSystems() -> max toan bo tai nguyen.
    maxedAllVersion: clampNum(raw.maxedAllVersion, 0, 99, 1),
    artemisHeroVersion: clampNum(raw.artemisHeroVersion, 0, 99, 1),
    wikiCharactersVersion: clampNum(raw.wikiCharactersVersion, 0, 99, 2),
    gold: clampNum(raw.gold, 0, 1e12, 0),
    gems: clampNum(raw.gems, 0, 1e12, 0),
    stamina: clampNum(raw.stamina, 0, 1e9, 0),
    playerLevel: clampNum(raw.playerLevel, 1, 999, 1),
    playerName: safeStr(raw.playerName, 24),
    selectedChapterIdx: clampNum(raw.selectedChapterIdx, 0, 99, 0),
    selectedHeroId: safeId(raw.selectedHeroId) || "artemis",
    selectedWeaponId: safeId(raw.selectedWeaponId) || "bow",
    selectedPetId: safeId(raw.selectedPetId) || "spirit_sword",
    gearLevel: clampNum(raw.gearLevel, 1, 999, 1),
    activePreset: clampNum(raw.activePreset, 1, 6, 1),
    heroSkinIdx: clampNum(raw.heroSkinIdx, 0, 20, 0),
    sortMode: ["quality", "level", "slot"].includes(raw.sortMode) ? raw.sortMode : "quality",
    achievementFilter: ["all", "combat", "journey", "forge", "collect"].includes(raw.achievementFilter)
      ? raw.achievementFilter : "all",
    runes: sanitizeNumericRecord(raw.runes, { max: 1e6 }),
    talents: sanitizeNumericRecord(raw.talents, { max: 1e6 }),
    bestRooms: sanitizeNumericRecord(raw.bestRooms, { max: 1e6 }),
    gemInventory: sanitizeNumericRecord(raw.gemInventory, { max: 1e6 }),
    salvageMaterials: clampNum(raw.salvageMaterials, 0, 1e12, 0),
    heroStars: sanitizeNumericRecord(raw.heroStars, { max: 20 }),
    heroShards: sanitizeNumericRecord(raw.heroShards, { max: 1e9 }),
    heroSelectedSkins: sanitizeNumericRecord(raw.heroSelectedSkins, { max: 20 }),
    resonanceSlots: isPlainObject(raw.resonanceSlots) ? {
      slot1: safeId(raw.resonanceSlots.slot1) || null,
      slot2: safeId(raw.resonanceSlots.slot2) || null,
    } : { slot1: null, slot2: null },
    unlockedSkins: sanitizeBoolRecord(raw.unlockedSkins),
    lifetimeStats,
    winsByChapter,
    achievementsUnlocked,
    achievementsClaimed,
    starterSkillIds,
    acquiredSkills: sanitizeNumericRecord(raw.acquiredSkills, { max: 1e6 }),
    equippedGear: sanitizeEquipped(raw.equippedGear),
    gearBag,
    presets,
    gearLoadouts,
    // ---- Vat pham suu tam & trang thai gacha (neu roi se mat do cua nguoi choi) ----
    // chestKeys la OBJECT {silver_chest_key: n, ...} chu khong phai so.
    gearScrolls: sanitizeNumericRecord(raw.gearScrolls, { max: 1e6 }),
    chestKeys: sanitizeNumericRecord(raw.chestKeys, { max: 1e9 }),
    wishTokens: clampNum(raw.wishTokens, 0, 1e9, 0),
    wikiOtherItems: sanitizeNumericRecord(raw.wikiOtherItems, { max: 1e9 }),
    chestGachaState: sanitizeNumericRecord(raw.chestGachaState, { max: 1e12 }),
    runeRuinsState: sanitizeNumericRecord(raw.runeRuinsState, { max: 1e12 }),
    wikiEventsState: sanitizeNumericRecord(raw.wikiEventsState, { max: 1e12 }),
  };

  return { ok: true, data, bytes };
}

/** Rút gọn thông tin công khai của người chơi (không lộ hash mật khẩu). */
export function publicPlayer(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    username: doc.username,
    displayName: doc.displayName || doc.username,
    createdAt: doc.createdAt || null,
    lastLoginAt: doc.lastLoginAt || null,
  };
}
