// Xoá bản ghi rate-limit đăng nhập (chỉ dùng cho môi trường dev/test).
// Chạy: node tools/clear-rate-limit.mjs
import fs from "node:fs";
const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
function envVal(key) {
  const m = env.match(new RegExp("^" + key + "=(.*)$", "m"));
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const uri = envVal("MONGODB_URI");
const dbName = envVal("MONGODB_DB") || "artemis";
if (!uri) { console.error("Thieu MONGODB_URI"); process.exit(1); }
const { MongoClient } = await import("mongodb");
const c = new MongoClient(uri);
await c.connect();
const r = await c.db(dbName).collection("login_attempts").deleteMany({});
console.log(`Da xoa ${r.deletedCount} ban ghi rate limit.`);
await c.close();
