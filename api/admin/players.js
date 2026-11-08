import { requireAdmin, db, COLLECTIONS } from "../../lib/adminAuth.js";
import { json, fail } from "../../lib/http.js";
import { sanitizeSave } from "../../lib/save/schema.js";

export const config = { runtime: "nodejs" };

const PAGE_SIZE = 25;
const VIP_CAP = 1_000_000_000;

function grantAmount(value, max) {
  if (value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : null;
}

/** GET /api/admin/players?q=&page=1&sort=recent|kills|gold */
export async function GET(request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim().slice(0, 40);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const sort = String(url.searchParams.get("sort") || "recent");

  const database = await db();
  const players = database.collection(COLLECTIONS.players);
  const saves = database.collection(COLLECTIONS.saves);

  const filter = q
    ? { $or: [{ usernameLower: { $regex: q.toLowerCase() } }, { displayName: { $regex: q, $options: "i" } }] }
    : {};

  const total = await players.countDocuments(filter);
  const docs = await players
    .find(filter, { projection: { passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray();

  const ids = docs.map((d) => String(d._id));
  const saveDocs = ids.length
    ? await saves.find({ playerId: { $in: ids } }, { projection: { data: 1, revision: 1, updatedAt: 1, playerId: 1 } }).toArray()
    : [];
  const saveByPlayer = new Map(saveDocs.map((s) => [s.playerId, s]));

  let rows = docs.map((d) => {
    const s = saveByPlayer.get(String(d._id));
    const data = s?.data || {};
    return {
      id: String(d._id),
      username: d.username,
      displayName: d.displayName || d.username,
      createdAt: d.createdAt || null,
      lastLoginAt: d.lastLoginAt || null,
      hasSave: !!s,
      revision: s?.revision || 0,
      updatedAt: s?.updatedAt || null,
      gold: data.gold ?? 0,
      gems: data.gems ?? 0,
      vipCoins: data.vipCoins ?? 0,
      playerLevel: data.playerLevel ?? 1,
      kills: data.lifetimeStats?.kills ?? 0,
      runs: data.lifetimeStats?.runs ?? 0,
      wins: data.lifetimeStats?.wins ?? 0,
      bagCount: Array.isArray(data.gearBag) ? data.gearBag.length : 0,
    };
  });

  if (sort === "kills") rows.sort((a, b) => b.kills - a.kills);
  else if (sort === "gold") rows.sort((a, b) => b.gold - a.gold);
  else if (sort === "vip") rows.sort((a, b) => b.vipCoins - a.vipCoins);

  return json({
    ok: true,
    total,
    page,
    pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows,
  });
}

/** PATCH /api/admin/players  { playerId, action, payload } */
export async function PATCH(request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("JSON không hợp lệ.", 400);
  }

  const playerId = String(body?.playerId || "");
  const action = String(body?.action || "");
  const payload = body?.payload || {};
  if (!playerId) return fail("Thiếu playerId.", 400);

  const { ObjectId } = await import("mongodb");
  let _id;
  try {
    _id = new ObjectId(playerId);
  } catch {
    return fail("playerId không hợp lệ.", 400);
  }

  const database = await db();
  const players = database.collection(COLLECTIONS.players);
  const saves = database.collection(COLLECTIONS.saves);

  const player = await players.findOne({ _id });
  if (!player) return fail("Không tìm thấy người chơi.", 404);

  // ---------- Các hành động ----------
  if (action === "grant") {
    const gold = grantAmount(payload.gold, 1e9);
    const gems = grantAmount(payload.gems, 1e9);
    const stamina = grantAmount(payload.stamina, 1e6);
    const vipCoins = grantAmount(payload.vipCoins, 1e6);
    if ([gold, gems, stamina, vipCoins].includes(null)) return fail("Số cấp phải là số nguyên không âm và nằm trong giới hạn.", 400);
    if (!gold && !gems && !stamina && !vipCoins) return fail("Chọn ít nhất một loại tiền hoặc năng lượng để cộng.", 400);

    // Revision CAS prevents a grant from overwriting a concurrent player save.
    for (let attempt = 0; attempt < 3; attempt++) {
      const save = await saves.findOne({ playerId });
      if (!save) return fail("Người chơi chưa có save.", 404);
      const data = { ...(save.data || {}) };
      if ((Number(data.gold) || 0) + gold > 1e12 || (Number(data.gems) || 0) + gems > 1e12 ||
          (Number(data.stamina) || 0) + stamina > 1e9 || (Number(data.vipCoins) || 0) + vipCoins > VIP_CAP) {
        return fail("Số dư sau khi cấp sẽ vượt giới hạn. Hãy nhập số nhỏ hơn.", 422);
      }
      data.gold = (Number(data.gold) || 0) + gold;
      data.gems = (Number(data.gems) || 0) + gems;
      data.stamina = (Number(data.stamina) || 0) + stamina;
      data.vipCoins = (Number(data.vipCoins) || 0) + vipCoins;
      const now = new Date();
      const revision = (save.revision || 1) + 1;
      const grantLog = [...(Array.isArray(save.adminCurrencyLog) ? save.adminCurrencyLog : []), {
        at: now, by: guard.player.username, gold, gems, stamina, vipCoins,
      }].slice(-20);
      const result = await saves.updateOne(
        { playerId, revision: save.revision === undefined ? { $exists: false } : save.revision },
        { $set: { data, revision, updatedAt: now, adminNote: `grant by ${guard.player.username}`, adminCurrencyLog: grantLog } },
      );
      if (result.matchedCount === 1) {
        return json({ ok: true, revision, balance: { gold: data.gold, gems: data.gems, stamina: data.stamina, vipCoins: data.vipCoins },
          message: `Đã cộng ${gold} vàng, ${gems} đá quý, ${vipCoins} xu VIP, ${stamina} năng lượng.` });
      }
    }
    return fail("Tiến trình vừa thay đổi. Hãy thử cấp tiền lại.", 409);
  }

  if (action === "reset-password") {
    const { hashPassword } = await import("../../lib/auth.js");
    const pw = String(payload.password || "");
    if (pw.length < 8) return fail("Mật khẩu phải có ít nhất 8 ký tự.", 400);
    await players.updateOne({ _id }, { $set: { passwordHash: await hashPassword(pw), passwordChangedAt: new Date() } });
    return json({ ok: true, message: "Đã đặt lại mật khẩu." });
  }

  if (action === "delete-save") {
    await saves.deleteOne({ playerId });
    return json({ ok: true, message: "Đã xoá tiến trình (người chơi sẽ bắt đầu lại từ đầu)." });
  }

  if (action === "delete-player") {
    await saves.deleteOne({ playerId });
    await players.deleteOne({ _id });
    return json({ ok: true, message: "Đã xoá tài khoản và tiến trình." });
  }

  if (action === "set-save") {
    // Ghi đè save bằng dữ liệu admin cung cấp (đã qua sanitize).
    const check = sanitizeSave(payload.data);
    if (!check.ok) return fail(check.reason, 422);
    const save = await saves.findOne({ playerId });
    const nextRev = (save?.revision || 0) + 1;
    await saves.updateOne(
      { playerId },
      {
        $set: { playerId, username: player.username, data: check.data, revision: nextRev, updatedAt: new Date(), adminNote: `set by ${guard.player.username}` },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    return json({ ok: true, message: "Đã ghi đè tiến trình.", revision: nextRev });
  }

  return fail("Hành động không hợp lệ.", 400);
}

/** DELETE /api/admin/players?id=xxx */
export async function DELETE(request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "");
  if (!id) return fail("Thiếu id.", 400);

  const { ObjectId } = await import("mongodb");
  let _id;
  try {
    _id = new ObjectId(id);
  } catch {
    return fail("id không hợp lệ.", 400);
  }

  const database = await db();
  await database.collection(COLLECTIONS.saves).deleteOne({ playerId: id });
  const res = await database.collection(COLLECTIONS.players).deleteOne({ _id });
  if (res.deletedCount === 0) return fail("Không tìm thấy người chơi.", 404);
  return json({ ok: true, message: "Đã xoá tài khoản." });
}
