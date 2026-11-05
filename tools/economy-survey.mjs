// Khao sat du lieu kinh te thuc te de hieu chinh nguong server-side.
// Chay: node tools/economy-survey.mjs
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
function envVal(k) {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
}
const { MongoClient } = await import("mongodb");
const c = new MongoClient(envVal("MONGODB_URI"));
await c.connect();
const docs = await c.db(envVal("MONGODB_DB") || "artemis").collection("saves")
  .find({}, { projection: { username: 1, data: 1, updatedAt: 1 } }).toArray();

const rows = docs.map((d) => ({
  user: d.username || "?",
  gold: d.data?.gold || 0,
  gems: d.data?.gems || 0,
  goldEarned: d.data?.lifetimeStats?.goldEarned || 0,
  runs: d.data?.lifetimeStats?.runs || 0,
  kills: d.data?.lifetimeStats?.kills || 0,
  gearLevel: d.data?.gearLevel || 1,
}));

console.log(`Tong save: ${rows.length}\n`);
console.log("user".padEnd(18), "gold".padStart(12), "gems".padStart(10), "goldEarned".padStart(12), "runs".padStart(6), "kills".padStart(6));
for (const r of rows.sort((a, b) => b.gold - a.gold)) {
  console.log(
    String(r.user).padEnd(18),
    String(r.gold).padStart(12),
    String(r.gems).padStart(10),
    String(r.goldEarned).padStart(12),
    String(r.runs).padStart(6),
    String(r.kills).padStart(6),
  );
}

const nz = rows.filter((r) => r.goldEarned > 0);
console.log("\n--- Ty le gold / goldEarned (chi tai khoan co goldEarned > 0) ---");
if (nz.length === 0) console.log("(khong co)");
for (const r of nz) {
  console.log(`  ${String(r.user).padEnd(18)} gold=${r.gold}  earned=${r.goldEarned}  ratio=${(r.gold / r.goldEarned).toFixed(2)}`);
}

const noEarn = rows.filter((r) => r.goldEarned === 0 && r.gold > 0);
console.log("\n--- Tai khoan co gold > 0 nhung goldEarned = 0 (can grace) ---");
if (noEarn.length === 0) console.log("(khong co)");
for (const r of noEarn) console.log(`  ${String(r.user).padEnd(18)} gold=${r.gold}`);

console.log("\nMax gold:", Math.max(0, ...rows.map((r) => r.gold)));
console.log("Max gems:", Math.max(0, ...rows.map((r) => r.gems)));
console.log("Max goldEarned:", Math.max(0, ...rows.map((r) => r.goldEarned)));

await c.close();
