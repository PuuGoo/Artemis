(function (root) {
  'use strict';
  const motifs = {
    arrow:'<path d="M18 49h51M53 29l20 20-20 20M30 36l13 13-13 13"/>',
    sword:'<path d="M47 17l7 8-4 38-10 5-4-5 4-38zM32 65l25-3M40 68l-3 13"/>',
    flame:'<path d="M48 18c11 16-7 19 6 28 3-9 10-9 10-9 12 24 0 39-16 39-17 0-29-17-17-35 2 10 9 10 12 4-3-11 2-20 5-27zM49 54c8 10 5 17-2 17-8 0-9-9 2-17z"/>',
    frost:'<path d="M48 19v58M23 34l50 29M23 63l50-29M43 25l5 5 5-5M43 71l5-5 5 5M28 35l8 2-2 8M68 51l-8 2 2 8"/>',
    thunder:'<path d="M54 15L30 51h17l-7 30 27-40H49z"/>',
    shield:'<path d="M48 17l27 12-4 27c-3 15-15 23-23 27-8-4-20-12-23-27l-4-27zM37 48l9 9 17-19"/>',
    heart:'<path d="M48 73L22 48c-14-17 6-35 22-19l4 5 4-5c16-16 36 2 22 19z"/>',
    star:'<path d="M48 14l8 24 25 1-20 15 7 25-20-15-20 15 7-25-20-15 25-1z"/>',
    orbit:'<circle cx="48" cy="48" r="12"/><ellipse cx="48" cy="48" rx="34" ry="16" transform="rotate(-32 48 48)"/><circle cx="73" cy="29" r="5" fill="currentColor" stroke="none"/>',
    leaf:'<path d="M19 73c41 4 58-24 58-53-35 2-62 16-58 53zM22 72c14-19 28-30 47-39M42 51l-3-18M54 42l14 7"/>',
    skull:'<path d="M48 17c-18 0-31 14-31 31 0 10 7 17 16 21v10h30V69c9-4 16-11 16-21 0-17-13-31-31-31zM36 46h1m22 0h1M44 62l4-6 4 6"/>',
    potion:'<path d="M36 17h24M43 17v26L25 69c-4 7 0 12 8 12h30c8 0 12-5 8-12L53 43V17M34 64h28"/>',
    wing:'<path d="M47 65C19 74 16 48 14 23c17 7 29 17 33 42zM49 65c28 9 31-17 33-42-17 7-29 17-33 42zM32 44l12 9M64 44L52 53"/>',
    dragon:'<path d="M27 70c-3-18 4-33 20-40l-5-12 20 9-4 10c15 7 16 28 7 34l-8-11-9 14-9-13zM57 43h1"/>',
    bloom:'<circle cx="48" cy="48" r="10"/><path d="M48 38c-22-26-31-1-12 9-26-6-24 20 2 12-8 26 18 25 12 1 15 20 30-3 10-12 26-7 9-30-10-10z"/>',
  };
  function motif(id) {
    const s = String(id).toLowerCase();
    if (/arrow|shot|bolt/.test(s)) return 'arrow';
    if (/scythe|sword|strike|blade/.test(s)) return 'sword';
    if (/flame|fire|meteor|fury/.test(s)) return 'flame';
    if (/frost|freeze|ice/.test(s)) return 'frost';
    if (/thunder|lightning/.test(s)) return 'thunder';
    if (/guard|resilien|root/.test(s)) return 'shield';
    if (/life|heal|revive|valkyrie/.test(s)) return 'heart';
    if (/orb|circle|ring|rotat/.test(s)) return 'orbit';
    if (/vine|plant|bloom|leaf/.test(s)) return 'leaf';
    if (/devil|agony|shadow/.test(s)) return 'skull';
    if (/potion|spring/.test(s)) return 'potion';
    if (/sprite|flight|aerie/.test(s)) return 'wing';
    if (/dragon/.test(s)) return 'dragon';
    if (/equinox|flower/.test(s)) return 'bloom';
    return 'star';
  }
  const palettes = { etched:['#ff74ef','#8126c7','#350b5e'],blessing:['#ffe08c','#ae48ce','#3c1670'],enhancement:['#84d5ff','#225ac7','#071c69'],ability:['#ff91ef','#b02abf','#40106a'] };
  function src(rune) {
    const id=String(rune?.id||'star');
    const [shine,mid,dark]=palettes[rune?.type]||palettes.etched;
    let hash=0; for(const ch of id) hash=(hash*31+ch.charCodeAt(0))>>>0;
    const stars=Array.from({length:5},(_,i)=>{const x=18+(hash>>(i*5)%24)%62,y=15+(hash>>(i*4+3)%24)%64;return `<circle cx="${x}" cy="${y}" r="${i%2?1:1.5}" fill="#fff" opacity=".6"/>`}).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="g" cx=".35" cy=".25"><stop stop-color="${shine}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs><path d="M48 3L79 20 90 48 77 78 48 93 17 78 6 48 17 20Z" fill="url(#g)" stroke="${shine}" stroke-width="4"/><path d="M48 10L74 25 82 48 70 72 48 85 25 72 14 48 25 25Z" fill="#100b42" fill-opacity=".47" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>${stars}<g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="drop-shadow(0 0 5px ${shine})">${motifs[motif(id)]}</g><circle cx="48" cy="48" r="37" fill="none" stroke="${shine}" stroke-opacity=".45" stroke-dasharray="2 8"/></svg>`;
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }
  const crystalFamilies = { ability:'skill', enhancement:'grow', blessing:'bless', etched:'imprint' };
  const crystalTiers = { normal:'10', fine:'20', rare:'30', epic:'40', epic_1:'41', epic_2:'42', legendary:'50', legendary_1:'51', legendary_2:'52', legendary_3:'53', mythic:'60' };
  function crystalSrc(type, tier) {
    const family = crystalFamilies[type];
    let code = crystalTiers[tier];
    if (!family || !code) return null;
    // Bộ Khắc Ấn nguồn chỉ có bốn màu: giữ ảnh gốc, hiển thị dấu + bằng nhãn.
    if (type === 'etched') {
      if (tier === 'normal' || tier === 'fine') return null;
      if (tier.startsWith('epic')) code = '40';
      if (tier.startsWith('legendary')) code = '50';
    }
    return `assets/runes/crystals/Rune_${family}_${code}.png`;
  }
  function crystalPalette(tier) {
    const base = String(tier).split('_')[0];
    return ({ normal:['#5e6b8e','#9ea8c7','#323854'], fine:['#198533','#7ef28a','#014a16'], rare:['#2a5cb8','#8bd3ff','#0f2d8c'], epic:['#a025a5','#f6a0ff','#6b026f'], legendary:['#b7700a','#ffe482','#cb7101'], mythic:['#af232f','#ff9b9b','#8c1110'] })[base] || ['#5e6b8e','#9ea8c7','#323854'];
  }
  root.RuneArt=Object.freeze({src,motif,crystalSrc,crystalPalette});
})(typeof window === 'undefined'?globalThis:window);
