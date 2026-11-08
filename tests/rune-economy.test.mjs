import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import * as catalog from '../lib/runeCatalog.js';
const { RUNE_IDS, RUNE_TIERS, addRuneDrop } = catalog;

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../public/rune-economy.js', import.meta.url), 'utf8'), context);
const { RuneEconomy } = context;

test('rune quality follows the highest merged tier, with a finite Mythic cap', () => {
  assert.equal(RuneEconomy.copies(0), 0);
  assert.equal(RuneEconomy.tier(1), 'normal');
  assert.equal(RuneEconomy.tier(6), 'epic_2');
  assert.equal(RuneEconomy.tier(11), 'mythic');
  assert.equal(RuneEconomy.copies(1_000_000), 11);
  assert.equal(RuneEconomy.ownedRunes({ a:0, b:1, c:5 }), 2);
});

test('all 46 runes have individual wiki attributes and Revive milestones', () => {
  const wikiContext=vm.createContext({window:{}});
  vm.runInContext(readFileSync(new URL('../public/rune-wiki-data.js',import.meta.url),'utf8'),wikiContext);
  const data=wikiContext.window.RuneWikiData;
  assert.equal(Object.keys(data).length,46);
  assert.ok(RUNE_IDS.every(id=>data[id]?.base));
  assert.match(data.rune_valkyrie.effects.Epic,/50% Chance to revive/);
  assert.match(data.rune_valkyrie.effects.Mythic,/100% Chance to revive/);
});

test('drops remain separate until the player merges three identical stones', () => {
  let stones={}, ranks={};
  for(let i=0;i<3;i++) ({stones,ranks}=addRuneDrop(stones,ranks,'rune_valkyrie',0));
  assert.equal(ranks.rune_valkyrie,1);
  assert.equal(stones.rune_valkyrie.normal,3);
  const merged = catalog.mergeRuneStones(stones, ranks, 'rune_valkyrie', 'normal');
  assert.equal(merged.rank,2);
  assert.equal(merged.stones.rune_valkyrie.normal,0);
  assert.equal(merged.stones.rune_valkyrie.fine,1);
  assert.equal(stones.rune_valkyrie.normal,3);
  assert.equal(RUNE_TIERS.length,11);
});

test('user-labelled local icons preserve duplicate Fury names without inventing Arrow Rain', () => {
  const imageContext = vm.createContext({ window:{} });
  vm.runInContext(readFileSync(new URL('../public/rune-wiki-images.js', import.meta.url),'utf8'),imageContext);
  const images = imageContext.window.RuneWikiImages;
  assert.equal(Object.keys(images).length,44);
  assert.equal(Object.keys(imageContext.window.RuneImageManifest).length,45);
  assert.ok(RUNE_IDS.every(id => images[id] || ['echo_scythe','arrow_rain'].includes(id)));
  assert.ok(Object.values(images).every(url => url.startsWith('assets/runes/') && existsSync(new URL('../public/' + url, import.meta.url))));
  const variants = Object.values(imageContext.window.RuneImageManifest).filter(x => x.id === 'star_of_fury');
  assert.equal(variants.length,2);
  assert.notEqual(variants[0].asset,variants[1].asset);
  assert.equal(images.arrow_rain,undefined);
});

test('wiki retains empty tier cells and includes specific and shared enchantment tables', () => {
  const c = vm.createContext({window:{}});
  vm.runInContext(readFileSync(new URL('../public/rune-wiki-data.js',import.meta.url),'utf8'),c);
  const d = c.window.RuneWikiData;
  assert.equal(d.rune_valkyrie.effects.Normal,'');
  assert.equal(d.rune_valkyrie.effects.Rare,'Max HP +240');
  assert.match(d.rune_valkyrie.enchantments.Mythic,/ATK SPD/);
  assert.match(d.sharp_arrow.sharedEnchantments.Mythic,/CRIT DMG/);
  assert.equal(c.window.RuneWikiSource.snapshotDate,'2026-03-16');
  for (const r of Object.values(d)) {
    assert.ok(r.name && r.base && r.effects.Mythic);
    if (r.type !== 'Etched') {
      assert.equal(Object.keys(r.enchantments).length,6);
      assert.equal(Object.keys(r.sharedEnchantments).length,6);
    }
  }
});
