import { getMongoDb, COLLECTIONS } from "../lib/mongo.js";
import { getCurrentPlayer, json, fail, readJsonBody, bumpRateLimit, clientIp } from "../lib/http.js";
import { sanitizeSave, MAX_SAVE_BYTES } from "../lib/saveSchema.js";
import { validateEconomyDelta, validateSeasonDelta } from "../lib/economy.js";
import { NEW_ACCOUNT_INIT_VERSION, buildCanonicalNewAccountSave } from "../lib/initialState.js";
import { validateEconomyBudget } from "../lib/economyLedger.js";
import { normalizeVipPasses, hasVipPass } from '../lib/privilegeCards.js';

export const config = { runtime: "nodejs" };

/**
 * Tài khoản được khởi tạo bằng seed chuẩn của máy chủ (tạo sau bản vá).
 * Chỉ những tài khoản này mới bị áp luật "không có save = mất dữ liệu".
 */
function isCanonicalAccount(player) {
  return Number.isInteger(player?.initVersion) && player.initVersion >= NEW_ACCOUNT_INIT_VERSION;
}

/**
 * Các hệ mới thêm sau này. Client cũ (JS trong cache) không gửi key, nên khi
 * ghi đè snapshot phải giữ lại giá trị đang có trong DB — nếu không, chỉ cần mở
 * game bằng bundle cũ là tiến trình Vườn/Bang/Plinko biến mất.
 * Client mới LUÔN gửi key (null khi trống) nên xoá có chủ đích vẫn hoạt động.
 */
const CARRY_FORWARD_FIELDS = ["gameMode", "modeBest", "guild", "garden", "plinko"];

/** Dựng lại seed chuẩn khi bản ghi save của tài khoản đã đánh dấu bị thất lạc. */
async function restoreCanonicalSave(saves, player, playerId) {
  const doc = buildCanonicalNewAccountSave({ playerId, username: player.username });
  try {
    await saves.insertOne(doc);
    return doc;
  } catch (error) {
    // Một request khác vừa tạo xong -> đọc lại thay vì ghi đè.
    if (error?.code === 11000) return saves.findOne({ playerId });
    throw error;
  }
}

export async function GET(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail("Ban can dang nhap de luu tien trinh.", 401);

  const db = await getMongoDb();
  const saves = db.collection(COLLECTIONS.saves);
  const playerId = String(player._id);
  let doc = await saves.findOne({ playerId });

  // Tài khoản đã đánh dấu khởi tạo chuẩn thì bản ghi save phải tồn tại. Nếu mất,
  // "không có save" nghĩa là dữ liệu đã mất — không phải người chơi mới — nên
  // khôi phục seed chuẩn thay vì trả hasSave=false cho client tự dựng state.
  if (!doc && isCanonicalAccount(player)) {
    doc = await restoreCanonicalSave(saves, player, playerId);
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

  const existing = await saves.findOne({ playerId }, { projection: {
    revision: 1, ledger: 1,
    "data.gold": 1, "data.gems": 1, "data.vipCoins": 1, "data.vipPasses": 1, "data.lifetimeStats": 1, "data.season": 1,
    "data.gameMode": 1, "data.modeBest": 1, "data.guild": 1, "data.garden": 1, "data.plinko": 1,
  } });
  const currentRevision = existing ? (existing.revision || 1) : 0;

  if (expectedRevision !== currentRevision) {
    return json({
      ok: false,
      error: "Du lieu da thay doi tu thiet bi khac. Hay tai lai truoc khi luu.",
      conflict: true,
      serverRevision: currentRevision,
    }, 409);
  }

  // Client cũ (bundle trong cache) không gửi các hệ mới. Nếu ghi đè snapshot mà
  // thiếu key thì tiến trình Vườn/Bang/Plinko của người chơi biến mất chỉ vì họ
  // mở game bằng JS cũ. Giữ lại giá trị đang có trong DB cho field KHÔNG xuất
  // hiện trong payload; client mới luôn gửi key (null khi trống) nên thao tác
  // xoá có chủ đích vẫn hoạt động.
  const incomingData = body.data.data;
  // VIP is issued by admins. Client snapshots may carry the value for display,
  // but they never get to create, increase, or erase the server balance.
  check.data.vipCoins = Math.max(0, Math.min(1e9, Number(existing?.data?.vipCoins) || 0));
  check.data.vipPasses = normalizeVipPasses(existing?.data?.vipPasses);
  if (!hasVipPass(check.data.vipPasses, 'hunting') && check.data.wikiEventsState?.huntingWarriorCard) {
    check.data.wikiEventsState.huntingWarriorCard = false;
  }
  for (const key of CARRY_FORWARD_FIELDS) {
    if (key in incomingData) continue;
    if (existing && existing.data && key in existing.data) {
      check.data[key] = existing.data[key];
    }
  }

  // ===== Kiểm tra kinh tế phía server =====
  // Không tin client: chặn việc tự cấp vàng/đá quý qua một request duy nhất.
  // So sánh với bản ghi đang có trong DB, dùng số revision tăng làm mốc.
  // (1) Hạn mức delta cũ — chặn payload khổng lồ trước khi tính ngân sách.
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

  // ===== (2) Ngân sách theo ĐỒNG HỒ SERVER =====
  // Delta cũ chỉ chặn 500.000 vàng/lần lưu; kẻ gian vẫn mint được 500k mỗi revision.
  // Ngân sách nạp theo thời gian thật nên trần thu nhập phụ thuộc thời gian đã chơi,
  // không phụ thuộc số lần lưu. Xem lib/economyLedger.js.
  const budget = validateEconomyBudget(existing?.data || null, check.data, existing?.ledger || null);
  if (!budget.ok) {
    const save = await saves.findOne({ playerId }, { projection: { revision: 1, data: 1 } });
    return json({
      ok: false,
      error: "Kinh tế không hợp lệ so với thời gian chơi.",
      code: budget.code,
      message: budget.message,
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
    // Ngân sách còn lại sau lần lưu này — mốc để lần sau refill theo thời gian.
    ledger: budget.ledger,
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
