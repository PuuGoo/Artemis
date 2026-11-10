import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf("document.querySelectorAll('.skill-choice-card').forEach(btn => {");
const source = html.slice(start, html.indexOf('\n      function applyRogueSkill(', start)).replace(/\n      }\s*$/, '');
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness({ flush = async () => true } = {}) {
  let acknowledge;
  const ack = new Promise(resolve => { acknowledge = resolve; });
  const cards = ['first', 'second'].map(id => ({
    dataset: { skillId: id }, attrs: {}, status: { textContent: '' },
    getAttribute(name) { return name === 'data-skill-id' ? id : this.attrs[name]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    querySelector() { return this.status; },
    addEventListener(_event, handler) { this.click = handler; }
  }));
  const modal = { classList: { add() { modal.hidden = true; } } };
  const Game = { runId: 'run', runProgression: {}, player: {}, paused: true,
    skillClaimBusy: true, campaignOfferPendingAck: true, campaignOfferAckPromise: ack };
  let grants = 0, flushes = 0;
  const context = vm.createContext({ Game, document: {
    querySelectorAll: () => cards, getElementById: () => modal
  }, window: { ArtemisCloud: { async flushCheckpoint() { flushes++; return flush(); } } },
  usesCampaignTuning: () => true, applyRogueSkill() { grants++; return true; },
  showToast() {}, performance: { now: () => 1 }, updateInGameHUD() {} });
  vm.runInContext(source, context);
  return {Game,cards,modal,acknowledge,grants:()=>grants,flushes:()=>flushes};
}

test('one click during offer acknowledgement queues immediately instead of disappearing', async () => {
  const h = harness();
  const click = h.cards[0].click();
  assert.equal(h.cards[0].dataset.claimBusy, '1');
  assert.equal(h.cards[0].attrs['aria-busy'], 'true');
  assert.equal(h.grants(), 0);
  await h.cards[1].click();
  await h.cards[0].click();
  h.Game.skillClaimBusy = false;
  h.Game.campaignOfferPendingAck = false;
  h.acknowledge(true);
  await click;
  assert.equal(h.grants(), 1);
  assert.equal(h.modal.hidden, true);
  assert.equal(h.Game.paused, false);
  assert.equal(h.cards[0].attrs['aria-busy'], undefined);
  assert.equal(h.flushes(), 1, 'reuse the acknowledged offer; only flush the claim');
});

test('failed queued offer stays paused and retry grants once', async () => {
  let online = false;
  const h = harness({ flush: async () => online });
  const click = h.cards[0].click();
  h.acknowledge(false);
  await click;
  assert.equal(h.grants(), 0);
  assert.equal(h.Game.paused, true);
  assert.equal(h.Game.skillClaimBusy, false);
  online = true;
  await h.cards[0].click();
  assert.equal(h.grants(), 1);
  assert.equal(h.modal.hidden, true);
});

test('failed claim acknowledgement retries the same skill without granting twice', async () => {
  let online = false;
  const h = harness({ flush: async () => online });
  const click = h.cards[0].click();
  h.acknowledge(true);
  await click;
  assert.equal(h.grants(), 1);
  assert.equal(h.Game.paused, true);
  assert.equal(h.Game.pendingClaimId, 'first');
  await h.cards[1].click();
  assert.equal(h.grants(), 1);
  online = true;
  await h.cards[0].click();
  assert.equal(h.grants(), 1);
  assert.equal(h.modal.hidden, true);
});

test('queued click cannot grant into a replacement run', async () => {
  const h = harness();
  const click = h.cards[0].click();
  h.Game.runId = 'new-run';
  h.acknowledge(true);
  await click;
  assert.equal(h.grants(), 0);
  assert.equal(h.modal.hidden, undefined);
});
