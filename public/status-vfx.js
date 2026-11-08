/* Hạt trạng thái dùng texture thật. Chỉ vẽ; sát thương/nhịp do combat-status.js quyết định. */
(function (root) {
  'use strict';
  const SETS = {
    burn: ['burn_a', 'burn_b'],
    poison: ['poison_a', 'poison_b'],
    frost: ['frost_a', 'frost_b'],
    spark: ['spark_a'],
    smoke: ['smoke_a'],
  };
  const cache = new Map();
  const seeds = new WeakMap();
  let nextSeed = 1;
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function frames(kind) {
    return SETS[kind] ? SETS[kind].slice() : [];
  }

  function shouldDraw(game) {
    return !!game && !game.lowGfx && !motion.matches && !game.reduceMotion;
  }

  function image(slot) {
    if (cache.has(slot)) return cache.get(slot);
    const ImageCtor = root.Image;
    if (typeof ImageCtor !== 'function') { cache.set(slot, null); return null; }
    const img = new ImageCtor();
    img.decoding = 'async';
    img.src = 'assets/vfx/' + slot + '.webp';
    cache.set(slot, img);
    return img;
  }

  // Sinh số giả ngẫu nhiên tất định từ hạt giống: cùng trạng thái => cùng chuỗi hạt.
  function rand(seed, i) {
    let x = (seed * 2654435761 + i * 40503) >>> 0;
    x ^= x >>> 13; x = (x * 1274126177) >>> 0; x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  function particles(state) {
    const kind = state && state.kind;
    const set = SETS[kind];
    if (!set) return [];
    const seed = (state.seed | 0) || 1;
    const radius = Math.max(6, Number(state.radius) || 16);
    const t = Number(state.t) || 0;
    const count = 4 + ((seed >>> 0) % 4); // 4..7 hạt kể cả seed âm
    const out = [];
    for (let i = 0; i < count; i++) {
      const phase = rand(seed, i);
      // Mỗi hạt có chu kỳ riêng 0,5–1,1s nên không nhấp nháy đồng loạt.
      const period = 0.5 + rand(seed, i + 100) * 0.6;
      const life = ((t / period) + phase) % 1;
      // Lửa/độc bốc lên; băng thì toả ngang và chậm hơn.
      const rise = kind === 'frost' ? 0.4 : 1;
      const spread = kind === 'frost' ? 1.25 : 1;
      out.push({
        slot: set[i % set.length],
        dx: (rand(seed, i + 11) - 0.5) * radius * 1.5 * spread,
        dy: -life * radius * 1.8 * rise + radius * 0.35,
        size: radius * (0.5 + rand(seed, i + 21) * 0.75),
        alpha: Math.max(0, 1 - life) * (kind === 'frost' ? 0.8 : 0.9),
        rot: rand(seed, i + 31) * Math.PI * 2 + (kind === 'frost' ? 0 : life * 1.2),
      });
    }
    return out;
  }

  function draw(c, state, game) {
    if (!shouldDraw(game)) return false;
    const list = particles(state);
    if (!list.length) return false;
    let drew = 0;
    const alpha = c.globalAlpha;
    for (const p of list) {
      const img = image(p.slot);
      if (!img || !img.complete || !img.naturalWidth) continue;
      c.globalAlpha = alpha * p.alpha;
      const half = p.size / 2;
      c.drawImage(img, state.x + p.dx - half, state.y + p.dy - half, p.size, p.size);
      drew++;
    }
    c.globalAlpha = alpha;
    return drew > 0;
  }

  function drawEnemy(c, enemy, nowMs, game) {
    if (!shouldDraw(game) || !enemy || !(enemy.hp > 0)) return false;
    if (!seeds.has(enemy)) seeds.set(enemy, nextSeed++);
    const seed = seeds.get(enemy);
    let drew = false;
    for (const [timer, kind, offset] of [['burnTimer', 'burn', 0], ['poisonTimer', 'poison', 7], ['slowTimer', 'frost', 13]]) {
      if (enemy[timer] > 0) drew = draw(c, { kind, seed: seed + offset, x: 0, y: -enemy.r * 0.15,
        radius: enemy.r * 0.9, t: nowMs * 0.001 }, game) || drew;
    }
    return drew;
  }

  root.StatusVFX = { SETS, frames, particles, shouldDraw, draw, drawEnemy, _cache: cache };
})(globalThis);
