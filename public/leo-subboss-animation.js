/* Chapter 1 Leo lieutenants — transparent runtime sprite atlases.
 * Sprite cells are generated once from the game's approved chibi Canvas art;
 * game logic, hitboxes, projectiles, damage and save data stay unchanged.
 */
(function (root) {
  'use strict';
  const CELL = 192;
  const WARNING = .75;
  const BOSSES = Object.freeze({
    10: Object.freeze({ room:10, type:'golem', name:'Kim Giáp Sư Vệ', color:'#fb923c', tint:'none' }),
    20: Object.freeze({ room:20, type:'queen', name:'Nhật Ấn Tế Sư', color:'#7dd3fc', tint:'hue-rotate(105deg)' }),
    30: Object.freeze({ room:30, type:'demon_king', name:'Xích Diệm Đao Vương', color:'#fb7185', tint:'none' }),
    40: Object.freeze({ room:40, type:'elder_dragon', name:'Thiên Dực Nhật Long', color:'#c084fc', tint:'hue-rotate(105deg)' })
  });
  const ACTIONS = Object.freeze({
    idle:   Object.freeze({ count:6, frameMs:170, loop:true }),
    attack: Object.freeze({ count:8, frameMs:88, loop:false }),
    hit:    Object.freeze({ count:4, frameMs:95, loop:false }),
    death:  Object.freeze({ count:6, frameMs:145, loop:false })
  });
  const atlases = new Map();
  const tracks = new WeakMap();
  let lastSeen = null;
  function eligible(e) {
    return !!(e && e.isBoss === true && Number(e.campaignChapter) === 1
      && BOSSES[e.campaignRoom] && BOSSES[e.campaignRoom].type === e.type && Number(e.r) > 0);
  }
  function makeCanvas(width,height) {
    let canvas = null;
    if (typeof root.OffscreenCanvas === 'function') {
      try { canvas = new root.OffscreenCanvas(width,height); } catch (_) {}
    }
    if (!canvas && root.document && typeof root.document.createElement === 'function') {
      canvas = root.document.createElement('canvas');
      canvas.width = width; canvas.height = height;
    }
    return canvas;
  }
  function drawEffect(c, cfg, action, frame) {
    const color = cfg.color;
    if (action === 'attack' && frame >= 2 && frame <= 6) {
      const progress = (frame - 2) / 4;
      c.save();
      c.globalAlpha = .92 - progress * .42;
      c.strokeStyle = color;
      c.shadowColor = color;
      c.shadowBlur = 10;
      c.lineCap = 'round';
      c.lineWidth = 8 - progress * 3;
      c.beginPath();
      c.arc(8, -11, 54 + progress * 13, -.98 + progress * .23, .78 + progress * .3);
      c.stroke();
      c.strokeStyle = '#fff5c2'; c.shadowBlur = 0; c.lineWidth = 2.5;
      c.beginPath();
      c.arc(8, -11, 54 + progress * 13, -.85 + progress * .23, .57 + progress * .3);
      c.stroke();
      c.restore();
    } else if (action === 'hit' && frame < 3) {
      c.save(); c.globalAlpha = .8 - frame * .2; c.strokeStyle = '#fff8bd';
      c.lineWidth = 3; c.beginPath(); c.arc(0,-14,61 + frame * 5, -.55, .1); c.stroke();
      c.restore();
    } else if (action === 'death' && frame === 5) {
      c.save(); c.strokeStyle = color; c.globalAlpha = .42; c.lineWidth = 3;
      c.beginPath(); c.ellipse(0,46,38,11,0,0,Math.PI*2); c.stroke(); c.restore();
    }
  }
  function paintCell(c, cfg, action, frame, painter) {
    const count = ACTIONS[action].count;
    const progress = count <= 1 ? 0 : frame / (count - 1);
    const wave = Math.sin(2 * Math.PI * frame / count);
    const model = {
      isBoss:true, campaignChapter:1, campaignRoom:cfg.room, type:cfg.type, r:48,
      hp:100, maxHp:100, color:cfg.color,
      attackTimer:action === 'attack' ? .32 : 1.25
    };
    c.save();
    try {
      c.translate(CELL / 2, 102);
      if (action === 'idle') {
        c.translate(0, wave * 2.5);
        c.rotate(wave * .018);
      } else if (action === 'attack') {
        c.translate(frame < 3 ? -frame * 2 : 7 + (frame - 3) * .9, 0);
        c.rotate(frame < 3 ? -.04 * frame : .09 * (1 - progress));
      } else if (action === 'hit') {
        c.translate((frame % 2 ? 1 : -1) * (5 - frame), frame);
      } else if (action === 'death') {
        c.translate(0, progress * 32);
        c.rotate(-progress * .66);
        c.scale(1 + progress * .14, 1 - progress * .58);
        c.globalAlpha = 1 - Math.pow(progress, 2) * .74;
      }
      // All atlas cells are prepainted from the same vetted Canvas character art.
      // Visual tweaks are isolated to the atlas, not live entity state.
      if (cfg.tint !== 'none' && 'filter' in c) c.filter = cfg.tint;
      if (action === 'hit' && frame < 2 && 'filter' in c) c.filter = 'brightness(1.75)';
      painter(c, model, 500 + frame * 97);
      if ('filter' in c) c.filter = 'none';
      drawEffect(c,cfg,action,frame);
    } finally { c.restore(); }
  }
  function buildAtlas(room,action,painter) {
    const cfg = BOSSES[room], def = ACTIONS[action];
    if (!cfg || !def || typeof painter !== 'function') return null;
    const key = room + ':' + action;
    if (atlases.has(key)) return atlases.get(key);
    const canvas = makeCanvas(CELL * def.count, CELL);
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    const c = canvas.getContext('2d');
    if (!c || typeof c.drawImage !== 'function') return null;
    try {
      c.clearRect(0,0,canvas.width,canvas.height);
      for (let i=0; i<def.count; i++) {
        c.save();
        try { c.translate(i * CELL,0); paintCell(c,cfg,action,i,painter); }
        finally { c.restore(); }
      }
      atlases.set(key,canvas);
      return canvas;
    } catch (_) {
      // In constrained browsers fall back to the existing native Canvas drawing.
      return null;
    }
  }
  function frameAt(action,elapsedMs) {
    const d = ACTIONS[action];
    if (!d) return 0;
    const frame = Math.max(0,Math.floor(Math.max(0,elapsedMs) / d.frameMs));
    return d.loop ? frame % d.count : Math.min(d.count - 1,frame);
  }
  function drawFrame(c,room,action,frame,r,painter) {
    const atlas = buildAtlas(room,action,painter);
    if (!atlas || !c || typeof c.drawImage !== 'function' || !(r > 0)) return false;
    const d = ACTIONS[action];
    const idx = Math.min(d.count - 1,Math.max(0,Math.floor(frame)));
    const display = r * 4.15;
    // Painter's fixed feet are at y=150 in each 192px frame.
    try {
      c.drawImage(atlas,idx*CELL,0,CELL,CELL,-display/2,r-display*150/CELL,display,display);
      return true;
    } catch (_) { return false; }
  }
  function clock(e,now) {
    let t = tracks.get(e);
    if (!t) {
      t={ lastHit:0,wasAttack:false,hitStart:-Infinity,attackStart:-Infinity,deathStart:-Infinity };
      tracks.set(e,t);
    }
    const hit = Math.max(0, Number(e.hitFlashTimer) || 0);
    if (hit > 0 && (t.lastHit <= 0 || hit > t.lastHit + .045)) t.hitStart=now;
    t.lastHit=hit;
    const attack = Number(e.attackTimer) > 0 && Number(e.attackTimer) <= WARNING;
    if (attack && !t.wasAttack) t.attackStart=now;
    t.wasAttack=attack;
    if (Number(e.hp) <= 0 && t.deathStart === -Infinity) t.deathStart=now;
    return t;
  }
  function drawEntity(c,e,now,painter) {
    if (!eligible(e)) return false;
    const ms = Number.isFinite(now) ? now : 0;
    const track = clock(e,ms);
    let action='idle',started=0;
    if (track.deathStart !== -Infinity) { action='death';started=track.deathStart; }
    else if (ms - track.hitStart < ACTIONS.hit.count * ACTIONS.hit.frameMs) {
      action='hit';started=track.hitStart;
    } else if (ms - track.attackStart < ACTIONS.attack.count * ACTIONS.attack.frameMs) {
      action='attack';started=track.attackStart;
    }
    const room=Number(e.campaignRoom);
    let ok=drawFrame(c,room,action,frameAt(action,ms-started),e.r,painter);
    if (!ok && action !== 'idle') ok=drawFrame(c,room,'idle',frameAt('idle',ms),e.r,painter);
    if (ok && Number(e.hp) > 0) lastSeen={
      entity:e,room:room,x:e.x,y:e.y,r:e.r,lastAt:ms,painter:painter
    };
    return ok;
  }
  function drawDeathAfterRemoval(c,game,ms,painter) {
    if (!game || Number(game.chapter && game.chapter.id) !== 1 || !lastSeen) return false;
    if (Number(game.room) !== lastSeen.room) { lastSeen=null;return false; }
    if (Array.isArray(game.enemies) && game.enemies.includes(lastSeen.entity)) return false;
    if (!game.portalOpen || !Number.isFinite(ms) || ms - lastSeen.lastAt > 1200) {
      if (ms-lastSeen.lastAt > 1200) lastSeen=null;
      return false;
    }
    const elapsed = Math.max(0,ms-lastSeen.lastAt);
    if (elapsed >= ACTIONS.death.count * ACTIONS.death.frameMs) { lastSeen=null;return false; }
    c.save();
    try {
      c.translate(lastSeen.x,lastSeen.y);
      return drawFrame(c,lastSeen.room,'death',frameAt('death',elapsed),lastSeen.r,painter||lastSeen.painter);
    } finally { c.restore(); }
  }
  function pngDataUrl(room,action,painter) {
    const atlas=buildAtlas(Number(room),action,painter);
    if (!atlas) return null;
    if (typeof atlas.toDataURL === 'function') return atlas.toDataURL('image/png');
    return null;
  }
  function downloadPng(room,action,painter) {
    const url=pngDataUrl(room,action,painter);
    if (!url || !root.document || typeof root.document.createElement !== 'function') return false;
    const a=root.document.createElement('a');
    a.href=url;a.download='leo-guard-'+room+'-'+action+'.png';
    a.click();
    return true;
  }
  root.ArtemisLeoSubBossSprites=Object.freeze({
    CELL,ACTIONS,BOSSES,eligible,frameAt,buildAtlas,drawFrame,drawEntity,
    drawDeathAfterRemoval,pngDataUrl,downloadPng
  });
})(typeof window !== 'undefined' ? window : globalThis);
