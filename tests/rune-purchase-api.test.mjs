import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { RUNE_IDS } from '../lib/runeCatalog.js';

process.env.NODE_ENV='test';
process.env.DB_BACKEND='memory';
process.env.JWT_SECRET=randomBytes(24).toString('hex');
const adminName=`runeadmin_${randomBytes(4).toString('hex')}`;
process.env.ADMIN_USERNAMES=adminName;
const { POST:register } = await import('../api/auth/register.js');
const { PATCH:grant } = await import('../api/admin/players.js');
const { POST:explore } = await import('../api/runes.js');
const { GET:getSave,PUT:putSave } = await import('../api/save.js');

function request(method,path,cookie,body) {
  return new Request(`https://artemis.test${path}`,{ method,headers:{ 'content-type':'application/json',...(cookie?{cookie}:{}) },...(body===undefined?{}:{body:JSON.stringify(body)}) });
}
async function account(name) {
  const response=await register(request('POST','/api/auth/register',null,{username:name,password:'rune-test-password-2026'}));
  assert.equal(response.status,201);
  return response.headers.get('set-cookie').split(';')[0];
}

test('runes only come from server-validated exploration, with one free intro dig', async()=>{
  const admin=await account(adminName);
  const cookie=await account(`rune_${randomBytes(4).toString('hex')}`);
  const before=await (await getSave(request('GET','/api/save',cookie))).json();
  assert.equal((await explore(request('POST','/api/runes',null,{action:'explore'}))).status,401);
  assert.equal((await explore(request('POST','/api/runes',cookie,{action:'engrave'}))).status,400);
  const first=await explore(request('POST','/api/runes',cookie,{action:'explore',count:1}));
  assert.equal(first.status,200);
  const reward=await first.json();
  assert.equal(reward.freeIntro,true);
  assert.equal(reward.gemCost,0);
  assert.ok(RUNE_IDS.includes(reward.drops[0].runeId));
  let saved=await (await getSave(request('GET','/api/save',cookie))).json();
  assert.equal(saved.data.gold,500);
  assert.equal(saved.data.runeIntroClaimed,true);
  assert.ok(saved.data.runes[reward.drops[0].runeId]>=1);
  assert.equal((await explore(request('POST','/api/runes',cookie,{action:'explore',count:1}))).status,422);
  assert.equal((await explore(request('POST','/api/runes',cookie,{action:'enchant'}))).status,400);

  const forged=await putSave(request('PUT','/api/save',cookie,{
    playerId:before.playerId,revision:saved.revision,
    data:{...saved.data,runeIntroClaimed:false,runeMythicEnchant:true,runes:{arrow_of_echoes:11},runeStones:{arrow_of_echoes:{mythic:99}},equippedRuneSlots:{etched:['arrow_of_echoes'],blessing:[],enhancement:[],ability:[]}},
  }));
  assert.equal(forged.status,200);
  saved=await (await getSave(request('GET','/api/save',cookie))).json();
  assert.equal(saved.data.runeIntroClaimed,true);
  assert.equal(saved.data.runeMythicEnchant,false);
  assert.equal(saved.data.runes.arrow_of_echoes||0,reward.drops[0].runeId==='arrow_of_echoes'?saved.data.runes.arrow_of_echoes:0);
  assert.equal(saved.data.runeStones.arrow_of_echoes?.mythic||0,0);
  const granted=await grant(request('PATCH','/api/admin/players',admin,{playerId:before.playerId,action:'grant',payload:{gems:200}}));
  assert.equal(granted.status,200);
  const paid=await explore(request('POST','/api/runes',cookie,{action:'explore',count:1}));
  assert.equal(paid.status,200);
  assert.equal((await paid.json()).gemCost,120);
});
