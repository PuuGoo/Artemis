/* NPC Canvas: tìm đường trong miền đi được trước khi chọn vị trí, không tạo timer. */
(function(root) {
  'use strict';
  function findPosition(g,placement='portal') {
    const geo=root.ArtemisObstacleClearance, p=g.player;
    if(!geo || !p) return null;
    const step=12, radius=Math.max(22,p.r||17), pad=g.wallPad+radius;
    const cols=Math.floor((g.width-pad*2)/step)+1, rows=Math.floor((g.height-pad*2)/step)+1;
    if(cols<1||rows<1)return null;
    const opts={width:g.width,height:g.height,wallPad:g.wallPad,player:null};
    const point=(x,y)=>({x:pad+x*step,y:pad+y*step});
    const allowed=(x,y)=>{const t=point(x,y);return geo.isFree(t.x,t.y,radius,g.obstacles,opts);};
    const sx=Math.max(0,Math.min(cols-1,Math.round((p.x-pad)/step)));
    const sy=Math.max(0,Math.min(rows-1,Math.round((p.y-pad)/step)));
    if(!allowed(sx,sy))return null;
    const queue=[[sx,sy]],seen=new Set([sy*cols+sx]);let best=null,score=Infinity;
    for(let i=0;i<queue.length;i++) {
      const [x,y]=queue[i],t=point(x,y),portal=g.portalRect;
      const target=placement==='portal'&&portal
        ? {x:portal.x+portal.w/2,y:portal.y+portal.h+65}
        : {x:g.width/2,y:g.height/2};
      const distance=Math.hypot(t.x-target.x,t.y-target.y);
      if(distance<score){score=distance;best={...t,r:22};}
      // Snap to the exact center when a connected clear segment reaches it.
      if(distance<=step*1.5 && [0,.25,.5,.75,1].every(f=>geo.isFree(t.x+(target.x-t.x)*f,t.y+(target.y-t.y)*f,radius,g.obstacles,opts)))return {...target,r:22};
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx,ny=y+dy,key=ny*cols+nx;
        if(nx<0||ny<0||nx>=cols||ny>=rows||seen.has(key))continue;
        seen.add(key);
        const next=point(nx,ny);
        if(allowed(nx,ny)&&[.25,.5,.75].every(f=>geo.isFree(t.x+(next.x-t.x)*f,t.y+(next.y-t.y)*f,radius,g.obstacles,opts)))queue.push([nx,ny]);
      }
    }
    return best;
  }
  function draw(ctx,npc,now,low,near) {
    if(!npc)return;
    const reduced=!!low || !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(root.ArtemisCampaignNPCArt?.draw(ctx,npc,now,reduced,near,'valkyrie'))return;
    const bob=low?0:Math.sin(now*.003)*3;
    ctx.save();ctx.translate(npc.x,npc.y+bob);
    // Cánh trắng, váy xanh và quầng sáng: vector nội bộ, không tải asset ngoài.
    ctx.fillStyle=near?'#fef3c7':'#e0f2fe';ctx.strokeStyle='#fcd34d';ctx.lineWidth=2;
    for(const sign of [-1,1]) {
      ctx.beginPath();ctx.moveTo(sign*7,4);ctx.quadraticCurveTo(sign*40,-34,sign*33,1);ctx.quadraticCurveTo(sign*27,19,sign*7,12);ctx.fill();
    }
    ctx.fillStyle='#38bdf8';ctx.beginPath();ctx.moveTo(0,-3);ctx.lineTo(-16,24);ctx.lineTo(16,24);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fde2ce';ctx.beginPath();ctx.arc(0,-14,12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fde68a';ctx.beginPath();ctx.arc(0,-19,12,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillStyle='#0f172a';ctx.fillRect(-5,-16,2,3);ctx.fillRect(3,-16,2,3);
    ctx.beginPath();ctx.ellipse(0,-34,16,5,0,0,Math.PI*2);ctx.stroke();
    if(!low){ctx.globalAlpha=.25;ctx.beginPath();ctx.ellipse(0,28,near?34:26,8,0,0,Math.PI*2);ctx.fillStyle='#fde68a';ctx.fill();ctx.globalAlpha=1;}
    ctx.textAlign='center';ctx.fillStyle='#fef3c7';ctx.font='bold 11px system-ui';ctx.fillText(near?(npc.prompt||'Chạm để chọn kỹ năng'):(npc.label||'Valkyrie'),0,46);
    ctx.restore();
  }
  root.ArtemisCampaignValkyrie=Object.freeze({findPosition,draw});
})(typeof window!=='undefined'?window:globalThis);
