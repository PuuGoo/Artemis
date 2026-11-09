// Offline VM: executes production helpers and actual UI bindings; no server, env or DB.
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCampaignDependencies } from './fixtures/campaign-vm.mjs';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function between(a, b) {
  const start = html.indexOf(a), end = html.indexOf(b, start + a.length);
  assert.ok(start >= 0 && end > start, `Missing production boundary: ${a}`);
  return html.slice(start, end);
}
function declaration(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing function ${name}`);
  return html.slice(start, html.indexOf('\n      }', start) + '\n      }'.length);
}
function binding(anchor) {
  const start = html.indexOf(anchor);
  assert.ok(start >= 0, `Missing binding ${anchor}`);
  // Compile the smallest complete binding, including nested callbacks unchanged.
  for (let end = html.indexOf('});', start); end >= 0; end = html.indexOf('});', end + 3)) {
    const code = html.slice(start, end + 3);
    try { new vm.Script(code); return code; } catch {}
  }
  throw new Error(`Incomplete binding ${anchor}`);
}
function fixture(extra = {}) {
  const saves = [], toasts = [];
  const S = { selectedHeroId: 'alex', selectedChapterIdx: 0, heroStars: { alex: 0, thor: 0 }, heroShards: { thor: 12 },
    heroSelectedSkins: { alex: 2, thor: 1 }, heroSkinIdx: 2, gold: 0, ...extra,
    save() { saves.push(JSON.parse(JSON.stringify(this))); } };
  const heroesCode = between('const HEROES = [', '\n      const ', );
  let handler;
  const btn = { getAttribute: () => null, addEventListener: (_, fn) => { handler = fn; } };
  const root = { querySelectorAll: () => [btn], getElementById: () => btn, querySelector: () => null };
  const ctx = vm.createContext({ SaveState: S, document: root, container: root, quickHeroBar: root,
    showToast: (...v) => toasts.push(v), renderLobbyUI() {}, renderHeroRoster() {}, closeHeroUpgradeDisclosures() {},
    SoundFX: { levelUp() {}, coinPickup() {} }, StageHeroAnim: { triggerPose() {}, sparkles: [] }, st: {},
    getHeroShardRequirement: () => 50, makeWikiHeroPortraitURI: () => 'portrait-fixture' });
  vm.runInContext(`${heroesCode}\n${declaration('getHeroStarLevel')}\n${between('function isHeroOwned(', '/**\n       * Màn THẺ')}`, ctx);
  return { S, ctx, saves, toasts, run: code => vm.runInContext(code, ctx), click(anchor, id) {
    handler = null; btn.onclick = null; btn.getAttribute = () => id;
    vm.runInContext(binding(anchor), ctx);
    assert.equal(typeof (handler || btn.onclick), 'function', `Unbound ${anchor}`);
    (handler || btn.onclick)({ stopPropagation() {} });
  } };
}
const paths = ["grid.querySelectorAll('[data-hero-use]').forEach"];
test('portrait preview never equips or writes, including locked heroes', () => {
 for (const id of ['thor','alex','missing']) {
  const f=fixture(); f.ctx.grid=f.ctx.container;
  const before=JSON.stringify(f.S);
  f.click("grid.querySelectorAll('[data-hero-pick]').forEach",id);
  assert.equal(JSON.stringify(f.S),before); assert.equal(f.saves.length,0);
 }
});
for (const anchor of paths) test(`${anchor}: locked and invalid selections have no writes`, () => {
  for (const id of ['thor', 'missing']) {
    const f = fixture();
    f.ctx.grid = f.ctx.container;
    f.ctx.VN_21_HEROES_PDF = [{ id, unlocked: false, stars: 0 }];
    const before = JSON.stringify([f.S, f.ctx.st, f.ctx.VN_21_HEROES_PDF]);
    f.click(anchor, id);
    assert.equal(JSON.stringify([f.S, f.ctx.st, f.ctx.VN_21_HEROES_PDF]), before);
    assert.equal(f.saves.length, 0);
  }
});
for (const anchor of paths) test(`${anchor}: owned heroes and Alex remain selectable without changing assets`, () => {
  const f = fixture({ heroStars: { alex: 0, thor: 3 } });
  f.ctx.grid = f.ctx.container;
  f.ctx.VN_21_HEROES_PDF = [{ id: 'thor', unlocked: false, stars: 0 }, { id: 'alex', unlocked: true, stars: 6 }];
  const assets = JSON.stringify([f.S.heroStars, f.S.heroShards, f.S.heroSelectedSkins]);
  f.click(anchor, 'thor');
  assert.equal(f.S.selectedHeroId, 'thor');
  f.click(anchor, 'alex');
  assert.equal(f.S.selectedHeroId, 'alex');
  assert.equal(JSON.stringify([f.S.heroStars, f.S.heroShards, f.S.heroSelectedSkins]), assets);
});
test('shared ownership rejects nonexistent selected/starred IDs and preserves selected legacy zero-star hero', () => {
  const f = fixture({ selectedHeroId: 'artemis', heroStars: { artemis: 0, missing: 8 } });
  assert.equal(f.run("isHeroOwned('artemis')"), true);
  assert.equal(f.run("isHeroOwned('alex')"), true);
  assert.equal(f.run("isHeroOwned('missing')"), false);
  f.S.selectedHeroId = 'missing';
  assert.equal(f.run("isHeroOwned('missing')"), false);
});
test('Picker phụ, nút mũi tên và lối tắt nâng sao đã được xoá cùng handler', () => {
 assert.equal(/stage-quick-hero-btn|char-subtab-hero-btn|hero-card-btn|data-vn-hero-use|data-jump-upgrade-hero|btnStagePrevHero|btnStageNextHero/.test(html), false);
});
function runFixture(extra = {}) {
  const f = fixture(extra);
  loadCampaignDependencies(f.ctx, { skills: true });
  // Phụ thuộc mới của startNewRun: chạy module thật, không bỏ hook ngoại hình.
  f.run(fs.readFileSync(new URL('../public/monster-art.js', import.meta.url), 'utf8'));
  f.run(fs.readFileSync(new URL('../public/combat-damage.js', import.meta.url), 'utf8'));
  const zero = new Proxy({}, { get: () => 0 });
  Object.assign(f.S, { gearLevel: 1, equippedGear: {}, selectedWeaponId: 'bow', selectedPetId: 'pet' });
  Object.assign(f.ctx, { Game: { width: 600, height: 800 }, WEAPONS: [{ id: 'bow', atkMult: 1, aspd: 1, critBonus: 0 }],
    PETS: [{ id: 'pet' }], GEAR_TEMPLATES: {}, GEAR_SLOTS_META: {}, CHAPTERS: [{ id: 1, name: 'Chapter 1', rooms: 15, unlock: { label: 'fixture lock' } }],
    getGlobalAllHeroStarBonuses: () => zero, computeAllTalentCardsBonuses: () => zero,
    getActiveResonanceHeroIds: () => [], computeTotalEquippedRunesStats: () => zero,
    computeAllArtifactsAndSetsBonuses: () => zero, getHeroMilestoneData: () => zero,
    getActiveHeroSkin: () => zero, getAllUnlockedSkinBonuses: () => zero, getSetBonuses: () => [],
    stopGameLoop() {}, clearRunState() {}, syncContinueButton() {},
    getActiveGameMode: () => ({ id: 'campaign', hasChapters: true }), isChapterLocked: () => false,
    resizeCanvas() {}, DungeonSession: { begin() { f.S.save(); } }, bumpLifetimeStat() {},
    checkAchievements() { f.S.save(); }, ULT_COST: 100, isRuneEquipped: () => false, runeHasEffect: () => false,
    hasHeroSkillActive: () => false, setupRoom() {}, updateInGameHUD() {}, performance: { now: () => 0 },
    saveCheckpoint() { f.S.save(); }, triggerSkillSelection() {},
    requestAnimationFrame: () => 1, gameLoop() {} });
  f.ctx.SoundFX.init = () => {};
  f.ctx.document.getElementById = () => ({ classList: { add() {}, remove() {} } });
  f.run(`${declaration('getComputedStats')}\n${declaration('openCampaignOffer')}\n${declaration('startNewRun')}\n${declaration('launchEventCanvasRun')}`);
  return f;
}
test('real Demon King binding plays Atreus for this run only, including saves during startup', () => {
  const f = runFixture({ selectedHeroId: 'artemis', heroStars: { artemis: 0, atreus: 0 } });
  const assets = JSON.stringify([f.S.heroStars, f.S.heroShards, f.S.heroSelectedSkins]);
  let play;
  f.ctx.document.getElementById = () => ({ set onclick(fn) { play = fn; }, classList: { add() {}, remove() {} } });
  f.run(between("const btnDkCanvas = document.getElementById('btnDemonPlayAtreusCanvas');", 'const btnDk55 ='));
  play();
  assert.equal(f.ctx.Game.player.hero.id, 'atreus');
  assert.ok(f.ctx.Game.runProgression.pendingOffer.skillIds.length > 0);
  assert.equal(f.S.selectedHeroId, 'artemis');
  assert.ok(f.saves.length > 0);
  assert.ok(f.saves.every(s => s.selectedHeroId === 'artemis'));
  assert.equal(f.run("isHeroOwned('atreus')"), false);
  assert.equal(f.run("isHeroOwned('artemis')"), true);
  assert.equal(JSON.stringify([f.S.heroStars, f.S.heroShards, f.S.heroSelectedSkins]), assets);
  f.run('startNewRun()');
  assert.equal(f.ctx.Game.player.hero.id, 'artemis');
});
test('forced invalid/unowned non-trial hero never persists or launches a run', () => {
  for (const id of ['missing', 'thor']) {
    const f = runFixture();
    const before = JSON.stringify(f.S);
    f.run(`launchEventCanvasRun('event', 'stage', null, null, null, 1, '${id}')`);
    assert.equal(JSON.stringify(f.S), before);
    assert.equal(f.ctx.Game.player, undefined);
    assert.equal(f.saves.length, 0);
  }
});
test('event trial preserves selected hero when startup is blocked or throws', () => {
  for (const mode of ['blocked', 'throw']) {
    const f = runFixture();
    if (mode === 'blocked') f.ctx.isChapterLocked = () => true;
    else f.ctx.resizeCanvas = () => { throw new Error('fixture startup error'); };
    try { f.run("launchEventCanvasRun('event', 'stage', null, null, null, 1, 'atreus')"); }
    catch (e) { assert.equal(e.message, 'fixture startup error'); }
    assert.equal(f.S.selectedHeroId, 'alex');
    assert.equal(f.ctx.Game.chapter, undefined);
    assert.ok(f.saves.every(s => s.selectedHeroId === 'alex'));
  }
});
test('Studio chính nâng sao qua chi phí canonical, không sửa tài sản khác', () => {
 const f = fixture({gold:1000, heroStars:{alex:0,thor:3}, heroShards:{thor:150}});
 f.ctx.getHeroMilestoneData=()=>({shardCost:50,goldCost:100,name:'4 stars'});
 f.ctx.containerEl=f.ctx.container;
 f.run(declaration('getHeroShardsCount')+'\n'+declaration('upgradeHeroStar'));
 f.click("containerEl.querySelectorAll('.btn-upgrade-hero-star').forEach",'thor');
 assert.equal(f.S.heroStars.thor,4);assert.equal(f.S.heroShards.thor,100);assert.equal(f.S.gold,900);assert.equal(f.S.heroSelectedSkins.thor,1);
});
test('Studio chính từ chối thiếu tiền/mảnh hoặc id lạ, không ghi save', () => {
 for(const id of ['thor','missing']){const f=fixture();f.ctx.containerEl=f.ctx.container;f.ctx.getHeroMilestoneData=()=>({shardCost:50,goldCost:100});f.run(declaration('getHeroShardsCount')+'\n'+declaration('upgradeHeroStar'));const before=JSON.stringify(f.S);f.click("containerEl.querySelectorAll('.btn-upgrade-hero-star').forEach",id);assert.equal(JSON.stringify(f.S),before);assert.equal(f.saves.length,0);}
});
test('star upgrade rejects insufficient gold with enough shards, and insufficient shards with enough gold', () => {
 for (const resources of [{gold:499,heroShards:{alex:50}},{gold:500,heroShards:{alex:49}}]) {
  const f=fixture(resources);
  f.ctx.getHeroMilestoneData=()=>({shardCost:50,goldCost:500,name:'1 star'});
  f.run(declaration('getHeroShardsCount')+'\n'+declaration('upgradeHeroStar'));
  const before=JSON.stringify(f.S);
  assert.equal(f.run("upgradeHeroStar('alex')"),false);
  assert.equal(JSON.stringify(f.S),before);
  assert.equal(f.saves.length,0);
 }
});
test('stage gear summary renders actual zero stars, not six-star preview fallback', () => {
  const f = fixture();
  const pill = { textContent: '' };
  f.ctx.document.getElementById = () => pill;
  f.ctx.GEAR_TEMPLATES = {};
  f.ctx.stats = { hero: { name: 'Alex' }, heroStar: 0, activeSkin: { name: 'Default' } };
  f.run("const visSummaryEl = document.getElementById('stageVisualGearSummary');\n" +
    between("const eqW = GEAR_TEMPLATES[SaveState.equippedGear?.weapon?.templateId]", "        }\n\n        // Build Authentic"));
  assert.match(pill.textContent, /Alex \(0★\)/);
});
test('star/shard grants reject unsupported IDs instead of polluting hero assets', () => {
  const f = fixture({ gems: 1000, gold: 5000, heroShards: { missing: 0 } });
  f.ctx.getHeroMilestoneData = () => ({ shardCost: 50, goldCost: 100, name: '1 star' });
  f.run(`${declaration('getHeroShardsCount')}\n${declaration('upgradeHeroStar')}\n${declaration('summonHeroShards')}`);
  const before = JSON.stringify(f.S);
  assert.equal(f.run("upgradeHeroStar('missing')"), false);
  assert.equal(f.run("summonHeroShards('missing', 100)"), 0);
  assert.equal(JSON.stringify(f.S), before);
  assert.equal(f.saves.length, 0);
});
test('gem shard purchase validates the hero before charging', () => {
  const f = fixture({ gems: 300, heroShards: {} });
  f.run(declaration('summonHeroShards'));
  f.run(declaration('getHeroShardsCount'));
  f.click("container.querySelectorAll('[data-buy-hero-shard]').forEach", 'missing');
  assert.equal(f.S.gems, 300);
  assert.equal(f.S.heroShards.missing, undefined);
});
