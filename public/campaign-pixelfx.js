// Sprite Pixelfx đã bake: không tính hạt/pixel mỗi frame, không có timer riêng.
(function (root) {
  'use strict';
  const cache = new Map();
  const failed = new Set();
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function drawSprite(ctx, id, x, y, width, height, now, alpha = 1) {
    const meta = root.ArtemisPixelFXAtlas?.[id];
    if (!meta || ![x, y, width, height, now, alpha].every(Number.isFinite) || width <= 0 || height <= 0 || failed.has(id)) return false;
    let image = cache.get(id);
    if (!image) {
      if (typeof Image !== 'function') return false;
      image = new Image();
      image.onerror = () => { failed.add(id); cache.delete(id); };
      image.src = meta.src;
      if (failed.has(id)) return false;
      cache.set(id, image);
      // Giới hạn bộ nhớ ảnh giải mã; chỉ các effect hiện tại được giữ nóng.
      if (cache.size > 4) cache.delete(cache.keys().next().value);
    } else { cache.delete(id); cache.set(id, image); }
    if (!image.complete || !image.naturalWidth) return false;
    const index = Math.floor(Math.max(0, now) * meta.fps / 1000) % meta.frames;
    ctx.save();
    try {
      ctx.globalAlpha *= Math.max(0, Math.min(1, alpha));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, index % meta.columns * meta.width, Math.floor(index / meta.columns) * meta.height,
        meta.width, meta.height, x, y, width, height);
    } finally { ctx.restore(); }
    return true;
  }
  function enabled(game = {}) {
    return !game.lowGfx && !motion?.matches && (!game.mode || game.mode === 'campaign');
  }
  function atmosphereFor(ambient) {
    if (ambient === 'snow') return 'snow';
    if (ambient === 'stars' || ambient === 'sparkle') return 'aurora';
    if (ambient === 'fireflies') return 'leaves';
    return 'fog';
  }
  function drawAtmosphere(ctx, w, h, pad, now, game, biome) {
    if (!enabled(game) || ![w, h, pad, now].every(Number.isFinite) || w <= pad * 2 || h <= pad * 2) return false;
    const id = atmosphereFor(biome.ambient), width = w - pad * 2, height = h - pad * 2;
    // Hai mảng nhỏ ở rìa, giữ vùng giữa sạch cho đạn và dấu báo nguy hiểm.
    const drew = drawSprite(ctx, id, pad, pad, width, Math.min(height, width * .5625), now,
      id === 'aurora' ? .22 : id === 'fog' ? .3 : .42);
    const secondary = id === 'leaves' || biome.ambient === 'sand' ? 'rays' : 'fog';
    const lower = drawSprite(ctx, secondary, pad, h - pad - height * .34, width, height * .34, now + 1700, .16);
    return drew || lower;
  }
  function drawTorch(ctx, torch, now, game, biome) {
    if (!enabled(game) || !['flame', 'brazier'].includes(biome.torchStyle)) return false;
    // Điểm phát lửa của sheet nằm ở (36, 76), không phải tâm ảnh.
    return drawSprite(ctx, 'torch', torch.x - 25.2, torch.y - 53.2, 50.4, 84, now + (torch.phase || 0) * 200, .95);
  }
  function drawPortal(ctx, rect, now, game) {
    if (!enabled(game) || !game.portalOpen) return false;
    // Khung portal được fit theo elip của sheet, không đổi vùng chạm cổng.
    const scale = Math.min(rect.w / 34, rect.h / 58);
    return drawSprite(ctx, 'portal', rect.x + rect.w / 2 - 76 * scale,
      rect.y + rect.h / 2 - 72 * scale, 152 * scale, 116 * scale, now, .9);
  }
  root.ArtemisPixelFX = Object.freeze({ drawSprite, enabled, atmosphereFor, drawAtmosphere, drawTorch, drawPortal });
})(typeof window !== 'undefined' ? window : globalThis);
