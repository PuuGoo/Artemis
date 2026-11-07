// Thu hoi phien JWT.
//
// Van de: JWT la stateless. Khi nguoi dung bam Dang xuat, cookie bi xoa o client
// nhung token cu VAN CON HAN 30 ngay — ai copy duoc token (log, proxy, may dung
// chung) van dung duoc. Tuong tu sau khi doi mat khau, token cu van song.
//
// Cach lam: moi token co `jti` (id phien). Khi logout, ghi jti vao
// `revoked_sessions` voi TTL = dung thoi diem token het han -> collection tu don.
// Khi xac thuc, jti nam trong danh sach thu hoi => coi nhu chua dang nhap.
//
// Doi mat khau dung co che manh hon: tang `sessionEpoch` tren player, huy TOAN BO
// token cu cua tai khoan do (ke ca tren thiet bi khac).
import { randomUUID } from "node:crypto";

export const REVOCATION_COLLECTION = "revoked_sessions";

/** Sinh jti cho phien moi. */
export function newSessionId() {
  return randomUUID();
}

/**
 * Token co bi thu hoi khong?
 * - `revokedAt` la thoi diem (ms) ghi vao danh sach thu hoi, hoac null.
 * - `payload.ep` la sessionEpoch luc phat token; player.sessionEpoch la hien tai.
 * Tra ve true neu da bi thu hoi, hoac epoch da cu (doi mat khau / logout-all).
 */
export function isSessionRevoked(payload, { revokedAt = null, currentEpoch = 0 } = {}) {
  if (revokedAt) return true;
  const tokenEpoch = Number(payload && payload.ep);
  const epoch = Number(currentEpoch);
  // Token phat truoc khi co tinh nang nay khong co `ep` -> coi la epoch 0.
  const tokenEpochSafe = Number.isFinite(tokenEpoch) ? tokenEpoch : 0;
  const epochSafe = Number.isFinite(epoch) ? epoch : 0;
  return tokenEpochSafe < epochSafe;
}

/** Ban ghi TTL de danh sach thu hoi tu xoa khi token het han. */
export function revocationDoc(jti, expiresAtMs, nowMs = Date.now()) {
  return {
    _id: String(jti),
    expiresAt: new Date(Number(expiresAtMs) || (nowMs + 30 * 24 * 3600 * 1000)),
    revokedAt: new Date(nowMs),
  };
}
