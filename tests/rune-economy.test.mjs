import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { RUNE_IDS, RUNE_TIERS, addRuneDrop } from '../lib/runeCatalog.js';

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

test('three same-quality stones merge into one next-quality stone', () => {
  let stones={}, ranks={};
  for(let i=0;i<3;i++) ({stones,ranks}=addRuneDrop(stones,ranks,'rune_valkyrie',0));
  assert.equal(ranks.rune_valkyrie,2);
  assert.equal(stones.rune_valkyrie.normal,0);
  assert.equal(stones.rune_valkyrie.fine,1);
  for(let i=0;i<2;i++) ({stones,ranks}=addRuneDrop(stones,ranks,'rune_valkyrie',1));
  assert.equal(ranks.rune_valkyrie,3);
  assert.equal(stones.rune_valkyrie.rare,1);
  ({stones,ranks}=addRuneDrop(stones,ranks,'rune_valkyrie',3));
  assert.equal(ranks.rune_valkyrie,4);
  assert.equal(RUNE_TIERS.length,11);
});

test('wiki image mapping covers every referenced stone and has a fallback for Echo Scythe', () => {
  const imageContext = vm.createContext({ window:{} });
  vm.runInContext(readFileSync(new URL('../public/rune-wiki-images.js', import.meta.url),'utf8'),imageContext);
  const images = imageContext.window.RuneWikiImages;
  assert.equal(Object.keys(images).length,45);
  assert.ok(RUNE_IDS.every(id => images[id] || id==='echo_scythe'));
  assert.ok(Object.values(images).every(url => url.startsWith('https://img-archero-2.game-vault.net/')));
});
