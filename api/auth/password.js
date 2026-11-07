import { getMongoDb, COLLECTIONS } from "../../lib/mongo.js";
import { getCurrentPlayer, json, fail, readJsonBody, bumpRateLimit, clientIp } from "../../lib/http.js";
import { hashPassword, verifyPassword, validateCredentials, signSession, sessionCookie } from "../../lib/auth.js";
import { newSessionId } from "../../lib/sessionRevocation.js";

export const config = { runtime: "nodejs" };

/**
 * Đổi mật khẩu.
 *
 * Vì sao phải tăng `sessionEpoch`: JWT là stateless. Nếu chỉ đổi hash mật khẩu thì
 * mọi token đã phát (kể cả của kẻ đã chiếm được phiên) vẫn dùng được tới 30 ngày.
 * Tăng epoch làm `getCurrentPlayer()` từ chối TẤT CẢ token cũ ngay lập tức.
 *
 * Người đổi mật khẩu được cấp token MỚI (mang epoch mới) để không bị đăng xuất oan.
 */
export async function POST(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail("Ban can dang nhap de doi mat khau.", 401);

  // Chống dò mật khẩu hiện tại: 5 lần / 5 phút mỗi IP.
  const limit = await bumpRateLimit(`pwd:${clientIp(request)}`, { windowMs: 5 * 60_000, max: 5 });
  if (!limit.allowed) return fail("Thu lai sau it phut.", 429);

  const body = await readJsonBody(request, { maxBytes: 8 * 1024 });
  if (!body.ok) return fail("Du lieu gui len khong hop le.", 400);

  const currentPassword = String(body.data?.currentPassword ?? "");
  const newPassword = String(body.data?.newPassword ?? "");

  if (!currentPassword) return fail("Nhap mat khau hien tai.", 400);
  if (!newPassword) return fail("Nhap mat khau moi.", 400);

  // Dùng lại đúng luật validation của đăng ký (độ dài, ký tự).
  // validateCredentials trả null khi hợp lệ, hoặc chuỗi lỗi.
  const invalid = validateCredentials(player.username, newPassword);
  if (invalid) return fail(invalid, 400);
  if (newPassword === currentPassword) return fail("Mat khau moi phai khac mat khau cu.", 400);

  const storedHash = player.passwordHash;
  const okCurrent = await verifyPassword(currentPassword, storedHash);
  if (!okCurrent) return fail("Mat khau hien tai khong dung.", 401);

  const db = await getMongoDb();
  const players = db.collection(COLLECTIONS.players);
  const nextHash = await hashPassword(newPassword);

  // $inc epoch + đổi hash trong CÙNG một update -> không có cửa sổ nào token cũ còn sống
  // sau khi hash đã đổi.
  const result = await players.updateOne(
    { _id: player._id },
    { $set: { passwordHash: nextHash, passwordChangedAt: new Date() }, $inc: { sessionEpoch: 1 } },
  );
  if (result.matchedCount !== 1) return fail("Khong tim thay tai khoan.", 404);

  const nextEpoch = (Number(player.sessionEpoch) || 0) + 1;
  const token = await signSession({
    sub: String(player._id),
    username: player.username,
    jti: newSessionId(),
    ep: nextEpoch,
  });

  return new Response(JSON.stringify({ ok: true, sessionsRevoked: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": sessionCookie(token),
    },
  });
}
