import { getMongoDb, COLLECTIONS } from "../lib/mongo.js";
import { json, fail } from "../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(request) {
  if (request.method !== "GET") return fail("Chi ho tro GET.", 405);
  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    return json({ ok: true, db: db.databaseName, mongo: "up", time: new Date().toISOString() });
  } catch (e) {
    return json({ ok: false, mongo: "down", error: String(e?.message || e).slice(0, 200) }, 503);
  }
}
