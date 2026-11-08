import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { SHOP_OFFERS } from '../lib/shop/catalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));
function apiFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? apiFiles(file) : /\.(?:[cm]?js|ts)$/.test(entry.name) ? [file] : [];
  });
}

test('Vercel Hobby deployment stays within 12 functions while preserving the shop URL', () => {
  const functions = apiFiles(path.join(root, 'api'));
  assert.ok(functions.length <= 12, `Có ${functions.length} function; Vercel Hobby chỉ cho phép 12`);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const rewrite = config.rewrites?.find(rule => rule.source === '/api/shop');
  assert.ok(rewrite, 'Phải giữ URL /api/shop khi gộp function');
  const destination = new URL(rewrite.destination, 'https://artemis.test');
  assert.equal(destination.pathname, '/api/privileges');
  assert.equal(destination.searchParams.get('__resource'), 'shop');
  assert.equal(fs.existsSync(path.join(root, 'api/shop.js')), false, 'Không còn function shop riêng');
});

test('local HTTP preserves shop rewrites and VIP cards with isolated memory DB and no real .env', { timeout: 12000 }, async () => {
  const fixture = fs.mkdtempSync(path.join(tmpdir(), 'artemis-routing-'));
  let child;
  try {
    fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ type: 'module' }));
    for (const file of ['dev-server.mjs', 'vercel.json']) fs.copyFileSync(path.join(root, file), path.join(fixture, file));
    const helper = 'lib/httpRouting.js';
    if (fs.existsSync(path.join(root, helper))) {
      fs.mkdirSync(path.join(fixture, 'lib'), { recursive: true });
      fs.copyFileSync(path.join(root, helper), path.join(fixture, helper));
    }
    for (const file of ['api/auth/register.js', 'api/admin/players.js', 'api/save.js', 'api/privileges.js']) {
      const target = path.join(fixture, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `export * from ${JSON.stringify(pathToFileURL(path.join(root, file)).href)};\n`);
    }
    assert.equal(fs.existsSync(path.join(fixture, '.env')), false);
    const reserve = createServer();
    await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
    const port = reserve.address().port;
    await new Promise(resolve => reserve.close(resolve));
    const adminName = `routeadmin_${randomBytes(3).toString('hex')}`;
    child = spawn(process.execPath, ['--max-old-space-size=128', path.join(fixture, 'dev-server.mjs')], {
      cwd: fixture, env: { ...process.env, PORT: String(port), NODE_ENV: 'test', DB_BACKEND: 'memory',
        MONGODB_URI: '', JWT_SECRET: randomBytes(24).toString('hex'), ADMIN_USERNAMES: adminName },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let output = '';
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Local fixture startup timed out')), 5000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Local fixture exited ${code}: ${output.slice(-1000)}`)); });
      child.stderr.on('data', data => { output = (output + data).slice(-4000); });
      child.stdout.on('data', data => {
        output = (output + data).slice(-4000);
        if (output.includes('Artemis dev server:')) { clearTimeout(timer); resolve(); }
      });
    });
    const request = (method, route, cookie, body) => fetch(`http://127.0.0.1:${port}${route}`, {
      method, redirect: 'error', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal((await request('GET', '/api/shop')).status, 401, 'Shop URL phải đến handler, không phải 404');
    assert.equal((await request('GET', '/api/privileges')).status, 405);
    async function account(username) {
      const response = await request('POST', '/api/auth/register', null, { username, password: 'routing-fixture-password' });
      assert.equal(response.status, 201);
      return response.headers.get('set-cookie').split(';')[0];
    }
    const admin = await account(adminName), cookie = await account(`routeuser_${randomBytes(3).toString('hex')}`);
    const save = async () => (await request('GET', '/api/save', cookie)).json();
    const before = await save();
    const grant = await request('PATCH', '/api/admin/players', admin, { playerId: before.playerId, action: 'grant', payload: { vipCoins: 1000 } });
    assert.equal(grant.status, 200);
    for (const route of ['/api/shop', '/api/privileges?__resource=shop']) {
      const response = await request('GET', route, cookie);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).offers.length, SHOP_OFFERS.length);
    }
    const current = await save();
    const order = { playerId: current.playerId, revision: current.revision, offerId: 'gems_80', requestId: randomUUID() };
    assert.equal((await request('POST', '/api/shop?__resource=not-shop', cookie, order)).status, 200, 'Rewrite phải giữ discriminator của cấu hình');
    assert.equal((await request('POST', '/api/privileges', cookie, { cardId: 'hunting' })).status, 200);
    const after = await save();
    assert.equal(after.data.vipCoins, 1000 - 24 - 500);
    assert.equal(after.data.gems, before.data.gems + 160);
    assert.ok(after.data.vipPasses.hunting > Date.now());
    const replay = await request('POST', '/api/shop', cookie, order);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).replayed, true);
    assert.deepEqual(await save(), after);
  } finally {
    if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
