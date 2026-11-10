import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const kinds = ['valkyrie', 'angel', 'devil', 'wheel'];
const artFile = 'campaign-npc-art.js';
const wrappers = ['campaign-valkyrie.js', 'campaign-encounters.js', 'campaign-wheel.js'];
const methods = new Set([
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo',
  'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'fill', 'stroke', 'clip',
  'fillRect', 'strokeRect', 'clearRect', 'translate', 'rotate', 'scale',
  'transform', 'setTransform', 'resetTransform', 'fillText', 'strokeText',
  'setLineDash', 'getLineDash', 'measureText', 'getTransform',
]);
const geometry = new Set([
  'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo',
  'ellipse', 'rect', 'roundRect', 'fillRect', 'strokeRect',
]);

// Record values, not gradient object identities, and fail on invalid coordinates.
function canvas() {
  const trace = [], stack = [];
  const state = { globalAlpha: 1, lineWidth: 1, fillStyle: '#000', strokeStyle: '#000' };
  let saves = 0;
  function normalize(value) {
    if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), `Non-finite Canvas argument: ${value}`);
      return Object.is(value, -0) ? 0 : value;
    }
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v !== 'function')
        .map(([k, v]) => [k, normalize(v)]));
    }
    return value;
  }
  function record(name, args) { trace.push([name, ...args.map(normalize)]); }
  const ctx = new Proxy({}, {
    get(_, key) {
      if (key in state) return state[key];
      if (key === 'save') return () => { saves++; stack.push({ ...state }); record('save', []); };
      if (key === 'restore') return () => {
        assert.ok(stack.length, 'Canvas restore without matching save');
        for (const name of Object.keys(state)) delete state[name];
        Object.assign(state, stack.pop()); record('restore', []);
      };
      if (['createLinearGradient', 'createRadialGradient', 'createConicGradient'].includes(key)) {
        return (...args) => {
          record(key, args);
          const gradient = { type: key, args: normalize(args), stops: [] };
          gradient.addColorStop = (offset, color) => {
            assert.ok(Number.isFinite(offset) && offset >= 0 && offset <= 1);
            gradient.stops.push([offset, color]); record('addColorStop', [offset, color]);
          };
          return gradient;
        };
      }
      if (methods.has(key)) return (...args) => {
        record(key, args);
        if (key === 'measureText') return { width: String(args[0]).length * 6 };
        if (key === 'getLineDash') return [];
        if (key === 'getTransform') return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      };
      throw Error(`Unexpected Canvas API or external asset access: ${String(key)}`);
    },
    set(_, key, value) { record(`set:${String(key)}`, [value]); state[key] = value; return true; },
  });
  return { ctx, trace, balanced() {
    assert.ok(saves > 0, 'Rendering must isolate its Canvas state');
    assert.equal(stack.length, 0, 'Canvas save/restore must balance');
  } };
}

function load(files, art) {
  const forbidden = name => () => { throw Error(`Renderer must not use ${name}`); };
  const sandbox = {};
  for (const key of ['document', 'Image', 'Audio', 'OffscreenCanvas', 'XMLHttpRequest', 'localStorage']) {
    Object.defineProperty(sandbox, key, { get: forbidden(key) });
  }
  for (const key of ['setTimeout', 'setInterval', 'requestAnimationFrame', 'fetch', 'importScripts']) {
    sandbox[key] = forbidden(key);
  }
  sandbox.window = sandbox;
  if (art !== undefined) sandbox.ArtemisCampaignNPCArt = art;
  const context = vm.createContext(sandbox);
  for (const file of files) {
    const url = new URL(`../public/${file}`, import.meta.url);
    assert.ok(fs.existsSync(url), `Missing planned Canvas renderer: public/${file}`);
    vm.runInContext(fs.readFileSync(url, 'utf8'), context, { filename: file, timeout: 1000 });
  }
  return sandbox;
}
function loadArt() {
  const root = load([artFile]);
  assert.equal(typeof root.ArtemisCampaignNPCArt?.draw, 'function');
  return root.ArtemisCampaignNPCArt;
}
function npcFor(kind) {
  return Object.freeze({ x: 137.5, y: 219.25, r: 22, kind,
    label: 'Custom NPC label', prompt: 'Custom interaction prompt',
    metadata: Object.freeze({ untouched: true }) });
}
function render(api, kind, { now = 1200, low = false, near = false, npc = npcFor(kind) } = {}) {
  const recording = canvas();
  assert.equal(api.draw(recording.ctx, npc, now, low, near, kind), true,
    `Supported ${kind} must report that it rendered`);
  recording.balanced();
  return recording.trace;
}
function silhouette(trace) {
  // Ignore palette, text, gradients and glow style; compare actual shape geometry.
  return trace.filter(([name]) => geometry.has(name));
}

 test('NPC art exposes its classic-script API without DOM, assets or timers', () => {
  const api = loadArt();
  for (const kind of kinds) for (const low of [false, true]) {
    for (const near of [false, true]) render(api, kind, { low, near });
  }
});

test('all four NPC kinds have distinct nontrivial vector silhouettes', () => {
  const api = loadArt();
  const silhouettes = kinds.map(kind => {
    const trace = render(api, kind, { low: true });
    const shape = silhouette(trace);
    assert.ok(shape.length >= 8, `${kind} needs a detailed silhouette, not a placeholder primitive`);
    assert.ok(new Set(shape.map(([name]) => name)).size >= 3,
      `${kind} should combine different vector shapes`);
    assert.ok(trace.some(([name]) => name === 'fill' || name === 'fillRect'), `${kind} must paint`);
    return JSON.stringify(shape);
  });
  assert.equal(new Set(silhouettes).size, kinds.length,
    'A palette or label change alone must not make angel, valkyrie, devil and wheel distinct');
});

test('NPC art leaves frozen NPC data unchanged and balances finite Canvas commands', () => {
  const api = loadArt();
  for (const kind of kinds) {
    const npc = npcFor(kind), before = JSON.stringify(npc);
    for (const low of [false, true]) for (const near of [false, true]) {
      for (const now of [0, 1234.5, 987654]) render(api, kind, { npc, now, low, near });
    }
    assert.equal(JSON.stringify(npc), before);
  }
});

test('low-motion art is time-independent and does not add drawing work', () => {
  const api = loadArt();
  for (const kind of kinds) for (const near of [false, true]) {
    const first = render(api, kind, { now: 0, low: true, near });
    const later = render(api, kind, { now: 98765, low: true, near });
    assert.deepEqual(later, first, `${kind}: low motion must freeze every time-dependent command`);
    const full = render(api, kind, { now: 0, near });
    const work = trace => trace.filter(([name]) => !name.startsWith('set:')).length;
    assert.ok(work(first) <= work(full), `${kind}: low motion should not increase Canvas work`);
  }
});

test('NPC labels and nearby interaction prompts honor caller text', () => {
  const api = loadArt();
  for (const kind of kinds) for (const low of [false, true]) {
    const far = render(api, kind, { low });
    const near = render(api, kind, { low, near: true });
    assert.ok(far.some(([name, text]) => name === 'fillText' && text === 'Custom NPC label'), kind);
    assert.ok(near.some(([name, text]) => name === 'fillText' && text === 'Custom interaction prompt'), kind);
  }
});

test('invalid NPC coordinates and unsupported kinds return false without drawing', () => {
  const api = loadArt();
  for (const kind of kinds) {
    for (const npc of [null, undefined, {}, { x: 1 }, { x: '12', y: 2 },
      { x: NaN, y: 2 }, { x: 1, y: Infinity }, { x: -Infinity, y: 0 }]) {
      const recording = canvas();
      assert.equal(api.draw(recording.ctx, npc, 0, false, false, kind), false);
      assert.deepEqual(recording.trace, [], 'Invalid input must not partially render');
    }
  }
  for (const kind of ['unknown', '', null]) {
    const recording = canvas();
    assert.equal(api.draw(recording.ctx, npcFor('angel'), 0, false, false, kind), false);
    assert.deepEqual(recording.trace, []);
  }
});

function wrapperDraw(root, kind, ctx, npc, now, low, near) {
  if (kind === 'valkyrie') return root.ArtemisCampaignValkyrie.draw(ctx, npc, now, low, near);
  if (kind === 'wheel') return root.ArtemisCampaignWheel.drawNPC(ctx, npc, now, low, near);
  return root.ArtemisCampaignEncounters.draw(ctx, npc, now, low, near);
}

test('existing NPC wrappers delegate all kinds and skip fallback when art handles the draw', () => {
  const calls = [];
  const root = load(wrappers, { draw(...args) { calls.push(args); return true; } });
  for (const kind of kinds) for (const low of [false, true]) for (const near of [false, true]) {
    calls.length = 0;
    const recording = canvas(), npc = npcFor(kind);
    wrapperDraw(root, kind, recording.ctx, npc, 5432, low, near);
    assert.equal(calls.length, 1, `${kind} must delegate exactly once`);
    const [ctx, forwardedNPC, now, forwardedLow, forwardedNear, forwardedKind] = calls[0];
    assert.equal(ctx, recording.ctx);
    assert.equal(forwardedNPC.x, npc.x); assert.equal(forwardedNPC.y, npc.y);
    assert.equal(now, 5432); assert.equal(forwardedLow, low); assert.equal(forwardedNear, near);
    assert.equal(forwardedKind, kind);
    assert.deepEqual(recording.trace, [], 'Handled rendering must not also draw a fallback');
  }
});

test('wrappers retain identical fallback traces when art is absent or declines rendering', () => {
  const absent = load(wrappers);
  const declined = load(wrappers, { draw() { return false; } });
  for (const kind of kinds) for (const low of [false, true]) for (const near of [false, true]) {
    const first = canvas(), second = canvas(), npc = npcFor(kind);
    wrapperDraw(absent, kind, first.ctx, npc, 2500, low, near);
    wrapperDraw(declined, kind, second.ctx, npc, 2500, low, near);
    first.balanced(); second.balanced();
    assert.ok(silhouette(first.trace).length > 0, `${kind} fallback must still paint`);
    assert.deepEqual(second.trace, first.trace, `${kind} fallback should not depend on optional art`);
  }
});
