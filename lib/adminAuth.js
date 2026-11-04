import { getMongoDb, COLLECTIONS } from "../lib/mongo.js";
import { getCurrentPlayer } from "../lib/http.js";

export const config = { runtime: "nodejs" };

/** Chỉ tài khoản trong biến môi trường ADMIN_USERNAMES mới được vào admin. */
export function adminUsernames() {
  return String(process.env.ADMIN_USERNAMES || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminPlayer(player) {
  if (!player) return false;
  const list = adminUsernames();
  if (list.length === 0) return false;
  return list.includes(String(player.username || "").toLowerCase());
}

/** Trả về player nếu là admin, ngược lại ném Response 403. */
export async function requireAdmin(request) {
  const player = await getCurrentPlayer(request);
  if (!player) {
    return { ok: false, response: new Response(JSON.stringify({ ok: false, error: "Cần đăng nhập." }), { status: 401, headers: { "content-type": "application/json; charset=utf-8" } }) };
  }
  if (!isAdminPlayer(player)) {
    return { ok: false, response: new Response(JSON.stringify({ ok: false, error: "Tài khoản không có quyền quản trị." }), { status: 403, headers: { "content-type": "application/json; charset=utf-8" } }) };
  }
  return { ok: true, player };
}

export async function db() {
  return getMongoDb();
}

export { COLLECTIONS };
