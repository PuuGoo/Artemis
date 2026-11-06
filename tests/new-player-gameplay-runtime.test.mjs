// Chạy mã gameplay thật trong VM cô lập; không HTTP, không DB, không save người dùng.
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/saveSchema.js';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function between(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Thiếu ranh giới mã: ${start}`);
  return html.slice(a, b);
}
const journeyCode = between('const BEGINNER_STEPS = [', '/** HTML cho panel Hành Trình Tân Thủ. */');
const saveCode = between('save() {\n          // ==================== KHOA GHI', '\n      };\n      /**');
function fixture(extra = {}) {
  const S = { playerName: 'offline-fixture', gold: 0, gems: 0, heroStars: { alex: 0, thor: 0 },
    selectedHeroId: 'alex', gearBag: [], equippedGear: { weapon: null },
    gearScrolls: { weapon: 0, armor: 0, ring: 0, amulet: 0, boots: 0, helmet: 0 }, chestKeys: {},
    beginnerJourney: { startedAt: 1, currentStep: 'N01', completedSteps: [], claimedRewards: [] }, ...extra };
  const ctx = vm.createContext({ SaveState: S, window: { __ARTEMIS_SAVE_READY: true, dispatchEvent() {} },
    console, showToast() {}, checkAchievements() {}, SoundFX: { coinPickup() {}, levelUp() {} },
    renderLobbyUI() {}, ensureWikiCurrencyAndItemsState() {},
    GEAR_TEMPLATES: { rusty_bow: { slot: 'weapon', weaponArchetype: 'bow' }, crimson_bow: { slot: 'weapon', weaponArchetype: 'bow' }, oracle_staff: { slot: 'weapon', weaponArchetype: 'staff' }, dragoon_claw: { slot: 'weapon', weaponArchetype: 'claw' } },
    makeStarterItem: (uid, templateId) => ({ uid, templateId, quality: 'common', level: 1 }),
    createDefaultEquipped: () => ({ weapon: null }) });
  vm.runInContext(`SaveState.save = ({${saveCode}}).save; ${journeyCode}; globalThis.hooks = BeginnerHooks;`, ctx);
  return { S, ctx, run: code => vm.runInContext(code, ctx), saved: () => JSON.parse(ctx.window.__ARTEMIS_SAVE_BUFFER) };
}
function clickHandler(f, selector, nextMarker, attr, value) {
  let callback;
  f.ctx.document = { querySelectorAll: () => [{ getAttribute: key => key === attr ? value : null, addEventListener: (_, fn) => { callback = fn; } }] };
  f.run(between(`document.querySelectorAll('${selector}').forEach`, nextMarker));
  assert.equal(typeof callback, 'function');
  callback();
}
test('N03 lưu ngay lượt nhặt, không chờ dọn phòng hay đạt đủ 10', () => {
  const f = fixture();
  f.ctx.hooks.onLoot(3);
  assert.equal(f.saved().beginnerJourney._lootCount, 3);
});

test('Cờ starter giữ qua save/schema, bán vũ khí rồi tải lại không nhận lần hai', () => {
  const f = fixture();
  assert.ok(f.run('grantStarterWeaponIfNeeded()'));
  assert.equal(f.saved().starterWeaponGranted, true);
  const snapshot = sanitizeSave(f.saved()).data;
  const reload = fixture({ starterWeaponGranted: snapshot.starterWeaponGranted });
  assert.equal(reload.run('grantStarterWeaponIfNeeded()'), null);
  assert.equal(reload.S.gearBag.length, 0);
});

test('Vũ khí đang mặc được ghi nhận như vũ khí trong túi, tháo/bán không nhận trùng', () => {
  const item = { uid: 'old-owned', templateId: 'rusty_bow', level: 9 };
  const f = fixture({ equippedGear: { weapon: item } });
  assert.equal(f.run('grantStarterWeaponIfNeeded()'), null);
  assert.equal(f.S.starterWeaponGranted, true);
  assert.equal(f.S.equippedGear.weapon, item);
  assert.equal(f.saved().starterWeaponGranted, true);
  f.S.equippedGear.weapon = null;
  assert.equal(f.run('grantStarterWeaponIfNeeded()'), null);
});

test('Selector vũ khí không tự tạo trang bị miễn phí khi túi/ô vũ khí trống', () => {
  const f = fixture({ selectedWeaponId: 'bow' });
  const before = JSON.stringify(f.S);
  clickHandler(f, '.select-weapon-btn', "const petGrid =", 'data-weapon-id', 'staff');
  assert.equal(JSON.stringify(f.S), before);
});

test('Selector hero cũ không vượt khoá sở hữu của roster mới', () => {
  const f = fixture();
  f.run(between('function getHeroStarLevel(', 'function getHeroShardRequirement('));
  f.run(between('function isHeroOwned(', '/**\n       * Màn THẺ'));
  const before = JSON.stringify(f.S);
  clickHandler(f, '.hero-card-btn', "document.getElementById('activeHeroRole')", 'data-hero-id', 'thor');
  assert.equal(JSON.stringify(f.S), before);
});

test('Alex 0 sao vẫn sở hữu sau khi đổi sang hero đã mở, có thể đổi trở lại', () => {
  const f = fixture({ heroStars: { alex: 0, thor: 1 } });
  f.run(between('function getHeroStarLevel(', 'function getHeroShardRequirement('));
  f.run(between('function isHeroOwned(', '/**\n       * Màn THẺ'));
  clickHandler(f, '.hero-card-btn', "document.getElementById('activeHeroRole')", 'data-hero-id', 'thor');
  assert.equal(f.S.selectedHeroId, 'thor');
  clickHandler(f, '.hero-card-btn', "document.getElementById('activeHeroRole')", 'data-hero-id', 'alex');
  assert.equal(f.S.selectedHeroId, 'alex');
});

test('Danh mục không ghi Đang Trang Bị khi người mới chưa sở hữu vũ khí', () => {
  const f = fixture({ selectedWeaponId: 'bow', gearLevel: 1 });
  const grid = { innerHTML: '' };
  f.ctx.document = { getElementById: () => grid };
  f.ctx.WEAPONS = [{ id: 'bow', name: 'Cung', tier: 'S', desc: '' }];
  f.ctx.getWeaponSvgArt = () => '';
  f.run(between("const weaponGrid = document.getElementById('weaponCardsGrid');", "document.querySelectorAll('.select-weapon-btn')"));
  assert.ok(!grid.innerHTML.includes('✓ Đang Trang Bị'));
  assert.ok(grid.innerHTML.includes('Chưa sở hữu'));
});

test('N08 hiển thị Hoàn Tất khi đã xong bảy bước trước', () => {
  const f = fixture();
  for (const id of ['N01','N02','N03','N04','N05','N06','N07']) f.run(`completeBeginnerStep('${id}')`);
  f.run(between('function buildBeginnerJourneyPanelHtml()', '/** Gắn sự kiện cho panel vừa render. */'));
  const panel = f.run('buildBeginnerJourneyPanelHtml()');
  assert.match(panel, /data-bj-step="N08"[^>]*>Hoàn Tất<\/button>/);
});

test('N04 gọi đúng tên Cung Gỉ Sét của món rusty_bow được tặng', () => {
  const f = fixture();
  assert.ok(f.run("getBeginnerStep('N04').desc").includes('Cung Gỉ Sét'));
  const toasts = [];
  f.ctx.showToast = value => toasts.push(value);
  f.ctx.hooks.onRoomCleared();
  assert.equal(f.S.gearBag[0].templateId, 'rusty_bow');
  assert.ok(toasts.some(value => value.includes('Cung Gỉ Sét')));
});

test('N01–N08 hoàn thành/nhận thưởng đúng một lần, tổng thưởng từ bảng production', () => {
  const f = fixture();
  assert.equal(f.run("claimBeginnerReward('N05')"), false);
  f.ctx.hooks.onDialogueDone();
  f.ctx.hooks.onRoomCleared();
  f.ctx.hooks.onRoomCleared();
  assert.equal(f.S.gearBag.length, 1);
  f.ctx.hooks.onLoot(9);
  assert.ok(!f.S.beginnerJourney.completedSteps.includes('N03'));
  f.ctx.hooks.onLoot();
  f.ctx.hooks.onGearEquipped();
  f.ctx.hooks.onGearUpgraded();
  f.ctx.hooks.onSkillPicked();
  f.ctx.hooks.onChapterCleared(2);
  assert.ok(!f.S.beginnerJourney.completedSteps.includes('N07'));
  f.ctx.hooks.onChapterCleared(1);
  f.ctx.hooks.onFinalStepDone();
  assert.equal(f.S.beginnerJourney.isCompleted, true);
  const ids = f.run('BEGINNER_STEPS.map(s => s.id)');
  for (const id of ids) {
    assert.equal(f.run(`claimBeginnerReward('${id}')`), true);
    assert.equal(f.run(`claimBeginnerReward('${id}')`), false);
    assert.equal(f.run(`completeBeginnerStep('${id}')`), false);
  }
  const expected = f.run(`BEGINNER_STEPS.reduce((r,s) => { for (const [k,v] of Object.entries(s.reward)) r[k]=(r[k]||0)+v; return r; }, {})`);
  assert.equal(f.S.gold, expected.gold);
  assert.equal(f.S.gems, expected.gems);
  assert.equal(Object.values(f.S.gearScrolls).reduce((a,b) => a+b,0), expected.scrolls);
  assert.equal(f.S.chestKeys.silver_chest_key, expected.chestKeys);
  const server = sanitizeSave(f.saved()).data;
  assert.equal(server.beginnerJourney.completedSteps.length, 8);
  assert.equal(server.beginnerJourney.claimedRewards.length, 8);
  assert.equal(server.starterWeaponGranted, true);
});

test('Save cũ không tự bật tutorial; skip không xoá tiến trình hay thưởng đã kiếm', () => {
  const legacy = sanitizeSave({ gold: 12345, beginnerJourney: undefined }).data;
  const f = fixture({ gold: legacy.gold, beginnerJourney: legacy.beginnerJourney });
  const before = JSON.stringify(f.S);
  f.ctx.hooks.onDialogueDone(); f.ctx.hooks.onLoot(10); f.ctx.hooks.onGearUpgraded();
  assert.equal(JSON.stringify(f.S), before);
  assert.equal(f.run('activateBeginnerJourney()'), true);
  assert.equal(f.run('activateBeginnerJourney()'), false);
  f.ctx.hooks.onDialogueDone();
  assert.equal(f.run('skipBeginnerJourney()'), true);
  assert.equal(f.run('isBeginnerJourneyActive()'), false);
  assert.equal(f.run("claimBeginnerReward('N01')"), true);
  assert.equal(f.S.gold, 12445);
  assert.equal(f.run('activateBeginnerJourney()'), false);
});

test('Đổi vũ khí sở hữu giữ nguyên UID, template, level, quality, sockets, affixes của cả hai món', () => {
  const old = { uid: 'old-bow', templateId: 'rusty_bow', level: 31, quality: 'legendary', locked: true, sockets: ['ruby'], affixes: [{ id: 'atk' }] };
  const owned = { uid: 'owned-staff', templateId: 'oracle_staff', level: 2, quality: 'rare', favorite: true, sockets: [], affixes: [] };
  const f = fixture({ equippedGear: { weapon: old }, gearBag: [owned], selectedWeaponId: 'bow' });
  const originals = JSON.stringify([old, owned]);
  clickHandler(f, '.select-weapon-btn', 'const petGrid =', 'data-weapon-id', 'staff');
  assert.equal(f.S.equippedGear.weapon, owned);
  assert.equal(f.S.gearBag[0], old);
  assert.equal(JSON.stringify([old, owned]), originals);
  assert.ok(f.S.beginnerJourney.completedSteps.includes('N04'));
  const after = JSON.stringify(f.S);
  clickHandler(f, '.select-weapon-btn', 'const petGrid =', 'data-weapon-id', 'staff');
  assert.equal(JSON.stringify(f.S), after);
});

test('Không biến rusty_bow đang mặc thành vũ khí S hoặc loại chưa sở hữu', () => {
  const f = fixture({ equippedGear: { weapon: { uid: 'starter', templateId: 'rusty_bow', level: 10 } }, selectedWeaponId: 'bow' });
  const before = JSON.stringify(f.S);
  for (const id of ['bow','staff','claw','invalid']) clickHandler(f, '.select-weapon-btn', 'const petGrid =', 'data-weapon-id', id);
  assert.equal(JSON.stringify(f.S), before);
});

function modalClick(f, id, end, ref) {
  let callback;
  f.ctx._activeModalGearRef = ref;
  f.ctx.StageHeroAnim = { triggerPose() {} };
  f.ctx.refreshGearDetailModalContent = () => {};
  f.ctx.formatQualityWithStars = () => '';
  f.ctx.WIKI_GEAR_SCROLLS_META = { weapon: { wikiName: 'Weapon Scroll' } };
  f.ctx.document = { getElementById: () => ({ addEventListener: (_, fn) => { callback = fn; }, classList: { add() {} } }) };
  f.run(between('function getGearUpgradeScrollCost(', 'function computeTotalUpgradeScrollsSpent('));
  f.run(between(`document.getElementById('${id}').addEventListener`, end));
  assert.equal(typeof callback, 'function');
  callback();
}
test('N04 handler thật lấy món khỏi túi, trả đồ cũ về túi, không nhân đôi', () => {
  const old = { uid: 'old', templateId: 'rusty_bow', level: 1 };
  const owned = { uid: 'new', templateId: 'oracle_staff', level: 1 };
  const f = fixture({ equippedGear: { weapon: old }, gearBag: [owned] });
  modalClick(f, 'btnModalEquipGear', '// V4 Modal Buttons:', { uid: 'new', isEquipped: false, slotKey: 'weapon' });
  assert.equal(f.S.equippedGear.weapon, owned);
  assert.equal(f.S.gearBag.length, 1);
  assert.equal(f.S.gearBag[0], old);
  assert.ok(f.S.beginnerJourney.completedSteps.includes('N04'));
});
for (const [gold, scrolls, success] of [[124,1,false], [125,0,false], [125,1,true]]) {
  test(`N05 handler thật gold=${gold}, scroll=${scrolls}: ${success ? 'trừ đúng 125 vàng + 1 cuộn' : 'không thưởng khi thiếu phí'}`, () => {
    const item = { uid: 'up', templateId: 'rusty_bow', level: 1 };
    const f = fixture({ gold, equippedGear: { weapon: item } });
    f.S.gearScrolls.weapon = scrolls;
    modalClick(f, 'btnModalUpgradeGear', '// Equip Item inside Gear Detail Modal', { uid: 'up', isEquipped: true, slotKey: 'weapon' });
    assert.equal(item.level, success ? 2 : 1);
    assert.equal(f.S.gold, success ? 0 : gold);
    assert.equal(f.S.gearScrolls.weapon, success ? 0 : scrolls);
    assert.equal(f.S.beginnerJourney.completedSteps.includes('N05'), success);
  });
}

test('Pet hiện là ba lựa chọn miễn phí, đổi lựa chọn không cấp gear/currency', () => {
  const f = fixture({ selectedPetId: 'spirit_sword' });
  const before = JSON.stringify({ gold: f.S.gold, gems: f.S.gems, gearBag: f.S.gearBag, equippedGear: f.S.equippedGear });
  clickHandler(f, '.select-pet-btn', '// Render Wiki Skills Codex', 'data-pet-id', 'frost_bat');
  assert.equal(f.S.selectedPetId, 'frost_bat');
  assert.equal(JSON.stringify({ gold: f.S.gold, gems: f.S.gems, gearBag: f.S.gearBag, equippedGear: f.S.equippedGear }), before);
  assert.equal(f.saved().selectedPetId, 'frost_bat');
});

test('N06 applyRogueSkill thật: skill lỗi/pre-pin không hoàn thành, chọn trong trận có hoàn thành', () => {
  const f = fixture();
  f.ctx.Game = { player: { skills: {}, skillList: [], hp: 100, maxHp: 100, x: 0, y: 0 } };
  f.ctx.ROGUE_SKILLS = [{ id: 'attack_up', name: 'Attack' }];
  f.ctx.bumpLifetimeStat = () => {};
  f.ctx.spawnFloatText = () => {};
  f.ctx.computeWikiSkillMultipliers = () => ({ atkCatMult: 1, effectiveAspdMult: 1 });
  f.ctx.getComputedStats = () => ({ baseAtk: 100, baseAspd: 1, baseHp: 100 });
  f.run(between('function applyRogueSkill(', '/**\n       * Tính chi phí Máu'));
  f.run("applyRogueSkill('invalid'); applyRogueSkill('attack_up', true)");
  assert.ok(!f.S.beginnerJourney.completedSteps.includes('N06'));
  f.run("applyRogueSkill('attack_up')");
  assert.ok(f.S.beginnerJourney.completedSteps.includes('N06'));
  assert.equal(f.ctx.Game.player.skills.attack_up, 2);
});

test('Debug grant mặc định tắt: ba viện trợ, full skill và max systems không sửa save', () => {
  const f = fixture({ stamina: 20 });
  f.ctx.location = { search: '' };
  f.ctx.URLSearchParams = URLSearchParams;
  f.ctx.localStorage = { getItem: () => null, setItem() {} };
  f.ctx.blockedCheatNotice = () => {};
  f.ctx.Game = { running: true, player: { skills: {} } };
  f.run(between('const DEV_CHEATS = (function () {', '// Toàn bộ id nút cheat'));
  f.run(between('function grantAllRogueSkillsInRun()', 'function handleMaxAllClick()'));
  const maxMethod = between('applyMaxAllSystems(resetSets = true)', 'save() {\n          // ==================== KHOA GHI');
  f.run(`SaveState.applyMaxAllSystems = ({${maxMethod}}).applyMaxAllSystems`);
  const before = JSON.stringify(f.S);
  const callbacks = [];
  f.ctx.document = { getElementById: () => ({ addEventListener: (_, fn) => callbacks.push(fn) }) };
  f.run(between("document.getElementById('btnRefillStamina').addEventListener", "document.getElementById('btnTopOpenEventsHub')"));
  assert.equal(callbacks.length, 3);
  callbacks.forEach(fn => fn());
  f.run('grantAllRogueSkillsInRun(); SaveState.applyMaxAllSystems(true)');
  assert.equal(JSON.stringify(f.S), before);
});

test('Cờ dev không được bật qua URL trên hostname công khai', () => {
  const f = fixture();
  f.ctx.location = { search: '?dev=1', hostname: 'audit.invalid' };
  f.ctx.URLSearchParams = URLSearchParams;
  f.ctx.localStorage = { getItem: () => null, setItem() {} };
  f.run(between('const DEV_CHEATS = (function () {', '// Toàn bộ id nút cheat'));
  assert.equal(f.run('devCheatsEnabled()'), false);
});

for (const [hostname, protocol, query, stored, expected] of [
  ['artemis-puugoo.vercel.app', 'https:', '?dev=1', '1', false],
  ['audit.invalid', 'https:', '', '1', false],
  ['localhost.attacker.invalid', 'https:', '?dev=1', '1', false],
  ['localhost', 'http:', '?dev=1', null, true],
  ['127.0.0.1', 'http:', '', '1', true],
  ['[::1]', 'http:', '?dev=1', null, true],
  ['', 'file:', '?dev=1', null, true],
  ['localhost', 'http:', '', null, false],
]) {
  test(`Dev gate ${protocol}//${hostname} query=${query} stored=${stored}`, () => {
    const f = fixture();
    f.ctx.location = { hostname, protocol, search: query };
    f.ctx.URLSearchParams = URLSearchParams;
    let writes = 0;
    f.ctx.localStorage = { getItem: () => stored, setItem() { writes++; } };
    f.run(between('const DEV_CHEATS = (function () {', '// Toàn bộ id nút cheat'));
    assert.equal(f.run('devCheatsEnabled()'), expected);
    if (!expected) assert.equal(writes, 0);
  });
}

test('N03 bỏ số đếm không hữu hạn/âm, chặn tăng sau hoàn thành', () => {
  const f = fixture();
  for (const count of [-1,0,NaN,Infinity,'invalid']) f.ctx.hooks.onLoot(count);
  assert.equal(f.S.beginnerJourney._lootCount, undefined);
  f.ctx.hooks.onLoot(99);
  assert.equal(f.S.beginnerJourney._lootCount, 10);
  const saved = f.ctx.window.__ARTEMIS_SAVE_BUFFER;
  f.ctx.hooks.onLoot(99);
  assert.equal(f.ctx.window.__ARTEMIS_SAVE_BUFFER, saved);
});

test('Schema N03 clamp giá trị cũ/lỗi mà không xoá completedSteps và claimedRewards', () => {
  for (const [raw, expected] of [[6,6],[99,10],[-1,0],['7',7],[null,0],['bad',0]]) {
    const s = sanitizeSave({ beginnerJourney: { startedAt: 1, _lootCount: raw, completedSteps: ['N01','N02'], claimedRewards: ['N01'] } }).data;
    assert.equal(s.beginnerJourney._lootCount, expected);
    assert.deepEqual(s.beginnerJourney.completedSteps, ['N01','N02']);
    assert.deepEqual(s.beginnerJourney.claimedRewards, ['N01']);
  }
});

test('save() trước khi ready không thay buffer đang có', () => {
  const f = fixture();
  f.ctx.window.__ARTEMIS_SAVE_READY = false;
  f.ctx.window.__ARTEMIS_SAVE_BUFFER = 'existing-buffer-sentinel';
  f.S.save();
  assert.equal(f.ctx.window.__ARTEMIS_SAVE_BUFFER, 'existing-buffer-sentinel');
});

test('N03 giữ 6 lượt nhặt qua serialize + sanitize + nạp lại, rồi đạt 10', () => {
  const first = fixture();
  first.ctx.hooks.onLoot(6);
  first.S.save();
  const server = sanitizeSave(first.saved()).data;
  assert.equal(server.beginnerJourney._lootCount, 6);
  const second = fixture({ beginnerJourney: server.beginnerJourney });
  second.ctx.hooks.onLoot(4);
  assert.ok(second.S.beginnerJourney.completedSteps.includes('N03'));
});
