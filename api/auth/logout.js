import { sessionCookie, readSessionToken, verifySessionToken, SESSION_MAX_AGE_SECONDS } from "../../lib/auth.js";
import { getCurrentPlayer } from "../../lib/http.js";
import { getMongoDb, COLLECTIONS } from "../../lib/mongo.js";
import { revocationDoc } from "../../lib/sessionRevocation.js";

export const config = { runtime: "nodejs" };

/**
 * Dang xuat THAT SU: xoa cookie + thu hoi token vua dung.
 *
 * Truoc day chi xoa cookie, nen token cu van dung duoc het 30 ngay — ai copy duoc
 * token (log, proxy, may dung chung) van tiep tuc vao duoc. Nay ghi `jti` vao
 * `revoked_sessions` de token do chet ngay. Chi phien hien tai bi huy; dang nhap
 * tren thiet bi khac khong bi anh huong.
 */
export async function POST(request) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "set-cookie": sessionCookie("", { clear: true }),
  };

  try {
    const token = readSessionToken(request);
    if (token) {
      const payload = await verifySessionToken(token);
      const jti = payload && payload.jti;
      // Chi ghi thu hoi khi token CON hop le va co jti; token rac thi chi can xoa cookie.
      if (jti && (await getCurrentPlayer(request))) {
        const db = await getMongoDb();
        const expiresAtMs = payload.exp
          ? Number(payload.exp) * 1000
          : Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
        await db.collection(COLLECTIONS.revokedSessions).updateOne(
          { _id: String(jti) },
          { $setOnInsert: revocationDoc(jti, expiresAtMs) },
          { upsert: true },
        );
      }
    }
  } catch (error) {
    // Dang xuat phai luon thanh cong voi nguoi dung: khong bao that bai chi vi
    // khong ghi duoc danh sach thu hoi (cookie van bi xoa).
    console.error("[logout] khong ghi duoc thu hoi phien:", error?.message || error);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
