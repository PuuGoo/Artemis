import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../public/patrol.js', import.meta.url), 'utf8');
const preview = { elapsedSeconds: 7200, capSeconds: 86400, canClaim: true, bestClearedChapter: 3,
  ratesPerHour: {gold: 420, exp: 210}, rewards: {gold: 840, exp: 420, aurocite: 2, gearScrolls: {weapon: 2}},
  quickEnergy: {cost: 5, remaining: 3, rewards: {gold: 840}}, quickAd: {available: false, remaining: 0} };
function fixture(cloud) {
  let root; const listeners = {};
  const document = {activeElement: null, body: { appendChild(node) {root = node;} }, createElement() {
    return {hidden: true, innerHTML: '', classList: {contains: () => false}, addEventListener(name, fn) {listeners[name] = fn;},
      contains: () => false, querySelector() {return {focus() {}, textContent: ''};}, querySelectorAll: () => []};
  }};
  const window = {ArtemisCloud: cloud, crypto: {randomUUID: () => 'test-request-unique'}};
  vm.runInNewContext(source, {window, document, fetch() {throw new Error('unexpected fetch');}, setInterval: () => 1, clearInterval() {}, Date, Math, console});
  return {api: window.ArtemisPatrol, root: () => root, click(action) {listeners.click({target: {classList: {contains: () => false}, closest: () => ({disabled: false, getAttribute: () => action})}});}, key(key) {listeners.keydown({key, preventDefault() {}, stopPropagation() {}});} };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('loads real helper preview; renders server rates, all resource quantities and safe accessible dialog', async () => {
  let calls = 0; const f = fixture({patrolPreview: async () => {calls++; return {ok: true, data: {gold: 100}, revision: 4, patrol: preview};}});
  await f.api.open(); assert.equal(calls, 1); assert.match(f.root().innerHTML, /Thu Nhập Tuần Tra/); assert.match(f.root().innerHTML, /420 \/ h/);
  assert.match(f.root().innerHTML, /02:00:00/); assert.match(f.root().innerHTML, /aria-modal="true"/); assert.match(f.root().innerHTML, /Cuộn vũ khí/);
  f.click('quick'); assert.match(f.root().innerHTML, /ϟ × 5/); assert.match(f.root().innerHTML, /data-patrol="quickAd" disabled/);
  assert.doesNotMatch(f.root().innerHTML, /data-patrol="quickEnergy" disabled/); f.api.close(); f.api.close();
});
test('mutations only use cloud transaction helper, double taps cannot issue duplicate requests', async () => {
  let resolve, requests = []; const f = fixture({patrolPreview: async () => ({ok: true, patrol: preview}), patrolRequest: (action, id) => {requests.push({action, id}); return new Promise(r => {resolve = r;});}});
  await f.api.open(); f.click('claim'); f.click('claim'); assert.equal(requests.length, 1); assert.equal(requests[0].action, 'claim');
  f.api.close(); assert.equal(f.root().hidden, false); resolve({ok: true, patrol: {...preview, canClaim: false}, rewards: {gold: 840}}); await settle();
  assert.match(f.root().innerHTML, /Thưởng đã nhận/); assert.match(f.root().innerHTML, /840/); f.key('Escape'); assert.match(f.root().innerHTML, /Thu Nhập Tuần Tra/); f.key('Escape'); assert.equal(f.root().hidden, true);
});
test('ambiguous network failures preserve request id and retry the same transaction', async () => {
  const ids = []; const f = fixture({patrolPreview: async () => ({ok: true, patrol: preview}), patrolRequest: async (action, id) => {ids.push(id); if (ids.length === 1) throw new Error('Mất kết nối'); return {ok: true, patrol: preview, rewards: {gold: 1}};}});
  await f.api.open(); f.click('claim'); await settle(); assert.match(f.root().innerHTML, /Mất kết nối/); f.click('retry'); await settle();
  assert.equal(ids.length, 2); assert.equal(ids[0], ids[1]); assert.match(f.root().innerHTML, /Thưởng đã nhận/);
});
test('preview failure supports retry; malicious reward names are escaped', async () => {
  let count = 0; const f = fixture({patrolPreview: async () => {if (++count === 1) throw new Error('Máy chủ tạm ngừng'); return {ok: true, patrol: {...preview, rewards: [{key: 'gold', amount: 1, name: '<script>alert(1)</script>'}]}};}});
  await f.api.open(); assert.match(f.root().innerHTML, /Máy chủ tạm ngừng/); f.click('retry'); await settle(); assert.doesNotMatch(f.root().innerHTML, /<script>/); assert.match(f.root().innerHTML, /&lt;script&gt;/);
});
test('no local save mutation or unguarded POST; artwork references exist', () => {
  assert.doesNotMatch(source, /SaveState|loadCloudSave|method:\s*['"]POST/);
  assert.match(source, /cloud\.patrolRequest\(action, pending.id\)/);
  const css = fs.readFileSync(new URL('../public/patrol.css', import.meta.url), 'utf8');
  assert.match(css, /repeat\(5/); assert.match(css, /max-height:calc\(100dvh/); assert.match(css, /prefers-reduced-motion/);
  for (const path of ['assets/patrol-scene.svg', 'assets/runes/crystals/Rune_bless_10.png', 'assets/gear/oracle-armor.png']) assert.ok(fs.existsSync(new URL('../public/' + path, import.meta.url)), path);
});
