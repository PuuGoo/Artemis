// Server tĩnh tối thiểu để test build WebGL ở localhost.
// Chạy: node tools/serve-webgl.mjs [port] [root]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[3] || path.join(HERE, "..", "unity-client", "Builds", "WebGL"));
const PORT = Number(process.argv[2] || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".unityweb": "application/octet-stream",
  ".json": "application/json",
  ".png": "image/png",
  ".css": "text/css",
};

if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error("Không thấy index.html trong " + ROOT);
  console.error("Chạy build trước: Unity ... -executeMethod Artemis.EditorTools.BuildWebGL.Run");
  process.exit(1);
}

http
  .createServer((req, res) => {
    let rel = decodeURIComponent((req.url || "/").split("?")[0]);
    if (rel === "/") rel = "/index.html";
    const file = path.join(ROOT, rel);

    // Chặn path traversal.
    if (!path.resolve(file).startsWith(path.resolve(ROOT))) {
      res.writeHead(403).end("403");
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end("404 " + rel);
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
        "Content-Length": data.length,
      });
      res.end(data);
    });
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log("WebGL build đang chạy tại http://127.0.0.1:" + PORT + "/");
    console.log("Root: " + ROOT);
  });
