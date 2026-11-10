import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
const source = file => fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
function load(){const c=vm.createContext({});vm.runInContext(source('arena-viewport.js'),c);return c.ArtemisArenaViewport;}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('portrait run has fixed world, fitted 9:16 viewport independent of resize',()=>{
 const v=load(),g={};v.beginRun(g);assert.equal(g.width,480);assert.equal(g.height,1200);
 const before=JSON.stringify(g);
 for(const [w,h] of [[1440,900],[390,844],[320,568],[1920,1080]]){
  const fit=v.fitLayout(w,h,g.width,g.height);near(fit.width/fit.height,9/16);assert.ok(fit.width<=w&&fit.height<=h);
 }
 assert.equal(JSON.stringify(g),before);
});
test('camera follows both directions, clamps, snaps rooms and preserves hitbox coordinates',()=>{
 const v=load(),g={room:1,player:{x:230,y:1105},obstacles:[{x:50,y:600,w:70,h:20}]};v.beginRun(g);
 const before=JSON.stringify(g),a=v.camera(g,0);near(a.y,1200-a.height);
 g.player.y=400;for(let t=16;t<=1000;t+=16)v.camera(g,t);const b=v.camera(g);assert.ok(b.y<a.y);
 g.player.y=1000;for(let t=1016;t<=2000;t+=16)v.camera(g,t);assert.ok(v.camera(g).y>b.y);
 const rect={left:40,top:20,width:300,height:300*16/9},point=v.worldToScreen(g,rect,160,700),world=v.screenToWorld(g,rect,point.x,point.y);near(world.x,160);near(world.y,700);
 const joy=v.clientToViewport(g,rect,100,100);g.player.y=50;v.camera(g,2100);assert.deepEqual(v.clientToViewport(g,rect,100,100),joy);
 g.room=2;near(v.camera(g,2200).y,0);g.player.y=1105;g.room=1;v.camera(g,2300);
 assert.equal(JSON.stringify(g),before);
});
test('transform clears viewport then translates world once, uniformly',()=>{
 const v=load(),g={player:{y:900},room:1};v.beginRun(g);const calls=[];
 const ctx={canvas:{width:600,height:600*16/9},setTransform:(...a)=>calls.push(['set',...a]),clearRect:(...a)=>calls.push(['clear',...a]),translate:(...a)=>calls.push(['translate',...a])};
 const c=v.applyWorldTransform(ctx,g,0);near(calls[0][1],calls[0][4]);assert.equal(calls[1][0],'clear');near(calls[1][4],c.height);near(calls[2][2],-c.y);
});
test('real Chrome canvas corridor and forward/back camera pixel transforms', {skip:!process.env.PLAYWRIGHT_MODULE}, async()=>{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const page=await browser.newPage();await page.setContent('<canvas width="480" height="854"></canvas>');
 await page.addScriptTag({content:source('arena-viewport.js')});await page.addScriptTag({content:source('js/game/rendering/arena-renderer.js')});
 const result=await page.evaluate(()=>{
  const g={room:1,chapter:{id:1},maxRooms:50,player:{y:1105},floorDecals:[],wallTorches:[],obstacles:[],enemies:[],portalOpen:true};
  const v=ArtemisArenaViewport;v.beginRun(g);const arena=ArtemisArenaRenderer.create();arena.init(g);const ctx=document.querySelector('canvas').getContext('2d');
  const paint=t=>{const c=v.applyWorldTransform(ctx,g,t);arena.drawArena(ctx,g.width,g.height,24,t,1);const m=ctx.getTransform();const data=ctx.getImageData(0,0,480,854).data;let painted=0;for(let i=3;i<data.length;i+=4)if(data[i])painted++;return {camera:c.y,matrix:[m.a,m.d,m.f],painted};};
  const before=JSON.stringify(g),bottom=paint(0);g.player.y=150;for(let t=16;t<=1600;t+=16)v.camera(g,t);const top=paint(1600);g.player.y=1105;for(let t=1616;t<=3200;t+=16)v.camera(g,t);const back=paint(3200);
  return {bottom,top,back,unchanged:before===JSON.stringify(g)};
 });
 assert.ok(result.bottom.painted>400000);assert.ok(result.top.painted>400000);assert.ok(result.top.camera<result.bottom.camera);assert.ok(result.back.camera>result.top.camera);assert.ok(result.unchanged);
 assert.ok(Math.abs(result.bottom.matrix[0]-result.bottom.matrix[1])<.002);console.log(JSON.stringify(result));
 }finally{await browser.close();}
});
