import '../public/campaign-config.js';
import '../public/campaign-rooms.js';
import '../public/campaign-skills.js';
const CampaignConfig = globalThis.ArtemisCampaignConfig;
const CampaignRooms = globalThis.ArtemisCampaignRooms;
const CampaignSkills = globalThis.ArtemisCampaignSkills;
// Campaign catalog — synced from public/index.html (CHAPTERS, tuning, enemy pools and biomes).
// Read-only admin projection; gameplay remains source of truth. tests/admin-campaign.test.mjs detects drift.
const ZODIAC_ENEMY_POOLS = [['dragon_whelp', 'obsidian_brute', 'spore_runner'], ['cloud_wisp', 'frost_sentinel', 'mire_shaman'], ['rift_stalker', 'star_wraith', 'eclipse_oracle'], ['sky_sentinel', 'nebula_herald', 'hive_guardian']];

const CHAPTERS = [
        {
          id: 1,
          name: 'Chương 1: Thánh Điện Nhật Luân',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Thánh Điện Nhật Luân và đối đầu Sư Vương Thái Dương trong vòng sao Sư Tử.',
          rooms: 15,
          floorColor1: '#46260f', floorColor2: '#090c1b', wallColor: '#fbbf24',
          enemyScale: 1.00,
          icon: '🦁', accent: '#fbbf24', accent2: '#fb923c', gradFrom: '#46260f', gradTo: '#090c1b',
          difficulty: 1, difficultyLabel: 'Tinh Giới — Sư Tử', themeName: 'Sư Tử',
          bossIcon: '🦁', bossName: 'Sư Vương Thái Dương',
          unlock: null,
          mapAsset: '/assets/map-ch12-zodiac-leo.svg',
          mapRegion: 'Thánh Điện Nhật Luân',
          mapTagline: 'Chòm sao Sư Tử thức giấc, mở lối vào Thánh Điện Nhật Luân.',
        },
        {
          id: 2,
          name: 'Chương 2: Hỏa Sơn Sừng Đỏ',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Hỏa Sơn Sừng Đỏ và đối đầu Hỏa Dương Chiến Vương trong vòng sao Bạch Dương.',
          rooms: 15,
          floorColor1: '#3b0b24', floorColor2: '#090c1b', wallColor: '#fb7185',
          enemyScale: 1.26,
          icon: '🐏', accent: '#fb7185', accent2: '#f97316', gradFrom: '#3b0b24', gradTo: '#090c1b',
          difficulty: 1, difficultyLabel: 'Tinh Giới — Bạch Dương', themeName: 'Bạch Dương',
          bossIcon: '🐏', bossName: 'Hỏa Dương Chiến Vương',
          unlock: { type: 'chapterWin', chapterId: 1, label: 'Thắng Chương 1' },
          mapAsset: '/assets/map-ch8-zodiac-aries.svg',
          mapRegion: 'Hỏa Sơn Sừng Đỏ',
          mapTagline: 'Chòm sao Bạch Dương thức giấc, mở lối vào Hỏa Sơn Sừng Đỏ.',
        },
        {
          id: 3,
          name: 'Chương 3: Thảo Nguyên Kim Giác',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Thảo Nguyên Kim Giác và đối đầu Kim Ngưu Cự Thần trong vòng sao Kim Ngưu.',
          rooms: 15,
          floorColor1: '#253119', floorColor2: '#090c1b', wallColor: '#fbbf24',
          enemyScale: 1.52,
          icon: '🐂', accent: '#fbbf24', accent2: '#84cc16', gradFrom: '#253119', gradTo: '#090c1b',
          difficulty: 1, difficultyLabel: 'Tinh Giới — Kim Ngưu', themeName: 'Kim Ngưu',
          bossIcon: '🐂', bossName: 'Kim Ngưu Cự Thần',
          unlock: { type: 'chapterWin', chapterId: 2, label: 'Thắng Chương 2' },
          mapAsset: '/assets/map-ch9-zodiac-taurus.svg',
          mapRegion: 'Thảo Nguyên Kim Giác',
          mapTagline: 'Chòm sao Kim Ngưu thức giấc, mở lối vào Thảo Nguyên Kim Giác.',
        },
        {
          id: 4,
          name: 'Chương 4: Song Thành Ảo Ảnh',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Song Thành Ảo Ảnh và đối đầu Song Tử Huyễn Vương trong vòng sao Song Tử.',
          rooms: 15,
          floorColor1: '#152746', floorColor2: '#090c1b', wallColor: '#67e8f9',
          enemyScale: 1.78,
          icon: '🎭', accent: '#67e8f9', accent2: '#a78bfa', gradFrom: '#152746', gradTo: '#090c1b',
          difficulty: 2, difficultyLabel: 'Tinh Giới — Song Tử', themeName: 'Song Tử',
          bossIcon: '🎭', bossName: 'Song Tử Huyễn Vương',
          unlock: { type: 'chapterWin', chapterId: 3, label: 'Thắng Chương 3' },
          mapAsset: '/assets/map-ch10-zodiac-gemini.svg',
          mapRegion: 'Song Thành Ảo Ảnh',
          mapTagline: 'Chòm sao Song Tử thức giấc, mở lối vào Song Thành Ảo Ảnh.',
        },
        {
          id: 5,
          name: 'Chương 5: Thủy Cung Nguyệt Triều',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Thủy Cung Nguyệt Triều và đối đầu Cự Giải Nguyệt Giáp trong vòng sao Cự Giải.',
          rooms: 15,
          floorColor1: '#082c44', floorColor2: '#090c1b', wallColor: '#38bdf8',
          enemyScale: 2.04,
          icon: '🦀', accent: '#38bdf8', accent2: '#a5f3fc', gradFrom: '#082c44', gradTo: '#090c1b',
          difficulty: 2, difficultyLabel: 'Tinh Giới — Cự Giải', themeName: 'Cự Giải',
          bossIcon: '🦀', bossName: 'Cự Giải Nguyệt Giáp',
          unlock: { type: 'chapterWin', chapterId: 4, label: 'Thắng Chương 4' },
          mapAsset: '/assets/map-ch11-zodiac-cancer.svg',
          mapRegion: 'Thủy Cung Nguyệt Triều',
          mapTagline: 'Chòm sao Cự Giải thức giấc, mở lối vào Thủy Cung Nguyệt Triều.',
        },
        {
          id: 6,
          name: 'Chương 6: Vườn Sao Trinh Nữ',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Vườn Sao Trinh Nữ và đối đầu Tinh Nữ Thánh Vệ trong vòng sao Xử Nữ.',
          rooms: 15,
          floorColor1: '#143329', floorColor2: '#090c1b', wallColor: '#d9f99d',
          enemyScale: 2.30,
          icon: '🌾', accent: '#d9f99d', accent2: '#5eead4', gradFrom: '#143329', gradTo: '#090c1b',
          difficulty: 2, difficultyLabel: 'Tinh Giới — Xử Nữ', themeName: 'Xử Nữ',
          bossIcon: '🌾', bossName: 'Tinh Nữ Thánh Vệ',
          unlock: { type: 'chapterWin', chapterId: 5, label: 'Thắng Chương 5' },
          mapAsset: '/assets/map-ch13-zodiac-virgo.svg',
          mapRegion: 'Vườn Sao Trinh Nữ',
          mapTagline: 'Chòm sao Xử Nữ thức giấc, mở lối vào Vườn Sao Trinh Nữ.',
        },
        {
          id: 7,
          name: 'Chương 7: Điện Cân Bằng',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Điện Cân Bằng và đối đầu Phán Quan Thiên Bình trong vòng sao Thiên Bình.',
          rooms: 15,
          floorColor1: '#32213f', floorColor2: '#090c1b', wallColor: '#f0abfc',
          enemyScale: 2.56,
          icon: '⚖️', accent: '#f0abfc', accent2: '#fbbf24', gradFrom: '#32213f', gradTo: '#090c1b',
          difficulty: 3, difficultyLabel: 'Tinh Giới — Thiên Bình', themeName: 'Thiên Bình',
          bossIcon: '⚖️', bossName: 'Phán Quan Thiên Bình',
          unlock: { type: 'chapterWin', chapterId: 6, label: 'Thắng Chương 6' },
          mapAsset: '/assets/map-ch14-zodiac-libra.svg',
          mapRegion: 'Điện Cân Bằng',
          mapTagline: 'Chòm sao Thiên Bình thức giấc, mở lối vào Điện Cân Bằng.',
        },
        {
          id: 8,
          name: 'Chương 8: Hoang Mạc Độc Tinh',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Hoang Mạc Độc Tinh và đối đầu Hạt Vương Độc Vĩ trong vòng sao Bọ Cạp.',
          rooms: 15,
          floorColor1: '#32152e', floorColor2: '#090c1b', wallColor: '#c084fc',
          enemyScale: 2.82,
          icon: '🦂', accent: '#c084fc', accent2: '#fb7185', gradFrom: '#32152e', gradTo: '#090c1b',
          difficulty: 3, difficultyLabel: 'Tinh Giới — Bọ Cạp', themeName: 'Bọ Cạp',
          bossIcon: '🦂', bossName: 'Hạt Vương Độc Vĩ',
          unlock: { type: 'chapterWin', chapterId: 7, label: 'Thắng Chương 7' },
          mapAsset: '/assets/map-ch15-zodiac-scorpio.svg',
          mapRegion: 'Hoang Mạc Độc Tinh',
          mapTagline: 'Chòm sao Bọ Cạp thức giấc, mở lối vào Hoang Mạc Độc Tinh.',
        },
        {
          id: 9,
          name: 'Chương 9: Thiên Lộ Xạ Thủ',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Thiên Lộ Xạ Thủ và đối đầu Nhân Mã Thần Xạ trong vòng sao Nhân Mã.',
          rooms: 15,
          floorColor1: '#1c2c4b', floorColor2: '#090c1b', wallColor: '#a5b4fc',
          enemyScale: 3.08,
          icon: '🏹', accent: '#a5b4fc', accent2: '#fbbf24', gradFrom: '#1c2c4b', gradTo: '#090c1b',
          difficulty: 3, difficultyLabel: 'Tinh Giới — Nhân Mã', themeName: 'Nhân Mã',
          bossIcon: '🏹', bossName: 'Nhân Mã Thần Xạ',
          unlock: { type: 'chapterWin', chapterId: 8, label: 'Thắng Chương 8' },
          mapAsset: '/assets/map-ch16-zodiac-sagittarius.svg',
          mapRegion: 'Thiên Lộ Xạ Thủ',
          mapTagline: 'Chòm sao Nhân Mã thức giấc, mở lối vào Thiên Lộ Xạ Thủ.',
        },
        {
          id: 10,
          name: 'Chương 10: Đỉnh Sơn Tinh Tú',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Đỉnh Sơn Tinh Tú và đối đầu Sơn Thần Ma Kết trong vòng sao Ma Kết.',
          rooms: 15,
          floorColor1: '#1b3444', floorColor2: '#090c1b', wallColor: '#7dd3fc',
          enemyScale: 3.34,
          icon: '🐐', accent: '#7dd3fc', accent2: '#e2e8f0', gradFrom: '#1b3444', gradTo: '#090c1b',
          difficulty: 4, difficultyLabel: 'Tinh Giới — Ma Kết', themeName: 'Ma Kết',
          bossIcon: '🐐', bossName: 'Sơn Thần Ma Kết',
          unlock: { type: 'chapterWin', chapterId: 9, label: 'Thắng Chương 9' },
          mapAsset: '/assets/map-ch17-zodiac-capricorn.svg',
          mapRegion: 'Đỉnh Sơn Tinh Tú',
          mapTagline: 'Chòm sao Ma Kết thức giấc, mở lối vào Đỉnh Sơn Tinh Tú.',
        },
        {
          id: 11,
          name: 'Chương 11: Hải Đài Thiên Thủy',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Hải Đài Thiên Thủy và đối đầu Thủy Sứ Bảo Bình trong vòng sao Bảo Bình.',
          rooms: 15,
          floorColor1: '#0e3150', floorColor2: '#090c1b', wallColor: '#22d3ee',
          enemyScale: 3.60,
          icon: '🏺', accent: '#22d3ee', accent2: '#818cf8', gradFrom: '#0e3150', gradTo: '#090c1b',
          difficulty: 4, difficultyLabel: 'Tinh Giới — Bảo Bình', themeName: 'Bảo Bình',
          bossIcon: '🏺', bossName: 'Thủy Sứ Bảo Bình',
          unlock: { type: 'chapterWin', chapterId: 10, label: 'Thắng Chương 10' },
          mapAsset: '/assets/map-ch18-zodiac-aquarius.svg',
          mapRegion: 'Hải Đài Thiên Thủy',
          mapTagline: 'Chòm sao Bảo Bình thức giấc, mở lối vào Hải Đài Thiên Thủy.',
        },
        {
          id: 12,
          name: 'Chương 12: Hải Vực Mộng Ảo',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Hải Vực Mộng Ảo và đối đầu Song Ngư Mộng Chủ trong vòng sao Song Ngư.',
          rooms: 15,
          floorColor1: '#152644', floorColor2: '#090c1b', wallColor: '#5eead4',
          enemyScale: 3.86,
          icon: '🐟', accent: '#5eead4', accent2: '#c084fc', gradFrom: '#152644', gradTo: '#090c1b',
          difficulty: 4, difficultyLabel: 'Tinh Giới — Song Ngư', themeName: 'Song Ngư',
          bossIcon: '🐟', bossName: 'Song Ngư Mộng Chủ',
          unlock: { type: 'chapterWin', chapterId: 11, label: 'Thắng Chương 11' },
          mapAsset: '/assets/map-ch19-zodiac-pisces.svg',
          mapRegion: 'Hải Vực Mộng Ảo',
          mapTagline: 'Chòm sao Song Ngư thức giấc, mở lối vào Hải Vực Mộng Ảo.',
        }
      ];

CHAPTERS.forEach(ch => {
  ch.rooms = CampaignConfig.ROOM_COUNT;
  ch.modeLabel = 'Chiến Dịch 50 Phòng';
  ch.desc = 'Vượt qua 50 phòng với độ khó tăng dần, hạ 4 trùm phụ và đối đầu ' + ch.bossName + ' ở phòng 50. Gặp Valkyrie mỗi 5 phòng đến phòng 45.';
});

const CAMPAIGN_TUNING = {
        //        HP quái nền  ATK quái nền  HP trùm   ATK trùm
        1: { mobHp: 300, mobAtk: 70, bossHp: 5200, bossAtk: 190 },
        2: { mobHp: 520, mobAtk: 95, bossHp: 9000, bossAtk: 260 },
        3: { mobHp: 820, mobAtk: 130, bossHp: 15000, bossAtk: 350 },
        4: { mobHp: 1250, mobAtk: 220, bossHp: 33000, bossAtk: 460 },
        5: { mobHp: 1750, mobAtk: 380, bossHp: 34000, bossAtk: 600 },
        6: { mobHp: 2400, mobAtk: 520, bossHp: 48000, bossAtk: 760 },
        7: { mobHp: 3100, mobAtk: 660, bossHp: 62000, bossAtk: 930 },
        8: { mobHp: 3800, mobAtk: 820, bossHp: 76000, bossAtk: 1160 },
        9: { mobHp: 4408, mobAtk: 935, bossHp: 88920, bossAtk: 1322 },
        10: { mobHp: 5113, mobAtk: 1066, bossHp: 104036, bossAtk: 1508 },
        11: { mobHp: 5931, mobAtk: 1215, bossHp: 121723, bossAtk: 1719 },
        12: { mobHp: 6880, mobAtk: 1385, bossHp: 142415, bossAtk: 1959 },
      };

const POOLS = {
    1: ['zodiac_leo'],
    2: ['zodiac_aries'],
    3: ['zodiac_taurus'],
    4: ['zodiac_gemini'],
    5: ['zodiac_cancer'],
    6: ['zodiac_virgo'],
    7: ['zodiac_libra'],
    8: ['zodiac_scorpio'],
    9: ['zodiac_sagittarius'],
    10: ['zodiac_capricorn'],
    11: ['zodiac_aquarius'],
    12: ['zodiac_pisces']
  };

const BOSS_ARENA = { golem: 'forge', queen: 'webcave', demon_king: 'throne', elder_dragon: 'dragon_altar', eclipse_sovereign: 'eclipse_throne', astral_devourer: 'abyss_crown', mycelium_queen: 'mycelium_heart', zodiac_aries: 'zodiac_aries', zodiac_taurus: 'zodiac_taurus', zodiac_gemini: 'zodiac_gemini', zodiac_cancer: 'zodiac_cancer', zodiac_leo: 'zodiac_leo', zodiac_virgo: 'zodiac_virgo', zodiac_libra: 'zodiac_libra', zodiac_scorpio: 'zodiac_scorpio', zodiac_sagittarius: 'zodiac_sagittarius', zodiac_capricorn: 'zodiac_capricorn', zodiac_aquarius: 'zodiac_aquarius', zodiac_pisces: 'zodiac_pisces' };

const ZODIAC_IDS = ['leo', 'aries', 'taurus', 'gemini', 'cancer', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const DEFAULT_ENEMIES = ['slime', 'goblin', 'skeleton_mage', 'plant_turret', 'bat'];
const ENEMY_MULTIPLIER = { hive_guardian: 1.3, mire_shaman: 1.14, spore_runner: 0.92, obsidian_brute: 1.28, eclipse_oracle: 1.16, rift_stalker: 1.04, sky_sentinel: 1.25, cloud_wisp: 0.96, dragon_whelp: 1.08, plant_turret: 1.23, skeleton_mage: 1.12 };
const ENEMY_SPEED = { spore_runner: 112, mire_shaman: 52, hive_guardian: 42, plant_turret: 0, bat: 115, rift_stalker: 102, eclipse_oracle: 55, obsidian_brute: 38, dragon_whelp: 88, cloud_wisp: 92, sky_sentinel: 48 };
const ENEMY_RADIUS = { hive_guardian: 20, mire_shaman: 17, spore_runner: 14, bat: 13, cloud_wisp: 14, sky_sentinel: 19, obsidian_brute: 19, rift_stalker: 14 };
const ENEMY_NAMES = {
  slime:'Slime',goblin:'Goblin',skeleton_mage:'Pháp sư xương',plant_turret:'Thực vật bắn đạn',bat:'Dơi',
  dragon_whelp:'Rồng con',cloud_wisp:'Linh hồn mây',sky_sentinel:'Vệ binh trời',
  rift_stalker:'Kẻ săn khe nứt',eclipse_oracle:'Tiên tri nhật thực',obsidian_brute:'Dã thú hắc diệu',
  nebula_herald:'Sứ giả tinh vân',frost_sentinel:'Vệ binh băng',star_wraith:'Oán linh sao',
  spore_runner:'Quái bào tử',mire_shaman:'Pháp sư đầm lầy',hive_guardian:'Vệ binh tổ kén'
};
const BOSS_NAMES = {
  golem:'Golem Dung Nham',queen:'Nữ Hoàng Nhện Độc',demon_king:'Đại Ma Vương Atreus',
  elder_dragon:'Cổ Long Thiên Không',eclipse_sovereign:'Bạo Chúa Nhật Thực',
  astral_devourer:'Thực Thần Tinh Hà',mycelium_queen:'Nữ Hoàng Sợi Nấm'
};

function enemiesForChapter(id) {
  if (id >= 1 && id <= 12) return ZODIAC_ENEMY_POOLS[(id - 1) % ZODIAC_ENEMY_POOLS.length];
  return DEFAULT_ENEMIES;
}
function bossName(ch, type) { return BOSS_NAMES[type] || ch.bossName || type; }
export function getCampaignSummaries() {
  return CHAPTERS.map(ch => ({
    id:ch.id,name:ch.name,rooms:ch.rooms,desc:ch.desc,icon:ch.icon,
    difficulty:ch.difficulty,difficultyLabel:ch.difficultyLabel,themeName:ch.themeName,
    mapAsset:ch.mapAsset,mapRegion:ch.mapRegion,mapTagline:ch.mapTagline,accent:ch.accent,
    unlockChapter:ch.unlock?.chapterId ?? null,bossName:ch.bossName,
    base:CAMPAIGN_TUNING[ch.id],
  }));
}
export function getCampaignDetail(id) {
  const ch = CHAPTERS.find(c=>c.id===Number(id));
  if (!ch) return null;
  const t=CAMPAIGN_TUNING[ch.id];
  if (!t) return null;
  const rooms = [];
  for(let room=1;room<=ch.rooms;room++) {
    const plan=CampaignRooms.roomPlan(ch.id,room);
    const roster=CampaignRooms.getRoster(ch.id,room);
    const { isBoss }=plan;
    const { depth,mobHp,mobAtk,bossHp,bossAtk }=CampaignConfig.tuning(t,room);
    const boss=plan.bossType;
    const k=room-Math.floor(room/10)-1;
    const biome=isBoss?BOSS_ARENA[boss]:(POOLS[ch.id]||[])[k % (POOLS[ch.id]||[]).length]||'stone';
    const count=roster.length;
    // Giữ từng vị trí để quái tinh anh và quái thường cùng loại không bị gộp sai chỉ số.
    const entities=roster.map((entry,index)=>{
      const type=entry.type, modifiers=CampaignRooms.getModifiers(ch.id,room,index);
      const variant=modifiers.bossVariant;
      const typeHp=isBoss?1:(ENEMY_MULTIPLIER[type]||1);
      const baseHp=Math.max(1,Math.round((isBoss?bossHp:mobHp)*typeHp));
      const baseAtk=isBoss?Math.max(1,bossAtk):Math.max(1,Math.round(mobAtk/Math.max(1,Math.sqrt(count/3))));
      const baseSpeed=isBoss?(type.startsWith('zodiac_')?70:type==='mycelium_queen'?72:type==='eclipse_sovereign'?76:68):(ENEMY_SPEED[type]??64);
      return {...entry,quantity:1,modifiers,
        name:variant?variant.name:isBoss?bossName(ch,type):(ENEMY_NAMES[type]||type),
        color:variant?.color,
        hp:Math.max(1,Math.round(baseHp*modifiers.hpMultiplier)),
        atk:Math.max(1,Math.round(baseAtk*modifiers.atkMultiplier)),
        speed:baseSpeed*modifiers.speedMultiplier,
        radius:(isBoss?34:(ENEMY_RADIUS[type]||16))*modifiers.sizeMultiplier,
        hpMultiplier:typeHp*modifiers.hpMultiplier};
    });
    rooms.push({
      ...plan,biome,depth:Number(depth.toFixed(4)),count,mobHp,mobAtk,bossHp,bossAtk,
      pressure:roster.reduce((sum,e)=>sum+e.pressure,0),
      eliteCount:roster.filter(e=>e.isElite).length,
      rarityRates:CampaignSkills.rarityWeights(plan.segment,false),
      mobs:isBoss?[]:entities,boss:isBoss?entities[0]:null
    });
  }
  const enemyRoster=Array.from(new Set(rooms.flatMap(r=>r.mobs.map(m=>m.type)))).map(type=>{
    const samples=rooms.flatMap(r=>r.mobs);
    const sample=samples.find(m=>m.type===type&&!m.isElite)||samples.find(m=>m.type===type);
    return {...sample,sampleRoom:rooms.find(r=>r.mobs.includes(sample)).room};
  });
  return {
    ...getCampaignSummaries().find(c=>c.id===ch.id),
    modeLabel:ch.modeLabel,enemyScale:ch.enemyScale,
    valkyrieRooms:rooms.filter(r=>r.valkyrie).map(r=>r.room),
    skillRarities:Array.from(CampaignConfig.SKILL_RARITIES),
    enemyRoster,
    bosses:rooms.filter(r=>r.isBoss).map(r=>({room:r.room,...r.boss})),
    roomsDetail:rooms,
    formulas:{
      mobHp:'round(round(baseMobHp × (1 + depth × 1.2)) × typeMultiplier), rồi round(HP × eliteHpMultiplier)',
      mobAtk:'round(round(baseMobAtk × (1 + depth × 0.5)) ÷ max(1, √(count / 3))), rồi round(ATK × eliteAtkMultiplier)',
      bossHp:'round(round(baseBossHp × (1 + depth × 0.35)) × bossMultiplier)',
      bossAtk:'round(baseBossAtk × (1 + depth × 0.3))',
      depth:'(room - 1) / (50 - 1)',count:'ArtemisCampaignRooms.getRoster(chapterId, room).length',
      speed:'baseSpeed × modifiers.speedMultiplier',radius:'baseRadius × modifiers.sizeMultiplier'
    }
  };
}
