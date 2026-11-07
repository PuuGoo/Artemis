/* Artemis · 12 Zodiac Chibi Bosses (chapters 8–19)
 * Pure visual layer: no gameplay state, hitboxes, damage or timings are changed.
 * Each character is a hand-authored, local SVG. A load failure falls back to the
 * existing Canvas boss renderer instead of breaking the battle loop.
 */
(function (global) {
  'use strict';

  const SIGNS = Object.freeze({
    zodiac_aries:       { chapter: 8,  asset: '/assets/boss-ch8-aries.svg',          color: '#fb7185' },
    zodiac_taurus:      { chapter: 9,  asset: '/assets/boss-ch9-taurus.svg',         color: '#fbbf24' },
    zodiac_gemini:      { chapter: 10, asset: '/assets/boss-ch10-gemini.svg',        color: '#67e8f9' },
    zodiac_cancer:      { chapter: 11, asset: '/assets/boss-ch11-cancer.svg',        color: '#38bdf8' },
    zodiac_leo:         { chapter: 12, asset: '/assets/boss-ch12-leo.svg',           color: '#fbbf24' },
    zodiac_virgo:       { chapter: 13, asset: '/assets/boss-ch13-virgo.svg',         color: '#d9f99d' },
    zodiac_libra:       { chapter: 14, asset: '/assets/boss-ch14-libra.svg',         color: '#f0abfc' },
    zodiac_scorpio:     { chapter: 15, asset: '/assets/boss-ch15-scorpio.svg',       color: '#c084fc' },
    zodiac_sagittarius: { chapter: 16, asset: '/assets/boss-ch16-sagittarius.svg',   color: '#a5b4fc' },
    zodiac_capricorn:   { chapter: 17, asset: '/assets/boss-ch17-capricorn.svg',     color: '#7dd3fc' },
    zodiac_aquarius:    { chapter: 18, asset: '/assets/boss-ch18-aquarius.svg',      color: '#22d3ee' },
    zodiac_pisces:      { chapter: 19, asset: '/assets/boss-ch19-pisces.svg',        color: '#5eead4' }
  });
  const images = Object.create(null);

  function preload(type) {
    const data = SIGNS[type];
    if (!data || typeof Image === 'undefined') return null;
    if (images[type]) return images[type];
    const state = { image: null, ready: false, failed: false };
    images[type] = state;
    const img = new Image();
    state.image = img;
    img.onload = function () { state.ready = img.naturalWidth > 0; state.failed = !state.ready; };
    img.onerror = function () { state.failed = true; };
    img.decoding = 'async';
    img.src = data.asset;
    return state;
  }

  function draw(ctx, type, radius, nowMs, hpRatio, charging) {
    const sign = SIGNS[type];
    if (!sign || !ctx || !(Number(radius) > 0)) return false;
    const state = preload(type);
    if (!state || !state.ready || state.failed) return false;
    const t = Number.isFinite(nowMs) ? nowMs : 0;
    const hp = Number.isFinite(hpRatio) ? Math.max(0, Math.min(1, hpRatio)) : 1;
    const r = radius;
    const rage = hp < 0.35;
    let saved = false;
    try {
      ctx.save();
      saved = true;

      // Retain readable silhouettes on mobile and make the chibi feel alive.
      ctx.translate(0, Math.sin(t * 0.0056) * r * 0.048);
      ctx.rotate(Math.sin(t * 0.0018) * 0.038 + (charging ? Math.sin(t * 0.022) * 0.035 : 0));
      const scale = charging ? 1.065 : 1 + Math.sin(t * 0.004) * 0.012;
      ctx.scale(scale, scale);
      ctx.drawImage(state.image, -r * 1.72, -r * 1.87, r * 3.44, r * 3.44);

      // Attack cue and enraged outline remain visual-only (no projectile changes).
      if (charging || rage) {
        ctx.save();
        ctx.globalAlpha = charging ? 0.86 : 0.45 + 0.16 * Math.sin(t * 0.009);
        ctx.strokeStyle = charging ? '#fff5d6' : sign.color;
        ctx.shadowColor = sign.color;
        ctx.shadowBlur = charging ? 14 : 8;
        ctx.lineWidth = charging ? 3.5 : 2;
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.1, r * 1.52, r * 1.56, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      return true;
    } catch (_) {
      // Failed visual render must never abort the main game loop.
      state.failed = true;
      return false;
    } finally {
      if (saved) ctx.restore();
    }
  }

  // Warm image cache ahead of a room transition. No network/CDN dependency.
  if (typeof Image !== 'undefined') {
    Object.keys(SIGNS).forEach(preload);
  }
  global.ArtemisZodiacBosses = Object.freeze({
    draw: draw,
    preload: preload,
    sources: Object.freeze(SIGNS)
  });
})(typeof window !== 'undefined' ? window : {});