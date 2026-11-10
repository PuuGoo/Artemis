import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function load(reduced=false){const c=vm.createContext({matchMedia:()=>({matches:reduced})});c.window=c;vm.runInContext(fs.readFileSync(new URL('../public/campaign-map-juice.js',import.meta.url),'utf8'),c);return c.ArtemisMapJuice;}
const game=()=>({mode:'campaign',running:true,paused:false,room:1,chapter:{id:1},width:800,height:600,wallPad:24,player:{x:400,y:400},enemies:[],obstacles:[],portalRect:{x:370,y:25,w:60,h:60}});
test('sự kiện có hạn, reset phòng không replay, không sửa gameplay',()=>{
 const fx=load(),g=game(),before=JSON.stringify(g);fx.reset(g);fx.emit(g,'boss-death',100,120);fx.emit(g,'clear',400,300);assert.equal(fx.inspect(g).events.length,2);fx.tick(g,.5);assert.equal(JSON.stringify(g),before);g.paused=true;const t=fx.inspect(g).time;fx.tick(g,1);assert.equal(fx.inspect(g).time,t);g.paused=false;for(let i=0;i<30;i++)fx.tick(g,.1);assert.equal(fx.inspect(g).events.length,0);fx.reset(g);assert.equal(fx.inspect(g).time,0);
});
test('mở khóa chỉ phát một lần từ chiến thắng thật, không tự mở khóa/chọn',()=>{
 const fx=load();assert.equal(fx.takeUnlock(2),false);fx.unlock(2);assert.equal(fx.takeUnlock(2),true);assert.equal(fx.takeUnlock(2),false);fx.unlock(2);assert.equal(fx.takeUnlock(2),false);
});

test('đủ sáu đường production: spawn/death, props, clear, NPC, unlock, transition',()=>{
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 for(const hook of ["emit(Game, 'boss-spawn'","emit(Game, 'boss-death'","emit(Game, 'clear'","emit(Game, 'transition'","ArtemisMapJuice?.unlock(nextCh.id)","draw(ctx, Game, 'floor')","draw(ctx, Game, 'front')","ArtemisMapJuice?.tick(Game, dt)"]){assert.ok(html.includes(hook),hook);}
 const map=fs.readFileSync(new URL('../public/campaign-world-map.js',import.meta.url),'utf8');assert.ok(map.includes('takeUnlock(ch.id)'));assert.ok(map.includes('is-newly-unlocked'));
});

test('render cả hai lớp, NPC và event giữ Game, canvas cân bằng; nhánh nhẹ không vẽ',()=>{
 for(const reduced of [false,true]){
  const fx=load(reduced),g=game();g.encounterNpc={x:200,y:160,kind:'angel'};g.valkyrieNpc={x:300,y:160};
  for(const kind of ['boss-spawn','boss-death','clear','transition'])fx.emit(g,kind,300,150);
  let depth=0,calls=0;const ctx=new Proxy({save(){depth++;},restore(){depth--;},globalAlpha:1},{get:(o,k)=>k in o?o[k]:(...args)=>{calls++;assert.ok(args.every(v=>typeof v!=='number'||Number.isFinite(v)));}});
  const before=JSON.stringify(g);fx.draw(ctx,g,'floor');fx.draw(ctx,g,'front');assert.equal(depth,0);assert.equal(JSON.stringify(g),before);assert.equal(calls>0,!reduced);
  calls=0;g.lowGfx=true;fx.draw(ctx,g,'floor');assert.equal(calls,0);
 }
});

test('bốn loại vật trang trí theo biome, không đổi obstacle hoặc trạng thái tài khoản',()=>{
 const fx=load(),g=game(),before=JSON.stringify(g);let depth=0,calls=0;
 const ctx=new Proxy({save(){depth++;},restore(){depth--;}},{get:(o,k)=>k in o?o[k]:(...args)=>{calls++;assert.ok(args.every(v=>typeof v!=='number'||Number.isFinite(v)));}});
 for(const b of [{floor:'magma'},{ambient:'snow'},{ambient:'spores'},{ambient:'dust'}])assert.equal(fx.scenery(ctx,g,b),true);
 assert.ok(calls>0);assert.equal(depth,0);assert.equal(JSON.stringify(g),before);
});
