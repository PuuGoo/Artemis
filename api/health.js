import { getMongoDb } from "../lib/mongo.js";
import { json } from "../lib/http.js";

export const config = { runtime: "nodejs" };

// Vercel ho tro "named method" export cho Web-standard Request/Response.
// (Default export kieu (req,res) khong nhan Request Web, da gay loi 500/timeout.)
export async function GET() {
  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    return json({ ok: true, db: db.databaseName, mongo: "up", time: new Date().toISOString() });
  } catch (e) {
    return json({ ok: false, mongo: "down", error: String(e?.message || e).slice(0, 200) }, 503);
  }
}
