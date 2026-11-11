// Renderer Canvas dùng chung game/admin; mỗi create() giữ Game/cache/VIS riêng.
(function(root) {
  function createArenaRenderer() {
  let Game = { enemies: [], obstacles: [], floorDecals: [], wallTorches: [], portalRect: { x: 0, y: 0, w: 0, h: 0 } };
  const TAU = Math.PI * 2;
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = (v, m) => ((v % m) + m) % m;

  // ---- màu: trộn hex ----
  const hex2 = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => { const A = hex2(a), B2 = hex2(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B2[i], t))).join(',')})`; };
  const rgba = (h, a) => { const A = hex2(h); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; };

  // ======================================================================
  //  BIOME — dữ liệu bối cảnh
  // ======================================================================
  const BIOMES = {};
  const def = (id, o) => { BIOMES[id] = Object.assign({ id, boss: null }, o); };

  def('stone', { label: 'Hầm Ngục Đá Cổ', f1: '#243247', f2: '#1b2638', wall0: '#0a0f1a', wall1: '#2b3a52', trim: '#7dd3fc', accent: '#38bdf8',
    glow: 'rgba(125,211,252,', torch: ['#fef08a', '#fb923c'], fog: 'rgba(56,189,248,', ob0: '#3b4a63', ob1: '#1c2535', obTop: '#64748b', vein: 'rgba(52,211,153,',
    floor: 'tiles', wall: 'brick', props: ['moss', 'rubble', 'bones', 'crack', 'puddle', 'moss'], wallProps: ['chains', 'banner'], ambient: 'dust', torchStyle: 'flame',
    obstacles: ['block', 'pillar', 'crate', 'barrel'], skin: 'stone', bullet: ['#ffffff', '#fda4af', '#e11d48'] });
  def('forest', { label: 'Rừng Cổ Thụ Phủ Rêu', f1: '#24402a', f2: '#1b3320', wall0: '#07140a', wall1: '#2f4d2c', trim: '#86efac', accent: '#4ade80',
    glow: 'rgba(134,239,172,', torch: ['#d9f99d', '#4ade80'], fog: 'rgba(74,222,128,', ob0: '#5b4128', ob1: '#2a1c0e', obTop: '#7a8f3a', vein: 'rgba(190,242,100,',
    floor: 'grass', wall: 'wood', props: ['grass', 'grass', 'flowers', 'mushroom', 'leaves', 'log'], wallProps: ['vines', 'roots'], ambient: 'fireflies', torchStyle: 'lantern',
    obstacles: ['stump', 'bush', 'rock', 'mushroomBig'], skin: 'forest', bullet: ['#ffffff', '#bef264', '#15803d'] });
  def('mine', { label: 'Mỏ Quặng Bỏ Hoang', f1: '#3a2f27', f2: '#2e251f', wall0: '#120c08', wall1: '#4a3a2c', trim: '#fbbf24', accent: '#f59e0b',
    glow: 'rgba(251,191,36,', torch: ['#fde68a', '#f59e0b'], fog: 'rgba(245,158,11,', ob0: '#5a4636', ob1: '#241b14', obTop: '#8a6d4d', vein: 'rgba(251,191,36,',
    floor: 'rock', wall: 'rock', props: ['rails', 'ore', 'rubble', 'pebbles', 'crack', 'ore'], wallProps: ['beams', 'lantern'], ambient: 'dust', torchStyle: 'lantern',
    obstacles: ['crate', 'rock', 'barrel', 'ore'], skin: 'mine', bullet: ['#ffffff', '#fde68a', '#d97706'] });
  def('swamp', { label: 'Đầm Lầy Độc Khí', f1: '#27341f', f2: '#1e2918', wall0: '#0b1208', wall1: '#3a4a2a', trim: '#a3e635', accent: '#84cc16',
    glow: 'rgba(163,230,53,', torch: ['#d9f99d', '#65a30d'], fog: 'rgba(132,204,22,', ob0: '#4b3d2a', ob1: '#1d170e', obTop: '#6b7f2f', vein: 'rgba(132,204,22,',
    floor: 'swamp', wall: 'wood', props: ['puddle', 'puddle', 'lily', 'reeds', 'bones', 'mushroom'], wallProps: ['vines', 'roots'], ambient: 'spores', torchStyle: 'wisp',
    obstacles: ['stump', 'mushroomBig', 'rock', 'deadtree'], skin: 'swamp', bullet: ['#ffffff', '#d9f99d', '#4d7c0f'] });
  def('crypt', { label: 'Hầm Mộ U Ám', f1: '#2a2638', f2: '#201c2e', wall0: '#0c0a14', wall1: '#3b3350', trim: '#c4b5fd', accent: '#a78bfa',
    glow: 'rgba(196,181,253,', torch: ['#ddd6fe', '#7c3aed'], fog: 'rgba(167,139,250,', ob0: '#413a58', ob1: '#171322', obTop: '#6d648c', vein: 'rgba(167,139,250,',
    floor: 'tiles', wall: 'bone', props: ['bones', 'skull', 'candle', 'crack', 'cobweb', 'bones'], wallProps: ['banner', 'chains'], ambient: 'souls', torchStyle: 'spirit',
    obstacles: ['coffin', 'pillar', 'statue', 'block'], skin: 'crypt', bullet: ['#ffffff', '#ddd6fe', '#7c3aed'] });
  def('lava', { label: 'Thung Lũng Dung Nham', f1: '#35170c', f2: '#27110a', wall0: '#160603', wall1: '#4a1d0c', trim: '#fb923c', accent: '#f97316',
    glow: 'rgba(251,146,60,', torch: ['#fde047', '#ef4444'], fog: 'rgba(249,115,22,', ob0: '#3d1a0e', ob1: '#1a0a05', obTop: '#7c2d12', vein: 'rgba(249,115,22,',
    floor: 'magma', wall: 'obsidian', props: ['lavacrack', 'rubble', 'bones', 'ember', 'lavacrack'], wallProps: ['chains', 'spikes'], ambient: 'embers', torchStyle: 'brazier',
    obstacles: ['rock', 'block', 'pillar', 'crystal'], skin: 'lava', bullet: ['#ffffff', '#fde047', '#ea580c'] });
  def('desert', { label: 'Sa Mạc Cổ Đại', f1: '#6b5532', f2: '#5c4a2b', wall0: '#1c1408', wall1: '#8a6b3a', trim: '#fde68a', accent: '#fbbf24',
    glow: 'rgba(253,230,138,', torch: ['#fef3c7', '#f59e0b'], fog: 'rgba(251,191,36,', ob0: '#9a7b46', ob1: '#4a3a1e', obTop: '#d4b06a', vein: 'rgba(251,191,36,',
    floor: 'sand', wall: 'sand', props: ['ripples', 'glyph', 'bones', 'pebbles', 'scarab'], wallProps: ['glyphs', 'banner'], ambient: 'sand', torchStyle: 'brazier',
    obstacles: ['obelisk', 'block', 'cactus', 'pillar'], skin: 'desert', bullet: ['#ffffff', '#fde68a', '#b45309'] });
  def('ash', { label: 'Cánh Đồng Tro Tàn', f1: '#2d2d33', f2: '#232328', wall0: '#0b0b0d', wall1: '#3a3a42', trim: '#fca5a5', accent: '#f87171',
    glow: 'rgba(248,113,113,', torch: ['#fecaca', '#dc2626'], fog: 'rgba(156,163,175,', ob0: '#44444c', ob1: '#17171a', obTop: '#6b7280', vein: 'rgba(248,113,113,',
    floor: 'ash', wall: 'rock', props: ['ashdrift', 'bones', 'ember', 'crack', 'rubble'], wallProps: ['spikes', 'chains'], ambient: 'ash', torchStyle: 'brazier',
    obstacles: ['deadtree', 'rock', 'block', 'bonesPile'], skin: 'ash', bullet: ['#ffffff', '#fca5a5', '#b91c1c'] });
  def('canyon', { label: 'Hẻm Núi Đỏ Rực', f1: '#4a2a1c', f2: '#3c2216', wall0: '#150a05', wall1: '#7a3b22', trim: '#fdba74', accent: '#fb923c',
    glow: 'rgba(253,186,116,', torch: ['#fed7aa', '#ea580c'], fog: 'rgba(234,88,12,', ob0: '#6e3a24', ob1: '#2a140b', obTop: '#b45f3a', vein: 'rgba(251,146,60,',
    floor: 'rock', wall: 'rock', props: ['rubble', 'pebbles', 'crack', 'bones', 'ripples'], wallProps: ['beams', 'lantern'], ambient: 'sand', torchStyle: 'lantern',
    obstacles: ['rock', 'rock', 'pillar', 'crate'], skin: 'canyon', bullet: ['#ffffff', '#fed7aa', '#c2410c'] });
  def('void', { label: 'Thánh Điện Hư Không', f1: '#241a4f', f2: '#181238', wall0: '#0a0520', wall1: '#34206b', trim: '#e879f9', accent: '#c084fc',
    glow: 'rgba(232,121,249,', torch: ['#f5d0fe', '#a855f7'], fog: 'rgba(168,85,247,', ob0: '#3b2478', ob1: '#150c36', obTop: '#6d28d9', vein: 'rgba(192,132,252,',
    floor: 'void', wall: 'obsidian', props: ['rune', 'rift', 'stars', 'crack', 'rune'], wallProps: ['spikes', 'chains'], ambient: 'stars', torchStyle: 'void',
    obstacles: ['crystal', 'obelisk', 'pillar', 'block'], skin: 'void', bullet: ['#ffffff', '#f0abfc', '#a21caf'] });
  def('crystal', { label: 'Hang Pha Lê Huyền Bí', f1: '#1b3347', f2: '#142838', wall0: '#060f1a', wall1: '#1f4d6b', trim: '#67e8f9', accent: '#22d3ee',
    glow: 'rgba(103,232,249,', torch: ['#cffafe', '#06b6d4'], fog: 'rgba(34,211,238,', ob0: '#1e5b7a', ob1: '#0b2233', obTop: '#67e8f9', vein: 'rgba(103,232,249,',
    floor: 'rock', wall: 'crystal', props: ['crystalSmall', 'sparkleSpot', 'crack', 'pebbles', 'crystalSmall'], wallProps: ['crystals'], ambient: 'sparkle', torchStyle: 'crystal',
    obstacles: ['crystal', 'crystal', 'rock', 'pillar'], skin: 'crystal', bullet: ['#ffffff', '#a5f3fc', '#0891b2'] });
  def('ice', { label: 'Băng Cung Vĩnh Cửu', f1: '#27455c', f2: '#1f3a4f', wall0: '#08121c', wall1: '#3f7391', trim: '#e0f2fe', accent: '#7dd3fc',
    glow: 'rgba(186,230,253,', torch: ['#e0f2fe', '#38bdf8'], fog: 'rgba(186,230,253,', ob0: '#4f86a8', ob1: '#18334a', obTop: '#bae6fd', vein: 'rgba(186,230,253,',
    floor: 'ice', wall: 'ice', props: ['icecrack', 'snow', 'frost', 'pebbles', 'icecrack'], wallProps: ['icicles'], ambient: 'snow', torchStyle: 'crystal',
    obstacles: ['ice', 'ice', 'rock', 'pillar'], skin: 'ice', bullet: ['#ffffff', '#e0f2fe', '#0284c7'] });
  def('astral', { label: 'Thiên Văn Đài Tinh Tú', f1: '#161a3f', f2: '#10132f', wall0: '#05061a', wall1: '#262a66', trim: '#93c5fd', accent: '#818cf8',
    glow: 'rgba(147,197,253,', torch: ['#e0e7ff', '#6366f1'], fog: 'rgba(99,102,241,', ob0: '#2c3380', ob1: '#0e1030', obTop: '#818cf8', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'obsidian', props: ['constellation', 'rune', 'stars', 'ring'], wallProps: ['spikes'], ambient: 'stars', torchStyle: 'spirit',
    obstacles: ['obelisk', 'crystal', 'pillar', 'statue'], skin: 'astral', bullet: ['#ffffff', '#c7d2fe', '#4338ca'] });
  def('temple', { label: 'Đền Thờ Hoàng Kim', f1: '#40391f', f2: '#322d18', wall0: '#120e05', wall1: '#6b5a2a', trim: '#fde047', accent: '#facc15',
    glow: 'rgba(253,224,71,', torch: ['#fef9c3', '#eab308'], fog: 'rgba(250,204,21,', ob0: '#7a6a35', ob1: '#2b2412', obTop: '#e6c75a', vein: 'rgba(250,204,21,',
    floor: 'marble', wall: 'brick', props: ['rune', 'glyph', 'petals', 'crack', 'coin'], wallProps: ['banner', 'columns'], ambient: 'sparkle', torchStyle: 'brazier',
    obstacles: ['statue', 'pillar', 'block', 'obelisk'], skin: 'temple', bullet: ['#ffffff', '#fef08a', '#ca8a04'] });
  // ---- đấu trường boss ----
  def('forge', { label: 'Lò Rèn Dung Nham', boss: 'golem', f1: '#2b1710', f2: '#1e0f09', wall0: '#0d0403', wall1: '#5a2a14', trim: '#fb923c', accent: '#f97316',
    glow: 'rgba(251,146,60,', torch: ['#fde047', '#ef4444'], fog: 'rgba(249,115,22,', ob0: '#3a1b10', ob1: '#140804', obTop: '#7c2d12', vein: 'rgba(249,115,22,',
    floor: 'magma', wall: 'obsidian', props: ['lavacrack', 'ember', 'rubble', 'lavacrack'], wallProps: ['chains', 'pipes'], ambient: 'embers', torchStyle: 'brazier',
    obstacles: ['block'], skin: 'lava', bullet: ['#ffffff', '#fde047', '#dc2626'] });
  def('webcave', { label: 'Hang Ổ Nhện Độc', boss: 'queen', f1: '#251339', f2: '#1a0c2b', wall0: '#0a0414', wall1: '#3b1e5e', trim: '#d946ef', accent: '#a855f7',
    glow: 'rgba(217,70,239,', torch: ['#f5d0fe', '#9333ea'], fog: 'rgba(168,85,247,', ob0: '#3b2478', ob1: '#150c36', obTop: '#6d28d9', vein: 'rgba(163,230,53,',
    floor: 'rock', wall: 'rock', props: ['cobweb', 'egg', 'bones', 'puddle', 'cobweb'], wallProps: ['webs', 'egg'], ambient: 'spores', torchStyle: 'wisp',
    obstacles: ['block'], skin: 'void', bullet: ['#ffffff', '#e9d5ff', '#7e22ce'] });
  def('throne', { label: 'Điện Ma Vương Atreus', boss: 'demon_king', f1: '#210c16', f2: '#16070f', wall0: '#070205', wall1: '#4a1124', trim: '#fb7185', accent: '#e11d48',
    glow: 'rgba(251,113,133,', torch: ['#fecdd3', '#e11d48'], fog: 'rgba(225,29,72,', ob0: '#4a1124', ob1: '#14060b', obTop: '#9f1239', vein: 'rgba(251,113,133,',
    floor: 'marble', wall: 'obsidian', props: ['rune', 'crack', 'ember', 'bones'], wallProps: ['banner', 'spikes', 'columns'], ambient: 'embers', torchStyle: 'brazier',
    obstacles: ['block'], skin: 'lava', bullet: ['#ffffff', '#fda4af', '#be123c'] });

  def('dragon_realm', { label: 'Long Vực Thiên Không', f1: '#173d5a', f2: '#0b2944', wall0: '#041322', wall1: '#155e75', trim: '#a5f3fc', accent: '#67e8f9',
    glow: 'rgba(103,232,249,', torch: ['#ecfeff', '#38bdf8'], fog: 'rgba(56,189,248,', ob0: '#155e75', ob1: '#082f49', obTop: '#67e8f9', vein: 'rgba(125,211,252,',
    floor: 'ice', wall: 'crystal', props: ['icecrack', 'crystalSmall', 'snow', 'frost', 'sparkleSpot'], wallProps: ['icicles', 'crystals'], ambient: 'snow', torchStyle: 'crystal',
    obstacles: ['crystal', 'ice', 'pillar', 'rock'], skin: 'ice', bullet: ['#ffffff', '#a5f3fc', '#0284c7'] });
  def('dragon_altar', { label: 'Điện Long Thần', boss: 'elder_dragon', f1: '#123c58', f2: '#071d35', wall0: '#020d1b', wall1: '#0e7490', trim: '#fde68a', accent: '#67e8f9',
    glow: 'rgba(103,232,249,', torch: ['#fef9c3', '#22d3ee'], fog: 'rgba(34,211,238,', ob0: '#155e75', ob1: '#06243d', obTop: '#a5f3fc', vein: 'rgba(250,204,21,',
    floor: 'star', wall: 'crystal', props: ['rune', 'crystalSmall', 'icecrack', 'sparkleSpot', 'stars'], wallProps: ['crystals', 'icicles', 'columns'], ambient: 'stars', torchStyle: 'crystal',
    obstacles: ['crystal', 'obelisk', 'pillar'], skin: 'ice', bullet: ['#ffffff', '#fde68a', '#0891b2'] });
  def('eclipse_reach', { label: 'Biên Giới Nhật Thực', f1: '#211332', f2: '#100a20', wall0: '#070611', wall1: '#3b2458', trim: '#d8b4fe', accent: '#c084fc',
    glow: 'rgba(192,132,252,', torch: ['#f5d0fe', '#8b5cf6'], fog: 'rgba(139,92,246,', ob0: '#35204d', ob1: '#120b21', obTop: '#a78bfa', vein: 'rgba(216,180,254,',
    floor: 'void', wall: 'obsidian', props: ['rift', 'rune', 'stars', 'crack', 'crystalSmall'], wallProps: ['spikes', 'chains', 'crystals'], ambient: 'stars', torchStyle: 'void',
    obstacles: ['crystal', 'obelisk', 'pillar', 'rock'], skin: 'void', bullet: ['#ffffff', '#d8b4fe', '#7c3aed'] });
  def('obsidian_garden', { label: 'Vườn Hắc Tinh', f1: '#17231f', f2: '#0b1517', wall0: '#050b0d', wall1: '#23443e', trim: '#a7f3d0', accent: '#34d399',
    glow: 'rgba(52,211,153,', torch: ['#d1fae5', '#10b981'], fog: 'rgba(16,185,129,', ob0: '#24483e', ob1: '#0b1715', obTop: '#6ee7b7', vein: 'rgba(110,231,183,',
    floor: 'tiles', wall: 'bone', props: ['crystalSmall', 'skull', 'rune', 'crack', 'stars'], wallProps: ['roots', 'crystals', 'chains'], ambient: 'souls', torchStyle: 'spirit',
    obstacles: ['crystal', 'rock', 'pillar', 'bonesPile'], skin: 'void', bullet: ['#ffffff', '#a7f3d0', '#059669'] });
  def('starfall_rift', { label: 'Khe Nứt Tinh Tú', f1: '#101a3c', f2: '#090d25', wall0: '#030617', wall1: '#29356b', trim: '#f0abfc', accent: '#a78bfa',
    glow: 'rgba(167,139,250,', torch: ['#fae8ff', '#a855f7'], fog: 'rgba(129,140,248,', ob0: '#28346b', ob1: '#090d26', obTop: '#c4b5fd', vein: 'rgba(192,132,252,',
    floor: 'star', wall: 'obsidian', props: ['constellation', 'rift', 'stars', 'rune', 'sparkleSpot'], wallProps: ['spikes', 'crystals', 'columns'], ambient: 'stars', torchStyle: 'void',
    obstacles: ['obelisk', 'crystal', 'pillar', 'statue'], skin: 'astral', bullet: ['#ffffff', '#f0abfc', '#7e22ce'] });
  def('eclipse_throne', { label: 'Ngai Vàng Nhật Thực', boss: 'eclipse_sovereign', f1: '#1b0b2b', f2: '#090613', wall0: '#03020a', wall1: '#4c1d5f', trim: '#f0abfc', accent: '#c084fc',
    glow: 'rgba(192,132,252,', torch: ['#fae8ff', '#7c3aed'], fog: 'rgba(139,92,246,', ob0: '#3b1c50', ob1: '#100819', obTop: '#d8b4fe', vein: 'rgba(240,171,252,',
    floor: 'void', wall: 'obsidian', props: ['rift', 'stars', 'rune', 'crystalSmall', 'constellation'], wallProps: ['spikes', 'chains', 'crystals', 'columns'], ambient: 'stars', torchStyle: 'void',
    obstacles: ['crystal', 'obelisk', 'pillar'], skin: 'void', bullet: ['#ffffff', '#e9d5ff', '#a855f7'] });

  // ---------- Chương 6: Vực Thẳm Thiên Hà ----------
  // Bảng màu: xanh băng giá + tím sao + vàng thiên hà, tương phản với Chương 5
  // (tím đậm/obsidian) để người chơi nhận ra ngay đã sang vùng đất mới.
  def('nebula_gate', { label: 'Cổng Tinh Vân', f1: '#0e1633', f2: '#070d22', wall0: '#030718', wall1: '#1f3a6e', trim: '#67e8f9', accent: '#22d3ee',
    glow: 'rgba(34,211,238,', torch: ['#cffafe', '#0891b2'], fog: 'rgba(56,189,248,', ob0: '#1a3358', ob1: '#081222', obTop: '#a5f3fc', vein: 'rgba(103,232,249,',
    floor: 'star', wall: 'crystal', props: ['rift', 'constellation', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'spikes'], ambient: 'stars', torchStyle: 'crystal',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'astral', bullet: ['#ffffff', '#a5f3fc', '#0891b2'] });
  def('frozen_choir', { label: 'Ca Đoàn Băng Giá', f1: '#12263a', f2: '#08131f', wall0: '#04101a', wall1: '#2f5f7a', trim: '#a5f3fc', accent: '#38bdf8',
    glow: 'rgba(56,189,248,', torch: ['#e0f2fe', '#0284c7'], fog: 'rgba(125,211,252,', ob0: '#1e4a63', ob1: '#071822', obTop: '#bae6fd', vein: 'rgba(165,243,252,',
    floor: 'ice', wall: 'ice', props: ['frost', 'icecrack', 'snow', 'crystalSmall', 'crack'], wallProps: ['icicles', 'crystals', 'columns'], ambient: 'snow', torchStyle: 'crystal',
    obstacles: ['ice', 'crystal', 'pillar'], skin: 'ice', bullet: ['#ffffff', '#bae6fd', '#0369a1'] });
  def('throne_of_stars', { label: 'Ngai Sao Lưu Lạc', f1: '#1a1033', f2: '#0a0620', wall0: '#050214', wall1: '#3d2a6b', trim: '#fde68a', accent: '#fbbf24',
    glow: 'rgba(251,191,36,', torch: ['#fef3c7', '#d97706'], fog: 'rgba(252,211,77,', ob0: '#3a2a5c', ob1: '#0d0820', obTop: '#fcd34d', vein: 'rgba(253,230,138,',
    floor: 'tiles', wall: 'bone', props: ['constellation', 'stars', 'rune', 'glyph', 'coin'], wallProps: ['banner', 'columns', 'chains'], ambient: 'sparkle', torchStyle: 'lantern',
    obstacles: ['statue', 'pillar', 'coffin'], skin: 'temple', bullet: ['#ffffff', '#fde68a', '#b45309'] });
  def('abyss_crown', { label: 'Vương Miện Vực Thẳm', boss: 'astral_devourer', f1: '#0a0a1e', f2: '#03030c', wall0: '#01010a', wall1: '#1e2a5c', trim: '#a78bfa', accent: '#818cf8',
    glow: 'rgba(129,140,248,', torch: ['#e0e7ff', '#4338ca'], fog: 'rgba(99,102,241,', ob0: '#1c2350', ob1: '#050514', obTop: '#a5b4fc', vein: 'rgba(165,180,252,',
    floor: 'void', wall: 'obsidian', props: ['rift', 'constellation', 'stars', 'rune', 'glyph'], wallProps: ['spikes', 'columns', 'crystals', 'chains'], ambient: 'stars', torchStyle: 'void',
    obstacles: ['obelisk', 'crystal', 'statue', 'pillar'], skin: 'void', bullet: ['#ffffff', '#c7d2fe', '#4338ca'] });

  // Chương 7: rừng nấm phát quang, đầm bào tử và tổ kén của Nữ Hoàng.
  def('luminous_grove', { label: 'Rừng Nấm Phát Quang', f1: '#102c2c', f2: '#071b20', wall0: '#041013', wall1: '#20565b', trim: '#5eead4', accent: '#2dd4bf',
    glow: 'rgba(45,212,191,', torch: ['#99f6e4', '#0f766e'], fog: 'rgba(20,184,166,', ob0: '#17454a', ob1: '#071b20', obTop: '#5eead4', vein: 'rgba(94,234,212,',
    floor: 'moss', wall: 'stone', props: ['moss', 'mushroom', 'sparkleSpot', 'log'], wallProps: ['vines', 'columns'], ambient: 'fireflies', torchStyle: 'crystal',
    obstacles: ['pillar', 'crystal', 'stump'], skin: 'forest', bullet: ['#f0fdfa', '#5eead4', '#0f766e'] });
  def('spore_marsh', { label: 'Đầm Bào Tử', f1: '#262039', f2: '#120f27', wall0: '#0a0818', wall1: '#4c3b68', trim: '#d8b4fe', accent: '#c084fc',
    glow: 'rgba(192,132,252,', torch: ['#e9d5ff', '#7e22ce'], fog: 'rgba(168,85,247,', ob0: '#3d3154', ob1: '#110e22', obTop: '#d8b4fe', vein: 'rgba(216,180,254,',
    floor: 'swamp', wall: 'stone', props: ['moss', 'mushroom', 'rune', 'sparkleSpot'], wallProps: ['vines', 'chains'], ambient: 'motes', torchStyle: 'void',
    obstacles: ['pillar', 'crystal', 'stump'], skin: 'swamp', bullet: ['#f5d0fe', '#c084fc', '#6b21a8'] });
  def('hollow_hive', { label: 'Tổ Kén Rỗng', f1: '#2b1a29', f2: '#160c1b', wall0: '#0b0610', wall1: '#63334b', trim: '#f9a8d4', accent: '#fb7185',
    glow: 'rgba(251,113,133,', torch: ['#fbcfe8', '#be185d'], fog: 'rgba(244,114,182,', ob0: '#4e2a42', ob1: '#160b1a', obTop: '#f9a8d4', vein: 'rgba(249,168,212,',
    floor: 'tiles', wall: 'bone', props: ['log', 'mushroom', 'glyph', 'crack'], wallProps: ['vines', 'spikes', 'chains'], ambient: 'motes', torchStyle: 'lantern',
    obstacles: ['pillar', 'coffin', 'statue'], skin: 'crypt', bullet: ['#ffe4e6', '#fb7185', '#9f1239'] });
  def('mycelium_heart', { label: 'Trái Tim Sợi Nấm', boss: 'mycelium_queen', f1: '#1b112b', f2: '#090919', wall0: '#080511', wall1: '#51306d', trim: '#f0abfc', accent: '#a3e635',
    glow: 'rgba(163,230,53,', torch: ['#ecfccb', '#65a30d'], fog: 'rgba(192,132,252,', ob0: '#34254d', ob1: '#0c0917', obTop: '#d9f99d', vein: 'rgba(217,249,157,',
    floor: 'rune', wall: 'bone', props: ['mushroom', 'log', 'rune', 'glyph'], wallProps: ['vines', 'columns', 'spikes'], ambient: 'motes', torchStyle: 'crystal',
    obstacles: ['pillar', 'crystal', 'statue'], skin: 'forest', bullet: ['#f7fee7', '#a3e635', '#7e22ce'] });

  // Mỗi cung là một đấu trường riêng; dùng chung luật vẽ để giữ tốc độ trên thiết bị yếu.
  def('zodiac_aries', { label: 'Hỏa Sơn Sừng Đỏ', boss: 'zodiac_aries', zodiac: '♈', f1: '#3b0b24', f2: '#090c1b', wall0: '#060918', wall1: '#3b0b24', trim: '#fb7185', accent: '#fb7185',
    glow: 'rgba(251,113,133,', torch: ['#fb7185', '#f97316'], fog: 'rgba(99,102,241,', ob0: '#3b0b24', ob1: '#0c1020', obTop: '#f97316', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['ember', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'brazier',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'lava', bullet: ['#ffffff', '#fb7185', '#f97316'] });
  def('zodiac_taurus', { label: 'Thảo Nguyên Kim Giác', boss: 'zodiac_taurus', zodiac: '♉', f1: '#253119', f2: '#090c1b', wall0: '#060918', wall1: '#253119', trim: '#fbbf24', accent: '#fbbf24',
    glow: 'rgba(251,191,36,', torch: ['#fbbf24', '#84cc16'], fog: 'rgba(99,102,241,', ob0: '#253119', ob1: '#0c1020', obTop: '#84cc16', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['grass', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'lantern',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'forest', bullet: ['#ffffff', '#fbbf24', '#84cc16'] });
  def('zodiac_gemini', { label: 'Song Thành Ảo Ảnh', boss: 'zodiac_gemini', zodiac: '♊', f1: '#152746', f2: '#090c1b', wall0: '#060918', wall1: '#152746', trim: '#67e8f9', accent: '#67e8f9',
    glow: 'rgba(103,232,249,', torch: ['#67e8f9', '#a78bfa'], fog: 'rgba(99,102,241,', ob0: '#152746', ob1: '#0c1020', obTop: '#a78bfa', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['constellation', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'crystal',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'astral', bullet: ['#ffffff', '#67e8f9', '#a78bfa'] });
  def('zodiac_cancer', { label: 'Thủy Cung Nguyệt Triều', boss: 'zodiac_cancer', zodiac: '♋', f1: '#082c44', f2: '#090c1b', wall0: '#060918', wall1: '#082c44', trim: '#38bdf8', accent: '#38bdf8',
    glow: 'rgba(56,189,248,', torch: ['#38bdf8', '#a5f3fc'], fog: 'rgba(99,102,241,', ob0: '#082c44', ob1: '#0c1020', obTop: '#a5f3fc', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['ripples', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'crystal',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'ice', bullet: ['#ffffff', '#38bdf8', '#a5f3fc'] });
  def('zodiac_leo', { label: 'Thánh Điện Nhật Luân', boss: 'zodiac_leo', zodiac: '♌', f1: '#46260f', f2: '#090c1b', wall0: '#060918', wall1: '#46260f', trim: '#fbbf24', accent: '#fbbf24',
    glow: 'rgba(251,191,36,', torch: ['#fbbf24', '#fb923c'], fog: 'rgba(99,102,241,', ob0: '#46260f', ob1: '#0c1020', obTop: '#fb923c', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['rune', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'brazier',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'temple', bullet: ['#ffffff', '#fbbf24', '#fb923c'] });
  def('zodiac_virgo', { label: 'Vườn Sao Trinh Nữ', boss: 'zodiac_virgo', zodiac: '♍', f1: '#143329', f2: '#090c1b', wall0: '#060918', wall1: '#143329', trim: '#d9f99d', accent: '#d9f99d',
    glow: 'rgba(217,249,157,', torch: ['#d9f99d', '#5eead4'], fog: 'rgba(99,102,241,', ob0: '#143329', ob1: '#0c1020', obTop: '#5eead4', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['flowers', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'lantern',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'forest', bullet: ['#ffffff', '#d9f99d', '#5eead4'] });
  def('zodiac_libra', { label: 'Điện Cân Bằng', boss: 'zodiac_libra', zodiac: '♎', f1: '#32213f', f2: '#090c1b', wall0: '#060918', wall1: '#32213f', trim: '#f0abfc', accent: '#f0abfc',
    glow: 'rgba(240,171,252,', torch: ['#f0abfc', '#fbbf24'], fog: 'rgba(99,102,241,', ob0: '#32213f', ob1: '#0c1020', obTop: '#fbbf24', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['glyph', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'crystal',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'temple', bullet: ['#ffffff', '#f0abfc', '#fbbf24'] });
  def('zodiac_scorpio', { label: 'Hoang Mạc Độc Tinh', boss: 'zodiac_scorpio', zodiac: '♏', f1: '#32152e', f2: '#090c1b', wall0: '#060918', wall1: '#32152e', trim: '#c084fc', accent: '#c084fc',
    glow: 'rgba(192,132,252,', torch: ['#c084fc', '#fb7185'], fog: 'rgba(99,102,241,', ob0: '#32152e', ob1: '#0c1020', obTop: '#fb7185', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['scarab', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'void',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'desert', bullet: ['#ffffff', '#c084fc', '#fb7185'] });
  def('zodiac_sagittarius', { label: 'Thiên Lộ Xạ Thủ', boss: 'zodiac_sagittarius', zodiac: '♐', f1: '#1c2c4b', f2: '#090c1b', wall0: '#060918', wall1: '#1c2c4b', trim: '#a5b4fc', accent: '#a5b4fc',
    glow: 'rgba(165,180,252,', torch: ['#a5b4fc', '#fbbf24'], fog: 'rgba(99,102,241,', ob0: '#1c2c4b', ob1: '#0c1020', obTop: '#fbbf24', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['stars', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'crystal',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'astral', bullet: ['#ffffff', '#a5b4fc', '#fbbf24'] });
  def('zodiac_capricorn', { label: 'Đỉnh Sơn Tinh Tú', boss: 'zodiac_capricorn', zodiac: '♑', f1: '#1b3444', f2: '#090c1b', wall0: '#060918', wall1: '#1b3444', trim: '#7dd3fc', accent: '#7dd3fc',
    glow: 'rgba(125,211,252,', torch: ['#7dd3fc', '#e2e8f0'], fog: 'rgba(99,102,241,', ob0: '#1b3444', ob1: '#0c1020', obTop: '#e2e8f0', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['frost', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'crystal',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'ice', bullet: ['#ffffff', '#7dd3fc', '#e2e8f0'] });
  def('zodiac_aquarius', { label: 'Hải Đài Thiên Thủy', boss: 'zodiac_aquarius', zodiac: '♒', f1: '#0e3150', f2: '#090c1b', wall0: '#060918', wall1: '#0e3150', trim: '#22d3ee', accent: '#22d3ee',
    glow: 'rgba(34,211,238,', torch: ['#22d3ee', '#818cf8'], fog: 'rgba(99,102,241,', ob0: '#0e3150', ob1: '#0c1020', obTop: '#818cf8', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['ripples', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'crystal',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'crystal', bullet: ['#ffffff', '#22d3ee', '#818cf8'] });
  def('zodiac_pisces', { label: 'Hải Vực Mộng Ảo', boss: 'zodiac_pisces', zodiac: '♓', f1: '#152644', f2: '#090c1b', wall0: '#060918', wall1: '#152644', trim: '#5eead4', accent: '#5eead4',
    glow: 'rgba(94,234,212,', torch: ['#5eead4', '#c084fc'], fog: 'rgba(99,102,241,', ob0: '#152644', ob1: '#0c1020', obTop: '#c084fc', vein: 'rgba(165,180,252,',
    floor: 'star', wall: 'crystal', props: ['ripples', 'stars', 'glyph', 'sparkleSpot'], wallProps: ['columns', 'crystals', 'glyphs'], ambient: 'stars', torchStyle: 'void',
    obstacles: ['obelisk', 'crystal', 'pillar'], skin: 'swamp', bullet: ['#ffffff', '#5eead4', '#c084fc'] });

  // Chương nào dùng biome nào (xoay vòng theo phòng thường). Chương sự kiện (999) trộn tất cả.
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
  const POOL_ALL = ['stone', 'forest', 'mine', 'swamp', 'crypt', 'lava', 'desert', 'ash', 'canyon', 'void', 'crystal', 'ice', 'astral', 'temple', 'eclipse_reach', 'obsidian_garden', 'starfall_rift', 'nebula_gate', 'frozen_choir', 'throne_of_stars', 'luminous_grove', 'spore_marsh', 'hollow_hive', 'zodiac_aries', 'zodiac_taurus', 'zodiac_gemini', 'zodiac_cancer', 'zodiac_leo', 'zodiac_virgo', 'zodiac_libra', 'zodiac_scorpio', 'zodiac_sagittarius', 'zodiac_capricorn', 'zodiac_aquarius', 'zodiac_pisces'];
  const BOSS_ARENA = { golem: 'forge', queen: 'webcave', demon_king: 'throne', elder_dragon: 'dragon_altar', eclipse_sovereign: 'eclipse_throne', astral_devourer: 'abyss_crown', mycelium_queen: 'mycelium_heart', zodiac_aries: 'zodiac_aries', zodiac_taurus: 'zodiac_taurus', zodiac_gemini: 'zodiac_gemini', zodiac_cancer: 'zodiac_cancer', zodiac_leo: 'zodiac_leo', zodiac_virgo: 'zodiac_virgo', zodiac_libra: 'zodiac_libra', zodiac_scorpio: 'zodiac_scorpio', zodiac_sagittarius: 'zodiac_sagittarius', zodiac_capricorn: 'zodiac_capricorn', zodiac_aquarius: 'zodiac_aquarius', zodiac_pisces: 'zodiac_pisces' };

  // Mỗi chương có một bản sắc trùm riêng; các chương đầu giữ nguyên bộ boss cũ.
  const ZODIAC_IDS = ['leo', 'aries', 'taurus', 'gemini', 'cancer', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  function bossTypeOfRoom(room) {
    if ((!Game.mode || Game.mode === 'campaign') && root.ArtemisCampaignConfig) return root.ArtemisCampaignConfig.bossType(Game.chapter && Game.chapter.id, room);
    if (Game.chapter && Number(Game.chapter.id) >= 1 && Number(Game.chapter.id) <= 12) return 'zodiac_' + ZODIAC_IDS[Number(Game.chapter.id) - 1];
    if (Game.chapter && Number(Game.chapter.id) === 7) return 'mycelium_queen';
    if (Game.chapter && Number(Game.chapter.id) === 6) return 'astral_devourer';
    if (Game.chapter && Number(Game.chapter.id) === 5) return 'eclipse_sovereign';
    if (Game.chapter && Number(Game.chapter.id) === 4) return 'elder_dragon';
    return room === 5 ? 'golem' : (room === 10 ? 'queen' : 'demon_king');
  }
  /**
   * Phòng trùm cho phần VẼ (block script riêng, không thấy GAME_MODES).
   * Luật phòng trùm thật nằm ở isBossRoom() block 2 — đây chỉ để chọn biome.
   */
  function isBossRoomForBiome(room, maxRooms) {
    const max = maxRooms || Game.maxRooms || 1;
    if (Game.mode === 'tower' || Game.mode === 'bossrush') return true;
    if ((!Game.mode || Game.mode === 'campaign') && max === 50) return room % 10 === 0;
    return (room % 5 === 0) || (room === max);
  }


  function pickBiome() {
    const room = Game.room || 1;
    // Used exclusively by the Admin Studio map canvas, never by a live run.
    if (Game.previewOnly === true && BIOMES[Game.previewBiome]) return BIOMES[Game.previewBiome];
    // Published Content Studio biome skins; obstacle/collision data remains
    // owned by the original room logic. Non-campaign modes never inherit it.
    if ((!Game.mode || Game.mode === 'campaign') && root.ArtemisContentRuntime) {
      const biomeId=root.ArtemisContentRuntime.biomeFor(Game.chapter?.id,room);
      if (biomeId && BIOMES[biomeId]) return BIOMES[biomeId];
    }
    if (isBossRoomForBiome(room)) {
      if ((!Game.mode || Game.mode === 'campaign') && Number(Game.chapter?.id) === 1
        && room < 50 && room % 10 === 0) return BIOMES.zodiac_leo;
      return BIOMES[BOSS_ARENA[bossTypeOfRoom(room)]];
    }
    const ch = Game.chapter ? Game.chapter.id : 1;
    const k = room - Math.floor(room / 5) - 1;           // chỉ đếm phòng thường → 4 phòng đầu luôn khác nhau
    const pool = POOLS[ch];
    if (pool) return BIOMES[pool[k % pool.length]];
    return BIOMES[POOL_ALL[(k * 3 + room) % POOL_ALL.length]];
  }

  // ======================================================================
  //  LỚP NỀN TĨNH (cache theo phòng): tường + sàn + vật trang trí
  // ======================================================================
  const poly = (g, pts) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
  const soft = (g, x, y, rx, ry, col, a = 1, rot = 0) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, col.replace(/[\d.]+\)$/, a + ')')); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, ry / rx); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
  };
  const jag = (g, x, y, len, ang, R, seg = 5, spread = 14) => {
    g.beginPath(); g.moveTo(x, y); const pts = [[x, y]];
    for (let i = 1; i <= seg; i++) { x += Math.cos(ang) * len / seg + (R() - 0.5) * spread; y += Math.sin(ang) * len / seg + (R() - 0.5) * spread; g.lineTo(x, y); pts.push([x, y]); }
    g.stroke(); return pts;
  };

  function wallCell(g, B, x, y, bw, bh, s) {
    const st = B.wall, base = B.wall1;
    g.save(); g.beginPath(); g.rect(x, y, bw, bh); g.clip();
    if (st === 'brick' || st === 'bone' || st === 'sand') {
      const warm = st === 'sand';
      g.fillStyle = `rgba(255,255,255,${0.03 + hash(s) * (warm ? 0.09 : 0.05)})`; g.fillRect(x + 1, y + 1, bw - 2, bh * 0.35);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 1, y + bh * 0.72, bw - 2, bh * 0.28 - 1);
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.5; g.strokeRect(x, y, bw, bh);
      if (st === 'bone' && hash(s + 3) > 0.5) {
        const cx = x + bw / 2, cy = y + bh / 2;
        g.fillStyle = 'rgba(226,232,240,0.55)'; g.beginPath(); g.ellipse(cx, cy - 1, 8, 7, 0, 0, TAU); g.fill(); g.fillRect(cx - 4, cy + 4, 8, 5);
        g.fillStyle = '#0c0a14'; g.beginPath(); g.arc(cx - 3, cy - 1, 2.2, 0, TAU); g.arc(cx + 3, cy - 1, 2.2, 0, TAU); g.fill();
      }
      if (warm && hash(s + 4) > 0.55) { g.strokeStyle = 'rgba(60,40,10,0.45)'; g.lineWidth = 1.4; g.strokeRect(x + bw * 0.3, y + bh * 0.3, bw * 0.4, bh * 0.35); g.beginPath(); g.moveTo(x + bw * 0.5, y + bh * 0.3); g.lineTo(x + bw * 0.5, y + bh * 0.65); g.stroke(); }
      if (B.id === 'temple' && hash(s + 6) > 0.5) { g.strokeStyle = 'rgba(253,224,71,0.35)'; g.lineWidth = 1.2; g.strokeRect(x + 4, y + 4, bw - 8, bh - 8); }
    } else if (st === 'rock') {
      for (let i = 0; i < 2; i++) {
        const cx = x + bw * (0.3 + 0.4 * hash(s + i)), cy = y + bh * (0.3 + 0.4 * hash(s + i + 9)), r = Math.max(bw, bh) * (0.32 + 0.18 * hash(s + i * 3));
        const pts = []; for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; const rr = r * (0.7 + 0.35 * hash(s + k * 5 + i)); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85]); }
        g.fillStyle = mix(base, '#000000', 0.1 + hash(s + i + 20) * 0.35); poly(g, pts); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(pts[5][0], pts[5][1]); g.lineTo(pts[6][0], pts[6][1]); g.lineTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.stroke();
      }
    } else if (st === 'wood') {
      const bark = mix(base, '#4a3320', 0.6), n = 4, pw = bw / n;
      for (let k = 0; k < n; k++) {
        g.fillStyle = mix(bark, '#000000', hash(s + k) * 0.4); g.fillRect(x + k * pw, y, pw, bh);
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4; g.strokeRect(x + k * pw, y, pw, bh);
        g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + k * pw + pw * 0.3, y + 2); g.lineTo(x + k * pw + pw * 0.35, y + bh - 2); g.stroke();
      }
      if (hash(s + 8) > 0.55) { g.fillStyle = 'rgba(80,170,90,0.35)'; g.fillRect(x, y + bh * 0.62, bw, bh * 0.14); }
    } else if (st === 'ice') {
      g.fillStyle = mix(base, '#ffffff', 0.08 + hash(s) * 0.12); g.fillRect(x, y, bw, bh);
      const gr = g.createLinearGradient(x, y, x + bw, y + bh); gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.12)');
      g.fillStyle = gr; g.fillRect(x, y, bw, bh);
      g.strokeStyle = 'rgba(224,242,254,0.5)'; g.lineWidth = 1.4; g.strokeRect(x + 0.7, y + 0.7, bw - 1.4, bh - 1.4);
    } else if (st === 'crystal') {
      g.fillStyle = mix(base, '#000000', 0.25 + hash(s) * 0.2); g.fillRect(x, y, bw, bh);
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4; g.strokeRect(x, y, bw, bh);
      for (let k = 0; k < 2; k++) {
        const cx = x + bw * (0.25 + 0.5 * hash(s + k)), hh = bh * (0.45 + 0.4 * hash(s + k + 4)), ww = bw * 0.13;
        g.fillStyle = rgba(B.trim, 0.5); poly(g, [[cx - ww, y + bh], [cx - ww * 0.4, y + bh - hh], [cx + ww * 0.4, y + bh - hh * 0.9], [cx + ww, y + bh]]); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.stroke();
      }
    } else { // obsidian
      g.fillStyle = mix(base, '#000000', 0.2 + hash(s) * 0.3); g.fillRect(x, y, bw, bh);
      g.fillStyle = 'rgba(255,255,255,0.05)'; poly(g, [[x, y], [x + bw, y], [x + bw * (0.3 + hash(s + 1) * 0.5), y + bh]]); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.3)'; poly(g, [[x, y + bh], [x + bw, y + bh * 0.4], [x + bw, y + bh]]); g.fill();
      g.strokeStyle = B.glow + '0.28)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y + bh * (0.3 + 0.4 * hash(s + 2))); g.lineTo(x + bw, y + bh * (0.3 + 0.4 * hash(s + 3))); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5; g.strokeRect(x, y, bw, bh);
    }
    g.restore();
  }

  function floorCell(g, B, x, y, tw, th, s, gx, gy) {
    const st = B.floor, ck = (gx + gy) % 2;
    if (st === 'grass' || st === 'sand') { // nền liền mạch, chỉ lốm đốm nhẹ
      g.fillStyle = `rgba(${hash(s) > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + hash(s + 1) * 0.04})`; g.fillRect(x, y, tw, th); return;
    }
    g.fillStyle = ck ? B.f1 : B.f2; g.fillRect(x, y, tw, th);
    if (st === 'marble') {
      const gr = g.createLinearGradient(x, y, x + tw, y + th); gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = gr; g.fillRect(x, y, tw, th);
      g.strokeStyle = B.glow + '0.16)'; g.lineWidth = 1; g.strokeRect(x + 2.5, y + 2.5, tw - 5, th - 5);
      if (hash(s + 3) > 0.45) { g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + hash(s + 4) * tw, y); g.quadraticCurveTo(x + hash(s + 5) * tw, y + th * 0.5, x + hash(s + 6) * tw, y + th); g.stroke(); }
    } else if (st === 'ice') {
      const gr = g.createLinearGradient(x, y, x + tw, y + th); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.02)'); gr.addColorStop(1, 'rgba(120,200,255,0.08)'); g.fillStyle = gr; g.fillRect(x, y, tw, th);
    } else if (st === 'rock') {
      g.fillStyle = `rgba(${hash(s) > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + hash(s + 1) * 0.08})`; g.fillRect(x, y, tw, th);
      if (hash(s + 2) > 0.6) { g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + 6 + hash(s + i * 3) * (tw - 12), y + 6 + hash(s + i * 3 + 1) * (th - 12), 1 + hash(s + i) * 2, 0, TAU); g.fill(); } }
    } else {
      g.fillStyle = `rgba(255,255,255,${0.012 + hash(s) * 0.035})`; g.fillRect(x, y, tw, th);
    }
    if (st === 'void' || st === 'star') { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + th - 1.5, tw, 1.5); g.fillRect(x + tw - 1.5, y, 1.5, th); g.strokeStyle = B.glow + '0.07)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1); }
    else if (st !== 'rock') {
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, y, tw, 1.5); g.fillRect(x, y, 1.5, th);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y + th - 1.5, tw, 1.5); g.fillRect(x + tw - 1.5, y, 1.5, th);
    }
    if ((st === 'tiles' || st === 'ash' || st === 'swamp' || st === 'magma') && hash(s + 7) > 0.74) {
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath();
      const sx = x + 6 + hash(s + 1) * (tw - 12), sy = y + 6 + hash(s + 2) * (th - 12);
      g.moveTo(sx, sy); g.lineTo(sx + 9 * (hash(s + 3) - 0.5) * 2, sy + 11); g.lineTo(sx + 14 * (hash(s + 4) - 0.3), sy + 20); g.stroke();
    }
  }

  // ---- vật trang trí phẳng trên sàn (không cản đường, không gây hiểu nhầm là chướng ngại) ----
  const PROP = {
    moss(g, x, y, s) { soft(g, x, y, 20 * s, 14 * s, 'rgba(74,170,96,0.4)', 0.4); soft(g, x + 6 * s, y - 3, 9 * s, 6 * s, 'rgba(120,220,120,0.3)', 0.3); },
    rubble(g, x, y, s, R) { for (let i = 0; i < 5; i++) { const px = x + (R() - 0.5) * 24 * s, py = y + (R() - 0.5) * 14 * s, r = (2 + R() * 4) * s; g.fillStyle = `rgba(${90 + R() * 70 | 0},${90 + R() * 60 | 0},${100 + R() * 60 | 0},0.7)`; poly(g, [[px - r, py], [px - r * 0.3, py - r], [px + r, py - r * 0.4], [px + r * 0.6, py + r * 0.6], [px - r * 0.5, py + r * 0.7]]); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 0.8; g.stroke(); } },
    bones(g, x, y, s, R) { g.save(); g.translate(x, y); g.rotate(R() * TAU); g.strokeStyle = 'rgba(226,232,240,0.8)'; g.fillStyle = 'rgba(226,232,240,0.85)'; g.lineWidth = 2.6 * s; g.lineCap = 'round';
      for (let i = 0; i < 2; i++) { g.rotate(0.8 + i * 1.2); g.beginPath(); g.moveTo(-9 * s, 0); g.lineTo(9 * s, 0); g.stroke(); for (const d of [-1, 1]) { g.beginPath(); g.arc(d * 9 * s, -1.8 * s, 2.2 * s, 0, TAU); g.arc(d * 9 * s, 1.8 * s, 2.2 * s, 0, TAU); g.fill(); } } g.restore(); },
    crack(g, x, y, s, R) { g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.4; jag(g, x, y, 34 * s, R() * TAU, R, 4, 9); },
    puddle(g, x, y, s, R, B, an) { const sw = B.id === 'swamp' || B.id === 'webcave'; const c = sw ? (B.id === 'webcave' ? 'rgba(163,230,53,' : 'rgba(110,160,50,') : 'rgba(80,120,180,'; soft(g, x, y, 24 * s, 12 * s, c + '0.5)', 0.55);
      g.strokeStyle = sw ? 'rgba(217,249,157,0.35)' : 'rgba(186,230,253,0.35)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x - 2 * s, y - 1, 12 * s, 5 * s, 0, 3.4, 5.2); g.stroke(); an.push({ k: 'ripple', x, y, r: 10 * s, p: R() * 6, c: sw ? 'rgba(217,249,157,' : 'rgba(186,230,253,' }); },
    grass(g, x, y, s, R) { g.lineCap = 'round'; for (let i = 0; i < 6; i++) { const bx = x + (R() - 0.5) * 12 * s; g.strokeStyle = `rgb(${50 + R() * 40 | 0},${120 + R() * 60 | 0},${50 + R() * 30 | 0})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, y + 4); g.quadraticCurveTo(bx + (R() - 0.5) * 6, y - 4 * s, bx + (R() - 0.5) * 8, y - (8 + R() * 6) * s); g.stroke(); } },
    flowers(g, x, y, s, R) { const cols = ['#fde047', '#f9a8d4', '#fff', '#c4b5fd']; for (let i = 0; i < 4; i++) { const fx = x + (R() - 0.5) * 22 * s, fy = y + (R() - 0.5) * 12 * s; g.strokeStyle = '#2f7a3a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(fx, fy + 4); g.lineTo(fx, fy); g.stroke(); g.fillStyle = cols[i % 4]; g.beginPath(); g.arc(fx, fy - 1, 2.4 * s, 0, TAU); g.fill(); g.fillStyle = '#92400e'; g.beginPath(); g.arc(fx, fy - 1, 0.9, 0, TAU); g.fill(); } },
    mushroom(g, x, y, s, R, B, an) { const col = B.id === 'swamp' ? '#d9f99d' : '#fb7185'; g.fillStyle = '#e7e5e4'; g.fillRect(x - 1.6 * s, y - 1, 3.2 * s, 6 * s); g.fillStyle = col; g.beginPath(); g.ellipse(x, y - 1, 6 * s, 4.4 * s, 0, Math.PI, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(x - 2 * s, y - 3 * s, 1, 0, TAU); g.arc(x + 2 * s, y - 2.5 * s, 0.8, 0, TAU); g.fill(); an.push({ k: 'glow', x, y: y - 2, r: 14 * s, p: R() * 6, c: B.id === 'swamp' ? 'rgba(190,242,100,' : 'rgba(251,113,133,' }); },
    leaves(g, x, y, s, R) { for (let i = 0; i < 4; i++) { g.save(); g.translate(x + (R() - 0.5) * 22 * s, y + (R() - 0.5) * 12 * s); g.rotate(R() * TAU); g.fillStyle = ['#4d7c0f', '#65a30d', '#a16207', '#b45309'][i % 4]; g.globalAlpha = 0.75; g.beginPath(); g.ellipse(0, 0, 4.5 * s, 2.2 * s, 0, 0, TAU); g.fill(); g.restore(); } },
    log(g, x, y, s) { g.fillStyle = '#4a321c'; g.beginPath(); g.roundRect(x - 16 * s, y - 4 * s, 32 * s, 8 * s, 4); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#8a6a43'; g.beginPath(); g.ellipse(x + 16 * s, y, 2.6 * s, 4 * s, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(90,180,90,0.5)'; g.fillRect(x - 10 * s, y - 4 * s, 12 * s, 2.4); },
    rails(g, x, y, s) { const L = 90 * s; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 3; for (const o of [-5, 5]) { g.beginPath(); g.moveTo(x - L / 2, y + o); g.lineTo(x + L / 2, y + o); g.stroke(); } g.strokeStyle = '#8b6b4a'; g.lineWidth = 3; for (let i = 0; i <= 8; i++) { const tx = x - L / 2 + i * L / 8; g.beginPath(); g.moveTo(tx, y - 8); g.lineTo(tx, y + 8); g.stroke(); } g.strokeStyle = '#a8a29e'; g.lineWidth = 1.8; for (const o of [-5, 5]) { g.beginPath(); g.moveTo(x - L / 2, y + o); g.lineTo(x + L / 2, y + o); g.stroke(); } },
    ore(g, x, y, s, R, B, an) { for (let i = 0; i < 3; i++) { const px = x + (i - 1) * 7 * s, hh = (5 + R() * 5) * s; g.fillStyle = '#fbbf24'; poly(g, [[px - 3 * s, y + 3], [px, y + 3 - hh], [px + 3 * s, y + 3]]); g.fill(); g.fillStyle = 'rgba(255,255,255,0.55)'; poly(g, [[px - 1, y + 3], [px, y + 3 - hh], [px + 0.5, y + 3]]); g.fill(); } an.push({ k: 'glow', x, y, r: 16 * s, p: R() * 6, c: 'rgba(251,191,36,' }); },
    pebbles(g, x, y, s, R) { for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(${120 + R() * 60 | 0},${110 + R() * 50 | 0},${100 + R() * 40 | 0},0.55)`; g.beginPath(); g.ellipse(x + (R() - 0.5) * 26 * s, y + (R() - 0.5) * 14 * s, (1 + R() * 2.2) * s, (0.8 + R() * 1.6) * s, 0, 0, TAU); g.fill(); } },
    lavacrack(g, x, y, s, R, B, an) { const ang = R() * TAU; const L = 44 * s; g.lineCap = 'round'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 5; const pts = jag(g, x, y, L, ang, R, 4, 12);
      g.strokeStyle = '#f97316'; g.lineWidth = 2.2; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.strokeStyle = '#fde047'; g.lineWidth = 0.9; g.stroke(); pts.forEach((p, i) => { if (i % 2 === 0) an.push({ k: 'glow', x: p[0], y: p[1], r: 15, p: R() * 6, c: 'rgba(251,146,60,' }); }); },
    ember(g, x, y, s, R, B, an) { g.fillStyle = '#fb923c'; g.beginPath(); g.arc(x, y, 1.6 * s, 0, TAU); g.fill(); an.push({ k: 'glow', x, y, r: 9 * s, p: R() * 6, c: 'rgba(251,146,60,' }); },
    skull(g, x, y, s) { g.fillStyle = 'rgba(226,232,240,0.85)'; g.beginPath(); g.ellipse(x, y, 5.5 * s, 5 * s, 0, 0, TAU); g.fill(); g.fillRect(x - 3 * s, y + 3 * s, 6 * s, 3.4 * s); g.fillStyle = '#0c0a14'; g.beginPath(); g.arc(x - 2 * s, y - 0.5, 1.5 * s, 0, TAU); g.arc(x + 2 * s, y - 0.5, 1.5 * s, 0, TAU); g.fill(); },
    candle(g, x, y, s, R, B, an) { g.fillStyle = '#e7e5e4'; g.fillRect(x - 2 * s, y - 3 * s, 4 * s, 8 * s); g.fillStyle = 'rgba(253,230,138,0.9)'; g.fillRect(x - 2 * s, y - 3 * s, 4 * s, 1.6); an.push({ k: 'flame', x, y: y - 4 * s, p: R() * 6, c: 'rgba(253,224,71,', s }); },
    cobweb(g, x, y, s, R) { g.strokeStyle = 'rgba(226,232,240,0.22)'; g.lineWidth = 0.9; const n = 7, rr = 22 * s; for (let i = 0; i < n; i++) { const a = i / n * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7); g.stroke(); } for (let k = 1; k <= 3; k++) { g.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * TAU, r2 = rr * k / 3 * (1 - 0.1 * (i % 2)); const px = x + Math.cos(a) * r2, py = y + Math.sin(a) * r2 * 0.7; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); } },
    ripples(g, x, y, s, R) { g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1.2; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x, y + i * 4, (22 - i * 3) * s, 3.4 * s, 0, 3.4, 6); g.stroke(); } g.strokeStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(x, y + 12, 20 * s, 3 * s, 0, 0.2, 2.9); g.stroke(); },
    glyph(g, x, y, s, R, B) { g.strokeStyle = B.glow + '0.28)'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 11 * s, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x - 6 * s, y + 4 * s); g.lineTo(x, y - 7 * s); g.lineTo(x + 6 * s, y + 4 * s); g.closePath(); g.stroke(); g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.stroke(); },
    scarab(g, x, y, s, R) { g.save(); g.translate(x, y); g.rotate(R() * TAU); g.fillStyle = 'rgba(20,60,70,0.75)'; g.beginPath(); g.ellipse(0, 0, 3.6 * s, 5 * s, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(34,211,238,0.55)'; g.beginPath(); g.ellipse(0, 0.6, 2.2 * s, 3 * s, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.9; for (const d of [-1, 1]) for (const yy of [-3, 0, 3]) { g.beginPath(); g.moveTo(d * 3 * s, yy * s); g.lineTo(d * 6 * s, (yy + 1) * s); g.stroke(); } g.restore(); },
    icecrack(g, x, y, s, R) { g.strokeStyle = 'rgba(224,242,254,0.45)'; g.lineWidth = 1.2; const a = R() * TAU; jag(g, x, y, 36 * s, a, R, 4, 8); g.strokeStyle = 'rgba(224,242,254,0.25)'; jag(g, x + 10, y + 4, 22 * s, a + 1.2, R, 3, 7); },
    snow(g, x, y, s) { soft(g, x, y, 22 * s, 11 * s, 'rgba(240,249,255,0.7)', 0.5); },
    frost(g, x, y, s, R) { g.strokeStyle = 'rgba(224,242,254,0.5)'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9 * s, y + Math.sin(a) * 9 * s); g.stroke(); const mx = x + Math.cos(a) * 5 * s, my = y + Math.sin(a) * 5 * s; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(a + 0.7) * 3 * s, my + Math.sin(a + 0.7) * 3 * s); g.stroke(); } },
    rune(g, x, y, s, R, B, an) { g.strokeStyle = B.glow + '0.30)'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, 13 * s, 0, TAU); g.stroke(); g.setLineDash([2, 4]); g.beginPath(); g.arc(x, y, 17 * s, 0, TAU); g.stroke(); g.setLineDash([]);
      g.beginPath(); for (let i = 0; i < 5; i++) { const a = i * TAU * 2 / 5 - Math.PI / 2; const px = x + Math.cos(a) * 11 * s, py = y + Math.sin(a) * 11 * s; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.stroke(); an.push({ k: 'glow', x, y, r: 22 * s, p: R() * 6, c: B.glow }); },
    rift(g, x, y, s, R, B, an) { g.lineCap = 'round'; g.strokeStyle = '#05010f'; g.lineWidth = 4; const a = R() * TAU; const pts = jag(g, x, y, 40 * s, a, R, 4, 10); g.strokeStyle = B.glow + '0.65)'; g.lineWidth = 1.2; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); an.push({ k: 'glow', x: pts[2][0], y: pts[2][1], r: 20, p: R() * 6, c: B.glow }); },
    stars(g, x, y, s, R) { for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.6})`; g.beginPath(); g.arc(x + (R() - 0.5) * 34, y + (R() - 0.5) * 22, 0.6 + R() * 1.2, 0, TAU); g.fill(); } },
    crystalSmall(g, x, y, s, R, B, an) { for (let i = 0; i < 3; i++) { const px = x + (i - 1) * 6 * s, hh = (8 + R() * 8) * s; g.fillStyle = B.accent; g.globalAlpha = 0.75; poly(g, [[px - 2.6 * s, y + 3], [px - 1.4 * s, y + 3 - hh], [px + 1 * s, y + 3 - hh * 0.9], [px + 2.8 * s, y + 3]]); g.fill(); g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,0.6)'; poly(g, [[px - 1, y + 3], [px - 1.2 * s, y + 3 - hh], [px, y + 3 - hh * 0.95], [px + 0.3, y + 3]]); g.fill(); } an.push({ k: 'glow', x, y, r: 18 * s, p: R() * 6, c: B.glow }); },
    sparkleSpot(g, x, y, s, R, B, an) { an.push({ k: 'sparkle', x, y, p: R() * 6, s: 1 + R(), c: '#ffffff' }); },
    constellation(g, x, y, s, R) { const pts = []; for (let i = 0; i < 5; i++) pts.push([x + (R() - 0.5) * 60, y + (R() - 0.5) * 40]); g.strokeStyle = 'rgba(165,180,252,0.28)'; g.lineWidth = 1; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); for (const p of pts) { g.fillStyle = 'rgba(224,231,255,0.9)'; g.beginPath(); g.arc(p[0], p[1], 1.4 + R(), 0, TAU); g.fill(); soft(g, p[0], p[1], 7, 7, 'rgba(165,180,252,0.5)', 0.4); } },
    ring(g, x, y, s, R, B) { g.strokeStyle = B.glow + '0.20)'; g.lineWidth = 1.2; for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(x, y, 7 * i * s, 0, TAU); g.stroke(); } },
    petals(g, x, y, s, R) { for (let i = 0; i < 6; i++) { g.save(); g.translate(x + (R() - 0.5) * 26 * s, y + (R() - 0.5) * 14 * s); g.rotate(R() * TAU); g.fillStyle = R() > 0.5 ? 'rgba(249,168,212,0.7)' : 'rgba(253,230,138,0.75)'; g.beginPath(); g.ellipse(0, 0, 3 * s, 1.5 * s, 0, 0, TAU); g.fill(); g.restore(); } },
    coin(g, x, y, s, R) { g.fillStyle = '#facc15'; g.beginPath(); g.ellipse(x, y, 4 * s, 3 * s, 0, 0, TAU); g.fill(); g.strokeStyle = '#92400e'; g.lineWidth = 0.9; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - 1.5 * s, y - 1.5 * s, 2 * s, 1); },
    egg(g, x, y, s, R, B, an) { g.fillStyle = 'rgba(226,232,240,0.12)'; g.beginPath(); g.ellipse(x, y + 4, 12 * s, 5 * s, 0, 0, TAU); g.fill(); const gr = g.createRadialGradient(x - 2, y - 4, 1, x, y, 10 * s); gr.addColorStop(0, '#f5f3ff'); gr.addColorStop(0.6, '#c4b5fd'); gr.addColorStop(1, '#6d28d9'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 6 * s, 8 * s, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(x - 6 * s, y - 2); g.lineTo(x + 6 * s, y + 1); g.stroke(); an.push({ k: 'glow', x, y, r: 18 * s, p: R() * 6, c: 'rgba(196,181,253,' }); },
    lily(g, x, y, s, R) { g.fillStyle = '#3f8a3a'; g.beginPath(); g.ellipse(x, y, 8 * s, 5 * s, 0, 0.35, TAU - 0.2); g.lineTo(x, y); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.9; g.stroke(); if (R() > 0.5) { g.fillStyle = '#f9a8d4'; g.beginPath(); g.arc(x + 1, y - 1, 2.2 * s, 0, TAU); g.fill(); } },
    reeds(g, x, y, s, R) { for (let i = 0; i < 5; i++) { const bx = x + (i - 2) * 3.2 * s; g.strokeStyle = '#5f7a2c'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(bx, y + 5); g.quadraticCurveTo(bx + (R() - 0.5) * 4, y - 6 * s, bx + (R() - 0.5) * 6, y - (12 + R() * 6) * s); g.stroke(); if (R() > 0.5) { g.fillStyle = '#7c4a1d'; g.fillRect(bx - 1, y - 12 * s, 2.2, 5); } } },
    ashdrift(g, x, y, s) { soft(g, x, y, 28 * s, 11 * s, 'rgba(180,180,190,0.5)', 0.22); }
  };

  // ---- vật trang trí gắn tường: hệ toạ độ cục bộ, dải tường là y∈[-pad,0], sàn là y>0 ----
  const WALLPROP = {
    chains(g, L, R) { g.strokeStyle = '#64748b'; g.lineWidth = 2.2; for (let k = 0; k < 2; k++) { const ox = (k - 0.5) * 8; for (let y = -L + 2; y < -6; y += 6) { g.beginPath(); g.ellipse(ox, y + 3, 2, 3.2, 0, 0, TAU); g.stroke(); } } g.fillStyle = '#475569'; g.fillRect(-9, -L, 18, 4); },
    banner(g, L, R, B) { const c = [B.accent, B.trim][R() > 0.5 ? 0 : 1]; g.fillStyle = mix(c, '#000000', 0.45); poly(g, [[-9, -L + 3], [9, -L + 3], [9, -8], [0, -3], [-9, -8]]); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2; g.stroke(); g.strokeStyle = c; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-9, -L + 3); g.lineTo(9, -L + 3); g.stroke(); g.fillStyle = c; poly(g, [[0, -L + 10], [4, -L + 17], [0, -L + 24], [-4, -L + 17]]); g.fill(); },
    vines(g, L, R) { for (let k = 0; k < 3; k++) { const ox = (k - 1) * 7, len = L * (0.5 + R() * 0.8); g.strokeStyle = '#2f7a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(ox, -L); g.bezierCurveTo(ox + 5, -L + len * 0.3, ox - 5, -L + len * 0.6, ox + 2, -L + len); g.stroke(); for (let i = 1; i < 4; i++) { g.fillStyle = i % 2 ? '#4ade80' : '#22c55e'; g.beginPath(); g.ellipse(ox + (i % 2 ? 4 : -4), -L + len * i / 4, 3.4, 1.8, i % 2 ? 0.6 : -0.6, 0, TAU); g.fill(); } } },
    roots(g, L, R) { g.strokeStyle = '#5b3d22'; g.lineCap = 'round'; for (let k = 0; k < 3; k++) { g.lineWidth = 3 - k * 0.6; g.beginPath(); g.moveTo((k - 1) * 8, -L); g.bezierCurveTo((k - 1) * 14, -L * 0.6, (k - 1) * 2, -L * 0.3, (k - 1) * 10, -2 - R() * 4); g.stroke(); } },
    spikes(g, L, R, B) { for (let k = -2; k <= 2; k++) { const hh = 7 + R() * 5; g.fillStyle = mix(B.wall1, '#ffffff', 0.18); poly(g, [[k * 7 - 3.2, 0], [k * 7, hh], [k * 7 + 3.2, 0]]); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke(); } },
    icicles(g, L, R) { for (let k = -2; k <= 2; k++) { const hh = 8 + R() * 12; g.fillStyle = 'rgba(224,242,254,0.75)'; poly(g, [[k * 6 - 3, 0], [k * 6 + 0.4, hh], [k * 6 + 3, 0]]); g.fill(); g.strokeStyle = 'rgba(125,211,252,0.7)'; g.lineWidth = 0.9; g.stroke(); } },
    crystals(g, L, R, B) { for (let k = -1; k <= 1; k++) { const hh = 12 + R() * 14; g.fillStyle = rgba(B.accent, 0.8); poly(g, [[k * 8 - 4, -2], [k * 8 - 1, -2 - hh], [k * 8 + 2, -2 - hh * 0.8], [k * 8 + 5, -2]]); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.stroke(); } soft(g, 0, -10, 24, 16, B.glow + '0.5)', 0.3); },
    beams(g, L, R) { g.fillStyle = '#5a3d22'; g.fillRect(-12, -L, 24, L - 2); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.4; g.strokeRect(-12, -L, 24, L - 2); g.fillStyle = '#8a8a8a'; for (const yy of [-L + 5, -8]) { g.beginPath(); g.arc(-7, yy, 1.4, 0, TAU); g.arc(7, yy, 1.4, 0, TAU); g.fill(); } },
    lantern(g, L, R, B) { g.strokeStyle = '#6b7280'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -L); g.lineTo(0, -16); g.stroke(); g.fillStyle = '#3b2a18'; g.fillRect(-5, -16, 10, 3); g.fillRect(-5, -4, 10, 3); g.fillStyle = B.torch[0]; g.globalAlpha = 0.9; g.fillRect(-4, -13, 8, 9); g.globalAlpha = 1; soft(g, 0, -9, 22, 22, B.glow + '0.5)', 0.35); },
    glyphs(g, L, R, B) { g.strokeStyle = 'rgba(60,40,10,0.55)'; g.fillStyle = B.glow + '0.4)'; g.lineWidth = 1.4; for (let i = 0; i < 3; i++) { const y = -L + 6 + i * 11; g.strokeRect(-6, y, 12, 8); g.beginPath(); g.moveTo(-3, y + 4); g.lineTo(3, y + 4); g.stroke(); } },
    pipes(g, L, R) { for (let k = 0; k < 2; k++) { const x = -8 + k * 16; const gr = g.createLinearGradient(x - 3, 0, x + 3, 0); gr.addColorStop(0, '#78716c'); gr.addColorStop(0.5, '#d6d3d1'); gr.addColorStop(1, '#44403c'); g.fillStyle = gr; g.fillRect(x - 3, -L, 6, L - 2); g.fillStyle = '#57534e'; g.fillRect(x - 4.5, -L * 0.55, 9, 4); } },
    columns(g, L, R, B) { const gr = g.createLinearGradient(-9, 0, 9, 0); gr.addColorStop(0, mix(B.wall1, '#000', 0.2)); gr.addColorStop(0.45, mix(B.wall1, '#fff', 0.3)); gr.addColorStop(1, mix(B.wall1, '#000', 0.5)); g.fillStyle = gr; g.fillRect(-9, -L + 3, 18, L - 5); g.fillStyle = mix(B.wall1, '#fff', 0.2); g.fillRect(-11, -L, 22, 4); g.fillRect(-11, -6, 22, 4); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2; g.strokeRect(-9, -L + 3, 18, L - 5); },
    webs(g, L, R) { g.strokeStyle = 'rgba(226,232,240,0.35)'; g.lineWidth = 1; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(0, -L); g.lineTo(i * 8, 0); g.stroke(); } for (let k = 1; k <= 3; k++) { g.beginPath(); for (let i = -3; i <= 3; i++) { const px = i * 8 * k / 3, py = -L + L * k / 3 + (i % 2 ? 2 : 0); i === -3 ? g.moveTo(px, py) : g.lineTo(px, py); } g.stroke(); } },
    egg(g, L, R, B) { PROP.egg(g, 0, -L * 0.45, 0.8, R, B, []); }
  };

  // Reference corridor: a 2D painted bevel, not a perspective/physics transform.
  function buildPortraitCorridor(w, h, pad, B, seed, pixelWidth, pixelHeight) {
    const c = document.createElement('canvas'); c.width = pixelWidth; c.height = pixelHeight;
    const g = c.getContext('2d'); g.setTransform(pixelWidth / w, 0, 0, pixelHeight / h, 0, 0);
    g.fillStyle = '#98572f'; g.fillRect(0, 0, w, h);
    const stone = Object.assign({}, B, { f1: '#777c7e', f2: '#717779', floor: 'tiles' });
    for (let y = pad, row = 0; y < h - pad; y += 48, row++) {
      for (let x = pad, col = 0; x < w - pad; x += 48, col++)
        floorCell(g, stone, x, y, Math.min(48, w-pad-x), Math.min(48, h-pad-y), seed+row*31+col, col, row);
    }
    // All raised scenery stays inside the existing non-playable boundary pad.
    for (const x of [0, w-pad]) {
      g.fillStyle = '#28413c'; g.fillRect(x, pad, pad, h-pad*2);
      for (let y = pad; y < h-pad; y += 50) {
        g.fillStyle = '#566863'; g.fillRect(x+2, y+2, pad-4, 40);
        g.fillStyle = '#87938a'; g.fillRect(x+2, y+2, pad-4, 6);
        g.fillStyle = '#233a35'; g.fillRect(x+2, y+36, pad-4, 7);
      }
    }
    for (const y of [0, h-pad]) {
      g.fillStyle = '#455b51'; g.fillRect(0, y, w, pad);
      g.fillStyle = '#96a18b'; g.fillRect(0, y, w, 7);
      for (let x = 0; x < w; x += 48) {
        g.fillStyle = x % 96 ? '#ad6b35' : '#c78140'; g.fillRect(x+3, y+7, 42, Math.max(0,pad-9));
      }
    }
    const entranceW = Math.min(100, w*.23), entranceY = h-pad;
    g.fillStyle = '#371e60'; g.fillRect(w/2-entranceW/2-5, entranceY, entranceW+10, pad);
    const violet = g.createLinearGradient(0, entranceY, 0, h);
    violet.addColorStop(0, '#dc9aff'); violet.addColorStop(.35, '#a34de7'); violet.addColorStop(1, '#5e2b8d');
    g.fillStyle = violet; g.fillRect(w/2-entranceW/2, entranceY+3, entranceW, pad-3);
    g.fillStyle = '#efc9ff'; g.fillRect(w/2-entranceW/2, entranceY+3, entranceW, 3);
    return { canvas: c, anim: [] };
  }

  function buildStatic(w, h, pad, B, seed, pixelWidth = w, pixelHeight = h) {
    if (h > w * 2) return buildPortraitCorridor(w, h, pad, B, seed, pixelWidth, pixelHeight);
    const c = document.createElement('canvas'); c.width = pixelWidth; c.height = pixelHeight;
    const g = c.getContext('2d');
    g.setTransform(pixelWidth / w, 0, 0, pixelHeight / h, 0, 0);
    const R = mulberry(seed * 7919 + 17);
    const an = [];
    const ix0 = pad, iy0 = pad, iw = w - pad * 2, ih = h - pad * 2;

    // ---- tường ----
    const wg = g.createLinearGradient(0, 0, w, h);
    wg.addColorStop(0, B.wall0); wg.addColorStop(0.5, B.wall1); wg.addColorStop(1, B.wall0);
    g.fillStyle = wg; g.fillRect(0, 0, w, h);
    let k = seed;
    for (let x = 0; x < w; x += 44) { wallCell(g, B, x, 0, 44, pad, k++); wallCell(g, B, x + (k % 2 ? 22 : 0), h - pad, 44, pad, k++); }
    for (let y = pad; y < h - pad; y += 44) { wallCell(g, B, 0, y, pad, 44, k++); wallCell(g, B, w - pad, y, pad, 44, k++); }

    // ---- sàn ----
    const ts = 48;
    if (B.floor === 'grass') {
      const gg = g.createLinearGradient(0, iy0, 0, iy0 + ih); gg.addColorStop(0, mix(B.f1, '#2f5a2a', 0.5)); gg.addColorStop(1, mix(B.f2, '#1a3016', 0.4)); g.fillStyle = gg; g.fillRect(ix0, iy0, iw, ih);
    } else if (B.floor === 'sand') {
      const gg = g.createLinearGradient(0, iy0, 0, iy0 + ih); gg.addColorStop(0, B.f1); gg.addColorStop(1, B.f2); g.fillStyle = gg; g.fillRect(ix0, iy0, iw, ih);
    }
    for (let y = pad, gy = 0; y < h - pad; y += ts, gy++) {
      for (let x = pad, gx = 0; x < w - pad; x += ts, gx++) {
        floorCell(g, B, x, y, Math.min(ts, w - pad - x), Math.min(ts, h - pad - y), gx * 31 + gy * 17 + seed * 101, gx, gy);
      }
    }
    // chỉ vẽ trong lòng sàn từ đây
    g.save(); g.beginPath(); g.rect(ix0, iy0, iw, ih); g.clip();
    const RX = () => ix0 + 10 + R() * (iw - 20), RY = () => iy0 + 10 + R() * (ih - 20);

    switch (B.floor) {
      case 'grass': {
        for (let i = 0; i < 14; i++) soft(g, RX(), RY(), 38 + R() * 30, 20 + R() * 14, 'rgba(110,80,40,0.5)', 0.22);
        for (let i = 0; i < 16; i++) soft(g, RX(), RY(), 44 + R() * 26, 26, 'rgba(120,210,100,0.5)', 0.12);
        for (let i = 0; i < 90; i++) PROP.grass(g, RX(), RY(), 0.6 + R() * 0.5, R);
        break; }
      case 'sand': {
        for (let i = 0; i < 8; i++) { const yy = iy0 + (i + 0.5) / 8 * ih; g.strokeStyle = i % 2 ? 'rgba(255,240,200,0.08)' : 'rgba(60,35,10,0.10)'; g.lineWidth = 6 + R() * 8; g.beginPath(); for (let x = ix0; x <= ix0 + iw; x += 20) { const yv = yy + Math.sin(x * 0.015 + i * 1.7) * 12 + Math.sin(x * 0.04 + i) * 4; x === ix0 ? g.moveTo(x, yv) : g.lineTo(x, yv); } g.stroke(); }
        for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,240,200,${0.04 + R() * 0.06})`; g.beginPath(); g.arc(RX(), RY(), 0.8 + R() * 1.6, 0, TAU); g.fill(); }
        break; }
      case 'magma': {
        for (let i = 0; i < 9; i++) { const sx = RX(), sy = RY(), ang = R() * TAU; g.lineCap = 'round'; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 6; const pts = jag(g, sx, sy, 90 + R() * 80, ang, R, 6, 22);
          g.strokeStyle = '#ea580c'; g.lineWidth = 2.6; g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.strokeStyle = '#fde047'; g.lineWidth = 1; g.stroke();
          pts.forEach((p, j) => { if (j % 2 === 1) an.push({ k: 'glow', x: p[0], y: p[1], r: 22, p: R() * 6, c: 'rgba(251,146,60,' }); }); }
        break; }
      case 'void': {
        for (let i = 0; i < 7; i++) soft(g, RX(), RY(), 60 + R() * 60, 40 + R() * 30, i % 2 ? 'rgba(168,85,247,0.5)' : 'rgba(232,121,249,0.4)', 0.14);
        for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.6})`; const sx = RX(), sy = RY(); g.beginPath(); g.arc(sx, sy, 0.5 + R() * 1.2, 0, TAU); g.fill(); if (i % 6 === 0) an.push({ k: 'sparkle', x: sx, y: sy, p: R() * 6, s: 1, c: '#f5d0fe' }); }
        break; }
      case 'star': {
        for (let i = 0; i < 5; i++) soft(g, RX(), RY(), 70 + R() * 50, 40 + R() * 30, i % 2 ? 'rgba(99,102,241,0.5)' : 'rgba(56,189,248,0.4)', 0.12);
        g.strokeStyle = 'rgba(147,197,253,0.16)'; g.lineWidth = 1.2; for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) * 0.12 * i, 0, TAU); g.stroke(); }
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * Math.min(w, h) * 0.12, h / 2 + Math.sin(a) * Math.min(w, h) * 0.12); g.lineTo(w / 2 + Math.cos(a) * Math.min(w, h) * 0.48, h / 2 + Math.sin(a) * Math.min(w, h) * 0.48); g.stroke(); }
        for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.6})`; const sx = RX(), sy = RY(); g.beginPath(); g.arc(sx, sy, 0.5 + R() * 1.3, 0, TAU); g.fill(); if (i % 7 === 0) an.push({ k: 'sparkle', x: sx, y: sy, p: R() * 6, s: 1.2, c: '#e0e7ff' }); }
        break; }
      case 'ice': {
        const sg = g.createLinearGradient(ix0, iy0, ix0 + iw, iy0 + ih); sg.addColorStop(0, 'rgba(255,255,255,0.0)'); sg.addColorStop(0.35, 'rgba(255,255,255,0.10)'); sg.addColorStop(0.5, 'rgba(255,255,255,0)'); sg.addColorStop(0.8, 'rgba(186,230,253,0.08)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(ix0, iy0, iw, ih);
        for (const [cx, cy] of [[ix0, iy0], [ix0 + iw, iy0], [ix0, iy0 + ih], [ix0 + iw, iy0 + ih]]) soft(g, cx, cy, 80, 56, 'rgba(240,249,255,0.8)', 0.5);
        break; }
      case 'ash': { for (let i = 0; i < 12; i++) soft(g, RX(), RY(), 40 + R() * 36, 14 + R() * 10, 'rgba(190,190,200,0.5)', 0.14); for (let i = 0; i < 5; i++) soft(g, RX(), RY(), 26 + R() * 14, 14, 'rgba(0,0,0,0.6)', 0.35); break; }
      case 'swamp': { for (let i = 0; i < 10; i++) soft(g, RX(), RY(), 40 + R() * 34, 20 + R() * 12, 'rgba(60,40,20,0.5)', 0.22); for (let i = 0; i < 8; i++) soft(g, RX(), RY(), 34 + R() * 20, 18, 'rgba(120,180,60,0.5)', 0.1); break; }
      case 'rock': { for (let i = 0; i < 12; i++) soft(g, RX(), RY(), 36 + R() * 30, 18 + R() * 12, i % 2 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)', 0.1); break; }
      case 'tiles': { for (let i = 0; i < 16; i++) { const vx = RX(), vy = RY(); soft(g, vx, vy, 26, 26, B.vein + '1)', 0.2); } break; }
      case 'marble': { break; }
    }
    if (B.id === 'throne') { // thảm đỏ dẫn tới cổng
      const cw = 74, cx = w / 2 - cw / 2; const cg = g.createLinearGradient(cx, 0, cx + cw, 0); cg.addColorStop(0, '#5b0f24'); cg.addColorStop(0.5, '#9f1239'); cg.addColorStop(1, '#5b0f24');
      g.fillStyle = cg; g.fillRect(cx, iy0, cw, ih); g.strokeStyle = '#fbbf24'; g.lineWidth = 2; g.strokeRect(cx + 4, iy0 - 2, cw - 8, ih + 4); g.strokeStyle = 'rgba(253,224,71,0.3)'; g.lineWidth = 1;
      for (let y = iy0 + 14; y < iy0 + ih; y += 30) { g.beginPath(); g.moveTo(cx + 12, y); g.lineTo(w / 2, y + 8); g.lineTo(cx + cw - 12, y); g.stroke(); }
    }
    if (B.id === 'forge') { // bệ rèn tròn ở giữa
      const pr = Math.min(w, h) * 0.3; g.save(); g.translate(w / 2, h / 2 + 10);
      const pg = g.createRadialGradient(0, 0, pr * 0.2, 0, 0, pr); pg.addColorStop(0, '#3b2a22'); pg.addColorStop(1, '#17100c'); g.fillStyle = pg; g.beginPath(); g.arc(0, 0, pr, 0, TAU); g.fill();
      g.strokeStyle = '#78716c'; g.lineWidth = 4; g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * pr * 0.55, Math.sin(a) * pr * 0.55); g.lineTo(Math.cos(a) * pr, Math.sin(a) * pr); g.stroke(); }
      g.fillStyle = '#a8a29e'; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + 0.1; g.beginPath(); g.arc(Math.cos(a) * pr * 0.93, Math.sin(a) * pr * 0.93, 2, 0, TAU); g.fill(); } g.restore();
    }
    if (B.id === 'webcave') { // mạng nhện bốn góc
      for (const [cx, cy, sx, sy] of [[ix0, iy0, 1, 1], [ix0 + iw, iy0, -1, 1], [ix0, iy0 + ih, 1, -1], [ix0 + iw, iy0 + ih, -1, -1]]) {
        g.strokeStyle = 'rgba(233,213,255,0.32)'; g.lineWidth = 1.1; const L = Math.min(w, h) * 0.34;
        for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * L * sx, cy + Math.sin(a) * L * sy); g.stroke(); }
        for (let r = 1; r <= 5; r++) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2, rr = L * r / 5 * (i % 2 ? 0.9 : 1); const px = cx + Math.cos(a) * rr * sx, py = cy + Math.sin(a) * rr * sy; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
      }
    }

    // ---- vật trang trí sàn ----
    const nProps = Math.round(iw * ih / 9000) + 8;
    for (let i = 0; i < nProps; i++) {
      const id = B.props[Math.floor(R() * B.props.length)], px = RX(), py = RY();
      if (Math.abs(px - w / 2) < 46 && py < iy0 + 60) continue;       // chừa lối cổng
      PROP[id](g, px, py, 0.75 + R() * 0.6, R, B, an);
    }
    g.restore();

    // ---- bóng tường đổ lên sàn ----
    const sh = (x0, y0, x1, y1, rx, ry, rw, rh) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(rx, ry, rw, rh); };
    sh(0, pad, 0, pad + 38, pad, pad, w - pad * 2, 38);
    sh(0, h - pad, 0, h - pad - 24, pad, h - pad - 24, w - pad * 2, 24);
    sh(pad, 0, pad + 26, 0, pad, pad, 26, h - pad * 2);
    sh(w - pad, 0, w - pad - 26, 0, w - pad - 26, pad, 26, h - pad * 2);

    // ---- vật gắn tường ----
    const placeWall = (id, edge, t) => {
      g.save();
      if (edge === 0) { g.translate(t, pad); }
      else if (edge === 1) { g.translate(t, h - pad); g.rotate(Math.PI); }
      else if (edge === 2) { g.translate(pad, t); g.rotate(-Math.PI / 2); }
      else { g.translate(w - pad, t); g.rotate(Math.PI / 2); }
      g.beginPath(); g.rect(-30, -pad, 60, pad + 18); g.clip();
      WALLPROP[id](g, pad, R, B); g.restore();
    };
    for (let i = 0; i < 6; i++) {
      const id = B.wallProps[i % B.wallProps.length];
      placeWall(id, 0, 50 + (i + R() * 0.7) * (w - 100) / 6);
      if (R() > 0.35) placeWall(B.wallProps[(i + 1) % B.wallProps.length], 1, 60 + (i + R() * 0.7) * (w - 120) / 6);
    }
    for (let i = 0; i < 3; i++) { placeWall(B.wallProps[(i + 1) % B.wallProps.length], 2, 90 + (i + R() * 0.5) * (h - 180) / 3); placeWall(B.wallProps[i % B.wallProps.length], 3, 90 + (i + R() * 0.5) * (h - 180) / 3); }

    // ---- khung kim loại + viền ----
    g.strokeStyle = B.trim; g.globalAlpha = 0.55; g.lineWidth = 3; g.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    g.globalAlpha = 0.2; g.lineWidth = 8; g.strokeRect(pad - 4, pad - 4, w - pad * 2 + 8, h - pad * 2 + 8); g.globalAlpha = 1;
    // hoa văn góc
    for (const [cx, cy, a] of [[pad, pad, 0], [w - pad, pad, Math.PI / 2], [w - pad, h - pad, Math.PI], [pad, h - pad, -Math.PI / 2]]) {
      g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = B.trim; g.globalAlpha = 0.8; poly(g, [[0, 0], [16, 0], [0, 16]]); g.fill(); g.globalAlpha = 1; g.fillStyle = mix(B.wall0, '#000', 0.4); poly(g, [[0, 0], [9, 0], [0, 9]]); g.fill(); g.restore();
    }
    // vignette
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.62)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    return { canvas: c, anim: an.slice(0, 90) };
  }

  // ======================================================================
  //  LỚP ĐỘNG: ánh sáng, đuốc, sương, hạt môi trường, pháp trận, cổng, vật cản
  // ======================================================================
  let cache = null, cacheKey = '', curBiome = BIOMES.stone, hudKey = '';
  const addMode = ctx => { ctx.globalCompositeOperation = 'lighter'; };

  function applyHudTheme(B) {
    try {
      const el = typeof document !== 'undefined' && document.getElementById && document.getElementById('gameArenaView');
      if (el && el.style && hudKey !== B.id) { el.style.setProperty('--hv2-accent', B.accent); el.style.setProperty('--hv2-trim', B.trim); hudKey = B.id; }
    } catch (e) { /* chỉ là màu HUD, bỏ qua lỗi */ }
  }

  function drawAnim(ctx, list, now, B) {
    const t = now * 0.001, add = true;
    ctx.save(); addMode(ctx);
    for (const a of list) {
      if (a.k === 'glow') {
        const f = 0.55 + 0.45 * Math.sin(t * 2.2 + a.p);
        const gr = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r);
        gr.addColorStop(0, a.c + (0.32 * f) + ')'); gr.addColorStop(1, a.c + '0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill();
      } else if (a.k === 'sparkle') {
        const f = Math.max(0, Math.sin(t * 2.4 + a.p * 3)); if (f < 0.05) continue;
        ctx.strokeStyle = `rgba(255,255,255,${0.15 + f * 0.7})`; ctx.lineWidth = 1.2; const s = (2 + f * 4) * (a.s || 1);
        ctx.beginPath(); ctx.moveTo(a.x - s, a.y); ctx.lineTo(a.x + s, a.y); ctx.moveTo(a.x, a.y - s); ctx.lineTo(a.x, a.y + s); ctx.stroke();
      } else if (a.k === 'flame') {
        const f = 0.8 + Math.sin(t * 14 + a.p) * 0.2, s = a.s || 1;
        ctx.fillStyle = 'rgba(251,146,60,0.9)'; ctx.beginPath(); ctx.moveTo(a.x - 2 * s, a.y + 1); ctx.quadraticCurveTo(a.x + Math.sin(t * 9 + a.p), a.y - 9 * f * s, a.x + 2 * s, a.y + 1); ctx.fill();
        const gr = ctx.createRadialGradient(a.x, a.y - 2, 0, a.x, a.y - 2, 14 * s); gr.addColorStop(0, a.c + '0.35)'); gr.addColorStop(1, a.c + '0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(a.x, a.y - 2, 14 * s, 0, TAU); ctx.fill();
      } else if (a.k === 'ripple') {
        const k = ((t * 0.35 + a.p) % 1); ctx.strokeStyle = a.c + (0.35 * (1 - k)) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r * (0.3 + k), a.r * (0.3 + k) * 0.45, 0, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawCenterSigil(ctx, w, h, now, B) {
    ctx.save(); ctx.translate(w / 2, h / 2 + 10);
    const R0 = Math.min(w, h) * 0.27;
    if (B.id === 'forge') {
      ctx.rotate(now * 0.0004); const pr = Math.min(w, h) * 0.3;
      ctx.strokeStyle = 'rgba(251,146,60,0.55)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r1 = pr * 1.02, r2 = pr * (i % 2 ? 1.12 : 1.05); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a + 0.06) * r2, Math.sin(a + 0.06) * r2); ctx.lineTo(Math.cos(a + 0.13) * r2, Math.sin(a + 0.13) * r2); } ctx.closePath(); ctx.stroke();
      ctx.rotate(-now * 0.0009); addMode(ctx); const pg = ctx.createRadialGradient(0, 0, 4, 0, 0, pr * 0.5); pg.addColorStop(0, 'rgba(253,224,71,0.35)'); pg.addColorStop(1, 'rgba(249,115,22,0)'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, pr * 0.5, 0, TAU); ctx.fill();
    } else if (B.id === 'throne') {
      ctx.rotate(now * 0.00018); ctx.strokeStyle = 'rgba(251,113,133,0.40)'; ctx.lineWidth = 2.4; ctx.shadowColor = '#e11d48'; ctx.shadowBlur = Game.ultraGfx ? 12 : 0;
      ctx.beginPath(); ctx.arc(0, 0, R0 * 1.05, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, R0 * 0.93, 0, TAU); ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU * 2 / 5 - Math.PI / 2; const x = Math.cos(a) * R0 * 0.93, y = Math.sin(a) * R0 * 0.93; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      ctx.setLineDash([3, 8]); ctx.rotate(-now * 0.0005); ctx.beginPath(); ctx.arc(0, 0, R0 * 1.2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    } else if (B.id === 'webcave') {
      ctx.rotate(now * 0.00012); ctx.strokeStyle = 'rgba(233,213,255,0.28)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R0 * 1.15, Math.sin(a) * R0 * 1.15); ctx.stroke(); }
      for (let r = 1; r <= 5; r++) { ctx.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU, rr = R0 * 1.15 * r / 5 * (i % 2 ? 0.93 : 1); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    } else {
      ctx.lineWidth = 2; ctx.strokeStyle = B.glow + '0.16)'; ctx.rotate(now * 0.00022);
      ctx.beginPath(); ctx.arc(0, 0, R0, 0, TAU); ctx.stroke();
      ctx.setLineDash([3, 9]); ctx.beginPath(); ctx.arc(0, 0, R0 * 1.12, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.rotate(-now * 0.0005);
      for (let t = 0; t < 2; t++) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + t * Math.PI / 3; const x = Math.cos(a) * R0 * 0.78, y = Math.sin(a) * R0 * 0.78; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ---- hạt môi trường: tính thẳng từ thời gian, không cần lưu trạng thái ----
  function drawAmbient(ctx, w, h, pad, now, B) {
    const t = now * 0.001, N = Game.ultraGfx ? 34 : 22, kind = B.ambient;
    const x0 = pad, y0 = pad, iw = w - pad * 2, ih = h - pad * 2;
    ctx.save();
    for (let i = 0; i < N; i++) {
      const a = hash(i * 3.17 + 1.3), b = hash(i * 5.91 + 7.7), c = hash(i * 2.33 + 4.1);
      if (kind === 'dust') {
        const x = x0 + wrap(a * iw + Math.sin(t * 0.3 + i) * 14 + t * 5, iw), y = y0 + wrap(b * ih - t * (4 + c * 6), ih);
        ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.12 * Math.sin(t + i)})`; ctx.beginPath(); ctx.arc(x, y, 0.9 + c * 1.4, 0, TAU); ctx.fill();
      } else if (kind === 'fireflies') {
        const x = x0 + wrap(a * iw + Math.sin(t * 0.5 + i * 2) * 28, iw), y = y0 + wrap(b * ih + Math.cos(t * 0.4 + i) * 22, ih), f = Math.max(0, Math.sin(t * 1.6 + i * 3));
        ctx.save(); addMode(ctx); const gr = ctx.createRadialGradient(x, y, 0, x, y, 9); gr.addColorStop(0, `rgba(217,249,157,${0.9 * f})`); gr.addColorStop(1, 'rgba(217,249,157,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); ctx.restore();
      } else if (kind === 'embers') {
        const sp = 18 + c * 30, x = x0 + wrap(a * iw + Math.sin(t * 1.2 + i) * 12, iw), y = y0 + wrap(b * ih - t * sp, ih), f = 1 - (y - y0) / ih * 0.3;
        ctx.save(); addMode(ctx); ctx.fillStyle = `rgba(${c > 0.5 ? '251,146,60' : '253,224,71'},${0.75 * f})`; ctx.beginPath(); ctx.arc(x, y, 1 + c * 1.6, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(251,146,60,${0.25 * f})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sin(t * 1.2 + i) * 2, y + 7); ctx.stroke(); ctx.restore();
      } else if (kind === 'snow') {
        const x = x0 + wrap(a * iw + t * 9 + Math.sin(t * 0.8 + i) * 12, iw), y = y0 + wrap(b * ih + t * (16 + c * 22), ih);
        ctx.fillStyle = `rgba(240,249,255,${0.5 + 0.3 * c})`; ctx.beginPath(); ctx.arc(x, y, 1 + c * 1.8, 0, TAU); ctx.fill();
      } else if (kind === 'spores') {
        const x = x0 + wrap(a * iw + Math.sin(t * 0.6 + i * 2) * 16, iw), y = y0 + wrap(b * ih - t * (6 + c * 8), ih), f = 0.5 + 0.5 * Math.sin(t + i);
        ctx.strokeStyle = B.glow + (0.2 + 0.25 * f) + ')'; ctx.fillStyle = B.glow + (0.08 + 0.1 * f) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 2 + c * 3.4, 0, TAU); ctx.fill(); ctx.stroke();
      } else if (kind === 'stars') {
        const x = x0 + a * iw, y = y0 + b * ih, f = 0.3 + 0.7 * Math.max(0, Math.sin(t * (1 + c * 2) + i * 4));
        ctx.fillStyle = `rgba(255,255,255,${0.7 * f})`; ctx.beginPath(); ctx.arc(x, y, 0.7 + c * 1.1, 0, TAU); ctx.fill();
        if (i % 5 === 0) { ctx.strokeStyle = `rgba(224,231,255,${0.5 * f})`; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x - 4 * f, y); ctx.lineTo(x + 4 * f, y); ctx.moveTo(x, y - 4 * f); ctx.lineTo(x, y + 4 * f); ctx.stroke(); }
      } else if (kind === 'sand') {
        const x = x0 + wrap(a * iw + t * (30 + c * 40), iw), y = y0 + b * ih + Math.sin(t + i) * 4;
        ctx.strokeStyle = `rgba(255,236,190,${0.10 + 0.10 * c})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10 - c * 12, y + 0.6); ctx.stroke();
      } else if (kind === 'ash') {
        const x = x0 + wrap(a * iw + Math.sin(t * 0.7 + i) * 18 + t * 4, iw), y = y0 + wrap(b * ih + t * (10 + c * 12), ih);
        ctx.fillStyle = `rgba(200,200,208,${0.3 + 0.2 * c})`; ctx.save(); ctx.translate(x, y); ctx.rotate(t + i); ctx.fillRect(-1.2, -0.8, 2.6 + c * 1.6, 1.6); ctx.restore();
      } else if (kind === 'souls') {
        const k = wrap(t * 0.08 + a, 1), x = x0 + wrap(b * iw + Math.sin(t * 0.7 + i) * 16, iw), y = y0 + ih * (1 - k), f = Math.sin(k * Math.PI);
        ctx.save(); addMode(ctx); const gr = ctx.createRadialGradient(x, y, 0, x, y, 12); gr.addColorStop(0, `rgba(196,181,253,${0.55 * f})`); gr.addColorStop(1, 'rgba(196,181,253,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(221,214,254,${0.25 * f})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y + 8, x - 2, y + 16); ctx.stroke(); ctx.restore();
      } else if (kind === 'sparkle') {
        const x = x0 + a * iw, y = y0 + b * ih, f = Math.max(0, Math.sin(t * 1.8 + i * 5)); if (f < 0.1) continue;
        ctx.save(); addMode(ctx); ctx.strokeStyle = `rgba(255,255,255,${0.8 * f})`; ctx.lineWidth = 1.2; const s = 2 + f * 5; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawFog(ctx, w, h, now, B) {
    const t = now * 0.00004;
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const cx = w * (0.5 + 0.55 * Math.sin(t * (1.3 + i) * TAU + i * 2)), cy = h * (0.4 + 0.3 * Math.cos(t * (1.1 + i) * TAU + i)), r = Math.max(w, h) * 0.55;
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, B.fog + '0.07)'); gr.addColorStop(1, B.fog + '0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  // hiệu ứng riêng của đấu trường boss
  function drawArenaSpecial(ctx, w, h, pad, now, B) {
    const t = now * 0.001;
    // Quỹ đạo cung hoàng đạo chuyển động: vẽ mỗi frame trên ctx, không ở nền cache.
    if (B.zodiac) {
      // Quỹ đạo sao, tia sáng và vệt sao chuyển động theo thời gian; không tạo DOM mỗi khung hình.
      const cx = w / 2, cy = h / 2, radius = Math.min(w, h) * .34;
      ctx.save(); ctx.translate(cx, cy);
      for (let ring = 0; ring < 3; ring++) {
        const rr = radius * (.55 + ring * .2), turn = t * (.12 + ring * .07) * (ring % 2 ? -1 : 1);
        ctx.strokeStyle = rgba(B.accent, .2 + .11 * Math.sin(t * 1.3 + ring)); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * .55, turn, 0, TAU); ctx.stroke();
        for (let j = 0; j < 4; j++) {
          const a = j * TAU / 4 + turn;
          orb(ctx, Math.cos(a) * rr, Math.sin(a) * rr * .55, 5 + ring * 2, B.trim, .45);
        }
      }
      ctx.fillStyle = rgba(B.trim, .38 + .13 * Math.sin(t * 2));
      ctx.font = `bold ${Math.round(radius * .78)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(B.zodiac, 0, 0); ctx.restore();
    }

    if (B.id === 'forge') {   // 4 lỗ xì hơi nóng ở góc, phun theo nhịp
      const vents = [[pad + 26, h - pad - 26], [w - pad - 26, h - pad - 26], [pad + 26, pad + 70], [w - pad - 26, pad + 70]];
      vents.forEach(([vx, vy], i) => {
        ctx.fillStyle = '#0a0503'; ctx.beginPath(); ctx.ellipse(vx, vy, 13, 6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#78716c'; ctx.lineWidth = 2; ctx.stroke();
        const k = wrap(t * 0.28 + i * 0.27, 1); if (k > 0.5) return; const f = Math.sin(k / 0.5 * Math.PI);
        ctx.save(); addMode(ctx); const gr = ctx.createRadialGradient(vx, vy, 0, vx, vy, 26); gr.addColorStop(0, `rgba(251,146,60,${0.55 * f})`); gr.addColorStop(1, 'rgba(251,146,60,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(vx, vy, 26, 0, TAU); ctx.fill(); ctx.restore();
        for (let j = 0; j < 4; j++) { const q = (k / 0.5 + j * 0.25) % 1; ctx.fillStyle = `rgba(214,211,209,${0.22 * (1 - q) * f})`; ctx.beginPath(); ctx.arc(vx + Math.sin(j * 2 + t) * 5, vy - q * 46, 5 + q * 9, 0, TAU); ctx.fill(); }
      });
    } else if (B.id === 'webcave') {   // sợi tơ rủ xuống đung đưa
      for (let i = 0; i < 7; i++) {
        const x = pad + (i + 0.5) / 7 * (w - pad * 2), len = 40 + hash(i * 3) * 70, sw = Math.sin(t * 0.9 + i * 1.7) * 6;
        ctx.strokeStyle = 'rgba(233,213,255,0.32)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, pad); ctx.quadraticCurveTo(x + sw * 0.4, pad + len * 0.5, x + sw, pad + len); ctx.stroke();
        ctx.fillStyle = 'rgba(233,213,255,0.7)'; ctx.beginPath(); ctx.arc(x + sw, pad + len + 1, 1.8, 0, TAU); ctx.fill();
      }
    } else if (B.id === 'throne') {   // trăng máu mờ phía trên + hai dải sáng đỏ
      ctx.save(); addMode(ctx); const f = 0.7 + 0.3 * Math.sin(t * 1.4); const gr = ctx.createRadialGradient(w / 2, pad, 4, w / 2, pad, Math.min(w, h) * 0.55); gr.addColorStop(0, `rgba(225,29,72,${0.22 * f})`); gr.addColorStop(1, 'rgba(225,29,72,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); ctx.restore();
    }
  }

  // ---------- Đuốc theo kiểu biome ----------
  function drawTorch(ctx, t, now, B) {
    if (root.ArtemisPixelFX?.drawTorch(ctx, t, now, Game, B)) return;
    const fl = 0.82 + Math.sin(now * 0.016 + t.phase) * 0.12 + Math.sin(now * 0.037 + t.phase * 2) * 0.06;
    const style = B.torchStyle, big = style === 'brazier';
    const lr = (Game.ultraGfx ? 110 : 74) * fl * (big ? 1.25 : 1);
    ctx.save(); if (Game.ultraGfx) addMode(ctx);
    const lg = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, lr);
    lg.addColorStop(0, B.glow + '0.40)'); lg.addColorStop(0.5, B.glow + '0.12)'); lg.addColorStop(1, B.glow + '0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(t.x, t.y, lr, 0, TAU); ctx.fill(); ctx.restore();
    const flame = (x, y, s) => {
      ctx.fillStyle = B.torch[1]; ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 2); ctx.quadraticCurveTo(x + Math.sin(now * 0.02 + t.phase) * 3, y - 18 * fl * s, x + 5 * s, y - 2); ctx.fill();
      ctx.fillStyle = B.torch[0]; ctx.beginPath(); ctx.moveTo(x - 2.6 * s, y - 2); ctx.quadraticCurveTo(x, y - 10 * fl * s, x + 2.6 * s, y - 2); ctx.fill();
    };
    if (style === 'brazier') {
      ctx.fillStyle = '#1c1917'; ctx.strokeStyle = B.trim; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(t.x - 10, t.y - 2); ctx.lineTo(t.x + 10, t.y - 2); ctx.lineTo(t.x + 6, t.y + 7); ctx.lineTo(t.x - 6, t.y + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(t.x - 1.5, t.y + 7, 3, 6); ctx.fillRect(t.x - 6, t.y + 12, 12, 2.4); flame(t.x, t.y - 1, 1.35);
    } else if (style === 'lantern') {
      ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(t.x, t.y - 16); ctx.lineTo(t.x, t.y - 8); ctx.stroke();
      ctx.fillStyle = '#2a1d10'; ctx.fillRect(t.x - 6, t.y - 8, 12, 3); ctx.fillRect(t.x - 6, t.y + 5, 12, 3);
      ctx.fillStyle = B.torch[0]; ctx.globalAlpha = 0.55 + 0.35 * fl; ctx.fillRect(t.x - 5, t.y - 5, 10, 10); ctx.globalAlpha = 1; ctx.strokeStyle = '#2a1d10'; ctx.lineWidth = 1.2; ctx.strokeRect(t.x - 5, t.y - 5, 10, 10); ctx.beginPath(); ctx.moveTo(t.x, t.y - 5); ctx.lineTo(t.x, t.y + 5); ctx.stroke();
    } else if (style === 'wisp' || style === 'spirit') {
      const bob = Math.sin(now * 0.003 + t.phase) * 3;
      ctx.save(); addMode(ctx); const gr = ctx.createRadialGradient(t.x, t.y + bob, 0, t.x, t.y + bob, 14); gr.addColorStop(0, B.torch[0]); gr.addColorStop(0.4, B.torch[1]); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(t.x, t.y + bob, 14, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = B.torch[0]; ctx.beginPath(); ctx.moveTo(t.x - 5, t.y + bob + 2); ctx.quadraticCurveTo(t.x, t.y + bob - 15 * fl, t.x + 5, t.y + bob + 2); ctx.quadraticCurveTo(t.x, t.y + bob + 8, t.x - 5, t.y + bob + 2); ctx.fill();
      if (style === 'spirit') { ctx.fillStyle = '#1e1b4b'; ctx.beginPath(); ctx.arc(t.x - 1.8, t.y + bob - 2, 1, 0, TAU); ctx.arc(t.x + 1.8, t.y + bob - 2, 1, 0, TAU); ctx.fill(); }
    } else if (style === 'crystal' || style === 'void') {
      const pulse = 0.6 + 0.4 * Math.sin(now * 0.004 + t.phase), spin = style === 'void' ? now * 0.002 + t.phase : 0;
      ctx.fillStyle = '#0b1020'; ctx.strokeStyle = B.trim; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.roundRect(t.x - 7, t.y + 2, 14, 7, 3); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(t.x, t.y - 6); ctx.rotate(spin); ctx.fillStyle = style === 'void' ? B.torch[1] : B.torch[1]; ctx.globalAlpha = 0.5 + 0.5 * pulse;
      poly(ctx, [[0, -12], [6, 0], [0, 9], [-6, 0]]); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = B.torch[0]; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
      if (style === 'void') { for (let i = 0; i < 3; i++) { const a = now * 0.003 + i * TAU / 3 + t.phase; ctx.fillStyle = B.torch[0]; ctx.beginPath(); ctx.arc(t.x + Math.cos(a) * 11, t.y - 6 + Math.sin(a) * 4, 1.4, 0, TAU); ctx.fill(); } }
    } else {
      ctx.fillStyle = '#0b1020'; ctx.strokeStyle = B.trim; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(t.x - 7, t.y - 3, 14, 12, 3); ctx.fill(); ctx.stroke(); flame(t.x, t.y, 1);
    }
  }

  // ---------- Cổng qua phòng ----------
  function drawPortal(ctx, nowMs, B) {
    const pr = Game.portalRect, cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2;
    const portrait = Game.height > Game.width * 2;
    const pA = portrait ? '#fffbe2' : B.trim, pB = portrait ? '#ffe47d' : mix(B.accent, '#000000', 0.5);
    ctx.save();
    for (const sx of [pr.x - 12, pr.x + pr.w + 2]) {
      const gr = ctx.createLinearGradient(sx, 0, sx + 10, 0); gr.addColorStop(0, '#475569'); gr.addColorStop(1, '#1e293b');
      ctx.fillStyle = gr; ctx.strokeStyle = B.trim; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect(sx, pr.y - 6, 10, pr.h + 16, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = Game.portalOpen ? '#fef08a' : '#ef4444'; ctx.beginPath(); ctx.arc(sx + 5, pr.y + 2, 2.8, 0, TAU); ctx.fill();
    }
    if (Game.portalOpen) {
      const pulse = 0.75 + 0.25 * Math.sin(nowMs * 0.008);
      ctx.save(); if (Game.ultraGfx) addMode(ctx);
      const gl = ctx.createRadialGradient(cx, cy + 4, 4, cx, cy + 4, 92 * pulse);
      gl.addColorStop(0, 'rgba(254,240,138,0.9)'); gl.addColorStop(0.4, B.glow + '0.5)'); gl.addColorStop(1, B.glow + '0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy + 4, 92 * pulse, 0, TAU); ctx.fill(); ctx.restore();
      if (!root.ArtemisPixelFX?.drawPortal(ctx, pr, nowMs, Game)) {
      const pf = ctx.createLinearGradient(pr.x, pr.y, pr.x, pr.y + pr.h); pf.addColorStop(0, pA); pf.addColorStop(1, pB);
      ctx.fillStyle = pf; ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 12); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 12); ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(nowMs * 0.004); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.ellipse(0, 0, pr.w * 0.38, pr.h * 0.34, 0, 0, TAU); ctx.stroke(); ctx.restore();
      const off = (nowMs * 0.03) % 14; ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 2; i++) { const yy = pr.y + pr.h - 6 - off - i * 14; if (yy > pr.y + 2 && yy < pr.y + pr.h) { ctx.beginPath(); ctx.moveTo(cx - 7, yy + 5); ctx.lineTo(cx, yy - 3); ctx.lineTo(cx + 7, yy + 5); ctx.lineTo(cx, yy + 1); ctx.closePath(); ctx.fill(); } }
      }
      ctx.save(); ctx.translate(cx, pr.y + pr.h + 36 + Math.sin(nowMs * .004) * 4);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#52635c'; ctx.lineWidth = 3;
      poly(ctx, [[0,-22],[19,-3],[8,-3],[8,15],[-8,15],[-8,-3],[-19,-3]]); ctx.stroke(); ctx.fill();
      ctx.font = '900 17px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4;
      ctx.strokeText('Tiến Lên', 0, 39); ctx.fillText('Tiến Lên', 0, 39); ctx.restore();
      const bl = Math.min(Game.height * 0.5, 330), top = pr.y + pr.h;
      ctx.save(); if (Game.ultraGfx) addMode(ctx);
      const bm = ctx.createLinearGradient(0, top, 0, top + bl); bm.addColorStop(0, B.glow + '0.45)'); bm.addColorStop(1, B.glow + '0)');
      ctx.fillStyle = bm; ctx.beginPath(); ctx.moveTo(cx - pr.w * 0.42, top); ctx.lineTo(cx + pr.w * 0.42, top); ctx.lineTo(cx + pr.w * 0.9, top + bl); ctx.lineTo(cx - pr.w * 0.9, top + bl); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 4; i++) { const t = ((nowMs * 0.00045 + i / 4) % 1), yy = top + bl * (1 - t), a = Math.sin(t * Math.PI); ctx.strokeStyle = `rgba(254,240,138,${a * 0.9})`; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 11, yy + 7); ctx.lineTo(cx, yy - 5); ctx.lineTo(cx + 11, yy + 7); ctx.stroke(); }
      ctx.restore();
    } else {
      ctx.fillStyle = '#05080f'; ctx.strokeStyle = '#475569'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 10); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 2.2; for (let gx = pr.x + 12; gx < pr.x + pr.w - 6; gx += 12) { ctx.beginPath(); ctx.moveTo(gx, pr.y + 3); ctx.lineTo(gx, pr.y + pr.h - 3); ctx.stroke(); }
      ctx.fillStyle = `rgba(239,68,68,${0.55 + 0.3 * Math.sin(nowMs * 0.006)})`; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ======================================================================
  //  VẬT CẢN — vẫn đúng hình chữ nhật va chạm {x,y,w,h}, chỉ khác diện mạo
  // ======================================================================
  const CAP = { forest: 'rgba(90,185,90,0.85)', swamp: 'rgba(120,165,60,0.85)', ice: 'rgba(245,250,255,0.95)', crystal: 'rgba(207,250,254,0.6)', mine: 'rgba(0,0,0,0)' };
  const shade = (ctx, x, y, w) => { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x, y, w, Math.max(5, w * 0.22), 0, 0, TAU); ctx.fill(); };
  const glowAt = (ctx, x, y, r, col, a) => { ctx.save(); if (Game.ultraGfx) addMode(ctx); const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col + a + ')'); g.addColorStop(1, col + '0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); };

  const OB = {
    block(ctx, o, now, B) {
      const lift = 9; shade(ctx, o.x + o.w / 2 + 4, o.y + o.h + 3, o.w * 0.62);
      const fr = ctx.createLinearGradient(0, o.y, 0, o.y + o.h); fr.addColorStop(0, B.ob0); fr.addColorStop(1, B.ob1);
      ctx.fillStyle = fr; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, 6); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; for (let yy = o.y + 12; yy < o.y + o.h - 4; yy += 12) { ctx.beginPath(); ctx.moveTo(o.x + 3, yy); ctx.lineTo(o.x + o.w - 3, yy); ctx.stroke(); }
      const tg = ctx.createLinearGradient(0, o.y - lift, 0, o.y + o.h * 0.5); tg.addColorStop(0, B.obTop); tg.addColorStop(1, B.ob0);
      ctx.fillStyle = tg; ctx.strokeStyle = B.trim; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(o.x - 2, o.y - lift, o.w + 4, Math.max(14, o.h * 0.5), 6); ctx.fill(); ctx.stroke();
      const rp = 0.5 + 0.5 * Math.sin(now * 0.005 + o.x * 0.05), cx = o.x + o.w / 2, cy = o.y - lift + Math.max(14, o.h * 0.5) / 2;
      ctx.save(); if (Game.ultraGfx) addMode(ctx); ctx.strokeStyle = B.glow + (0.35 + rp * 0.55) + ')'; ctx.lineWidth = 1.8; ctx.shadowColor = B.accent; ctx.shadowBlur = Game.ultraGfx ? 8 : 0;
      ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx, cy - 5.5); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx, cy + 5.5); ctx.closePath(); ctx.stroke(); ctx.restore();
    },
    crate(ctx, o) {
      shade(ctx, o.x + o.w / 2 + 3, o.y + o.h + 3, o.w * 0.62);
      const x = o.x, y = o.y - 2, w = o.w, h = o.h + 2, tp = 10;
      const fr = ctx.createLinearGradient(0, y, 0, y + h); fr.addColorStop(0, '#9a6a35'); fr.addColorStop(1, '#5c3a1b');
      ctx.fillStyle = fr; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.6; ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; for (let yy = y + 10; yy < y + h; yy += 10) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
      ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + w - 4, y + h - 4); ctx.moveTo(x + w - 4, y + 4); ctx.lineTo(x + 4, y + h - 4); ctx.stroke();
      ctx.strokeStyle = '#a16b36'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#c08a4e'; poly(ctx, [[x - 2, y], [x + 4, y - tp], [x + w + 2, y - tp], [x + w + 2, y]]); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#6b7280'; for (const [cx, cy] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) { ctx.beginPath(); ctx.arc(cx, cy, 2, 0, TAU); ctx.fill(); }
    },
    barrel(ctx, o) {
      const cx = o.x + o.w / 2, bw = Math.min(o.w, o.h * 1.15) * 0.5, top = o.y - 8, bot = o.y + o.h;
      shade(ctx, cx + 3, bot + 3, bw * 1.25);
      const gr = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0); gr.addColorStop(0, '#5c3a1b'); gr.addColorStop(0.45, '#a8733a'); gr.addColorStop(1, '#4a2c14');
      ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - bw * 0.85, top); ctx.quadraticCurveTo(cx - bw * 1.2, (top + bot) / 2, cx - bw * 0.85, bot); ctx.lineTo(cx + bw * 0.85, bot); ctx.quadraticCurveTo(cx + bw * 1.2, (top + bot) / 2, cx + bw * 0.85, top); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#374151'; ctx.lineWidth = 2.6; for (const f of [0.25, 0.75]) { const yy = top + (bot - top) * f; ctx.beginPath(); ctx.moveTo(cx - bw * 1.08, yy); ctx.quadraticCurveTo(cx, yy + 4, cx + bw * 1.08, yy); ctx.stroke(); }
      ctx.fillStyle = '#c28a4a'; ctx.beginPath(); ctx.ellipse(cx, top, bw * 0.88, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, top, bw * 0.5, 3, 0, 0, TAU); ctx.stroke();
    },
    pillar(ctx, o, now, B) {
      const cx = o.x + o.w / 2, pw = Math.min(o.w * 0.78, 40), top = o.y - 16, bot = o.y + o.h;
      shade(ctx, cx + 3, bot + 3, pw * 0.9);
      const gr = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0); gr.addColorStop(0, B.ob1); gr.addColorStop(0.4, B.obTop); gr.addColorStop(1, B.ob1);
      ctx.fillStyle = gr; ctx.fillRect(cx - pw / 2, top, pw, bot - top); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - pw / 2, top, pw, bot - top);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; for (const f of [-0.2, 0.2]) { ctx.beginPath(); ctx.moveTo(cx + pw * f, top + 6); ctx.lineTo(cx + pw * f, bot - 4); ctx.stroke(); }
      ctx.fillStyle = B.obTop; ctx.beginPath(); ctx.roundRect(cx - pw / 2 - 4, top - 5, pw + 8, 9, 3); ctx.fill(); ctx.strokeStyle = B.trim; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = B.ob0; ctx.beginPath(); ctx.roundRect(cx - pw / 2 - 4, bot - 6, pw + 8, 8, 3); ctx.fill(); ctx.stroke();
      const rp = 0.5 + 0.5 * Math.sin(now * 0.004 + o.x * 0.1); ctx.save(); if (Game.ultraGfx) addMode(ctx); ctx.strokeStyle = B.glow + (0.3 + rp * 0.6) + ')'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 6, top + 14); ctx.lineTo(cx, top + 8); ctx.lineTo(cx + 6, top + 14); ctx.lineTo(cx, top + 22); ctx.closePath(); ctx.stroke(); ctx.restore();
    },
    rock(ctx, o, now, B, sd) {
      const cx = o.x + o.w / 2, cy = o.y + o.h * 0.42, rx = o.w * 0.58, ry = o.h * 0.78;
      shade(ctx, cx + 4, o.y + o.h + 3, rx * 1.05);
      const pts = []; const n = 9; for (let i = 0; i < n; i++) { const a = i / n * TAU - Math.PI / 2, k = 0.82 + hash(sd * 19 + i * 7) * 0.3; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
      const base = B.ob0;
      pts.forEach((p, i) => { const q = pts[(i + 1) % n]; const nx = (p[0] + q[0]) / 2 - cx, ny = (p[1] + q[1]) / 2 - cy; const lit = clamp((-nx * 0.5 - ny * 0.8) / Math.hypot(nx, ny), -1, 1);
        ctx.fillStyle = mix(base, lit > 0 ? '#ffffff' : '#000000', Math.abs(lit) * 0.3 + 0.04); poly(ctx, [[cx, cy - ry * 0.05], p, q]); ctx.fill(); });
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.6; poly(ctx, pts); ctx.stroke();
      const cap = CAP[B.id]; if (cap && cap !== 'rgba(0,0,0,0)') { ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(cx - rx * 0.1, cy - ry * 0.55, rx * 0.62, ry * 0.26, -0.1, Math.PI, TAU); ctx.fill(); }
      if (B.id === 'lava' || B.id === 'canyon') { ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx - rx * 0.3, cy - ry * 0.2); ctx.lineTo(cx, cy + ry * 0.1); ctx.lineTo(cx + rx * 0.25, cy + ry * 0.35); ctx.stroke(); glowAt(ctx, cx, cy + ry * 0.1, rx * 0.6, 'rgba(251,146,60,', 0.2 + 0.1 * Math.sin(now * 0.004 + sd * 9)); }
    },
    stump(ctx, o, now, B, sd) {
      const cx = o.x + o.w / 2, sw = o.w * 0.46, top = o.y - 3, bot = o.y + o.h;
      shade(ctx, cx + 3, bot + 3, sw * 1.35);
      ctx.strokeStyle = '#3a2614'; ctx.lineCap = 'round'; ctx.lineWidth = 5; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + d * sw * 0.7, bot - 6); ctx.quadraticCurveTo(cx + d * sw * 1.2, bot, cx + d * sw * 1.5, bot + 2); ctx.stroke(); }
      const gr = ctx.createLinearGradient(cx - sw, 0, cx + sw, 0); gr.addColorStop(0, '#3b2814'); gr.addColorStop(0.45, '#7a5430'); gr.addColorStop(1, '#2f1f0f');
      ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - sw, top); ctx.lineTo(cx - sw * 1.1, bot - 4); ctx.quadraticCurveTo(cx, bot + 4, cx + sw * 1.1, bot - 4); ctx.lineTo(cx + sw, top); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#b98a58'; ctx.beginPath(); ctx.ellipse(cx, top, sw, 7, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(80,50,20,0.55)'; ctx.lineWidth = 1; for (const k of [0.65, 0.35]) { ctx.beginPath(); ctx.ellipse(cx, top, sw * k, 7 * k, 0, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = 'rgba(90,185,90,0.8)'; ctx.beginPath(); ctx.ellipse(cx + sw * 0.55, top + 9, 6, 3, 0.3, 0, TAU); ctx.fill();
    },
    bush(ctx, o, now, B, sd) {
      const cx = o.x + o.w / 2, cy = o.y + o.h * 0.5; shade(ctx, cx + 3, o.y + o.h + 3, o.w * 0.62);
      const blobs = [[-0.28, 0.15, 0.36], [0.28, 0.12, 0.38], [0, -0.22, 0.4], [-0.1, 0.3, 0.34], [0.2, 0.34, 0.3], [-0.4, -0.12, 0.28]];
      blobs.forEach(([bx, by, br], i) => { const r = br * Math.max(o.w, o.h * 1.2); const gr = ctx.createRadialGradient(cx + bx * o.w - r * 0.3, cy + by * o.h - r * 0.4, 1, cx + bx * o.w, cy + by * o.h, r); gr.addColorStop(0, i % 2 ? '#6bbf4a' : '#58a83e'); gr.addColorStop(1, '#1d4d1c'); ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx + bx * o.w, cy + by * o.h, r, 0, TAU); ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = '#ef4444'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + (hash(sd + i) - 0.5) * o.w * 0.7, cy + (hash(sd + i + 5) - 0.5) * o.h * 0.6, 2, 0, TAU); ctx.fill(); }
    },
    mushroomBig(ctx, o, now, B, sd) {
      const cx = o.x + o.w / 2, bot = o.y + o.h, cap = o.w * 0.62; shade(ctx, cx + 3, bot + 3, o.w * 0.5);
      const swamp = B.id === 'swamp', c0 = swamp ? '#a3e635' : '#f43f5e', c1 = swamp ? '#3f6212' : '#7f1d1d';
      ctx.fillStyle = '#f5f0e6'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx - 6, bot); ctx.quadraticCurveTo(cx - 8, o.y + o.h * 0.4, cx - 5, o.y + 4); ctx.lineTo(cx + 5, o.y + 4); ctx.quadraticCurveTo(cx + 8, o.y + o.h * 0.4, cx + 6, bot); ctx.closePath(); ctx.fill(); ctx.stroke();
      glowAt(ctx, cx, o.y - 4, cap * 1.3, swamp ? 'rgba(190,242,100,' : 'rgba(251,113,133,', 0.25 + 0.1 * Math.sin(now * 0.004 + sd * 5));
      const gr = ctx.createRadialGradient(cx - cap * 0.3, o.y - 10, 2, cx, o.y, cap); gr.addColorStop(0, c0); gr.addColorStop(1, c1); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(cx, o.y + 2, cap, cap * 0.62, 0, Math.PI, TAU); ctx.quadraticCurveTo(cx, o.y + 12, cx - cap, o.y + 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const [dx, dy, r] of [[-0.45, -0.28, 3.2], [0.1, -0.42, 4], [0.5, -0.22, 2.8]]) { ctx.beginPath(); ctx.arc(cx + dx * cap, o.y + dy * cap, r, 0, TAU); ctx.fill(); }
    },
    crystal(ctx, o, now, B, sd) {
      const cx = o.x + o.w / 2, bot = o.y + o.h; shade(ctx, cx + 3, bot + 3, o.w * 0.55);
      const spec = [[-0.26, 0.62, 0.17], [0.28, 0.55, 0.16], [0, 1.05, 0.22], [-0.1, 0.8, 0.14], [0.14, 0.78, 0.12]];
      glowAt(ctx, cx, o.y + o.h * 0.3, o.w * 0.9, B.glow, 0.25 + 0.12 * Math.sin(now * 0.004 + sd * 8));
      spec.forEach(([dx, hh, ww], i) => { const x = cx + dx * o.w, H = hh * (o.h + 26), W = ww * o.w * 1.4; const gr = ctx.createLinearGradient(x - W, 0, x + W, 0); gr.addColorStop(0, mix(B.accent, '#000000', 0.5)); gr.addColorStop(0.5, mix(B.accent, '#ffffff', 0.35)); gr.addColorStop(1, mix(B.accent, '#000000', 0.35));
        ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2; poly(ctx, [[x - W, bot], [x - W * 0.6, bot - H * 0.75], [x, bot - H], [x + W * 0.6, bot - H * 0.75], [x + W, bot]]); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; poly(ctx, [[x - W * 0.5, bot - 2], [x - W * 0.45, bot - H * 0.7], [x - W * 0.1, bot - H * 0.92], [x - W * 0.05, bot - 2]]); ctx.fill(); });
    },
    ice(ctx, o, now, B, sd) {
      const cx = o.x + o.w / 2, bot = o.y + o.h; shade(ctx, cx + 3, bot + 3, o.w * 0.58);
      const spec = [[-0.3, 0.7, 0.2], [0.3, 0.6, 0.19], [0, 1.0, 0.26]];
      spec.forEach(([dx, hh, ww]) => { const x = cx + dx * o.w, H = hh * (o.h + 20), W = ww * o.w * 1.3; const gr = ctx.createLinearGradient(x - W, bot - H, x + W, bot); gr.addColorStop(0, 'rgba(240,249,255,0.95)'); gr.addColorStop(0.5, 'rgba(147,210,250,0.9)'); gr.addColorStop(1, 'rgba(56,130,190,0.95)');
        ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(224,242,254,0.9)'; ctx.lineWidth = 1.2; poly(ctx, [[x - W, bot], [x - W * 0.5, bot - H * 0.8], [x - W * 0.1, bot - H], [x + W * 0.7, bot - H * 0.7], [x + W, bot]]); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(x - W * 0.4, bot - H * 0.15); ctx.lineTo(x - W * 0.2, bot - H * 0.7); ctx.stroke(); });
      const sp = Math.max(0, Math.sin(now * 0.003 + sd * 11)); if (sp > 0.2) { ctx.save(); addMode(ctx); ctx.strokeStyle = `rgba(255,255,255,${sp})`; ctx.lineWidth = 1.2; const sx = cx + 4, sy = o.y + 2; ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.lineTo(sx + 4, sy); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx, sy + 4); ctx.stroke(); ctx.restore(); }
    },
    coffin(ctx, o, now, B) {
      const cx = o.x + o.w / 2, top = o.y - 8, bot = o.y + o.h, hw = o.w * 0.46; shade(ctx, cx + 3, bot + 3, hw * 1.3);
      const fr = ctx.createLinearGradient(0, top, 0, bot); fr.addColorStop(0, B.ob0); fr.addColorStop(1, B.ob1); ctx.fillStyle = fr; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.6;
      poly(ctx, [[cx - hw * 0.6, top], [cx + hw * 0.6, top], [cx + hw, top + (bot - top) * 0.28], [cx + hw * 0.7, bot], [cx - hw * 0.7, bot], [cx - hw, top + (bot - top) * 0.28]]); ctx.fill(); ctx.stroke();
      ctx.fillStyle = B.obTop; poly(ctx, [[cx - hw * 0.5, top + 3], [cx + hw * 0.5, top + 3], [cx + hw * 0.82, top + (bot - top) * 0.3], [cx + hw * 0.55, bot - (bot - top) * 0.45], [cx - hw * 0.55, bot - (bot - top) * 0.45], [cx - hw * 0.82, top + (bot - top) * 0.3]]); ctx.fill(); ctx.strokeStyle = B.trim; ctx.lineWidth = 1.2; ctx.stroke();
      const rp = 0.5 + 0.5 * Math.sin(now * 0.004 + o.x); ctx.save(); if (Game.ultraGfx) addMode(ctx); ctx.strokeStyle = B.glow + (0.4 + rp * 0.5) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, top + 6); ctx.lineTo(cx, top + (bot - top) * 0.5); ctx.moveTo(cx - 6, top + 14); ctx.lineTo(cx + 6, top + 14); ctx.stroke(); ctx.restore();
    },
    statue(ctx, o, now, B) {
      const cx = o.x + o.w / 2, bot = o.y + o.h, pw = o.w * 0.78; shade(ctx, cx + 3, bot + 3, pw * 0.75);
      const stone = B.obTop;
      ctx.fillStyle = B.ob0; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(cx - pw / 2, bot - 14, pw, 14, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = stone; ctx.beginPath(); ctx.roundRect(cx - pw * 0.4, bot - 22, pw * 0.8, 9, 2); ctx.fill(); ctx.stroke();
      const gr = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0); gr.addColorStop(0, mix(stone, '#000', 0.35)); gr.addColorStop(0.5, mix(stone, '#fff', 0.25)); gr.addColorStop(1, mix(stone, '#000', 0.4)); ctx.fillStyle = gr;
      poly(ctx, [[cx - 9, bot - 22], [cx - 7, bot - 44], [cx + 7, bot - 44], [cx + 9, bot - 22]]); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 7, bot - 42); ctx.lineTo(cx - 15, bot - 30); ctx.moveTo(cx + 7, bot - 42); ctx.lineTo(cx + 12, bot - 54); ctx.lineWidth = 4.5; ctx.strokeStyle = mix(stone, '#000', 0.25); ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, bot - 50, 6.5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = B.glow + '0.9)'; ctx.beginPath(); ctx.arc(cx - 2.2, bot - 50, 1, 0, TAU); ctx.arc(cx + 2.2, bot - 50, 1, 0, TAU); ctx.fill();
      glowAt(ctx, cx + 12, bot - 54, 12, B.glow, 0.25 + 0.15 * Math.sin(now * 0.005));
    },
    obelisk(ctx, o, now, B, sd) {
      const cx = o.x + o.w / 2, bot = o.y + o.h, ow = o.w * 0.44, top = o.y - 26; shade(ctx, cx + 3, bot + 3, ow * 1.3);
      const gr = ctx.createLinearGradient(cx - ow, 0, cx + ow, 0); gr.addColorStop(0, B.ob1); gr.addColorStop(0.45, B.obTop); gr.addColorStop(1, B.ob1);
      ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; poly(ctx, [[cx - ow, bot], [cx - ow * 0.6, top + 12], [cx, top - 4], [cx + ow * 0.6, top + 12], [cx + ow, bot]]); ctx.fill(); ctx.stroke();
      ctx.fillStyle = B.ob0; ctx.beginPath(); ctx.roundRect(cx - ow * 1.2, bot - 6, ow * 2.4, 8, 2); ctx.fill(); ctx.stroke();
      const rp = 0.4 + 0.6 * Math.sin(now * 0.0035 + sd * 7) ** 2; ctx.save(); if (Game.ultraGfx) addMode(ctx); ctx.strokeStyle = B.glow + (0.35 + rp * 0.55) + ')'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) { const yy = top + 22 + i * 14; ctx.beginPath(); ctx.moveTo(cx - 4, yy); ctx.lineTo(cx + 4, yy); ctx.moveTo(cx, yy - 4); ctx.lineTo(cx, yy + 4); ctx.stroke(); } ctx.restore();
    },
    cactus(ctx, o, now, B, sd) {
      const cx = o.x + o.w / 2, bot = o.y + o.h, top = o.y - 18, cw = o.w * 0.22; shade(ctx, cx + 3, bot + 3, o.w * 0.5);
      const gr = ctx.createLinearGradient(cx - cw, 0, cx + cw, 0); gr.addColorStop(0, '#2f7a3a'); gr.addColorStop(0.5, '#5bb15a'); gr.addColorStop(1, '#215a2b'); ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect(cx - cw, top, cw * 2, bot - top, cw); ctx.fill(); ctx.stroke();
      for (const [d, y1, y2] of [[-1, 0.55, 0.2], [1, 0.45, 0.1]]) { const yy = top + (bot - top) * y1, yt = top + (bot - top) * y2; ctx.beginPath(); ctx.roundRect(cx + d * cw * 0.2, yy - cw * 0.7, d * cw * 2.3, cw * 1.4, cw * 0.7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(cx + d * cw * 2.3 - cw * 0.7, yt, cw * 1.4, yy - yt, cw * 0.7); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.9; for (let i = 0; i < 6; i++) { const yy = top + 6 + i * (bot - top - 8) / 6; ctx.beginPath(); ctx.moveTo(cx - 2, yy); ctx.lineTo(cx - 5, yy - 2); ctx.moveTo(cx + 2, yy + 2); ctx.lineTo(cx + 5, yy); ctx.stroke(); }
      ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(cx, top - 1, 3.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(cx, top - 1, 1.3, 0, TAU); ctx.fill();
    },
    deadtree(ctx, o, now, B, sd) {
      const cx = o.x + o.w / 2, bot = o.y + o.h, top = o.y - 22; shade(ctx, cx + 3, bot + 3, o.w * 0.5);
      ctx.strokeStyle = '#2b1e14'; ctx.lineCap = 'round'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(cx, bot); ctx.quadraticCurveTo(cx + 3, (bot + top) / 2, cx - 2, top + 8); ctx.stroke(); ctx.strokeStyle = '#4a3322'; ctx.lineWidth = 4; ctx.stroke();
      const br = [[-1, 0.35, 22, 0.5], [1, 0.5, 20, 0.4], [-1, 0.65, 14, 0.8], [1, 0.2, 16, 0.5]];
      for (const [d, f, L, up] of br) { const by = bot - (bot - top) * (1 - f) + (bot - top) * 0, y0 = top + (bot - top) * f; ctx.strokeStyle = '#2b1e14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, y0 + 6); ctx.quadraticCurveTo(cx + d * L * 0.5, y0 - L * up * 0.5, cx + d * L, y0 - L * up); ctx.stroke(); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx + d * L * 0.75, y0 - L * up * 0.7); ctx.lineTo(cx + d * (L + 6), y0 - L * up - 5); ctx.stroke(); }
    },
    bonesPile(ctx, o, now, B, sd) {
      const cx = o.x + o.w / 2, bot = o.y + o.h; shade(ctx, cx + 3, bot + 3, o.w * 0.58);
      ctx.strokeStyle = '#e7e5e4'; ctx.lineCap = 'round'; ctx.lineWidth = 3.4; for (let i = 0; i < 7; i++) { const a = hash(sd * 3 + i) * Math.PI, x = cx + (hash(sd + i * 2) - 0.5) * o.w * 0.6, y = o.y + o.h * (0.3 + hash(sd + i * 5) * 0.6); ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 11, y - Math.sin(a) * 5); ctx.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 5); ctx.stroke(); }
      ctx.fillStyle = '#f1f5f9'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(cx, o.y + o.h * 0.35, 10, 9, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillRect(cx - 5, o.y + o.h * 0.35 + 7, 10, 6); ctx.fillStyle = '#0c0a14'; ctx.beginPath(); ctx.arc(cx - 3.5, o.y + o.h * 0.35, 2.6, 0, TAU); ctx.arc(cx + 3.5, o.y + o.h * 0.35, 2.6, 0, TAU); ctx.fill();
      glowAt(ctx, cx - 3.5, o.y + o.h * 0.35, 8, 'rgba(248,113,113,', 0.4); glowAt(ctx, cx + 3.5, o.y + o.h * 0.35, 8, 'rgba(248,113,113,', 0.4);
    },
    ore(ctx, o, now, B, sd) {
      OB.rock(ctx, o, now, { id: 'mine', ob0: '#5a4636' }, sd);
      const cx = o.x + o.w / 2, cy = o.y + o.h * 0.42; const f = 0.5 + 0.5 * Math.sin(now * 0.004 + sd * 6);
      glowAt(ctx, cx, cy, o.w * 0.7, 'rgba(251,191,36,', 0.2 + 0.2 * f);
      for (const [dx, dy, s] of [[-0.2, -0.15, 1], [0.18, 0.05, 1.2], [-0.05, 0.22, 0.8]]) { const x = cx + dx * o.w, y = cy + dy * o.h; ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1; poly(ctx, [[x, y - 7 * s], [x + 4 * s, y], [x, y + 4 * s], [x - 4 * s, y]]); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; poly(ctx, [[x, y - 7 * s], [x + 1.5 * s, y - 2], [x - 1.5 * s, y - 1]]); ctx.fill(); }
    }
  };
  OB.crystalRed = OB.crystal;

  function drawObstacle(ctx, ob, nowMs, B) {
    const sd = hash(ob.x * 0.37 + ob.y * 1.13 + (Game.room || 1) * 3.1);
    const st = B.obstacles[Math.floor(sd * B.obstacles.length) % B.obstacles.length];
    ctx.save(); (OB[st] || OB.block)(ctx, ob, nowMs, B, sd); ctx.restore();
  }

  function drawArena(ctx, w, h, pad, nowMs, chId) {
    const B = pickBiome(); curBiome = B;
    const seed = (Game.room || 1) * 131 + ((chId | 0) % 1000) * 7;
    // Cache duy nhất có cùng mật độ với canvas đích (DPR đã giới hạn ở viewport).
    const pw = Number.isFinite(ctx.canvas?.width) && ctx.canvas.width > 0 ? ctx.canvas.width : w;
    const viewHeight = h > w * 2 ? w * 16 / 9 : h;
    const ph = Number.isFinite(ctx.canvas?.height) && ctx.canvas.height > 0 ? Math.ceil(ctx.canvas.height * h / viewHeight) : h;
    const key = `${w}x${h}|${pad}|${B.id}|${seed}|${pw}x${ph}`;
    if (key !== cacheKey) { cache = buildStatic(w, h, pad, B, seed, pw, ph); cacheKey = key; applyHudTheme(B); }
    ctx.drawImage(cache.canvas, 0, 0, cache.canvas.width, cache.canvas.height, 0, 0, w, h);
    // Chỉ dùng nền biome; bỏ lớp ảnh map phủ để sân khớp vùng va chạm thực tế.
    drawAnim(ctx, cache.anim, nowMs, B);
    if (h <= w * 2) drawCenterSigil(ctx, w, h, nowMs, B);
    drawArenaSpecial(ctx, w, h, pad, nowMs, B);
    drawFog(ctx, w, h, nowMs, B);
    root.ArtemisPixelFX?.drawAtmosphere(ctx, w, h, pad, nowMs, Game, B);
    root.ArtemisMapJuice?.scenery(ctx, Game, B);

    // vết chiến trường (giữ dữ liệu cũ)
    for (const dc of Game.floorDecals) {
      ctx.save(); ctx.globalAlpha = Math.min(1, dc.life / 2.5) * 0.75; ctx.translate(dc.x, dc.y); ctx.rotate(dc.rot); ctx.scale(1, 0.65);
      const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, dc.r);
      gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, dc.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, dc.r, 0, TAU); ctx.fill(); ctx.restore();
    }

    // Phòng trùm: viền đập nhịp tim, màu theo trùm
    if (Game.enemies.some(e => e.isBoss)) {
      const p = 0.5 + 0.5 * Math.sin(nowMs * 0.006), c = B.boss === 'queen' ? '168,85,247' : (B.boss === 'golem' ? '249,115,22' : '225,29,72');
      const bg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      bg.addColorStop(0, `rgba(${c},0)`); bg.addColorStop(1, `rgba(${c},${0.14 + p * 0.16})`);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    }
    for (const t of Game.wallTorches) drawTorch(ctx, t, nowMs, B);
    drawPortal(ctx, nowMs, B);
    for (const ob of Game.obstacles) drawObstacle(ctx, ob, nowMs, B);
    drawAmbient(ctx, w, h, pad, nowMs, B);
    if (typeof ArtemisLeoAnimation !== 'undefined') {
      ArtemisLeoAnimation.rememberRoom(Game);
      ArtemisLeoAnimation.drawDeathAfterRemoval(ctx, Game, nowMs);
    }
    if (typeof ArtemisLeoSubBossSprites !== 'undefined') {
      ArtemisLeoSubBossSprites.drawDeathAfterRemoval(ctx, Game, nowMs, drawLeoSubBoss);
    }
    root.ArtemisContentRuntime?.drawDeathAfterRemoval(ctx,Game,nowMs);
  }

  // ======================================================================
  //  QUÁI VẬT — mỗi biome một skin; thân vẽ có bóng đổ, viền sáng, phụ kiện riêng
  // ======================================================================
  // [slime c0,c1,deco] [goblin c0,c1,deco] [mage áo, xương, quả cầu] [hoa cánh0, cánh1, nhụy] [dơi thân, cánh, mắt]
  const SK = {
    stone:   { slime: ['#4ade80', '#15803d', 'none'],   goblin: ['#a3e635', '#3f6212', 'none'],   mage: ['#4c1d95', '#e2e8f0', '#a78bfa'], plant: ['#f472b6', '#9d174d', '#fb7185'], bat: ['#a78bfa', '#4c1d95', '#fecaca'] },
    forest:  { slime: ['#86efac', '#166534', 'leaf'],   goblin: ['#65a30d', '#365314', 'hood'],   mage: ['#14532d', '#d9f99d', '#86efac'], plant: ['#facc15', '#a16207', '#f97316'], bat: ['#4ade80', '#14532d', '#fef08a'] },
    mine:    { slime: ['#fbbf24', '#92400e', 'ore'],    goblin: ['#a8a29e', '#44403c', 'helmet'], mage: ['#78350f', '#fde68a', '#f59e0b'], plant: ['#fb923c', '#7c2d12', '#fbbf24'], bat: ['#a8a29e', '#292524', '#fde047'] },
    swamp:   { slime: ['#a3e635', '#3f6212', 'bubbles'], goblin: ['#84cc16', '#3f6212', 'zombie'], mage: ['#365314', '#d9f99d', '#84cc16'], plant: ['#c084fc', '#581c87', '#a3e635'], bat: ['#65a30d', '#1a2e05', '#d9f99d'] },
    crypt:   { slime: ['#bae6fd', '#475569', 'skull'],  goblin: ['#e5e7eb', '#6b7280', 'bone'],   mage: ['#312e81', '#f1f5f9', '#818cf8'], plant: ['#a78bfa', '#4c1d95', '#e9d5ff'], bat: ['#cbd5e1', '#334155', '#7dd3fc'] },
    lava:    { slime: ['#fb923c', '#b91c1c', 'magma'],  goblin: ['#ef4444', '#7f1d1d', 'horns'],  mage: ['#7f1d1d', '#fecaca', '#f97316'], plant: ['#f97316', '#9a3412', '#fde047'], bat: ['#f97316', '#450a0a', '#fde047'] },
    desert:  { slime: ['#fde68a', '#b45309', 'scarab'], goblin: ['#d6b36a', '#78350f', 'turban'], mage: ['#92400e', '#fef3c7', '#f59e0b'], plant: ['#4ade80', '#166534', '#f472b6'], bat: ['#d4a24a', '#78350f', '#fef3c7'] },
    ash:     { slime: ['#9ca3af', '#374151', 'ember'],  goblin: ['#6b7280', '#1f2937', 'horns'],  mage: ['#1f2937', '#d1d5db', '#f87171'], plant: ['#9ca3af', '#374151', '#ef4444'], bat: ['#6b7280', '#111827', '#f87171'] },
    canyon:  { slime: ['#fdba74', '#9a3412', 'rock'],   goblin: ['#c2410c', '#431407', 'helmet'], mage: ['#7c2d12', '#fed7aa', '#fb923c'], plant: ['#fb923c', '#9a3412', '#fde68a'], bat: ['#c2410c', '#431407', '#fed7aa'] },
    void:    { slime: ['#c084fc', '#581c87', 'stars'],  goblin: ['#7c3aed', '#2e1065', 'horns'],  mage: ['#3b0764', '#f5d0fe', '#e879f9'], plant: ['#e879f9', '#701a75', '#f0abfc'], bat: ['#a855f7', '#2e1065', '#f0abfc'] },
    crystal: { slime: ['#67e8f9', '#0e7490', 'shards'], goblin: ['#22d3ee', '#164e63', 'shards'], mage: ['#164e63', '#cffafe', '#22d3ee'], plant: ['#a5f3fc', '#0e7490', '#e0f2fe'], bat: ['#67e8f9', '#083344', '#ecfeff'] },
    ice:     { slime: ['#bae6fd', '#0369a1', 'frost'],  goblin: ['#93c5fd', '#1e3a8a', 'hood'],   mage: ['#1e3a8a', '#e0f2fe', '#7dd3fc'], plant: ['#bae6fd', '#0c4a6e', '#e0f2fe'], bat: ['#bae6fd', '#0c4a6e', '#ffffff'] },
    astral:  { slime: ['#818cf8', '#312e81', 'stars'],  goblin: ['#6366f1', '#1e1b4b', 'halo'],   mage: ['#1e1b4b', '#e0e7ff', '#818cf8'], plant: ['#a5b4fc', '#3730a3', '#fde047'], bat: ['#6366f1', '#1e1b4b', '#fde047'] },
    temple:  { slime: ['#fde047', '#a16207', 'halo'],   goblin: ['#facc15', '#713f12', 'crown'],  mage: ['#713f12', '#fef9c3', '#facc15'], plant: ['#fde68a', '#a16207', '#f97316'], bat: ['#facc15', '#422006', '#ffffff'] }
  };
  const TYPEKEY = { slime: 'slime', goblin: 'goblin', skeleton_mage: 'mage', plant_turret: 'plant', bat: 'bat' };
  const skinOf = (B, type) => (SK[B.skin] || SK.stone)[TYPEKEY[type]];
  const AURA_T = { slime: 0, goblin: 0, skeleton_mage: 0, plant_turret: 0, bat: 0, dragon_whelp: '#22d3ee', cloud_wisp: '#67e8f9', sky_sentinel: '#a5f3fc', rift_stalker: '#c084fc', eclipse_oracle: '#f0abfc', obsidian_brute: '#34d399', nebula_herald: '#22d3ee', frost_sentinel: '#7dd3fc', star_wraith: '#818cf8', golem: '#f97316', queen: '#a855f7', demon_king: '#e11d48', elder_dragon: '#67e8f9', eclipse_sovereign: '#c084fc', astral_devourer: '#818cf8', spore_runner: '#5eead4', mire_shaman: '#c084fc', hive_guardian: '#fb7185', mycelium_queen: '#a3e635', zodiac_aries: '#fb7185', zodiac_taurus: '#fbbf24', zodiac_gemini: '#67e8f9', zodiac_cancer: '#38bdf8', zodiac_leo: '#fbbf24', zodiac_virgo: '#d9f99d', zodiac_libra: '#f0abfc', zodiac_scorpio: '#c084fc', zodiac_sagittarius: '#a5b4fc', zodiac_capricorn: '#7dd3fc', zodiac_aquarius: '#22d3ee', zodiac_pisces: '#5eead4' };

  const eyes = (ctx, x, y, s, col = '#fff', pupil = '#0f172a') => {
    for (const d of [-1, 1]) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x + d * s * 1.1, y, s * 0.72, s * 0.9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = pupil; ctx.beginPath(); ctx.arc(x + d * s * 1.1 + 0.6, y + 0.5, s * 0.38, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x + d * s * 1.1 - 0.4, y - 0.8, s * 0.16, 0, TAU); ctx.fill(); }
  };
  const orb = (ctx, x, y, r, col, a = 1) => {
    ctx.save(); if (Game.ultraGfx) addMode(ctx);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#fff'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  };
  const blob = (ctx, r, c0, c1) => {
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.15); g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
  };
  const rim = (ctx, path, col = 'rgba(255,255,255,0.35)') => { ctx.save(); path(); ctx.clip(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.translate(1.2, 1.6); path(); ctx.stroke(); ctx.restore(); };

  function drawSlime(ctx, r, t, sk) {
    const [c0, c1, deco] = sk;
    const dome = () => { ctx.beginPath(); ctx.moveTo(-r, r * 0.55); ctx.bezierCurveTo(-r * 1.05, -r * 1.1, r * 1.05, -r * 1.1, r, r * 0.55); ctx.quadraticCurveTo(0, r * 0.95, -r, r * 0.55); };
    // phụ kiện phía sau
    if (deco === 'shards') { ctx.fillStyle = '#a5f3fc'; ctx.strokeStyle = '#0e7490'; ctx.lineWidth = 1.2; for (const [dx, hh] of [[-0.5, 0.8], [0, 1.1], [0.5, 0.75]]) { poly(ctx, [[dx * r - 4, -r * 0.45], [dx * r, -r * (0.5 + hh)], [dx * r + 4, -r * 0.45]]); ctx.fill(); ctx.stroke(); } }
    if (deco === 'frost') { ctx.fillStyle = 'rgba(224,242,254,0.95)'; ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 1; for (const [dx, hh] of [[-0.55, 0.55], [-0.15, 0.9], [0.3, 0.7], [0.65, 0.45]]) { poly(ctx, [[dx * r - 3.5, -r * 0.5], [dx * r, -r * (0.55 + hh)], [dx * r + 3.5, -r * 0.5]]); ctx.fill(); ctx.stroke(); } }
    blob(ctx, r, c0, c1); dome(); ctx.fill(); ctx.stroke();
    ctx.save(); dome(); ctx.clip();
    const bg = ctx.createLinearGradient(0, -r, 0, r); bg.addColorStop(0, 'rgba(255,255,255,0.14)'); bg.addColorStop(0.5, 'rgba(255,255,255,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.28)'); ctx.fillStyle = bg; ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
    if (deco === 'ore') { ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1; poly(ctx, [[r * 0.15, r * 0.35], [r * 0.4, r * 0.05], [r * 0.7, r * 0.3], [r * 0.5, r * 0.55]]); ctx.fill(); ctx.stroke(); }
    if (deco === 'skull') { ctx.fillStyle = 'rgba(241,245,249,0.8)'; ctx.beginPath(); ctx.ellipse(r * 0.35, r * 0.3, r * 0.25, r * 0.22, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(r * 0.28, r * 0.28, 1.4, 0, TAU); ctx.arc(r * 0.42, r * 0.28, 1.4, 0, TAU); ctx.fill(); }
    if (deco === 'scarab') { ctx.fillStyle = 'rgba(20,70,80,0.85)'; ctx.beginPath(); ctx.ellipse(r * 0.4, r * 0.3, r * 0.14, r * 0.2, 0.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.ellipse(r * 0.4, r * 0.3, r * 0.07, r * 0.11, 0.4, 0, TAU); ctx.fill(); }
    if (deco === 'stars') { for (let i = 0; i < 6; i++) { const a = hash(i * 3.3) * TAU, d = hash(i * 7.1) * r * 0.7; ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 0.004 + i)})`; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.7 + r * 0.1, 0.9 + hash(i) * 1.1, 0, TAU); ctx.fill(); } }
    if (deco === 'magma') { ctx.strokeStyle = '#fde047'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.1); ctx.lineTo(-r * 0.1, r * 0.35); ctx.lineTo(r * 0.2, r * 0.1); ctx.lineTo(r * 0.55, r * 0.4); ctx.stroke(); orb(ctx, 0, r * 0.35, r * 0.7, '#fde047', 0.55 + 0.2 * Math.sin(t * 0.008)); }
    if (deco === 'ember') { orb(ctx, 0, r * 0.4, r * 0.55, '#f87171', 0.6 + 0.2 * Math.sin(t * 0.008)); }
    if (deco === 'bubbles') { ctx.strokeStyle = 'rgba(217,249,157,0.8)'; ctx.fillStyle = 'rgba(217,249,157,0.25)'; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { const k = (t * 0.0006 + i * 0.27) % 1; ctx.beginPath(); ctx.arc(Math.sin(i * 2.1) * r * 0.5, r * 0.5 - k * r * 1.1, 1.6 + i * 0.6, 0, TAU); ctx.fill(); ctx.stroke(); } }
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(Math.sin(t * 0.002 + i * 2) * r * 0.45, r * 0.15 + Math.cos(t * 0.003 + i) * r * 0.2, 2 + i * 0.7, 0, TAU); ctx.fill(); }
    ctx.restore();
    rim(ctx, dome); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.26, r * 0.14, -0.6, 0, TAU); ctx.fill();
    eyes(ctx, 0, -r * 0.05, 3.2, '#fff', deco === 'magma' || deco === 'ember' ? '#7f1d1d' : '#0f172a');
    // phụ kiện phía trước
    if (deco === 'leaf') { ctx.strokeStyle = '#166534'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * 0.82); ctx.lineTo(0, -r * 1.15); ctx.stroke(); for (const d of [-1, 1]) { ctx.fillStyle = d > 0 ? '#4ade80' : '#22c55e'; ctx.strokeStyle = '#14532d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(d * 5, -r * 1.15 - Math.sin(t * 0.005) * 1, 6, 3, d * -0.5, 0, TAU); ctx.fill(); ctx.stroke(); } }
    if (deco === 'halo') { ctx.save(); ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2.4; ctx.shadowColor = '#fde047'; ctx.shadowBlur = Game.ultraGfx ? 8 : 0; ctx.beginPath(); ctx.ellipse(0, -r * 1.1 + Math.sin(t * 0.004) * 1.5, r * 0.5, r * 0.14, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    if (deco === 'rock') { ctx.fillStyle = '#7c4a2b'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; for (const [dx, dy] of [[-0.4, -0.65], [0.3, -0.75], [0.55, -0.4]]) { poly(ctx, [[dx * r - 5, dy * r + 3], [dx * r - 2, dy * r - 4], [dx * r + 4, dy * r - 2], [dx * r + 5, dy * r + 3]]); ctx.fill(); ctx.stroke(); } }
    if (deco === 'ember') { for (let i = 0; i < 2; i++) { ctx.fillStyle = i ? '#fde047' : '#fb923c'; ctx.beginPath(); ctx.moveTo(-4 + i * 8, -r * 0.8); ctx.quadraticCurveTo(-3 + i * 8 + Math.sin(t * 0.02 + i) * 2, -r * 1.35, 0 + i * 8 - 1, -r * 0.8); ctx.fill(); } }
    if (deco === 'magma') { ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.ellipse(r * 0.7, r * 0.7 + ((t * 0.04) % 8), 2, 3, 0, 0, TAU); ctx.fill(); }
  }

  function drawGoblin(ctx, r, t, sk, face) {
    const [c0, c1, deco] = sk;
    ctx.scale(face, 1);
    const eyeC = deco === 'zombie' ? '#fca5a5' : (deco === 'hood' || deco === 'shards' ? '#fde047' : '#fde047');
    ctx.fillStyle = c1; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * r * 0.8, -r * 0.2); ctx.lineTo(d * r * 1.6, -r * 0.75); ctx.lineTo(d * r * 0.85, r * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    // thân + áo
    ctx.fillStyle = deco === 'zombie' ? '#57534e' : (deco === 'turban' ? '#b45309' : (deco === 'bone' ? '#6b7280' : '#7c2d12')); ctx.beginPath(); ctx.roundRect(-r * 0.8, r * 0.3, r * 1.6, r * 0.75, 4); ctx.fill(); ctx.stroke();
    if (deco === 'zombie') { ctx.strokeStyle = '#d6d3d1'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.4); ctx.lineTo(-r * 0.1, r * 0.9); ctx.moveTo(r * 0.2, r * 0.4); ctx.lineTo(r * 0.35, r * 0.85); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; }
    blob(ctx, r, c0, c1); ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.95, 0, TAU); ctx.fill(); ctx.stroke();
    rim(ctx, () => { ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.95, 0, TAU); });
    // mũ / phụ kiện đầu
    if (deco === 'hood') { ctx.fillStyle = deco === 'hood' && c0 === '#93c5fd' ? '#e0f2fe' : '#4d7c0f'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 1.0, Math.PI * 1.02, TAU * 0.995); ctx.lineTo(r * 0.5, -r * 0.35); ctx.quadraticCurveTo(0, -r * 0.55, -r * 0.5, -r * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke(); poly(ctx, [[-r * 0.2, -r * 1.2], [r * 0.15, -r * 1.7], [r * 0.4, -r * 1.15]]); ctx.fill(); ctx.stroke(); }
    if (deco === 'helmet') { ctx.fillStyle = '#facc15'; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -r * 0.5, r * 0.95, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillRect(-r * 1.05, -r * 0.55, r * 2.1, 3.4); ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(0, -r * 0.95, 3.4, 0, TAU); ctx.fill(); orb(ctx, 0, -r * 0.95, 11, '#fde68a', 0.7); }
    if (deco === 'bone') { ctx.fillStyle = '#e5e7eb'; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, -r * 0.5, r * 0.98, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#9ca3af'; ctx.fillRect(-1.2, -r * 1.45, 2.4, r * 0.7); }
    if (deco === 'horns' || deco === 'shards') { ctx.fillStyle = deco === 'horns' ? '#fde68a' : '#a5f3fc'; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * r * 0.35, -r * 0.95); ctx.quadraticCurveTo(d * r * 0.95, -r * 1.2, d * r * 0.7, -r * 1.75); ctx.quadraticCurveTo(d * r * 0.5, -r * 1.2, d * r * 0.15, -r * 0.9); ctx.fill(); ctx.stroke(); } }
    if (deco === 'turban') { ctx.fillStyle = '#f5f5f4'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, -r * 0.82, r * 0.98, r * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(0, -r * 0.82, r * 0.7, 0.2, 2.9); ctx.stroke(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, -r * 0.95, 2.6, 0, TAU); ctx.fill(); }
    if (deco === 'crown') { ctx.fillStyle = '#facc15'; ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1.2; poly(ctx, [[-r * 0.7, -r * 0.8], [-r * 0.7, -r * 1.35], [-r * 0.35, -r * 1.05], [0, -r * 1.5], [r * 0.35, -r * 1.05], [r * 0.7, -r * 1.35], [r * 0.7, -r * 0.8]]); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, -r * 0.95, 2.2, 0, TAU); ctx.fill(); }
    if (deco === 'halo') { ctx.save(); ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2.4; ctx.shadowColor = '#fde047'; ctx.shadowBlur = Game.ultraGfx ? 8 : 0; ctx.beginPath(); ctx.ellipse(0, -r * 1.25 + Math.sin(t * 0.004) * 1.5, r * 0.55, r * 0.15, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    eyes(ctx, 0, -r * 0.25, 3, eyeC, deco === 'zombie' ? '#7f1d1d' : '#7f1d1d');
    ctx.strokeStyle = '#1a2e05'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.35, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = '#fff'; for (const d of [-1, 1]) { poly(ctx, [[d * r * 0.18, r * 0.3], [d * r * 0.3, r * 0.5], [d * r * 0.06, r * 0.34]]); ctx.fill(); }
    // vũ khí
    ctx.save(); ctx.translate(r * 1.05, r * 0.3); ctx.rotate(Math.sin(t * 0.008) * 0.35 - 0.5);
    ctx.fillStyle = deco === 'hood' && c0 === '#93c5fd' ? '#bae6fd' : (deco === 'horns' && c0 === '#ef4444' ? '#fb923c' : '#e2e8f0'); ctx.beginPath(); ctx.moveTo(0, -r * 0.95); ctx.lineTo(3.2, 0); ctx.lineTo(-3.2, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#92400e'; ctx.fillRect(-4.5, 0, 9, 3); ctx.restore();
  }

  function drawMage(ctx, r, t, sk) {
    const [robe, bone, orbC] = sk;
    ctx.fillStyle = robe; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 0.95, r * 0.9); ctx.quadraticCurveTo(-r * 0.7, -r * 0.2, 0, -r * 1.1); ctx.quadraticCurveTo(r * 0.7, -r * 0.2, r * 0.95, r * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = orbC; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.78); ctx.lineTo(r * 0.8, r * 0.78); ctx.stroke(); ctx.globalAlpha = 1;
    blob(ctx, r, bone, mix('#64748b', robe, 0.4)); ctx.beginPath(); ctx.ellipse(0, -r * 0.2, r * 0.58, r * 0.65, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0f172a'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * r * 0.24, -r * 0.28, 3.2, 4, 0, 0, TAU); ctx.fill(); }
    orb(ctx, -r * 0.15, -r * 0.28, 5, orbC, 0.9); orb(ctx, r * 0.15, -r * 0.28, 5, orbC, 0.9);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(-r * 0.3, r * 0.15, r * 0.6, 2.4); ctx.fillStyle = bone; for (let i = -2; i <= 2; i++) ctx.fillRect(i * r * 0.12 - 0.8, r * 0.15, 1.6, 2.4);
    ctx.fillStyle = robe; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-r * 0.62, -r * 0.55); ctx.quadraticCurveTo(0, -r * 1.2, r * 0.62, -r * 0.55); ctx.quadraticCurveTo(0, -r * 0.7, -r * 0.62, -r * 0.55); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r * 1.1, r * 0.9); ctx.lineTo(r * 1.1, -r * 0.8); ctx.stroke();
    const oy = -r * 1.0 + Math.sin(t * 0.006) * 2; orb(ctx, r * 1.1, oy, 10, orbC);
    for (let i = 0; i < 3; i++) { const a = t * 0.004 + i * TAU / 3; orb(ctx, r * 1.1 + Math.cos(a) * 9, oy + Math.sin(a) * 4, 2.6, orbC, 0.9); }
  }

  function drawPlant(ctx, r, t, sk, e) {
    const [p0, p1, core] = sk;
    const pl = Game.player, a = pl ? Math.atan2(pl.y - e.y, pl.x - e.x) : Math.PI / 2;
    ctx.strokeStyle = '#166534'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, r * 1.1); ctx.quadraticCurveTo(-4, r * 0.3, 0, 0); ctx.stroke();
    ctx.fillStyle = '#16a34a'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.4; for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * r * 0.7, r * 0.8, r * 0.55, r * 0.22, d * 0.5, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.save(); ctx.rotate(a - Math.PI / 2 + Math.sin(t * 0.005) * 0.05);
    for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * TAU / 6); ctx.fillStyle = i % 2 ? mix(p0, '#ffffff', 0.35) : p0; ctx.strokeStyle = mix(p1, '#000000', 0.3); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, -r * 0.85, r * 0.34, r * 0.62, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
    blob(ctx, r, core, p1); ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b0a14'; ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.38, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { const aa = i * TAU / 6; ctx.beginPath(); ctx.moveTo(Math.cos(aa) * r * 0.38, r * 0.1 + Math.sin(aa) * r * 0.38); ctx.lineTo(Math.cos(aa + 0.2) * r * 0.2, r * 0.1 + Math.sin(aa + 0.2) * r * 0.2); ctx.lineTo(Math.cos(aa - 0.2) * r * 0.2, r * 0.1 + Math.sin(aa - 0.2) * r * 0.2); ctx.fill(); }
    if (e.attackTimer > 0 && e.attackTimer < 0.5) orb(ctx, 0, r * 0.1, r * 0.55, core, 0.9);
    ctx.restore();
  }

  function drawBat(ctx, r, t, sk, face) {
    const [c0, c1, eye] = sk; const fl = Math.sin(t * 0.03);
    ctx.scale(face, 1);
    for (const d of [-1, 1]) { ctx.save(); ctx.scale(d, 1); ctx.rotate(fl * 0.5 * -1);
      const wg = ctx.createLinearGradient(0, 0, r * 2.2, 0); wg.addColorStop(0, c1); wg.addColorStop(1, mix(c1, '#000000', 0.6)); ctx.fillStyle = wg; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.2); ctx.quadraticCurveTo(r * 1.4, -r * 1.4, r * 2.3, -r * 0.5); ctx.quadraticCurveTo(r * 1.9, -r * 0.1, r * 1.7, r * 0.3); ctx.quadraticCurveTo(r * 1.3, 0, r * 1.0, r * 0.45); ctx.quadraticCurveTo(r * 0.7, 0.1, r * 0.3, r * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.1); ctx.lineTo(r * 1.9, -r * 0.45); ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 1.6, r * 0.25); ctx.stroke(); ctx.restore(); }
    blob(ctx, r, c0, c1); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.7, r * 0.85, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c1; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * r * 0.2, -r * 0.7); ctx.lineTo(d * r * 0.55, -r * 1.25); ctx.lineTo(d * r * 0.62, -r * 0.5); ctx.fill(); }
    eyes(ctx, 0, -r * 0.1, 2.3, eye, '#7f1d1d'); orb(ctx, -2.5, -r * 0.1, 5, eye, 0.5); orb(ctx, 2.5, -r * 0.1, 5, eye, 0.5);
    ctx.fillStyle = '#fff'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 2.5, r * 0.3); ctx.lineTo(d * 2.5 + 1.4, r * 0.62); ctx.lineTo(d * 2.5 - 1.4, r * 0.62); ctx.fill(); }
  }

  // ======================================================================
  //  BOSS — vẽ lại chi tiết; hr = % máu còn lại, charge = đang gồng đòn
  // ======================================================================
  function drawGolem(ctx, r, t, hr, charge) {
    const rage = 1 - hr, pulse = 0.75 + 0.25 * Math.sin(t * 0.009), glow = clamp(0.45 + rage * 0.7 + (charge ? 0.5 : 0), 0, 1.4);
    const rockG = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#2a1308'); g.addColorStop(0.45, '#8a4a26'); g.addColorStop(1, '#1d0d05'); return g; };
    const crack = (pts, w = 2.2) => { ctx.save(); ctx.strokeStyle = `rgba(251,146,60,${clamp(glow, 0, 1)})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = '#f97316'; ctx.shadowBlur = Game.ultraGfx ? 8 : 0; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.strokeStyle = `rgba(254,240,138,${clamp(glow, 0, 1)})`; ctx.lineWidth = w * 0.4; ctx.stroke(); ctx.restore(); };
    ctx.lineWidth = 3; ctx.strokeStyle = '#120703';
    // nắm đấm lơ lửng
    for (const d of [-1, 1]) {
      const bob = Math.sin(t * 0.006 + d) * 4, fx = d * r * 1.55, fy = r * 0.15 + bob;
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(d * (0.15 + Math.sin(t * 0.005) * 0.05));
      ctx.fillStyle = rockG(-r * 0.5, r * 0.5); ctx.beginPath(); ctx.roundRect(-r * 0.46, -r * 0.5, r * 0.92, r * 1.05, 10); ctx.fill(); ctx.stroke();
      for (let k = 0; k < 3; k++) { ctx.fillStyle = '#4a2410'; ctx.beginPath(); ctx.roundRect(-r * 0.4 + k * r * 0.28, r * 0.35, r * 0.24, r * 0.25, 4); ctx.fill(); ctx.stroke(); }
      crack([[-r * 0.2, -r * 0.35], [r * 0.02, -r * 0.05], [-r * 0.15, r * 0.2]], 2);
      ctx.restore();
      ctx.fillStyle = 'rgba(120,70,40,0.6)'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(d * r * (0.95 + k * 0.28), r * 0.1 + Math.sin(t * 0.007 + k * 2) * 5, 4 - k, 0, TAU); ctx.fill(); }
    }
    // thân
    ctx.fillStyle = rockG(-r, r); ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.55); ctx.lineTo(r * 0.95, -r * 0.55); ctx.lineTo(r * 0.75, r * 0.95); ctx.quadraticCurveTo(0, r * 1.15, -r * 0.75, r * 0.95); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.3); ctx.lineTo(r * 0.7, r * 0.3); ctx.lineTo(r * 0.75, r * 0.95); ctx.quadraticCurveTo(0, r * 1.15, -r * 0.75, r * 0.95); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,140,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.5); ctx.lineTo(r * 0.9, -r * 0.5); ctx.stroke();
    crack([[-r * 0.7, -r * 0.4], [-r * 0.45, -r * 0.05], [-r * 0.6, r * 0.35], [-r * 0.4, r * 0.8]]); crack([[r * 0.65, -r * 0.4], [r * 0.4, -r * 0.1], [r * 0.55, r * 0.4]]); crack([[-r * 0.15, r * 0.55], [r * 0.1, r * 0.75], [-r * 0.05, r * 0.95]], 1.8);
    // lõi dung nham
    ctx.fillStyle = '#1a0a03'; ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, r * 0.18, r * 0.46, 0, TAU); ctx.fill(); ctx.stroke();
    orb(ctx, 0, r * 0.18, r * (0.62 + glow * 0.25), charge ? '#ffffff' : '#fbbf24', clamp(0.8 * pulse + glow * 0.3, 0, 1));
    ctx.strokeStyle = '#fde047'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, r * 0.18, r * 0.3, t * 0.004, t * 0.004 + 4); ctx.stroke();
    // vai + gai
    for (const d of [-1, 1]) {
      ctx.save(); ctx.translate(d * r * 0.95, -r * 0.55); ctx.fillStyle = rockG(-r * 0.5, r * 0.5); ctx.strokeStyle = '#120703'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a2a12'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * r * 0.22 - 4, -r * 0.4); ctx.lineTo(k * r * 0.26 + d * 3, -r * 0.95 - Math.abs(k) * -4); ctx.lineTo(k * r * 0.22 + 5, -r * 0.4); ctx.fill(); ctx.stroke(); }
      crack([[-r * 0.2, -r * 0.1], [r * 0.05, r * 0.15], [-r * 0.05, r * 0.35]], 1.6); ctx.restore();
      if (rage > 0.4) { for (let k = 0; k < 3; k++) { const q = ((t * 0.0016 + k * 0.33 + (d > 0 ? 0.1 : 0)) % 1); ctx.fillStyle = `rgba(214,211,209,${0.3 * (1 - q)})`; ctx.beginPath(); ctx.arc(d * r * 0.95 + Math.sin(q * 6 + k) * 4, -r * 0.9 - q * 28, 3 + q * 6, 0, TAU); ctx.fill(); } }
    }
    // đầu
    const hy = -r * 1.0;
    ctx.fillStyle = rockG(-r * 0.5, r * 0.5); ctx.strokeStyle = '#120703'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-r * 0.5, hy - r * 0.45, r, r * 0.8, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a2410'; ctx.beginPath(); ctx.roundRect(-r * 0.4, hy + r * 0.16, r * 0.8, r * 0.24, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fde047'; for (let k = -2; k <= 2; k++) { poly(ctx, [[k * r * 0.14 - 2, hy + r * 0.16], [k * r * 0.14, hy + r * 0.3], [k * r * 0.14 + 2, hy + r * 0.16]]); ctx.fill(); }
    ctx.fillStyle = '#3a1a0a'; for (const d of [-1, 1]) { poly(ctx, [[d * r * 0.2, hy - r * 0.45], [d * r * 0.45, hy - r * 0.95], [d * r * 0.5, hy - r * 0.4]]); ctx.fill(); ctx.stroke(); }
    for (const d of [-1, 1]) { ctx.fillStyle = charge ? '#ffffff' : '#fde047'; poly(ctx, [[d * r * 0.08, hy - r * 0.12], [d * r * 0.4, hy - r * 0.2], [d * r * 0.34, hy + r * 0.04], [d * r * 0.08, hy]]); ctx.fill(); orb(ctx, d * r * 0.24, hy - r * 0.08, 11 + glow * 4, '#fb923c', 0.85); }
    if (rage > 0.5) { for (let k = -1; k <= 1; k++) { ctx.fillStyle = k ? '#fb923c' : '#fde047'; ctx.beginPath(); ctx.moveTo(k * r * 0.25 - 5, hy - r * 0.42); ctx.quadraticCurveTo(k * r * 0.25 + Math.sin(t * 0.02 + k) * 4, hy - r * (0.9 + (k ? 0.1 : 0.35)), k * r * 0.25 + 5, hy - r * 0.42); ctx.fill(); } }
  }

  function drawQueen(ctx, r, t, hr, charge) {
    const rage = 1 - hr, sp = 0.008 * (1 + rage * 0.9), eyeC = rage > 0.5 ? '#fb7185' : '#f0abfc', glow = 0.5 + rage * 0.5 + (charge ? 0.4 : 0);
    // 8 chân hai đốt
    for (let i = 0; i < 4; i++) for (const d of [-1, 1]) {
      const ph = Math.sin(t * sp + i * 1.4 + (d > 0 ? 1.1 : 0)), ph2 = Math.cos(t * sp + i * 1.4 + (d > 0 ? 1.1 : 0));
      const sy = r * (-0.25 + i * 0.28), kx = d * r * (1.15 + i * 0.05), ky = sy - r * (0.7 - i * 0.1) + ph * 3, fx = d * r * (1.9 + i * 0.12) + ph2 * 3, fy = sy + r * (0.25 + i * 0.28) + ph * 5;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#12051f'; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(d * r * 0.35, sy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = '#6d28d9'; ctx.lineWidth = 3.4; ctx.stroke(); ctx.strokeStyle = 'rgba(240,171,252,0.55)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#f0abfc'; ctx.beginPath(); ctx.arc(kx, ky, 2.4, 0, TAU); ctx.fill();
    }
    // bụng
    const ag = ctx.createRadialGradient(-r * 0.3, r * 0.3, r * 0.1, 0, r * 0.6, r * 1.2); ag.addColorStop(0, '#7e22ce'); ag.addColorStop(1, '#1b0a35');
    ctx.fillStyle = ag; ctx.strokeStyle = '#0d0219'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, r * 0.62, r * 0.85, r * 1.05, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, r * 0.62, r * 0.78, r * 0.98, 0, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke();
    ctx.fillStyle = '#d946ef'; ctx.globalAlpha = clamp(0.6 + glow * 0.4, 0, 1); poly(ctx, [[0, r * 0.15], [r * 0.24, r * 0.55], [0, r * 1.0], [-r * 0.24, r * 0.55]]); ctx.fill(); ctx.globalAlpha = 1; poly(ctx, [[0, r * 0.35], [r * 0.1, r * 0.55], [0, r * 0.8], [-r * 0.1, r * 0.55]]); ctx.fillStyle = '#fdf4ff'; ctx.fill();
    for (let k = 0; k < 3; k++) { ctx.strokeStyle = 'rgba(217,70,239,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, r * 0.62, r * (0.35 + k * 0.17), Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
    orb(ctx, 0, r * 0.62, r * 0.9, '#d946ef', 0.18 + 0.1 * Math.sin(t * 0.008));
    // giọt độc
    for (let k = 0; k < 2; k++) { const q = ((t * 0.001 + k * 0.5) % 1); ctx.fillStyle = `rgba(163,230,53,${0.8 * (1 - q)})`; ctx.beginPath(); ctx.ellipse((k ? 1 : -1) * r * 0.2, r * 1.5 + q * 14, 2, 3.2, 0, 0, TAU); ctx.fill(); }
    // đầu
    const hg = ctx.createRadialGradient(-r * 0.2, -r * 0.55, 2, 0, -r * 0.4, r * 0.8); hg.addColorStop(0, '#6b21a8'); hg.addColorStop(1, '#1e0a3c');
    ctx.fillStyle = hg; ctx.strokeStyle = '#0d0219'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.58, 0, TAU); ctx.fill(); ctx.stroke();
    // vương miện gai
    ctx.fillStyle = '#e879f9'; ctx.strokeStyle = '#4a044e'; ctx.lineWidth = 1.4; for (let k = -2; k <= 2; k++) { const hh = k === 0 ? 0.62 : (Math.abs(k) === 1 ? 0.46 : 0.3); poly(ctx, [[k * r * 0.22 - 4, -r * 0.85], [k * r * 0.22, -r * (0.85 + hh)], [k * r * 0.22 + 4, -r * 0.85]]); ctx.fill(); ctx.stroke(); }
    for (const [ex, ey, es] of [[-0.22, -0.5, 3.4], [0.22, -0.5, 3.4], [-0.38, -0.3, 2.2], [0.38, -0.3, 2.2], [0, -0.62, 2], [0, -0.22, 1.6]]) orb(ctx, ex * r, ey * r, es * 2.4, eyeC, clamp(glow + 0.3, 0, 1));
    // răng nanh
    const open = charge ? 0.45 : 0.12 + Math.sin(t * 0.01) * 0.05;
    ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#1e0a3c'; ctx.lineWidth = 1; for (const d of [-1, 1]) { ctx.save(); ctx.translate(d * 5, -r * 0.05); ctx.rotate(d * open); poly(ctx, [[-3, 0], [3, 0], [d * 1, r * 0.4]]); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (charge) orb(ctx, 0, r * 0.1, 10, '#a3e635', 0.9);
  }

  function drawDemon(ctx, r, t, hr, charge) {
    const rage = 1 - hr, flap = Math.sin(t * (0.005 + rage * 0.004)), glow = 0.5 + rage * 0.5 + (charge ? 0.5 : 0), wS = 1 + rage * 0.18;
    // cánh
    for (const d of [-1, 1]) { ctx.save(); ctx.scale(d, 1); ctx.rotate(flap * 0.1);
      const wg = ctx.createLinearGradient(0, 0, r * 2.6, -r); wg.addColorStop(0, '#7f1d1d'); wg.addColorStop(1, '#1c0206');
      ctx.fillStyle = wg; ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 2.2; ctx.shadowColor = '#e11d48'; ctx.shadowBlur = Game.ultraGfx ? 10 : 0;
      ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.3); ctx.lineTo(r * 2.6 * wS, -r * 1.7 * wS); ctx.lineTo(r * 2.15 * wS, -r * 0.55); ctx.lineTo(r * 2.5 * wS, r * 0.25); ctx.lineTo(r * 1.55 * wS, r * 0.05); ctx.lineTo(r * 1.6 * wS, r * 0.8); ctx.lineTo(r * 0.7, r * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 2.2; for (const [x2, y2] of [[2.6, -1.7], [2.15, -0.55], [2.5, 0.25], [1.6, 0.8]]) { ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.3); ctx.lineTo(r * x2 * wS * 0.98, r * y2 * wS * (y2 < 0 ? 0.98 : 1)); ctx.stroke(); }
      ctx.restore(); }
    // áo choàng
    const cg = ctx.createLinearGradient(0, -r, 0, r * 1.3); cg.addColorStop(0, '#be123c'); cg.addColorStop(1, '#2a0310'); ctx.fillStyle = cg; ctx.strokeStyle = '#fda4af'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-r * 0.85, -r * 0.5); ctx.lineTo(r * 0.85, -r * 0.5); ctx.lineTo(r * 1.1, r * 1.15); for (let k = 4; k >= -4; k--) ctx.lineTo(k * r * 0.27, r * (1.0 + (k % 2 ? 0.2 : 0))); ctx.lineTo(-r * 1.1, r * 1.15); ctx.closePath(); ctx.fill(); ctx.stroke();
    // giáp ngực
    const ag = ctx.createLinearGradient(-r * 0.6, 0, r * 0.6, 0); ag.addColorStop(0, '#1f0d12'); ag.addColorStop(0.5, '#4a2230'); ag.addColorStop(1, '#14070b');
    ctx.fillStyle = ag; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 0.62, -r * 0.4); ctx.lineTo(r * 0.62, -r * 0.4); ctx.lineTo(r * 0.5, r * 0.7); ctx.lineTo(0, r * 0.9); ctx.lineTo(-r * 0.5, r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -r * 0.35); ctx.lineTo(0, r * 0.85); ctx.moveTo(-r * 0.4, r * 0.1); ctx.lineTo(r * 0.4, r * 0.1); ctx.stroke();
    orb(ctx, 0, r * 0.3, r * (0.5 + glow * 0.2), charge ? '#ffffff' : '#fb7185', clamp(0.8 * (0.8 + 0.2 * Math.sin(t * 0.01)), 0, 1)); ctx.fillStyle = '#fecdd3'; poly(ctx, [[0, r * 0.12], [r * 0.12, r * 0.3], [0, r * 0.5], [-r * 0.12, r * 0.3]]); ctx.fill();
    // vai
    for (const d of [-1, 1]) { ctx.save(); ctx.translate(d * r * 0.7, -r * 0.45); ctx.fillStyle = '#2b1019'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fbbf24'; poly(ctx, [[-3, -r * 0.3], [d * 2, -r * 0.85], [4, -r * 0.3]]); ctx.fill(); ctx.restore(); }
    // đầu
    blob(ctx, r, '#fca5a5', '#9f1239'); ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.62, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1f0509'; ctx.strokeStyle = '#fda4af'; ctx.lineWidth = 1.4; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * r * 0.3, -r * 0.9); ctx.quadraticCurveTo(d * r * 1.1, -r * 1.4, d * r * 0.85, -r * 1.95); ctx.quadraticCurveTo(d * r * 0.6, -r * 1.3, d * r * 0.12, -r * 0.75); ctx.fill(); ctx.stroke(); }
    const fk = 0.8 + rage * 0.5; ctx.fillStyle = '#fde047'; for (let i = -2; i <= 2; i++) { const hh = (1.25 + (i % 2 ? 0 : 0.18)) * fk; ctx.beginPath(); ctx.moveTo(i * r * 0.2 - 4, -r * 0.95); ctx.lineTo(i * r * 0.2, -r * hh + Math.sin(t * 0.01 + i) * 2); ctx.lineTo(i * r * 0.2 + 4, -r * 0.95); ctx.fill(); }
    ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.ellipse(0, -r * 0.18, r * 0.3, r * (0.07 + (charge ? 0.14 : 0)), 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; for (const d of [-1, 1]) { poly(ctx, [[d * r * 0.14, -r * 0.22], [d * r * 0.2, -r * 0.1], [d * r * 0.06, -r * 0.2]]); ctx.fill(); }
    for (const d of [-1, 1]) { ctx.fillStyle = charge || rage > 0.6 ? '#ffffff' : '#fde047'; poly(ctx, [[d * r * 0.1, -r * 0.5], [d * r * 0.42, -r * 0.58], [d * r * 0.36, -r * 0.4], [d * r * 0.1, -r * 0.42]]); ctx.fill(); orb(ctx, d * r * 0.25, -r * 0.47, 11, '#fde047', 0.9); }
    // kiếm & quả cầu hắc ám lơ lửng
    ctx.save(); ctx.translate(r * 1.5, r * 0.2 + Math.sin(t * 0.004) * 4); ctx.rotate(0.35 + Math.sin(t * 0.003) * 0.05); ctx.fillStyle = '#e2e8f0'; ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 1.6; poly(ctx, [[0, -r * 1.35], [r * 0.12, -r * 0.1], [-r * 0.12, -r * 0.1]]); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fbbf24'; ctx.fillRect(-r * 0.3, -r * 0.1, r * 0.6, 4); ctx.fillStyle = '#7f1d1d'; ctx.fillRect(-2, -r * 0.05, 4, r * 0.4); ctx.restore();
    const no = 3 + (rage > 0.5 ? 2 : 0); for (let i = 0; i < no; i++) { const a = t * 0.0025 + i * TAU / no; const ox = Math.cos(a) * r * 1.9, oy = Math.sin(a) * r * 0.55 + r * 0.1; ctx.fillStyle = '#1a0610'; ctx.strokeStyle = '#e11d48'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(ox, oy, 5, 0, TAU); ctx.fill(); ctx.stroke(); orb(ctx, ox, oy, 9, '#e11d48', 0.7); }
  }

  function drawDragonWhelp(ctx, r, t) {
    const flap = Math.sin(t * 0.012) * 0.18;
    ctx.save();
    // crystal wings behind the body
    for (const d of [-1, 1]) {
      ctx.save(); ctx.translate(d * r * 0.42, -r * 0.12); ctx.rotate(d * flap);
      const wg = ctx.createLinearGradient(0, -r, d * r * 1.6, r);
      wg.addColorStop(0, '#ecfeff'); wg.addColorStop(0.48, '#67e8f9'); wg.addColorStop(1, '#0e7490');
      ctx.fillStyle = wg; ctx.strokeStyle = '#164e63'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(d * r * 0.55, -r * 1.35, d * r * 1.55, -r * 1.1);
      ctx.lineTo(d * r * 1.12, -r * 0.12); ctx.lineTo(d * r * 1.42, r * 0.55); ctx.quadraticCurveTo(d * r * 0.48, r * 0.56, 0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(236,254,255,.72)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(d * r * 1.42, -r * 0.92); ctx.moveTo(0, 0); ctx.lineTo(d * r * 1.1, -r * 0.1); ctx.stroke();
      ctx.restore();
    }
    // curled tail
    ctx.strokeStyle = '#0e7490'; ctx.lineWidth = r * 0.38; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.25, r * 0.45); ctx.bezierCurveTo(-r * 1.55, r * 1.45, -r * 1.6, -r * 0.4, -r * 0.82, -r * 0.38); ctx.stroke();
    ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 2; ctx.stroke();
    const body = ctx.createLinearGradient(-r, -r, r, r); body.addColorStop(0, '#cffafe'); body.addColorStop(.45, '#22d3ee'); body.addColorStop(1, '#155e75');
    ctx.fillStyle = body; ctx.strokeStyle = '#082f49'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(0, r * 0.2, r * 0.82, r * 0.72, -0.14, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a5f3fc'; ctx.beginPath(); ctx.ellipse(r * 0.5, -r * 0.48, r * 0.56, r * 0.48, .22, 0, TAU); ctx.fill(); ctx.stroke();
    // muzzle, gold horns and whiskers
    ctx.fillStyle = '#ecfeff'; ctx.beginPath(); ctx.ellipse(r * 0.9, -r * 0.25, r * 0.38, r * 0.2, .12, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r * .25, -r * .78); ctx.lineTo(r * .1, -r * 1.35); ctx.moveTo(r * .65, -r * .75); ctx.lineTo(r * .88, -r * 1.25); ctx.stroke();
    ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(r * 1.05, -r * .1); ctx.quadraticCurveTo(r * 1.55, -r * .32, r * 1.6, -r * .65); ctx.moveTo(r * 1.02, 0); ctx.quadraticCurveTo(r * 1.55, r * .2, r * 1.7, r * .42); ctx.stroke();
    orb(ctx, r * .62, -r * .52, r * .2, '#fbbf24', .95);
    ctx.fillStyle = '#082f49'; ctx.beginPath(); ctx.arc(r * .69, -r * .54, 2.1, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#fde68a'; poly(ctx, [[-r*.45+i*r*.32,-r*.18],[-r*.28+i*r*.32,-r*.48],[-r*.1+i*r*.32,-r*.18]]); ctx.fill(); }
    ctx.restore();
  }

  function drawCloudWisp(ctx, r, t) {
    const bob = Math.sin(t * .006) * r * .12, spin = t * .0018;
    ctx.save(); ctx.translate(0, bob);
    ctx.strokeStyle = 'rgba(224,242,254,.75)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.42, r * .74, spin, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let k = 0; k < 3; k++) {
      const a = spin + k * TAU / 3, x = Math.cos(a) * r * 1.15, y = Math.sin(a) * r * .6;
      orb(ctx, x, y, r * .25, '#67e8f9', .85);
    }
    const g = ctx.createRadialGradient(-r*.28,-r*.32,2,0,0,r*1.05);
    g.addColorStop(0,'#ffffff'); g.addColorStop(.25,'#cffafe'); g.addColorStop(.68,'#38bdf8'); g.addColorStop(1,'#075985');
    ctx.fillStyle = g; ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r*.78,r*.05); ctx.bezierCurveTo(-r*.8,-r*.78,r*.65,-r*.92,r*.78,-r*.05);
    ctx.bezierCurveTo(r*.95,r*.68,-r*.45,r*.86,-r*.78,r*.05); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#082f49'; ctx.beginPath(); ctx.ellipse(-r*.2,-r*.05,r*.07,r*.12,0,0,TAU); ctx.ellipse(r*.22,-r*.05,r*.07,r*.12,0,0,TAU); ctx.fill();
    ctx.strokeStyle = '#0e7490'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,r*.2,r*.22,.2,Math.PI-.2); ctx.stroke();
    ctx.restore();
  }

  function drawSkySentinel(ctx, r, t) {
    const pulse = .5 + .5 * Math.sin(t * .006);
    ctx.save(); ctx.rotate(Math.sin(t * .003) * .035);
    // floating crystal pauldrons
    for (const d of [-1,1]) {
      ctx.save(); ctx.translate(d*r*1.02,-r*.1+Math.sin(t*.004+d)*3); ctx.rotate(d*.16);
      const cg=ctx.createLinearGradient(-r*.3,-r*.8,r*.3,r*.8); cg.addColorStop(0,'#ecfeff'); cg.addColorStop(.5,'#67e8f9'); cg.addColorStop(1,'#155e75');
      ctx.fillStyle=cg; ctx.strokeStyle='#082f49'; ctx.lineWidth=2;
      poly(ctx,[[0,-r*.9],[r*.55,-r*.25],[r*.35,r*.72],[-r*.35,r*.72],[-r*.55,-r*.25]]); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    const armor=ctx.createLinearGradient(-r,-r,r,r); armor.addColorStop(0,'#e0f2fe'); armor.addColorStop(.4,'#0e7490'); armor.addColorStop(1,'#082f49');
    ctx.fillStyle=armor; ctx.strokeStyle='#041322'; ctx.lineWidth=2.5;
    poly(ctx,[[-r*.68,-r*.55],[0,-r*.95],[r*.68,-r*.55],[r*.6,r*.75],[0,r*1.0],[-r*.6,r*.75]]); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#164e63'; ctx.beginPath(); ctx.arc(0,-r*.32,r*.52,0,TAU); ctx.fill(); ctx.stroke();
    orb(ctx,0,-r*.33,r*.38,pulse>.5?'#fde68a':'#67e8f9',.95);
    ctx.fillStyle='#082f49'; ctx.beginPath(); ctx.arc(0,-r*.33,r*.12,0,TAU); ctx.fill();
    ctx.fillStyle='#fbbf24'; poly(ctx,[[0,-r*1.35],[r*.2,-r*.72],[-r*.2,-r*.72]]); ctx.fill();
    ctx.strokeStyle='rgba(224,242,254,.8)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-r*.48,r*.25); ctx.lineTo(r*.48,r*.25); ctx.moveTo(-r*.34,r*.52); ctx.lineTo(r*.34,r*.52); ctx.stroke();
    ctx.restore();
  }

  function drawRiftStalker(ctx, r, t) {
    const pulse = .72 + .28 * Math.sin(t * .009), lean = Math.sin(t * .012) * .12;
    ctx.save(); ctx.rotate(lean);
    for (const d of [-1, 1]) {
      ctx.save(); ctx.translate(d * r * .34, -r * .05); ctx.rotate(d * (.18 + Math.sin(t * .008) * .08));
      const g = ctx.createLinearGradient(0, -r, d * r * 1.25, r);
      g.addColorStop(0, '#f5d0fe'); g.addColorStop(.42, '#a855f7'); g.addColorStop(1, '#2e1065');
      ctx.fillStyle = g; ctx.strokeStyle = '#e9d5ff'; ctx.lineWidth = 1.6;
      poly(ctx, [[0,0],[d*r*.7,-r*1.25],[d*r*1.35,-r*.68],[d*r*.82,r*.2],[d*r*.48,r*.72]]); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#170b2a'; ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2;
    poly(ctx, [[-r*.55,-r*.45],[0,-r*1.05],[r*.56,-r*.45],[r*.42,r*.8],[0,r*1.05],[-r*.42,r*.8]]); ctx.fill(); ctx.stroke();
    const core = ctx.createRadialGradient(-r*.12,-r*.2,1,0,0,r*.8);
    core.addColorStop(0,'#f5d0fe'); core.addColorStop(.35,'#c084fc'); core.addColorStop(1,'#3b0764');
    ctx.fillStyle = core; ctx.beginPath(); ctx.ellipse(0,0,r*.48,r*.68,0,0,TAU); ctx.fill();
    orb(ctx,0,-r*.22,r*.23,'#ffffff',pulse);
    ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r*.4,r*.72); ctx.lineTo(0,r*1.25); ctx.lineTo(r*.4,r*.72); ctx.stroke();
    ctx.restore();
  }

  function drawEclipseOracle(ctx, r, t) {
    const bob = Math.sin(t * .006) * r * .1, spin = t * .0015;
    ctx.save(); ctx.translate(0,bob);
    ctx.strokeStyle = 'rgba(240,171,252,.8)'; ctx.lineWidth = 1.8; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.ellipse(0,-r*.32,r*1.3,r*.54,spin,0,TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#1b1230'; ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2.2;
    poly(ctx, [[-r*.8,r*.72],[-r*.58,-r*.25],[0,-r*1.05],[r*.58,-r*.25],[r*.8,r*.72],[0,r*.95]]); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#090613'; ctx.beginPath(); ctx.ellipse(0,-r*.2,r*.52,r*.62,0,0,TAU); ctx.fill();
    orb(ctx,0,-r*.28,r*.38,'#e9d5ff',.85);
    ctx.fillStyle = '#2e1065'; ctx.beginPath(); ctx.arc(0,-r*.2,r*.28,0,TAU); ctx.fill();
    ctx.fillStyle = '#f0abfc'; poly(ctx, [[-r*.38,-r*.52],[0,-r*1.34],[r*.38,-r*.52]]); ctx.fill();
    for (let k=0;k<4;k++) { const a=spin+k*Math.PI/2, x=Math.cos(a)*r*1.02, y=-r*.24+Math.sin(a)*r*.5; orb(ctx,x,y,r*.17,k%2?'#a78bfa':'#f0abfc',.9); }
    ctx.restore();
  }

  function drawObsidianBrute(ctx, r, t) {
    const pulse=.7+.3*Math.sin(t*.007);
    ctx.save(); ctx.rotate(Math.sin(t*.004)*.035);
    for (const d of [-1,1]) {
      const cg=ctx.createLinearGradient(0,-r,0,r);
      cg.addColorStop(0,'#d1fae5'); cg.addColorStop(.45,'#34d399'); cg.addColorStop(1,'#064e3b');
      ctx.fillStyle=cg; ctx.strokeStyle='#052e2b'; ctx.lineWidth=2;
      poly(ctx,[[d*r*.48,-r*.35],[d*r*1.05,-r*1.1],[d*r*1.3,-r*.05],[d*r*.75,r*.5]]); ctx.fill(); ctx.stroke();
    }
    const armor=ctx.createLinearGradient(-r,-r,r,r);
    armor.addColorStop(0,'#a7f3d0'); armor.addColorStop(.3,'#14532d'); armor.addColorStop(.72,'#10251e'); armor.addColorStop(1,'#020b0b');
    ctx.fillStyle=armor; ctx.strokeStyle='#6ee7b7'; ctx.lineWidth=2.5;
    poly(ctx,[[-r*.72,-r*.65],[0,-r*1.02],[r*.72,-r*.65],[r*.92,r*.48],[r*.38,r*.95],[-r*.38,r*.95],[-r*.92,r*.48]]); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#071a16'; ctx.beginPath(); ctx.ellipse(0,-r*.25,r*.48,r*.42,0,0,TAU); ctx.fill();
    orb(ctx,-r*.2,-r*.25,r*.13,'#f0fdf4',pulse); orb(ctx,r*.2,-r*.25,r*.13,'#f0fdf4',pulse);
    ctx.strokeStyle='#34d399'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-r*.36,r*.3); ctx.lineTo(r*.36,r*.3); ctx.stroke();
    ctx.restore();
  }

  // ---------- Quái Chương 6 ----------

  // Sứ Giả Tinh Vân: cá thể lơ lửng, ba mắt, vành sáng xoay chậm quanh thân.
  function drawNebulaHerald(ctx, r, t) {
    const bob = Math.sin(t * .0055) * r * .12, spin = t * .0011;
    ctx.save(); ctx.translate(0, bob);
    // Hào quang nền
    const halo = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.9);
    halo.addColorStop(0, 'rgba(34,211,238,.34)');
    halo.addColorStop(.45, 'rgba(56,189,248,.14)');
    halo.addColorStop(1, 'rgba(29,78,216,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, TAU); ctx.fill();
    // Vành nghiêng xoay
    ctx.strokeStyle = 'rgba(165,243,252,.75)'; ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.ellipse(0, -r * .18, r * 1.34, r * .44, spin, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -r * .18, r * 1.62, r * .58, -spin * .7, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // Thân: giọt nước ngược, gradient từ trắng băng sang xanh đậm
    const body = ctx.createLinearGradient(-r * .6, -r, r * .6, r);
    body.addColorStop(0, '#ecfeff'); body.addColorStop(.3, '#22d3ee');
    body.addColorStop(.7, '#0e7490'); body.addColorStop(1, '#082f49');
    ctx.fillStyle = body; ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.16);
    ctx.bezierCurveTo(r * .82, -r * .5, r * .74, r * .62, 0, r * .98);
    ctx.bezierCurveTo(-r * .74, r * .62, -r * .82, -r * .5, 0, -r * 1.16);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Ba mắt
    const eyePulse = .7 + .3 * Math.sin(t * .009);
    orb(ctx, 0, -r * .34, r * .3, '#a5f3fc', .9);
    ctx.fillStyle = '#082f49'; ctx.beginPath(); ctx.ellipse(0, -r * .34, r * .16, r * .21, 0, 0, TAU); ctx.fill();
    for (const d of [-1, 1]) {
      orb(ctx, d * r * .34, -r * .02, r * .17, '#67e8f9', eyePulse);
      ctx.fillStyle = '#082f49';
      ctx.beginPath(); ctx.ellipse(d * r * .34, -r * .02, r * .085, r * .12, 0, 0, TAU); ctx.fill();
    }
    // Xúc tu dưới, lượn sóng lệch pha
    ctx.strokeStyle = 'rgba(103,232,249,.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x0 = (i - 1) * r * .26, ph = t * .008 + i * .9;
      ctx.beginPath(); ctx.moveTo(x0, r * .86);
      ctx.quadraticCurveTo(x0 + Math.sin(ph) * r * .3, r * 1.32, x0 + Math.sin(ph) * r * .52, r * 1.62);
      ctx.stroke();
    }
    // Sao nhỏ bay quanh
    for (let i = 0; i < 5; i++) {
      const a = spin * 2.2 + i * TAU / 5, rr = r * (1.15 + .18 * Math.sin(t * .004 + i));
      orb(ctx, Math.cos(a) * rr, -r * .2 + Math.sin(a) * rr * .55, r * .07, '#ffffff', .75);
    }
    ctx.restore();
  }

  // Băng Vệ Binh: khối băng đa diện, có sóng lạnh toả ra và lõi sáng.
  function drawFrostSentinel(ctx, r, t) {
    const pulse = .68 + .32 * Math.sin(t * .006), sway = Math.sin(t * .0042) * .05;
    ctx.save(); ctx.rotate(sway);
    // Sóng lạnh toả ra theo chu kỳ
    for (let k = 0; k < 3; k++) {
      const ph = ((t * .0009 + k / 3) % 1);
      ctx.strokeStyle = 'rgba(186,230,253,' + (0.42 * (1 - ph)) + ')';
      ctx.lineWidth = 2.2 * (1 - ph) + .6;
      ctx.beginPath(); ctx.arc(0, 0, r * (.7 + ph * 1.5), 0, TAU); ctx.stroke();
    }
    // Gai băng phía sau
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * .82 + i * Math.PI * .33;
      const len = r * (.9 + .26 * Math.sin(t * .005 + i * 1.3));
      ctx.fillStyle = 'rgba(224,242,254,.9)'; ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 1.4;
      poly(ctx, [
        [Math.cos(a) * r * .5, Math.sin(a) * r * .5],
        [Math.cos(a + .14) * len, Math.sin(a + .14) * len],
        [Math.cos(a - .14) * len, Math.sin(a - .14) * len],
      ]); ctx.fill(); ctx.stroke();
    }
    // Thân tinh thể
    const body = ctx.createLinearGradient(-r, -r, r, r);
    body.addColorStop(0, '#f0f9ff'); body.addColorStop(.32, '#7dd3fc');
    body.addColorStop(.68, '#0284c7'); body.addColorStop(1, '#082f49');
    ctx.fillStyle = body; ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2.4;
    poly(ctx, [[0, -r * 1.05], [r * .78, -r * .38], [r * .62, r * .72], [0, r * 1.06], [-r * .62, r * .72], [-r * .78, -r * .38]]);
    ctx.fill(); ctx.stroke();
    // Mặt cắt nội bộ
    ctx.strokeStyle = 'rgba(240,249,255,.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05); ctx.lineTo(0, r * 1.06);
    ctx.moveTo(-r * .78, -r * .38); ctx.lineTo(r * .78, -r * .38);
    ctx.moveTo(-r * .62, r * .72); ctx.lineTo(r * .62, r * .72);
    ctx.stroke();
    // Lõi
    orb(ctx, 0, -r * .06, r * .5, '#ffffff', pulse);
    orb(ctx, 0, -r * .06, r * .26, '#bae6fd', .95);
    // Mắt
    for (const d of [-1, 1]) {
      ctx.fillStyle = '#082f49';
      ctx.beginPath(); ctx.ellipse(d * r * .26, -r * .3, r * .1, r * .15, 0, 0, TAU); ctx.fill();
      orb(ctx, d * r * .26, -r * .3, r * .09, '#ffffff', .8);
    }
    ctx.restore();
  }

  // Ảnh Vệ Tinh Tú: bóng tối có viền sao, di chuyển như đang tan chảy.
  function drawStarWraith(ctx, r, t) {
    const drift = Math.sin(t * .0062) * r * .1, wave = t * .004;
    ctx.save();
    // Vệt đuôi phía sau, mờ dần
    for (let i = 3; i >= 1; i--) {
      const a = .1 + i * .07, off = i * r * .28;
      ctx.fillStyle = 'rgba(129,140,248,' + a + ')';
      ctx.beginPath();
      ctx.ellipse(Math.sin(wave + i) * r * .16, drift + off, r * (.58 - i * .08), r * (.8 - i * .1), 0, 0, TAU);
      ctx.fill();
    }
    // Thân chính: gradient tím than
    const body = ctx.createRadialGradient(-r * .16, -r * .3, r * .1, 0, 0, r * 1.1);
    body.addColorStop(0, '#c7d2fe'); body.addColorStop(.4, '#6366f1');
    body.addColorStop(.78, '#312e81'); body.addColorStop(1, '#0b0a1f');
    ctx.fillStyle = body; ctx.strokeStyle = 'rgba(165,180,252,.85)'; ctx.lineWidth = 2;
    ctx.beginPath();
    // Viền răng cưa nhấp nhô theo thời gian
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU - Math.PI / 2;
      const rr = r * (1 + .13 * Math.sin(a * 4 + wave * 2));
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 1.08]);
    }
    poly(ctx, pts); ctx.fill(); ctx.stroke();
    // Mũ trùm
    ctx.fillStyle = 'rgba(11,10,31,.9)';
    ctx.beginPath(); ctx.ellipse(0, -r * .14, r * .56, r * .62, 0, 0, TAU); ctx.fill();
    // Mắt đôi phát sáng
    const glow = .72 + .28 * Math.sin(t * .011);
    for (const d of [-1, 1]) {
      orb(ctx, d * r * .22, -r * .18, r * .21, '#a5b4fc', glow);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(d * r * .22, -r * .18, r * .07, r * .1, 0, 0, TAU); ctx.fill();
    }
    // Sao nhỏ nằm trong thân
    for (let i = 0; i < 6; i++) {
      const a = t * .0013 + i * TAU / 6, rr = r * (.4 + .3 * Math.sin(t * .003 + i * 2));
      ctx.fillStyle = 'rgba(224,231,255,' + (.4 + .4 * Math.sin(t * .007 + i)) + ')';
      ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * .8, r * .045, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- Boss Chương 6: Thực Thần Tinh Hà ----------
  //
  // Ba lớp chuyển động độc lập:
  //   1. Vòng sao bên ngoài quay chậm, bán kính co giãn theo nhịp thở
  //   2. Cánh tinh vân vỗ lệch pha, độ dài tăng khi máu giảm (cuồng nộ)
  //   3. Lõi hố đen: đĩa bồi tụ quay nhanh, kèm tia phụt khi charge
  function drawAstralDevourer(ctx, r, t, hr, charge) {
    const rage = 1 - hr;
    const pulse = .72 + .28 * Math.sin(t * .007);
    const glow = Math.min(1.5, .55 + rage * .75 + (charge ? .45 : 0));
    const breath = 1 + .06 * Math.sin(t * .0045);

    ctx.save();

    // ---- 1. Vòng sao ngoài cùng ----
    const ringSpin = t * .00042;
    for (let ring = 0; ring < 3; ring++) {
      const rr = r * (1.55 + ring * .34) * breath;
      const tilt = .48 + ring * .12;
      ctx.save();
      ctx.rotate(ringSpin * (ring % 2 ? -1 : 1) * (1 + ring * .35));
      ctx.strokeStyle = ring === 0
        ? 'rgba(199,210,254,.8)'
        : (ring === 1 ? 'rgba(129,140,248,.55)' : 'rgba(99,102,241,.32)');
      ctx.lineWidth = 3.4 - ring * .8;
      ctx.setLineDash(ring === 2 ? [10, 9] : []);
      ctx.beginPath(); ctx.ellipse(0, -r * .34, rr, rr * tilt, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      // Sao gắn trên vòng
      const stars = 6 + ring * 3;
      for (let i = 0; i < stars; i++) {
        const a = i / stars * TAU + ringSpin * (3 + ring);
        const x = Math.cos(a) * rr, y = -r * .34 + Math.sin(a) * rr * tilt;
        const tw = .45 + .55 * Math.abs(Math.sin(t * .006 + i + ring));
        orb(ctx, x, y, r * (.055 + ring * .012), '#ffffff', tw * .9);
      }
      ctx.restore();
    }

    // ---- 2. Cánh tinh vân ----
    for (const d of [-1, 1]) {
      ctx.save();
      ctx.rotate(d * (Math.sin(t * .0032) * .06 + rage * .04));
      const wingLen = r * (2.5 + rage * .55);
      const wg = ctx.createLinearGradient(0, -r * 1.5, d * wingLen, r * .9);
      wg.addColorStop(0, 'rgba(224,231,255,.95)');
      wg.addColorStop(.28, 'rgba(129,140,248,.9)');
      wg.addColorStop(.62, 'rgba(67,56,202,.82)');
      wg.addColorStop(1, 'rgba(11,10,31,.15)');
      ctx.fillStyle = wg;
      ctx.strokeStyle = 'rgba(199,210,254,.7)';
      ctx.lineWidth = 2.6;
      // Cánh: đường cong kép tạo cảm giác màng mỏng
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(d * r * .55, -r * 2.0, d * wingLen, -r * 1.5);
      ctx.quadraticCurveTo(d * wingLen * .82, -r * .4, d * r * 1.42, r * .18);
      ctx.quadraticCurveTo(d * r * 1.9, r * .82, d * wingLen * .72, r * .95);
      ctx.quadraticCurveTo(d * r * .58, r * .42, 0, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Gân cánh
      ctx.strokeStyle = 'rgba(224,231,255,.5)'; ctx.lineWidth = 1.6;
      for (let k = 1; k <= 3; k++) {
        const f = k / 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          d * r * (.5 + f * 1.5), -r * (1.9 - f * .9),
          d * wingLen * (.45 + f * .5), -r * (1.35 - f * 1.5),
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---- 3. Thân ----
    const body = ctx.createRadialGradient(-r * .2, -r * .42, r * .12, 0, 0, r * 1.25);
    body.addColorStop(0, '#e0e7ff'); body.addColorStop(.24, '#818cf8');
    body.addColorStop(.58, '#312e81'); body.addColorStop(.86, '#100e2e');
    body.addColorStop(1, '#03030c');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#c7d2fe';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.ellipse(0, r * .06, r * .92 * breath, r * 1.14 * breath, 0, 0, TAU);
    ctx.fill(); ctx.stroke();

    // Vương miện gai
    ctx.fillStyle = 'rgba(199,210,254,.92)';
    ctx.strokeStyle = 'rgba(67,56,202,.85)';
    ctx.lineWidth = 1.8;
    const crown = [];
    const spikes = 9;
    for (let i = 0; i < spikes; i++) {
      const f = i / (spikes - 1);
      const a = -Math.PI * .92 + f * Math.PI * .84;
      const base = r * .78;
      const len = r * (1.28 + (i % 2 ? .52 : .18) + .16 * Math.sin(t * .006 + i));
      crown.push([Math.cos(a) * base, Math.sin(a) * base * .82 - r * .5]);
      crown.push([Math.cos(a) * len, Math.sin(a) * len * .82 - r * .5]);
    }
    ctx.beginPath();
    ctx.moveTo(crown[0][0], crown[0][1]);
    for (let i = 1; i < crown.length; i++) ctx.lineTo(crown[i][0], crown[i][1]);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // ---- Lõi hố đen ----
    const coreX = 0, coreY = r * .1, coreR = r * .62 * breath;
    // Đĩa bồi tụ quay nhanh
    ctx.save();
    ctx.translate(coreX, coreY);
    ctx.rotate(t * .0018);
    for (let k = 0; k < 3; k++) {
      const rg = ctx.createLinearGradient(-coreR, 0, coreR, 0);
      rg.addColorStop(0, 'rgba(224,231,255,.92)');
      rg.addColorStop(.5, 'rgba(165,180,252,.75)');
      rg.addColorStop(1, 'rgba(67,56,202,.1)');
      ctx.strokeStyle = rg;
      ctx.lineWidth = 4.5 - k * 1.1;
      ctx.beginPath();
      ctx.ellipse(0, 0, coreR * (.62 + k * .3), coreR * (.24 + k * .13), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // Hố đen
    ctx.fillStyle = '#02020a';
    ctx.beginPath(); ctx.arc(coreX, coreY, coreR * .46, 0, TAU); ctx.fill();
    // Vành photon
    ctx.strokeStyle = 'rgba(224,231,255,' + (.75 + .25 * pulse) + ')';
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.arc(coreX, coreY, coreR * .5, 0, TAU); ctx.stroke();
    orb(ctx, coreX, coreY, coreR * .92, charge ? '#ffffff' : '#818cf8', glow * pulse);

    // Mắt trên trán
    const eyeY = -r * .72;
    orb(ctx, 0, eyeY, r * .3, '#ffffff', glow);
    ctx.fillStyle = '#100e2e';
    ctx.beginPath(); ctx.ellipse(0, eyeY, r * .085, r * .19, 0, 0, TAU); ctx.fill();

    // Tia phụt khi charge
    if (charge) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) {
        const a = t * .0022 + i * TAU / 10;
        const len = r * (1.5 + .4 * Math.sin(t * .012 + i));
        const g2 = ctx.createLinearGradient(coreX, coreY, Math.cos(a) * len, coreY + Math.sin(a) * len);
        g2.addColorStop(0, 'rgba(255,255,255,.95)');
        g2.addColorStop(1, 'rgba(129,140,248,0)');
        ctx.strokeStyle = g2; ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(coreX, coreY);
        ctx.lineTo(Math.cos(a) * len, coreY + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function drawEclipseSovereign(ctx, r, t, hr, charge) {
    const rage=1-hr, pulse=.72+.28*Math.sin(t*.008), glow=Math.min(1.45,.55+rage*.7+(charge?.45:0));
    ctx.save(); ctx.rotate(t*.00035);
    ctx.strokeStyle='rgba(240,171,252,.78)'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.ellipse(0,-r*.72,r*1.5,r*.5,0,0,TAU); ctx.stroke();
    ctx.setLineDash([8,7]); ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,-r*.72,r*1.82,r*.68,0,0,TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let i=0;i<8;i++) {
      const a=i*Math.PI/4, x=Math.cos(a)*r*1.55, y=-r*.72+Math.sin(a)*r*.55;
      ctx.save(); ctx.translate(x,y); ctx.rotate(a);
      const cg=ctx.createLinearGradient(0,-r*.3,0,r*.45);
      cg.addColorStop(0,'#f5d0fe'); cg.addColorStop(.5,'#a855f7'); cg.addColorStop(1,'#2e1065');
      ctx.fillStyle=cg; ctx.strokeStyle='#f0abfc'; ctx.lineWidth=1.5;
      poly(ctx,[[0,-r*.34],[r*.18,0],[0,r*.42],[-r*.18,0]]); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    for (const d of [-1,1]) {
      ctx.save(); ctx.translate(d*r*.28,-r*.12); ctx.rotate(d*(Math.sin(t*.0035)*.07+rage*.035));
      const wg=ctx.createLinearGradient(0,-r*1.8,d*r*2.45,r);
      wg.addColorStop(0,'#f5d0fe'); wg.addColorStop(.34,'#8b5cf6'); wg.addColorStop(.72,'#4c1d95'); wg.addColorStop(1,'#090613');
      ctx.fillStyle=wg; ctx.strokeStyle='#e9d5ff'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(d*r*.7,-r*1.9,d*r*2.45,-r*1.62);
      ctx.lineTo(d*r*1.75,-r*.05); ctx.lineTo(d*r*2.18,r*.7); ctx.quadraticCurveTo(d*r*.72,r*.42,0,0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(245,208,254,.72)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(d*r*2.3,-r*1.42); ctx.moveTo(0,0); ctx.lineTo(d*r*1.78,-r*.05); ctx.moveTo(0,0); ctx.lineTo(d*r*2.08,r*.58); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle='#2e1065'; ctx.lineWidth=r*.55; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*.4,r*.5); ctx.bezierCurveTo(-r*1.55,r*1.5,-r*2.0,-r*.4,-r*1.05,-r*.48); ctx.stroke();
    ctx.strokeStyle='#c084fc'; ctx.lineWidth=3; ctx.stroke();
    const body=ctx.createLinearGradient(-r,-r,r,r);
    body.addColorStop(0,'#f5d0fe'); body.addColorStop(.26,'#8b5cf6'); body.addColorStop(.68,'#2e1065'); body.addColorStop(1,'#080512');
    ctx.fillStyle=body; ctx.strokeStyle='#090613'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.ellipse(-r*.1,r*.25,r*.82,r*1.05,-.18,0,TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#24103b'; ctx.beginPath(); ctx.ellipse(r*.92,-r*.78,r*.68,r*.48,-.12,0,TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#e9d5ff'; ctx.beginPath(); ctx.ellipse(r*1.34,-r*.62,r*.38,r*.18,-.1,0,TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#d8b4fe'; poly(ctx,[[r*.32,-r*1.05],[r*.12,-r*1.75],[r*.62,-r*1.26],[r*.92,-r*1.92],[r*1.08,-r*1.08],[r*1.48,-r*1.62],[r*1.46,-r*.92]]); ctx.fill(); ctx.stroke();
    orb(ctx,r*1.13,-r*.9,r*.24,'#ffffff',glow*pulse);
    ctx.fillStyle='#090613'; ctx.beginPath(); ctx.arc(r*1.16,-r*.91,r*.075,0,TAU); ctx.fill();
    ctx.fillStyle='#090613'; ctx.strokeStyle='#f0abfc'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(-r*.1,r*.31,r*.48,0,TAU); ctx.fill(); ctx.stroke();
    orb(ctx,-r*.1,r*.31,r*.82,charge?'#ffffff':'#c084fc',glow);
    for (let i=0;i<6;i++) { const x=-r*.55+i*r*.22, y=-r*.25-Math.sin(t*.006+i)*3; ctx.fillStyle='#f5d0fe'; poly(ctx,[[x-r*.07,y],[x,y-r*(.38+(i%2)*.13)],[x+r*.07,y]]); ctx.fill(); }
    if (charge) for(let i=0;i<7;i++) orb(ctx,r*1.45+i*4,-r*.45+(i-3)*7,r*.17,'#f5d0fe',.92);
    ctx.restore();
  }

  function drawElderDragon(ctx, r, t, hr, charge) {
    const rage = 1 - hr, pulse = .72 + .28 * Math.sin(t * .008), glow = Math.min(1.3, .55 + rage * .65 + (charge ? .45 : 0));
    // wings, with moving membranes
    for (const d of [-1,1]) {
      ctx.save(); ctx.translate(d*r*.28,-r*.18); ctx.rotate(d*(Math.sin(t*.004)*.08 + rage*.04));
      const wg=ctx.createLinearGradient(0,-r*1.8,d*r*2.5,r);
      wg.addColorStop(0,'#ecfeff'); wg.addColorStop(.38,'#67e8f9'); wg.addColorStop(1,'#075985');
      ctx.fillStyle=wg; ctx.strokeStyle='#082f49'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(d*r*.7,-r*1.9,d*r*2.4,-r*1.85);
      ctx.lineTo(d*r*1.8,-r*.25); ctx.lineTo(d*r*2.35,r*.42); ctx.quadraticCurveTo(d*r*.8,r*.38,0,0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(236,254,255,.72)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(d*r*2.25,-r*1.65); ctx.moveTo(0,0); ctx.lineTo(d*r*1.82,-r*.22); ctx.moveTo(0,0); ctx.lineTo(d*r*2.22,r*.28); ctx.stroke();
      ctx.restore();
    }
    // coiling tail
    ctx.strokeStyle='#0e7490'; ctx.lineWidth=r*.56; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*.35,r*.55); ctx.bezierCurveTo(-r*1.65,r*1.55,-r*2.0,-r*.38,-r*1.1,-r*.5); ctx.stroke();
    ctx.strokeStyle='#a5f3fc'; ctx.lineWidth=3; ctx.stroke();
    // serpentine body
    const body=ctx.createLinearGradient(-r,-r,r,r); body.addColorStop(0,'#ecfeff'); body.addColorStop(.33,'#67e8f9'); body.addColorStop(.72,'#0e7490'); body.addColorStop(1,'#082f49');
    ctx.fillStyle=body; ctx.strokeStyle='#041322'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.ellipse(-r*.08,r*.28,r*.8,r*1.0,-.2,0,TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r*.2,-r*.3); ctx.quadraticCurveTo(r*.8,-r*1.45,r*1.12,-r*.72); ctx.quadraticCurveTo(r*1.38,-r*.28,r*.55,-r*.05); ctx.fill(); ctx.stroke();
    // head and muzzle
    ctx.fillStyle='#155e75'; ctx.beginPath(); ctx.ellipse(r*1.0,-r*.82,r*.65,r*.47,-.15,0,TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#cffafe'; ctx.beginPath(); ctx.ellipse(r*1.42,-r*.67,r*.36,r*.19,-.12,0,TAU); ctx.fill(); ctx.stroke();
    // swept horns and antlers
    ctx.strokeStyle='#fde68a'; ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(r*.62,-r*1.08); ctx.quadraticCurveTo(r*.2,-r*1.9,-r*.25,-r*1.72);
    ctx.moveTo(r*1.02,-r*1.12); ctx.quadraticCurveTo(r*1.52,-r*1.85,r*1.72,-r*1.52); ctx.stroke();
    // eyes and glowing ancestral core
    orb(ctx,r*1.12,-r*.93,r*.25,'#fbbf24',glow);
    ctx.fillStyle='#082f49'; ctx.beginPath(); ctx.arc(r*1.16,-r*.94,r*.08,0,TAU); ctx.fill();
    ctx.fillStyle='#082f49'; ctx.strokeStyle='#fde68a'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(-r*.08,r*.34,r*.48,0,TAU); ctx.fill(); ctx.stroke();
    orb(ctx,-r*.08,r*.34,r*.78,charge?'#ffffff':'#67e8f9',glow*pulse);
    // whiskers, dorsal crystal spines and breath sparks
    ctx.strokeStyle='#a5f3fc'; ctx.lineWidth=2.2; ctx.beginPath();
    ctx.moveTo(r*1.32,-r*.58); ctx.quadraticCurveTo(r*1.8,-r*.28,r*2.0,-r*.62);
    ctx.moveTo(r*1.28,-r*.52); ctx.quadraticCurveTo(r*1.85,-r*.1,r*2.1,-r*.24); ctx.stroke();
    for (let i=0;i<5;i++) {
      const x=-r*.48+i*r*.3, y=-r*.34-Math.sin(t*.006+i)*3;
      ctx.fillStyle='#fde68a'; poly(ctx,[[x-r*.09,y],[x,y-r*(.42+(i%2)*.12)],[x+r*.09,y]]); ctx.fill();
    }
    if (charge) { for (let i=0;i<5;i++) orb(ctx,r*1.8+i*4,-r*.55+(i-2)*7,r*.18,'#67e8f9',.8); }
    ctx.restore();
  }

  function drawMyceliumQueen(ctx, r, t, hr, charge) {
    ctx.save();
    const pulse = 1 + Math.sin(t * .006) * .05;
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#5b21b6'; ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 4, r * 1.05, r * .85, 0, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7 + t * .0005;
      orb(ctx, Math.cos(a) * r * 1.3, Math.sin(a) * r * .75, r * .18, '#a3e635', .8);
    }
    ctx.fillStyle = '#d9f99d'; ctx.beginPath(); ctx.moveTo(-r * .9, -r * .35);
    ctx.quadraticCurveTo(0, -r * 1.8, r * .9, -r * .35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1026'; ctx.beginPath(); ctx.arc(-r * .28, 0, 4, 0, TAU); ctx.arc(r * .28, 0, 4, 0, TAU); ctx.fill();
    if (charge || hr < .45) orb(ctx, 0, -r * .7, r * .3, '#f0abfc', .75);
    ctx.restore();
  }

  function drawZodiacBoss(ctx, r, t, hr, charge) {
    // Boss cung hoàng đạo mới: Canvas nhận SVG chibi; lỗi tải ảnh tự quay về hình cũ.
    const chibi = typeof window !== 'undefined' ? window.ArtemisZodiacBosses : null;
    if (chibi && chibi.draw(ctx, curBiome?.boss, r, t, hr, charge)) return;
    const B = curBiome, glow = B?.accent || '#a5b4fc';
    ctx.save(); ctx.rotate(Math.sin(t * .0014) * .08);
    ctx.fillStyle = '#0f172a'; ctx.strokeStyle = glow; ctx.lineWidth = 3;
    ctx.shadowColor = glow; ctx.shadowBlur = charge ? 28 : 13;
    ctx.beginPath(); for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12 - Math.PI / 2, rr = r * (i % 2 ? 1.16 : 1.4);
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = B?.trim || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(r * 1.45)}px serif`; ctx.fillText(B?.zodiac || '✦', 0, 2);
    for (let i = 0; i < 5; i++) {
      const a = t * .0012 + i * TAU / 5;
      orb(ctx, Math.cos(a) * r * 1.75, Math.sin(a) * r * 1.15, 6, glow, .7);
    }
    if (hr < .45) orb(ctx, 0, 0, r * 1.3, glow, .35);
    ctx.restore();
  }


  // Leo chapter-only mini-bosses. Drawn in canvas space at the entity origin;
  // e.r remains the physical hitbox, and this illustration never mutates e.
  const LEO_GUARDIAN_TYPES = Object.freeze({ 10: 'golem', 20: 'queen', 30: 'demon_king', 40: 'elder_dragon' });
  function leoBossPoly(c, points, color, edge = '#43251d', width = 2.8) {
    c.beginPath(); c.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.closePath(); c.fillStyle = color; c.fill();
    if (edge) { c.strokeStyle = edge; c.lineWidth = width; c.stroke(); }
  }
  function leoBossOval(c, x, y, rx, ry, color, edge = '#43251d', width = 2.8) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
    c.fillStyle = color; c.fill();
    if (edge) { c.lineWidth = width; c.strokeStyle = edge; c.stroke(); }
  }
  function leoBossLine(c, points, color, width) {
    c.beginPath(); c.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }
  function leoBossStar(c, x, y, size, color, points = 8) {
    const vertices = [];
    for (let i = 0; i < points * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / points, v = i % 2 ? size * .38 : size;
      vertices.push([x + Math.cos(a) * v, y + Math.sin(a) * v]);
    }
    leoBossPoly(c, vertices, color, '#a85b2a', 1.2);
  }
  function leoBossEyes(c, x, y, gap = 10, color = '#31251f') {
    for (const d of [-1, 1]) {
      leoBossOval(c, x + d * gap, y, 3.6, 5.2, color, null);
      leoBossOval(c, x + d * gap - 1, y - 2, 1.2, 1.5, '#ffffff', null);
    }
  }
  function drawLeoGuardian(c, t, rage, charge) {
    const pulse = Math.sin(t * .004) * 2;
    // Golem sư tử: bờm 14 tia, giáp vảy đồng và khiên hình mặt trời.
    leoBossPoly(c, [[-28,5],[-40,33],[-29,43],[28,43],[42,31],[30,5]], '#8a4527', '#442113', 4);
    for (let i = 0; i < 14; i++) {
      const a = i * TAU / 14, x = Math.cos(a) * 29, y = -17 + Math.sin(a) * 27;
      leoBossPoly(c, [[x - 7,y],[x + Math.cos(a)*12,y + Math.sin(a)*13],[x + 7,y + 3]],
        i % 2 ? '#db792b' : '#fbbf24', '#9a4b1b', 1.6);
    }
    leoBossOval(c,-19,32,12,12,'#a65a27');
    leoBossOval(c,19,32,12,12,'#a65a27');
    leoBossOval(c,0,8,28,28,'#d9a441','#6c371c',4);
    leoBossPoly(c,[[-19,-1],[0,-12],[19,-1],[16,26],[0,34],[-16,26]],'#f9c65c','#9a4b1b',3);
    leoBossOval(c,0,4,10,12,'#fff3c4','#bb6b24');
    leoBossStar(c,0,3,10,'#fff0a6');
    leoBossOval(c,0,-21,23,24,'#f7c675','#9c5c2a',4);
    leoBossOval(c,-22,-28,9,10,'#f8bc5b');
    leoBossOval(c,22,-28,9,10,'#f8bc5b');
    leoBossEyes(c,0,-22,10);
    leoBossOval(c,0,-7,13,9,'#fff4d1','#d39c60',1.5);
    leoBossPoly(c,[[-5,-11],[5,-11],[0,-4]],'#864730',null);
    leoBossLine(c,[[0,-4],[0,0],[-5,3]],'#864730',1.7);
    leoBossPoly(c,[[-18,-43],[-12,-55],[-1,-43],[8,-56],[20,-43],[17,-34],[-17,-34]],'#ffdf78','#a85b2a',2);
    leoBossStar(c,0,-41,5,'#ffffff');
    c.save(); c.translate(28,15 + pulse*.3); c.rotate(-.13);
    leoBossOval(c,0,0,22,29,'#894520','#5a2a19',4);
    leoBossOval(c,0,0,18,25,'#f7bd55','#ffe19b',3);
    leoBossStar(c,0,-2,15,charge?'#ffffff':'#fff0ab');
    leoBossOval(c,0,-2,5,5,'#f97316','#9a451a',1);
    c.restore();
    if (rage) leoBossStar(c,-29,-44,7,'#fb7185');
  }
  function drawLeoPriest(c, t, rage, charge) {
    const float = Math.sin(t * .003) * 3;
    // Tế sư bay: áo nghi lễ tím/hồng, hai ấn năng lượng và trượng thái dương.
    c.save(); c.translate(0,float);
    for(const d of [-1,1]){
      leoBossPoly(c,[[d*12,5],[d*42,-8],[d*36,26],[d*22,21]], d<0?'#b981ed':'#f9a8d4','#673a7a',2.5);
      leoBossOval(c,d*40,-12,9,9,charge?'#fff8bd':'#f5d0fe','#a855f7',2);
      leoBossStar(c,d*40,-12,5,'#fff8e0');
    }
    leoBossPoly(c,[[-21,5],[-36,39],[-13,48],[0,37],[13,48],[36,39],[21,5]],'#9356bd','#5a317b',3);
    leoBossPoly(c,[[-12,17],[-15,40],[0,34],[15,40],[12,17]],'#fbcfe8','#a855f7',2);
    for(let i=-1;i<=1;i++)leoBossStar(c,i*12,35,4,'#ffe08a');
    leoBossOval(c,0,-18,22,24,'#ffe6cb','#9a637d',3);
    leoBossPoly(c,[[-26,-26],[-19,-48],[-3,-42],[8,-55],[25,-33],[22,-20],[8,-31],[-12,-29]],'#7c3aa2','#4a2468',3);
    leoBossEyes(c,0,-18,9,'#6b2b72');
    leoBossLine(c,[[-4,-6],[0,-4],[4,-6]],'#a54e7e',2);
    leoBossPoly(c,[[-18,-41],[-8,-49],[0,-61],[8,-49],[18,-41]],'#f9d06b','#a96927',2);
    leoBossStar(c,0,-51,7,'#fff7c2');
    leoBossLine(c,[[31,43],[31,-55]],'#f9cf66',5);
    leoBossOval(c,31,-55,13,13,charge?'#fff6a2':'#ffc579','#e68b34',2);
    leoBossStar(c,31,-55,10,'#fffbea');
    c.restore();
    if(rage){leoBossStar(c,-48,-34,6,'#fda4af');leoBossStar(c,45,21,5,'#fda4af');}
  }
  function drawLeoExecutioner(c, t, rage, charge) {
    const flicker = Math.sin(t * .01) * 3;
    // Hiệp sĩ hỏa hình góc cạnh; kiếm dài và mũ sừng, khác hoàn toàn sư vệ.
    leoBossPoly(c,[[-22,-9],[-45,12],[-36,44],[-13,34],[0,48],[18,34],[39,44],[46,9],[19,-9]],'#761a29','#3d0b16',4);
    for(const d of [-1,1]){
      leoBossPoly(c,[[d*13,9],[d*31,8],[d*35,26],[d*18,30]],'#b12b35','#5d1520',2.5);
      leoBossOval(c,d*17,37,12,10,'#52202a','#f87d4e',2);
    }
    leoBossPoly(c,[[-21,-16],[0,-28],[21,-16],[23,20],[0,33],[-23,20]],'#d94a30','#65231f',3);
    leoBossPoly(c,[[-9,-16],[9,-16],[6,16],[0,27],[-6,16]],'#ffb750','#81331e',2);
    leoBossStar(c,0,1,9,'#fff0ae');
    leoBossOval(c,0,-29,20,21,'#65303b','#f87148',3);
    leoBossPoly(c,[[-19,-44],[-25,-62],[-5,-51],[0,-59],[6,-51],[25,-62],[18,-44],[15,-22],[-15,-22]],'#a52e32','#571927',3);
    leoBossPoly(c,[[-14,-30],[-8,-40],[8,-40],[14,-30],[8,-20],[-8,-20]],'#2d1b2b','#fca85b',2);
    leoBossEyes(c,0,-29,8,charge?'#fffbad':'#ffd18a');
    leoBossLine(c,[[-7,-16],[7,-16]],'#f97316',2);
    c.save();c.translate(-32,15);c.rotate(-.37 + Math.sin(t*.003)*.05);
    leoBossLine(c,[[0,38],[0,-49]],'#f9cb6d',6);
    leoBossPoly(c,[[-9,-10],[0,-64 + flicker],[10,-10],[0,4]],'#ffcf70','#d94823',3);
    leoBossPoly(c,[[-4,-10],[0,-52 + flicker*.7],[4,-10],[0,-2]],'#fff7c4',null);
    leoBossLine(c,[[-15,3],[15,3]],'#7f1d1d',6);
    leoBossOval(c,0,28,5,6,'#fbbf24','#7f1d1d',2);
    c.restore();
    if(rage)for(let i=0;i<3;i++)leoBossStar(c,26+i*6,-54+i*11,4+i,'#fb923c');
  }
  function drawLeoDragon(c, t, rage, charge) {
    const flap = Math.sin(t*.004)*5;
    // Nhật long: hai cánh ngọc, sừng mặt trời và thân rồng bốn chân.
    leoBossLine(c,[[23,21],[46,28],[54,9],[44,-2]],'#d19a45',11);
    leoBossStar(c,46,-2,7,'#fde68a');
    for(const d of [-1,1]){
      leoBossPoly(c,[[d*11,-16],[d*34,-48-flap],[d*69,-37-flap],[d*55,-5],[d*69,15],[d*32,5]],
        d<0?'#44bcc4':'#72dfe0','#25586c',3);
      leoBossLine(c,[[d*13,-14],[d*33,-32-flap],[d*58,-30-flap]],'#c7fff5',3);
      leoBossPoly(c,[[d*20,26],[d*33,43],[d*17,46],[d*10,34]],'#3a8b98','#1e5268',2.5);
    }
    leoBossOval(c,0,13,28,32,'#2b869b','#1a526b',4);
    leoBossOval(c,0,23,18,21,'#ffdfa2','#bd8653',2);
    for(let i=-1;i<=1;i++)leoBossLine(c,[[-10,19+i*9],[10,19+i*9]],'#c89562',2);
    leoBossOval(c,0,-24,26,26,'#5bd0d8','#1b627c',4);
    for(const d of [-1,1]){
      leoBossPoly(c,[[d*13,-42],[d*20,-66],[d*27,-48]],'#fcd26b','#99612c',2);
      leoBossPoly(c,[[d*20,-14],[d*35,-20],[d*27,-5]],'#40aab8','#205c73',2);
    }
    leoBossPoly(c,[[-9,-46],[0,-58],[9,-46]],'#fbbf24','#99612c',2);
    leoBossEyes(c,0,-26,12,'#17425a');
    leoBossOval(c,0,-8,16,10,'#dbfbeb','#2b869b',2);
    leoBossOval(c,0,-13,4,3,'#286479',null);
    if(charge)leoBossStar(c,0,-7,11,'#fff8b7');
    else leoBossLine(c,[[-6,0],[6,0]],'#2b869b',2);
    if(rage){leoBossStar(c,-41,-48,5,'#fff0a6');leoBossStar(c,39,-43,5,'#fff0a6');}
  }
  function drawLeoSubBoss(c, e, t, useSprites) {
    if (!e || e.isBoss !== true || Number(e.campaignChapter) !== 1
      || LEO_GUARDIAN_TYPES[e.campaignRoom] !== e.type || !(e.r > 0)) return false;
    // The sprite cache calls this same painter with no useSprites flag to build
    // transparent atlases, avoiding recursion. Canvas remains the safe fallback.
    if (useSprites && typeof ArtemisLeoSubBossSprites !== 'undefined'
      && ArtemisLeoSubBossSprites.drawEntity(c, e, t, drawLeoSubBoss)) return true;
    const ratio = e.hp / Math.max(1,e.maxHp), rage = ratio < .35;
    const charge = e.attackTimer > 0 && e.attackTimer <= .75;
    c.save();
    try {
      c.scale(e.r / 48, e.r / 48);
      c.lineJoin = 'round'; c.lineCap = 'round';
      // Subtle glow during the same warning period as the actual bullets.
      if (charge) {
        c.globalAlpha = .32;
        leoBossOval(c,0,0,45,45,e.color || '#fde68a',null);
        c.globalAlpha = 1;
      }
      if (e.campaignRoom === 10) drawLeoGuardian(c,t,rage,charge);
      else if (e.campaignRoom === 20) drawLeoPriest(c,t,rage,charge);
      else if (e.campaignRoom === 30) drawLeoExecutioner(c,t,rage,charge);
      else drawLeoDragon(c,t,rage,charge);
    } finally { c.restore(); }
    return true;
  }

  const BOSSFN = {
    golem: drawGolem, queen: drawQueen, demon_king: drawDemon,
    elder_dragon: drawElderDragon, eclipse_sovereign: drawEclipseSovereign,
    astral_devourer: drawAstralDevourer, mycelium_queen: drawMyceliumQueen,
    zodiac_aries: drawZodiacBoss, zodiac_taurus: drawZodiacBoss, zodiac_gemini: drawZodiacBoss, zodiac_cancer: drawZodiacBoss, zodiac_leo: drawZodiacBoss, zodiac_virgo: drawZodiacBoss, zodiac_libra: drawZodiacBoss, zodiac_scorpio: drawZodiacBoss, zodiac_sagittarius: drawZodiacBoss, zodiac_capricorn: drawZodiacBoss, zodiac_aquarius: drawZodiacBoss, zodiac_pisces: drawZodiacBoss
  };

  // ---------- trạng thái hiển thị riêng từng quái (không ghi vào dữ liệu game) ----------
  const VIS = new WeakMap();
  function visOf(e, now) { let v = VIS.get(e); if (!v) { v = { t0: now, face: 1, landed: false }; VIS.set(e, v); } return v; }
  // Admin-only preview helper: skip the 900ms entrance drop so the first
  // Attack/Hit/Death sprite starts on-screen. No combat entity fields mutate.
  function primePreviewEnemy(e, now) {
    if (!e) return;
    const t = Number.isFinite(now) ? now : 0;
    const v = visOf(e,t);
    v.t0=t-1600;
    v.landed=true;
  }

  function drawBody(ctx, e, t, B, v) {
    const r = e.r, ty = e.type;
    if (ty === 'dragon_whelp') { drawDragonWhelp(ctx, r, t); return; }
    if (ty === 'cloud_wisp') { drawCloudWisp(ctx, r, t); return; }
    if (ty === 'sky_sentinel') { drawSkySentinel(ctx, r, t); return; }
    if (ty === 'rift_stalker') { drawRiftStalker(ctx, r, t); return; }
    if (ty === 'eclipse_oracle') { drawEclipseOracle(ctx, r, t); return; }
    if (ty === 'obsidian_brute') { drawObsidianBrute(ctx, r, t); return; }
    if (ty === 'nebula_herald') { drawNebulaHerald(ctx, r, t); return; }
    if (ty === 'frost_sentinel') { drawFrostSentinel(ctx, r, t); return; }
    if (ty === 'spore_runner' || ty === 'mire_shaman' || ty === 'hive_guardian') {
      const colors = { spore_runner: '#5eead4', mire_shaman: '#c084fc', hive_guardian: '#fb7185' };
      blob(ctx, r, colors[ty], '#23132f');
      ctx.fillStyle = ty === 'spore_runner' ? '#99f6e4' : (ty === 'mire_shaman' ? '#e9d5ff' : '#fda4af');
      ctx.beginPath(); ctx.ellipse(0, -r * .38, r * .8, r * .48, 0, Math.PI, TAU); ctx.fill();
      eyes(ctx, 0, 1, 3);
      return;
    }
    if (ty === 'star_wraith') { drawStarWraith(ctx, r, t); return; }
    if (BOSSFN[ty]) { const hr = clamp(e.hp / Math.max(1, e.maxHp), 0, 1); BOSSFN[ty](ctx, r, t, hr, e.attackTimer > 0 && e.attackTimer < 0.48); return; }
    const sk = skinOf(B, ty);
    if (!sk) { blob(ctx, r, '#94a3b8', '#334155'); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke(); eyes(ctx, 0, -2, 3); return; }
    if (ty === 'slime') drawSlime(ctx, r, t, sk);
    else if (ty === 'goblin') { ctx.rotate(Math.sin(t * 0.012 + e.x * 0.1) * 0.06); drawGoblin(ctx, r, t, sk, v.face); }
    else if (ty === 'skeleton_mage') drawMage(ctx, r, t, sk);
    else if (ty === 'plant_turret') drawPlant(ctx, r, t, sk, e);
    else if (ty === 'bat') drawBat(ctx, r, t, sk, v.face);
  }

  function drawMonster(ctx, e, nowMs) {
    const B = curBiome, big = e.isBoss, v = visOf(e, nowMs);
    const r = e.r, S = big ? 1.15 : 1;
    if (Math.abs(e.vx || 0) > 8) v.face = e.vx < 0 ? -1 : 1;
    const dur = big ? 0.9 : 0.42, age = (nowMs - v.t0) / 1000, k = clamp(age / dur, 0, 1);
    const aura = e.isBoss ? (e.campaignChapter === 1 && e.campaignRoom < 50 ? e.color || AURA_T[e.type] : AURA_T[e.type]) : (skinOf(B, e.type) ? skinOf(B, e.type)[0] : '#94a3b8');
    const drop = big ? -Math.pow(1 - k, 2) * 190 : 0;
    const sc = big ? 1 : 0.55 + 0.45 * (1 - Math.pow(1 - k, 3));
    ctx.save(); ctx.translate(e.x, e.y);

    // bóng + vầng khí (không bị scale/nhấc)
    ctx.save(); ctx.globalAlpha = big ? (0.25 + 0.75 * k) : 1; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0, r * S + 3, r * S * 1.05 * (big ? 0.5 + 0.5 * k : 1), r * S * 0.42 * (big ? 0.5 + 0.5 * k : 1), 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.5 * (big ? k : 1); if (Game.ultraGfx) addMode(ctx);
    const ag = ctx.createRadialGradient(0, r * 0.7, 0, 0, r * 0.7, r * 1.7 * S); ag.addColorStop(0, aura); ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.ellipse(0, r * 0.9 * S, r * 1.6 * S, r * 0.7 * S, 0, 0, TAU); ctx.fill(); ctx.restore();
    // Dấu trạng thái dùng chung cho PNG và thân vector; gọi theo tọa độ bản đồ.
    if (typeof SkillCombatVfx !== 'undefined') {
      ctx.save(); ctx.translate(-e.x, -e.y); SkillCombatVfx.status(ctx, e, nowMs, Game); ctx.restore();
    }
    // vòng triệu hồi lúc xuất hiện
    if (!big && k < 1) { ctx.save(); ctx.strokeStyle = aura; ctx.globalAlpha = 0.9 * (1 - k); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * (2.2 - 1.1 * k), r * (2.2 - 1.1 * k) * 0.4, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([4, 4]); ctx.rotate(0.5); ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * (1.6 - 0.6 * k), r * (1.6 - 0.6 * k) * 0.4, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    // boss: pháp trận + lúc tiếp đất
    if (big) {
      ctx.save(); ctx.rotate(-nowMs * 0.0028); ctx.strokeStyle = aura; ctx.globalAlpha = 0.8 * k; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.arc(0, 0, r * S + 15, 0, TAU); ctx.stroke(); ctx.rotate(nowMs * 0.0055); ctx.strokeStyle = '#fde047'; ctx.globalAlpha = 0.45 * k; ctx.lineWidth = 1.6; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(0, 0, r * S + 22, 0, TAU); ctx.stroke(); ctx.restore();
      if (k >= 1) {
        if (!v.landed) { v.landed = true; if (typeof Game.shakeTime === 'number') { Game.shakeTime = Math.max(Game.shakeTime, 0.32); Game.shakeMag = Math.max(Game.shakeMag || 0, 7); } }
        const a2 = age - dur; if (a2 < 0.55) { const q = a2 / 0.55; ctx.save(); ctx.strokeStyle = aura; ctx.globalAlpha = 0.9 * (1 - q); ctx.lineWidth = 5 * (1 - q) + 1; ctx.beginPath(); ctx.ellipse(0, r, r * (1 + q * 5), r * (1 + q * 5) * 0.45, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
      }
    }
    // thân (squash & stretch)
    const bounce = Math.sin(nowMs * (e.type === 'bat' ? 0.02 : 0.009) + e.x * 0.1);
    const hover = e.type === 'bat' ? Math.sin(nowMs * 0.012 + e.y) * 4 - 6 : 0;
    ctx.save(); ctx.translate(0, hover + drop); ctx.globalAlpha = big ? 1 : clamp(k * 1.6, 0, 1);
    // PNG giữ tỉ lệ; chỉ thân vector cũ dùng squash/stretch.
    ctx.scale(sc * S, sc * S);
    const flash = e.hitFlashTimer > 0;
    if (flash) ctx.filter = 'brightness(2.6) saturate(0.55)';
    const customBossDrawn = !!(e.isBoss && (!Game.mode || Game.mode === 'campaign') &&
      root.ArtemisContentRuntime?.drawBoss(ctx,e,nowMs));
    const leoSpriteDrawn = !customBossDrawn && typeof ArtemisLeoAnimation !== 'undefined' && ArtemisLeoAnimation.drawEntity(ctx, e, nowMs);
    const leoSubBossDrawn = !customBossDrawn && !leoSpriteDrawn && typeof drawLeoSubBoss === 'function' && drawLeoSubBoss(ctx, e, nowMs, true);
    if (!customBossDrawn && !leoSpriteDrawn && !leoSubBossDrawn && (typeof MonsterArt === 'undefined' || !MonsterArt.draw(ctx, e))) {
      ctx.save(); ctx.scale(1 + bounce * (big ? 0.025 : 0.05), 1 - bounce * (big ? 0.025 : 0.05));
      drawBody(ctx, e, nowMs, B, v); ctx.restore();
    }
    if (flash) { ctx.filter = 'none'; orb(ctx, 0, 0, r * 1.25, '#ffffff', Math.min(1, e.hitFlashTimer / 0.14) * 0.8); }
    ctx.restore();

    // VFX đi qua renderer đang dùng, trước cảnh báo và thanh máu.
    if (typeof StatusVFX !== 'undefined') StatusVFX.drawEnemy(ctx, e, nowMs, Game);

    // cảnh báo sắp tấn công
    if (!big && e.attackTimer > 0 && e.attackTimer < 0.5) {
      const q = 1 - e.attackTimer / 0.5; ctx.strokeStyle = `rgba(248,113,113,${0.3 + q * 0.7})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * (1.9 - q * 0.7), 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(248,113,113,${q * 0.9})`; ctx.font = '900 13px Inter'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -r - 18);
    }


    // thanh máu quái thường
    if (!big && k >= 0.6) {
      const bw = 38, bh = 6, by = -r - 14, hr = Math.max(0, e.hp / e.maxHp), dr = Math.max(0, (typeof e.displayHp === 'number' ? e.displayHp : e.hp) / e.maxHp);
      ctx.fillStyle = 'rgba(8,12,22,0.9)'; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(-bw / 2 - 1.5, by - 1.5, bw + 3, bh + 3, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.roundRect(-bw / 2, by, bw * dr, bh, 3); ctx.fill();
      const hg = ctx.createLinearGradient(0, by, 0, by + bh); hg.addColorStop(0, hr > 0.35 ? '#fb7185' : '#fecaca'); hg.addColorStop(1, '#be123c');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(-bw / 2, by, bw * hr, bh, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-bw / 2 + 2, by + 1, Math.max(0, bw * hr - 4), 1.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; for (const f of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(-bw / 2 + bw * f, by); ctx.lineTo(-bw / 2 + bw * f, by + bh); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ---------- Đạn quái: màu theo biome, lõi xoay, viền tối để luôn nổi bật trên mọi nền ----------
  function drawEnemyBullet(ctx, eb, now) {
    const [c0, c1, c2] = curBiome.bullet, r = eb.r;
    if (eb.trail && eb.trail.length > 1) for (let t = 0; t < eb.trail.length; t++) { const pt = eb.trail[t], q = (t + 1) / eb.trail.length; ctx.fillStyle = rgba(c2, q * 0.45); ctx.beginPath(); ctx.arc(pt.x, pt.y, r * q * 0.9, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.translate(eb.x, eb.y);
    ctx.save(); if (Game.ultraGfx) addMode(ctx); const gr = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.1); gr.addColorStop(0, rgba(c1, 0.9)); gr.addColorStop(0.5, rgba(c2, 0.45)); gr.addColorStop(1, rgba(c2, 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * 2.1, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(8,4,12,0.85)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, TAU); ctx.fill();
    ctx.rotate(now * 0.012 + eb.x * 0.05);
    ctx.fillStyle = c1; ctx.strokeStyle = c2; ctx.lineWidth = 1.2; poly(ctx, [[0, -r * 1.1], [r * 0.55, 0], [0, r * 1.1], [-r * 0.55, 0]]); ctx.fill(); ctx.stroke();
    ctx.rotate(Math.PI / 2); poly(ctx, [[0, -r * 0.8], [r * 0.4, 0], [0, r * 0.8], [-r * 0.4, 0]]); ctx.fillStyle = rgba(c2, 0.85); ctx.fill();
    ctx.fillStyle = c0; ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Vòng khoá mục tiêu: màu theo biome
  function drawTargetReticle(ctx, target, nowMs) {
    ctx.save(); ctx.translate(target.x, target.y + 4); ctx.scale(1, 0.55); ctx.rotate(nowMs * 0.004);
    ctx.strokeStyle = 'rgba(250,204,21,0.92)'; ctx.lineWidth = 2.6; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.arc(0, 0, target.r + 13, 0, TAU); ctx.stroke();
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.4; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (target.r + 8), Math.sin(a) * (target.r + 8)); ctx.lineTo(Math.cos(a) * (target.r + 18), Math.sin(a) * (target.r + 18)); ctx.stroke(); }
    ctx.restore();
  }

  return {
    drawArena, drawMonster, drawEnemyBullet, drawTargetReticle, init(g) { Game = g; },
    biomeLabel() { return pickBiome().label; },
    tint() { const B = curBiome; return { accent: B.accent, glow: B.glow, mote: B.torch[1], ray: hex2(B.accent).join(', ') }; },
    _debug: { BIOMES, SK, POOLS, pickBiome, buildStatic, drawBody, drawLeoSubBoss, primePreviewEnemy, setBiome(id) { curBiome = BIOMES[id]; return curBiome; } }
  };
  }
  root.ArtemisArenaRenderer = Object.freeze({ create: createArenaRenderer });
})(globalThis);
