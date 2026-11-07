import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/saveSchema.js';

test('artifact stars and wish progress survive cloud save round trips', () => {
  const input = { artifactStars: { gladiators_helm: 1, iron_throne: 6, four_leaf_clover: 15 }, wishPityCount: 32 };
  const saved = sanitizeSave(input);
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.data.artifactStars, input.artifactStars);
  assert.equal(saved.data.wishPityCount, 32);
  const reloaded = sanitizeSave(saved.data);
  assert.deepEqual(reloaded.data.artifactStars, input.artifactStars);
  assert.equal(reloaded.data.wishPityCount, 32);
});

test('artifact stars accept only catalog IDs and 0–15 stars', () => {
  const data = sanitizeSave({ artifactStars: { gladiators_helm: 100, iron_throne: -5, hacked_artifact: 15 }, wishPityCount: 500 }).data;
  assert.deepEqual(data.artifactStars, { gladiators_helm: 15, iron_throne: 0 });
  assert.equal(data.wishPityCount, 99);
});
