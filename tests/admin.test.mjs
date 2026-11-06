// Test tich hop: sua loi shop/events + admin API.
// Suite có thao tác admin phá hủy: chỉ chạy với fixtures trong DB cô lập.
if (process.env.ARTEMIS_ISOLATED_TESTS !== "1") {
  const { test } = await import("node:test");
  test("admin integration: cần tài khoản và database test cô lập", { skip: "BLOCKED: đặt ARTEMIS_ISOLATED_TESTS=1 sau khi xác minh DB test" }, () => {});
} else {
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
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
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

const ADMIN = process.env.TEST_ADMIN_USER || "puugoo";
const ADMIN_PW = process.env.TEST_ADMIN_PW || "matkhau123";
const user = "adm_" + Math.random().toString(36).slice(2, 9);

console.log("\n=== 1. ADMIN API: CHAN KHI CHUA DANG NHAP ===");
jar.clear();
let r = await req("/api/admin/stats");
check("stats -> 401 khi chua dang nhap", r.status === 401, "status=" + r.status);
r = await req("/api/admin/players");
check("players -> 401 khi chua dang nhap", r.status === 401, "status=" + r.status);

console.log("\n=== 2. TAO TAI KHOAN THUONG (khong phai admin) ===");
r = await req("/api/auth/register", { method: "POST", body: { username: user, password: "matkhau123" } });
check("tao tai khoan thuong", r.status === 201, JSON.stringify(r.data));
r = await req("/api/admin/stats");
check("tai khoan thuong -> 403 (khong co quyen)", r.status === 403, "status=" + r.status + " " + JSON.stringify(r.data));

console.log("\n=== 3. DANG NHAP ADMIN ===");
jar.clear();
r = await req("/api/auth/login", { method: "POST", body: { username: ADMIN, password: ADMIN_PW } });
check("dang nhap admin thanh cong", r.status === 200 && r.data?.ok === true, JSON.stringify(r.data));
r = await req("/api/admin/stats");
check("stats -> 200", r.status === 200 && r.data?.ok === true, "status=" + r.status);
check("stats co tong nguoi choi", typeof r.data?.players?.total === "number", JSON.stringify(r.data?.players));
check("stats co tong vang", typeof r.data?.economy?.totalGold === "number");
check("stats co top players", Array.isArray(r.data?.topPlayers));
const stats = r.data;

console.log("\n=== 4. DANH SACH NGUOI CHOI ===");
r = await req("/api/admin/players");
check("lay danh sach -> 200", r.status === 200 && r.data?.ok === true, "status=" + r.status + " " + JSON.stringify(r.data).slice(0, 150));
check("co rows array", Array.isArray(r.data?.rows));
check("co phan trang", typeof r.data?.pages === "number" && r.data.pages >= 1);
check("khong lo passwordHash", !JSON.stringify(r.data).includes("passwordHash"));
const target = (r.data?.rows || []).find(x => x.username === user);
check("tim thay tai khoan vua tao trong danh sach", !!target, "tong rows=" + (r.data?.rows || []).length);

console.log("\n=== 5. TIM KIEM + SAP XEP ===");
r = await req("/api/admin/players?q=" + encodeURIComponent(user));
check("tim kiem tra ve dung tai khoan", r.data?.rows?.length === 1 && r.data.rows[0].username === user);
r = await req("/api/admin/players?sort=kills");
check("sap xep theo kills khong loi", r.status === 200 && Array.isArray(r.data?.rows));

console.log("\n=== 6. CONG TAI NGUYEN (grant) ===");
// tao save cho tai khoan thuong truoc
jar.clear();
await req("/api/auth/login", { method: "POST", body: { username: user, password: "matkhau123" } });
r = await req("/api/save", { method: "PUT", body: { data: { gold: 100, gems: 10, maxedAllVersion: 1, artemisHeroVersion: 1, wikiCharactersVersion: 2 }, revision: 0 } });
check("tao save cho tai khoan thuong", r.data?.ok === true, JSON.stringify(r.data));

// quay lai admin
jar.clear();
await req("/api/auth/login", { method: "POST", body: { username: ADMIN, password: ADMIN_PW } });
r = await req("/api/admin/players");
const t2 = r.data.rows.find(x => x.username === user);
r = await req("/api/admin/players", { method: "PATCH", body: { playerId: t2.id, action: "grant", payload: { gold: 5000, gems: 300 } } });
check("grant thanh cong", r.data?.ok === true, JSON.stringify(r.data));

// verify bang cach doc save
r = await req("/api/admin/players?q=" + encodeURIComponent(user));
const after = r.data.rows[0];
check("vang tang dung 100+5000", after.gold === 5100, "got " + after.gold);
check("da quy tang dung 10+300", after.gems === 310, "got " + after.gems);

console.log("\n=== 7. DOI MAT KHAU ===");
r = await req("/api/admin/players", { method: "PATCH", body: { playerId: t2.id, action: "reset-password", payload: { password: "newpass12345" } } });
check("reset mat khau thanh cong", r.data?.ok === true, JSON.stringify(r.data));
jar.clear();
r = await req("/api/auth/login", { method: "POST", body: { username: user, password: "newpass12345" } });
check("dang nhap bang mat khau moi", r.status === 200 && r.data?.ok === true, "status=" + r.status);

console.log("\n=== 8. CHAN THAM SO XAU ===");
jar.clear();
await req("/api/auth/login", { method: "POST", body: { username: ADMIN, password: ADMIN_PW } });
r = await req("/api/admin/players", { method: "PATCH", body: { playerId: "khong-hop-le", action: "grant", payload: { gold: 1 } } });
check("playerId xau -> 400", r.status === 400, "status=" + r.status);
r = await req("/api/admin/players", { method: "PATCH", body: { playerId: t2.id, action: "khong-ton-tai", payload: {} } });
check("action la -> 400", r.status === 400, "status=" + r.status);
r = await req("/api/admin/players", { method: "PATCH", body: { playerId: t2.id, action: "reset-password", payload: { password: "ngan" } } });
check("mat khau ngan -> 400", r.status === 400, "status=" + r.status);

console.log("\n=== 9. XOA SAVE + XOA TAI KHOAN ===");
r = await req("/api/admin/players", { method: "PATCH", body: { playerId: t2.id, action: "delete-save", payload: {} } });
check("xoa save thanh cong", r.data?.ok === true);
r = await req("/api/admin/players?id=" + t2.id, { method: "DELETE" });
check("xoa tai khoan thanh cong", r.data?.ok === true, JSON.stringify(r.data));
r = await req("/api/admin/players?q=" + encodeURIComponent(user));
check("tai khoan da bi xoa khoi danh sach", r.data.rows.length === 0, "con " + r.data.rows.length + " rows");

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exitCode = fail > 0 ? 1 : 0;
}
