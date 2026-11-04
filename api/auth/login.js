import { getMongoDb, COLLECTIONS } from "../../lib/mongo.js";
import { signSession, sessionCookie, verifyPassword, normalizeUsername, usernameKey } from "../../lib/auth.js";
import { fail, readJsonBody, bumpRateLimit, clientIp } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export async function POST(request) {
  const body = await readJsonBody(request);
  if (!body.ok) return fail(body.error, body.status);

  const username = normalizeUsername(body.data.username);
  const password = body.data.password;
  if (!username || typeof password !== "string") {
    return fail("Thieu ten dang nhap hoac mat khau.", 400);
  }

  // Chong do mat khau: gioi han theo IP va theo tai khoan.
  const ip = clientIp(request);
  const rlIp = await bumpRateLimit(`login-ip:${ip}`, { windowMs: 10 * 60_000, max: 30 });
  if (!rlIp.allowed) return fail("Qua nhieu lan thu dang nhap. Thu lai sau it phut.", 429);
  const rlUser = await bumpRateLimit(`login-user:${usernameKey(username)}`, { windowMs: 10 * 60_000, max: 15 });
  if (!rlUser.allowed) return fail("Tai khoan tam khoa do nhap sai nhieu lan. Thu lai sau it phut.", 429);

  const db = await getMongoDb();
  const doc = await db.collection(COLLECTIONS.players).findOne({ usernameLower: usernameKey(username) });

  // Luon so sanh hash (ke ca khi khong tim thay) de thoi gian phan hoi khong lo thong tin.
  const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.5r1o8mWJk2h1nZ1x1q9y3cF0i4Iy";
  const okPassword = await verifyPassword(password, doc?.passwordHash || DUMMY_HASH);

  if (!doc || !okPassword) {
    // Thong bao giong nhau cho ca 2 truong hop: khong lo ten dang nhap co ton tai hay khong.
    return fail("Ten dang nhap hoac mat khau khong dung.", 401);
  }

  await db.collection(COLLECTIONS.players).updateOne(
    { _id: doc._id },
    { $set: { lastLoginAt: new Date() } },
  );
  // Dang nhap thanh cong -> xoa bo dem sai.
  await db.collection(COLLECTIONS.loginAttempts).deleteMany({ key: `login-user:${usernameKey(username)}` });

  const token = await signSession({ sub: String(doc._id), username: doc.username });

  return new Response(
    JSON.stringify({
      ok: true,
      player: { id: String(doc._id), username: doc.username, displayName: doc.displayName || doc.username },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "set-cookie": sessionCookie(token),
        "x-content-type-options": "nosniff",
      },
    },
  );
}
