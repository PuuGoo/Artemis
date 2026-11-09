// Hồi quy harness: đọc đúng callback production, không cần Chrome/DB.
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../tools/verify-hero-ui-browser.mjs', import.meta.url), 'utf8');
const start = source.indexOf('  await page.waitForFunction(', source.indexOf("for (const key of ['pet'"));
const end = source.indexOf('\n  const persisted =', start);
assert.ok(start > 0 && end > start);
async function verdict({dirty=false, saving=false, star=1}={}) {
 let result;
 const context = {
  page:{waitForFunction:async (fn,arg)=>{result=await fn(arg);}}, after:{star:1}, result:{},
  window:{ArtemisCloud:{getState:()=>({dirty,saving})}, Archero2FusionAPI:{SaveState:{heroStars:{alex:star}}}},
  fetch:async()=>({json:async()=>({data:{heroStars:{alex:star}}})}),
 };
 await vm.runInNewContext(`(async()=>{${source.slice(start,end)}})()`,context);
 return result;
}
test('cloud evidence cannot finish before debounce or while request is in flight',async()=>{
 assert.equal(await verdict({dirty:true}),false);
 assert.equal(await verdict({saving:true}),false);
});
test('cloud evidence cannot pass when server rejection reloads the old star',async()=>{
 assert.equal(await verdict({star:0}),false);
 assert.equal(await verdict(),true);
});
