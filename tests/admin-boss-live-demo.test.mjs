import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { getCampaignDetail, getCampaignSummaries } from '../lib/campaignCatalog.js';

const adminSource=fs.readFileSync(new URL('../public/admin-campaign.js',import.meta.url),'utf8');
const spriteSource=fs.readFileSync(new URL('../public/leo-subboss-animation.js',import.meta.url),'utf8');
const rendererSource=fs.readFileSync(new URL('../public/js/game/rendering/arena-renderer.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/admin-campaign.css',import.meta.url),'utf8');
const originalHP=getCampaignDetail(1).roomsDetail[9].boss.hp;

function fixture(){
  const nodes=new Map(),frames=[],painted=[],primed=[],scheduled=[];
  const context2d={
    clearRect(){},fillRect(){},fillText(){},save(){},restore(){},translate(){},
    drawImage(...args){frames.push({sx:args[1],sy:args[2],width:args[3],height:args[4]});}
  };
  const element=(id)=>{
    if(!nodes.has(id))nodes.set(id,{
      innerHTML:'',textContent:'',hidden:false,
      addEventListener(){},setAttribute(){},getContext(){return context2d},
      querySelectorAll(){return []}
    });
    return nodes.get(id);
  };
  let click=null,now=1000;
  const root={
    innerHTML:'',
    querySelector(id){return element(id)},
    querySelectorAll(){return []},
    addEventListener(type,fn){if(type==='click')click=fn;},
    closest(){return null}
  };
  const arena={
    game:null,init(g){this.game=g;},
    drawArena(){},
    drawMonster(ctx,e,time){
      painted.push({room:e.campaignRoom,type:e.type,hp:e.hp,maxHp:e.maxHp,
        attackTimer:e.attackTimer,hitFlashTimer:e.hitFlashTimer,time});
      window.ArtemisLeoSubBossSprites.drawEntity(ctx,e,time);
    },
    _debug:{pickBiome(){return {id:'zodiac_leo',label:'Thánh Điện Nhật Luân'}},
      setBiome(){},primePreviewEnemy(e){primed.push(e);}}
  };
  const window={AdminCampaignArenaV2:arena};
  class ImageMock{
    constructor(){this.complete=true;this.naturalWidth=1152;this.naturalHeight=768;}
    set src(value){this._src=value;this.onload?.();}
  }
  window.Image=ImageMock;
  vm.runInNewContext(spriteSource,{window},{filename:'leo-subboss-animation.js'});
  const doc={hidden:false,addEventListener(){},head:{appendChild(){}},querySelector(){return null}};
  vm.runInNewContext(adminSource,{
    window,document:doc,location:{hash:''},performance:{now(){return now}},
    console:{warn(){},error(){}},
    requestAnimationFrame(cb){scheduled.push(cb);return scheduled.length;},
    cancelAnimationFrame(){scheduled.length=0;}
  },{filename:'admin-campaign.js'});
  window.AdminCampaignUI.mount(root,{
    esc(s){return String(s??'')},num(n){return String(n)},
    api(url){return Promise.resolve({data:url.includes('?')
      ?{ok:true,chapter:getCampaignDetail(1)}:{ok:true,chapters:getCampaignSummaries()}});}
  });
  function send(attribute,value){
    assert.ok(click,'delegated Admin click handler not wired');
    const node={getAttribute(name){return name===attribute?String(value):null}};
    click({target:{closest(selector){return selector==='['+attribute+']'?node:null;}}});
  }
  function advance(ms){
    now+=ms;
    // Every call to tick schedules another requestAnimationFrame.
    const next=scheduled.shift();
    assert.ok(next,'missing Admin RAF');
    next(now);
  }
  return {root,window,nodes,frames,painted,primed,send,advance,now:()=>now};
}

test('Admin boss panel displays the same in-game atlas with 4 labeled actions',async()=>{
  const f=fixture();await new Promise(resolve=>setImmediate(resolve));
  const markup=f.nodes.get('#ccDetail').innerHTML;
  for(const label of ['idle','attack','hit','death'])
    assert.match(markup,new RegExp('data-demo-action="'+label+'"'));
  assert.match(markup,/id="ccBossDemo"/);
  assert.match(markup,/data-demo-replay/);
  assert.match(css,/\.cc-boss-demo\[hidden\]\{display:none\}/);
  assert.match(adminSource,/activeEntities\.forEach\(function\(e\)\{api\.drawMonster\(ctx,e,now\);\}\)/);
  assert.doesNotMatch(adminSource,/function drawZodiacInArena/);
  assert.match(rendererSource,/_debug: \{[^}]*primePreviewEnemy/);
  assert.equal(f.nodes.get('#ccBossDemo').hidden,true,'regular rooms do not display boss controls');
  f.send('data-room',10);
  assert.equal(f.nodes.get('#ccBossDemo').hidden,false);
  assert.match(f.nodes.get('#ccBossDemoTitle').textContent,/Ares/);
  assert.ok(f.primed.length>0,'boss entrance is visually primed for first animation frame');
  assert.match(f.nodes.get('#ccEntities').innerHTML,/data-sprite="room-0"/);
  assert.ok(f.painted.some(x=>x.room===10 && x.type==='golem'));
});

test('Admin clicks animate all six real PNG Attack cells for four Leo guardians',async()=>{
  const f=fixture();await new Promise(resolve=>setImmediate(resolve));
  for(const [room,type] of [[10,'golem'],[20,'queen'],[30,'demon_king'],[40,'elder_dragon']]){
    f.send('data-room',room);
    f.send('data-demo-action','attack');
    const attackFrames=[f.frames.at(-1)];
    for(let k=1;k<6;k++){
      f.advance(125);
      attackFrames.push(f.frames.at(-1));
    }
    assert.deepEqual(attackFrames.map(x=>[x.sx,x.sy]),
      [[0,192],[192,192],[384,192],[576,192],[768,192],[960,192]],
      'must paint six distinct Attack frames at boss room '+room);
    assert.equal(f.painted.at(-1).type,type);
    assert.equal(f.painted.at(-1).room,room);
    assert.ok(f.painted.at(-1).attackTimer<=.15);
    f.advance(125); // fire resets to cooldown; sixth frame stays briefly.
    assert.deepEqual([f.frames.at(-1).sx,f.frames.at(-1).sy],[960,192]);
    f.advance(220); // return to Idle without changing encounter stats.
    assert.equal(f.frames.at(-1).sy,0);
  }
  assert.equal(getCampaignDetail(1).roomsDetail[9].boss.hp,originalHP);
});

test('Admin Hit and Death modes show actual atlas rows and support replay',async()=>{
  const f=fixture();await new Promise(resolve=>setImmediate(resolve));
  f.send('data-room',40);
  f.send('data-demo-action','hit');
  assert.deepEqual([f.frames.at(-1).sx,f.frames.at(-1).sy],[0,384]);
  f.advance(100);
  assert.deepEqual([f.frames.at(-1).sx,f.frames.at(-1).sy],[192,384]);
  assert.ok(f.painted.at(-1).hitFlashTimer>0);
  f.send('data-demo-action','death');
  assert.equal(f.painted.at(-1).hp,0);
  assert.deepEqual([f.frames.at(-1).sx,f.frames.at(-1).sy],[0,576]);
  f.advance(155);
  assert.deepEqual([f.frames.at(-1).sx,f.frames.at(-1).sy],[192,576]);
  f.send('data-demo-replay','1');
  assert.deepEqual([f.frames.at(-1).sx,f.frames.at(-1).sy],[0,576]);
  f.send('data-demo-action','idle');
  assert.equal(f.painted.at(-1).hp,f.painted.at(-1).maxHp);
  assert.equal(f.frames.at(-1).sy,0);
});
