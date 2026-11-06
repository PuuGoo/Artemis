import test from 'node:test';
import assert from 'node:assert/strict';
import { readSessionToken } from '../lib/auth.js';
import { GET as me } from '../api/auth/me.js';
import { GET as getSave, PUT as putSave } from '../api/save.js';

test('Endpoints thật xử lý cookie hỏng như chưa đăng nhập, không cần Mongo', async () => {
  const request = new Request('http://localhost/api/auth/me', {headers:{cookie:'artemis_session=%ZZ'}});
  const response = await me(request);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).authenticated, false);
  assert.equal((await getSave(request)).status, 401);
  assert.equal((await putSave(request)).status, 401);
});

test('Cookie phiên malformed phải fail closed, không ném URIError', () => {
  for (const cookie of ['artemis_session=%ZZ', 'artemis_session=%', 'artemis_session=%E0%A4%A']) {
    assert.equal(readSessionToken(new Request('http://localhost/', {headers:{cookie}})), null);
  }
});
test('Cookie hợp lệ và thiếu cookie vẫn giữ contract cũ', () => {
  assert.equal(readSessionToken(new Request('http://localhost/')), null);
  assert.equal(readSessionToken(new Request('http://localhost/', {headers:{cookie:'other=x; artemis_session=abc%2Edef%2Eghi'}})), 'abc.def.ghi');
});
