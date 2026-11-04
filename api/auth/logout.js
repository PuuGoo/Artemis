import { sessionCookie } from "../../lib/auth.js";
import { json } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(request) {
  if (request.method !== "POST") return json({ ok: false, error: "Chi ho tro POST." }, 405);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": sessionCookie("", { clear: true }),
    },
  });
}
