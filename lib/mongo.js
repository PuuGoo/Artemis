import { MongoClient } from "mongodb";

// Ket noi LAZY + cache theo process, giong convention cua Vocabulary_Exam:
// khong doc env o module scope de loi cau hinh khong lam chet moi thu import no.
let cachedClient = null;
let cachedIndexesReady = false;

function connectionStringOrThrow() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGODB_URI chua duoc cau hinh. Them bien moi truong nay tren Vercel/`.env`.");
  }
  return uri;
}

export function getMongoClient() {
  if (cachedClient) return cachedClient;
  cachedClient = new MongoClient(connectionStringOrThrow(), {
    maxPoolSize: process.env.NODE_ENV === "production" ? 10 : 2,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });
  return cachedClient;
}

export const DB_NAME = process.env.MONGODB_DB || "artemis";

export async function getMongoDb() {
  // Backend bộ nhớ: CHỈ cho dev/test, không bao giờ trên production.
  // Xem lib/mongoMemory.js — dùng để chạy E2E qua đúng HTTP stack mà không cần
  // Atlas và không chạm dữ liệu thật.
  if (process.env.DB_BACKEND === "memory") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DB_BACKEND=memory khong duoc phep tren production.");
    }
    const { createMemoryDb } = await import("./mongoMemory.js");
    return createMemoryDb();
  }
  const client = getMongoClient();
  await client.connect();
  const db = client.db(DB_NAME);
  if (!cachedIndexesReady) {
    await ensureIndexes(db);
    cachedIndexesReady = true;
  }
  return db;
}

export const COLLECTIONS = {
  players: "players",
  saves: "saves",
  loginAttempts: "login_attempts",
  revokedSessions: "revoked_sessions",
};

async function ensureIndexes(db) {
  // Chay song song, bo qua loi "index da ton tai" (code 85/86) de idempotent.
  const tasks = [
    db.collection(COLLECTIONS.players).createIndex({ usernameLower: 1 }, { unique: true, name: "uniq_username" }),
    db.collection(COLLECTIONS.saves).createIndex({ playerId: 1 }, { unique: true, name: "uniq_player" }),
    db.collection(COLLECTIONS.loginAttempts).createIndex({ key: 1 }, { unique: true, name: "uniq_attempt_key" }),
    // TTL: tu don ban ghi dang nhap sai sau 1 gio.
    db.collection(COLLECTIONS.loginAttempts).createIndex({ lastAt: 1 }, { expireAfterSeconds: 3600, name: "ttl_attempts" }),
    // Danh sach phien bi thu hoi: Mongo tu xoa khi token het han (expireAfterSeconds 0
    // nghia la xoa ngay khi `expiresAt` troi qua).
    db.collection(COLLECTIONS.revokedSessions).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "ttl_revoked" }),
  ];
  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === "rejected") {
      const code = r.reason?.code;
      if (code !== 85 && code !== 86) throw r.reason;
    }
  }
}
