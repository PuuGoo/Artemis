import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../public/leo-zodiac-animation.js',import.meta.url),'utf8');
function setup(loaded=true) {
 const paths=[];
 class ImageMock { constructor(){this.complete=loaded;this.naturalWidth=loaded?3072:0;this.naturalHeight=loaded?512:0;}
 set src(v){paths.push(v);if(this.onload&&loaded)this.onload();}}
 const window={Image:ImageMock};vm.runInNewContext(code,{window});
 const draws=[];const ctx={save(){},restore(){},translate(){},drawImage(...args){draws.push(args);}};
 return {api:window.ArtemisLeoAnimation,ctx,draws,paths};
}
const leo=()=>({isBoss:true,type:'zodiac_leo',r:40,x:300,y:150,hp:200,maxHp:200,attackTimer:1,hitFlashTimer:0});
test('Leo sprites do not mutate combat entity; other zodiac bosses are ignored',()=>{
 const {api,ctx,draws,paths}=setup(),e=leo(),before=structuredClone(e);
 assert.equal(api.drawEntity(ctx,e,100),true);assert.equal(api.drawEntity(ctx,e,200),true);
 assert.deepEqual(e,before);assert.equal(api.drawEntity(ctx,{...e,type:'zodiac_aries'},300),false);
 assert.equal(draws.length,2);assert.equal(paths.filter(p=>p.endsWith('/leo-idle.png')).length,1);
});
test('Attack, Hit and Death animate through distinct atlas frames',()=>{
 const {api,ctx,draws}=setup(),e=leo();api.drawEntity(ctx,e,100);
 e.attackTimer=.3;api.drawEntity(ctx,e,200);api.drawEntity(ctx,e,320);
 assert.ok(draws.at(-1)[1]>0);
 e.attackTimer=.8;e.hitFlashTimer=.1;api.drawEntity(ctx,e,450);api.drawEntity(ctx,e,550);
 assert.ok(draws.at(-1)[1]>0);
 e.hp=0;api.drawEntity(ctx,e,900);api.drawEntity(ctx,e,2200);
 assert.equal(draws.at(-1)[1],5*512);
});
test('Missing images allow old Canvas fallback',()=>{
 const {api,ctx}=setup(false);assert.equal(api.drawEntity(ctx,leo(),0),false);
 assert.equal(api.drawZodiac(ctx,40,100,false),false);
});
test('Death afterimage is room-scoped',()=>{
 const {api,ctx}=setup(),e=leo();
 const g={enemies:[e],room:50,chapter:{id:12},portalOpen:false};
 api.rememberRoom(g);api.drawEntity(ctx,e,1000);g.enemies=[];g.portalOpen=true;
 assert.equal(api.drawDeathAfterRemoval(ctx,g,1050),true);
 g.room=1;api.rememberRoom(g);assert.equal(api.drawDeathAfterRemoval(ctx,g,1100),false);
});
test('Optional sprite files follow 512px RGBA atlas contract',t=>{
 const files=['idle','attack','hit','death'].map(n=>new URL('../public/assets/zodiac/leo-'+n+'.png',import.meta.url));
 if(!files.every(f=>fs.existsSync(f)))return t.skip('Binaries distributed in integration ZIP; upload before release');
 for(let i=0;i<4;i++){const b=fs.readFileSync(files[i]);
 assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(b.readUInt32BE(16),[6,6,4,6][i]*512);
 assert.equal(b.readUInt32BE(20),512);assert.equal(b[25],6);}
});