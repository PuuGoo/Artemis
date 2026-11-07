/* Artemis shared collision geometry for enemy spawns and movement.
 * Visual obstacle envelope is taller than its gameplay rectangle (columns,
 * steles, mushrooms, etc. protrude upward). Enemies keep a small clearance
 * around the rendered prop. Pure geometry, no damage/AI/state changes.
 */
(function (global) {
  'use strict';
  const EXTRA = Object.freeze({left: 9, right: 9, top: 38, bottom: 6});
  function finite(v, fallback) {return Number.isFinite(v) ? v : fallback;}
  function clamp(v, a, b) {return Math.max(a, Math.min(b, v));}
  function overlapsObstacle(x, y, radius, ob, extra) {
    if(!ob || !Number.isFinite(ob.x) || !Number.isFinite(ob.y) || !(ob.w > 0) || !(ob.h > 0))return false;
    const b=extra || EXTRA;
    const loX=ob.x-b.left, hiX=ob.x+ob.w+b.right;
    const loY=ob.y-b.top, hiY=ob.y+ob.h+b.bottom;
    const nearX=clamp(x,loX,hiX),nearY=clamp(y,loY,hiY);
    const dx=x-nearX,dy=y-nearY;
    // Inclusive comparison: not even tangent to the artistically expanded cover.
    return dx*dx+dy*dy <= radius*radius;
  }
  function inBounds(x,y,r,width,height,wallPad) {
    const pad=finite(wallPad,0)+r;
    return Number.isFinite(x) && Number.isFinite(y) && r>=0 &&
      x>=pad && x<=width-pad && y>=pad && y<=height-pad;
  }
  function free(x,y,r,obstacles,opts) {
    const o=opts || {};
    if(!inBounds(x,y,r,o.width,o.height,o.wallPad))return false;
    if((obstacles || []).some(ob=>overlapsObstacle(x,y,r,ob,o.extra)))return false;
    const player=o.player;
    if(player && Number.isFinite(player.x)&&Number.isFinite(player.y)) {
      const threshold=r+finite(player.r,14)+finite(o.playerGap,10);
      if((x-player.x)**2+(y-player.y)**2<=threshold**2)return false;
    }
    const others=o.others||[];
    for(const e of others) {
      if(!e||!Number.isFinite(e.x)||!Number.isFinite(e.y))continue;
      const threshold=r+finite(e.r,16)+finite(o.enemyGap,7);
      if((x-e.x)**2+(y-e.y)**2<=threshold**2)return false;
    }
    return true;
  }
  function nearest(x,y,r,obstacles,opts) {
    const o=opts || {},width=finite(o.width,0),height=finite(o.height,0),pad=finite(o.wallPad,0)+r;
    if(width<=pad*2 || height<=pad*2)return null;
    const tx=clamp(finite(x,width/2),pad,width-pad);
    const ty=clamp(finite(y,height/2),pad,height-pad);
    if(free(tx,ty,r,obstacles,o))return {x:tx,y:ty};
    const step=Math.max(8,Math.min(16,finite(o.step,12)));
    const maxDist=Math.hypot(width,height);
    // Search growing rings: repairs embedded enemies near their old location,
    // without sudden jumps to an unrelated corner of the map.
    for(let d=step;d<=maxDist+step;d+=step) {
      const count=Math.max(12,Math.ceil(TAU*d/step));
      for(let i=0;i<count;i++) {
        const a=(i/count)*TAU;
        const xx=clamp(tx+Math.cos(a)*d,pad,width-pad);
        const yy=clamp(ty+Math.sin(a)*d,pad,height-pad);
        if(free(xx,yy,r,obstacles,o))return {x:xx,y:yy};
      }
    }
    return null;
  }
  const TAU=Math.PI*2;
  function spawn(x,y,r,obstacles,opts) {
    const candidate=nearest(x,y,r,obstacles,opts);
    if(candidate)return candidate;
    // Crowded arenas: allow standing near another enemy, but NEVER on cover.
    const o=Object.assign({},opts,{others:[],enemyGap:0});
    return nearest(x,y,r,obstacles,o);
  }
  function resolve(entity,obstacles,opts) {
    if(!entity || !Number.isFinite(entity.r) || !(entity.r>0))return false;
    if(free(entity.x,entity.y,entity.r,obstacles,opts))return true;
    const point=nearest(entity.x,entity.y,entity.r,obstacles,opts);
    if(!point)return false;
    entity.x=point.x;entity.y=point.y;
    return true;
  }
  function move(entity,dx,dy,obstacles,opts) {
    if(!entity || !(entity.r>0) || !Number.isFinite(dx) || !Number.isFinite(dy))return false;
    const clean=Object.assign({},opts,{others:[],player:null});
    if(!resolve(entity,obstacles,clean))return false;
    // Substeps prevent fast enemies from tunneling through thin props.
    const parts=Math.min(100,Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(4,entity.r*.45))));
    const sx=dx/parts,sy=dy/parts;
    for(let i=0;i<parts;i++) {
      if(free(entity.x+sx,entity.y,entity.r,obstacles,clean))entity.x+=sx;
      if(free(entity.x,entity.y+sy,entity.r,obstacles,clean))entity.y+=sy;
    }
    return true;
  }
  global.ArtemisObstacleClearance=Object.freeze({
    visualPadding:EXTRA, overlapsObstacle, inBounds, isFree:free, findSafeSpawn:spawn,
    resolveEntity:resolve, moveEntity:move
  });
})(typeof window !== 'undefined' ? window : {});
