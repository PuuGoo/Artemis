import { getCurrentPlayer } from "../../lib/http.js";
import { publicPlayer } from "../../lib/saveSchema.js";
import { getMongoDb, COLLECTIONS } from "../../lib/mongo.js";

export const config = { runtime: "nodejs" };

export default async function handler(request) {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "Chi ho tro GET." }), { status: 405 });
  }
  const player = await getCurrentPlayer(request);
  if (!player) {
    return new Response(JSON.stringify({ ok: true, authenticated: false, player: null }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const db = await getMongoDb();
  const save = await db.collection(COLLECTIONS.saves).findOne({ playerId: String(player._id) });

  return new Response(
    JSON.stringify({
      ok: true,
      authenticated: true,
      player: publicPlayer(player),
      hasSave: !!save,
      saveUpdatedAt: save?.updatedAt || null,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    },
  );
}
