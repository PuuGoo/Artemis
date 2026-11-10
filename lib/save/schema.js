// ==================== SCHEMA SAVE SNAPSHOT (server-side) ====================
import { normalizeVipPasses } from '../privilegeCards.js';
import { RUNE_IDS } from '../runeCatalog.js';
import '../../public/campaign-support.js';
import '../../public/campaign-telemetry.js';
const campaignSupport = globalThis.CampaignSupport;
const campaignTelemetry = globalThis.ArtemisCampaignTelemetry;
// Client gui len toan bo SaveState. Server phai kiem tra lai tu dau: khong tin client.
// Nguyen tac: whitelist field, gioi han so luong, gioi han do sau, gioi han kich thuoc.

export const MAX_SAVE_BYTES = 400 * 1024;
export const MAX_BAG_ITEMS = 400;
export const MAX_LOADOUTS = 40;
export const MAX_STR = 200;

const GEAR_SLOTS = ["weapon", "necklace", "ring", "armor", "helmet", "boots"];
const QUALITIES = new Set(["common", "uncommon", "rare", "epic", "legendary", "mythic"]);

// ===== Beginner Journey: whitelist bước nhiệm vụ =====
// Server KHÔNG tin client: chỉ chấp nhận đúng 8 ID đã định nghĩa, và chỉ cho
// phép mỗi ID xuất hiện một lần trong completedSteps / claimedRewards
// (chống phát thưởng trùng).
export const BEGINNER_STEP_IDS = ["N01", "N02", "N03", "N04", "N05", "N06", "N07", "N08"];
const BEGINNER_STEP_SET = new Set(BEGINNER_STEP_IDS);

function sanitizeStepIdList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of v.slice(0, 32)) {
    const id = safeId(raw, 8);
    if (!id || !BEGINNER_STEP_SET.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  // Giữ đúng thứ tự khai báo để so sánh/kiểm thử ổn định
  return BEGINNER_STEP_IDS.filter((id) => seen.has(id));
}

// ===== Mùa Giải: whitelist tiến trình server-side =====
// Season chứa tiền, nghề, trùm và phần hi sinh sức mạnh tác động trực tiếp
// gameplay. Chỉ lưu ID hợp lệ và giới hạn mọi số liệu do client gửi lên.
const SEASON_CAREER_IDS = new Set(["blade", "ranger", "guardian", "mage", "merchant"]);
const SEASON_BOSS_IDS = new Set(["ironhide", "reflector", "regenerator"]);

function sanitizeSeason(raw) {
  const empty = {
    season: 1, career: null, tokens: 0, boss: null,
    bossHp: 0, bossMaxHp: 0, bossDefeated: false,
    powerSacrificed: 0, log: [],
  };
  if (!isPlainObject(raw)) return empty;

  const careerId = safeId(raw.career, 24);
  const bossId = safeId(raw.boss, 24);
  const bossMaxHp = clampNum(raw.bossMaxHp, 0, 1e12, 0);
  const bossHp = Math.min(bossMaxHp, clampNum(raw.bossHp, 0, 1e12, 0));
  const log = Array.isArray(raw.log)
    ? raw.log.slice(0, 40).map((entry) => {
        if (!isPlainObject(entry)) return null;
        const text = safeStr(entry.text, 160);
        return text ? { t: clampNum(entry.t, 0, 4e12, 0), text } : null;
      }).filter(Boolean)
    : [];

  return {
    season: clampNum(raw.season, 1, 100, 1),
    career: SEASON_CAREER_IDS.has(careerId) ? careerId : null,
    tokens: clampNum(raw.tokens, 0, 1e9, 0),
    boss: SEASON_BOSS_IDS.has(bossId) ? bossId : null,
    bossHp,
    bossMaxHp,
    bossDefeated: safeBool(raw.bossDefeated) && !!bossId && bossHp === 0,
    powerSacrificed: clampFloat(raw.powerSacrificed, 0, 0.20, 0),
    log,
  };
}

// ===== Checkpoint lượt chơi (Continue) =====
// Danh sách tường minh từ ROGUE_SKILLS; test đối chiếu catalog thật khi bổ sung ID.
const CHECKPOINT_SKILL_IDS = new Set([
  'warriors_soul', 'power_trio', 'multishot', 'corrosive_field', 'energy_beam',
  'soul_of_strength', 'sacred_protection', 'sprite_king', 'super_meteor', 'beam_strike',
  'circle_web', 'atk_boost', 'giants_strength', 'weapon_enchantment', 'aspd_boost',
  'tracking_eye', 'diag_arrow', 'energy_ring', 'wall_piercing_arrow', 'wind_blessing',
  'water_walker', 'slow_field', 'revive', 'super_blaze', 'super_bolt', 'super_venom',
  'super_freeze', 'laser_sprite', 'sprite_frenzy', 'meteor_shower', 'chain_meteors',
  'beam_circle', 'super_circle', 'magic_strike', 'strike_boost', 'twin_strike',
  'underworld_warrior', 'demon_slayer', 'warriors_heart', 'stand_strong',
  'short_range_strike', 'perilous_fervor', 'lightwing_arrow', 'swift_arrow',
  'front_arrow', 'charged_arrow', 'pierce', 'split_shot', 'ricochet', 'lucky_band_aid',
  'fountain_of_life', 'angelic_shelter', 'fire_arrow', 'lightning_arrow', 'venom_arrow',
  'ice_arrow', 'bomb_sprite', 'flying_swords', 'warriors_breath', 'fairys_breath',
  'hermes_boots', 'max_hp_up', 'restore_hp', 'wounded_warrior', 'boss_slayer',
  'long_range_power', 'bouncy_wall', 'rear_arrow', 'fiery_path', 'bloodthirst',
  'orbit_orbs', 'assault_strike',
]);
const CHECKPOINT_SKILL_CAPS = { multishot: 2, sacred_protection: 4, tracking_eye: 1,
  pierce: 1, wall_piercing_arrow: 1, weapon_enchantment: 1, energy_beam: 1,
  revive: 1, sprite_king: 1, laser_sprite: 1, bomb_sprite: 1, circle_web: 1, water_walker: 1 };

function sanitizeCheckpointSkills(raw) {
  const out = {};
  let budget = 10;
  if (!isPlainObject(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!budget) break;
    if (!CHECKPOINT_SKILL_IDS.has(id)) continue;
    const count = Math.min(budget, Math.floor(checkpointFloat(value, 0, CHECKPOINT_SKILL_CAPS[id] ?? 10, 0)));
    if (count > 0) { out[id] = count; budget -= count; }
  }
  return out;
}

function checkpointFloat(value, min, max, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
const validCheckpointStage = value => Number.isInteger(value) && value >= 5 && value <= 45 && value % 5 === 0;
function checkpointStages(raw) {
  return Array.isArray(raw) ? [...new Set(raw.filter(validCheckpointStage))].slice(0, 9) : [];
}
function checkpointOffers(raw) {
  return Array.isArray(raw) ? [...new Set(raw.filter(id => typeof id === 'string' && CHECKPOINT_SKILL_IDS.has(id)))].slice(0, 3) : [];
}
function sanitizeRunProgression(raw) {
  if (!isPlainObject(raw)) return null;
  const out = {};
  // Nhận cả tên đề xuất ban đầu lẫn state thuần của campaign-skills.
  for (const key of ['acquiredSkills', 'skills']) {
    if (Object.hasOwn(raw, key)) out[key] = sanitizeCheckpointSkills(raw[key]);
  }
  for (const key of ['claimedValkyrieStages', 'skippedValkyrieStages', 'claimedStages']) {
    if (Object.hasOwn(raw, key)) out[key] = checkpointStages(raw[key]);
  }
  if (Array.isArray(raw.claimedStages) && raw.claimedStages.includes('start')) out.claimedStages.unshift('start');
  if (out.skippedValkyrieStages) out.skippedValkyrieStages = out.skippedValkyrieStages.filter(stage => !out.claimedValkyrieStages?.includes(stage));
  for (const [key, max] of Object.entries({ version: 1, seed: 0xffffffff, skillChoicesUsed: 10,
    choicesUsed: 10, runSkillLevel: 10, valkyrieOffers: 10, pityCounter: 4 })) {
    if (Object.hasOwn(raw, key)) out[key] = clampNum(raw[key], 0, max, 0);
  }
  if (Object.hasOwn(raw, 'encounter')) {
    const e = raw.encounter;
    out.encounter = isPlainObject(e) && validCheckpointStage(e.stage) ? {
      stage: e.stage,
      state: ['pending', 'offered', 'claimed', 'skipped'].includes(e.state) ? e.state : 'pending',
      offers: checkpointOffers(e.offers), rerollsUsed: clampNum(e.rerollsUsed, 0, 2, 0),
    } : null;
  }
  if (Object.hasOwn(raw, 'pendingOffer')) {
    const e = raw.pendingOffer;
    const ids = checkpointOffers(e?.skillIds);
    out.pendingOffer = isPlainObject(e) && (e.stageId === 'start' || validCheckpointStage(e.stageId)) && ids.length
      && !out.claimedStages?.includes(e.stageId) && ['valkyrie', 'angel', 'devil'].includes(e.provider)
      ? { stageId: e.stageId, provider: e.provider, segment: clampNum(e.segment, 0, 4, 0),
          seraph: e.seraph === true, pity: e.pity === true, skillIds: ids,
          rerollLimit: clampNum(e.rerollLimit, 0, 2, 1),
          rerollsUsed: Math.min(clampNum(e.rerollsUsed, 0, 2, 0), clampNum(e.rerollLimit, 0, 2, 1)),
        } : null;
  }
  return out;
}

// Server chỉ giữ checkpoint nếu cấu trúc hợp lệ. Không tin client:
// phòng phải trong khoảng hợp lệ, chỉ số nhân vật phải hữu hạn và dương.
function sanitizeDungeonCheckpoint(raw) {
  if (!isPlainObject(raw)) return null;
  const v2 = Number(raw.v) === 2;
  const entry = v2 && raw.boundary === 'entry' && raw.room === 1 && raw.roomCleared === false;
  if (v2 && !entry && raw.roomCleared !== true) return null;
  const room = clampNum(raw.room, 1, v2 ? 50 : 200, 0);
  const maxRooms = clampNum(raw.maxRooms, 1, v2 ? 50 : 200, 0);
  if (!room || !maxRooms || room >= maxRooms) return null;

  const pl = isPlainObject(raw.player) ? raw.player : null;
  if (!pl) return null;

  const maxHp = Math.max(1, clampNum(pl.maxHp, 1, 1e12, 1));
  const hp = Math.min(maxHp, Math.max(1, clampNum(pl.hp, 1, 1e12, maxHp)));

  // Kỹ năng: whitelist id dạng slug, bậc 1..20, tối đa 60 mục
  const skills = v2 ? sanitizeCheckpointSkills(pl.skills) : {};
  if (!v2 && isPlainObject(pl.skills)) {
    let n = 0;
    for (const [k, v] of Object.entries(pl.skills)) {
      if (n >= 60) break;
      const id = safeId(k, 60);
      if (!id) continue;
      skills[id] = clampNum(v, 1, 20, 1);
      n++;
    }
  }

  return {
    v: clampNum(raw.v, 1, 99, 1),
    chapterIdx: clampNum(raw.chapterIdx, 0, 20, 0),
    chapterId: clampNum(raw.chapterId, 1, 20, 1),
    room,
    maxRooms,
    kills: clampNum(raw.kills, 0, 1e6, 0),
    runGold: clampNum(raw.runGold, 0, 1e12, 0),
    savedAt: clampNum(raw.savedAt, 0, 4e12, 0),
    ...(v2 ? { runId: typeof raw.runId === 'string' && /^[a-zA-Z0-9_:-]{8,100}$/.test(raw.runId) ? raw.runId : null,
      boundary: entry ? 'entry' : 'cleared', roomCleared: !entry,
      // Missing legacy receipt is settled: never create a fresh payout window on adoption.
      rewardSettled: raw.rewardSettled !== false,
      runProgression: sanitizeRunProgression(raw.runProgression),
      ...(Object.hasOwn(raw, 'support') ? {support: campaignSupport.normalize(raw.support)} : {}),
      ...(Object.hasOwn(raw, 'telemetry') ? {telemetry: campaignTelemetry.normalize(raw.telemetry)} : {}),
    } : {}),
    player: {
      hp,
      maxHp,
      atk: Math.max(1, clampNum(pl.atk, 1, 1e12, 1)),
      aspd: clampFloat(pl.aspd, 0.1, 20, 1),
      critRate: clampFloat(pl.critRate, 0, 1, 0.1),
      critDmgMult: clampFloat(pl.critDmgMult, 1, 10, 1.85),
      defFlat: clampNum(pl.defFlat, 0, 1e9, 0),
      dmgReduction: clampFloat(pl.dmgReduction, 0, 0.75, 0),
      level: clampNum(pl.level, 1, v2 ? 10 : 999, 1),
      xp: clampNum(pl.xp, 0, 1e12, 0),
      xpNext: Math.max(1, clampNum(pl.xpNext, 1, 1e12, 80)),
      skills,
      runeReviveUsed: safeBool(pl.runeReviveUsed),
      reviveSkillUsed: safeBool(pl.reviveSkillUsed),
      mymuOverdrawUsed: safeBool(pl.mymuOverdrawUsed),
      ...(v2 ? {
        speed: checkpointFloat(pl.speed, 0, 390, 240),
        gearDodge: checkpointFloat(pl.gearDodge, 0, 0.65, 0),
        dodge: checkpointFloat(pl.dodge, 0, 0.65, 0),
        mainWepDmgMult: checkpointFloat(pl.mainWepDmgMult, 0, 100, 1),
        dmgCatMult: checkpointFloat(pl.dmgCatMult, 0, 100, 1),
        sacredShieldStacks: Math.floor(checkpointFloat(pl.sacredShieldStacks, 0, 4, 0)),
      } : {}),
    },
  };
}

function sanitizeBeginnerJourney(raw) {
  const def = {
    version: 1, startedAt: 0, completedAt: 0, skipped: false,
    currentStep: "N01", completedSteps: [], claimedRewards: [], isCompleted: false,
  };
  if (!isPlainObject(raw)) return def;

  const completedSteps = sanitizeStepIdList(raw.completedSteps);
  // claimedRewards CHỈ hợp lệ nếu bước đó đã hoàn thành -> chặn tự nhận thưởng
  const claimedRaw = sanitizeStepIdList(raw.claimedRewards);
  const claimedRewards = claimedRaw.filter((id) => completedSteps.includes(id));

  const cur = safeId(raw.currentStep, 8);
  const currentStep = BEGINNER_STEP_SET.has(cur) ? cur : "N01";

  return {
    version: clampNum(raw.version, 1, 99, 1),
    startedAt: clampNum(raw.startedAt, 0, 4e12, 0),
    completedAt: clampNum(raw.completedAt, 0, 4e12, 0),
    skipped: safeBool(raw.skipped),
    currentStep,
    completedSteps,
    claimedRewards,
    isCompleted: safeBool(raw.isCompleted),
    // Tiến độ nhặt đồ phải sống qua một vòng tải/lưu cloud; 10 là đích N03.
    _lootCount: clampNum(raw._lootCount, 0, 10, 0),
  };
}

// ===== Chế độ chơi, Bang Hội, Vườn Thủ Hộ, Plinko =====
// Bốn hệ này KHÔNG bắt buộc với save cũ. Nguyên tắc tương thích:
//   • Client cũ (hoặc save trước bản vá) KHÔNG gửi field -> không tự thêm key,
//     nên người chơi cũ không bị "hồi sinh" dữ liệu mặc định của hệ mới.
//   • Client mới LUÔN gửi key (null khi chưa có dữ liệu) -> giá trị đã kiểm.
// Nhờ vậy phân biệt được "chưa từng có" với "đã xoá", và API có thể giữ field
// cũ khi một client cũ ghi đè snapshot.
const GAME_MODE_IDS = new Set(["campaign", "endless", "tower", "bossrush", "practice"]);

/** Kỷ lục phòng theo chế độ: { endless: 37, tower: 12 } */
function sanitizeModeBest(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (n++ >= 12) break;
    // Nhận id dạng slug thay vì whitelist cứng: một chế độ mới thêm sau này
    // không bị server cũ xoá mất kỷ lục. Giá trị vẫn bị chặn trần.
    const id = safeId(k, 40);
    if (!id || !Number.isFinite(Number(v))) continue;
    out[id] = clampNum(v, 0, 1e6, 0);
  }
  return out;
}

/** Bang hội (chơi đơn). null = chưa lập bang. */
function sanitizeGuild(raw) {
  if (!isPlainObject(raw)) return null;
  const name = safeStr(raw.name, 24).trim();
  if (!name) return null;

  const members = [];
  if (Array.isArray(raw.members)) {
    for (const m of raw.members.slice(0, 20)) {
      if (!isPlainObject(m)) continue;
      const id = safeId(m.id, 40);
      if (!id) continue;
      members.push({
        id,
        name: safeStr(m.name, 24),
        rank: safeId(m.rank, 20) || "member",
        power: clampNum(m.power, 0, 1e12, 0),
        contribution: clampNum(m.contribution, 0, 1e12, 0),
        bossDamage: clampNum(m.bossDamage, 0, 1e12, 0),
        isPlayer: safeBool(m.isPlayer),
      });
    }
  }

  const bossRaw = isPlainObject(raw.boss) ? raw.boss : {};
  const bossMaxHp = clampNum(bossRaw.maxHp, 0, 1e12, 0);
  const bossHp = Math.min(bossMaxHp, clampNum(bossRaw.hp, 0, 1e12, 0));

  const log = Array.isArray(raw.log)
    ? raw.log.slice(0, 60).map((entry) => {
        if (!isPlainObject(entry)) return null;
        const text = safeStr(entry.text, 160);
        return text ? { t: clampNum(entry.t, 0, 4e12, 0), text } : null;
      }).filter(Boolean)
    : [];

  const expRaw = isPlainObject(raw.expedition) ? raw.expedition : {};

  return {
    name,
    level: clampNum(raw.level, 1, 999, 1),
    exp: clampNum(raw.exp, 0, 1e12, 0),
    notice: safeStr(raw.notice, 120),
    createdAt: clampNum(raw.createdAt, 0, 4e12, 0),
    members,
    boss: {
      week: clampNum(bossRaw.week, 1, 9999, 1),
      hp: bossHp,
      maxHp: bossMaxHp,
      // Chỉ coi là đã hạ khi HP thật sự về 0, giống cách season boss được kiểm.
      defeated: safeBool(bossRaw.defeated) && bossMaxHp > 0 && bossHp === 0,
      attempts: clampNum(bossRaw.attempts, 0, 1e9, 0),
    },
    expedition: {
      floor: clampNum(expRaw.floor, 0, 1e6, 0),
      best: clampNum(expRaw.best, 0, 1e6, 0),
    },
    log,
  };
}

const GARDEN_PLOTS_MAX = 6;
const GARDEN_PRODUCE_KEYS = ["leaf", "petal", "dew", "essence"];

/** Vườn Thủ Hộ. null = chưa mở hệ thống. */
function sanitizeGarden(raw) {
  if (!isPlainObject(raw)) return null;

  const plots = [];
  if (Array.isArray(raw.plots)) {
    for (const p of raw.plots.slice(0, GARDEN_PLOTS_MAX)) {
      if (!isPlainObject(p)) continue;
      const plantedAt = clampNum(p.plantedAt, 0, 4e12, 0);
      const readyAt = clampNum(p.readyAt, 0, 4e12, 0);
      const seedId = safeId(p.seedId, 40);
      // Ô không có hạt thì mọi mốc thời gian phải bằng 0 (tránh dữ liệu nửa vời).
      plots.push({
        id: clampNum(p.id, 0, GARDEN_PLOTS_MAX - 1, plots.length),
        seedId: seedId || null,
        plantedAt: seedId ? plantedAt : 0,
        watered: seedId ? safeBool(p.watered) : false,
        readyAt: seedId ? Math.max(plantedAt, readyAt) : 0,
      });
    }
  }

  const seeds = {};
  if (isPlainObject(raw.seeds)) {
    let n = 0;
    for (const [k, v] of Object.entries(raw.seeds)) {
      if (n++ >= 40) break;
      const id = safeId(k, 40);
      if (!id || !Number.isFinite(Number(v))) continue;
      seeds[id] = clampNum(v, 0, 1e6, 0);
    }
  }

  const produce = {};
  for (const k of GARDEN_PRODUCE_KEYS) {
    produce[k] = clampNum(isPlainObject(raw.produce) ? raw.produce[k] : 0, 0, 1e9, 0);
  }

  const taskRaw = isPlainObject(raw.weekTask) ? raw.weekTask : {};

  return {
    plots,
    seeds,
    produce,
    totalHarvest: clampNum(raw.totalHarvest, 0, 1e12, 0),
    weekTask: {
      done: clampNum(taskRaw.done, 0, 1e6, 0),
      target: Math.max(1, clampNum(taskRaw.target, 1, 1e6, 10)),
      claimed: safeBool(taskRaw.claimed),
    },
    raidsRepelled: clampNum(raw.raidsRepelled, 0, 1e9, 0),
  };
}

const PLINKO_HISTORY_MAX = 20;

/** Plinko. null = chưa mở hệ thống. */
function sanitizePlinko(raw) {
  if (!isPlainObject(raw)) return null;

  const history = [];
  if (Array.isArray(raw.history)) {
    for (const h of raw.history.slice(0, PLINKO_HISTORY_MAX)) {
      if (!isPlainObject(h)) continue;
      history.push({
        bin: clampNum(h.bin, 0, 8, 0),
        mult: clampFloat(h.mult, 0, 1000, 0),
        bet: clampNum(h.bet, 0, 1e9, 0),
        win: clampNum(h.win, 0, 1e12, 0),
        t: clampNum(h.t, 0, 4e12, 0),
      });
    }
  }

  return {
    balls: clampNum(raw.balls, 0, 1e9, 0),
    history,
    totalWon: clampNum(raw.totalWon, 0, 1e12, 0),
    bestMult: clampFloat(raw.bestMult, 0, 1000, 0),
    bet: clampNum(raw.bet, 0, 1e9, 200),
  };
}

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

/** Giu nguyen cau truc long nhau (object/array/string/number) trong gioi han do sau & kich thuoc. */
function sanitizeDeepValue(v, depth = 0, budget = { n: 0 }) {
  if (budget.n++ > 4000) return null;      // tranh payload qua lon
  if (depth > 5) return null;              // tranh long qua sau
  if (v === null || v === undefined) return null;
  const t = typeof v;
  if (t === 'boolean') return v;
  if (t === 'number') return Number.isFinite(v) ? v : 0;
  if (t === 'string') return safeStr(v, 120);
  if (Array.isArray(v)) {
    return v.slice(0, 200).map((x) => sanitizeDeepValue(x, depth + 1, budget));
  }
  if (t === 'object') {
    const out = {};
    let k = 0;
    for (const [key, val] of Object.entries(v)) {
      if (k++ >= 60) break;
      if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) continue;
      const safeKey = safeId(key, 40) || safeStr(key, 40);
      if (!safeKey) continue;
      out[safeKey] = sanitizeDeepValue(val, depth + 1, budget);
    }
    return out;
  }
  return null;
}

/** Hop nhat: giu kieu goc, dong thoi dam bao cac field so da biet van la number. */
function sanitizeMixedRecord(raw, { numericKeys = [] } = {}) {
  const out = sanitizeDeepValue(raw, 0, { n: 0 });
  if (!out || typeof out !== 'object' || Array.isArray(out)) return {};
  for (const k of numericKeys) {
    if (!(k in out)) continue;
    const n = Number(out[k]);
    out[k] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

/**
 * Chuyen SaveState tu client thanh document an toan de luu.
 * Tra ve { ok, data, reason }.
 */
// Rune board: only catalog IDs in their matching category may grant stats.
const RUNE_IDS_BY_CATEGORY = {
  etched: new Set(["echo_scythe", "arrow_of_echoes", "elemental_crit", "elemental_domain", "sword_strike_split", "sword_strike_aerie", "meteor_split", "potion_spring", "pulsing_orb", "orbital_orb", "sprites_awe", "sprite_assist", "life_surge"]),
  blessing: new Set(["rune_valkyrie", "rabbits_foot", "guardian", "lucky_shadow", "intelligence", "devil_pact", "resilience"]),
  enhancement: new Set(["sharp_arrow", "dragonflight_sword", "ricocheting_strike", "rune_flame", "rune_frost", "sawblade_circle", "rotating_spd_up", "giant_meteor", "potion_magnet", "sprite_multishot", "sprite_link", "rootguard", "vine_bind"]),
  ability: new Set(["arrow_rain", "ring_of_agony", "sword_of_time", "star_of_time", "star_of_fury", "flame_poison_touch", "rune_thunder", "ability_circle", "healing_sprite", "melee_sprite", "strike_potion", "plant_summon", "equinox_bloom"]),
};
const RUNE_SLOT_LIMITS = { etched: 3, blessing: 2, enhancement: 4, ability: 4 };
const RUNE_QUALITY_IDS = new Set(["normal", "fine", "rare", "epic", "epic_1", "epic_2", "legendary", "legendary_1", "legendary_2", "legendary_3", "mythic"]);
const ARTIFACT_IDS = new Set([
  "cupids_arrow", "demon_kings_eye", "goldfinger", "golden_fleece", "ravenous_chain", "pans_flute", "tidal_conch", "golden_mask", "demon_blood", "swiftwind_jade", "aeon_spire", "protective_blazon", "dice_of_destiny", "bladeborne", "everburn_comet", "boltfang_candy_jar", "gungnir", "voidblade",
  "cupids_bow", "brisingamen", "dragon_heart", "attack_horn", "healing_grail", "damocles_sword", "gargoyle", "bull_skull", "fire_phoenix_feather", "magic_harp", "thronebreaker_shield", "broodmother_scale", "thorned_treeheart", "medusas_eye", "frostflame_lamp", "quiet_quill", "magic_lamp", "magic_carpet",
  "poison_apple", "laurel_wreath", "four_leaf_clover", "crystal_shoe", "red_hood", "gladiators_helm", "pumpkin_lantern", "supreme_staff", "iron_throne", "sword_in_the_stone"
]);
function sanitizeArtifactStars(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [id, stars] of Object.entries(raw)) {
    if (ARTIFACT_IDS.has(id)) out[id] = clampNum(stars, 0, 15, 0);
  }
  return out;
}
function sanitizeRuneBoard(raw) {
  const out = { etched: [], blessing: [], enhancement: [], ability: [] };
  const seen = new Set();
  if (!isPlainObject(raw)) return out;
  for (const [cat, limit] of Object.entries(RUNE_SLOT_LIMITS)) {
    const slots = Array.isArray(raw[cat]) ? raw[cat].slice(0, limit) : [];
    out[cat] = slots.map(value => {
      const id = safeId(value);
      if (!RUNE_IDS_BY_CATEGORY[cat].has(id) || seen.has(id)) return null;
      seen.add(id);
      return id;
    });
  }
  return out;
}

export function sanitizeSave(raw) {
  if (!isPlainObject(raw)) return { ok: false, reason: "Save khong hop le." };
  const cp = raw.dungeonCheckpoint;
  if (cp?.v === 2 && cp.runId) {
    for (const skills of [cp.player?.skills, cp.runProgression?.skills, cp.runProgression?.acquiredSkills]) {
      if (isPlainObject(skills) && Object.values(skills).reduce((total, n) => total + (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0), 0) > 10) {
        return { ok: false, reason: 'Checkpoint vượt ngân sách 10 kỹ năng.' };
      }
    }
  }
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

  // Sổ tay quái vật: { [typeId]: { seen, killed, firstAt } }.
  // Validate từng bản ghi — chỉ giữ số hợp lệ, giới hạn số loại (không cho client
  // bơm hàng nghìn key rác vào save).
  const BESTIARY_MAX_TYPES = 64;
  const bestiary = {};
  if (raw.bestiary && typeof raw.bestiary === "object" && !Array.isArray(raw.bestiary)) {
    for (const [key, val] of Object.entries(raw.bestiary).slice(0, BESTIARY_MAX_TYPES)) {
      if (!val || typeof val !== "object" || Array.isArray(val)) continue;
      const id = safeId(key, 40);
      if (!id) continue;
      bestiary[id] = {
        seen: clampNum(val.seen, 0, 1e9, 0),
        killed: clampNum(val.killed, 0, 1e9, 0),
        firstAt: clampNum(val.firstAt, 0, 4102444800000, 0),
      };
    }
  }
  const bestiaryCollapsed = typeof raw.bestiaryCollapsed === "boolean" ? raw.bestiaryCollapsed : false;

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
    vipCoins: clampNum(raw.vipCoins, 0, 1e9, 0),
    aurocite: clampNum(raw.aurocite, 0, 1e9, 0),
    vipPasses: normalizeVipPasses(raw.vipPasses),
    stamina: clampNum(raw.stamina, 0, 1e9, 0),
    patrolExp: clampNum(raw.patrolExp, 0, 1e12, 0),
    playerLevel: clampNum(raw.playerLevel, 1, 999, 1),
    playerName: safeStr(raw.playerName, 24),
    selectedChapterIdx: clampNum(raw.selectedChapterIdx, 0, 99, 0),
    selectedHeroId: safeId(raw.selectedHeroId) || "alex",
    selectedWeaponId: safeId(raw.selectedWeaponId) || "bow",
    selectedPetId: safeId(raw.selectedPetId) || "spirit_sword",
    gearLevel: clampNum(raw.gearLevel, 1, 999, 1),
    activePreset: clampNum(raw.activePreset, 1, 6, 1),
    heroSkinIdx: clampNum(raw.heroSkinIdx, 0, 20, 0),
    sortMode: ["quality", "level", "slot"].includes(raw.sortMode) ? raw.sortMode : "quality",
    achievementFilter: ["all", "combat", "journey", "forge", "collect"].includes(raw.achievementFilter)
      ? raw.achievementFilter : "all",
    beginnerJourney: sanitizeBeginnerJourney(raw.beginnerJourney),
    season: sanitizeSeason(raw.season),
    dungeonCheckpoint: sanitizeDungeonCheckpoint(raw.dungeonCheckpoint),
    campaign50Version: clampNum(raw.campaign50Version, 0, 1, 0),
    runes: sanitizeNumericRecord(raw.runes, { max: 1e6 }),
    runeStones: sanitizeMixedRecord(raw.runeStones),
    runeIntroClaimed: raw.runeIntroClaimed === true,
    equippedRuneSlots: sanitizeRuneBoard(raw.equippedRuneSlots),
    runeQualityTier: RUNE_QUALITY_IDS.has(raw.runeQualityTier) ? raw.runeQualityTier : "normal",
    runeMythicEnchant: raw.runeMythicEnchant === true,
    runeEnchantments: Object.fromEntries(Object.entries(raw.runeEnchantments || {}).filter(([id,level]) => RUNE_IDS.includes(id) && RUNE_IDS.indexOf(id)>=13 && Number.isInteger(level) && level>=1 && level<=6)),
    artifactStars: sanitizeArtifactStars(raw.artifactStars),
    wishPityCount: clampNum(raw.wishPityCount, 0, 99, 0),
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
    bestiary,
    bestiaryCollapsed,
    achievementsUnlocked,
    achievementsClaimed,
    starterSkillIds,
    // Cờ chống tặng trùng vũ khí khởi đầu (tân thủ nhận sau phòng 1).
    starterWeaponGranted: raw.starterWeaponGranted === true,
    acquiredSkills: sanitizeNumericRecord(raw.acquiredSkills, { max: 1e6 }),
    equippedGear: sanitizeEquipped(raw.equippedGear),
    gearBag,
    presets,
    gearLoadouts,
    // ---- Vat pham suu tam & trang thai gacha (giu nguyen kieu: co array long ben trong) ----
    // chestKeys la OBJECT {silver_chest_key: n, ...}
    gearScrolls: sanitizeMixedRecord(raw.gearScrolls, { numericKeys: ['weapon', 'armor', 'helmet', 'ring', 'necklace', 'boots'] }),
    chestKeys: sanitizeMixedRecord(raw.chestKeys),
    wishTokens: clampNum(raw.wishTokens, 0, 1e9, 0),
    wikiOtherItems: sanitizeMixedRecord(raw.wikiOtherItems),
    // lastPullResults la ARRAY, gridRevealed la ARRAY -> phai giu nguyen mang.
    chestGachaState: sanitizeMixedRecord(raw.chestGachaState, { numericKeys: ['epicPity', 'sTierPity'] }),
    runeRuinsState: sanitizeMixedRecord(raw.runeRuinsState, { numericKeys: ['foundSturdyIcons', 'foundGloriousIcons', 'gridRewards'] }),
    wikiEventsState: sanitizeMixedRecord(raw.wikiEventsState),
  };

  // ---- Hệ thống mở rộng: chỉ ghi khi client có gửi ----
  // Xem ghi chú ở sanitizeModeBest: save cũ không có các key này thì giữ nguyên
  // hình dạng cũ, tránh việc mở hệ thống mới lại "tặng" dữ liệu mặc định.
  data.gameMode = GAME_MODE_IDS.has(raw.gameMode) ? raw.gameMode : "campaign";
  if ("modeBest" in raw) data.modeBest = sanitizeModeBest(raw.modeBest);
  if ("guild" in raw) data.guild = sanitizeGuild(raw.guild);
  if ("garden" in raw) data.garden = sanitizeGarden(raw.garden);
  if ("plinko" in raw) data.plinko = sanitizePlinko(raw.plinko);

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
