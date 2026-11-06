import { getMongoDb, COLLECTIONS } from "../lib/mongo.js";
import { getCurrentPlayer, json, fail, readJsonBody, bumpRateLimit, clientIp } from "../lib/http.js";
import { sanitizeSave, MAX_SAVE_BYTES } from "../lib/saveSchema.js";
import { validateEconomyDelta, validateSeasonDelta } from "../lib/economy.js";

export const config = { runtime: "nodejs" };

export async function GET(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail("Ban can dang nhap de luu tien trinh.", 401);

  const db = await getMongoDb();
  const doc = await db.collection(COLLECTIONS.saves).findOne({ playerId: String(player._id) });
  if (!doc) return json({ ok: true, playerId: String(player._id), hasSave: false, data: null, revision: 0 });
  return json({
    ok: true,
    playerId: String(player._id),
    hasSave: true,
    data: doc.data,
    revision: doc.revision || 1,
    updatedAt: doc.updatedAt || null,
  });
}

export async function PUT(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail("Ban can dang nhap de luu tien trinh.", 401);

  const playerId = String(player._id);
  const db = await getMongoDb();
  const saves = db.collection(COLLECTIONS.saves);

  const rl = await bumpRateLimit(`save:${playerId}`, { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return fail("Luu qua nhanh. Thu lai sau it giay.", 429);

  const body = await readJsonBody(request, MAX_SAVE_BYTES + 8192);
  if (!body.ok) return fail(body.error, body.status);
  // Optional for legacy clients; new clients bind snapshots to the account that loaded them.
  if (body.data.playerId !== undefined && body.data.playerId !== playerId) {
    return json({ ok: false, conflict: true, code: "ACCOUNT_CHANGED",
      error: "Tai khoan da thay doi. Hay tai lai trang truoc khi luu." }, 409);
  }

  const check = sanitizeSave(body.data.data);
  if (!check.ok) return fail(check.reason, 422);

  const expectedRevision = body.data.revision;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return fail("Revision khong hop le. Hay tai lai truoc khi luu.", 400);
  }
  const now = new Date();

  const existing = await saves.findOne({ playerId }, { projection: { revision: 1, "data.gold": 1, "data.gems": 1, "data.lifetimeStats": 1, "data.season": 1 } });
  const currentRevision = existing ? (existing.revision || 1) : 0;

  if (expectedRevision !== currentRevision) {
    return json({
      ok: false,
      error: "Du lieu da thay doi tu thiet bi khac. Hay tai lai truoc khi luu.",
      conflict: true,
      serverRevision: currentRevision,
    }, 409);
  }

  // ===== Kiểm tra kinh tế phía server =====
  // Không tin client: chặn việc tự cấp vàng/đá quý qua một request duy nhất.
  // So sánh với bản ghi đang có trong DB, dùng số revision tăng làm mốc.
  const economy = validateEconomyDelta(existing?.data || null, check.data, 1);
  if (!economy.ok) {
    const save = await saves.findOne({ playerId }, { projection: { revision: 1, data: 1 } });
    return json({
      ok: false,
      error: economy.reason,
      code: economy.code,
      detail: economy.detail,
      // Trả lại bản ghi server để client không ghi đè dữ liệu hỏng lên máy.
      conflict: true,
      serverRevision: save?.revision || 0,
      serverData: save?.data || null,
    }, 422);
  }

  // ===== Kiểm tra tiến trình Mùa Giải phía server =====
  // Tiền Mùa chỉ được tăng khi save phản ánh một lần hi sinh hợp lệ (+60 mỗi 2%)
  // hoặc một chuyển trạng thái hạ trùm hợp lệ (+120). Không nhận số dư do client tự khai.
  const seasonEconomy = validateSeasonDelta(existing?.data || null, check.data);
  if (!seasonEconomy.ok) {
    const save = await saves.findOne({ playerId }, { projection: { revision: 1, data: 1 } });
    return json({
      ok: false,
      error: seasonEconomy.reason,
      code: seasonEconomy.code,
      detail: seasonEconomy.detail,
      conflict: true,
      serverRevision: save?.revision || 0,
      serverData: save?.data || null,
    }, 422);
  }

  const nextRevision = currentRevision + 1;
  const snapshot = {
    playerId,
    username: player.username,
    data: check.data,
    revision: nextRevision,
    updatedAt: now,
    updatedIp: clientIp(request).slice(0, 45),
  };
  async function revisionConflict() {
    const latest = await saves.findOne({ playerId }, { projection: { revision: 1 } });
    return json({ ok: false, conflict: true,
      error: "Du lieu da thay doi tu thiet bi khac. Hay tai lai truoc khi luu.",
      serverRevision: latest ? (latest.revision || 1) : 0 }, 409);
  }
  if (existing) {
    // Compare-and-set: validation and replacement must refer to the same snapshot.
    const result = await saves.updateOne(
      { playerId, revision: existing.revision === undefined ? { $exists: false } : existing.revision },
      { $set: snapshot },
      { upsert: false },
    );
    if (result.matchedCount !== 1) return revisionConflict();
  } else {
    // The unique playerId index arbitrates concurrent first saves without replacing one.
    try {
      await saves.insertOne({ ...snapshot, createdAt: now });
    } catch (error) {
      if (error?.code === 11000) return revisionConflict();
      throw error;
    }
  }

  return json({ ok: true, revision: nextRevision, updatedAt: now, bytes: check.bytes });
}
