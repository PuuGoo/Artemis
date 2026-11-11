/* Sprite atlas renderer for normal monsters (the original icon art remains fallback).
 * 6 columns x 5 rows, 160px transparent cells: Idle, Attack, Hit, Death, Skill.
 * No gameplay writes, AI changes, projectiles, hitbox or save modifications.
 */
(function (root) {
  'use strict';
  const CELL=160,COLUMNS=6,ROWS=5,WARNING=.75,AFTER_FIRE_MS=140;
  const ACTIONS=Object.freeze({
    idle:Object.freeze({row:0,count:6,frameMs:170,loop:true}),
    attack:Object.freeze({row:1,count:6,frameMs:125,loop:false}),
    hit:Object.freeze({row:2,count:6,frameMs:80,loop:false}),
    death:Object.freeze({row:3,count:6,frameMs:120,loop:false}),
    skill:Object.freeze({row:4,count:6,frameMs:125,loop:false})
  });
  // Each mapping preserves the original asset identity; new sheets opt in one by one.
  // The visual identities are unique to Chapter 1 (Thánh Điện Nhật Luân).
  // They are selected from the existing four campaign enemy archetypes, without
  // altering their AI, stats, roster, save identifiers or collision geometry.
  const LEO_CHAPTER_ONE=Object.freeze({
    slime:Object.freeze({file:'leo_sun_cub',name:'Ấu Sư Nhật Quang',role:'Tập kích cận chiến'}),
    goblin:Object.freeze({file:'leo_golden_guard',name:'Sư Vệ Hoàng Kim',role:'Chiến binh hoàng gia'}),
    plant_turret:Object.freeze({file:'leo_sun_turret',name:'Pháo Đài Nhật Luân',role:'Bắn đạn mặt trời'}),
    skeleton_mage:Object.freeze({file:'leo_sun_priest',name:'Tư Tế Sư Tử',role:'Pháp sư nhật quang'})
  });
  const MANIFEST=Object.freeze({
    leo_sun_cub:Object.freeze({
      id:'leo-sun-cub',name:'Ấu Sư Nhật Quang',
      path:'/assets/monster-sprites/leo-cub.svg',width:CELL*COLUMNS,height:CELL*ROWS,
      foot:139,scale:2.75,chapter:1
    }),
    leo_golden_guard:Object.freeze({
      id:'leo-golden-guard',name:'Sư Vệ Hoàng Kim',
      path:'/assets/monster-sprites/leo-guard.svg',width:CELL*COLUMNS,height:CELL*ROWS,
      foot:139,scale:2.78,chapter:1
    }),
    leo_sun_turret:Object.freeze({
      id:'leo-sun-turret',name:'Pháo Đài Nhật Luân',
      path:'/assets/monster-sprites/leo-turret.svg',width:CELL*COLUMNS,height:CELL*ROWS,
      foot:139,scale:2.85,chapter:1
    }),
    leo_sun_priest:Object.freeze({
      id:'leo-sun-priest',name:'Tư Tế Sư Tử',
      path:'/assets/monster-sprites/leo-priest.svg',width:CELL*COLUMNS,height:CELL*ROWS,
      foot:139,scale:2.86,chapter:1
    }),
    'Icon_SmilmeSmall_ccca1d.png':Object.freeze({
      id:'slime-blue',name:'Slime Lam',path:'/assets/monster-sprites/slime-blue.svg',
      width:CELL*COLUMNS,height:CELL*ROWS,foot:130,scale:2.55
    }),
    'Icon_Bat_Gray_4f8a9c.png':Object.freeze({
      id:'bat-ember',name:'Dơi Tro Đỏ',path:'/assets/monster-sprites/bat-ember.svg',
      width:CELL*COLUMNS,height:CELL*ROWS,foot:137,scale:2.6
    })
  });
  const images=new Map(),tracks=new WeakMap(),visible=new Map();
  const keepMs=1100;
  let activeRoom=null;
  const safeTime=n=>Number.isFinite(n)?Math.max(0,n):0;
  function quiet(game){
    return !!(game?.lowGfx || game?.reduceMotion
      || root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  }
  function spriteFileFor(enemy,game){
    if(!enemy||enemy.isBoss===true)return null;
    const campaign=game && (!game.mode || game.mode==='campaign');
    if(campaign && Number(game.chapter?.id)===1){
      return LEO_CHAPTER_ONE[enemy.type]?.file || null;
    }
    // Old monster atlases remain available for other chapters and previews.
    return enemy.monsterArtFile || null;
  }
  function eligible(enemy,game) {
    return !!(enemy && enemy.isBoss!==true && Number(enemy.r)>0
      && MANIFEST[spriteFileFor(enemy,game)]);
  }
  function nameFor(enemy,game){
    const file=spriteFileFor(enemy,game);
    return MANIFEST[file]?.name || null;
  }
  function imageFor(file){
    const def=MANIFEST[file];
    if (!def || typeof root.Image!=='function')return null;
    let entry=images.get(file);
    if(!entry){
      const image=new root.Image();
      entry={image,ready:false,failed:false};
      images.set(file,entry);
      image.onload=()=>{
        entry.ready=image.naturalWidth===def.width&&image.naturalHeight===def.height;
        entry.failed=!entry.ready;
      };
      image.onerror=()=>{entry.ready=false;entry.failed=true;};
      image.src=def.path;
      if(image.complete&&image.naturalWidth===def.width&&image.naturalHeight===def.height)
        entry.ready=true;
    }
    return entry.ready&&!entry.failed?entry.image:null;
  }
  function preloadAll(){for(const key of Object.keys(MANIFEST))imageFor(key);}
  function frameAt(action,elapsedMs){
    const def=ACTIONS[action];if(!def)return 0;
    const step=Math.floor(safeTime(elapsedMs)/def.frameMs);
    return def.loop?step%def.count:Math.min(def.count-1,step);
  }
  function actionFrameForTimer(timer){
    const t=Number(timer);
    if(!Number.isFinite(t))return 0;
    return Math.min(COLUMNS-1,Math.max(0,Math.floor(
      (WARNING-Math.max(0,Math.min(WARNING,t)))/WARNING*COLUMNS)));
  }
  function drawFrame(ctx,file,action,index,radius){
    const sheet=imageFor(file),config=MANIFEST[file],def=ACTIONS[action];
    if(!sheet||!def||!config||!(radius>0)||typeof ctx?.drawImage!=='function')return false;
    const i=Math.min(def.count-1,Math.max(0,Math.floor(Number(index)||0)));
    const size=radius*config.scale;
    try{
      ctx.drawImage(sheet,i*CELL,def.row*CELL,CELL,CELL,
        -size/2,radius-size*config.foot/CELL,size,size);
      return true;
    }catch(_){return false;}
  }
  function trackFor(e,now){
    let track=tracks.get(e);
    if(!track){
      track={seenHit:false,previousHit:0,hitStart:-Infinity,previousTimer:null,
        impactUntil:-Infinity,deathStart:-Infinity,previousMode:'attack'};
      tracks.set(e,track);
    }
    const hit=Math.max(0,Number(e.hitFlashTimer)||0);
    if(hit>0 && (!track.seenHit || hit>track.previousHit+.045))track.hitStart=now;
    track.seenHit=hit>0;track.previousHit=hit;
    const t=Number(e.attackTimer),last=track.previousTimer;
    if(Number.isFinite(t)&&t>0&&t<=WARNING)track.impactUntil=-Infinity;
    else if(Number.isFinite(last)&&last>0&&last<=WARNING
      && t>WARNING && Number(e.hp)>0)track.impactUntil=now+AFTER_FIRE_MS;
    track.previousTimer=Number.isFinite(t)?t:null;
    if(Number(e.hp)<=0&&track.deathStart===-Infinity)track.deathStart=now;
    return track;
  }
  function animationFor(enemy,now,game){
    const track=trackFor(enemy,now);
    let action='idle',frame=frameAt('idle',now);
    // For ranged or elite monsters, the projectile volley uses the separate Skill row.
    // This changes animation only; the actual shot/cooldown still comes from the game.
    const skill=enemy.isElite===true || ['skeleton_mage','plant_turret','eclipse_oracle'].includes(enemy.type);
    const attackAction=skill?'skill':'attack';
    if(track.deathStart!==-Infinity){action='death';frame=frameAt(action,now-track.deathStart);}
    else if(enemy.attackTimer>0&&enemy.attackTimer<=WARNING){
      action=attackAction;frame=actionFrameForTimer(enemy.attackTimer);
      track.previousMode=action;
    } else if(now<track.impactUntil){
      action=track.previousMode;frame=COLUMNS-1;
    } else if(now-track.hitStart<ACTIONS.hit.count*ACTIONS.hit.frameMs){
      action='hit';frame=frameAt(action,now-track.hitStart);
    }
    if(quiet(game)){
      frame=action==='idle'?0:action==='death'?5:action==='hit'?2:4;
    }
    return {action,frame,track};
  }
  function keyFor(game){return String(game?.mode||'campaign')+':'+String(game?.chapter?.id||0)+':'+String(game?.room||0);}
  function drawEnemy(ctx,enemy,nowMs,game){
    const file=spriteFileFor(enemy,game);
    if(!eligible(enemy,game)||!imageFor(file))return false;
    const now=safeTime(nowMs),anim=animationFor(enemy,now,game);
    const drew=drawFrame(ctx,file,anim.action,anim.frame,enemy.r);
    if(!drew)return false;
    if(game && Number(enemy.hp)>0){
      const key=keyFor(game);
      if(activeRoom!==key){visible.clear();activeRoom=key;}
      visible.set(enemy,{file,r:enemy.r,x:enemy.x,y:enemy.y,
        at:now,room:key,deathSince:null});
      // Avoid retaining entities forever when waves keep spawning.
      if(visible.size>48)visible.delete(visible.keys().next().value);
    }
    return true;
  }
  function drawDeaths(ctx,game,nowMs){
    if(!game||typeof ctx?.save!=='function'||typeof ctx?.translate!=='function')
      return 0;
    const key=keyFor(game),now=safeTime(nowMs);
    if(key!==activeRoom){visible.clear();activeRoom=key;return 0;}
    const enemies=Array.isArray(game.enemies)?game.enemies:[];
    let total=0;
    for(const [entity,s] of visible){
      if(s.room!==key||now-s.at>keepMs){visible.delete(entity);continue;}
      if(enemies.includes(entity)){s.deathSince=null;continue;}
      if(s.deathSince===null)s.deathSince=s.at;
      const duration=ACTIONS.death.count*ACTIONS.death.frameMs;
      const elapsed=now-s.deathSince;
      if(elapsed>=duration){visible.delete(entity);continue;}
      const frame=quiet(game)?ACTIONS.death.count-1:frameAt('death',elapsed);
      ctx.save();
      try{
        ctx.translate(s.x,s.y);
        if(drawFrame(ctx,s.file,'death',frame,s.r))total++;
      }finally{ctx.restore();}
    }
    return total;
  }
  root.ArtemisMonsterSprites=Object.freeze({
    CELL,COLUMNS,ROWS,ACTIONS,MANIFEST,LEO_CHAPTER_ONE,
    spriteFileFor,eligible,nameFor,imageFor,preloadAll,frameAt,
    actionFrameForTimer,animationFor,drawFrame,drawEnemy,drawDeaths
  });
})(typeof window!=='undefined'?window:globalThis);
