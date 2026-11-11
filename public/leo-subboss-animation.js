/* Leo chapter 1: real transparent sprite-sheet portraits for the four generals.
 * 6 columns x 4 rows of 192px RGBA cells, baked from the user-approved artwork.
 * Visual-only: no combat AI, HP, ATK, hitbox or save state is changed.
 */
(function (root) {
  'use strict';
  const CELL = 192;
  const WARNING = .75;
  // The actual attack is fired when attackTimer reaches zero. Hold the impact
  // frame briefly after the combat timer resets so the release stays visible.
  const AFTER_FIRE_MS = 160;
  const ACTIONS = Object.freeze({
    idle: Object.freeze({ row:0, count:6, frameMs:170, loop:true }),
    attack: Object.freeze({ row:1, count:6, frameMs:110, loop:false }),
    hit: Object.freeze({ row:2, count:4, frameMs:95, loop:false }),
    death: Object.freeze({ row:3, count:6, frameMs:145, loop:false })
  });
  const BOSSES = Object.freeze({
    10: Object.freeze({ room:10, type:'golem', name:'Ares – Tướng Quân Hỏa Ngục',
      color:'#fb923c', path:'/assets/leo-guardians/ares.png' }),
    20: Object.freeze({ room:20, type:'queen', name:'Boreas – Tướng Quân Phong Băng',
      color:'#38bdf8', path:'/assets/leo-guardians/boreas.png' }),
    30: Object.freeze({ room:30, type:'demon_king', name:'Terra – Tướng Quân Đại Địa',
      color:'#a3e635', path:'/assets/leo-guardians/terra.png' }),
    40: Object.freeze({ room:40, type:'elder_dragon', name:'Nyx – Tướng Quân Hư Ảnh',
      color:'#c084fc', path:'/assets/leo-guardians/nyx.png' })
  });
  const cache = new Map();
  const tracks = new WeakMap();
  let lastSeen = null;

  function eligible(e) {
    return !!(e && e.isBoss === true && Number(e.campaignChapter) === 1
      && BOSSES[e.campaignRoom] && BOSSES[e.campaignRoom].type === e.type
      && Number(e.r) > 0);
  }
  function preload(room) {
    const def = BOSSES[Number(room)];
    if (!def || typeof root.Image !== 'function') return null;
    let entry = cache.get(def.room);
    if (entry) return entry;
    const image = new root.Image();
    entry = { image, ready:false, failed:false };
    cache.set(def.room,entry);
    image.onload = function () {
      entry.ready = image.naturalWidth === CELL * 6 && image.naturalHeight === CELL * 4;
      entry.failed = !entry.ready;
    };
    image.onerror = function () { entry.failed = true; };
    image.src = def.path;
    if (image.complete && image.naturalWidth === CELL * 6 && image.naturalHeight === CELL * 4) {
      entry.ready = true;
    }
    return entry;
  }
  function isReady(room) {
    const entry = preload(room);
    return !!(entry && !entry.failed && entry.image.complete
      && entry.image.naturalWidth === CELL * 6 && entry.image.naturalHeight === CELL * 4);
  }
  function frameAt(action, elapsedMs) {
    const def = ACTIONS[action];
    if (!def) return 0;
    const step = Math.max(0,Math.floor(Math.max(0,elapsedMs) / def.frameMs));
    return def.loop ? step % def.count : Math.min(def.count - 1,step);
  }
  // Drive attack frames from the authoritative combat countdown, not render
  // elapsed time: all 6 frames span the complete 750ms warning and the impact
  // frame lands at the same moment the actual projectile volley is released.
  function attackFrameForTimer(remainingSeconds) {
    const remaining = Number(remainingSeconds);
    if (!Number.isFinite(remaining)) return 0;
    const progress = (WARNING - Math.max(0,Math.min(WARNING,remaining))) / WARNING;
    return Math.min(ACTIONS.attack.count - 1,
      Math.max(0,Math.floor(progress * ACTIONS.attack.count)));
  }
  function drawFrame(ctx, room, action, index, radius) {
    const def = ACTIONS[action];
    if (!ctx || typeof ctx.drawImage !== 'function' || !def || !(radius > 0) || !isReady(room)) return false;
    const frame = Math.min(def.count - 1,Math.max(0,Math.floor(index)));
    const display = radius * 4.05;
    try {
      // Shared feet anchor across all frames; never scale the combat collider.
      ctx.drawImage(cache.get(Number(room)).image,
        frame * CELL,def.row * CELL,CELL,CELL,
        -display / 2, radius - display * 173 / CELL, display,display);
      return true;
    } catch (_) { return false; }
  }
  function clock(enemy, nowMs) {
    let track = tracks.get(enemy);
    if (!track) {
      track = { hitValue:0,hitStart:-Infinity,attacking:false,
        previousAttackTimer:null,followThroughUntil:-Infinity,deathStart:-Infinity };
      tracks.set(enemy,track);
    }
    const hit = Math.max(0,Number(enemy.hitFlashTimer) || 0);
    if (hit > 0 && (track.hitValue <= 0 || hit > track.hitValue + .045)) track.hitStart = nowMs;
    track.hitValue = hit;
    const timer = Number(enemy.attackTimer);
    const attacking = timer > 0 && timer <= WARNING;
    // BossAttackPatterns.fire() immediately resets the countdown to its
    // cooldown. Detect that transition without mutating combat state.
    const last = track.previousAttackTimer;
    if (!attacking && Number.isFinite(last) && last > 0 && last <= WARNING
      && timer > WARNING && Number(enemy.hp) > 0) {
      track.followThroughUntil = nowMs + AFTER_FIRE_MS;
    }
    if (attacking) track.followThroughUntil = -Infinity;
    track.attacking = attacking;
    track.previousAttackTimer = timer;
    if (Number(enemy.hp) <= 0 && track.deathStart === -Infinity) track.deathStart = nowMs;
    return track;
  }
  function drawEntity(ctx, enemy, nowMs) {
    if (!eligible(enemy)) return false;
    const now = Number.isFinite(nowMs) ? nowMs : 0;
    const t = clock(enemy,now);
    let action='idle',frame=frameAt('idle',now);
    if (t.deathStart !== -Infinity) {
      action='death'; frame=frameAt('death',now-t.deathStart);
    } else if (t.attacking) {
      // Prioritize the entire attack telegraph over Hit; hitFlashTimer still
      // produces the usual glow, but cannot hide intermediate Attack frames.
      action='attack'; frame=attackFrameForTimer(enemy.attackTimer);
    } else if (now < t.followThroughUntil) {
      action='attack'; frame=ACTIONS.attack.count-1;
    } else if (now - t.hitStart < ACTIONS.hit.count * ACTIONS.hit.frameMs) {
      action='hit'; frame=frameAt('hit',now-t.hitStart);
    }
    const room=Number(enemy.campaignRoom);
    const drawn = drawFrame(ctx,room,action,frame,enemy.r)
      || (action!=='idle' && drawFrame(ctx,room,'idle',frameAt('idle',now),enemy.r));
    if (drawn && Number(enemy.hp) > 0)
      lastSeen={ entity:enemy, chapter:1, room, x:enemy.x, y:enemy.y, r:enemy.r, seenAt:now };
    return drawn;
  }
  function drawDeathAfterRemoval(ctx, game, nowMs) {
    if (!lastSeen || !game || Number(game.chapter?.id) !== 1) return false;
    if (Number(game.room) !== lastSeen.room) { lastSeen=null;return false; }
    if (Array.isArray(game.enemies) && game.enemies.includes(lastSeen.entity)) return false;
    if (!game.portalOpen || !Number.isFinite(nowMs)) return false;
    const elapsed=Math.max(0,nowMs-lastSeen.seenAt);
    if (elapsed >= ACTIONS.death.count * ACTIONS.death.frameMs) { lastSeen=null;return false; }
    if (!isReady(lastSeen.room)) return false;
    ctx.save();
    try {
      ctx.translate(lastSeen.x,lastSeen.y);
      return drawFrame(ctx,lastSeen.room,'death',frameAt('death',elapsed),lastSeen.r);
    } finally { ctx.restore(); }
  }
  function buildAtlas(room, action) {
    const def = ACTIONS[action];
    if (!def || !isReady(room) || !root.document?.createElement) return null;
    const canvas = root.document.createElement('canvas');
    canvas.width=def.count*CELL; canvas.height=CELL;
    const ctx=canvas.getContext('2d');
    if (!ctx) return null;
    try {
      ctx.drawImage(cache.get(Number(room)).image,
        0,def.row*CELL,def.count*CELL,CELL,0,0,def.count*CELL,CELL);
      return canvas;
    } catch (_) { return null; }
  }
  function pngDataUrl(room,action) {
    const canvas=buildAtlas(room,action);
    return canvas && typeof canvas.toDataURL === 'function' ? canvas.toDataURL('image/png') : null;
  }
  function downloadPng(room,action) {
    const url=pngDataUrl(room,action);
    if (!url || !root.document?.createElement) return false;
    const link=root.document.createElement('a');
    link.href=url;
    link.download='leo-'+BOSSES[Number(room)].path.split('/').pop().replace('.png','')+'-'+action+'.png';
    link.click();
    return true;
  }
  root.ArtemisLeoSubBossSprites=Object.freeze({
    CELL,ACTIONS,BOSSES,WARNING,AFTER_FIRE_MS,eligible,preload,isReady,
    frameAt,attackFrameForTimer,buildAtlas,drawFrame,
    drawEntity,drawDeathAfterRemoval,pngDataUrl,downloadPng
  });
})(typeof window !== 'undefined' ? window : globalThis);
