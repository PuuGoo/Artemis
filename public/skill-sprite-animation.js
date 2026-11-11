/* Real six-frame elemental projectiles for actual player skill shots.
 * The projectile entity, collision radius, damage and lifetime remain authoritative.
 * Mixed-element combos and special weapons use the existing vector fallback.
 */
(function(root){
  'use strict';
  const CELL=128,FRAMES=6;
  const ELEMENTS=Object.freeze({
    fire:Object.freeze({row:0,skill:'fire_arrow'}),
    ice:Object.freeze({row:1,skill:'ice_arrow'}),
    poison:Object.freeze({row:2,skill:'venom_arrow'}),
    bolt:Object.freeze({row:3,skill:'lightning_arrow'})
  });
  const PATH='/assets/skill-sprites/elemental-projectiles.svg';
  let img=null,failed=false,ready=false;
  function image(){
    if(!img&&typeof root.Image==='function'){
      img=new root.Image();
      img.onload=()=>{ready=img.naturalWidth===CELL*FRAMES&&img.naturalHeight===CELL*4;failed=!ready;};
      img.onerror=()=>{failed=true;ready=false;};
      img.src=PATH;
      if(img.complete&&img.naturalWidth===CELL*FRAMES&&img.naturalHeight===CELL*4)ready=true;
    }
    return img&&!failed&&ready?img:null;
  }
  function projectileKind(b,game){
    if(!b || b.isSword || b.isLightwing || b.spriteKind)return null;
    const skills=game?.player?.skills||{};
    const active=Object.keys(ELEMENTS).filter(k=>Number(skills[ELEMENTS[k].skill])>0);
    return active.length===1?active[0]:null;
  }
  function frameAt(nowMs,game){
    const still=game?.lowGfx||game?.reduceMotion
      ||root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if(still)return 0;
    return Math.abs(Math.floor((Number.isFinite(nowMs)?nowMs:0)/90))%FRAMES;
  }
  function drawProjectile(c,b,nowMs,game){
    const kind=projectileKind(b,game),sheet=kind&&image();
    if(!kind||!sheet||![b.x,b.y,b.vx,b.vy].every(Number.isFinite)
      ||typeof c?.drawImage!=='function'||typeof c?.save!=='function')return false;
    const size=Math.min(52,Math.max(25,(Number(b.r)||6)*5.4)),row=ELEMENTS[kind].row;
    const frame=frameAt(nowMs,game);
    c.save();
    try{
      const trails=Array.isArray(b.trail)?b.trail:[];
      if(!game?.lowGfx&&trails.length>1){
        c.globalAlpha=.19;
        for(let i=Math.max(0,trails.length-5);i<trails.length;i++){
          const p=trails[i];
          if(Number.isFinite(p?.x)&&Number.isFinite(p?.y))
            c.drawImage(sheet,frame*CELL,row*CELL,CELL,CELL,p.x-size*.21,p.y-size*.21,size*.42,size*.42);
        }
      }
      c.globalAlpha=1;
      c.translate(b.x,b.y);
      c.rotate(Math.atan2(b.vy,b.vx));
      c.drawImage(sheet,frame*CELL,row*CELL,CELL,CELL,-size/2,-size/2,size,size);
    }finally{c.restore();}
    return true;
  }
  root.ArtemisSkillSprites=Object.freeze({
    CELL,FRAMES,ELEMENTS,PATH,image,projectileKind,frameAt,drawProjectile
  });
})(typeof window!=='undefined'?window:globalThis);
