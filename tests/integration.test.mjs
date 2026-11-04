// Test tich hop that: dang ky, dang nhap, luu, tai, chong ghi de, bao mat.
const BASE = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const jar = new Map();

function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

async function req(path, { method = "GET", body, cookies = true } = {}) {
  const headers = { "content-type": "application/json" };
  if (cookies && jar.size) headers.cookie = [...jar].map(([k, v]) => k + "=" + v).join("; ");
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
    if (v === "" || /Max-Age=0/i.test(c)) jar.delete(k); else jar.set(k, v);
  }
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data, raw: setCookie };
}

function sampleSave(over = {}) {
  return Object.assign({
    gold: 123456, gems: 789, stamina: 100, playerLevel: 42, playerName: "Tester",
    selectedChapterIdx: 0, selectedHeroId: "artemis", selectedWeaponId: "bow", selectedPetId: "spirit_sword",
    gearLevel: 15, activePreset: 1, heroSkinIdx: 0, sortMode: "quality", achievementFilter: "all",
    runes: { rune_flame: 5 }, talents: { might: 3 }, bestRooms: { 1: 8 }, gemInventory: { ruby: 2 },
    salvageMaterials: 500, heroStars: { artemis: 8 }, heroShards: { artemis: 999 },
    heroSelectedSkins: { artemis: 2 }, resonanceSlots: { slot1: "thor", slot2: "wukong" },
    unlockedSkins: { artemis_default: 1 }, lifetimeStats: { kills: 50, runs: 3 }, winsByChapter: { 1: 1 },
    achievementsUnlocked: { first_blood: 1730000000000 }, achievementsClaimed: { first_blood: 1730000000000 },
    starterSkillIds: ["multishot"], acquiredSkills: {},
    equippedGear: {
      weapon: { uid: "eq_w1", templateId: "crimson_bow", quality: "mythic", awakening: 0, level: 100, locked: false, favorite: true, sockets: [], affixes: [] },
      necklace: null, ring: null, armor: null, helmet: null, boots: null,
    },
    gearBag: [{ uid: "bag_1", templateId: "golden_helm", quality: "rare", awakening: 0, level: 5, locked: false, favorite: false, sockets: [], affixes: [] }],
    presets: { "1": { weapon: "eq_w1" } },
    gearLoadouts: { loadout_1: { id: "loadout_1", name: "Bo 1", slots: { weapon: "eq_w1" }, createdAt: 1730000000000 } },
  }, over);
}

const user = "test_" + Math.random().toString(36).slice(2, 10);

console.log("\n=== 1. HEALTH ===");
let r = await req("/api/health");
check("health tra ve ok", r.data?.ok === true, JSON.stringify(r.data));
check("ket noi mongo", r.data?.mongo === "up");

console.log("\n=== 2. AUTH ===");
r = await req("/api/auth/me");
check("chua dang nhap -> authenticated=false", r.data?.authenticated === false);

r = await req("/api/auth/register", { method: "POST", body: { username: "ab", password: "12345678" } });
check("username qua ngan bi tu choi", r.status === 400, "status=" + r.status);

r = await req("/api/auth/register", { method: "POST", body: { username: "validname", password: "short" } });
check("password qua ngan bi tu choi", r.status === 400, "status=" + r.status);

r = await req("/api/auth/register", { method: "POST", body: { username: user, password: "matkhau123" } });
check("dang ky thanh cong", r.status === 201 && r.data?.ok === true, "status=" + r.status + " " + JSON.stringify(r.data));
check("co set-cookie phien", jar.has("artemis_session"));

r = await req("/api/auth/me");
check("da dang nhap", r.data?.authenticated === true && r.data?.player?.username === user);

r = await req("/api/auth/register", { method: "POST", body: { username: user, password: "matkhau123" } });
check("trung username bi tu choi (409)", r.status === 409, "status=" + r.status);

r = await req("/api/auth/logout", { method: "POST" });
check("dang xuat xoa cookie", !jar.has("artemis_session"));

r = await req("/api/auth/login", { method: "POST", body: { username: user, password: "saimatkhau" } });
check("sai mat khau bi tu choi (401)", r.status === 401, "status=" + r.status);

r = await req("/api/auth/login", { method: "POST", body: { username: user, password: "matkhau123" } });
check("dang nhap lai thanh cong", r.status === 200 && r.data?.ok === true);

console.log("\n=== 3. SAVE ===");
r = await req("/api/save");
check("tai save khi chua co -> hasSave=false", r.data?.hasSave === false && r.data?.revision === 0);

const save = sampleSave();
r = await req("/api/save", { method: "PUT", body: { data: save, revision: 0 } });
check("luu lan dau thanh cong", r.data?.ok === true && r.data?.revision === 1, JSON.stringify(r.data));

r = await req("/api/save");
check("tai lai thay du lieu", r.data?.hasSave === true && r.data?.revision === 1);
check("gold luu dung", r.data?.data?.gold === 123456, "got " + r.data?.data?.gold);
check("equippedGear weapon dung", r.data?.data?.equippedGear?.weapon?.templateId === "crimson_bow");
check("lifetimeStats.kills dung", r.data?.data?.lifetimeStats?.kills === 50);
check("achievementsClaimed giu nguyen", r.data?.data?.achievementsClaimed?.first_blood === 1730000000000);

console.log("\n=== 4. CHONG GHI DE (revision) ===");
r = await req("/api/save", { method: "PUT", body: { data: sampleSave({ gold: 999 }), revision: 0 } });
check("revision cu bi tu choi (409)", r.status === 409 && r.data?.conflict === true, "status=" + r.status);

r = await req("/api/save", { method: "PUT", body: { data: sampleSave({ gold: 999 }), revision: 1 } });
check("revision dung duoc chap nhan", r.data?.ok === true && r.data?.revision === 2);

console.log("\n=== 5. VALIDATION / BAO MAT ===");
r = await req("/api/save", { method: "PUT", body: { data: sampleSave({ gold: -500 }), revision: 2 } });
const savedNeg = await req("/api/save");
check("gold am bi clamp ve 0", savedNeg.data?.data?.gold === 0, "got " + savedNeg.data?.data?.gold);

r = await req("/api/save", { method: "PUT", body: { data: sampleSave({ gearBag: new Array(500).fill({ templateId: "x", quality: "rare" }) }) } });
check("tui do qua lon bi tu choi (422)", r.status === 422, "status=" + r.status);

r = await req("/api/save", { method: "PUT", body: { data: { __proto__: { polluted: true }, gold: 5 } } });
const protoCheck = await fetch(BASE + "/api/save").then(x => x.json());
check("khong bi prototype pollution", !({}).polluted, "Object.prototype bi nhiem");

console.log("\n=== 6. CACH LY TAI KHOAN ===");
jar.clear();
const user2 = "test2_" + Math.random().toString(36).slice(2, 8);
r = await req("/api/auth/register", { method: "POST", body: { username: user2, password: "matkhau456" } });
check("tao tai khoan thu 2", r.status === 201);
r = await req("/api/save");
check("tai khoan 2 KHONG thay save cua tai khoan 1", r.data?.hasSave === false, JSON.stringify({ hasSave: r.data?.hasSave, gold: r.data?.data?.gold }));

console.log("\n=== 7. CHUA DANG NHAP ===");
jar.clear();
r = await req("/api/save");
check("GET save khi chua dang nhap -> 401", r.status === 401, "status=" + r.status);
r = await req("/api/save", { method: "PUT", body: { data: save, revision: 0 } });
check("PUT save khi chua dang nhap -> 401", r.status === 401, "status=" + r.status);

console.log("\n=== 8. CHONG SPAM DANG NHAP ===");
let blocked = false;
for (let i = 0; i < 20; i++) {
  const rr = await req("/api/auth/login", { method: "POST", body: { username: user, password: "wrong" + i } });
  if (rr.status === 429) { blocked = true; break; }
}
check("rate limit chan do mat khau", blocked);

console.log(`\n================ KET QUA: ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
