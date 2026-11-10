import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const wheelSource = fs.readFileSync(new URL('../public/campaign-wheel.js', import.meta.url), 'utf8');
function section(from, to) {
  const start = html.indexOf(from);
  assert.notEqual(start, -1, from);
  const end = html.indexOf(to, start + from.length);
  assert.notEqual(end, -1, to);
  return html.slice(start, end);
}
function harness(extra = {}, rolls = [0.5]) {
  const reveals = [], events = [], timers = [], buttons = {};
  const math = Object.create(Math);
  let randomCalls = 0;
  math.random = () => rolls[(randomCalls++) % rolls.length];
  const ev = {};
  const SaveState = { gold: 10000, gems: 1000, stamina: 10, wishTokens: 100, artifactStars: {}, gearBag: [], chestKeys: {}, wikiOtherItems: {}, save() { events.push('save'); } };
  const ctx = vm.createContext({ Math: math, ev, SaveState,
    window: { ArtemisRewardResults: { show(result) { events.push('reveal'); reveals.push(result); } } },
    document: { getElementById(id) { return buttons[id] ||= {}; } },
    SoundFX: { levelUp() {}, coinPickup() {} }, StageHeroAnim: { triggerPose() {} },
    showToast() {}, renderLobbyUI() {}, renderWikiEventsHubUI() {},
    setTimeout(fn) { timers.push(fn); },
    WIKI_GEAR_SCROLLS_META: Object.fromEntries(['weapon', 'armor', 'ring', 'helmet', 'boots', 'amulet'].map(slot => [slot, { slot, name: `${slot} Scroll`, icon: '📜' }])),
    ...extra,
  });
  return { ctx, ev, SaveState, reveals, events, timers, buttons, run: code => vm.runInContext(code, ctx), randomCalls: () => randomCalls };
}
function button(h, from, to, id) { h.run(section(from, to)); return h.buttons[id].onclick; }
function assertSaved(h) { assert.equal(h.events.at(-1), 'reveal'); assert.ok(h.events.indexOf('save') < h.events.indexOf('reveal')); }

test('Demon ×10 captures every actual outcome, including key/shovel and pity, without extra RNG or debit', () => {
  const h = harness({}, [0.0001, .005, .02, .05, .10, .15, .25, .50, .50, .50]);
  Object.assign(h.ev, { demonSummonTickets: 10, demonLuckMeter: 0 });
  h.run(section('        const doDemonSpins =', '        const btnDkSpin1') + '\nglobalThis.act = doDemonSpins;');
  h.ctx.act(10);
  assert.equal(h.ev.demonSummonTickets, 0);
  assert.equal(h.ev.demonTotalSpins, 10);
  assert.equal(h.ev.eonCores, 1);
  assert.equal(h.ev.clashBadges, 1330);
  assert.equal(h.SaveState.chestKeys.chromatic_chest_key, 1);
  assert.equal(h.SaveState.wikiOtherItems.promised_relic_shovel, 1);
  assert.deepEqual(Array.from(h.reveals[0].rewards, r => r.amount), [1, 800, 360, 75, 1, 1, 35, 20, 20, 20]);
  assert.equal(h.randomCalls(), 10);
  assertSaved(h);
  const before = JSON.stringify(h.SaveState);
  assert.equal(JSON.stringify(h.SaveState), before, 'presentation does not award');
  h.ev.demonLuckMeter = 199;
  h.ev.demonSummonTickets = 1;
  h.ctx.act(1);
  assert.equal(h.reveals[1].rewards[0].name, 'Eon Core');
  assert.equal(h.ev.demonLuckMeter, 0);
});

function plinko(h) {
  h.run("const PLINKO_ROWS=8, PLINKO_BINS=9, PLINKO_MULTS=[10,5,2,1,.5,1,2,5,10], PLINKO_BETS=[100,200], PLINKO_BATCH_SAVE_EVERY=5, PLINKO_BATCH_GAP=60; let plinkoFx={pending:0};");
  for (const name of ['ensurePlinko', 'plinkoDropPath', 'plinkoPlay']) h.run(section(`      function ${name}(`, '\n      }') + '\n      }');
}
test('Plinko single settles exact path once; insufficient gold reveals nothing', () => {
  const h = harness({}, [.1]); plinko(h);
  const result = h.ctx.plinkoPlay(200);
  assert.equal(result.win, 2000);
  assert.equal(h.SaveState.gold, 11800);
  assert.equal(h.reveals[0].rewards[0].amount, result.win);
  assert.equal(h.randomCalls(), 8);
  assertSaved(h);
  h.SaveState.gold = 0;
  assert.equal(h.ctx.plinkoPlay(200), null);
  assert.equal(h.reveals.length, 1);
});
for (const stopMode of ['complete', 'stop', 'leave', 'insufficient']) test(`Plinko batch ${stopMode}: one reveal of all and only settled balls`, () => {
  const h = harness({ plinkoBatchRunning() { return false; }, plinkoBatchRender() {}, plinkoRefreshMeta() {}, plinkoFxSpawn() { return false; }, plinkoBatchOnLand() {} }, [.5]);
  plinko(h);
  h.run(section('      function plinkoStartBatch(', '\n      function plinkoFxFrame'));
  h.ctx.plinkoStartBatch(200);
  if (stopMode === 'stop') h.run('plinkoFx.batch.stop=true;');
  if (stopMode === 'leave') h.run('plinkoFx=null;');
  if (stopMode === 'insufficient') h.SaveState.gold = 0;
  while (h.timers.length) h.timers.shift()();
  const count = stopMode === 'complete' ? 200 : 1;
  assert.equal(h.SaveState.plinko.balls, count);
  assert.equal(h.reveals.length, 1);
  assert.equal(h.reveals[0].rewards.length, count);
  assert.equal(h.randomCalls(), count * 8);
  assertSaved(h);
});

test('Artifact legacy wish reveals only actual star deltas, never fake ten drops or cap overflow', () => {
  const arts = [{ id: 'a', wikiName: 'Artifact A', rarity: 'epic', icon: '🏺' }];
  const h = harness({ ARTIFACTS_DATA: arts, renderArtifactIcon() { return '<svg></svg>'; } });
  h.ctx.getArtifactStarMap = () => h.SaveState.artifactStars;
  const act = button(h, "        const wishBtn = document.getElementById('btnWishPull10');", '        const maxAllArtBtn', 'btnWishPull10');
  h.SaveState.artifactStars.a = 13;
  act();
  assert.equal(h.SaveState.artifactStars.a, 15);
  assert.equal(h.reveals[0].rewards.length, 2);
  assert.equal(h.randomCalls(), 3);
  assertSaved(h);
  act();
  assert.equal(h.reveals.length, 1, 'max-star no-op must not claim more stars');
});

test('Treasure Island includes wrap-around bonus and exact multiplier rewards', () => {
  const h = harness({}, [.99]);
  Object.assign(h.ev, { islandDiceMultiplier: 5, monopolyPos: 18 }); h.SaveState.wikiOtherItems.dice = 5;
  const act = button(h, "        const btnIslRoll = document.getElementById('btnIslandRollDice');", "        container.querySelectorAll('[data-claim-island-task]')", 'btnIslandRollDice');
  act();
  assert.equal(h.SaveState.wikiOtherItems.dice, 0);
  assert.equal(h.ev.monopolyPos, 4);
  assert.equal(h.ev.treasureCoins, 15);
  assert.deepEqual(Array.from(h.reveals[0].rewards, r => r.amount), [4150, 15, 200]);
  assert.equal(h.randomCalls(), 1);
  assertSaved(h);
});

test('Gold Cave reveals only final credited capped escrow, not intermediate bags; cashout is idempotent', () => {
  const h = harness();
  h.ctx.grantAll6GearScrolls = count => { h.ctx.scrollGrant = count; };
  h.ev.goldCaveRun = { difficulty: 2, wave: 10, gold: 27000, scrolls: 30 };
  h.run(section('        const finishGoldCaveRun =', "        const btnGcWave =") );
  h.buttons.btnGoldCaveCashout.onclick();
  assert.equal(h.SaveState.gold, 35000);
  assert.equal(h.ctx.scrollGrant, 24);
  assert.deepEqual(Array.from(h.reveals[0].rewards, r => r.amount), [25000, 24, 24, 24, 24, 24, 24]);
  assert.equal(h.ev.goldCaveRun, null);
  assertSaved(h);
  h.buttons.btnGoldCaveCashout.onclick();
  assert.equal(h.reveals.length, 1);
  assert.ok(!section("        container.querySelectorAll('[data-goldcave-choice]')", "        const btnGcSweep").includes('ArtemisRewardResults'));
});

test('Fishing reel shows settled original fish tickets, not the next RNG fish', () => {
  const h = harness({ WIKI_FISHING_ZONES_META: [{ id: 'z', rareCount: 2, epicCount: 1, legCount: 1 }], spawnHookedFishFromPool() { h.ev.fishingHookedFish = { name: 'Next Fish' }; } });
  Object.assign(h.ev, { fishingZoneId: 'z', fishingPools: { z: { rare: 2, epic: 1, leg: 1 } }, fishingHookedFish: { name: 'Golden Fish', rarity: 'leg', kg: 20 } });
  const act = button(h, "        const btnFishReel = document.getElementById('btnFishingReelIn');", '        const btnFishSnap', 'btnFishingReelIn');
  act();
  assert.equal(h.ev.fishingTotalKg, 20);
  assert.equal(h.ev.fishingSilverTickets, 600);
  assert.equal(h.ev.fishingGoldTickets, 2);
  assert.match(h.reveals[0].subtitle, /Golden Fish/);
  assert.deepEqual(Array.from(h.reveals[0].rewards, r => r.amount), [600, 2]);
  assertSaved(h);
});

test('Fishing ×10 truthfully reveals fixed ticket settlement without inventing ten fish', () => {
  const h = harness({ WIKI_FISHING_ZONES_META: [{ id: 'z', name: 'Lake', minKg: 1, maxKg: 3 }] });
  h.ev.fishingLures = 10;
  button(h, "        const btnFishCast10 = document.getElementById('btnFishingCast10');", '        const btnFishAq', 'btnFishingCast10')();
  assert.equal(h.ev.fishingLures, 0);
  assert.equal(h.ev.fishingTotalKg, 18);
  assert.deepEqual(Array.from(h.reveals[0].rewards, r => r.amount), [1450, 2]);
  assert.equal(h.randomCalls(), 0);
  assertSaved(h);
});

test('Campaign sweep reveals the exact gear returned by settlement; blocked entry reveals nothing', () => {
  let pulls = 0;
  const h = harness({ requireVipCard() { return true; }, WIKI_95_CAMPAIGN_CHAPTERS: [{ id: 1, wikiName: 'Chapter', progressMilestones: [] }], grantAll6GearScrolls() {}, rollSingleCanonicalChestPull() { pulls++; return { item: { uid: 'settled', templateId: 'actual_bow' }, tpl: { name: 'Actual Bow' }, quality: 'rare' }; }, getGearItemSvgArt(templateId) { assert.equal(templateId, 'actual_bow'); return '<svg></svg>'; } });
  h.ev.campaignClaimedSteps = {};
  const act = button(h, "        const btnCampSweep = document.getElementById('btnCampaignSweepClear');", "        container.querySelectorAll('[data-claim-campaign-step]')", 'btnCampaignSweepClear');
  act();
  assert.equal(pulls, 1);
  assert.equal(h.SaveState.stamina, 5);
  assert.equal(h.reveals[0].rewards.at(-1).name, 'Actual Bow');
  assertSaved(h);
  h.SaveState.stamina = 0;
  act();
  assert.equal(pulls, 1);
  assert.equal(h.reveals.length, 1);
});

test('Wheel ack failure does not settle or reveal; retry does not award twice', async () => {
  const ctx = vm.createContext({}); vm.runInContext(wheelSource, ctx);
  const api = ctx.ArtemisCampaignWheel;
  let cp;
  for (let room = 1; room < 100; room++) {
    const o = { runId: 'test-run', chapter: 1, room };
    const receipt = api.prepare(o, null);
    if (receipt) { cp = { runId: o.runId, chapterId: 1, room, roomCleared: true, boundary: 'cleared', runGold: 0, wheel: receipt }; break; }
  }
  assert.ok(cp);
  const save = { gearScrolls: { weapon: 0 } };
  let succeeds = false;
  const session = api.createSession({ checkpoint: cp, save, persist: async () => succeeds });
  assert.equal(await session.start(), false);
  assert.equal(session.state, 'error');
  const gold = cp.runGold, scrolls = save.gearScrolls.weapon;
  succeeds = true;
  assert.equal(await session.start(), true);
  session.settle(); session.settle();
  assert.equal(session.state, 'reward');
  assert.equal(cp.runGold, gold);
  assert.equal(save.gearScrolls.weapon, scrolls);
});

test('Random gem craft reveals actual inventory key with exact costs; blocked craft has no reveal', () => {
  const h = harness({ GEM_META: { ruby: { name: 'Ruby', icon: '🔴', desc: 'ATK' }, sapphire: { name: 'Sapphire', icon: '🔵', desc: 'HP' } }, renderGemTool() {} }, [.9]);
  h.SaveState.salvageMaterials = 2; h.SaveState.gemInventory = {};
  h.run(section("        const craftBtn = document.getElementById('btnCraftRandomGem');", '\n      }'));
  h.buttons.btnCraftRandomGem.onclick();
  assert.equal(h.SaveState.gold, 9900);
  assert.equal(h.SaveState.salvageMaterials, 0);
  assert.equal(h.SaveState.gemInventory.sapphire, 1);
  assert.equal(h.reveals[0].rewards[0].name, 'Sapphire');
  assert.equal(h.randomCalls(), 1); assertSaved(h);
  h.buttons.btnCraftRandomGem.onclick();
  assert.equal(h.reveals.length, 1);
});

test('Demon random-gear milestone uses the actual returned item; unsupported legendary claims do not fabricate rewards', () => {
  let act;
  const h = harness({ WIKI_DEMON_KING_SPIN_MILESTONES: [{ spins: 200, type: 's_gear' }, { spins: 300, type: 'leg_rune' }], container: { querySelectorAll() { return { forEach(fn) { const btn = { getAttribute() { return '200'; } }; fn(btn); act = btn; } }; } }, rollSingleCanonicalChestPull() { return { item: { templateId: 'real' }, tpl: { name: 'Real Gear' }, quality: 'epic' }; }, getGearItemSvgArt(id) { assert.equal(id, 'real'); return '<svg></svg>'; } });
  h.ev.demonTotalSpins = 300; h.ev.demonSpinMilestonesClaimed = {};
  h.run(section("        container.querySelectorAll('[data-claim-demon-milestone]')", "        container.querySelectorAll('[data-buy-demon-shop]')"));
  act.onclick(); assert.equal(h.reveals[0].rewards[0].name, 'Real Gear'); assertSaved(h);
  act.getAttribute = () => '300'; act.onclick();
  assert.equal(h.reveals.length, 1);
});

test('Wheel actual DOM callback reveals once only after persistence ack, including animation skip', async () => {
  class Node {
    constructor() { this.style = {}; this.listeners = {}; this.children = {}; this.isConnected = true; }
    querySelector(key) { return this.children[key] ||= new Node(); }
    appendChild() {} addEventListener(type, fn) { this.listeners[type] = fn; }
    remove() { this.isConnected = false; } focus() {} closest() { return false; }
  }
  const reveals = [], timers = [];
  const ctx = vm.createContext({ document: { createElement() { return new Node(); }, body: new Node() }, setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}, ArtemisRewardResults: { show(r) { reveals.push(r); } } });
  vm.runInContext(wheelSource, ctx);
  const api = ctx.ArtemisCampaignWheel, cp = { runId: 'wheel-dom-test', chapterId: 1, room: 4, roomCleared: true, boundary: 'cleared', runGold: 0 };
  cp.wheel = api.prepare({ runId: cp.runId, chapter: 1, room: 4 }, null);
  let ack = false;
  const ui = api.open({ checkpoint: cp, save: { gearScrolls: {} }, persist: async () => ack });
  const btn = ui.element.querySelector('button');
  await btn.listeners.click(); assert.equal(reveals.length, 0);
  ack = true; await btn.listeners.click(); assert.equal(reveals.length, 0);
  ui.element.listeners.click({ target: new Node() });
  assert.equal(reveals.length, 1);
  assert.equal(reveals[0].rewards[0].amount, ui.session.reward.amount);
  for (const fn of timers) fn();
  assert.equal(reveals.length, 1);
  const gold = cp.runGold;
  ui.close(); assert.equal(cp.runGold, gold);
});

test('All inline scripts still parse after concurrent integrations', () => {
  let scripts = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=|application\/ld\+json|application\/json/i.test(match[1])) continue;
    new vm.Script(match[2]); scripts++;
  }
  assert.ok(scripts > 0);
});
