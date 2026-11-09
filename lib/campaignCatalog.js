import '../public/campaign-config.js';
const CampaignConfig = globalThis.ArtemisCampaignConfig;
// Campaign catalog — synced from public/index.html (CHAPTERS, tuning, enemy pools and biomes).
// Read-only admin projection; gameplay remains source of truth. tests/admin-campaign.test.mjs detects drift.
const ZODIAC_ENEMY_POOLS = [['dragon_whelp', 'obsidian_brute', 'spore_runner'], ['cloud_wisp', 'frost_sentinel', 'mire_shaman'], ['rift_stalker', 'star_wraith', 'eclipse_oracle'], ['sky_sentinel', 'nebula_herald', 'hive_guardian']];

const CHAPTERS = [
        {
          id: 1,
          name: 'Chương 1: Hầm Ngục Đá Cổ',
          modeLabel: 'Chế độ Vượt Phòng Cổ Điển (15 Phòng)',
          desc: 'Dừng di chuyển để tự động khóa mục tiêu và bắn tên. Vượt qua 15 phòng quái vật và đánh bại Trùm Golem Dung Nham!',
          rooms: 15,
          floorColor1: '#1e293b',
          floorColor2: '#172033',
          wallColor: '#334155',
          enemyScale: 1.0,
          icon: '🏰',
          accent: '#38bdf8',
          accent2: '#0ea5e9',
          gradFrom: '#0c4a6e',
          gradTo: '#082f49',
          difficulty: 1,
          difficultyLabel: 'Dễ — Tân Thủ',
          themeName: 'Đá Cổ',
          bossIcon: '🔥',
          bossName: 'Golem Dung Nham',
          unlock: null,
          // Ảnh minh hoạ bản đồ (SVG nội bộ, không phụ thuộc URL ngoài).
          mapAsset: '/assets/map-ch1-ancient-stone.svg',
          mapRegion: 'Hầm Ngục Đá Cổ',
          mapTagline: 'Cổng đá ngàn năm chưa từng mở. Hơi lạnh từ lòng đất thổi lên.',
        },
        {
          id: 2,
          name: 'Chương 2: Thung Lũng Dung Nham',
          modeLabel: 'Chế độ Sinh Tồn Đợt Quái (12 Phòng Nhanh)',
          desc: 'Quái vật hung hãn hơn với đạn lửa và tốc độ di chuyển cao. Đánh bại Nữ Hoàng Nhện Độc ở phòng 6 và Trùm Cuối ở phòng 12!',
          rooms: 12,
          floorColor1: '#2a1810',
          floorColor2: '#1f120b',
          wallColor: '#7c2d12',
          enemyScale: 1.45,
          icon: '🌋',
          accent: '#fb923c',
          accent2: '#ea580c',
          gradFrom: '#7c2d12',
          gradTo: '#431407',
          difficulty: 2,
          difficultyLabel: 'Thường — Cần Trang Bị',
          themeName: 'Dung Nham',
          bossIcon: '🕷️',
          bossName: 'Nữ Hoàng Nhện Độc',
          unlock: { type: 'chapterWin', chapterId: 1, label: 'Thắng Chương 1' },
          mapAsset: '/assets/map-ch2-lava-valley.svg',
          mapRegion: 'Thung Lũng Dung Nham',
          mapTagline: 'Đất nứt ra từng thớ, dung nham chảy như mạch máu của núi lửa.',
        },
        {
          id: 3,
          name: 'Chương 3: Thánh Điện Hư Không',
          modeLabel: 'Chế độ Thử Thách Đại Ma Vương (10 Phòng Tinh Anh)',
          desc: 'Đấu trường khắc nghiệt nhất của Archero 2! Quái tinh anh và Đại Ma Vương Atreus chờ đón bạn với phần thưởng gấp đôi.',
          rooms: 10,
          floorColor1: '#1e1b4b',
          floorColor2: '#151236',
          wallColor: '#4c1d95',
          enemyScale: 2.0,
          icon: '🌌',
          accent: '#c084fc',
          accent2: '#a855f7',
          gradFrom: '#4c1d95',
          gradTo: '#2e1065',
          difficulty: 3,
          difficultyLabel: 'Ác Mộng — Trang Bị Cao',
          themeName: 'Hư Không',
          bossIcon: '👑',
          bossName: 'Đại Ma Vương Atreus',
          unlock: { type: 'chapterWin', chapterId: 2, label: 'Thắng Chương 2' },
          mapAsset: '/assets/map-ch3-void-sanctum.svg',
          mapRegion: 'Thánh Điện Hư Không',
          mapTagline: 'Không có mặt trời, chỉ có cổng dịch chuyển và tiếng thì thầm.',
        },
        {
          id: 4,
          name: 'Chương 4: Long Vực Thiên Không',
          modeLabel: 'Chiến Dịch Long Tộc (15 Phòng Thần Thoại)',
          desc: 'Băng qua quần đảo lơ lửng, đánh bại long duệ canh giữ và đối đầu Cổ Long Thiên Không trong Điện Long Thần.',
          rooms: 15,
          floorColor1: '#082f49',
          floorColor2: '#0c2340',
          wallColor: '#155e75',
          enemyScale: 2.35,
          icon: '🐉',
          accent: '#67e8f9',
          accent2: '#38bdf8',
          gradFrom: '#164e63',
          gradTo: '#082f49',
          difficulty: 3,
          difficultyLabel: 'Thần Thoại — Long Tộc',
          themeName: 'Long Vực',
          bossIcon: '🐲',
          bossName: 'Cổ Long Thiên Không',
          unlock: { type: 'chapterWin', chapterId: 3, label: 'Thắng Chương 3' },
          mapAsset: '/assets/map-ch4-dragon-realm.svg',
          mapRegion: 'Long Vực Thiên Không',
          mapTagline: 'Quần đảo rồng lơ lửng giữa biển mây, nơi long hồn thức tỉnh.',
        },
        {
          id: 5,
          name: 'Chương 5: Vương Quốc Nhật Thực',
          modeLabel: 'Chiến Dịch Hắc Tinh (15 Phòng Dị Giới)',
          desc: 'Băng qua thành trì obsidian, khe nứt hư không và khu vườn hắc tinh. Đánh bại Bạo Chúa Nhật Thực trước khi bóng tối nuốt chửng toàn cõi.',
          rooms: 15,
          floorColor1: '#170d2b',
          floorColor2: '#090817',
          wallColor: '#4c1d5f',
          enemyScale: 2.62,
          icon: '🌑',
          accent: '#c084fc',
          accent2: '#8b5cf6',
          gradFrom: '#3b0764',
          gradTo: '#090817',
          difficulty: 4,
          difficultyLabel: 'Huyền Thoại — Dị Giới',
          themeName: 'Nhật Thực',
          bossIcon: '🌑',
          bossName: 'Bạo Chúa Nhật Thực',
          unlock: { type: 'chapterWin', chapterId: 4, label: 'Thắng Chương 4' },
          mapAsset: '/assets/map-ch5-eclipse-kingdom.svg',
          mapRegion: 'Vương Quốc Nhật Thực',
          mapTagline: 'Khi mặt trời tắt lịm, ngai vàng hắc tinh thức tỉnh giữa những vết nứt không gian.',
        },
        {
          id: 6,
          name: 'Chương 6: Vực Thẳm Thiên Hà',
          modeLabel: 'Thập Tự Chinh Tinh Hà (15 Phòng Hư Không)',
          desc: 'Băng qua cổng tinh vân, ca đoàn băng giá và ngai sao lưu lạc. Chạm mặt Thực Thần Tinh Hà — kẻ nuốt ánh sáng của cả một thiên hà.',
          rooms: 15,
          floorColor1: '#0e1633',
          floorColor2: '#05081a',
          wallColor: '#1f3a6e',
          enemyScale: 2.95,
          icon: '🌌',
          accent: '#818cf8',
          accent2: '#22d3ee',
          gradFrom: '#1e1b4b',
          gradTo: '#05081a',
          difficulty: 5,
          difficultyLabel: 'Thần Thoại — Hư Không',
          themeName: 'Thiên Hà',
          bossIcon: '🌌',
          bossName: 'Thực Thần Tinh Hà',
          unlock: { type: 'chapterWin', chapterId: 5, label: 'Thắng Chương 5' },
          mapAsset: '/assets/map-ch6-abyssal-galaxy.svg',
          mapRegion: 'Vực Thẳm Thiên Hà',
          mapTagline: 'Nơi ánh sáng không thoát ra được, và mọi vì sao đều là mồi của bóng tối.',
        },
        {
          id: 7,
          name: 'Chương 7: Mê Lâm Bào Tử', modeLabel: 'Hành Trình Rừng Kén (15 Phòng)',
          desc: 'Băng qua rừng nấm phát quang, đầm bào tử và tổ kén. Né đạn xoáy, quạt độc và đường đạn đan xen của Nữ Hoàng Sợi Nấm.',
          rooms: 15,
          floorColor1: '#102c2c', floorColor2: '#120f27', wallColor: '#3d3154',
          enemyScale: 3.2,
          icon: '🍄', accent: '#5eead4', accent2: '#a3e635', gradFrom: '#134e4a', gradTo: '#1b112b',
          difficulty: 5, difficultyLabel: 'Thần Thoại — Bào Tử', themeName: 'Mê Lâm',
          bossIcon: '👑', bossName: 'Nữ Hoàng Sợi Nấm',
          unlock: { type: 'chapterWin', chapterId: 6, label: 'Thắng Chương 6' },
          mapAsset: '/assets/map-ch7-mycelium-forest.svg', mapRegion: 'Mê Lâm Bào Tử',
          mapTagline: 'Ánh nấm dẫn đường qua đầm sương, đến trái tim của mạng sợi dưới lòng đất.',
        },
        {
          id: 8,
          name: 'Chương 8: Hỏa Sơn Sừng Đỏ',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Hỏa Sơn Sừng Đỏ và đối đầu Hỏa Dương Chiến Vương trong vòng sao Bạch Dương.',
          rooms: 15,
          floorColor1: '#3b0b24', floorColor2: '#090c1b', wallColor: '#fb7185',
          enemyScale: 3.40,
          icon: '🐏', accent: '#fb7185', accent2: '#f97316', gradFrom: '#3b0b24', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Bạch Dương', themeName: 'Bạch Dương',
          bossIcon: '🐏', bossName: 'Hỏa Dương Chiến Vương',
          unlock: { type: 'chapterWin', chapterId: 7, label: 'Thắng Chương 7' },
          mapAsset: '/assets/map-ch8-zodiac-aries.svg',
          mapRegion: 'Hỏa Sơn Sừng Đỏ',
          mapTagline: 'Chòm sao Bạch Dương thức giấc, mở lối vào Hỏa Sơn Sừng Đỏ.',
        },
        {
          id: 9,
          name: 'Chương 9: Thảo Nguyên Kim Giác',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Thảo Nguyên Kim Giác và đối đầu Kim Ngưu Cự Thần trong vòng sao Kim Ngưu.',
          rooms: 15,
          floorColor1: '#253119', floorColor2: '#090c1b', wallColor: '#fbbf24',
          enemyScale: 3.60,
          icon: '🐂', accent: '#fbbf24', accent2: '#84cc16', gradFrom: '#253119', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Kim Ngưu', themeName: 'Kim Ngưu',
          bossIcon: '🐂', bossName: 'Kim Ngưu Cự Thần',
          unlock: { type: 'chapterWin', chapterId: 8, label: 'Thắng Chương 8' },
          mapAsset: '/assets/map-ch9-zodiac-taurus.svg',
          mapRegion: 'Thảo Nguyên Kim Giác',
          mapTagline: 'Chòm sao Kim Ngưu thức giấc, mở lối vào Thảo Nguyên Kim Giác.',
        },
        {
          id: 10,
          name: 'Chương 10: Song Thành Ảo Ảnh',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Song Thành Ảo Ảnh và đối đầu Song Tử Huyễn Vương trong vòng sao Song Tử.',
          rooms: 15,
          floorColor1: '#152746', floorColor2: '#090c1b', wallColor: '#67e8f9',
          enemyScale: 3.80,
          icon: '🎭', accent: '#67e8f9', accent2: '#a78bfa', gradFrom: '#152746', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Song Tử', themeName: 'Song Tử',
          bossIcon: '🎭', bossName: 'Song Tử Huyễn Vương',
          unlock: { type: 'chapterWin', chapterId: 9, label: 'Thắng Chương 9' },
          mapAsset: '/assets/map-ch10-zodiac-gemini.svg',
          mapRegion: 'Song Thành Ảo Ảnh',
          mapTagline: 'Chòm sao Song Tử thức giấc, mở lối vào Song Thành Ảo Ảnh.',
        },
        {
          id: 11,
          name: 'Chương 11: Thủy Cung Nguyệt Triều',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Thủy Cung Nguyệt Triều và đối đầu Cự Giải Nguyệt Giáp trong vòng sao Cự Giải.',
          rooms: 15,
          floorColor1: '#082c44', floorColor2: '#090c1b', wallColor: '#38bdf8',
          enemyScale: 4.00,
          icon: '🦀', accent: '#38bdf8', accent2: '#a5f3fc', gradFrom: '#082c44', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Cự Giải', themeName: 'Cự Giải',
          bossIcon: '🦀', bossName: 'Cự Giải Nguyệt Giáp',
          unlock: { type: 'chapterWin', chapterId: 10, label: 'Thắng Chương 10' },
          mapAsset: '/assets/map-ch11-zodiac-cancer.svg',
          mapRegion: 'Thủy Cung Nguyệt Triều',
          mapTagline: 'Chòm sao Cự Giải thức giấc, mở lối vào Thủy Cung Nguyệt Triều.',
        },
        {
          id: 12,
          name: 'Chương 12: Thánh Điện Nhật Luân',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Thánh Điện Nhật Luân và đối đầu Sư Vương Thái Dương trong vòng sao Sư Tử.',
          rooms: 15,
          floorColor1: '#46260f', floorColor2: '#090c1b', wallColor: '#fbbf24',
          enemyScale: 4.20,
          icon: '🦁', accent: '#fbbf24', accent2: '#fb923c', gradFrom: '#46260f', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Sư Tử', themeName: 'Sư Tử',
          bossIcon: '🦁', bossName: 'Sư Vương Thái Dương',
          unlock: { type: 'chapterWin', chapterId: 11, label: 'Thắng Chương 11' },
          mapAsset: '/assets/map-ch12-zodiac-leo.svg',
          mapRegion: 'Thánh Điện Nhật Luân',
          mapTagline: 'Chòm sao Sư Tử thức giấc, mở lối vào Thánh Điện Nhật Luân.',
        },
        {
          id: 13,
          name: 'Chương 13: Vườn Sao Trinh Nữ',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Vườn Sao Trinh Nữ và đối đầu Tinh Nữ Thánh Vệ trong vòng sao Xử Nữ.',
          rooms: 15,
          floorColor1: '#143329', floorColor2: '#090c1b', wallColor: '#d9f99d',
          enemyScale: 4.40,
          icon: '🌾', accent: '#d9f99d', accent2: '#5eead4', gradFrom: '#143329', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Xử Nữ', themeName: 'Xử Nữ',
          bossIcon: '🌾', bossName: 'Tinh Nữ Thánh Vệ',
          unlock: { type: 'chapterWin', chapterId: 12, label: 'Thắng Chương 12' },
          mapAsset: '/assets/map-ch13-zodiac-virgo.svg',
          mapRegion: 'Vườn Sao Trinh Nữ',
          mapTagline: 'Chòm sao Xử Nữ thức giấc, mở lối vào Vườn Sao Trinh Nữ.',
        },
        {
          id: 14,
          name: 'Chương 14: Điện Cân Bằng',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Điện Cân Bằng và đối đầu Phán Quan Thiên Bình trong vòng sao Thiên Bình.',
          rooms: 15,
          floorColor1: '#32213f', floorColor2: '#090c1b', wallColor: '#f0abfc',
          enemyScale: 4.60,
          icon: '⚖️', accent: '#f0abfc', accent2: '#fbbf24', gradFrom: '#32213f', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Thiên Bình', themeName: 'Thiên Bình',
          bossIcon: '⚖️', bossName: 'Phán Quan Thiên Bình',
          unlock: { type: 'chapterWin', chapterId: 13, label: 'Thắng Chương 13' },
          mapAsset: '/assets/map-ch14-zodiac-libra.svg',
          mapRegion: 'Điện Cân Bằng',
          mapTagline: 'Chòm sao Thiên Bình thức giấc, mở lối vào Điện Cân Bằng.',
        },
        {
          id: 15,
          name: 'Chương 15: Hoang Mạc Độc Tinh',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Hoang Mạc Độc Tinh và đối đầu Hạt Vương Độc Vĩ trong vòng sao Bọ Cạp.',
          rooms: 15,
          floorColor1: '#32152e', floorColor2: '#090c1b', wallColor: '#c084fc',
          enemyScale: 4.80,
          icon: '🦂', accent: '#c084fc', accent2: '#fb7185', gradFrom: '#32152e', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Bọ Cạp', themeName: 'Bọ Cạp',
          bossIcon: '🦂', bossName: 'Hạt Vương Độc Vĩ',
          unlock: { type: 'chapterWin', chapterId: 14, label: 'Thắng Chương 14' },
          mapAsset: '/assets/map-ch15-zodiac-scorpio.svg',
          mapRegion: 'Hoang Mạc Độc Tinh',
          mapTagline: 'Chòm sao Bọ Cạp thức giấc, mở lối vào Hoang Mạc Độc Tinh.',
        },
        {
          id: 16,
          name: 'Chương 16: Thiên Lộ Xạ Thủ',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Thiên Lộ Xạ Thủ và đối đầu Nhân Mã Thần Xạ trong vòng sao Nhân Mã.',
          rooms: 15,
          floorColor1: '#1c2c4b', floorColor2: '#090c1b', wallColor: '#a5b4fc',
          enemyScale: 5.00,
          icon: '🏹', accent: '#a5b4fc', accent2: '#fbbf24', gradFrom: '#1c2c4b', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Nhân Mã', themeName: 'Nhân Mã',
          bossIcon: '🏹', bossName: 'Nhân Mã Thần Xạ',
          unlock: { type: 'chapterWin', chapterId: 15, label: 'Thắng Chương 15' },
          mapAsset: '/assets/map-ch16-zodiac-sagittarius.svg',
          mapRegion: 'Thiên Lộ Xạ Thủ',
          mapTagline: 'Chòm sao Nhân Mã thức giấc, mở lối vào Thiên Lộ Xạ Thủ.',
        },
        {
          id: 17,
          name: 'Chương 17: Đỉnh Sơn Tinh Tú',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Đỉnh Sơn Tinh Tú và đối đầu Sơn Thần Ma Kết trong vòng sao Ma Kết.',
          rooms: 15,
          floorColor1: '#1b3444', floorColor2: '#090c1b', wallColor: '#7dd3fc',
          enemyScale: 5.20,
          icon: '🐐', accent: '#7dd3fc', accent2: '#e2e8f0', gradFrom: '#1b3444', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Ma Kết', themeName: 'Ma Kết',
          bossIcon: '🐐', bossName: 'Sơn Thần Ma Kết',
          unlock: { type: 'chapterWin', chapterId: 16, label: 'Thắng Chương 16' },
          mapAsset: '/assets/map-ch17-zodiac-capricorn.svg',
          mapRegion: 'Đỉnh Sơn Tinh Tú',
          mapTagline: 'Chòm sao Ma Kết thức giấc, mở lối vào Đỉnh Sơn Tinh Tú.',
        },
        {
          id: 18,
          name: 'Chương 18: Hải Đài Thiên Thủy',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Hải Đài Thiên Thủy và đối đầu Thủy Sứ Bảo Bình trong vòng sao Bảo Bình.',
          rooms: 15,
          floorColor1: '#0e3150', floorColor2: '#090c1b', wallColor: '#22d3ee',
          enemyScale: 5.40,
          icon: '🏺', accent: '#22d3ee', accent2: '#818cf8', gradFrom: '#0e3150', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Bảo Bình', themeName: 'Bảo Bình',
          bossIcon: '🏺', bossName: 'Thủy Sứ Bảo Bình',
          unlock: { type: 'chapterWin', chapterId: 17, label: 'Thắng Chương 17' },
          mapAsset: '/assets/map-ch18-zodiac-aquarius.svg',
          mapRegion: 'Hải Đài Thiên Thủy',
          mapTagline: 'Chòm sao Bảo Bình thức giấc, mở lối vào Hải Đài Thiên Thủy.',
        },
        {
          id: 19,
          name: 'Chương 19: Hải Vực Mộng Ảo',
          modeLabel: 'Hoàng Đạo Tinh Giới (15 Phòng)',
          desc: 'Vượt qua Hải Vực Mộng Ảo và đối đầu Song Ngư Mộng Chủ trong vòng sao Song Ngư.',
          rooms: 15,
          floorColor1: '#152644', floorColor2: '#090c1b', wallColor: '#5eead4',
          enemyScale: 5.60,
          icon: '🐟', accent: '#5eead4', accent2: '#c084fc', gradFrom: '#152644', gradTo: '#090c1b',
          difficulty: 5, difficultyLabel: 'Tinh Giới — Song Ngư', themeName: 'Song Ngư',
          bossIcon: '🐟', bossName: 'Song Ngư Mộng Chủ',
          unlock: { type: 'chapterWin', chapterId: 18, label: 'Thắng Chương 18' },
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
        13: { mobHp: 7981, mobAtk: 1579, bossHp: 160000, bossAtk: 2233 },
        14: { mobHp: 9258, mobAtk: 1800, bossHp: 202000, bossAtk: 2546 },
        15: { mobHp: 10740, mobAtk: 2052, bossHp: 228094, bossAtk: 2903 },
        16: { mobHp: 12458, mobAtk: 2339, bossHp: 266870, bossAtk: 3309 },
        17: { mobHp: 14451, mobAtk: 2667, bossHp: 312238, bossAtk: 3772 },
        18: { mobHp: 16763, mobAtk: 3040, bossHp: 365319, bossAtk: 4300 },
        19: { mobHp: 19446, mobAtk: 3466, bossHp: 427423, bossAtk: 4902 },
      };

const POOLS = {
    1: ['stone', 'forest', 'mine', 'swamp', 'crypt'],
    2: ['lava', 'desert', 'ash', 'canyon'],
    3: ['void', 'crystal', 'ice', 'astral', 'temple'],
    4: ['dragon_realm', 'ice', 'crystal', 'astral'],
    5: ['eclipse_reach', 'obsidian_garden', 'starfall_rift', 'eclipse_reach'],
    6: ['nebula_gate', 'frozen_choir', 'throne_of_stars', 'nebula_gate'],
    7: ['luminous_grove', 'spore_marsh', 'hollow_hive', 'luminous_grove'],
    8: ['zodiac_aries'],
    9: ['zodiac_taurus'],
    10: ['zodiac_gemini'],
    11: ['zodiac_cancer'],
    12: ['zodiac_leo'],
    13: ['zodiac_virgo'],
    14: ['zodiac_libra'],
    15: ['zodiac_scorpio'],
    16: ['zodiac_sagittarius'],
    17: ['zodiac_capricorn'],
    18: ['zodiac_aquarius'],
    19: ['zodiac_pisces']
  };

const BOSS_ARENA = { golem: 'forge', queen: 'webcave', demon_king: 'throne', elder_dragon: 'dragon_altar', eclipse_sovereign: 'eclipse_throne', astral_devourer: 'abyss_crown', mycelium_queen: 'mycelium_heart', zodiac_aries: 'zodiac_aries', zodiac_taurus: 'zodiac_taurus', zodiac_gemini: 'zodiac_gemini', zodiac_cancer: 'zodiac_cancer', zodiac_leo: 'zodiac_leo', zodiac_virgo: 'zodiac_virgo', zodiac_libra: 'zodiac_libra', zodiac_scorpio: 'zodiac_scorpio', zodiac_sagittarius: 'zodiac_sagittarius', zodiac_capricorn: 'zodiac_capricorn', zodiac_aquarius: 'zodiac_aquarius', zodiac_pisces: 'zodiac_pisces' };

const ZODIAC_IDS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
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
  if (id >= 8 && id <= 19) return ZODIAC_ENEMY_POOLS[(id - 8) % ZODIAC_ENEMY_POOLS.length];
  return ({4:['dragon_whelp','cloud_wisp','sky_sentinel'],5:['rift_stalker','eclipse_oracle','obsidian_brute'],
           6:['nebula_herald','frost_sentinel','star_wraith'],7:['spore_runner','mire_shaman','hive_guardian']})[id] || DEFAULT_ENEMIES;
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
  const types=enemiesForChapter(ch.id), t=CAMPAIGN_TUNING[ch.id];
  if (!t) return null;
  const rooms = [];
  for(let room=1;room<=ch.rooms;room++) {
    const plan=CampaignConfig.roomPlan(ch.id,room);
    const { isBoss }=plan;
    const { depth,mobHp,mobAtk,bossHp,bossAtk }=CampaignConfig.tuning(t,room);
    const boss=plan.bossType;
    const k=room-Math.floor(room/10)-1;
    const biome=isBoss?BOSS_ARENA[boss]:(POOLS[ch.id]||[])[k % (POOLS[ch.id]||[]).length]||'stone';
    const count=CampaignConfig.mobCount(room);
    const mobs=[];
    if (!isBoss) {
      const occurrences=new Map();
      for(let i=0;i<count;i++) {
        const type=types[(room+i)%types.length];
        occurrences.set(type,(occurrences.get(type)||0)+1);
      }
      for(const [type,quantity] of occurrences) mobs.push({
        type,name:ENEMY_NAMES[type]||type,quantity,
        hp:Math.max(1,Math.round(mobHp*(ENEMY_MULTIPLIER[type]||1))),
        atk:Math.max(1,Math.round(mobAtk/Math.max(1,Math.sqrt(count/3)))),
        speed:ENEMY_SPEED[type]??64,radius:ENEMY_RADIUS[type]||16,
        hpMultiplier:ENEMY_MULTIPLIER[type]||1,
      });
    }
    rooms.push({
      ...plan,biome,depth:Number(depth.toFixed(4)),count:isBoss?1:count,mobHp,mobAtk,bossHp,bossAtk,
      mobs,boss:isBoss?{
        type:boss,name:bossName(ch,boss),
        hp:Math.round(bossHp*(boss==='demon_king'?1.15:1)),atk:Math.max(1,bossAtk),
        speed:boss.startsWith('zodiac_')?70:boss==='mycelium_queen'?72:boss==='eclipse_sovereign'?76:68,
        radius:34,hpMultiplier:boss==='demon_king'?1.15:1,
      }:null
    });
  }
  return {
    ...getCampaignSummaries().find(c=>c.id===ch.id),
    modeLabel:ch.modeLabel,enemyScale:ch.enemyScale,
    valkyrieRooms:rooms.filter(r=>r.valkyrie).map(r=>r.room),
    skillRarities:Array.from(CampaignConfig.SKILL_RARITIES),
    enemyRoster:types.map(type=>({type,name:ENEMY_NAMES[type]||type,hpMultiplier:ENEMY_MULTIPLIER[type]||1,speed:ENEMY_SPEED[type]??64,radius:ENEMY_RADIUS[type]||16})),
    bosses:rooms.filter(r=>r.isBoss).map(r=>({room:r.room,...r.boss})),
    roomsDetail:rooms,
    formulas:{
      mobHp:'round(baseMobHp × (1 + depth × 1.2) × typeMultiplier)',
      mobAtk:'round(baseMobAtk × (1 + depth × 0.5) ÷ max(1, √(count / 3)))',
      bossHp:'round(round(baseBossHp × (1 + depth × 0.35)) × bossMultiplier)',
      bossAtk:'round(baseBossAtk × (1 + depth × 0.3))',
      depth:'(room - 1) / (50 - 1)',count:'min(8, 3 + floor((room - 1) / 10))'
    }
  };
}
