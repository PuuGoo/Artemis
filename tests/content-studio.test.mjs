import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cleanBoss,cleanMap,cleanAssignment,BOSS_SLOTS,BIOMES,publicSummary,adminSummary} from '../lib/contentStudio.js';
import {resetMemoryDb,createMemoryDb} from '../lib/mongoMemory.js';
import {GET as publishedGET} from '../lib/publishedStudioHandler.js';

const source=fs.readFileSync(new URL('../public/content-studio-runtime.js',import.meta.url),'utf8');
const renderer=fs.readFileSync(new URL('../public/js/game/rendering/arena-renderer.js',import.meta.url),'utf8');
const loader=fs.readFileSync(new URL('../public/zodiac-chibi-bosses.js',import.meta.url),'utf8');
const studio=fs.readFileSync(new URL('../public/admin-studio.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/admin-studio.html',import.meta.url),'utf8');

function png(name='ares'){
 const file=fs.readFileSync(new URL('../public/assets/leo-guardians/'+name+'.png',import.meta.url));
 return file.toString('base64');
}
const boss={name:'Ares Boss',element:'Hỏa',aiPreset:'golem',color:'#e58622',pngBase64:png()};
test('Content Studio accepts genuine exported RGBA 6x4 PNG and rejects malformed assets',()=>{
 const ok=cleanBoss(boss);
 assert.equal(ok.ok,true);
 assert.equal(ok.data.width,1152);
 assert.equal(ok.data.height,768);
 assert.equal(ok.data.cell,192);
 assert.deepEqual(ok.data.counts,{idle:6,attack:6,hit:4,death:6});
 assert.equal(cleanBoss({...boss,pngBase64:'evil'}).ok,false);
 assert.equal(cleanBoss({...boss,name:'<script>alert(1)</script>'}).ok,false);
 assert.equal(cleanBoss({...boss,aiPreset:'malware'}).ok,false);
 const tooBig=Buffer.alloc(1_200_001);tooBig.set(Buffer.from('89504e470d0a1a0a','hex'));
 assert.equal(cleanBoss({...boss,pngBase64:tooBig.toString('base64')}).ok,false);
});

test('Map variants and placement restrict modifications to existing campaign boss slots',()=>{
 assert.deepEqual(BOSS_SLOTS,[10,20,30,40,50]);
 assert.ok(BIOMES.includes('zodiac_leo'));
 assert.deepEqual(cleanMap({name:'Ice temple',biome:'ice'}),{
   ok:true,data:{name:'Ice temple',biome:'ice',mode:'visual-theme'}});
 assert.equal(cleanMap({name:'HTML',biome:'https://example.com'}).ok,false);
 for(let ch=1;ch<=12;ch++)for(const room of BOSS_SLOTS){
   const a=cleanAssignment({chapter:ch,room,bossId:'boss-valid5'});
   assert.equal(a.ok,true,ch+':'+room);
 }
 assert.equal(cleanAssignment({chapter:13,room:10,bossId:'boss-valid5'}).ok,false);
 assert.equal(cleanAssignment({chapter:1,room:15,bossId:'boss-valid5'}).ok,false);
 assert.equal(cleanAssignment({chapter:1,room:9,bossId:'boss-valid5'}).ok,false);
 assert.equal(cleanAssignment({chapter:1,room:10}).ok,false);
});

test('Public projection strips imported sprite base64 and all drafts',()=>{
 const b={kind:'boss',id:'boss-abcde',version:2,publishedAt:'version-a',
   published:cleanBoss(boss).data,draft:{name:'secret draft',pngBase64:'secret'}};
 const a=adminSummary(b),p=publicSummary(b);
 assert.equal(a.draft.pngBase64,undefined);
 assert.equal(a.published.pngBase64,undefined);
 assert.equal(p.revision,'version-a');
 assert.equal(p.name,'Ares Boss');
 assert.equal(JSON.stringify(p).includes('pngBase64'),false);
 assert.equal(JSON.stringify(p).includes('secret'),false);
});

test('Published endpoint exposes only published bosses/maps and assignment snapshots',async()=>{
 const old=process.env.DB_BACKEND,oldNode=process.env.NODE_ENV;
 process.env.DB_BACKEND='memory'; process.env.NODE_ENV='test';
 try{
   resetMemoryDb();
   const c=createMemoryDb().collection('content_studio');
   await c.insertOne({kind:'boss',id:'boss-public1',draft:{name:'unreleased name',
     pngBase64:'notpublished'},published:cleanBoss(boss).data,publishedAt:'pub1'});
   await c.insertOne({kind:'boss',id:'boss-draft11',draft:cleanBoss(boss).data,published:null});
   await c.insertOne({kind:'map',id:'map-ice0001',draft:{name:'Draft Map'},
     published:cleanMap({name:'Ice temple',biome:'ice'}).data});
   await c.insertOne({kind:'assignment',id:'2:20',draft:{chapter:2,room:20,bossId:'boss-draft11'},
     published:{chapter:2,room:20,bossId:'boss-public1',mapId:'map-ice0001'}});
   const res=await publishedGET(new Request('https://example.test/api/content-studio'));
   assert.equal(res.status,200);
   const data=await res.json();
   assert.equal(data.bosses.length,1);
   assert.equal(data.maps.length,1);
   assert.equal(data.assignments.length,1);
   assert.equal(data.assignments[0].chapter,2);
   assert.ok(!JSON.stringify(data).includes('unreleased name'));
   assert.ok(!JSON.stringify(data).includes('pngBase64'));
   assert.equal((await publishedGET(new Request('https://example.test/api/content-studio?asset=boss-draft11'))).status,404);
   const asset=await publishedGET(new Request('https://example.test/api/content-studio?asset=boss-public1'));
   assert.equal(asset.status,200);
   assert.equal(asset.headers.get('content-type'),'image/png');
   assert.equal((await asset.arrayBuffer()).byteLength,Buffer.from(boss.pngBase64,'base64').length);
 }finally{
   if(old===undefined)delete process.env.DB_BACKEND;else process.env.DB_BACKEND=old;
   if(oldNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNode;
 }
});

test('Game runtime uses exactly the assigned PNG frames and reuses default art elsewhere',()=>{
 const frames=[],imgs=[];
 class Img{
   constructor(){this.complete=true;this.naturalWidth=1152;this.naturalHeight=768;imgs.push(this);}
   set src(value){this._src=value;this.onload?.();}
 }
 const window={Image:Img};
 vm.runInNewContext(source,{window});
 const api=window.ArtemisContentRuntime;
 const manifest={
   bosses:[{id:'boss-abcde',name:'New Boss',asset:'/api/content-studio?asset=boss-abcde',cell:192,revision:'v1'}],
   maps:[{id:'map-ice001',name:'Frozen',biome:'ice'}],
   assignments:[{chapter:3,room:30,bossId:'boss-abcde',mapId:'map-ice001'}]
 };
 assert.equal(api.install(manifest),true);
 assert.equal(api.biomeFor(3,30),'ice');
 assert.equal(api.biomeFor(1,30),null);
 assert.equal(api.bossFor(3,30).name,'New Boss');
 const canvas={drawImage(...args){frames.push(args);},save(){},restore(){},translate(){}};
 const e={isBoss:true,campaignChapter:3,campaignRoom:30,type:'demon_king',r:40,x:100,y:100,
   hp:100,maxHp:100,hitFlashTimer:0,attackTimer:1.5};
 assert.equal(api.drawBoss(canvas,e,100),true);
 assert.equal(frames.at(-1)[2],0);
 assert.equal(api.drawBoss(canvas,{...e,campaignChapter:1},150),false);
 // Same entity across attack timers; frame selection mirrors current game.
 for(let i=0;i<6;i++){
   e.attackTimer=.75-i*.125;
   assert.equal(api.drawBoss(canvas,e,200+i*125),true);
   assert.equal(frames.at(-1)[1],i*192);
   assert.equal(frames.at(-1)[2],192);
 }
 e.attackTimer=1.5;api.drawBoss(canvas,e,1000);
 assert.deepEqual([frames.at(-1)[1],frames.at(-1)[2]],[960,192]);
 assert.ok(imgs.length>=1);
 assert.equal(e.hp,100,'render must not mutate combat entity');
});

test('Admin UI and shared renderer have actual published content integration',()=>{
 new vm.Script(studio);
 new vm.Script(source);
 assert.match(html,/id="spriteAtlas"/);
 assert.match(html,/id="spriteFrames"/);
 assert.match(html,/id="mapBiome"/);
 assert.match(html,/id="assignChapter"/);
 assert.match(html,/id="assignPublish"/);
 assert.match(studio,/composeFrames\(files\)/);
 assert.match(studio,/action:'publishAssignment'/);
 assert.match(renderer,/ArtemisContentRuntime\?\.drawBoss\(ctx,e,nowMs\)/);
 assert.match(renderer,/ArtemisContentRuntime\.biomeFor\(Game\.chapter\?\.id,room\)/);
 assert.match(loader,/content-studio-runtime\.js/);
});
