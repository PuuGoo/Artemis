// Don tai khoan test khoi DB. MAC DINH CHI XEM (dry-run), khong xoa gi.
//
//   node tools/purge-test-accounts.mjs            -> liet ke, khong xoa
//   node tools/purge-test-accounts.mjs --apply    -> backup roi moi xoa
//
// An toan:
//  • Danh sach tai khoan THAT duoc dinh nghia cung (REAL_ACCOUNTS) va KHONG BAO GIO
//    bi xoa ke ca khi khop mau test.
//  • Luon ghi file backup JSON truoc khi xoa; neu backup loi thi dung.
//  • Chi xoa tai khoan khop pattern test, va xoa ca save + login_attempts lien quan.
//  • Khong xoa collection nao khac.
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");

const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
function envVal(k) {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
}

// ===== TAI KHOAN THAT — TUYET DOI KHONG XOA =====
const REAL_ACCOUNTS = new Set(["puugoo", "web492972", "puugoo1"]);

const TEST_PATTERNS = [
  /^test_/i, /^test\d+_/i, /^adm_/i, /^newbie/i, /^e2e/i, /^player\d+$/i,
  /^u\d{6}$/i, /^v\d{6}$/i, /^v\d{7,}$/i, /^w\d{6}$/i, /^final\d+$/i,
  /^prod\d+$/i, /^pr\d{8}$/i, /^bj\d{6}$/i, /^cp\d{6}$/i, /^chk\d{6}$/i,
  /^shot\d+$/i, /^noc\d{5}$/i, /^pf\d{5}$/i, /^nw\d{6}$/i, /^ec\d{6}$/i,
  /^eco_/i, /^move\d{6}$/i, /^reg\d+$/i, /^clean\d{6}$/i, /^zero\d{6}$/i,
  /^real\d{6}$/i, /^fresh\d+$/i, /^boss\d{6}$/i, /^cheat\d+$/i, /^ok\d{5}$/i,
];

function isTestAccount(name) {
  const n = String(name || "");
  if (REAL_ACCOUNTS.has(n.toLowerCase())) return false;  // uu tien tuyet doi
  return TEST_PATTERNS.some((re) => re.test(n));
}

const { MongoClient } = await import("mongodb");
const c = new MongoClient(envVal("MONGODB_URI"));
await c.connect();
const db = c.db(envVal("MONGODB_DB") || "artemis");

const players = await db.collection("players").find({}).toArray();
const saves = await db.collection("saves").find({}).toArray();
const saveByPlayer = new Map(saves.map((s) => [String(s.playerId), s]));

const targets = players.filter((p) => isTestAccount(p.username));
const keep = players.filter((p) => !isTestAccount(p.username));

console.log(`Che do: ${APPLY ? "XOA THAT (--apply)" : "CHI XEM (dry-run)"}`);
console.log(`Tong tai khoan: ${players.length}`);
console.log(`  Se xoa:  ${targets.length}`);
console.log(`  Giu lai: ${keep.length} -> ${keep.map((p) => p.username).join(", ")}\n`);

if (targets.length === 0) {
  console.log("Khong co tai khoan test nao. Xong.");
  await c.close();
  process.exit(0);
}

// An toan: khong bao gio de xoa tai khoan that
for (const p of targets) {
  if (REAL_ACCOUNTS.has(String(p.username).toLowerCase())) {
    console.error(`ABORT: "${p.username}" nam trong danh sach THAT nhung bi coi la test.`);
    await c.close();
    process.exit(1);
  }
}

const targetIds = targets.map((p) => String(p._id));
const targetNames = targets.map((p) => p.username);

console.log("Tai khoan se xoa:");
for (const p of targets) {
  const s = saveByPlayer.get(String(p._id));
  console.log(`  ${String(p.username).padEnd(20)} gold=${String(s?.data?.gold ?? 0).padStart(10)}`);
}

if (!APPLY) {
  console.log("\nDry-run: khong xoa gi. Chay lai voi --apply de xoa that.");
  await c.close();
  process.exit(0);
}

// ===== BACKUP TRUOC KHI XOA =====
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = new URL("../backups/", import.meta.url);
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(backupDir.pathname.replace(/^\/([A-Za-z]:)/, "$1"), `purge-test-accounts-${stamp}.json`);

const backup = {
  createdAt: new Date().toISOString(),
  reason: "purge-test-accounts",
  players: targets,
  saves: targets.map((p) => saveByPlayer.get(String(p._id))).filter(Boolean),
};
fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");
const size = fs.statSync(backupPath).size;
if (size < 100) {
  console.error("ABORT: file backup qua nho, khong xoa gi.");
  await c.close();
  process.exit(1);
}
console.log(`\nDa backup ${targets.length} tai khoan + ${backup.saves.length} save -> ${backupPath} (${size} bytes)`);

// ===== XOA =====
const rPlayers = await db.collection("players").deleteMany({ _id: { $in: targets.map((p) => p._id) } });
const rSaves = await db.collection("saves").deleteMany({ playerId: { $in: targetIds } });
// login_attempts dung key dang "login:<key>" -> xoa theo username
const rAttempts = await db.collection("login_attempts").deleteMany({
  $or: targetNames.map((n) => ({ key: { $regex: new RegExp(String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } })),
});

console.log(`\nDa xoa:`);
console.log(`  players:        ${rPlayers.deletedCount}`);
console.log(`  saves:          ${rSaves.deletedCount}`);
console.log(`  login_attempts: ${rAttempts.deletedCount}`);

const left = await db.collection("players").countDocuments({});
console.log(`\nCon lai ${left} tai khoan: ${keep.map((p) => p.username).join(", ")}`);
console.log(`Backup: ${backupPath}`);

await c.close();
