import { sessionCookie } from "../../lib/auth.js";
import { json } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": sessionCookie("", { clear: true }),
    },
  });
}
