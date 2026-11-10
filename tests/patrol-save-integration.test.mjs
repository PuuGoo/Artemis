import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/save/schema.js';
import { prepareSaveData, validateSaveTransition } from '../lib/save/policy.js';
import { buildCanonicalNewAccountSave } from '../lib/save/initialState.js';

test('ordinary client saves cannot forge or erase server patrol EXP', () => {
  const raw = buildCanonicalNewAccountSave({playerId:'patrol_policy',username:'fixture'}).data;
  raw.patrolExp = 999999;
  const clean = sanitizeSave(raw);
  assert.equal(clean.ok,true);
  const previous = {...raw, patrolExp:123};
  const prepared = prepareSaveData({sanitizedData:clean.data,incomingData:raw,previousData:previous,nowMs:Date.now()});
  assert.equal(prepared.patrolExp,123);
  assert.equal(previous.patrolExp,123);
});

test('ordinary save retains server patrol ledger and request receipts', () => {
  const now=Date.now();
  const doc=buildCanonicalNewAccountSave({playerId:'patrol_ledger',username:'fixture'});
  const patrol={startedAt:now-3600000,claims:[],quickEnergyUsed:1};
  const previous={...doc,ledger:{...doc.ledger,patrol}};
  const result=validateSaveTransition({previous,data:structuredClone(doc.data),nowMs:now});
  assert.equal(result.ok,true);
  assert.deepEqual(result.ledger.patrol,patrol);
  assert.notEqual(result.ledger.patrol,patrol);
});
