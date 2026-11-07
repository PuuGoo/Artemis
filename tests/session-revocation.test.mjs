// Khoá lại: JWT phải bị THU HỒI thật khi đăng xuất / đổi mật khẩu.
//
// Trước bản vá: `api/auth/logout.js` chỉ xoá cookie. Token cũ vẫn dùng được 30 ngày.
// Test này chạy qua đúng HTTP stack (bcrypt, jose, sanitizer) trên DB bộ nhớ và
// chứng minh token chết NGAY sau logout, trong khi phiên thiết bị khác không bị ảnh hưởng.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DB_BACKEND = "memory";
process.env.JWT_SECRET = randomBytes(24).toString("hex");

const { POST: login } = await import("../api/auth/login.js");
const { POST: register } = await import("../api/auth/register.js");
const { POST: logoutRoute } = await import("../api/auth/logout.js");
const { GET: meRoute } = await import("../api/auth/me.js");
const { isSessionRevoked, revocationDoc, newSessionId } = await import("../lib/sessionRevocation.js");

const ORIGIN = "https://artemis.test";

function jsonRequest(path, body, cookie) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function getRequest(path, cookie) {
  return new Request(`${ORIGIN}${path}`, { method: "GET", headers: cookie ? { cookie } : {} });
}

function cookieOf(response) {
  const raw = response.headers.get("set-cookie") || "";
  const pair = raw.split(";")[0] || "";
  assert.match(pair, /^artemis_session=/, "phải trả set-cookie artemis_session");
  return pair;
}


async function registerPlayer(username) {
  const res = await register(jsonRequest("/api/auth/register", {
    username,
    password: "matkhau-rat-dai-2026",
  }));
  const body = await res.json();
  assert.equal(res.status, 201, `đăng ký phải 201, nhận ${res.status}: ${JSON.stringify(body)}`);
  return { cookie: cookieOf(res), playerId: body.player?.id || body.playerId };
}

async function loginPlayer(username) {
  const res = await login(jsonRequest("/api/auth/login", {
    username,
    password: "matkhau-rat-dai-2026",
  }));
  const body = await res.json();
  assert.equal(res.status, 200, `đăng nhập phải 200, nhận ${res.status}: ${JSON.stringify(body)}`);
  return cookieOf(res);
}

async function authed(cookie) {
  const res = await meRoute(getRequest("/api/auth/me", cookie));
  const body = await res.json();
  return body.authenticated === true;
}

// ---------------------------------------------------------------- đơn vị
test("isSessionRevoked: chưa thu hồi, chưa đổi epoch -> còn sống", () => {
  assert.equal(isSessionRevoked({ ep: 2 }, { revokedAt: null, currentEpoch: 2 }), false);
  // Token cũ không có `ep` được coi là epoch 0 (tương thích save/token cũ).
  assert.equal(isSessionRevoked({}, { revokedAt: null, currentEpoch: 0 }), false);
});

test("isSessionRevoked: bị thu hồi hoặc epoch cũ -> chết", () => {
  assert.equal(isSessionRevoked({ ep: 0 }, { revokedAt: new Date(), currentEpoch: 0 }), true);
  assert.equal(isSessionRevoked({ ep: 1 }, { revokedAt: null, currentEpoch: 2 }), true);
  assert.equal(isSessionRevoked({ ep: 3 }, { revokedAt: null, currentEpoch: 2 }), false);
});

test("revocationDoc: TTL đúng bằng hạn của token, có mốc thu hồi", () => {
  const now = 1_700_000_000_000;
  const doc = revocationDoc("jti-1", now + 60_000, now);
  assert.equal(doc._id, "jti-1");
  assert.equal(doc.expiresAt.getTime(), now + 60_000);
  assert.equal(doc.revokedAt.getTime(), now);
});

test("newSessionId: mỗi phiên một id khác nhau", () => {
  const ids = new Set(Array.from({ length: 50 }, () => newSessionId()));
  assert.equal(ids.size, 50);
});

// ---------------------------------------------------------------- tích hợp
test("sau logout, token cũ bị TỪ CHỐI (trước đây vẫn dùng được)", async () => {
  const username = `revoker_${Date.now().toString(36)}`;
  const { cookie } = await registerPlayer(username);

  assert.equal(await authed(cookie), true, "vừa đăng ký phải đang đăng nhập");

  const out = await logoutRoute(getRequest("/api/auth/logout", cookie));
  assert.equal(out.status, 200);
  assert.match(out.headers.get("set-cookie") || "", /artemis_session=;/, "phải xoá cookie");

  // ĐIỂM MẤU CHỐT: dùng lại đúng cookie cũ (như kẻ đã copy token).
  assert.equal(await authed(cookie), false, "token sau logout KHÔNG được xác thực");
});

test("logout chỉ huỷ phiên hiện tại, thiết bị khác vẫn đăng nhập", async () => {
  const username = `two_${Date.now().toString(36)}`;
  await registerPlayer(username);

  const deviceA = await loginPlayer(username);
  const deviceB = await loginPlayer(username);
  assert.equal(await authed(deviceA), true);
  assert.equal(await authed(deviceB), true);

  await logoutRoute(getRequest("/api/auth/logout", deviceA));

  assert.equal(await authed(deviceA), false, "phiên vừa logout phải chết");
  assert.equal(await authed(deviceB), true, "thiết bị khác KHÔNG được bị đăng xuất oan");
});

test("logout hai lần liên tiếp không lỗi", async () => {
  const username = `twice_${Date.now().toString(36)}`;
  const { cookie } = await registerPlayer(username);
  const first = await logoutRoute(getRequest("/api/auth/logout", cookie));
  const second = await logoutRoute(getRequest("/api/auth/logout", cookie));
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(await authed(cookie), false);
});

test("token rác: logout vẫn 200 và không thể sinh bản ghi thu hồi", async () => {
  // Bảo đảm ở tầng thấp: token rác không verify được -> không có jti -> route
  // không có gì để ghi vào danh sách thu hồi. (Kiểm trực tiếp số bản ghi sẽ phụ
  // thuộc thứ tự test vì kho bộ nhớ dùng chung.)
  const { verifySessionToken } = await import("../lib/auth.js");
  assert.equal(await verifySessionToken("khong-phai-jwt"), null);

  const res = await logoutRoute(getRequest("/api/auth/logout", "artemis_session=khong-phai-jwt"));
  assert.equal(res.status, 200, "logout phải luôn 200, kể cả token rác");
  assert.match(res.headers.get("set-cookie") || "", /artemis_session=;/);

  assert.equal(await authed("artemis_session=khong-phai-jwt"), false);
});

test("đổi sessionEpoch (đổi mật khẩu) huỷ MỌI token cũ", async () => {
  const username = `epoch_${Date.now().toString(36)}`;
  const { cookie, playerId } = await registerPlayer(username);
  assert.equal(await authed(cookie), true);

  const { getMongoDb, COLLECTIONS } = await import("../lib/mongo.js");
  const { ObjectId } = await import("mongodb");
  const db = await getMongoDb();
  await db.collection(COLLECTIONS.players).updateOne(
    { _id: new ObjectId(String(playerId)) },
    { $inc: { sessionEpoch: 1 } },
  );

  assert.equal(await authed(cookie), false, "epoch cũ phải bị từ chối");

  // Đăng nhập lại -> token mới mang epoch mới -> dùng được.
  const fresh = await loginPlayer(username);
  assert.equal(await authed(fresh), true);
});
