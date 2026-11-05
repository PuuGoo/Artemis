// Kiem chung THAT: tan cong tu cap vang qua PUT /api/save phai bi chan.
// Chay: node tests/economy-live.mjs   (can dev-server dang chay o :3000)
const BASE = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const jar = new Map();
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}
async function req(path, { method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => k + "=" + v).join("; ");
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of sc) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
    if (v === "" || /Max-Age=0/i.test(c)) jar.delete(k); else jar.set(k, v);
  }
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const user = "eco_" + Math.random().toString(36).slice(2, 9);

console.log("\n=== 1. TAO TAI KHOAN + SAVE GOC ===");
let r = await req("/api/auth/register", { method: "POST", body: { username: user, password: "matkhau123" } });
check("dang ky", r.status === 201, JSON.stringify(r.data).slice(0, 100));

const baseSave = {
  gold: 500, gems: 50, stamina: 20,
  maxedAllVersion: 1, artemisHeroVersion: 1, wikiCharactersVersion: 2,
  lifetimeStats: { goldEarned: 0 },
};
r = await req("/api/save", { method: "PUT", body: { data: baseSave, revision: 0 } });
check("luu save goc (500 vang)", r.data?.ok === true, JSON.stringify(r.data).slice(0, 120));
const rev0 = r.data?.revision;

console.log("\n=== 2. NGUOI CHOI HOP LE: KIEM 1 TRAN ===");
r = await req("/api/save", { method: "PUT", body: { data: { ...baseSave, gold: 2000, gems: 90 }, revision: rev0 } });
check("tang 1500 vang hop le -> 200", r.data?.ok === true, JSON.stringify(r.data).slice(0, 120));
const rev1 = r.data?.revision;

console.log("\n=== 3. TAN CONG: TU CAP 9.999.999 VANG ===");
r = await req("/api/save", { method: "PUT", body: { data: { ...baseSave, gold: 9999999 }, revision: rev1 } });
check("BI CHAN (422)", r.status === 422, "status=" + r.status);
check("code = ECONOMY_GOLD_JUMP", r.data?.code === "ECONOMY_GOLD_JUMP", r.data?.code);
check("co thong bao loi", typeof r.data?.error === "string" && r.data.error.length > 0);
check("co detail", !!r.data?.detail);
check("co conflict + serverData", r.data?.conflict === true && !!r.data?.serverData, "de client khong ghi de");

console.log("\n=== 4. SAVE TREN SERVER KHONG BI GHI DE ===");
r = await req("/api/save");
check("vang tren server van la 2000", r.data?.data?.gold === 2000, "got " + r.data?.data?.gold);
check("revision khong tang", r.data?.revision === rev1, `${r.data?.revision} vs ${rev1}`);

console.log("\n=== 5. TAN CONG DA QUY ===");
r = await req("/api/save", { method: "PUT", body: { data: { ...baseSave, gold: 2000, gems: 999999 }, revision: rev1 } });
check("BI CHAN (422)", r.status === 422, "status=" + r.status);
check("code = ECONOMY_GEMS_JUMP", r.data?.code === "ECONOMY_GEMS_JUMP", r.data?.code);

console.log("\n=== 6. TAN CONG KHAI KHONG goldEarned ===");
r = await req("/api/save", {
  method: "PUT",
  body: { data: { ...baseSave, gold: 2000, lifetimeStats: { goldEarned: 999999999 } }, revision: rev1 },
});
check("BI CHAN (422)", r.status === 422, "status=" + r.status);
check("code = ECONOMY_FAKE_EARNED", r.data?.code === "ECONOMY_FAKE_EARNED", r.data?.code);

console.log("\n=== 7. TIEP TUC CHOI BINH THUONG DUOC ===");
r = await req("/api/save", { method: "PUT", body: { data: { ...baseSave, gold: 3500, gems: 130 }, revision: rev1 } });
check("luu tiep sau khi bi chan van duoc", r.data?.ok === true, JSON.stringify(r.data).slice(0, 120));

console.log("\n=== 8. TIEU VANG (GIAM) LUON HOP LE ===");
r = await req("/api/save", { method: "PUT", body: { data: { ...baseSave, gold: 100, gems: 0 }, revision: r.data?.revision } });
check("tieu vang khong bi chan", r.data?.ok === true, JSON.stringify(r.data).slice(0, 120));

await req("/api/auth/logout", { method: "POST" });
console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
