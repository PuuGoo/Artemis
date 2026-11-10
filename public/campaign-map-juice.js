// Phản hồi map thuần hình ảnh; clock theo updateGame, không timer/save/hit-stop riêng.
(function(root){
  'use strict';
  const states=new WeakMap(),pending=new Set(),seen=new Set();
  const motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  const enabled=g=>g?.mode==='campaign'&&!g.lowGfx&&!motion?.matches;
  function state(g){let s=states.get(g);if(!s){s={time:0,events:[],npcs:new WeakMap()};states.set(g,s);}return s;}
  function reset(g){states.set(g,{time:0,events:[],npcs:new WeakMap()});}
  function emit(g,kind,x,y){if(!enabled(g)||![x,y].every(Number.isFinite))return;const s=state(g);s.events.push({kind,x,y,born:s.time,life:kind==='clear'?1.6:kind==='transition'?.42:1.15});if(s.events.length>12)s.events.shift();}
  function tick(g,dt){if(g.paused||!g.running||!Number.isFinite(dt)||dt<0)return;const s=state(g);s.time+=Math.min(dt,.1);s.events=s.events.filter(e=>s.time-e.born<e.life);}
  function unlock(id){if(Number.isInteger(id)&&id>1&&!seen.has(id)){seen.add(id);pending.add(id);}}
  function takeUnlock(id){return pending.delete(id);}
  function inspect(g){const s=state(g);return {time:s.time,events:s.events.map(e=>({...e}))};}
  const colors=chapter=>chapter===2?['#ffb568','#ffe7ad']:chapter===4?['#8fe8ff','#efffff']:['#b5a2ff','#e4eaff'];
  function ring(ctx,x,y,r,color,alpha){ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y,r,r*.38,0,0,Math.PI*2);ctx.stroke();}
  function scenery(ctx,g,biome){
    if(!enabled(g))return false;
    const t=state(g).time,accent=biome.accent||'#b5a2ff';
    ctx.save();
    try{
      // Nằm trên tường, không ngụ ý có hố/vật cản mới trong lối đi.
      for(let i=0;i<6;i++){
        const x=i%2?g.width-g.wallPad*.5:g.wallPad*.5,y=g.height*(.22+Math.floor(i/2)*.22),p=(t*.45+i*.173)%1;
        ctx.fillStyle=accent;ctx.strokeStyle=accent;ctx.globalAlpha=.22;ctx.lineWidth=1;
        if(biome.floor==='magma'){
          ctx.beginPath();ctx.arc(x,y-8*p,1.5+3*p,0,Math.PI*2);ctx.stroke();
          ctx.globalAlpha=(1-p)*.45;ctx.fillRect(x+Math.sin(i+t)*4,y-12*p,2,2);
        }else if(['snow','sparkle'].includes(biome.ambient)||biome.wall==='crystal'){
          const q=.4+.6*Math.sin(t*1.2+i)**2;ctx.globalAlpha=q*.4;
          ctx.beginPath();ctx.moveTo(x,y-9);ctx.lineTo(x+4,y);ctx.lineTo(x,y+7);ctx.lineTo(x-4,y);ctx.closePath();ctx.stroke();
          ctx.fillRect(x-1,y-3,2,2);
        }else if(['fireflies','spores'].includes(biome.ambient)){
          ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(x,y,5,3,0,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(x-1,y,2,5);
          for(let j=0;j<2;j++){ctx.globalAlpha=(1-p)*.35;ctx.fillRect(x+Math.sin(t+i+j)*7,y-6-14*p-j*3,1.5,1.5);}
        }else{
          ctx.globalAlpha=.2+.15*Math.sin(t+i);ctx.strokeRect(x-3,y-5,6,10);ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.stroke();
        }
      }
    }finally{ctx.restore();}
    return true;
  }
  function draw(ctx,g,layer){
    if(!enabled(g))return false;
    const s=state(g),[accent,light]=colors(g.chapter?.id);
    ctx.save();
    try{
      if(layer==='floor'){

        for(const key of ['encounterNpc','valkyrieNpc']){
          const n=g[key];if(!n||![n.x,n.y].every(Number.isFinite))continue;
          let entry=s.npcs.get(n);if(!entry){entry={near:false,pulse:-10};s.npcs.set(n,entry);}
          const kind=key==='valkyrieNpc'?'valkyrie':n.kind;
          const c=kind==='angel'?'#ffedb0':kind==='devil'?'#c49aff':'#b2eaff';
          ring(ctx,n.x,n.y+11,28,c,.4);
          const near=g.player&&Math.hypot(g.player.x-n.x,g.player.y-n.y)<85;
          for(let i=0;i<5;i++){
            const a=s.time*.6+i*Math.PI*2/5,x=n.x+Math.cos(a)*24,y=n.y-20+Math.sin(a)*13;
            ctx.globalAlpha=.32;ctx.fillStyle=c;ctx.fillRect(x,y,2,kind==='angel'?5:2);
          }
          // Một nhịp khi bước vào vùng tương tác; rời vùng rồi trở lại mới phát nhịp khác.
          if(near&&!entry.near)entry.pulse=s.time;
          entry.near=!!near;
          const age=s.time-entry.pulse;
          if(age<.7)ring(ctx,n.x,n.y+11,30+age*25,c,.55*(1-age/.7));
        }
      }
      for(const e of s.events){
        const age=s.time-e.born,p=age/e.life;
        if(e.kind==='transition'){
          if(layer!=='front')continue;
          // Chỉ hai mép; giữ giữa sân trong, không trì hoãn setupRoom.
          ctx.fillStyle=accent;ctx.globalAlpha=.12*(1-p);
          ctx.fillRect(0,0,g.width,12*(1-p));ctx.fillRect(0,g.height-12*(1-p),g.width,12*(1-p));
          for(let i=0;i<10;i++){
            ctx.globalAlpha=.32*(1-p);const x=g.width*(i+.5)/10,y=g.height*(.1+.8*p);
            ctx.fillRect(x,y,2,g.chapter?.id===2?3:5);
            if(g.chapter?.id===4){ctx.fillRect(x-2,y+2,6,1);}else if(g.chapter?.id!==2){ctx.fillRect(x-2,y+2,6,1);ctx.fillRect(x+1,y-1,1,7);}
          }
          continue;
        }
        if(layer!=='floor')continue;
        if(e.kind==='clear'){
          const pr=g.portalRect,tx=pr.x+pr.w/2,ty=pr.y+pr.h/2;
          for(let i=0;i<8;i++){const q=(p+i/8)%1;ctx.globalAlpha=(1-p)*.6;ctx.fillStyle=light;ctx.fillRect(e.x+(tx-e.x)*q,e.y+(ty-e.y)*q,3,3);}
          ring(ctx,tx,ty,20+p*40,light,(1-p)*.45);
        }else{
          const death=e.kind==='boss-death',r=death?65*(1-p)+8:20+p*52;
          if(!death)root.ArtemisPixelFX?.drawSprite(ctx,'portal',e.x-76,e.y-98,152,116,age*1000,.38*(1-p));
          ring(ctx,e.x,e.y,r,accent,(1-p)*.65);
          ring(ctx,e.x,e.y,r*.72,light,(1-p)*.5);
          for(let i=0;i<10;i++){const a=i*Math.PI/5+p,rr=death?15+p*70:r;ctx.globalAlpha=(1-p)*.6;ctx.fillStyle=i%2?light:accent;ctx.fillRect(e.x+Math.cos(a)*rr,e.y+Math.sin(a)*rr*.5-20*p,2,4);}
        }
      }
    }finally{ctx.restore();}
    return true;
  }
  root.ArtemisMapJuice=Object.freeze({reset,emit,tick,unlock,takeUnlock,inspect,draw,scenery});
})(typeof window!=='undefined'?window:globalThis);
