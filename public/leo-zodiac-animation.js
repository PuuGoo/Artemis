/* Artemis Leo (chapter 12): visual-only sprite overlay, with native Canvas fallback.
   This script is loaded by zodiac-chibi-bosses.js; it does not mutate combat state. */
(function (root) {
  'use strict';
  const CELL = 512;
  const ACTIONS = Object.freeze({
    idle: Object.freeze({ count: 6, frameMs: 170, loop: true, path: '/assets/zodiac/leo-idle.png' }),
    attack: Object.freeze({ count: 6, frameMs: 85, loop: false, path: '/assets/zodiac/leo-attack.png' }),
    hit: Object.freeze({ count: 4, frameMs: 95, loop: false, path: '/assets/zodiac/leo-hit.png' }),
    death: Object.freeze({ count: 6, frameMs: 145, loop: false, path: '/assets/zodiac/leo-death.png' })
  });
  const cache = Object.create(null);
  const entities = new WeakMap();
  let lastBoss = null;

  function preload(action) {
    const def = ACTIONS[action];
    if (!def || typeof root.Image !== 'function') return null;
    if (!cache[action]) {
      const image = new root.Image();
      const entry = { image, failed: false };
      cache[action] = entry;
      image.onload = function () {
        // Admin zodiac thumbnails are cached after their first successful draw.
        if (root.document) {
          root.document.querySelectorAll('canvas[data-zodiac="zodiac_leo"]').forEach(function (canvas) {
            canvas._zodiacRendered = false;
          });
        }
      };
      image.onerror = function () { entry.failed = true; };
      image.src = def.path;
    }
    return cache[action];
  }

  function isReady(action) {
    const entry = preload(action);
    if (!entry || entry.failed) return false;
    const image = entry.image;
    return image.complete === true && image.naturalWidth >= CELL * ACTIONS[action].count && image.naturalHeight >= CELL;
  }

  function drawFrame(ctx, action, index, radius) {
    if (!ctx || typeof ctx.drawImage !== 'function' || !isReady(action) || !(radius > 0)) return false;
    const def = ACTIONS[action];
    const i = Math.min(def.count - 1, Math.max(0, Math.floor(index)));
    // Every source frame has the same 512px cell, with feet at y=500 and shared alpha padding.
    // Keep game hitbox unchanged: visual size is derived from radius but never assigned to entity.
    const display = radius * 3.5;
    try {
      ctx.drawImage(cache[action].image, i * CELL, 0, CELL, CELL,
        -display / 2, radius - display * 500 / CELL, display, display);
      return true;
    } catch (_) {
      return false;
    }
  }

  function frameAt(action, elapsed) {
    const def = ACTIONS[action];
    const raw = Math.max(0, Math.floor(Math.max(0, elapsed) / def.frameMs));
    return def.loop ? raw % def.count : Math.min(def.count - 1, raw);
  }

  function drawZodiac(ctx, radius, nowMs, charging) {
    const action = charging && isReady('attack') ? 'attack' : 'idle';
    const frame = charging ? frameAt('attack', nowMs) : frameAt('idle', nowMs);
    return drawFrame(ctx, action, frame, radius);
  }

  function getTrack(enemy, nowMs) {
    let track = entities.get(enemy);
    if (!track) {
      track = { hitWasActive: false, hitStart: -Infinity,
        attackWasActive: false, attackStart: -Infinity, deathStart: -Infinity };
      entities.set(enemy, track);
    }
    const hitSignal = Number(enemy.hitFlashTimer) > 0;
    if (hitSignal && !track.hitWasActive) track.hitStart = nowMs;
    track.hitWasActive = hitSignal;
    const attackSignal = Number(enemy.attackTimer) > 0 && Number(enemy.attackTimer) < .48;
    if (attackSignal && !track.attackWasActive) track.attackStart = nowMs;
    track.attackWasActive = attackSignal;
    if (Number(enemy.hp) <= 0 && track.deathStart === -Infinity) track.deathStart = nowMs;
    return track;
  }

  function drawEntity(ctx, enemy, nowMs) {
    if (!enemy || enemy.type !== 'zodiac_leo' || !enemy.isBoss || !(Number(enemy.r) > 0)) return false;
    // Preload all states only when Leo appears; avoid waiting for hit/death assets.
    if (!cache.idle) Object.keys(ACTIONS).forEach(preload);
    const t = Number.isFinite(nowMs) ? nowMs : 0;
    const track = getTrack(enemy, t);
    if (Number(enemy.hp) > 0) {
      lastBoss = { entity: enemy, x: enemy.x, y: enemy.y, r: enemy.r,
        room: root.ArtemisLeoRoomKey || null, lastSeenAt: t };
    }
    let action = 'idle', started = t;
    if (track.deathStart !== -Infinity) { action = 'death'; started = track.deathStart; }
    else if (t - track.hitStart < ACTIONS.hit.count * ACTIONS.hit.frameMs) {
      action = 'hit'; started = track.hitStart;
    } else if (t - track.attackStart < ACTIONS.attack.count * ACTIONS.attack.frameMs) {
      action = 'attack'; started = track.attackStart;
    }
    // Partial download failures fallback to an available idle frame or native Canvas.
    if (!isReady(action)) { if (!isReady('idle')) return false; action = 'idle'; started = 0; }
    return drawFrame(ctx, action, frameAt(action, t - started), enemy.r);
  }

  // Draw a visual death animation if game already removed a defeated boss from enemies.
  // This only paints pixels in the same room; no HP, drops or gameplay state is changed.
  function drawDeathAfterRemoval(ctx, game, nowMs) {
    if (!lastBoss || !game || !Array.isArray(game.enemies)) return false;
    if (game.enemies.includes(lastBoss.entity)) return false;
    const roomKey = String(game.chapter?.id || '') + ':' + String(game.room || '');
    if (lastBoss.room && lastBoss.room !== roomKey) { lastBoss = null; return false; }
    if (!game.portalOpen || !isReady('death') || nowMs - lastBoss.lastSeenAt > 2200) return false;
    const elapsed = Math.max(0, nowMs - lastBoss.lastSeenAt);
    if (elapsed > 1100) { lastBoss = null; return false; }
    ctx.save();
    try {
      ctx.translate(lastBoss.x, lastBoss.y);
      return drawFrame(ctx, 'death', frameAt('death', elapsed), lastBoss.r);
    } finally { ctx.restore(); }
  }

  function rememberRoom(game) {
    root.ArtemisLeoRoomKey = String(game?.chapter?.id || '') + ':' + String(game?.room || '');
  }

  root.ArtemisLeoAnimation = Object.freeze({
    actions: ACTIONS, preload, isReady, drawFrame, drawEntity, drawZodiac,
    drawDeathAfterRemoval, rememberRoom
  });
})(typeof window !== 'undefined' ? window : globalThis);
