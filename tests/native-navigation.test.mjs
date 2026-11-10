import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const sourcePath = new URL('../public/native-navigation.js', import.meta.url);
const ids = ['tabBattle', 'tabEquip', 'tabEvents', 'tabShopVn', 'tabGuild'];

function fixture({ readyState = 'complete', running = false } = {}) {
  const observers = [];
  class Element {
    constructor(id = '') { this.id = id; this.dataset = {}; this.attributes = {}; this.children = []; this.listeners = {}; this._className = ''; }
    set className(value) { this._className = value; for (const o of observers) if (o.targets.has(this)) o.records.push({ target: this }); }
    get className() { return this._className; }
    get classList() { return { contains: value => this.className.split(/\s+/).includes(value), toggle: (value, enabled) => { const set = new Set(this.className.split(/\s+/).filter(Boolean)); enabled ? set.add(value) : set.delete(value); this.className = [...set].join(' '); } }; }
    setAttribute(name, value) { this.attributes[name] = String(value); if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
    getAttribute(name) { return name === 'data-tab' ? this.dataset.tab : this.attributes[name]; }
    appendChild(child) { this.children = this.children.filter(item => item !== child); this.children.push(child); return child; }
    addEventListener(name, fn, capture = false) { (this.listeners[name] ||= []).push({ fn, capture }); }
    removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] || []).filter(item => item !== fn); }
    click() { for (const capture of [true, false]) for (const l of this.listeners.click || []) if (l.capture === capture) l.fn({ target: this }); }
    querySelector(selector) { return selector === '.grid' ? grid : null; }
    querySelectorAll() { return this.children.filter(child => child.classList.contains('nav-tab-btn')); }
  }
  const grid = new Element();
  grid.className = 'grid grid-cols-5';
  const nav = new Element('bottomNavBar');
  const sections = Object.fromEntries([...ids, 'tabTalents', 'gearHeroStage', 'subpanelGear', 'subpanelCharacters', 'subpanelRunes', 'subpanelArtifacts', 'subpanelItems'].map(id => { const element = new Element(id); element.className = id === 'tabEquip' || id === 'subpanelGear' ? '' : 'hidden'; return [id, element]; }));
  const gearButtons = ['gear', 'characters', 'runes', 'artifacts', 'items'].map(sub => { const b = new Element(); b.setAttribute('data-gear-subtab', sub); return b; });
  const buttons = ids.map(id => { const b = new Element(); b.dataset.tab = id; b.className = 'nav-tab-btn'; grid.appendChild(b); return b; });
  const docListeners = {};
  const document = {
    readyState,
    createElement: () => new Element(),
    querySelector: selector => {
      const tab = selector.match(/data-tab="([^"]+)"/);
      if (tab) return grid.children.find(b => b.classList.contains('nav-tab-btn') && b.dataset.tab === tab[1]) || null;
      const sub = selector.match(/data-gear-subtab="([^"]+)"/);
      return sub ? gearButtons.find(b => b.dataset.gearSubtab === sub[1]) : null;
    },
    getElementById: id => id === nav.id ? nav : sections[id] || null,
    querySelectorAll: selector => selector.includes('.nav-tab-btn') ? grid.children.filter(b => b.classList.contains('nav-tab-btn')) : selector.includes('.gear-subtab-btn') ? gearButtons : [],
    addEventListener: (name, fn) => { docListeners[name] = fn; },
  };
  // Execute the application's real existing click handlers, not a replacement router.
  const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const handlerStart = index.indexOf("      const NAV_TAB_IDS = ['tabBattle'");
  const handlerEnd = index.indexOf('      // Nút trong tab Thẻ', handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  const calls = { guild: 0, lobby: 0 };
  const context = vm.createContext({ document, window: {}, queueMicrotask, MutationObserver: class { constructor(fn) { this.fn = fn; this.targets = new Set(); this.records = []; observers.push(this); } observe(target) { this.targets.add(target); } takeRecords() { const records = this.records; this.records = []; return records; } disconnect() { this.disconnected = true; } }, Game: { running }, SaveState: { activeGearSubtab: 'gear' }, closeHeroUpgradeDisclosures() {}, SoundFX: { coinPickup() {} }, renderHeroRoster() {}, renderGuildPanel() { calls.guild++; }, setActiveEventsArea() {}, activeEventsArea: '', renderLobbyUI() { calls.lobby++; } });
  vm.runInContext(index.slice(handlerStart, handlerEnd), context);
  const subStart = index.indexOf("      document.querySelectorAll('.gear-subtab-btn').forEach(btn => {");
  const subEnd = index.indexOf('      // Sort Button', subStart);
  assert.ok(subStart >= 0 && subEnd > subStart);
  vm.runInContext(index.slice(subStart, subEnd), context);
  vm.runInContext(readFileSync(sourcePath, 'utf8'), context);
  return { context, document, nav, grid, buttons, sections, observers, docListeners, gearButtons, calls };
}

const flush = () => new Promise(resolve => queueMicrotask(resolve));

test('native navigation implementation exists', () => assert.ok(existsSync(sourcePath)));

test('shows exactly five screenshot destinations and preserves a hidden original Guild button', () => {
  const f = fixture();
  assert.deepEqual(f.grid.children.filter(b => !b.hidden).map(b => b.dataset.nativeItem), ['tabShopVn', 'tabEquip', 'tabBattle', 'nativeArtifacts', 'tabEvents']);
  assert.equal(f.grid.children.length, 6);
  for (const button of f.grid.children.filter(b => !b.hidden)) {
    assert.match(button.innerHTML, /<svg/);
    assert.match(button.innerHTML, /aria-hidden="true"/);
    assert.ok(button.getAttribute('aria-label'));
  }
  assert.deepEqual(f.grid.children.filter(b => !b.hidden).map(b => b.getAttribute('aria-label')), ['Cửa Hàng', 'Trang bị', 'Chiến Dịch', 'Vật Sưu Tầm', 'Sự kiện']);
  assert.match(f.buttons.find(b => b.dataset.tab === 'tabEvents').innerHTML, /native-nav-alert/);
  assert.equal(f.buttons.find(b => b.dataset.tab === 'tabEquip').dataset.nativeActive, 'true');
});

test('real app click handlers continue switching sections after className replacement', async () => {
  const f = fixture();
  for (const button of f.buttons) {
    button.click();
    await flush();
    assert.equal(f.sections[button.dataset.tab].classList.contains('hidden'), false);
    if (button.dataset.tab === 'tabGuild') {
      assert.equal(f.grid.children.filter(b => b.dataset.nativeActive === 'true').length, 0);
    } else {
      assert.equal(button.dataset.nativeActive, 'true');
      assert.equal(button.getAttribute('aria-current'), 'page');
      assert.equal(f.grid.children.filter(b => b.dataset.nativeActive === 'true').length, 1);
    }
  }
});

test('does not claim a blocked navigation succeeded while Game.running', async () => {
  const f = fixture({ running: true });
  f.buttons.find(b => b.dataset.tab === 'tabShopVn').click();
  await flush();
  assert.equal(f.buttons.find(b => b.dataset.tab === 'tabEquip').dataset.nativeActive, 'true');
  assert.equal(f.buttons.find(b => b.dataset.tab === 'tabShopVn').dataset.nativeActive, 'false');
});

test('section observer follows programmatic navigation and talent subpage without a fake active tab', () => {
  const f = fixture();
  f.sections.tabEquip.className = 'hidden';
  f.sections.tabGuild.className = '';
  f.observers[0].fn();
  assert.equal(f.grid.children.filter(b => b.dataset.nativeActive === 'true').length, 0);
  f.sections.tabGuild.className = 'hidden';
  f.sections.tabTalents.className = '';
  f.observers[0].fn();
  assert.equal(f.buttons.filter(b => b.dataset.nativeActive === 'true').length, 0);
});

test('initialization is idempotent and waits for DOMContentLoaded', () => {
  const f = fixture({ readyState: 'loading' });
  assert.equal(f.nav.dataset.nativeNavigation, undefined);
  f.docListeners.DOMContentLoaded();
  const api = f.context.window.ArtemisNativeNavigation;
  assert.ok(api);
  api.init();
  assert.equal(f.observers.length, 1);
  assert.equal(f.grid.children.filter(b => !b.hidden).length, 5);
});

test('trophy routes through real gear handler; equipment returns to gear, without recursion', async () => {
  const f = fixture();
  const trophy = f.grid.children.find(b => b.dataset.nativeItem === 'nativeArtifacts');
  assert.ok(trophy);
  assert.equal(trophy.dataset.tab, undefined);
  assert.equal(trophy.classList.contains('nav-tab-btn'), false);
  for (let i = 0; i < 3; i++) {
    trophy.click(); await flush();
    assert.equal(f.context.SaveState.activeGearSubtab, 'artifacts');
    assert.equal(f.sections.tabEquip.classList.contains('hidden'), false);
    assert.equal(f.sections.subpanelArtifacts.classList.contains('hidden'), false);
    assert.equal(f.sections.subpanelGear.classList.contains('hidden'), true);
    assert.equal(trophy.dataset.nativeActive, 'true');
    assert.equal(f.buttons.find(b => b.dataset.tab === 'tabEquip').dataset.nativeActive, 'false');
    f.context.window.gotoNavTab('tabEquip'); await flush();
    assert.equal(f.context.SaveState.activeGearSubtab, 'gear');
    assert.equal(f.sections.subpanelArtifacts.classList.contains('hidden'), true);
    assert.equal(trophy.dataset.nativeActive, 'false');
  }
  assert.equal(f.calls.guild, 0);
  assert.equal(f.calls.lobby, 12, 'each action invokes exactly one nav and one subtab handler');
});

test('Guild remains reachable by original gotoNavTab and does not highlight collection', async () => {
  const f = fixture();
  const guild = f.buttons.find(b => b.dataset.tab === 'tabGuild');
  assert.equal(guild.hidden, true);
  assert.equal(guild.getAttribute('data-native-legacy'), 'true');
  f.context.window.gotoNavTab('tabGuild'); await flush();
  assert.equal(f.calls.guild, 1);
  assert.equal(f.sections.tabGuild.classList.contains('hidden'), false);
  assert.equal(f.grid.children.filter(b => b.dataset.nativeActive === 'true').length, 0);
});

test('blocked shortcut cannot change subtab even when equipment is already visible', async () => {
  for (const sub of ['gear', 'artifacts']) {
    const f = fixture({ running: true });
    f.gearButtons.find(b => b.dataset.gearSubtab === sub).click();
    f.context.window.ArtemisNativeNavigation.init().sync();
    const before = f.calls.lobby;
    f.grid.children.find(b => b.dataset.nativeItem === 'nativeArtifacts').click();
    f.buttons.find(b => b.dataset.tab === 'tabEquip').click();
    await flush();
    assert.equal(f.context.SaveState.activeGearSubtab, sub);
    assert.equal(f.calls.lobby, before);
  }
});

test('subpanel observer tracks actual subtab changes, including direct programmatic clicks', () => {
  const f = fixture();
  assert.ok(f.observers[0].targets.has(f.sections.subpanelArtifacts));
  for (const sub of ['artifacts', 'runes', 'artifacts', 'characters']) {
    f.gearButtons.find(b => b.dataset.gearSubtab === sub).click();
    f.observers[0].fn();
    const active = f.grid.children.filter(b => b.dataset.nativeActive === 'true');
    assert.equal(active.length, 1);
    assert.equal(active[0].dataset.nativeItem, sub === 'artifacts' ? 'nativeArtifacts' : 'tabEquip');
  }
});
