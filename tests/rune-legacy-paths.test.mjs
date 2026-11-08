import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('public/index.html','utf8').replace(/\r\n/g,'\n');
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('\n      }',a);assert.ok(a>=0&&b>a);return html.slice(a,b+8);}
function cost({rank=6,level=0,legacy=false,equipped=true}={}){
 const c={Game:{player:{maxHp:1000}},SaveState:{runes:{devil_pact:rank},runeEnchantments:{devil_pact:level},runeMythicEnchant:legacy},hasHeroSkillActive:()=>false,runeHasEffect:(_,min=4)=>equipped&&rank>=min,RuneEconomy:{copies:x=>x},window:{}};
 vm.runInNewContext(fs.readFileSync('public/js/game/runes/rune-modifiers.js','utf8'),c);
 vm.runInNewContext(fn('computeDevilCost'),c);return c.computeDevilCost('legend');
}
test('Devil Pact per-rune Legendary enchant charges HP, never permanently reduces max HP',()=>{
 const x=cost({level:5});assert.equal(x.directHp,true);assert.equal(x.pct,22.5);assert.equal(x.costHp,225);
 assert.equal(cost({rank:11,level:6}).pct,15);
 assert.equal(cost({level:4}).directHp,false);
 assert.equal(cost({level:6,equipped:false}).directHp,false);
});
test('paid legacy Devil Pact exemption remains valid but grants nothing to unequipped runes',()=>{
 assert.equal(cost({legacy:true}).pct,0);assert.equal(cost({legacy:true,equipped:false}).pct,30);
 assert.match(fn('computeTotalEquippedRunesStats'),/const enchantOn = SaveState\.runeMythicEnchant === true/);
});
test('Enchantium item opens actual rune chooser, never sends an identifier-free purchase',()=>{
 const a=html.indexOf("if (itemId === 'enchantium')"),b=html.indexOf("if (itemId === 'gold_cave_ticket')",a),body=html.slice(a,b);
 assert.ok(a>=0&&b>a);assert.doesNotMatch(body,/fetch\(/);assert.match(body,/tabRunes/);assert.match(body,/showToast/);
});
