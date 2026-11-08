import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { sanitizeSave } from '../../lib/save/schema.js';
import { validateSeasonDelta } from '../../lib/economy.js';
const html=readFileSync(new URL('../../public/index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const start=html.indexOf('save() {\n          // ==================== KHOA GHI');
const end=html.indexOf('\n      };\n      /**',start);
assert.ok(start>=0&&end>start);
const writer=html.slice(start,end);
function write(state){
 const window={__ARTEMIS_SAVE_READY:true,dispatchEvent(){}};
 const save=runInNewContext('({'+writer+'}).save',{window,console,CustomEvent:class {}});
 save.call(state);
 return JSON.parse(window.__ARTEMIS_SAVE_BUFFER);
}
test('Writer thật giữ season cũ qua serialize/sanitize mà không reset token/sacrifice',()=>{
 const raw={gold:9000000,gems:9000,season:{season:1,career:'ranger',tokens:120,boss:null,bossHp:0,bossMaxHp:0,bossDefeated:false,powerSacrificed:0.04,log:[{t:1790000000000,text:'Phần thưởng hợp lệ đã có'}]}};
 const previous=sanitizeSave(raw).data;
 const serialized=write(previous);
 assert.deepEqual(serialized.season,previous.season);
 const restored=sanitizeSave(serialized).data;
 assert.deepEqual(restored.season,previous.season);
 assert.equal(restored.gold,previous.gold);
 assert.equal(restored.gems,previous.gems);
 assert.equal(validateSeasonDelta(previous,restored).ok,true);
});
test('Writer không tự seed season khi save legacy chưa có field',()=>{
 const payload=write({gold:500,gems:50});
 assert.equal(Object.hasOwn(payload,'season'),false);
});
