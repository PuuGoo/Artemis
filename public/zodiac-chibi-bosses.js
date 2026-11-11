/* Artemis: 12 original hand-drawn Canvas 2D zodiac chibi bosses.
   Visual layer only: combat, hitboxes, timing, HP and damage are untouched. */
(function(g){
'use strict';
const names='aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const hues=['#fb7185','#eab65a','#67e8f9','#38bdf8','#fbbf24','#bef264','#f0abfc','#c084fc','#a5b4fc','#7dd3fc','#22d3ee','#5eead4'];
const sources=Object.create(null);
const campaignOrder = ['leo', 'aries', 'taurus', 'gemini', 'cancer', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
names.forEach((n,i)=>sources['zodiac_'+n]=Object.freeze({chapter:campaignOrder.indexOf(n)+1,color:hues[i]}));
const TAU=Math.PI*2;
function path(c,points,fill,stroke,width=3){
 c.beginPath();
 points.forEach(v=>{if(v[0]==='M')c.moveTo(v[1],v[2]);else if(v[0]==='L')c.lineTo(v[1],v[2]);
 else if(v[0]==='Q')c.quadraticCurveTo(v[1],v[2],v[3],v[4]);
 else if(v[0]==='C')c.bezierCurveTo(v[1],v[2],v[3],v[4],v[5],v[6]);
 else if(v[0]==='Z')c.closePath();});
 if(fill){c.fillStyle=fill;c.fill();}
 if(stroke){c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.strokeStyle=stroke;c.stroke();}
}
function oval(c,x,y,rx,ry,fill,stroke,width=3,rot=0){
 c.beginPath();c.ellipse(x,y,rx,ry,rot,0,TAU);
 if(fill){c.fillStyle=fill;c.fill();}
 if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke();}
}
function grad(c,x,y,top,bottom){const z=c.createLinearGradient(x,y,x+90,y+110);z.addColorStop(0,top);z.addColorStop(1,bottom);return z;}
function line(c,ps,col,w=5){path(c,ps,null,'#25314c',w+4);path(c,ps,null,col,w);}
function star(c,x,y,s,color){path(c,[['M',x,y-s],['Q',x+s*.19,y-s*.2,x+s,y],['Q',x+s*.2,y+s*.2,x,y+s],['Q',x-s*.2,y+s*.2,x-s,y],['Q',x-s*.2,y-s*.2,x,y-s],['Z']],color);}
function eyes(c,x,y,k=1){
 for(const d of [-1,1]){oval(c,x+d*17*k,y,6*k,8*k,'#29334d');oval(c,x+(d*17-2)*k,y-3*k,2*k,2.5*k,'white');oval(c,x+d*25*k,y+12*k,10*k,5*k,'rgba(251,113,133,.3)');}
 path(c,[['M',x-7*k,y+15*k],['Q',x,y+23*k,x+7*k,y+15*k]],null,'#513f56',2.7*k);
}
function face(c,x,y,rx,ry,a,b,k=1){oval(c,x,y,rx,ry,grad(c,x-rx,y-ry,a,b),'#776274',3);oval(c,x-13,y-18,20,7,'rgba(255,255,255,.24)',null,1,-.35);eyes(c,x,y+3,k);}
function feet(c,x,y,color){oval(c,x-20,y,18,11,color,'#283349');oval(c,x+20,y,18,11,color,'#283349');}
function crown(c,x,y){path(c,[['M',x-25,y+8],['L',x-30,y-14],['L',x-13,y-4],['L',x,y-24],['L',x+14,y-4],['L',x+30,y-14],['L',x+24,y+8],['Z']],'#ffd56a','#9b6627',3);oval(c,x,y+8,25,5,'#fff1b8','#b78332',2);star(c,x,y-8,5,'white');}
function aries(c,t){
 path(c,[['M',89,181],['Q',54,149,72,106],['L',101,117],['L',164,118],['Q',191,78,208,116],['Q',208,166,168,198],['Z']],'#a43557','#682d4f',4);
 feet(c,128,210,'#ad7e6c');
 for(const [x,y,r] of [[85,152,29],[106,127,34],[144,121,38],[174,149,29],[116,168,43],[155,166,36]])oval(c,x,y,r,r,'#fff0e6','#c7a0a5');
 for(const d of [-1,1]){
  oval(c,128+d*61,105,34,36,'#ad6638','#6b3a31',5);
  oval(c,128+d*61,105,23,24,'#f6c985','#a65c39');
  oval(c,128+d*62,105,10,12,'#976044','#6b4036',2);
  line(c,[['M',128+d*44,118],['Q',128+d*88,119,128+d*85,83],['Q',128+d*80,62,128+d*63,77]],'#ffe3a5',8);
 }
 face(c,128,146,46,46,'#fff3d7','#dbb79b',1);
 oval(c,128,171,25,14,'#f1c5ab','#bc8e8e',2);
 for(const x of [97,117,139,158])oval(c,x,91+Math.abs(128-x)*.1,18,17,'#fff2e5','#d4aeab',2);
 star(c,128,81,9,'#fff5c8');
}
function taurus(c,t){
 feet(c,128,213,'#825038');oval(c,128,168,72,58,'#be824e','#633b34',5);
 path(c,[['M',91,119],['Q',43,103,42,48],['Q',65,79,107,85]],'#ffeba9','#9e734d',5);
 path(c,[['M',165,119],['Q',214,103,215,48],['Q',192,79,149,85]],'#ffeba9','#9e734d',5);
 for(const d of [-1,1])oval(c,128+d*52,117,25,16,'#915435','#583b35',3,d*.2);
 face(c,128,131,60,53,'#efbd77','#9d6246',1.16);
 oval(c,128,159,43,28,'#f3c9a4','#a67861');
 oval(c,114,155,5,4,'#694b41');oval(c,143,155,5,4,'#694b41');
 oval(c,128,173,12,11,null,'#f6d36d',5);
 path(c,[['M',103,82],['L',128,94],['L',154,82],['L',144,106],['L',113,106],['Z']],'#684e41','#3f3234');
 star(c,128,83,8,'#ffe5a2');
}
function gemini(c,t){
 const sway=Math.sin(t*.003)*3;
 line(c,[['M',60,98],['Q',128,43,196,98]],'#fff6ce',4);
 for(const d of [-1,1]){
  const x=128+d*43,y=131+d*sway;
  path(c,[['M',x-30,y+22],['Q',x-51,y+60,x-33,y+92],['L',x+31,y+92],['Q',x+50,y+60,x+30,y+22],['Z']],d<0?'#a855f7':'#0891b2','#34365f',4);
  path(c,[['M',x-33,y-25],['Q',x-33,y-70,x,y-73],['Q',x+32,y-71,x+33,y-25],['Z']],d<0?'#f9a8d4':'#a5f3fc','#5e5277',4);
  face(c,x,y,34,37,'#ffe7c7','#c69ea8',.68);
  line(c,[['M',x-31,y+47],['Q',x-49,y+36,x-55,y+19]],'#ffe1c7',7);
  line(c,[['M',x+31,y+47],['Q',x+49,y+36,x+55,y+19]],'#ffe1c7',7);
  star(c,x,y-71,7,d<0?'#fbcfe8':'#ecfeff');
 }
 star(c,128,116,13,'#fff8db');
}
function cancer(c,t){
 const edge='#89315d',red='#fa8ba7';
 for(const d of [-1,1]){
  for(let i=0;i<3;i++)line(c,[['M',128+d*55,157+i*8],['Q',128+d*(88+i*3),160+i*12,128+d*(95+i*5),188+i*8]],red,7);
  line(c,[['M',128+d*48,150],['Q',128+d*78,90,128+d*101,101]],red,13);
  oval(c,128+d*100,95,28,26,red,edge,4);
  path(c,[['M',128+d*96,79],['Q',128+d*109,48,128+d*126,67],['Q',128+d*133,91,128+d*109,103],['Z']],'#ffd0da',edge,4);
 }
 oval(c,128,161,72,52,grad(c,70,110,'#ffb5c3','#d95382'),edge,5);
 for(const d of [-1,1]){
  line(c,[['M',128+d*23,131],['Q',128+d*26,91,128+d*25,76]],red,6);
  oval(c,128+d*25,74,13,15,'#fff3ec',edge,3);
  oval(c,128+d*25,74,5,8,'#273449');oval(c,128+d*27,71,2,2,'white');
 }
 path(c,[['M',114,175],['Q',128,189,142,175]],null,'#733954',3);
 star(c,128,113,9,'#fff2c7');
}
function leo(c,t){
 line(c,[['M',187,181],['Q',219,184,210,144]],'#d9a247',12);
 oval(c,211,142,13,17,'#f8d573','#9e593a');
 feet(c,128,212,'#b97836');
 for(let i=0;i<14;i++){const a=i*TAU/14,x=128+Math.cos(a)*63,y=140+Math.sin(a)*62;oval(c,x,y,24,36,i%2?'#f3b24a':'#cf7a2c','#87502e',3,a-Math.PI/2);}
 oval(c,128,143,73,75,'#df9a38','#89502e',5);
 face(c,128,146,49,48,'#ffe6a2','#dca35e',1);
 oval(c,128,175,30,20,'#fff1cb','#be8860',2);
 path(c,[['M',122,164],['L',134,164],['L',128,172],['Z']],'#8c5550');
 crown(c,128,67);star(c,181,71,10,'#fff6c1');
}
function virgo(c,t){
 path(c,[['M',101,138],['Q',54,156,69,211],['Q',128,236,188,211],['Q',200,157,156,136],['Z']],grad(c,76,132,'#a4f3bf','#168e86'),'#34516b',4);
 for(let i=0;i<6;i++)star(c,95+i*13,203+(i%2)*6,3,'#edffcd');
 oval(c,93,124,22,71,'#547363','#314b54',3,-.12);
 oval(c,164,124,21,71,'#547363','#314b54',3,.12);
 face(c,128,113,43,48,'#ffe7c8','#ce9eab',.89);
 path(c,[['M',87,96],['Q',95,47,125,56],['Q',160,39,170,96],['Q',144,73,130,84],['Q',106,69,87,96],['Z']],'#746950','#395657',4);
 for(let i=-2;i<=2;i++)star(c,128+i*13,64+Math.abs(i)*4,5,'#fff5bb');
 line(c,[['M',170,207],['Q',192,159,198,93]],'#9f8053',4);
 for(let i=0;i<5;i++){
  const y=101+i*17;
  path(c,[['M',198,y],['Q',174,y-12,186,y-24],['Q',198,y-20,198,y],['Z']],'#f6d88b','#ab8954',2);
  path(c,[['M',198,y+6],['Q',218,y-7,208,y-20],['Q',197,y-14,198,y+6],['Z']],'#f6d88b','#ab8954',2);
 }
}
function libra(c,t){
 path(c,[['M',101,149],['Q',68,173,79,220],['L',177,220],['Q',188,173,151,149],['Z']],grad(c,83,142,'#e9d5ff','#7464b4'),'#4b427e',4);
 feet(c,128,216,'#55528a');face(c,128,117,42,45,'#ffe4cd','#cfa5b6',.86);
 crown(c,128,66);
 line(c,[['M',128,83],['L',128,201]],'#fce9a1',5);
 const bob=Math.sin(t*.002)*2;
 line(c,[['M',56,105+bob],['Q',128,95,200,105-bob]],'#ffe3a1',7);
 for(const d of [-1,1]){
  const x=128+d*70,y=105-d*bob;
  path(c,[['M',x,y],['L',x-24,y+47],['M',x,y],['L',x+24,y+47]],null,'#f6dcac',2.5);
  path(c,[['M',x-28,y+47],['Q',x,y+70,x+28,y+47],['Q',x,y+80,x-28,y+47]],'#f6ca6e','#956e45');
 }
 star(c,128,92,8,'white');
}
function scorpio(c,t){
 const purple='#a77adc',dark='#4a2b6b';
 line(c,[['M',151,187],['Q',201,173,204,131],['Q',225,101,195,76],['Q',184,59,198,46]],purple,16);
 for(const [x,y] of [[176,184],[196,161],[204,136],[206,110],[202,84]])oval(c,x,y,11,9,'#e3b9ff',dark,2,.5);
 path(c,[['M',193,50],['Q',207,28,218,48],['L',197,79],['Z']],'#ffb9d9',dark,4);
 for(const d of [-1,1]){
  for(let i=0;i<4;i++)line(c,[['M',123+d*42,149+i*9],['L',123+d*(66+i*7),169+i*5],['L',123+d*(71+i*9),183+i*8]],purple,6);
  line(c,[['M',123+d*47,144],['Q',123+d*79,116,123+d*88,100]],purple,10);
  oval(c,123+d*86,97,22,25,'#c394ee',dark,4);
  path(c,[['M',123+d*86,81],['Q',123+d*60,57,123+d*51,89],['Q',123+d*78,101,123+d*86,81]],'#deb0ff',dark,3);
 }
 oval(c,122,161,57,55,grad(c,81,104,'#d5afff','#6c3c9e'),dark,5);
 eyes(c,122,140,.9);star(c,123,190,8,'#f5dbff');
}
function sagittarius(c,t){
 line(c,[['M',89,184],['Q',48,165,51,200]],'#a68aca',10);
 oval(c,131,177,70,38,grad(c,77,147,'#d2b4f6','#6f73aa'),'#49517d',4);
 for(const x of [90,114,151,173]){path(c,[['M',x-8,192],['L',x-9,218],['L',x+8,218],['L',x+9,192],['Z']],'#af95ce','#594d7f');oval(c,x,219,15,7,'#474477');}
 path(c,[['M',113,155],['L',111,106],['Q',133,91,155,105],['L',155,158],['Z']],'#5978c5','#394f82',4);
 line(c,[['M',112,117],['Q',94,133,79,143]],'#ffe2c6',9);
 line(c,[['M',154,119],['Q',169,133,185,120]],'#ffe2c6',9);
 face(c,130,86,34,38,'#ffe8c6','#cba5b9',.68);
 path(c,[['M',96,80],['Q',104,39,134,40],['Q',159,38,165,80],['Q',130,65,96,80],['Z']],'#555083','#383555',3);
 path(c,[['M',196,62],['Q',233,132,193,202]],null,'#f4d28d',7);
 path(c,[['M',196,62],['L',193,202],['M',185,128],['L',245,128]],null,'#e8f9ff',2.5);
 path(c,[['M',245,128],['L',229,120],['L',229,136],['Z']],'#e0f7ff','#8296c4',2);
 star(c,204,63,9,'#fff3c5');
}
function capricorn(c,t){
 path(c,[['M',114,168],['Q',167,177,187,198],['Q',208,197,225,179],['Q',228,203,211,213],['Q',235,229,232,240],['Q',199,239,183,219],['Q',160,222,137,207],['Z']],grad(c,128,166,'#6af2d7','#168dab'),'#286c83',4);
 for(let i=0;i<5;i++)line(c,[['M',153+i*10,192+i*3],['Q',163+i*10,184+i*3,176+i*10,196+i*3]],'#a5ffef',1.2);
 oval(c,113,166,57,49,'#83aab0','#476778',4);
 path(c,[['M',83,165],['L',70,215],['L',91,220],['L',107,184],['Z']],'#678791','#395e6c',4);
 for(const d of [-1,1]){
  line(c,[['M',119+d*35,101],['Q',119+d*75,82,119+d*60,48],['Q',119+d*39,34,119+d*27,63]],'#fbe0ac',11);
  oval(c,119+d*41,111,16,13,'#d7c3ac','#8c8991',2);
 }
 face(c,119,115,48,45,'#fae9d0','#b3abb1',.87);
 star(c,188,164,9,'#cbfff7');
}
function aquarius(c,t){
 path(c,[['M',103,145],['Q',75,168,77,219],['L',180,219],['Q',178,161,155,142],['Z']],grad(c,85,139,'#77eafa','#2c6cab'),'#294d7d',4);
 feet(c,128,218,'#355989');
 oval(c,85,117,19,66,'#4c7fb7','#27517f',3,-.13);
 oval(c,168,117,19,66,'#4c7fb7','#27517f',3,.13);
 face(c,127,109,44,47,'#ffe6ce','#c4a3b0',.9);
 path(c,[['M',87,93],['Q',84,50,133,53],['Q',166,50,172,94],['Q',146,76,133,87],['Q',106,68,87,93],['Z']],'#d9fbff','#719ac6',3);
 line(c,[['M',154,148],['Q',172,165,185,155]],'#ffe2c9',9);
 c.save();c.translate(186,147);c.rotate(-.27);
 path(c,[['M',-23,-18],['Q',-31,9,-16,31],['Q',0,44,17,31],['Q',30,9,23,-18],['Z']],'#f7cd94','#996c65',4);
 oval(c,0,-18,26,8,'#fff1c9','#a47f6d');
 star(c,0,14,8,'#fff8d0');c.restore();
 for(let i=0;i<3;i++)line(c,[['M',200+i*8,167],['Q',211+i*8,182,196+i*8,201],['Q',184+i*8,214,194+i*8,226]],'#7ee9fa',5);
 path(c,[['M',39,218],['Q',80,200,111,219],['Q',149,235,185,219],['Q',212,207,243,219]],null,'#44cafa',6);
 star(c,223,97,10,'#e6fdff');
}
function fish(c,x,y,rotation,body,edge){
 c.save();c.translate(x,y);c.rotate(rotation);
 path(c,[['M',-32,0],['Q',-77,-32,-73,0],['Q',-78,34,-32,8],['Z']],body,edge,4);
 path(c,[['M',-29,-9],['Q',-17,-36,15,-27],['Q',48,-7,47,2],['Q',17,37,-20,26],['Z']],body,edge,4);
 path(c,[['M',-3,-23],['L',14,-39],['L',28,-18],['Z']],body,edge,2);
 oval(c,30,-7,5.4,6.5,'#243951');oval(c,31,-10,2,2,'white');
 for(let i=0;i<3;i++)path(c,[['M',-16+i*10,-8],['Q',-7+i*10,3,-16+i*10,11]],null,'rgba(255,255,255,.6)',2);
 star(c,-4,17,5,'white');c.restore();
}
function pisces(c,t){
 c.save();c.translate(128,143);c.rotate(Math.sin(t*.002)*.07);
 c.beginPath();c.arc(0,0,78,-2.5,.5);c.strokeStyle='#5eead4';c.lineWidth=9;c.stroke();
 c.beginPath();c.arc(0,0,78,.65,3.7);c.strokeStyle='#93c5fd';c.stroke();
 fish(c,-25,-37,-.35,'#7be4cd','#2b929f');
 fish(c,31,46,Math.PI-.45,'#afbcfa','#5c64a5');
 star(c,0,2,15,'#f0f9ff');c.restore();
 for(const [x,y,r] of [[41,67,5],[206,197,5],[232,102,3],[57,206,4]])oval(c,x,y,r,r,null,'#b9fff4',2);
}
const painters=[aries,taurus,gemini,cancer,leo,virgo,libra,scorpio,sagittarius,capricorn,aquarius,pisces];
function draw(ctx,type,radius,nowMs,hpRatio,charging){
 const i=names.indexOf(String(type).replace(/^zodiac_/,''));if(!sources[type]||i<0||!ctx||!(Number(radius)>0))return false;
 const r=Number(radius),t=Number.isFinite(nowMs)?nowMs:0,hp=Number.isFinite(hpRatio)?Math.max(0,Math.min(1,hpRatio)):1;
 const rage=hp<.35,charge=!!charging;let saved=false;
 // Leo custom raster sprite; unchanged native Canvas path is the fallback.
 if (type === 'zodiac_leo' && g.ArtemisLeoAnimation?.drawZodiac(ctx,r,t,charge)) return true;
 try{
  ctx.save();saved=true;
  ctx.translate(0,Math.sin(t*.0045+i)*r*.05);
  ctx.rotate(Math.sin(t*.0018+i)*.035+(charge?Math.sin(t*.018)*.027:0));
  const pulse=(charge?1.065:1+Math.sin(t*.004+i)*.012);
  ctx.scale(r/74*pulse,r/74*pulse);ctx.translate(-128,-128);
  ctx.save();ctx.globalAlpha=rage?.27:.14;ctx.shadowColor=hues[i];ctx.shadowBlur=rage?36:24;
  oval(ctx,128,145,94,96,hues[i]);ctx.restore();
  ctx.save();ctx.globalAlpha=.22;oval(ctx,128,230,75,13,'#060b19');ctx.restore();
  painters[i](ctx,t);
  if(charge||rage){
   ctx.save();ctx.globalAlpha=charge?.9:.5+.15*Math.sin(t*.008);
   ctx.strokeStyle=charge?'#fff0c2':hues[i];ctx.shadowColor=hues[i];
   ctx.shadowBlur=charge?26:15;ctx.lineWidth=charge?4:3;
   ctx.beginPath();ctx.ellipse(128,142,104,106,0,0,TAU);ctx.stroke();
   for(let k=0;k<5;k++){const a=t*.0012+k*TAU/5;star(ctx,128+Math.cos(a)*103,142+Math.sin(a)*105,5,hues[i]);}
   ctx.restore();
  }
  return true;
 }catch(error){return false;}finally{if(saved)ctx.restore();}
}
function preload(type){return sources[type]?{ready:true,failed:false}:null;}
g.ArtemisZodiacBosses=Object.freeze({draw,preload,renderMode:'canvas-paths',sources:Object.freeze(sources)});
 // Load Leo art after the native Canvas art, in both game and admin pages.
 if (typeof document !== 'undefined' && document.head && !document.querySelector('script[data-leo-animation]')) {
  const element = document.createElement('script');
  element.dataset.leoAnimation = '1';
  element.setAttribute('src', '/leo-zodiac-animation.js');
  document.head.appendChild(element);
 }
 // Four named Leo guardians use the same independent sprite state pipeline.
 if (typeof document !== 'undefined' && document.head && !document.querySelector('script[data-leo-subboss-animation]')) {
  const spriteScript = document.createElement('script');
  spriteScript.dataset.leoSubbossAnimation = '1';
  spriteScript.setAttribute('src', '/leo-subboss-animation.js?v=leo-attack6-sync-20261111');
  document.head.appendChild(spriteScript);
 }
 // Cosmetic attack effects use the original four PNG sprite sheets in all renderers.
 if (typeof document !== 'undefined' && document.head && !document.querySelector('script[data-leo-subboss-vfx]')) {
  const effectScript = document.createElement('script');
  effectScript.dataset.leoSubbossVfx = '1';
  effectScript.setAttribute('src', '/leo-subboss-vfx.js?v=leo-elemental-20261111');
  document.head.appendChild(effectScript);
 }
 // Published Content Studio manifests overlay the existing game art only after
 // loading successfully. Missing API, assets or drafts keep the default bosses.
 if (typeof document !== 'undefined' && document.head && !document.querySelector('script[data-content-studio-runtime]')) {
  const script=document.createElement('script');
  script.dataset.contentStudioRuntime='1';
  script.setAttribute('src','/content-studio-runtime.js?v=studio-mvp-1');
  document.head.appendChild(script);
 }
})(typeof window!=='undefined'?window:{});
