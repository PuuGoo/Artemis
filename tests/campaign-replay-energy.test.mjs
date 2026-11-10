import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the shipped inline handler, not a reimplementation of its economy logic.
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.slice(html.indexOf("      function startNewRun(reason = 'fresh') {"), html.indexOf('      // Setup Room Obstacles & Enemies'));
const helperStart = html.indexOf('      function getCampaignReplayCost(');
const helper = helperStart < 0 ? '' : html.slice(helperStart, html.indexOf("      function startNewRun(reason = 'fresh') {", helperStart));
function harness({ stamina = 20, won = true, mode = 'campaign', running = false, locked = false } = {}) {
  const calls = [];
  const ch = { id: 1, rooms: 50, name: 'Chương 1: Rừng', unlock: { label: 'Chương trước' } };
  const checkpoint = { room: 17 };
  const c = {
    CHAPTERS: [ch], Game: { running, width: 400, height: 700, animId: 42 },
    SaveState: { stamina, selectedChapterIdx: 0, dungeonCheckpoint: checkpoint,
      save() { calls.push(['save', this.stamina, c.Game.running, c.Game.animId]); } },
    SoundFX: { init() {}, preload() {} },
    stopGameLoop() { calls.push(['stop']); c.Game.animId = 0; },
    clearRunState() { calls.push(['clear']); }, syncContinueButton() {},
    getComputedStats() { return { baseHp: 100, baseAtk: 20 }; },
    getActiveGameMode() { return { id: mode, hasChapters: mode === 'campaign' }; },
    isChapterWon: () => won, isChapterLocked: () => locked,
    showToast: (message) => calls.push(['toast', message]),
    setCombatImmersive() {}, document: { getElementById: () => ({ classList: { add() {}, remove() {} } }) },
    window: { innerWidth: 400 }, resizeCanvas() {},
    DungeonSession: { begin() {} }, CombatDamage: { beginRun() {} }, MonsterArt: { beginRun() {} },
    ArtemisCampaignTelemetry: { begin: () => ({}) }, CampaignSupport: { create: () => ({}) },
    bumpLifetimeStat() {}, checkAchievements() {}, ArtemisCampaignExp: { threshold: () => 80 },
    ArtemisCampaignSkills: { normalizeState: () => ({}) }, ROGUE_SKILLS: [],
    isRuneEquipped: () => false, hasHeroSkillActive: () => false,
    setupRoom() { calls.push(['setup', c.SaveState.stamina]); },
    openCampaignOffer() { calls.push(['offer', c.SaveState.stamina]); }, updateInGameHUD() {},
    performance: { now: () => 1 }, requestAnimationFrame() { calls.push(['raf', c.SaveState.stamina]); return 99; }, gameLoop() {},
  };
  vm.createContext(c);
  vm.runInContext(helper + '\n' + start, c);
  return { c, calls, checkpoint };
}

test('insufficient energy preserves the running loop and checkpoint and reports need/have in Vietnamese', () => {
  for (const reason of ['fresh', 'retry', 'reset']) {
    const { c, calls, checkpoint } = harness({ stamina: 4, running: reason !== 'fresh' });
    assert.equal(c.startNewRun(reason), false);
    assert.equal(c.SaveState.stamina, 4);
    assert.equal(c.SaveState.dungeonCheckpoint, checkpoint);
    assert.equal(c.Game.animId, 42);
    assert.equal(calls.length, 1);
    assert.match(calls[0][1], /cần 5, hiện có 4/);
  }
});

test('only completed campaign fresh/retry/reset runs incur the shared cost', () => {
  const { c } = harness();
  assert.equal(c.getCampaignReplayCost(), 5);
  for (const reason of ['fresh', 'retry', 'reset']) assert.equal(c.getCampaignReplayCost(c.CHAPTERS[0], reason, { id: 'campaign' }), 5);
  for (const reason of ['continue', 'event', 'unknown']) assert.equal(c.getCampaignReplayCost(c.CHAPTERS[0], reason), 0);
  for (const id of ['practice', 'endless', 'tower', 'boss', 'event']) assert.equal(c.getCampaignReplayCost(c.CHAPTERS[0], 'fresh', { id, hasChapters: true }), 0);
  assert.equal(c.getCampaignReplayCost(null), 0);
});

test('uncleared chapters, noncampaign runs and continue remain free even with zero stamina', () => {
  for (const options of [{ won: false }, { mode: 'practice' }, { mode: 'endless' }, { mode: 'tower' }, { mode: 'boss' }, { reason: 'continue' }, { reason: 'event' }]) {
    const { c, calls, checkpoint } = harness({ ...options, stamina: 0 });
    c.startNewRun(options.reason);
    assert.equal(c.Game.running, true);
    assert.equal(c.SaveState.stamina, 0);
    assert.equal(calls.filter(x => x[0] === 'save').length, 0);
    if (options.reason === 'continue') assert.equal(c.SaveState.dungeonCheckpoint, checkpoint);
  }
});

test('repeated fresh entry is a no-op, but explicit retry/reset charges once per successful restart', () => {
  const { c, calls } = harness();
  c.startNewRun();
  const count = calls.length;
  assert.equal(c.startNewRun(), false);
  assert.equal(c.SaveState.stamina, 15);
  assert.equal(calls.length, count);
  c.startNewRun('retry');
  assert.equal(c.SaveState.stamina, 10);
  c.startNewRun('reset');
  assert.equal(c.SaveState.stamina, 5);
  assert.equal(calls.filter(x => x[0] === 'save').length, 3);
});

test('exactly five energy is enough', () => {
  const { c } = harness({ stamina: 5 });
  c.startNewRun();
  assert.equal(c.SaveState.stamina, 0);
  assert.equal(c.Game.running, true);
});

test('locked validation refuses before destructive cleanup or charging', () => {
  const { c, calls, checkpoint } = harness({ locked: true });
  assert.equal(c.startNewRun(), false);
  assert.equal(c.SaveState.stamina, 20);
  assert.equal(c.SaveState.dungeonCheckpoint, checkpoint);
  assert.deepEqual(calls.map(x => x[0]), ['toast']);
});

test('throwing validation or startup does not spend or persist energy', () => {
  for (const name of ['getComputedStats', 'resizeCanvas', 'setupRoom', 'openCampaignOffer', 'updateInGameHUD', 'requestAnimationFrame']) {
    const { c, calls } = harness();
    c[name] = () => { throw Error('startup failed'); };
    assert.throws(() => c.startNewRun(), /startup failed/);
    assert.equal(c.SaveState.stamina, 20, name);
    assert.equal(calls.filter(x => x[0] === 'save').length, 0, name);
  }
});

test('successful replay writes the reduced stamina through the actual SaveState cloud-buffer flow', () => {
  const { c } = harness();
  const saveStart = html.indexOf('        save() {', html.indexOf('      const SaveState = {'));
  const saveEnd = html.indexOf('\n      };', saveStart);
  const events = [];
  c.window.__ARTEMIS_SAVE_READY = true;
  c.window.dispatchEvent = event => events.push(event);
  c.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  c.SaveState.save = vm.runInContext('({' + html.slice(saveStart, saveEnd) + '}).save', c);
  c.startNewRun();
  const payload = JSON.parse(c.window.__ARTEMIS_SAVE_BUFFER);
  assert.equal(payload.stamina, 15);
  assert.equal(payload.dungeonCheckpoint, null);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'artemis:save');
  assert.equal(JSON.parse(events[0].detail.payload).stamina, 15);
});

test('asking for the briefing label cost does not charge or alter state', () => {
  const { c, calls, checkpoint } = harness();
  assert.equal(c.getCampaignReplayCost(), 5);
  assert.equal(c.SaveState.stamina, 20);
  assert.equal(c.SaveState.dungeonCheckpoint, checkpoint);
  assert.equal(calls.length, 0);
});

test('event canvas launch never charges the selected completed campaign chapter', () => {
  const { c } = harness();
  c.runHeroOverrideId = null;
  vm.runInContext(html.slice(html.indexOf('      function launchEventCanvasRun('), html.indexOf('      function grantAll6GearScrolls(')), c);
  c.launchEventCanvasRun('Sự kiện', 'Đấu trường');
  assert.equal(c.SaveState.stamina, 20);
  assert.equal(c.Game.chapter.id, 999);
});

test('completed campaign startup spends exactly five and persists only after the run starts', () => {
  const { c, calls } = harness();
  c.startNewRun();
  assert.equal(c.SaveState.stamina, 15);
  assert.equal(c.Game.running, true);
  assert.equal(c.SaveState.dungeonCheckpoint, null);
  assert.deepEqual(calls.filter(x => ['setup', 'offer', 'raf'].includes(x[0])), [['setup', 20], ['offer', 20], ['raf', 20]]);
  assert.deepEqual(calls.filter(x => x[0] === 'save'), [['save', 15, true, 99]]);
});
