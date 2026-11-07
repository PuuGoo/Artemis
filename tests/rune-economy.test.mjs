import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { RUNE_IDS, runeEngravingCost } from '../lib/runeCatalog.js';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../public/rune-economy.js', import.meta.url), 'utf8'), context);
const { RuneEconomy } = context;

test('rune quality follows copies earned, with a finite Mythic cap', () => {
  assert.equal(RuneEconomy.copies(0), 0);
  assert.equal(RuneEconomy.tier(1), 'normal');
  assert.equal(RuneEconomy.tier(6), 'epic_2');
  assert.equal(RuneEconomy.tier(11), 'mythic');
  assert.equal(RuneEconomy.copies(1_000_000), 11);
  assert.equal(RuneEconomy.ownedRunes({ a:0, b:1, c:5 }), 2);
});

test('engraving cost grows with gear progression and collection size', () => {
  assert.equal(RuneEconomy.engravingCost(1,0), 300);
  assert.ok(RuneEconomy.engravingCost(20,20) > RuneEconomy.engravingCost(1,0));
  assert.ok(RuneEconomy.engravingCost(100,46) <= 4500);
  for (const gearLevel of [1,5,20,100]) for (const owned of [0,9,20,46]) {
    assert.equal(RuneEconomy.engravingCost(gearLevel,owned),runeEngravingCost(gearLevel,owned));
  }
});

test('wiki image mapping covers every referenced stone and has a fallback for Echo Scythe', () => {
  const imageContext = vm.createContext({ window:{} });
  vm.runInContext(readFileSync(new URL('../public/rune-wiki-images.js', import.meta.url),'utf8'),imageContext);
  const images = imageContext.window.RuneWikiImages;
  assert.equal(Object.keys(images).length,45);
  assert.ok(RUNE_IDS.every(id => images[id] || id==='echo_scythe'));
  assert.ok(Object.values(images).every(url => url.startsWith('https://img-archero-2.game-vault.net/')));
});
