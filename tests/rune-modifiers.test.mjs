import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c={window:{}};vm.runInNewContext(fs.readFileSync('public/rune-wiki-data.js','utf8'),c);
const path='public/js/game/runes/rune-modifiers.js';if(fs.existsSync(path))vm.runInNewContext(fs.readFileSync(path,'utf8'),c);
const state=(id,rank,level)=>({runes:{[id]:rank},runeEnchantments:{[id]:level},equippedRuneSlots:{enhancement:[id],ability:[],blessing:[],etched:[]}});
test('typed modifiers do not turn weapon damage into generic ATK or meteor/plant damage',()=>{
 assert.ok(c.window.ArtemisRuneModifiers,'missing production modifiers');const M=c.window.ArtemisRuneModifiers;
 const s=state('sharp_arrow',7,5);const w=M.damage(s,c.window.RuneWikiData,'weapon',{hp:100,maxHp:100},{});const m=M.damage(s,c.window.RuneWikiData,'meteor',{},{});
 assert.equal(w.flat,15);assert.equal(w.pct,0.35);assert.equal(w.critRate,0.15);assert.equal(w.bossPct,0.075);assert.equal(m.flat,0);assert.equal(m.pct,0);
 assert.equal(M.stats(s,c.window.RuneWikiData).atk,0);
 assert.match(fs.readFileSync('public/js/game/runes/rune-workspace.js','utf8'), /data-rune-enchant=/);
 assert.match(fs.readFileSync('public/cloud.js','utf8'), /enchantRune/);
 assert.equal(M.bounces(s,'sharp_arrow'),2);
 const a=state('arrow_rain',6,4);a.equippedRuneSlots={ability:['arrow_rain']};assert.equal(M.defense(a,c.window.RuneWikiData,{isBoss:true},{}).reduction,.02);
 s.equippedRuneSlots.enhancement=[];assert.equal(M.damage(s,c.window.RuneWikiData,'weapon',{},{}).pct,0);
});
test('generic elemental bonuses are applied once without duplicating shared crit damage',()=>{
 const M=c.window.ArtemisRuneModifiers;
 const s=state('rune_flame',7,5),e={hp:40,maxHp:100};
 const fire=M.damage(s,c.window.RuneWikiData,'fire',e,{});
 assert.equal(fire.critDmg,.15);
});
test('wrong category cannot apply damage or enchant bonuses',()=>{
 const M=c.window.ArtemisRuneModifiers,s=state('rune_flame',11,6);
 s.equippedRuneSlots={ability:['rune_flame']};
 assert.equal(M.damage(s,c.window.RuneWikiData,'fire',{hp:100,maxHp:100},{}).flat,0);
 assert.equal(M.stats(s,c.window.RuneWikiData).atk,0);
});
