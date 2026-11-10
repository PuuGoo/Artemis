/* Fixed authored pressure: no save/account reads, no HP/ATK scaling.
 * Parent: prepareRoom after spawn; update once/frame instead of legacy non-boss
 * ranged branch; draw in world coordinates. Spawn callback receives source last.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2, states = new WeakMap(), rooms = new WeakMap();
  const safe = room => [5,15,25,35,45].includes(Number(room));
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const profiles = {};
  function profile(types, patterns, cooldown, speed, size) {
    for (const type of types.split(' ')) profiles[type] = Object.freeze({patterns:Object.freeze(patterns), cooldown, speed, size});
  }
  profile('slime bat', ['split','aimed'], 2.2, 210, 1.38);
  profile('goblin spore_runner rift_stalker', ['burst','split','fan'], 1.65, 265, 1.38);
  profile('skeleton_mage mire_shaman eclipse_oracle', ['fan','split','burst'], 1.95, 235, 1.32);
  profile('plant_turret hive_guardian obsidian_brute', ['radial','fan'], 2.3, 205, 1.28);
  profile('dragon_whelp sky_sentinel', ['fan','burst','split'], 1.85, 255, 1.32);
  profile('cloud_wisp star_wraith', ['radial','split'], 2.1, 225, 1.38);
  profile('nebula_herald frost_sentinel', ['fan','burst'], 1.95, 245, 1.32);
  Object.freeze(profiles);
  function plan(e,p,options={}) {
    if (!e || !p || e.isBoss || !(e.hp>0) || safe(options.room) ||
      ![e.x,e.y,e.atk,p.x,p.y].every(Number.isFinite)) return null;
    const profile=profiles[e.type] || profiles.goblin;
    const cycle=Math.max(0,Math.floor(Number(options.cycle)||0));
    const kind=profile.patterns[cycle%profile.patterns.length];
    const angle=Math.atan2(p.y-e.y,p.x-e.x), warning=.75;
    const shots=[];
    function shot(offset, delay=0) {
      shots.push({x:e.x,y:e.y,angle:angle+offset,speed:profile.speed,dmg:Math.max(0,e.atk),r:5,delay});
    }
    if (kind==='burst') { shot(0); shot(0,.14); shot(0,.28); }
    else if (kind==='fan') for (const o of [-.48,-.24,0,.24,.48]) shot(o);
    else if (kind==='split') for (const o of [-.42,-.2,.2,.42]) shot(o);
    else if (kind==='radial') {
      // Missing forward three spokes: wide guaranteed angular escape lane.
      for (let i=2;i<=8;i++) shot(i*TAU/10);
    } else shot(0);
    return {kind,warning,cooldown:profile.cooldown,shots};
  }
  function sizeMultiplier(type) { return (profiles[type]||profiles.goblin).size; }
  function initialDelay(index) { return .8 + (Math.max(0,Math.floor(Number(index)||0))%8)*.23; }
  function prepareRoom(game) {
    rooms.set(game,{room:game.room,gap:0});
    for (let i=0;i<(game.enemies||[]).length;i++) {
      const e=game.enemies[i];
      states.set(e,{cycle:0,wait:initialDelay(i),pending:null,elapsed:0,emitted:0});
    }
    // Safe rooms are spawn-gated by campaign roster; cancel any stale projectiles too.
    if (safe(game.room)) { game.enemies=[]; game.enemyBullets=[]; }
  }
  function update(game,dt,spawn) {
    if (!game || !game.player || game.paused || game.running===false || typeof spawn!=='function') return;
    let room=rooms.get(game);
    if (!room || room.room!==game.room) { prepareRoom(game); room=rooms.get(game); }
    if (safe(game.room)) return;
    // Do not catch up missed volleys after backgrounding or low-FPS stalls.
    dt=Number.isFinite(dt)?clamp(dt,0,.1):0;
    room.gap=Math.max(0,room.gap-dt);
    let active=(game.enemies||[]).filter(e=>e.hp>0 && states.get(e)?.pending).length;
    for (const e of game.enemies||[]) {
      if (e.isBoss || !(e.hp>0)) continue;
      let s=states.get(e);
      if (!s) { s={cycle:0,wait:initialDelay(active),pending:null,elapsed:0,emitted:0};states.set(e,s); }
      const localDt = dt * (Number.isFinite(e.slowTimer) && e.slowTimer > 0 ? .55 : 1);
      if (!s.pending) {
        s.wait-=localDt;
        if (s.wait>0 || active>=2 || room.gap>0 || (game.enemyBullets||[]).length>56) continue;
        // No off-camera surprises; wait until source is visible, including a margin.
        const view=root.ArtemisArenaViewport?.camera(game);
        if (view && (e.y<view.y+40 || e.y>view.y+view.height-40 || e.x<view.x+24 || e.x>view.x+view.width-24)) continue;
        const next=plan(e,game.player,{room:game.room,cycle:s.cycle});
        if (!next) continue;
        s.pending=next;s.elapsed=0;s.emitted=0; active++;room.gap=.32;
      } else {
        s.elapsed+=localDt;
        const next=s.pending;
        while (s.emitted<next.shots.length && s.elapsed>=next.warning+next.shots[s.emitted].delay) {
          const b=next.shots[s.emitted++];
          // Hard live cap includes boss bullets. Drop rather than queue a later surprise.
          if ((game.enemyBullets||[]).length<64) spawn(b.x,b.y,b.angle,b.speed,b.dmg,b.r,e);
        }
        if (s.emitted===next.shots.length) {
          s.pending=null;s.wait=next.cooldown;s.cycle++;active--;
        }
      }
    }
  }
  function draw(ctx,game) {
    if (!game || safe(game.room)) return;
    ctx.save();
    try {
      ctx.setLineDash([7,6]);ctx.lineWidth=2;ctx.strokeStyle='#ffcc75';
      for (const e of game.enemies||[]) {
        const s=states.get(e);
        if (!(e.hp>0) || !s?.pending || s.elapsed>=s.pending.warning) continue;
        ctx.globalAlpha=.65+.25*s.elapsed/s.pending.warning;
        for (const b of s.pending.shots.filter(b=>b.delay===0)) {
          const dx=Math.cos(b.angle),dy=Math.sin(b.angle),start=(Number(e.r)||18)+4;
          ctx.beginPath();ctx.moveTo(b.x+dx*start,b.y+dy*start);
          ctx.lineTo(b.x+dx*b.speed*.85,b.y+dy*b.speed*.85);ctx.stroke();
        }
        const origin=s.pending.shots[0];
        ctx.beginPath();ctx.arc(origin.x,origin.y,(Number(e.r)||18)+7,0,TAU);ctx.stroke();
      }
    } finally { ctx.restore(); }
  }
  root.ArtemisEnemyPressure={profiles,plan,sizeMultiplier,initialDelay,prepareRoom,update,draw,isSafeRoom:safe};
})(globalThis);
