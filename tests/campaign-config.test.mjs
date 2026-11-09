import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
const url = new URL('../public/campaign-config.js', import.meta.url);
function config() {
  assert.ok(fs.existsSync(url), 'shared campaign config exists');
  const context = {};
  runInNewContext(fs.readFileSync(url, 'utf8'), context);
  return context.ArtemisCampaignConfig;
}
test('classic shared config plans 50 rooms for all 19 chapters', () => {
  const c = config();
  assert.equal(c.ROOM_COUNT, 50);
  const finals = ['golem','queen','demon_king','elder_dragon','eclipse_sovereign','astral_devourer','mycelium_queen', ...['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'].map(x=>'zodiac_'+x)];
  for (let ch=1;ch<=19;ch++) {
    const plans = Array.from({length:50},(_,i)=>c.roomPlan(ch,i+1));
    assert.deepEqual(plans.filter(x=>x.isBoss).map(x=>x.room), [10,20,30,40,50]);
    assert.deepEqual(plans.filter(x=>x.valkyrie).map(x=>x.room), [5,10,15,20,25,30,35,40,45]);
    assert.equal(c.bossType(ch,50), finals[ch-1]);
    assert.equal(new Set(plans.filter(x=>x.isBoss && !x.isFinalBoss).map(x=>x.bossType)).size,4);
    plans.forEach((p,i)=>{
      assert.equal(p.segment,Math.floor(i/10));
      assert.equal(p.type,p.isFinalBoss?'finalBoss':p.isBoss?'boss':'normal');
      assert.equal(p.bossType,p.isBoss?c.bossType(ch,p.room):null);
      assert.equal(p.count,p.isBoss?1:c.mobCount(p.room));
      assert.ok(p.count>=1 && p.count<=8);
    });
  }
});
test('absolute tuning retains original endpoint curves without mutating chapter bases', () => {
  const c = config(), base = Object.freeze({mobHp:300,mobAtk:70,bossHp:5200,bossAtk:190});
  assert.equal(typeof c.tuning,'function');
  assert.deepEqual(JSON.parse(JSON.stringify(c.tuning(base,1))),{...base,depth:0});
  assert.deepEqual(JSON.parse(JSON.stringify(c.tuning(base,50))),{mobHp:660,mobAtk:105,bossHp:7020,bossAtk:247,depth:1});
  let last = c.tuning(base,1);
  for(let room=2;room<=50;room++) {
    const now=c.tuning(base,room);
    for(const key of Object.keys(base)) assert.ok(now[key]>=last[key]);
    last=now;
  }
  assert.equal(c.mobCount(1),3);
  assert.equal(c.mobCount(49),7);
  assert.equal(c.mobCount(Infinity),7);
  assert.equal(c.roomPlan(1,-1).room,1);
  assert.equal(c.roomPlan(19,90).room,50);
  assert.equal(c.bossType(1,5),null);
  assert.deepEqual(Array.from(c.SKILL_RARITIES),['common','rare','epic','legend']);
});
