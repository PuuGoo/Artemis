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
  if (!doc) return json({ ok: true, hasSave: false, data: null, revision: 0 });
  return json({
    ok: true,
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

  const check = sanitizeSave(body.data.data);
  if (!check.ok) return fail(check.reason, 422);

  const clientRevision = Number(body.data.revision);
  const expectedRevision = Number.isFinite(clientRevision) ? clientRevision : null;
  const now = new Date();

  const existing = await saves.findOne({ playerId }, { projection: { revision: 1, "data.gold": 1, "data.gems": 1, "data.lifetimeStats": 1 } });
  const currentRevision = existing?.revision || 0;

  if (existing && expectedRevision !== null && expectedRevision !== currentRevision) {
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
  await saves.updateOne(
    { playerId },
    {
      $set: {
        playerId,
        username: player.username,
        data: check.data,
        revision: nextRevision,
        updatedAt: now,
        updatedIp: clientIp(request).slice(0, 45),
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  return json({ ok: true, revision: nextRevision, updatedAt: now, bytes: check.bytes });
}
