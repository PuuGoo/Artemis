import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { RUNE_IDS } from '../lib/runeCatalog.js';

process.env.NODE_ENV='test';
process.env.DB_BACKEND='memory';
process.env.JWT_SECRET=randomBytes(24).toString('hex');
const { POST:register } = await import('../api/auth/register.js');
const { POST:engrave } = await import('../api/runes.js');
const { GET:getSave,PUT:putSave } = await import('../api/save.js');

function request(method,path,cookie,body) {
  return new Request(`https://artemis.test${path}`,{ method,headers:{ 'content-type':'application/json',...(cookie?{cookie}:{}) },...(body===undefined?{}:{body:JSON.stringify(body)}) });
}

test('engraving spends server gold, grants one known rune, and save cannot mint runes', async()=>{
  const name=`rune_${randomBytes(4).toString('hex')}`;
  const registered=await register(request('POST','/api/auth/register',null,{ username:name,password:'rune-test-password-2026' }));
  assert.equal(registered.status,201);
  const cookie=registered.headers.get('set-cookie').split(';')[0];
  const before=await (await getSave(request('GET','/api/save',cookie))).json();
  assert.equal((await engrave(request('POST','/api/runes',null))).status,401);
  const purchase=await engrave(request('POST','/api/runes',cookie));
  assert.equal(purchase.status,200);
  const result=await purchase.json();
  assert.ok(RUNE_IDS.includes(result.runeId));
  assert.equal(result.rank,1);
  assert.equal(result.gold,200);
  assert.equal((await engrave(request('POST','/api/runes',cookie))).status,422);
  assert.equal((await engrave(request('POST','/api/runes',cookie,{ action:'enchant' }))).status,422);

  const saved=await (await getSave(request('GET','/api/save',cookie))).json();
  const forged=await putSave(request('PUT','/api/save',cookie,{
    playerId:before.playerId,revision:saved.revision,
    data:{ ...saved.data,runeMythicEnchant:true,runes:{ ...saved.data.runes,[result.runeId]:11,arrow_of_echoes:11 },
      equippedRuneSlots:{ etched:['arrow_of_echoes'],blessing:[],enhancement:[],ability:[] } },
  }));
  assert.equal(forged.status,200);
  const after=await (await getSave(request('GET','/api/save',cookie))).json();
  assert.equal(after.data.runes[result.runeId],1);
  assert.equal(after.data.runeMythicEnchant,false);
  assert.equal(after.data.runes.arrow_of_echoes || 0,result.runeId==='arrow_of_echoes'?1:0);
  if (result.runeId!=='arrow_of_echoes') assert.deepEqual(after.data.equippedRuneSlots.etched,[null]);
});
