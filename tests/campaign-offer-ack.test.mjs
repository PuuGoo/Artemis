import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('function openCampaignOffer(');
const openSource = html.slice(start, html.indexOf('\n      function spawnCampaignValkyrie(', start));
const handlerStart = html.indexOf("document.getElementById('btnRerollSkills').addEventListener('click'");
const handlerSource = html.slice(handlerStart, html.indexOf('\n      // Devil Pact Buttons', handlerStart));
const skillsSource = fs.readFileSync(new URL('../public/campaign-skills.js', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness({ seraph = false } = {}) {
  const button = { disabled: false, dataset: {}, textContent: '', addEventListener(_event, fn) { this.click = fn; } };
  const requests = [], snapshots = [], rendered = [], toasts = [];
  const c = vm.createContext({
    Game: { running: true, room: 1, runId: 'ack-run', skillClaimBusy: false, player: { hp: 100, maxHp: 100 }, runProgression: { seed: 7 } },
    ROGUE_SKILLS: Array.from({ length: 8 }, (_, i) => ({ id: `skill_${i}`, rarity: 'common' })),
    SaveState: { starterSkillIds: [], gems: 100, save() {} },
    usesCampaignTuning: () => true,
    hasHeroSkillActive: () => seraph,
    document: { getElementById: () => button },
    window: { ArtemisCloud: { enqueueCheckpoint() { return this.flushCheckpoint(); }, flushCheckpoint() {
      const snapshot = copy(c.Game.runProgression);
      return new Promise((resolve, reject) => requests.push({ snapshot, resolve, reject }));
    } } },
    saveCheckpoint() { snapshots.push(copy(c.Game.runProgression)); return true; },
    triggerSkillSelection() { rendered.push(copy(c.Game.runProgression)); },
    populateSkillChoices() { rendered.push(copy(c.Game.runProgression)); },
    showToast: text => toasts.push(text),
    SoundFX: { coinPickup() {} }
  });
  vm.runInContext(skillsSource, c);
  vm.runInContext(openSource + '\n' + handlerSource, c);
  return { c, button, requests, snapshots, rendered, toasts };
}

async function acknowledgeOpen(h) {
  assert.equal(h.c.openCampaignOffer('start'), true, 'open must keep its synchronous boolean contract');
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve(true);
  await tick();
}

for (const failure of ['false', 'throw']) {
  test(`initial offer ${failure} retries its pending payload before allowing a new reroll`, async () => {
    const h = harness();
    h.c.openCampaignOffer('start');
    const initial = copy(h.c.Game.runProgression);
    if (failure === 'throw') h.requests[0].reject(new Error('connection lost'));
    else h.requests[0].resolve(false);
    await tick();
    assert.equal(h.c.Game.skillClaimBusy, false);
    assert.equal(h.button.disabled, false, 'retry action must remain reachable');
    const retry = h.button.click();
    assert.equal(h.c.Game.skillClaimBusy, true);
    assert.deepEqual(h.requests[1].snapshot, initial);
    assert.equal(h.snapshots.length, 1, 'retry must not regenerate or resave');
    await h.button.click();
    assert.equal(h.requests.length, 2);
    h.requests[1].resolve(true);
    await retry;
    assert.deepEqual(copy(h.c.Game.runProgression), initial);
    const reroll = h.button.click();
    assert.equal(h.requests[2].snapshot.pendingOffer.rerollsUsed, 1);
    h.requests[2].resolve(true);
    await reroll;
  });

  test(`last allowed reroll ${failure} retries the exact seed and offer without spending another reroll`, async () => {
    const h = harness();
    await acknowledgeOpen(h);
    const reroll = h.button.click();
    const generated = copy(h.c.Game.runProgression);
    if (failure === 'throw') h.requests[1].reject(new Error('connection lost'));
    else h.requests[1].resolve(false);
    await reroll;
    assert.equal(h.c.Game.skillClaimBusy, false);
    assert.equal(h.button.disabled, false);
    const retry = h.button.click();
    assert.equal(h.requests.length, 3);
    assert.deepEqual(h.requests[2].snapshot, generated);
    assert.equal(h.snapshots.length, 2);
    h.requests[2].resolve(true);
    await retry;
    assert.deepEqual(copy(h.c.Game.runProgression), generated);
    assert.equal(h.c.Game.campaignOfferPendingAck, false);
    await h.button.click();
    assert.equal(h.requests.length, 3, 'exhausted reroll must not generate or flush again');
    assert.equal(h.c.Game.skillClaimBusy, false);
    assert.equal(h.button.disabled, false);
  });
}

test('reopening during acknowledgement does not replace the in-flight offer or start another flush', async () => {
  const h = harness();
  h.c.openCampaignOffer('start');
  const pending = h.c.Game.runProgression;
  assert.equal(h.c.openCampaignOffer('start'), true);
  assert.equal(h.c.Game.runProgression, pending);
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve(true);
  await tick();
  assert.equal(h.c.Game.skillClaimBusy, false);
});

test('Seraph rerolls serialize acknowledgements while rapid double clicks spend only one reroll', async () => {
  const h = harness({ seraph: true });
  await acknowledgeOpen(h);
  const first = h.button.click();
  await h.button.click();
  assert.equal(h.c.Game.runProgression.pendingOffer.rerollsUsed, 1);
  assert.equal(h.c.Game.skillClaimBusy, true);
  assert.equal(h.button.disabled, true);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve(true);
  await first;
  assert.equal(h.c.Game.skillClaimBusy, false);
  const second = h.button.click();
  assert.equal(h.requests.length, 3);
  assert.deepEqual(h.requests.map(r => r.snapshot.pendingOffer.rerollsUsed), [0, 1, 2]);
  h.requests[2].resolve(true);
  await second;
  assert.equal(h.c.Game.runProgression.pendingOffer.rerollsUsed, 2);
});

test('initial offer locks controls until cloud acknowledgement and ignores a rapid reroll', async () => {
  const h = harness();
  assert.equal(h.c.openCampaignOffer('start'), true);
  assert.equal(h.c.Game.skillClaimBusy, true);
  assert.equal(h.button.disabled, true);
  assert.equal(h.requests.length, 1);
  await h.button.click();
  assert.equal(h.c.Game.runProgression.pendingOffer.rerollsUsed, 0);
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve(true);
  await tick();
  assert.equal(h.c.Game.skillClaimBusy, false);
  assert.equal(h.button.disabled, false);
  assert.equal(h.requests[0].snapshot.pendingOffer.rerollsUsed, 0);
});
