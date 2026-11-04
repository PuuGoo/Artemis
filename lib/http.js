import { getMongoDb, COLLECTIONS } from "./mongo.js";
import { readSessionToken, verifySessionToken } from "./auth.js";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function fail(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

/** Bat buoc JSON + gioi han kich thuoc body, khong doc body neu Content-Length qua lon. */
export async function readJsonBody(request, maxBytes = 512 * 1024) {
  const len = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(len) && len > maxBytes) {
    return { ok: false, error: `Body qua lon (${len} byte).`, status: 413 };
  }
  if (!String(request.headers.get("content-type") || "").includes("application/json")) {
    return { ok: false, error: "Yeu cau phai dung content-type: application/json.", status: 415 };
  }
  let text;
  try {
    text = await request.text();
  } catch {
    return { ok: false, error: "Khong doc duoc body.", status: 400 };
  }
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    return { ok: false, error: "Body qua lon.", status: 413 };
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") {
      return { ok: false, error: "Body phai la JSON object.", status: 400 };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: "JSON khong hop le.", status: 400 };
  }
}

/** Lay player hien tai tu cookie phien. Tra null neu chua dang nhap / phien het han. */
export async function getCurrentPlayer(request) {
  const token = readSessionToken(request);
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload || !payload.sub) return null;
  const db = await getMongoDb();
  const { ObjectId } = await import("mongodb");
  let _id;
  try {
    _id = new ObjectId(String(payload.sub));
  } catch {
    return null;
  }
  const doc = await db.collection(COLLECTIONS.players).findOne({ _id });
  return doc || null;
}

/**
 * Dem so lan thao tac theo key (vd: IP + hanh dong).
 * Dung upsert atomic de khong bi race khi nhieu request cung luc.
 */
export async function bumpRateLimit(key, { windowMs = 60_000, max = 30 } = {}) {
  const db = await getMongoDb();
  const col = db.collection(COLLECTIONS.loginAttempts);
  const now = new Date();
  let doc;
  try {
    doc = await col.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $set: { lastAt: now }, $setOnInsert: { firstAt: now } },
      { upsert: true, returnDocument: "after" },
    );
  } catch {
    // Neu upsert dua tranh chap unique -> coi nhu dang bi gioi han an toan.
    return { allowed: false, remaining: 0 };
  }
  const value = doc && (doc.value || doc);
  const firstAt = value?.firstAt ? new Date(value.firstAt).getTime() : now.getTime();
  const count = Number(value?.count || 1);
  if (Date.now() - firstAt > windowMs) {
    await col.updateOne({ key }, { $set: { count: 1, firstAt: now, lastAt: now } });
    return { allowed: true, remaining: max - 1 };
  }
  return { allowed: count <= max, remaining: Math.max(0, max - count) };
}

export function clientIp(request) {
  const h = request.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}
