import { getMongoDb, COLLECTIONS } from "../lib/mongo.js";
import { getCurrentPlayer, json, fail, readJsonBody, bumpRateLimit, clientIp } from "../lib/http.js";
import { sanitizeSave, MAX_SAVE_BYTES } from "../lib/save/schema.js";
import { NEW_ACCOUNT_INIT_VERSION } from "../lib/save/initialState.js";
import { prepareSaveData, validateSaveTransition } from '../lib/save/policy.js';
import { createSaveRepository } from '../lib/save/repository.js';

export const config = { runtime: "nodejs" };

/**
 * Tài khoản được khởi tạo bằng seed chuẩn của máy chủ (tạo sau bản vá).
 * Chỉ những tài khoản này mới bị áp luật "không có save = mất dữ liệu".
 */
function isCanonicalAccount(player) {
  return Number.isInteger(player?.initVersion) && player.initVersion >= NEW_ACCOUNT_INIT_VERSION;
}

export async function GET(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail("Ban can dang nhap de luu tien trinh.", 401);

  const db = await getMongoDb();
  const saves = createSaveRepository(db.collection(COLLECTIONS.saves));
  const playerId = String(player._id);
  let doc = await saves.find(playerId);

  // Tài khoản đã đánh dấu khởi tạo chuẩn thì bản ghi save phải tồn tại. Nếu mất,
  // "không có save" nghĩa là dữ liệu đã mất — không phải người chơi mới — nên
  // khôi phục seed chuẩn thay vì trả hasSave=false cho client tự dựng state.
  if (!doc && isCanonicalAccount(player)) {
    doc = await saves.restoreCanonical(player, playerId);
  }

  if (!doc) return json({ ok: true, playerId, hasSave: false, data: null, revision: 0 });
  return json({
    ok: true,
    playerId,
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
  const saves = createSaveRepository(db.collection(COLLECTIONS.saves));

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
  // Tài khoản đánh dấu khởi tạo chuẩn LUÔN có save do máy chủ cấp. Revision 0
  // nghĩa là client không thấy save đó -> dữ liệu đã mất hoặc client cũ. Không
  // nhận snapshot tự khai trong trường hợp này; tải lại để GET khôi phục seed.
  if (expectedRevision === 0 && isCanonicalAccount(player)) {
    return json({
      ok: false,
      conflict: true,
      code: "SAVE_MISSING",
      error: "Khong tim thay tien trinh tren may chu. Hay tai lai trang de khoi phuc.",
    }, 409);
  }
  const now = new Date();

  const existing = await saves.readForValidation(playerId);
  const currentRevision = existing ? (existing.revision || 1) : 0;

  if (expectedRevision !== currentRevision) {
    return json({
      ok: false,
      error: "Du lieu da thay doi tu thiet bi khac. Hay tai lai truoc khi luu.",
      conflict: true,
      serverRevision: currentRevision,
    }, 409);
  }

  const data = prepareSaveData({
    sanitizedData: check.data,
    incomingData: body.data.data,
    previousData: existing?.data,
    nowMs: now.getTime(),
  });
  const transition = validateSaveTransition({ previous: existing, data, nowMs: now.getTime() });
  if (!transition.ok) {
    const save = await saves.readConflict(playerId);
    return json({
      ok: false,
      ...transition.error,
      conflict: true,
      serverRevision: save?.revision || 0,
      serverData: save?.data || null,
    }, 422);
  }

  const nextRevision = currentRevision + 1;
  const snapshot = {
    playerId,
    username: player.username,
    data,
    // Ngân sách còn lại sau lần lưu này — mốc để lần sau refill theo thời gian.
    ledger: transition.ledger,
    revision: nextRevision,
    updatedAt: now,
    updatedIp: clientIp(request).slice(0, 45),
  };
  if (!await saves.commit(existing, snapshot)) {
    const latest = await saves.readForValidation(playerId);
    return json({ ok: false, conflict: true,
      error: "Du lieu da thay doi tu thiet bi khac. Hay tai lai truoc khi luu.",
      serverRevision: latest ? (latest.revision || 1) : 0 }, 409);
  }

  return json({ ok: true, revision: nextRevision, updatedAt: now, bytes: check.bytes });
}
