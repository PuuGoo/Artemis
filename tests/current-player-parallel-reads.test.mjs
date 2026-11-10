import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import * as moduleHooks from 'node:module';
import { ObjectId } from 'mongodb';
import { signSession } from '../lib/auth.js';
import { getMongoDb, COLLECTIONS } from '../lib/mongo.js';
import { resetMemoryDb } from '../lib/mongoMemory.js';

process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');

// Intercept only http.js's repository dependency. JWT verification and all
// document reads remain real; wrappers merely gate the memory repository.
const repositoryKey = Symbol.for('artemis.current-player-test.repository');
const httpUrl = new URL('../lib/http.js', import.meta.url).href;
const mongoUrl = new URL('../lib/mongo.js', import.meta.url).href;
const repositoryUrl = `data:text/javascript,${encodeURIComponent(`
  export { COLLECTIONS } from ${JSON.stringify(mongoUrl)};
  export async function getMongoDb() {
    return globalThis[Symbol.for('artemis.current-player-test.repository')];
  }
`)}`;
const loaderSource = `
  export async function resolve(specifier, context, nextResolve) {
    if (context.parentURL === ${JSON.stringify(httpUrl)} && specifier === './mongo.js') {
      return { url: ${JSON.stringify(repositoryUrl)}, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
`;
// npm currently uses Node 22.13; newer Node supports synchronous hooks.
const hooks = moduleHooks.registerHooks?.({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === httpUrl && specifier === './mongo.js') {
      return { url: repositoryUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
if (!hooks) moduleHooks.register(`data:text/javascript,${encodeURIComponent(loaderSource)}`, import.meta.url);
const { getCurrentPlayer } = await import('../lib/http.js');
hooks?.deregister();

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture(t, { sub, ep = 0, epoch = 0, insertPlayer = true, revocation } = {}) {
  resetMemoryDb();
  const db = await getMongoDb();
  const _id = new ObjectId();
  if (insertPlayer) await db.collection(COLLECTIONS.players).insertOne({ _id, usernameLower: 'latency_test', sessionEpoch: epoch });
  const jti = 'latency-test-session';
  if (revocation) await db.collection(COLLECTIONS.revokedSessions).insertOne({ _id: jti, ...revocation });
  globalThis[repositoryKey] = db;
  t.after(() => { delete globalThis[repositoryKey]; resetMemoryDb(); });
  const token = await signSession({ sub: sub ?? _id.toHexString(), ep, jti });
  return { db, _id, request: new Request('http://localhost/', { headers: { cookie: `artemis_session=${token}` } }) };
}

function interceptReads(db, onRead) {
  globalThis[repositoryKey] = {
    collection(name) {
      const collection = db.collection(name);
      return { ...collection, async findOne(...args) {
        await onRead(name, args);
        return collection.findOne(...args);
      } };
    },
  };
}

test('authenticated player and revocation reads overlap and authentication waits for both', async t => {
  const { db, _id, request } = await fixture(t);
  const playerStarted = deferred();
  const revocationStarted = deferred();
  const releasePlayer = deferred();
  const releaseRevocation = deferred();
  const started = [];
  interceptReads(db, async name => {
    started.push(name);
    if (name === COLLECTIONS.players) {
      playerStarted.resolve();
      await releasePlayer.promise;
    } else {
      revocationStarted.resolve();
      await releaseRevocation.promise;
    }
  });
  let settled = false;
  const result = getCurrentPlayer(request).finally(() => { settled = true; });
  try {
    await playerStarted.promise;
    // No latency threshold: allow the current turn to finish while the player
    // read is blocked. The revocation read must already have started.
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(started, [COLLECTIONS.players, COLLECTIONS.revokedSessions]);
    releasePlayer.resolve();
    await revocationStarted.promise;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false, 'must not authenticate before revocation finishes');
    releaseRevocation.resolve();
    assert.ok((await result)._id.equals(_id));
  } finally {
    releasePlayer.resolve();
    releaseRevocation.resolve();
    await result;
  }
});

for (const [name, options] of [
  ['revoked session', { revocation: { revokedAt: new Date() } }],
  ['revocation with expiresAt fallback', { revocation: { expiresAt: new Date() } }],
  ['revocation without timestamps', { revocation: {} }],
  ['stale token epoch', { ep: 1, epoch: 2 }],
  ['missing player', { insertPlayer: false }],
]) {
  test(`getCurrentPlayer rejects ${name}`, async t => {
    const { request } = await fixture(t, options);
    assert.equal(await getCurrentPlayer(request), null);
  });
}

test('invalid player id rejects before either repository read', async t => {
  const { db, request } = await fixture(t, { sub: 'not-an-object-id' });
  interceptReads(db, () => assert.fail('invalid ids must not query repositories'));
  assert.equal(await getCurrentPlayer(request), null);
});

for (const failedCollection of [COLLECTIONS.players, COLLECTIONS.revokedSessions]) {
  test(`getCurrentPlayer fails closed on ${failedCollection} read failure`, async t => {
    const { db, request } = await fixture(t);
    const failure = new Error(`${failedCollection} unavailable`);
    interceptReads(db, name => { if (name === failedCollection) throw failure; });
    await assert.rejects(getCurrentPlayer(request), error => error === failure);
  });
}
