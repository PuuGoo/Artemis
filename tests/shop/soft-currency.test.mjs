import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
const html=fs.readFileSync(new URL('../../public/index.html',import.meta.url),'utf8');
function run(attribute, value, state) {
  const start=html.indexOf(`        el.querySelectorAll('[${attribute}]')`);
  assert.ok(start>0);
  let end=html.indexOf("        el.querySelectorAll(",start+1);
  if(attribute==='data-vn-topup-gold') end=html.indexOf('\n\n      }',start);
  const button={getAttribute:()=>value};
  let pulls=0,saves=0;
  const context={SaveState:state,crypto:{randomUUID},dailyCards:JSON.parse(html.match(/const dailyCards = (\[[\s\S]*?\n        \]);/)[1].replace(/'/g,'"').replace(/(\w+):/g,'"$1":')),
    el:{querySelectorAll:()=>[button]},showToast(){},syncWishTokenMirrors(){},ensureGarden:()=>state.garden,
    SoundFX:{coinPickup(){},levelUp(){}},renderLobbyUI(){},
    executeWikiOtherItemAction(){state.wishTokens--;pulls++;}};
  state.save=()=>saves++;
  vm.runInNewContext(html.slice(start,end),context);
  button.onclick();
  return {pulls,saves};
}
const fresh=()=>({gems:50000,gold:10000,wishTokens:7,heroShards:{},gearScrolls:{},gearBag:[],garden:{seeds:{}}});
test('gold exchange charges displayed gem cost and refuses insufficient funds or unknown amounts',()=>{
  for(const [amount,cost] of [[6420,20],[64200,200],[642000,2000]]){
    const s=fresh();run('data-vn-topup-gold',String(amount),s);assert.equal(s.gems,50000-cost);assert.equal(s.gold,10000+amount);
  }
  for(const amount of ['642000','999999']){const s=fresh();s.gems=0;run('data-vn-topup-gold',amount,s);assert.equal(s.gold,10000);assert.equal(s.gems,0);}
});
test('wish buttons charge 400 gems per actual pull and preserve existing tokens',()=>{
  for(const count of [1,10,100]){const s=fresh();const result=run('data-vn-wish-pull',String(count),s);assert.equal(result.pulls,count);assert.equal(s.gems,50000-count*400);assert.equal(s.wishTokens,7);assert.equal(result.saves,1);}
  const s=fresh();s.gems=399;assert.equal(run('data-vn-wish-pull','1',s).pulls,0);assert.equal(s.wishTokens,7);
});
test('daily goods award their listed item instead of generic tokens and all scroll types',()=>{
  for(let i=1;i<=6;i++){const s=fresh();run('data-vn-daily-buy',`ds_${i}`,s);
    if(i===1)assert.equal(s.heroShards.hou_yi,3);
    if(i===2)assert.equal(s.gearBag[0].templateId,'echo_boots');
    if(i===3)assert.equal(s.wishTokens,8);else assert.equal(s.wishTokens,7);
    if(i===4)assert.equal(s.garden.seeds.sprout,5);
    if(i===5)assert.equal(s.gearScrolls.boots,2);
    if(i===6)assert.equal(s.gearScrolls.weapon,2);
    const poor=fresh();poor.gems=poor.gold=0;assert.equal(run('data-vn-daily-buy',`ds_${i}`,poor).saves,0);assert.equal(poor.wishTokens,7);assert.equal(poor.gearBag.length,0);
  }
});
