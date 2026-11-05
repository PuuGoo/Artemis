// Khao sat tai khoan trong DB de phan loai test vs that.
// Chay: node tools/account-survey.mjs
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
function envVal(k) {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
}
const { MongoClient } = await import("mongodb");
const c = new MongoClient(envVal("MONGODB_URI"));
await c.connect();
const db = c.db(envVal("MONGODB_DB") || "artemis");

const players = await db.collection("players").find({}).toArray();
const saves = await db.collection("saves").find({}).toArray();
const saveByPlayer = new Map(saves.map((s) => [String(s.playerId), s]));

// Mau nhan dien tai khoan test — CO Y rat chat, chi bat nhung tien to ro rang
const TEST_PATTERNS = [
  /^test_/i,          // test_ab12cd
  /^test\d+_/i,       // test2_ab12cd
  /^adm_/i,           // adm_ab12cd (tai khoan do admin test tao ra)
  /^newbie/i,         // newbie, newbie806465
  /^e2e/i,            // e2e213818
  /^player\d+$/i,     // player2523
  /^u\d{6}$/i,        // u841537
  /^v\d{6}$/i,        // v632045
  /^w\d{6}$/i,        // w996068
  /^final\d+$/i,      // final379089, final808497
  /^prod\d+$/i,       // prod1793798908
  /^pr\d{8}$/i,       // pr10809627
  /^bj\d{6}$/i,       // bj835254
  /^cp\d{6}$/i,       // cp837566
  /^chk\d{6}$/i,      // chk808321
  /^shot\d+$/i,       // shot36172
  /^noc\d{5}$/i,      // noc39075
  /^pf\d{5}$/i,       // pf39702
  /^nw\d{6}$/i,       // nw841176
  /^ec\d{6}$/i,       // ec086873
  /^eco_/i,           // eco_n5q0f1k (test economy-live)
  /^move\d{6}$/i,     // move807763
  /^v\d{7,}$/i,       // v2808075 (7 chu so)
  /^reg\d+$/i,        // reg809305
  /^clean\d{6}$/i,    // clean806941
  /^zero\d{6}$/i,     // zero807355
  /^real\d{6}$/i,     // real807363
  /^fresh\d+$/i,      // fresh806773
  /^boss\d{6}$/i,     // boss808959
  /^cheat\d+$/i,      // cheat37956
  /^ok\d{5}$/i,       // ok841176
];

function isTestAccount(name) {
  return TEST_PATTERNS.some((re) => re.test(String(name || "")));
}

const rows = players.map((p) => {
  const s = saveByPlayer.get(String(p._id));
  const name = p.username || "?";
  return {
    name,
    test: isTestAccount(name),
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 16).replace("T", " ") : "?",
    hasSave: !!s,
    gold: s?.data?.gold ?? 0,
    kills: s?.data?.lifetimeStats?.kills ?? 0,
    runs: s?.data?.lifetimeStats?.runs ?? 0,
  };
});

const testRows = rows.filter((r) => r.test);
const realRows = rows.filter((r) => !r.test);

console.log(`Tong tai khoan: ${rows.length}`);
console.log(`  Tai khoan test (khop mau): ${testRows.length}`);
console.log(`  Tai khoan that (giu lai):  ${realRows.length}\n`);

console.log("=== TAI KHOAN THAT (KHONG BAO GIO XOA) ===");
for (const r of realRows.sort((a, b) => b.gold - a.gold)) {
  console.log(`  ${r.name.padEnd(20)} gold=${String(r.gold).padStart(10)} kills=${String(r.kills).padStart(5)} runs=${String(r.runs).padStart(4)} created=${r.createdAt}`);
}

console.log("\n=== TAI KHOAN TEST (ung vien xoa) ===");
for (const r of testRows.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${r.name.padEnd(20)} gold=${String(r.gold).padStart(10)} kills=${String(r.kills).padStart(5)} created=${r.createdAt}`);
}

console.log("\nTong gold tai khoan test:", testRows.reduce((s, r) => s + r.gold, 0));
console.log("Tong gold tai khoan that:", realRows.reduce((s, r) => s + r.gold, 0));

await c.close();
