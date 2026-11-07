import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/saveSchema.js';

test('rune board keeps chosen socket positions across cloud save round trips', () => {
  const input = {
    equippedRuneSlots: {
      etched: [null, 'echo_scythe', 'arrow_of_echoes'],
      blessing: ['rune_valkyrie', null],
      enhancement: [null, null, 'sharp_arrow'],
      ability: ['arrow_rain'],
    },
    runeQualityTier: 'legendary_2',
    runeMythicEnchant: false,
  };
  const saved = sanitizeSave(input);
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.data.equippedRuneSlots, input.equippedRuneSlots);
  assert.equal(saved.data.runeQualityTier, 'legendary_2');
  assert.equal(saved.data.runeMythicEnchant, false);
  const again = sanitizeSave(saved.data);
  assert.deepEqual(again.data.equippedRuneSlots, input.equippedRuneSlots);
});

test('rune board rejects wrong categories, duplicate runes, and extra sockets', () => {
  const data = sanitizeSave({
    equippedRuneSlots: {
      etched: ['echo_scythe', 'echo_scythe', 'sharp_arrow', 'arrow_of_echoes'],
      blessing: ['rune_valkyrie', 'unknown', 'rabbits_foot'],
      enhancement: ['sharp_arrow', 'rune_flame', 'rune_frost', 'dragonflight_sword', 'rootguard'],
      ability: ['arrow_rain', 'rune_thunder', 'ability_circle', 'healing_sprite', 'melee_sprite'],
    },
    runeQualityTier: 'admin',
  }).data;
  assert.deepEqual(data.equippedRuneSlots.etched, ['echo_scythe', null, null]);
  assert.deepEqual(data.equippedRuneSlots.blessing, ['rune_valkyrie', null]);
  assert.deepEqual(data.equippedRuneSlots.enhancement, ['sharp_arrow', 'rune_flame', 'rune_frost', 'dragonflight_sword']);
  assert.deepEqual(data.equippedRuneSlots.ability, ['arrow_rain', 'rune_thunder', 'ability_circle', 'healing_sprite']);
  assert.equal(data.runeQualityTier, 'mythic');
});
