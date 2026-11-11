/* Artemis Leo guardians – cosmetic, combat-synchronized Canvas VFX.
 * Draws only the four real chapter-one sprite bosses at rooms 10/20/30/40.
 * All warning lanes use the authoritative BossAttackPatterns.plan().shots.
 * Never changes entities, projectiles, collision, AI, damage or saved state.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const WARNING = .75;
  const TYPES = Object.freeze({ 10:'golem', 20:'queen', 30:'demon_king', 40:'elder_dragon' });
  const PALETTES = Object.freeze({
    10: Object.freeze({ main:'#fa6a1c', light:'#ffdb7b', edge:'#b72f0e', tint:'rgba(255,92,22,0.65)' }),
    20: Object.freeze({ main:'#2cc8ff', light:'#d2faff', edge:'#1468d8', tint:'rgba(56,189,248,0.65)' }),
    30: Object.freeze({ main:'#a2e24c', light:'#ffdd87', edge:'#517a26', tint:'rgba(157,224,74,0.65)' }),
    40: Object.freeze({ main:'#bd68ff', light:'#f4c5ff', edge:'#7029ce', tint:'rgba(186,92,255,0.65)' })
  });
  const colorOf = room => PALETTES[Number(room)] || null;
  const eligible = enemy => !!(enemy && enemy.isBoss === true
    && Number(enemy.campaignChapter) === 1
    && TYPES[Number(enemy.campaignRoom)] === enemy.type
    && Number(enemy.r) > 0);
  const reducedMotion = () => !!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const canDraw = c => !!(c && typeof c.save === 'function'
    && typeof c.restore === 'function' && typeof c.beginPath === 'function'
    && typeof c.arc === 'function' && typeof c.stroke === 'function');

  function line(c, x1, y1, x2, y2, color, width, opacity) {
    c.globalAlpha = opacity;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x1,y1);
    c.lineTo(x2,y2);
    c.stroke();
  }
  function ring(c, x, y, radius, color, width, opacity, start = 0, end = TAU) {
    c.globalAlpha = opacity;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.arc(x,y,radius,start,end);
    c.stroke();
  }
  function diamond(c, x, y, size, color, opacity) {
    c.globalAlpha = opacity;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x,y-size);
    c.lineTo(x+size*.65,y);
    c.lineTo(x,y+size);
    c.lineTo(x-size*.65,y);
    c.closePath();
    c.fill();
  }
  function drawAura(c, enemy, nowMs, action, frame, layer) {
    if (!eligible(enemy) || !canDraw(c) || typeof c.scale !== 'function') return false;
    const palette = colorOf(enemy.campaignRoom);
    const attacking = action === 'attack' && Number(enemy.hp) > 0;
    const progress = attacking ? Math.min(1,Math.max(0,
      (WARNING - Math.min(WARNING,Number(enemy.attackTimer)||0)) / WARNING)) : 0;
    const flash = attacking ? .48 + .45 * progress : action === 'hit' ? .24 : action === 'idle' ? .12 : 0;
    if (!flash || action === 'death') return false;
    const t = reducedMotion() ? 0 : (Number.isFinite(nowMs) ? nowMs : 0) * .001;
    const room = Number(enemy.campaignRoom);
    c.save();
    try {
      c.scale(enemy.r / 48,enemy.r / 48);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      if (layer === 'behind') {
        c.save();
        c.translate(0,28);
        c.scale(1,.34);
        ring(c,0,0,53,palette.edge,10,.2 + flash*.2);
        ring(c,0,0,50,palette.main,3,flash*.9);
        ring(c,0,0,42,palette.light,1,flash*.6);
        if (attacking) for (let i=0;i<8;i++) {
          const a=i*TAU/8+t*.35, r=45 + 4*Math.sin(t*3+i);
          diamond(c,Math.cos(a)*r,Math.sin(a)*r,3,palette.light,.24+progress*.55);
        }
        c.restore();
        if (attacking) {
          // The charge aura is decorative and stays close to the real body.
          c.shadowBlur = 13;
          c.shadowColor = palette.main;
          for (let i=0;i<5;i++) {
            const x=Math.sin(i*2.4+t*.9)*44;
            const y=-12-(i*17 + (reducedMotion()?0:t*20))%80;
            diamond(c,x,y,2.5+(i%3),palette.light,.25 + flash*.38);
          }
        }
      } else if (layer === 'front' && attacking) {
        // Different elements share the real Attack sprite timing but not their shapes.
        const strength=.26+.64*progress;
        c.shadowBlur=14; c.shadowColor=palette.main;
        if (room === 10) {
          // Ares: red-gold axe crescent, fiery motes and a heavy release flash.
          ring(c,4,-11,65,palette.edge,11,strength*.58,-1.65,.65);
          ring(c,4,-11,65,palette.light,3,strength,-1.65,.65);
          for(let i=0;i<4;i++) diamond(c,44+i*6,-57+i*19,3+i%2*2,palette.main,strength);
        } else if (room === 20) {
          // Boreas: two separate frost blades, not a circular explosion.
          for (const sign of [-1,1]) {
            ring(c,sign*24,-17,48,palette.edge,7,strength*.45,
              sign<0?2.7:-.7,sign<0?4.7:1.3);
            ring(c,sign*24,-17,48,palette.light,2.8,strength,
              sign<0?2.7:-.7,sign<0?4.7:1.3);
            diamond(c,sign*57,-57,7,palette.light,strength);
          }
        } else if (room === 30) {
          // Terra: short earthen cracks and floating emerald chips at the feet.
          for (let i=0;i<5;i++) {
            const x=(i-2)*18;
            line(c,0,20,x,38 + (i%2)*9,palette.edge,6,strength*.42);
            line(c,0,20,x,38 + (i%2)*9,palette.light,1.9,strength);
            diamond(c,x,-34-(i%2)*19,4+(i%3),palette.main,strength);
          }
        } else if (room === 40) {
          // Nyx: paired luminous seals and two intertwined shadow wisps.
          for (const sign of [-1,1]) {
            ring(c,sign*33,-27,19,palette.main,3,strength);
            diamond(c,sign*33,-27,7,palette.light,strength);
            ring(c,sign*15,-26,51,palette.light,2,strength*.7,
              sign<0?1.5:-1.6,sign<0?3.8:.7);
          }
        }
        if (frame >= 5) {
          ring(c,0,-13,56 + 9*progress,palette.light,3,.55*strength,
            -.8,.62);
        }
      }
    } finally { c.restore(); }
    return true;
  }

  function drawWarning(c, enemy, attackPlan, charge, nowMs, quiet) {
    if (!eligible(enemy) || !canDraw(c) || !Array.isArray(attackPlan?.shots)
      || !attackPlan.shots.length) return false;
    const palette = colorOf(enemy.campaignRoom);
    const room = Number(enemy.campaignRoom);
    const ratio = Math.max(0,Math.min(1,Number(charge)||0));
    const t = quiet || reducedMotion() ? 0 : (Number(nowMs)||0)*.004;
    c.save();
    try {
      c.lineCap='round';
      // Highlight the exact actual projectile lanes. No imaginary AoE hit zone.
      for (let i=0;i<attackPlan.shots.length;i++) {
        const shot=attackPlan.shots[i];
        if (![shot.x,shot.y,shot.angle,shot.speed].every(Number.isFinite)) continue;
        const dx=Math.cos(shot.angle),dy=Math.sin(shot.angle);
        const start=Math.max(12,Number(enemy.r)||12);
        const length=Math.min(310,shot.speed*.95);
        const x1=shot.x+dx*start,y1=shot.y+dy*start;
        const x2=shot.x+dx*length,y2=shot.y+dy*length;
        line(c,x1,y1,x2,y2,'#100b24',8+ratio*2,.55);
        line(c,x1,y1,x2,y2,palette.edge,5+ratio*2,.32+ratio*.28);
        line(c,x1,y1,x2,y2,palette.light,1.5+ratio,.5+ratio*.42);
        // Small directional markers repeat along each REAL lane, with a safe gap.
        const distance=start+Math.max(0,length-start)*(.50 + .04*Math.sin(t+i));
        const mx=shot.x+dx*distance, my=shot.y+dy*distance;
        c.save(); c.translate(mx,my); c.rotate(shot.angle);
        diamond(c,0,0,room===30?5:4,palette.light,.52+ratio*.45);
        c.restore();
      }
      const pulse = quiet || reducedMotion()?0:Math.sin(t*2);
      c.save(); c.translate(enemy.x,enemy.y); c.scale(1,.48);
      ring(c,0,0,(Number(enemy.r)||38)+14 + pulse*2,palette.main,2.8,.65+ratio*.24);
      ring(c,0,0,(Number(enemy.r)||38)+22,palette.light,1,.24+ratio*.2,
        -Math.PI/2,-Math.PI/2+TAU*ratio);
      if (room===40) for (const side of [-1,1]) {
        ring(c,side*18,-8,11,palette.light,1.5,.2+ratio*.38);
      }
      c.restore();
    } finally { c.restore(); }
    return true;
  }

  // Boss room contains one boss. Use the active entity to style ONLY its actual bullets.
  function activeRoomBoss(game) {
    if (!game || Number(game.chapter?.id)!==1
      || !TYPES[Number(game.room)] || game.portalOpen
      || (game.mode && game.mode!=='campaign')) return null;
    const enemies=Array.isArray(game.enemies)?game.enemies:[];
    return enemies.find(e=>eligible(e)&&Number(e.hp)>0&&Number(e.campaignRoom)===Number(game.room))||null;
  }
  function drawBullet(c, bullet, nowMs, game) {
    const boss=activeRoomBoss(game);
    if (!boss || !canDraw(c) || typeof c.translate!=='function'
      || typeof c.rotate!=='function') return false;
    const palette=colorOf(boss.campaignRoom),room=Number(boss.campaignRoom);
    if (![bullet?.x,bullet?.y,bullet?.r].every(Number.isFinite)) return false;
    const r=Math.min(13,Math.max(4,Number(bullet.r)));
    const trail=Array.isArray(bullet.trail)?bullet.trail:[];
    const tail=trail.length>1?trail[trail.length-2]:null;
    let angle=Number.isFinite(bullet.vx)&&Number.isFinite(bullet.vy)
      ?Math.atan2(bullet.vy,bullet.vx)
      :tail&&Number.isFinite(tail.x)&&Number.isFinite(tail.y)
        ?Math.atan2(bullet.y-tail.y,bullet.x-tail.x)
        :Math.atan2(bullet.y-boss.y,bullet.x-boss.x);
    if(!Number.isFinite(angle))angle=0;
    const motion=reducedMotion()?0:(Number(nowMs)||0)*.006;
    c.save();
    try {
      if (trail.length>1) {
        const points=trail.slice(-5);
        for(let i=1;i<points.length;i++){
          const from=points[i-1],to=points[i];
          if (![from.x,from.y,to.x,to.y].every(Number.isFinite)) continue;
          line(c,from.x,from.y,to.x,to.y,palette.main,1+i*.75,.11 + .1*i);
        }
      }
      c.translate(bullet.x,bullet.y);
      c.rotate(angle);
      c.lineJoin='round';c.lineCap='round';
      c.shadowColor=palette.main;c.shadowBlur=game.lowGfx?3:11;
      // Glowing silhouettes match the skill name, projectile radius stays unchanged.
      c.globalAlpha=.9;c.fillStyle=palette.edge;
      c.beginPath();
      if(room===10){
        c.moveTo(r*1.65,0);c.lineTo(-r*.85,-r*.75);c.lineTo(-r*.42,0);
        c.lineTo(-r*1.55,r*.65);c.lineTo(-r*.2,r*.4);
      } else if(room===20){
        c.moveTo(r*1.6,0);c.lineTo(-r*.6,-r*.85);
        c.lineTo(-r*.18,0);c.lineTo(-r*.6,r*.85);
      } else if(room===30){
        c.moveTo(r*1.3,0);c.lineTo(r*.25,-r*.95);
        c.lineTo(-r*1.05,-r*.5);c.lineTo(-r*.85,r*.7);c.lineTo(r*.35,r*.6);
      } else {
        c.moveTo(r*1.65,0);c.lineTo(0,-r*.85);
        c.lineTo(-r*.95,-r*.45);c.lineTo(-r*.7,r*.7);c.lineTo(0,r*.5);
      }
      c.closePath();c.fill();c.strokeStyle=palette.light;c.lineWidth=1.5;c.stroke();
      ring(c,0,0,r*.54,palette.light,2,.9);
      c.globalAlpha=1;c.fillStyle=palette.light;
      c.beginPath();c.arc(0,0,Math.max(2,r*.38),0,TAU);c.fill();
      if(!game.lowGfx){
        if(room===20){
          for(const offset of [-1,1]) diamond(c,-r*.9,offset*r*.75,2.5,palette.light,.65);
        } else if(room===40){
          ring(c,0,0,r*1.3,palette.main,1,.48,
            motion,motion+Math.PI*1.6);
        } else if(room===30){
          diamond(c,-r*1.05,r*.7,3.5,palette.light,.65);
        } else {
          diamond(c,-r*1.25,-r*.7,2.7,palette.light,.7);
        }
      }
    } finally { c.restore(); }
    return true;
  }
  root.ArtemisLeoSubBossVFX=Object.freeze({
    eligible,colorOf,activeRoomBoss,drawAura,drawWarning,drawBullet
  });
})(typeof window!=='undefined'?window:globalThis);
