/* Lớp vẽ thuần: không sinh entity, không đổi va chạm/sát thương/timer/save. */
(function (root) {
  'use strict';
  const colors = { fire:'#fb923c', ice:'#7dd3fc', poison:'#a3e635', bolt:'#facc15', vampire:'#fb7185', neutral:'#c4b5fd', beam:'#67e8f9' };
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches:false };
  const quiet = game => !!game.lowGfx || motion.matches;
  function glyph(c, kind, r, time, simple) {
    c.fillStyle = colors[kind] || colors.neutral; c.strokeStyle = '#f8fafc'; c.lineWidth = 1.2;
    c.beginPath();
    if (kind === 'ice') {
      for (let i=0;i<6;i++) { const a=i*Math.PI/3; c.moveTo(0,0); c.lineTo(Math.cos(a)*r,Math.sin(a)*r); }
      c.stroke();
    } else if (kind === 'bolt') {
      c.moveTo(1,-r); c.lineTo(-r*.65,1); c.lineTo(0,1); c.lineTo(-1,r); c.lineTo(r*.65,-1); c.lineTo(1,-1); c.closePath(); c.fill(); c.stroke();
    } else if (kind === 'fire') {
      c.moveTo(r,0); c.quadraticCurveTo(-r,-r*1.5,-r*1.5,0); c.quadraticCurveTo(-r,r*1.4,r,0); c.fill(); c.stroke();
    } else if (kind === 'poison') {
      c.arc(0,0,r*.7,0,Math.PI*2); c.fill();
      if (!simple) { c.beginPath(); c.arc(-r*.7,-r*.65,r*.28,0,Math.PI*2); c.arc(r*.8,-r*.3,r*.2,0,Math.PI*2); c.fill(); }
    } else {
      const n=kind==='vampire'?4:6;
      for(let i=0;i<n;i++){const a=i*Math.PI*2/n+time*.001; const x=Math.cos(a)*r,y=Math.sin(a)*r; if(i)c.lineTo(x,y);else c.moveTo(x,y);}
      c.closePath(); c.fill(); c.stroke();
    }
  }
  function element(skills) { return ['fire','ice','venom','lightning'].filter(k=>skills[k+'_arrow']>0).map(k=>({venom:'poison',lightning:'bolt'}[k]||k)); }
  function projectile(c,b,now,game) {
    if(!Number.isFinite(b.x+b.y+b.vx+b.vy)) return false;
    const skills=game.player?.skills || {};
    const elements = b.isSword && !skills.magic_strike ? [] : element(skills);
    if(!b.isSword && !b.spriteKind && !b.isLightwing && !elements.length && !skills.charged_arrow) return false;
    const simple=quiet(game), t=simple?0:now;
    c.save(); c.translate(b.x,b.y);
    if(!simple) {
      const trail=b.trail || [];
      for(let i=Math.max(0,trail.length-6);i<trail.length;i++) {
        const pt=trail[i]; c.globalAlpha=.12+(i/Math.max(1,trail.length))*.2;
        c.fillStyle=colors[elements[0]] || '#bae6fd'; c.beginPath(); c.arc(pt.x-b.x,pt.y-b.y,2,0,Math.PI*2); c.fill();
      }
    }
    c.globalAlpha=1;
    c.rotate(Math.atan2(b.vy,b.vx));
    if(b.isSword) {
      c.fillStyle=skills.beam_strike?'#fef08a':'#bae6fd'; c.strokeStyle='#334155'; c.lineWidth=1.2;
      c.beginPath(); c.moveTo(19,0); c.lineTo(-5,-4); c.lineTo(-9,0); c.lineTo(-5,4); c.closePath(); c.fill(); c.stroke();
      c.fillStyle='#fbbf24'; c.fillRect(-8,-7,3,14); c.fillRect(-14,-2,6,4);
    } else if(b.spriteKind) {
      if(b.spriteKind==='bomb') { c.fillStyle='#334155'; c.beginPath(); c.arc(0,0,7,0,Math.PI*2); c.fill(); glyph(c,'fire',3,t,simple); }
      else { c.strokeStyle=b.spriteKind==='king'?'#fde047':'#67e8f9'; c.lineWidth=4; c.beginPath(); c.moveTo(-17,0);c.lineTo(17,0);c.stroke(); c.strokeStyle='#fff';c.lineWidth=1;c.stroke(); }
    } else {
      c.strokeStyle='#e2e8f0'; c.lineWidth=2; c.beginPath();c.moveTo(-12,0);c.lineTo(10,0);c.stroke();
      glyph(c,elements[0] || 'beam',Math.min(12,b.r||7),t,simple);
    }
    for(let i=1;i<elements.length;i++){c.save();c.translate(-i*5,5);glyph(c,elements[i],3,t,simple);c.restore();}
    if(b.isLightwing) { c.strokeStyle='#fef3c7'; c.beginPath();c.moveTo(-3,0);c.lineTo(-10,-10);c.lineTo(3,-4);c.moveTo(-3,0);c.lineTo(-10,10);c.lineTo(3,4);c.stroke(); }
    c.restore(); return true;
  }
  function orb(c,x,y,index,skills,now,game) {
    // Các cầu gộp hiện có gây sát thương trung tính + hút máu; không giả vờ có từng nguyên tố.
    const kind=index<(skills.orbit_orbs||0)*2?'vampire':index<(skills.orbit_orbs||0)*2+(skills.super_circle||0)*4?'neutral':'beam';
    c.save();c.translate(x,y); glyph(c,kind,9,quiet(game)?0:now,quiet(game));
    if(kind==='beam'){c.strokeStyle=colors.beam;c.beginPath();c.moveTo(-13,0);c.lineTo(13,0);c.stroke();} c.restore();
  }
  function meteor(c,mt,now,game) {
    const simple=quiet(game), p=Math.max(0,Math.min(1,mt.progress));
    const x=mt.startX+(mt.targetX-mt.startX)*p,y=mt.startY+(mt.targetY-mt.startY)*p;
    if(!Number.isFinite(x+y))return;
    c.save();c.strokeStyle='#fbbf24';c.lineWidth=1.5;c.globalAlpha=.35+p*.5;
    c.beginPath();c.ellipse(mt.targetX,mt.targetY,24,12,0,0,Math.PI*2);c.stroke();
    c.globalAlpha=1;c.translate(x,y);c.rotate(Math.atan2(mt.targetY-mt.startY,mt.targetX-mt.startX));
    if(!simple){c.strokeStyle='#fb923c';c.lineWidth=8;c.beginPath();c.moveTo(-35,0);c.lineTo(0,0);c.stroke();}
    glyph(c,'fire',13,simple?0:now,simple);c.restore();
  }
  function companions(c,p,now,game) {
    const s=p.skills, simple=quiet(game), t=simple?0:now;
    // Một điểm phát tương ứng với bộ kỹ năng tinh linh gộp hiện có.
    const kind=s.sprite_king?'king':s.laser_sprite?'laser':s.bomb_sprite?'bomb':null;
    if(kind){c.save();c.translate(p.x+34,p.y-22+(simple?0:Math.sin(t*.006)*2));
      c.strokeStyle=kind==='king'?'#fde047':'#67e8f9';c.lineWidth=1.5;c.beginPath();c.ellipse(-7,0,6,3,-.6,0,Math.PI*2);c.ellipse(7,0,6,3,.6,0,Math.PI*2);c.stroke();
      glyph(c,kind==='bomb'?'fire':'beam',6,t,simple);if(kind==='king'){c.fillStyle='#fbbf24';c.fillRect(-5,-12,10,3);}c.restore();}
    if(p.sacredShieldStacks>0){c.save();c.strokeStyle='#fde68a';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y-8,23,0,Math.PI*2);c.stroke();c.restore();}
  }
  function status(c,e,now,game) {
    if (!(e.hp > 0) || !Number.isFinite(e.x + e.y + e.r)) return;
    const simple=quiet(game), t=simple?0:now, r=Math.max(6,e.r);
    let slot=0;
    // Tối đa ba dấu/địch, không mảng hạt, ảnh, gradient hay vòng lặp animation riêng.
    for(let kind=0;kind<3;kind++) {
      if (!(kind===0?e.burnTimer>0:kind===1?e.slowTimer>0:e.poisonActive)) continue;
      const color=kind===0?colors.fire:kind===1?colors.ice:colors.poison;
      c.save();c.translate(e.x,e.y);c.strokeStyle=color;c.lineWidth=1.7;c.globalAlpha=.9;
      c.beginPath();c.ellipse(0,r+3+slot*2,r*(1.08+slot*.16),r*(.34+slot*.05),0,kind*2.05,kind*2.05+1.9);c.stroke();
      c.translate(-16+slot*16,-r-16);
      c.fillStyle='#07111e';c.beginPath();c.arc(0,0,7,0,Math.PI*2);c.fill();
      c.save();c.translate(0,2);
      if(kind===1) { c.beginPath();for(let i=0;i<3;i++){const a=i*Math.PI/3;c.moveTo(-Math.cos(a)*4,-Math.sin(a)*4);c.lineTo(Math.cos(a)*4,Math.sin(a)*4);}c.stroke(); }
      else if(kind===0) { c.beginPath();c.moveTo(-4,2);c.quadraticCurveTo(-5,-2,0,-7);c.quadraticCurveTo(5,-1,4,2);c.closePath();c.stroke(); }
      else { c.beginPath();c.moveTo(0,-6);c.quadraticCurveTo(7,2,0,4);c.quadraticCurveTo(-7,2,0,-6);c.closePath();c.stroke(); }
      c.restore();
      if(!simple){c.globalAlpha=.45;c.beginPath();c.arc(Math.sin(t*.005+kind)*r*.7,-r*.5-((t*.018+kind*7)%12),2,0,Math.PI*2);c.stroke();}
      c.restore();slot++;
    }
  }
  root.SkillCombatVfx={projectile,orb,meteor,companions,element,quiet,status};
})(globalThis);
