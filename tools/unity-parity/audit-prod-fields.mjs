#!/usr/bin/env node
// ==================== KIỂM CHỨNG TRÊN SAVE PRODUCTION (CHỈ ĐỌC) ====================
// Trả lời một câu hỏi duy nhất: trong MongoDB production, `data.artifactStars` và
// `data.equippedRuneSlots` có tồn tại không?
//
// CHỈ dùng find/count/aggregate ĐỌC. Không update, không delete, không insert.
// Không in username, không in _id, không in nội dung save — chỉ in SỐ ĐẾM.
//
// Chạy: node tools/unity-parity/audit-prod-fields.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) throw new Error("Không thấy .env");
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv();
const uri = env.MONGODB_URI;
if (!uri) throw new Error(".env không có MONGODB_URI");

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db(env.MONGODB_DB || env.MONGO_DB || undefined);
console.log("Đã kết nối database: " + db.databaseName + "\n");

const saves = db.collection("saves");

const total = await saves.countDocuments({});
console.log("Tổng số save: " + total + "\n");

const FIELD_PROBES = [
  ["artifactStars", { "data.artifactStars": { $exists: true, $ne: {} } }],
  ["equippedRuneSlots", { "data.equippedRuneSlots": { $exists: true } }],
  ["runes", { "data.runes": { $exists: true, $ne: {} } }],
  ["equippedGear.weapon", { "data.equippedGear.weapon": { $exists: true, $ne: null } }],
  ["heroStars", { "data.heroStars": { $exists: true, $ne: {} } }],
  ["talents", { "data.talents": { $exists: true, $ne: {} } }],
  ["season", { "data.season": { $exists: true } }],
  ["dungeonCheckpoint", { "data.dungeonCheckpoint": { $exists: true, $ne: null } }],
  ["runeQualityTier", { "data.runeQualityTier": { $exists: true } }],
];

console.log("Field có mặt trong save production:");
for (const [name, q] of FIELD_PROBES) {
  const n = await saves.countDocuments(q);
  const pct = total ? ((n / total) * 100).toFixed(1) : "0.0";
  console.log("  " + name.padEnd(24) + String(n).padStart(6) + " / " + total + "  (" + pct + "%)");
}

// Có bao nhiêu save mà equippedRuneSlots có ÍT NHẤT 1 rune đã gắn? Nếu trường
// không tồn tại thì câu trả lời là 0 — nghĩa là tính năng gắn rune không thể
// sống sót qua một lần tải lại trang.
const withRuneEquipped = await saves.countDocuments({
  $or: [
    { "data.equippedRuneSlots.etched.0": { $exists: true } },
    { "data.equippedRuneSlots.blessing.0": { $exists: true } },
    { "data.equippedRuneSlots.enhancement.0": { $exists: true } },
    { "data.equippedRuneSlots.ability.0": { $exists: true } },
  ],
});
console.log("\nSave có ít nhất 1 rune đã gắn: " + withRuneEquipped);

const withAnyArtifactStar = await saves.countDocuments({
  $expr: { $gt: [{ $size: { $objectToArray: { $ifNull: ["$data.artifactStars", {}] } } }, 0] },
});
console.log("Save có artifact 0 sao trở lên (có key artifactStars): " + withAnyArtifactStar);

await client.close();
console.log("\nXong (chỉ đọc).");
