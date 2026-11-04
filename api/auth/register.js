import { getMongoDb, COLLECTIONS } from "../../lib/mongo.js";
import {
  hashPassword, signSession, sessionCookie, validateCredentials,
  normalizeUsername, usernameKey,
} from "../../lib/auth.js";
import { json, fail, readJsonBody, bumpRateLimit, clientIp } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(request) {
  if (request.method !== "POST") return fail("Chi ho tro POST.", 405);

  const body = await readJsonBody(request);
  if (!body.ok) return fail(body.error, body.status);

  const { username, password } = body.data;
  const error = validateCredentials(username, password);
  if (error) return fail(error, 400);

  // Chong spam tao tai khoan tu mot IP.
  const rl = await bumpRateLimit(`register:${clientIp(request)}`, { windowMs: 10 * 60_000, max: 10 });
  if (!rl.allowed) return fail("Qua nhieu yeu cau tao tai khoan. Thu lai sau it phut.", 429);

  const db = await getMongoDb();
  const cleanName = normalizeUsername(username);
  const keyLower = usernameKey(username);

  let result;
  try {
    result = await db.collection(COLLECTIONS.players).insertOne({
      username: cleanName,
      usernameLower: keyLower,
      displayName: cleanName,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });
  } catch (e) {
    if (e && e.code === 11000) {
      return fail("Ten dang nhap nay da co nguoi dung. Chon ten khac.", 409);
    }
    throw e;
  }

  const playerId = String(result.insertedId);
  const token = await signSession({ sub: playerId, username: cleanName });

  return new Response(
    JSON.stringify({
      ok: true,
      player: { id: playerId, username: cleanName, displayName: cleanName },
    }),
    {
      status: 201,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "set-cookie": sessionCookie(token),
        "x-content-type-options": "nosniff",
      },
    },
  );
}
