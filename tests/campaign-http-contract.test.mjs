import test from 'node:test';
import assert from 'node:assert/strict';

test('campaign fixture dispatches real registration/cookie/save handlers over loopback HTTP', async () => {
  const { startFixture } = await import('../tools/verify-campaign-http.mjs');
  const fixture = await startFixture();
  try {
    const anonymous = await fetch(fixture.origin + '/api/save');
    assert.equal(anonymous.status, 401);
    const response = await fetch(fixture.origin + '/api/auth/register', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'campaign_contract',password:'fixture-password-only'})});
    assert.equal(response.status, 201);
    const cookieHeader = response.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly/i);
    const headers = {Cookie:cookieHeader.split(';')[0],'Content-Type':'application/json'};
    const snapshot = await (await fetch(fixture.origin + '/api/save', {headers})).json();
    assert.equal(snapshot.hasSave, true);
    const put = await fetch(fixture.origin + '/api/save', {method:'PUT',headers,body:JSON.stringify({playerId:snapshot.playerId,revision:snapshot.revision,data:snapshot.data})});
    assert.equal(put.status, 200);
    const readback = await (await fetch(fixture.origin + '/api/save',{headers})).json();
    assert.equal(readback.revision,snapshot.revision+1);
    assert.deepEqual(readback.data.dungeonCheckpoint,snapshot.data.dungeonCheckpoint);
    const stale = await fetch(fixture.origin + '/api/save',{method:'PUT',headers,body:JSON.stringify({revision:snapshot.revision,data:snapshot.data})});
    assert.equal(stale.status,409);
    assert.equal((await (await fetch(fixture.origin + '/api/save',{headers})).json()).revision,readback.revision);
  } finally { await fixture.close(); }
});
