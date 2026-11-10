import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js = fs.readFileSync(new URL('../public/native-campaign.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/native-campaign.css', import.meta.url), 'utf8');
function fixture({cleared = false, locked = false} = {}) {
  const nodes = [];
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.dataset = {}; this.textContent = ''; this.listeners = {}; this.attrs = {}; this.className = ''; this.classList = {contains: c => this.className.split(' ').includes(c), toggle: (c, on) => {const names = new Set(this.className.split(' ').filter(Boolean)); if(on) names.add(c); else names.delete(c); this.className = [...names].join(' ');}}; nodes.push(this); }
    append(...els) { this.children.push(...els); }
    prepend(...els) { this.children.unshift(...els); }
    setAttribute(k,v) { this.attrs[k] = v; }
    addEventListener(k,v) { this.listeners[k] = v; }
    querySelector(s) { return this.children.find(e => e.className?.split(' ').includes(s.slice(1))) || this.children.map(e => e.querySelector(s)).find(Boolean) || null; }
    click() { this.listeners.click?.(); }
  }
  const screen = new Element(), map = new Element(), art = new Element();
  art.className = `ms-art${locked ? ' is-locked' : ''}`;
  const kicker = new Element(); kicker.className = 'ms-kicker'; kicker.textContent = `CHƯƠNG 7${cleared ? ' · ĐÃ PHÁ ĐẢO' : ''}`;
  const top = new Element(); top.className = 'ms-topbar'; art.append(kicker, top);
  const progress = new Element(); progress.className = 'ms-prog-main'; progress.textContent = '12/50 phòng đã qua'; map.append(art, progress);
  const selectors = [];
  const document = {readyState:'complete', getElementById:id => ({tabBattle:screen,mapSelectPanel:map})[id], createElement:t => new Element(t), querySelector:s => {selectors.push(s); return null;}};
  let observes = 0, disconnects = 0, callback;
  class MutationObserver {constructor(fn) {callback = fn;} observe() {observes++;} disconnect() {disconnects++;}}
  const window = {gotoNavTab: tab => selectors.push(tab)};
  vm.runInNewContext(js, {document,window,MutationObserver});
  return {nodes,screen,map,art,window,selectors,mutate:()=>callback(), get observes(){return observes;},get disconnects(){return disconnects;}};
}
test('decorates real selected chapter, no fake completion', () => {
  const f = fixture();
  assert.equal(f.art.querySelector('.native-campaign-chapter').textContent, '7');
  assert.equal(f.art.querySelector('.native-campaign-status').textContent, '12/50 phòng đã qua');
  assert.equal(f.art.querySelector('.native-campaign-stars'), null);
  assert.equal(f.art.querySelector('.native-campaign-island').attrs['aria-hidden'], 'true');
});
test('cleared and locked reflect renderer state only', () => {
  assert.equal(fixture({cleared:true}).art.querySelector('.native-campaign-status').textContent, 'Đã vượt ải');
  assert.equal(fixture({cleared:true}).art.querySelector('.native-campaign-stars').textContent, '★ ★ ★');
  assert.equal(fixture({locked:true}).art.querySelector('.native-campaign-status').textContent, 'Chưa mở khóa');
});
test('observer disconnects around writes and decoration is idempotent', () => {
  const f = fixture(); const count = f.nodes.length;
  f.mutate(); f.window.ArtemisNativeCampaign.refresh();
  assert.equal(f.nodes.length, count);
  assert.equal(f.disconnects, 1); assert.equal(f.observes, 2);
});
test('shortcuts use real navigation, no state/economy mutations', () => {
  const f = fixture(); const guild = f.nodes.find(n => n.attrs['aria-label'] === 'Bộ Lạc'); guild.click();
  assert.ok(f.selectors.includes('tabGuild'));
  assert.doesNotMatch(js, /SaveState\s*\.|localStorage|fetch\s*\(/);
  assert.doesNotMatch(js, /btnStartGame.*addEventListener/);
  assert.match(css, /startNewRun/); assert.doesNotMatch(css, /content:\s*['"]⚡\s*[x×]5/);
});
test('original self-contained SVG assets exist; portrait layout is scoped', () => {
  for (const file of ['island','icons','map']) {
    const source = fs.readFileSync(new URL(`../public/assets/native-campaign-${file}.svg`, import.meta.url),'utf8');
    assert.match(source, /<svg/); assert.match(source, /viewBox=/); assert.doesNotMatch(source, /<image|<script|href="https?:/);
  }
  assert.match(css, /max-width:562px/); assert.match(css, /prefers-reduced-motion/);
});
