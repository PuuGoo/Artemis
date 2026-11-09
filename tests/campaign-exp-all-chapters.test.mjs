import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c={};for(const f of ['campaign-config','campaign-rooms','campaign-exp'])vm.runInNewContext(fs.readFileSync(new URL('../public/'+f+'.js',import.meta.url),'utf8'),c);
test('every actual pressure-limited chapter reaches LV10 at rooms40–47 without granting skills',()=>{
 for(let ch=1;ch<=19;ch++){
  const p={level:1,xp:0,skills:{}};let first=null;
  for(let room=1;room<=50;room++){
   const boss=room%10===0,count=boss?1:c.ArtemisCampaignRooms.getRoster(ch,room).length;
   c.ArtemisCampaignExp.gain(p,count*(boss?8:2)*c.ArtemisCampaignExp.dropValue(boss,1));
   if(p.level===10&&first===null)first=room;
  }
  assert.ok(first>=40&&first<=47,'chapter '+ch+' reached '+first);
  assert.deepEqual(p.skills,{});assert.equal(p.level,10);
 }
});
