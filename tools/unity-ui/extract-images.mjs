#!/usr/bin/env node
// ==================== TRÍCH ẢNH BASE64 TỪ PRODUCTION ====================
//
// Production nhúng ảnh trực tiếp trong HTML dưới dạng data URI:
//
//   <img src="data:image/jpeg;base64,/9j/4AAQSkZJRg...">
//
// Đây là ảnh THẬT (avatar hero, chân dung skill...). Unity cần file .png trong
// Assets/, không đọc được data URI.
//
// Script này giải mã từng data URI ra file, và ghi bản đồ id -> tên file để
// Unity renderer biết node nào cần gắn sprite nào.
//
// Chạy: node tools/unity-ui/extract-images.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SRC = path.join(REPO, "public", "index.html");
const OUT_IMG = path.join(REPO, "unity-client", "Assets", "Artemis", "Resources", "ArtemisUi", "Images");
const OUT_MAP = path.join(REPO, "unity-client", "Assets", "Artemis", "Resources", "ArtemisUi", "uiImages.json");

const src = fs.readFileSync(SRC, "utf8");
const b0 = src.indexOf("<body");
const b1 = src.indexOf("<script", b0);
const html = src.slice(b0, b1);

// <img ... src="data:image/xxx;base64,AAAA" ...>
const IMG_RE = /<img\b([^>]*?)>/g;
const images = [];

fs.mkdirSync(OUT_IMG, { recursive: true });

let idx = 0;
for (const m of html.matchAll(IMG_RE)) {
  const attrs = m[1];
  const srcAttr = (attrs.match(/src\s*=\s*"([^"]*)"/) || [])[1] || "";
  if (!srcAttr.startsWith("data:image/")) continue;

  const dm = srcAttr.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.*)$/s);
  if (!dm) continue;

  const ext = dm[1].toLowerCase();               // jpeg | png | webp
  const b64 = dm[2];
  const buf = Buffer.from(b64, "base64");

  const id = (attrs.match(/id\s*=\s*"([^"]*)"/) || [])[1] || "";
  const alt = (attrs.match(/alt\s*=\s*"([^"]*)"/) || [])[1] || "";
  const cls = (attrs.match(/class\s*=\s*"([^"]*)"/) || [])[1] || "";

  // Tên file: ưu tiên id (ổn định), không có thì đánh số.
  const safe = (id || ("img" + String(idx).padStart(2, "0"))).replace(/[^\w.-]/g, "_");
  const fileName = safe + "." + (ext === "jpeg" ? "jpg" : ext);
  const outPath = path.join(OUT_IMG, fileName);

  fs.writeFileSync(outPath, buf);

  images.push({
    id,
    alt,
    cls: cls.split(/\s+/).filter(Boolean),
    file: fileName,
    bytes: buf.length,
    mime: dm[1],
  });
  idx++;
}

fs.writeFileSync(OUT_MAP, JSON.stringify({ images }, null, 1), "utf8");

console.log("=== TRÍCH ẢNH PRODUCTION ===");
console.log("  Số ảnh: " + images.length);
let total = 0;
for (const im of images) {
  total += im.bytes;
  console.log(
    "    " + (im.id || "(không id)").padEnd(22) +
    im.file.padEnd(30) +
    (im.bytes / 1024).toFixed(1) + " KB",
  );
}
console.log("  Tổng: " + (total / 1024).toFixed(1) + " KB");
console.log("  Ghi: unity-client/Assets/Artemis/Resources/ArtemisUi/Images/");
