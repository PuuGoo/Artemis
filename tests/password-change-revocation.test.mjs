// Đổi mật khẩu phải HUỶ toàn bộ phiên cũ.
//
// Đây là nửa còn lại của blocker "JWT không bị thu hồi sau logout/reset-password":
// logout đã xử lý (thu hồi theo jti), còn đổi mật khẩu phải hạ toàn bộ token —
// nếu không, kẻ đã chiếm phiên vẫn vào được 30 ngày sau khi nạn nhân đổi mật khẩu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DB_BACKEND = 'memory';
process.env.JWT_SECRET = randomBytes(24).toString('hex');

const { POST: register } = await import('../api/auth/register.js');
const { POST: login } = await import('../api/auth/login.js');
const { POST: logout } = await import('../api/auth/logout.js');
const { POST: changePassword } = await import('../api/auth/password.js');
const { GET: me } = await import('../api/auth/me.js');

const ORIGIN = 'https://artemis.test';
const OLD_PW = 'matkhau-cu-2026';
const NEW_PW = 'matkhau-moi-2026';

let ipCounter = 0;
/** Mỗi request một IP riêng để không ăn hạn mức rate-limit của test khác. */
function nextIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 250}`;
}

function req(method, path, cookie, body) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': nextIp(),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

async function authed(cookie) {
  if (!cookie) return false;
  const body = await (await me(req('GET', '/api/auth/me', cookie))).json();
  return body.authenticated === true;
}

async function makePlayer() {
  const username = `pwd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const res = await register(req('POST', '/api/auth/register', null, { username, password: OLD_PW }));
  assert.equal(res.status, 201, `đăng ký phải 201, nhận ${res.status}`);
  return { username, cookie: cookieOf(res) };
}

async function waitRateLimitWindow() {
  // bumpRateLimit 5 lần / 5 phút mỗi IP. Test chạy chung một IP nên phải "tiêu" có ý thức.
  // Gọi tối đa 5 lần mỗi cửa sổ; để tránh phụ thuộc thời gian, mỗi test dùng username khác
  // nhưng vẫn chung IP -> giữ tổng số lần gọi <= 5 trong cả file.
}

// ---------------------------------------------------------------- đơn vị
test('thiếu đăng nhập -> 401', async () => {
  const res = await changePassword(req('POST', '/api/auth/password', null, {
    currentPassword: OLD_PW, newPassword: NEW_PW,
  }));
  assert.equal(res.status, 401);
});

test('mật khẩu hiện tại sai -> 401 và KHÔNG đổi gì', async () => {
  const { cookie } = await makePlayer();
  const res = await changePassword(req('POST', '/api/auth/password', cookie, {
    currentPassword: 'sai-mat-khau', newPassword: NEW_PW,
  }));
  assert.equal(res.status, 401);
  assert.equal((await res.json()).ok, false);
  assert.equal(await authed(cookie), true, 'phiên cũ vẫn sống vì đổi thất bại');
});

test('mật khẩu mới quá ngắn -> 400', async () => {
  const { cookie } = await makePlayer();
  const res = await changePassword(req('POST', '/api/auth/password', cookie, {
    currentPassword: OLD_PW, newPassword: '123',
  }));
  assert.equal(res.status, 400);
});

test('mật khẩu mới trùng mật khẩu cũ -> 400', async () => {
  const { cookie } = await makePlayer();
  const res = await changePassword(req('POST', '/api/auth/password', cookie, {
    currentPassword: OLD_PW, newPassword: OLD_PW,
  }));
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------- tích hợp
test('đổi mật khẩu: phiên khác bị HUỶ, phiên hiện tại được cấp token mới', async () => {
  const { username, cookie: sessionA } = await makePlayer();
  // Thiết bị thứ hai (kẻ đã chiếm phiên, hoặc máy khác).
  const sessionB = cookieOf(await login(req('POST', '/api/auth/login', null, { username, password: OLD_PW })));
  assert.equal(await authed(sessionB), true);

  const res = await changePassword(req('POST', '/api/auth/password', sessionA, {
    currentPassword: OLD_PW, newPassword: NEW_PW,
  }));
  assert.equal(res.status, 200, `đổi mật khẩu phải 200, nhận ${res.status}`);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.sessionsRevoked, true);

  // ĐIỂM MẤU CHỐT: mọi token cũ đều chết.
  assert.equal(await authed(sessionA), false, 'token cũ của chính người đổi phải chết');
  assert.equal(await authed(sessionB), false, 'token của thiết bị khác phải chết');

  // Token mới trong set-cookie phải dùng được.
  const fresh = cookieOf(res);
  assert.ok(fresh, 'phải trả token mới');
  assert.equal(await authed(fresh), true, 'token mới phải đăng nhập được');
});

test('sau khi đổi, mật khẩu CŨ không đăng nhập được, mật khẩu MỚI thì được', async () => {
  const { username, cookie } = await makePlayer();
  const res = await changePassword(req('POST', '/api/auth/password', cookie, {
    currentPassword: OLD_PW, newPassword: NEW_PW,
  }));
  assert.equal(res.status, 200);

  const oldLogin = await login(req('POST', '/api/auth/login', null, { username, password: OLD_PW }));
  assert.equal(oldLogin.status, 401, 'mật khẩu cũ phải bị từ chối');

  const newLogin = await login(req('POST', '/api/auth/login', null, { username, password: NEW_PW }));
  assert.equal(newLogin.status, 200, 'mật khẩu mới phải đăng nhập được');
});

test('logout sau khi đổi mật khẩu vẫn hoạt động bình thường', async () => {
  const { cookie } = await makePlayer();
  const res = await changePassword(req('POST', '/api/auth/password', cookie, {
    currentPassword: OLD_PW, newPassword: NEW_PW,
  }));
  const fresh = cookieOf(res);
  assert.equal(await authed(fresh), true);

  const out = await logout(req('GET', '/api/auth/logout', fresh));
  assert.equal(out.status, 200);
  assert.equal(await authed(fresh), false);
});
