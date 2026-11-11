/* Artemis Content Studio — published visual content runtime.
 * Never mutates entity, attack pattern, hitbox, save or reward state.
 * The default art/biome remains intact until the published manifest loads.
 */
(function(root){
 'use strict';
 const rows=Object.freeze({idle:0,attack:1,hit:2,death:3});
 const counts=Object.freeze({idle:6,attack:6,hit:4,death:6});
 const durations=Object.freeze({idle:170,attack:125,hit:95,death:145});
 const bySlot=new Map(),bosses=new Map(),maps=new Map(),images=new Map(),states=new WeakMap();
 let lastSeen=null, loaded=false;
 const key=(chapter,room)=>Number(chapter)+':'+Number(room);
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 function install(manifest){
   bySlot.clear(); bosses.clear();maps.clear();images.clear();lastSeen=null;
   if(!manifest || !Array.isArray(manifest.assignments))return false;
   (manifest.bosses||[]).forEach(b=>{if(b && typeof b.id==='string')bosses.set(b.id,b);});
   (manifest.maps||[]).forEach(m=>{if(m && typeof m.id==='string')maps.set(m.id,m);});
   manifest.assignments.forEach(a=>{
     if(Number.isInteger(a?.chapter)&&Number.isInteger(a?.room) && a.chapter>=1 &&
       a.chapter<=12 && [10,20,30,40,50].includes(a.room))
       bySlot.set(key(a.chapter,a.room),a);
   });
   loaded=true;
   return true;
 }
 async function refresh(){
   if(typeof root.fetch!=='function')return false;
   try{
     const response=await root.fetch('/api/content-studio',{credentials:'same-origin',cache:'no-store'});
     if(!response.ok)return false;
     const data=await response.json();
     return !!data.ok && install(data);
   }catch(_){return false;}
 }
 function assignment(chapter,room){return bySlot.get(key(chapter,room))||null;}
 function bossFor(chapter,room){
   const a=assignment(chapter,room);
   return a?.bossId?bosses.get(a.bossId)||null:null;
 }
 function biomeFor(chapter,room){
   const a=assignment(chapter,room);
   return a?.mapId?maps.get(a.mapId)?.biome||null:null;
 }
 function imageFor(boss){
   if(!boss || typeof root.Image!=='function')return null;
   let entry=images.get(boss.id);
   if(!entry){
     const image=new root.Image();
     entry={image,ready:false,failed:false};
     images.set(boss.id,entry);
     image.onload=()=>{
       entry.ready=image.naturalWidth===Number(boss.cell)*6 &&
         image.naturalHeight===Number(boss.cell)*4;
       entry.failed=!entry.ready;
     };
     image.onerror=()=>{entry.failed=true;};
     image.src=boss.asset+(boss.asset.includes('?')?'&':'?')+
       'v='+encodeURIComponent(String(boss.revision||'')); 
     if(image.complete && image.naturalWidth===Number(boss.cell)*6 &&
       image.naturalHeight===Number(boss.cell)*4)entry.ready=true;
   }
   return !entry.failed && entry.ready?entry.image:null;
 }
 function frameAt(action,elapsed){
   const n=counts[action],dur=durations[action];
   if(!n)return 0;
   const idx=Math.max(0,Math.floor(Math.max(0,elapsed)/dur));
   return action==='idle'?idx%n:Math.min(n-1,idx);
 }
 function drawFrame(ctx,boss,action,frame,radius){
   if(!ctx||!(radius>0)||!Object.hasOwn(rows,action))return false;
   const img=imageFor(boss);
   if(!img)return false;
   const cell=Number(boss.cell),i=clamp(Math.floor(frame),0,counts[action]-1);
   const size=radius*4.05;
   try{
     ctx.drawImage(img,i*cell,rows[action]*cell,cell,cell,
       -size/2,radius-size*.90,size,size);
     return true;
   }catch(_){return false;}
 }
 function track(enemy,now){
   let state=states.get(enemy);
   if(!state){
     state={hitValue:0,hitStart:-Infinity,priorTimer:null,followUntil:-Infinity,
       deathStart:-Infinity};
     states.set(enemy,state);
   }
   const hit=Math.max(0,Number(enemy.hitFlashTimer)||0);
   if(hit>0&&(state.hitValue<=0||hit>state.hitValue+.045))state.hitStart=now;
   state.hitValue=hit;
   const timer=Number(enemy.attackTimer);
   const attacking=timer>0&&timer<=.75;
   if(!attacking && Number.isFinite(state.priorTimer) &&
     state.priorTimer>0&&state.priorTimer<=.75&&timer>.75&&enemy.hp>0)
     state.followUntil=now+160;
   if(attacking)state.followUntil=-Infinity;
   state.priorTimer=timer;
   if(Number(enemy.hp)<=0&&state.deathStart===-Infinity)state.deathStart=now;
   return {state,attacking};
 }
 function drawBoss(ctx,enemy,now){
   if(!enemy?.isBoss||!Number.isFinite(enemy.r)||enemy.r<=0)return false;
   const ch=Number(enemy.campaignChapter),room=Number(enemy.campaignRoom);
   const boss=bossFor(ch,room);
   if(!boss)return false;
   const time=Number.isFinite(now)?now:0;
   const {state,attacking}=track(enemy,time);
   let action='idle',frame=frameAt('idle',time);
   if(state.deathStart!==-Infinity){
     action='death';frame=frameAt('death',time-state.deathStart);
   }else if(attacking){
     action='attack';
     frame=clamp(Math.floor((.75-clamp(Number(enemy.attackTimer),0,.75))/.75*6),0,5);
   }else if(time<state.followUntil){
     action='attack';frame=5;
   }else if(time-state.hitStart<counts.hit*durations.hit){
     action='hit';frame=frameAt('hit',time-state.hitStart);
   }
   const drawn=drawFrame(ctx,boss,action,frame,enemy.r);
   if(drawn && enemy.hp>0)
     lastSeen={entity:enemy,boss,chapter:ch,room,x:enemy.x,y:enemy.y,r:enemy.r,seenAt:time};
   return drawn;
 }
 function drawDeathAfterRemoval(ctx,game,now){
   const prev=lastSeen;
   if(!prev||!game||Number(game.chapter?.id)!==prev.chapter ||
       Number(game.room)!==prev.room)return false;
   if(Array.isArray(game.enemies)&&game.enemies.includes(prev.entity))return false;
   const elapsed=now-prev.seenAt;
   if(!game.portalOpen||!Number.isFinite(elapsed)||elapsed>=870){
     if(elapsed>=870)lastSeen=null;
     return false;
   }
   ctx.save();
   try{
     ctx.translate(prev.x,prev.y);
     return drawFrame(ctx,prev.boss,'death',frameAt('death',elapsed),prev.r);
   }finally{ctx.restore();}
 }
 root.ArtemisContentRuntime=Object.freeze({
   refresh,install,assignment,bossFor,biomeFor,drawBoss,drawDeathAfterRemoval,
   drawFrame,frameAt,counts,durations,isLoaded:()=>loaded
 });
 if(root.document && typeof root.fetch==='function')refresh();
})(typeof window!=='undefined'?window:globalThis);
