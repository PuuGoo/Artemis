import { getMongoDb, COLLECTIONS } from "../../lib/mongo.js";
import {
  hashPassword, signSession, sessionCookie, validateCredentials,
  normalizeUsername, usernameKey,
} from "../../lib/auth.js";
import { json, fail, readJsonBody, bumpRateLimit, clientIp } from "../../lib/http.js";
import { NEW_ACCOUNT_INIT_VERSION, buildCanonicalNewAccountSave } from "../../lib/initialState.js";

export const config = { runtime: "nodejs" };

export async function POST(request) {
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
  const now = new Date();

  let result;
  try {
    result = await db.collection(COLLECTIONS.players).insertOne({
      username: cleanName,
      usernameLower: keyLower,
      displayName: cleanName,
      passwordHash: await hashPassword(password),
      createdAt: now,
      lastLoginAt: now,
      // Danh dau tai khoan duoc khoi tao bang seed chuan cua may chu.
      // GET /api/save dua vao co nay de khoi phuc snapshot neu ban ghi bi mat,
      // va PUT revision 0 se bi tu choi thay vi nhan payload client tu khai.
      initVersion: NEW_ACCOUNT_INIT_VERSION,
      initVersionAt: now,
    });
  } catch (e) {
    if (e && e.code === 11000) {
      return fail("Ten dang nhap nay da co nguoi dung. Chon ten khac.", 409);
    }
    throw e;
  }

  const playerId = String(result.insertedId);

  // Cap san snapshot tan thu chuan — client khong con quyet dinh trang thai khoi tao.
  // Loi o buoc nay khong duoc bien mot tai khoan hop le thanh 500: GET /api/save
  // se tao lai seed vi player da co initVersion. Chi ghi log de co vet.
  try {
    await db.collection(COLLECTIONS.saves).insertOne(
      buildCanonicalNewAccountSave({ playerId, username: cleanName, now }),
    );
  } catch (e) {
    if (!e || e.code !== 11000) {
      console.error("[register] khong tao duoc save khoi tao, GET se khoi phuc:", e && e.message);
    }
  }

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
