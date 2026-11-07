// ==================== TRẠNG THÁI KHỞI TẠO CHUẨN (SERVER-SIDE) ====================
//
// Vì sao cần file này:
// Trước bản vá, tài khoản mới KHÔNG có save trên máy chủ. Client tự dựng save
// tân thủ rồi PUT lần đầu (revision 0). Server không có mốc nào để biết "tân
// thủ" là bao nhiêu tài nguyên, nên bất kỳ ai gọi thẳng API cũng khai được
// vàng/đá quý trong trần cứng (xem lib/economy.js).
//
// Nay tài khoản tạo sau bản vá được đánh dấu `initVersion` và được cấp sẵn một
// snapshot chuẩn do server sinh. Nhờ vậy:
//   • Client không còn quyền quyết định trạng thái khởi tạo.
//   • PUT revision 0 trên tài khoản đã đánh dấu bị từ chối (SAVE_MISSING) thay
//     vì nhận payload tự khai.
//   • Nếu bản ghi save bị thất lạc, GET khôi phục lại đúng seed chuẩn thay vì
//     để client ghi đè.
//
// Người chơi CŨ (không có initVersion) giữ nguyên đường cũ: save hiện có của họ
// không bị chạm tới, và save thiếu snapshot vẫn đi theo luồng legacy.
//
// LƯU Ý QUAN TRỌNG: seed này chỉ chặn phần "khởi tạo". Nó KHÔNG chứng minh
// được nguồn gốc của vàng/đá quý ở các lần lưu sau — việc đó cần
// server-authoritative reward ledger (xem docs/audit/artemis-new-player/08).

import { sanitizeSave } from "./saveSchema.js";
import { freshLedger } from "./economyLedger.js";

/** Phiên bản seed. Tăng khi cấu hình tân thủ thay đổi có chủ đích. */
export const NEW_ACCOUNT_INIT_VERSION = 1;

// Roster hero tại thời điểm bản vá. Giữ khớp với HEROES trong public/index.html;
// tests/canonical-new-account.test.mjs sẽ fail nếu hai bên lệch nhau.
const HERO_IDS = [
  "thor", "wukong", "cleo", "atreus", "rolla", "nezha", "otta", "hou_yi",
  "phynx", "loki", "dracoola", "seraph", "mymu", "hela", "helix", "nyanja",
  "alex", "artemis",
];

const zeroHeroRecord = () => Object.fromEntries(HERO_IDS.map((id) => [id, 0]));

/**
 * Snapshot tân thủ chuẩn, ĐÃ qua sanitizeSave nên đúng bằng hình dạng mà
 * PUT /api/save sẽ lưu và SaveState.load() sẽ đọc.
 *
 * @param {{ now?: number }} [options]
 * @returns {object} data của document save
 */
export function buildCanonicalNewAccountData({ now = Date.now() } = {}) {
  const raw = {
    // Phiên bản: phải có để SaveState.load() KHÔNG chạy migration cứu hộ
    // (migration cũ từng cấp 9.999.999 vàng cho mọi save thiếu cờ).
    maxedAllVersion: 1,
    artemisHeroVersion: 1,
    wikiCharactersVersion: 2,

    // Tài nguyên khởi đầu — khớp SaveState defaults trong public/index.html.
    gold: 500,
    gems: 50,
    vipCoins: 0,
    stamina: 20,
    playerLevel: 1,
    playerName: "JohnBowman",

    selectedChapterIdx: 0,
    gameMode: "campaign",
    modeBest: {},
    guild: null,
    garden: null,
    plinko: null,
    season: null,

    selectedHeroId: "alex",
    selectedWeaponId: "bow",
    selectedPetId: "spirit_sword",
    gearLevel: 1,
    activePreset: 1,
    heroSkinIdx: 0,
    resonanceSlots: { slot1: null, slot2: null },
    starterSkillIds: [],
    starterWeaponGranted: false,

    sortMode: "quality",
    achievementFilter: "all",

    // Tân thủ bắt đầu tay không: mọi slot null, túi rỗng.
    equippedGear: { weapon: null, necklace: null, ring: null, armor: null, helmet: null, boots: null },
    gearBag: [],
    gemInventory: { ruby: 0, sapphire: 0, amethyst: 0, emerald: 0, topaz: 0 },
    salvageMaterials: 0,
    presets: {
      1: { weapon: null, necklace: null, ring: null, armor: null, helmet: null, boots: null },
      2: { weapon: null, necklace: null, ring: null, armor: null, helmet: null, boots: null },
      3: { weapon: null, necklace: null, ring: null, armor: null, helmet: null, boots: null },
    },
    gearLoadouts: {},

    runes: { rune_flame: 0, rune_frost: 0, rune_thunder: 0, rune_valkyrie: 0 },
    talents: { might: 0, vitality: 0, alacrity: 0, healer: 0, greed: 0, valkyrie_favor: 0 },

    heroStars: zeroHeroRecord(),
    heroShards: zeroHeroRecord(),
    heroSelectedSkins: zeroHeroRecord(),
    unlockedSkins: { artemis_default: true },

    bestRooms: {},
    lifetimeStats: {
      kills: 0, bossKills: 0, roomsCleared: 0, runs: 0, wins: 0,
      deepestRoom: 1, goldEarned: 0, merges: 0, talentDraws: 0,
      chestPulls: 0, skillsPicked: 0, chaptersCleared: 0, flawlessRooms: 0,
    },
    winsByChapter: {},
    bestiary: {},
    achievementsUnlocked: {},
    achievementsClaimed: {},

    // Tutorial ACTIVE ngay trong save, không phụ thuộc vào việc client kịp gọi
    // activateBeginnerJourney() sau khi đăng ký. Nhờ vậy reload / mất mạng /
    // đăng nhập lại vẫn còn N01.
    beginnerJourney: {
      version: 1,
      startedAt: now,
      completedAt: 0,
      skipped: false,
      currentStep: "N01",
      completedSteps: [],
      claimedRewards: [],
      isCompleted: false,
      _lootCount: 0,
    },

    dungeonCheckpoint: null,
  };

  const check = sanitizeSave(raw);
  if (!check.ok) {
    // Sai ở đây là lỗi lập trình của seed, không phải dữ liệu người chơi.
    throw new Error(`Canonical seed khong hop le: ${check.reason}`);
  }
  return check.data;
}

/**
 * Document save chuẩn cho tài khoản mới.
 * @param {{ playerId: string, username: string, now?: Date }} params
 */
export function buildCanonicalNewAccountSave({ playerId, username, now = new Date() }) {
  return {
    playerId: String(playerId),
    username,
    data: buildCanonicalNewAccountData({ now: now.getTime() }),
    // Ngân sách kinh tế khởi tạo đầy dự trữ để trận đầu tiên không bị chặn oan.
    ledger: freshLedger(now.getTime()),
    revision: 1,
    seededBy: `canonical-v${NEW_ACCOUNT_INIT_VERSION}`,
    createdAt: now,
    updatedAt: now,
    updatedIp: "",
  };
}
