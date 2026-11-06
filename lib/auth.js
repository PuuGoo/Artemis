import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "artemis_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 ngay

function secretKey() {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error("JWT_SECRET chua duoc cau hinh (can >= 16 ky tu). Them bien moi truong nay tren Vercel.");
  }
  return new TextEncoder().encode(raw);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function signSession(payload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload;
  } catch {
    return null;
  }
}

/** Doc cookie phien tu header Cookie cua Request (Web standard). */
export function readSessionToken(request) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (name === SESSION_COOKIE) {
      try { return decodeURIComponent(part.slice(idx + 1).trim()); }
      catch (error) {
        if (error instanceof URIError) return null;
        throw error;
      }
    }
  }
  return null;
}

export function sessionCookie(token, { clear = false } = {}) {
  const base = `${SESSION_COOKIE}=${clear ? "" : encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`;
  const maxAge = clear ? 0 : SESSION_MAX_AGE_SECONDS;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${base}; Max-Age=${maxAge}${secure}`;
}

// ===== Validation =====
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;
export const MAX_BODY_BYTES = 512 * 1024; // 512 KB: du cho save snapshot lon nhat
export const MAX_SAVE_BYTES = 400 * 1024;

export function validateCredentials(username, password) {
  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    return "Ten dang nhap phai dai 3-20 ky tu, chi gom chu, so va dau gach duoi.";
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return `Mat khau phai co it nhat ${MIN_PASSWORD} ky tu.`;
  }
  if (password.length > MAX_PASSWORD) {
    return `Mat khau toi da ${MAX_PASSWORD} ky tu.`;
  }
  return null;
}

export function normalizeUsername(username) {
  return String(username || "").trim();
}

export function usernameKey(username) {
  return normalizeUsername(username).toLowerCase();
}
