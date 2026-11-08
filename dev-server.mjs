import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveApiRequestUrl } from "./lib/httpRouting.js";

// ==================== LOCAL DEV SERVER ====================
// Chay dung cac file trong /api nhu Vercel serverless function.
// Chuyen Request/Response Web standard -> http.IncomingMessage/ServerResponse.
// Khong can Vercel CLI de test: `npm run dev`.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const API_REWRITES = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8')).rewrites || [];

// ---- Doc .env thu cong (khong phu thuoc dotenv) ----
function loadEnv() {
  const file = path.join(__dirname, ".env");
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function toWebRequest(req, rewrittenUrl) {
  const host = req.headers.host || `localhost:${PORT}`;
  const url = rewrittenUrl || new URL(req.url, `http://${host}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else headers.set(k, v);
  }
  const method = req.method || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(url.toString(), {
    method,
    headers,
    body: hasBody ? req : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

async function sendWebResponse(res, webRes) {
  res.statusCode = webRes.status;
  for (const [k, v] of webRes.headers) res.setHeader(k, v);
  const buf = Buffer.from(await webRes.arrayBuffer());
  res.end(buf);
}

// ---- Dinh tuyen /api/*.js ----
function resolveApiFile(pathname) {
  const rel = pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const candidates = rel
    ? [path.join(__dirname, "api", rel + ".js"), path.join(__dirname, "api", rel, "index.js")]
    : [];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = resolveApiRequestUrl(new URL(req.url, `http://${req.headers.host || "localhost"}`), API_REWRITES);

    if (url.pathname.startsWith("/api/")) {
      const file = resolveApiFile(url.pathname);
      if (!file) {
        res.statusCode = 404;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, error: "API route khong ton tai: " + url.pathname }));
        return;
      }
      // Luu y dev: ESM cache khong the xoa, nen sua file trong lib/* phai KHOI DONG LAI
      // dev-server. (Vercel tao process moi moi request nen khong gap van de nay.)
      const mod = await import(pathToFileURL(file).href + "?t=" + Date.now());
      // Ho tro CA HAI kieu: named method export (GET/POST/PUT - kieu Vercel)
      // va default handler(request) kieu cu.
      const method = (req.method || "GET").toUpperCase();
      const handler = mod[method] || mod.default;
      if (typeof handler !== "function") {
        res.statusCode = 405;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, error: `Phuong thuc ${method} khong duoc ho tro.` }));
        return;
      }
      const webRes = await handler(toWebRequest(req, url));
      await sendWebResponse(res, webRes);
      return;
    }

    // ---- Static files tu /public ----
    let p = url.pathname;
    if (p === "/" || p === "") p = "/index.html";
    const safe = path.normalize(p).replace(/^(\.\.[/\\])+/, "");
    const file = path.join(__dirname, "public", safe);
    if (!file.startsWith(path.join(__dirname, "public"))) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("404 Not Found: " + p);
      return;
    }
    res.statusCode = 200;
    res.setHeader("content-type", MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("cache-control", "no-store");
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error("[dev-server] error:", e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify({ ok: false, error: String(e?.message || e).slice(0, 300) }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  Artemis dev server: http://localhost:${PORT}`);
  console.log(`  MongoDB: ${process.env.MONGODB_URI ? "da cau hinh" : "THIEU MONGODB_URI"}`);
  console.log(`  JWT_SECRET: ${process.env.JWT_SECRET ? "da cau hinh" : "THIEU JWT_SECRET"}\n`);
});
