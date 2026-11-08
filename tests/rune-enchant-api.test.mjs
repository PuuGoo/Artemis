import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
process.env.NODE_ENV='test';process.env.DB_BACKEND='memory';process.env.JWT_SECRET=randomBytes(24).toString('hex');
const {POST:register}=await import('../api/auth/register.js');
const {POST:act}=await import('../api/runes.js');
const {GET:read,PUT:put}=await import('../api/save.js');
const {getMongoDb,COLLECTIONS}=await import('../lib/mongo.js');
const req=(method,path,cookie,body)=>new Request('https://artemis.test'+path,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('per-rune enchant advances six independent tiers; stale replay and forged save cannot grant it',async()=>{
 const r=await register(req('POST','/api/auth/register',null,{username:'enchant_'+randomBytes(5).toString('hex'),password:'test-password-2026'}));assert.equal(r.status,201);
 const cookie=r.headers.get('set-cookie').split(';')[0]; const get=async()=>(await read(req('GET','/api/save',cookie))).json();let s=await get();
 const db=(await getMongoDb()).collection(COLLECTIONS.saves);
 await db.updateOne({playerId:s.playerId},{$set:{data:{...s.data,runes:{sharp_arrow:6,guardian:6,echo_scythe:11},wikiOtherItems:{...s.data.wikiOtherItems,enchantium:1000}}}});
 s=await get();
 for(let level=1;level<=6;level++){
  const body={action:'enchant',runeId:'sharp_arrow',revision:s.revision};
  assert.equal((await act(req('POST','/api/runes',cookie,body))).status,200);
  const next=await get();assert.equal(next.data.runeEnchantments.sharp_arrow,level);assert.equal(next.data.runeEnchantments.guardian||0,0);
  assert.equal(next.data.wikiOtherItems.enchantium,s.data.wikiOtherItems.enchantium-10);assert.deepEqual(next.data.runes,s.data.runes);
  assert.equal((await act(req('POST','/api/runes',cookie,body))).status,409);s=next;
 }
 assert.equal((await act(req('POST','/api/runes',cookie,{action:'enchant',runeId:'sharp_arrow',revision:s.revision}))).status,422);
 for(const id of ['echo_scythe','unknown'])assert.equal((await act(req('POST','/api/runes',cookie,{action:'enchant',runeId:id,revision:s.revision}))).status,422);
 const p=await put(req('PUT','/api/save',cookie,{playerId:s.playerId,revision:s.revision,data:{...s.data,runeEnchantments:{guardian:6}}}));assert.equal(p.status,200);assert.deepEqual((await get()).data.runeEnchantments,s.data.runeEnchantments);
});
