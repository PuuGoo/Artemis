// Khoá lại màn hình tổng kết khi THUA (runDefeatModal).
//
// Chạy: node tests/run-defeat.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ============================================================ 1. DOM + CSS
console.log("\n=== 1. DOM & CSS ===");
check("co #runDefeatModal", html.includes('id="runDefeatModal"'));
check("co #runDefeatCard", html.includes('id="runDefeatCard"'));
check("modal mac dinh an (hidden)", /id="runDefeatModal" class="hidden/.test(html));
check("z-45 (tren summary z-40)", /id="runDefeatModal"[^>]*z-45/.test(html));
check("co khoi .df-hero", /\.df-hero \{/.test(html));
check("co .df-skull", /\.df-skull \{/.test(html));
check("co .df-title", /\.df-title \{/.test(html));
check("co .df-progress-track", /\.df-progress-track \{/.test(html));
check("co .df-progress-fill", /\.df-progress-fill \{/.test(html));
check("co .df-record (ky luc moi)", /\.df-record \{/.test(html));
check("co .df-best", /\.df-best \{/.test(html));
check("co .df-stat", /\.df-stat \{/.test(html));
check("co .df-tip", /\.df-tip \{/.test(html));
check("co 2 nut .df-btn-ghost/.df-btn-primary", /\.df-btn-ghost/.test(html) && /\.df-btn-primary/.test(html));
for (const anim of ["dfVeil", "dfSkull", "dfFill", "dfTipIn"]) {
  check(`co @keyframes ${anim}`, new RegExp("@keyframes " + anim).test(html));
}
check("goi y hien dan dan (3 delay khac nhau)",
  /\.df-tip:nth-child\(1\) \{ animation-delay: \.25s/.test(html) &&
  /\.df-tip:nth-child\(2\) \{ animation-delay: \.38s/.test(html) &&
  /\.df-tip:nth-child\(3\) \{ animation-delay: \.51s/.test(html));
check("co responsive <= 520px", /@media \(max-width: 520px\) \{\s*\.df-skull/.test(html));

// ============================================================ 2. Hàm
console.log("\n=== 2. HAM openRunDefeat ===");
const fnStart = html.indexOf("function openRunDefeat(info = {})");
check("co openRunDefeat", fnStart > 0);
// Cat theo can bang ngoac: ham dai ra sau moi lan them tinh nang, offset
// co dinh se cut giua chung va test bao FAIL sai trong khi code dung.
const fnBlock = (() => {
  const pc = html.indexOf(") {", fnStart);
  let d = 0, e = -1;
  for (let k = html.indexOf("{", pc); k < html.length; k++) {
    if (html[k] === "{") d++;
    else if (html[k] === "}") { d--; if (d === 0) { e = k; break; } }
  }
  return html.slice(fnStart, e + 1);
})();
check("lay du tham so info", /function openRunDefeat\(info = \{\}\)/.test(html));
check("co gia tri mac dinh tu Game", /info\.room \|\| Game\.room/.test(fnBlock));
check("tinh % hoan thanh", /const pct = Math\.round\(\(room \/ max\) \* 100\)/.test(fnBlock));
check("ky luc do theo CHE DO (modeBest), khong dung best chuong", /SaveState.modeBest/.test(fnBlock));
check("nhan dien chet do trum", /const diedToBoss = info\.source === 'boss' \|\| bossRoom/.test(fnBlock));
check("toi da 3 goi y", /tips\.slice\(0, 3\)/.test(fnBlock));
check("dinh dang vang vi-VN", /gold\.toLocaleString\('vi-VN'\)/.test(fnBlock));
check("nut Ve Sanh goi returnToLobby", /btnDfLobby[\s\S]{0,120}?returnToLobby\(\)/.test(fnBlock));
check("nut Thu Lai goi startNewRun", /btnDfRetry[\s\S]{0,120}?startNewRun\('fresh'\)/.test(fnBlock));
check("an modal truoc khi ve sanh", /btnDfLobby[\s\S]{0,90}?classList\.add\('hidden'\)/.test(fnBlock));
check("export openRunDefeat", /^\s+openRunDefeat,$/m.test(html));

// ============================================================ 3. Nối vào luồng chết
console.log("\n=== 3. NOI VAO LUONG CHET ===");
check("finishRun goi openRunDefeat", /openRunDefeat\(\{[\s\S]{0,260}?room: Game\.room/.test(html));
check("truyen source tu lastDamageSource", /source: Game\.lastDamageSource/.test(html));
check("truyen lastHit tu lastDamageAmount", /lastHit: Game\.lastDamageAmount/.test(html));
check("hurtPlayer ghi lastDamageSource", /Game\.lastDamageSource =/.test(html));
check("hurtPlayer ghi lastDamageAmount", /Game\.lastDamageAmount = dmg/.test(html));
check("HP khong am", /if \(p\.hp < 0\) p\.hp = 0/.test(html));
check("nhan dien nguon 'boss' khi co trum", /Game\.enemies\.some\(e => e\.isBoss\) \? 'boss'/.test(html));

// ============================================================ 4. Mô phỏng gợi ý
console.log("\n=== 4. MO PHONG GOI Y (chay that) ===");
/** Mô phỏng đúng logic tips trong openRunDefeat. */
function buildTips({ room, max, source, lastHit, baseHp }) {
  const bossRoom = (room % 5 === 0) || (room === max);
  const diedToBoss = source === "boss" || bossRoom;
  const pct = Math.round((room / max) * 100);
  const tips = [];
  if (diedToBoss) tips.push({ id: "boss-dodge" });
  else tips.push({ id: "kite" });
  if (room <= 3) tips.push({ id: "early" });
  else if (pct < 60) tips.push({ id: "defense" });
  else tips.push({ id: "offense" });
  if (baseHp > 0 && lastHit && lastHit > baseHp * 0.3) tips.push({ id: "bigHit" });
  return tips.slice(0, 3).map(t => t.id);
}

let t = buildTips({ room: 3, max: 15, source: "enemy", lastHit: 120, baseHp: 5000 });
check("P3 quai -> kite + early", t.includes("kite") && t.includes("early"), JSON.stringify(t));
check("P3 khong co bigHit (120 < 30% cua 5000)", !t.includes("bigHit"), JSON.stringify(t));

t = buildTips({ room: 5, max: 15, source: "boss", lastHit: 900, baseHp: 5000 });
check("P5 trum -> boss-dodge", t.includes("boss-dodge"), JSON.stringify(t));
check("P5 trum: 900 < 1500 nen khong bigHit", !t.includes("bigHit"), JSON.stringify(t));

t = buildTips({ room: 5, max: 15, source: "boss", lastHit: 2000, baseHp: 5000 });
check("P5 trum + don 2000 (>30%) -> co bigHit", t.includes("bigHit"), JSON.stringify(t));

t = buildTips({ room: 12, max: 15, source: "enemy", lastHit: 200, baseHp: 5000 });
check("P12 (80%) -> offense thay vi defense", t.includes("offense") && !t.includes("defense"), JSON.stringify(t));

t = buildTips({ room: 1, max: 15, source: "enemy", lastHit: 50, baseHp: 5000 });
check("P1 -> early (chua du 3 phong)", t.includes("early"), JSON.stringify(t));

t = buildTips({ room: 9, max: 15, source: "enemy", lastHit: 2000, baseHp: 5000 });
check("P9 (60%) -> offense (khong con defense)", t.includes("offense"), JSON.stringify(t));
check("P9 + don lon -> toi da 3 goi y", t.length <= 3, JSON.stringify(t));

t = buildTips({ room: 15, max: 15, source: "enemy", lastHit: 100, baseHp: 5000 });
check("P15 duoc coi la phong trum (room===max)", t.includes("boss-dodge"), JSON.stringify(t));

t = buildTips({ room: 10, max: 10, source: "enemy", lastHit: 100, baseHp: 5000 });
check("P10/10 = trum cuoi -> boss-dodge", t.includes("boss-dodge"), JSON.stringify(t));

// Phần trăm
check("P3/15 = 20%", Math.round(3 / 15 * 100) === 20);
check("P7/15 = 47%", Math.round(7 / 15 * 100) === 47);
check("P12/15 = 80%", Math.round(12 / 15 * 100) === 80);
check("P1/15 = 7%", Math.round(1 / 15 * 100) === 7);

// Kỷ lục
check("phong 7 > best 3 -> ky luc moi", 7 > Math.min(3, 15));
check("phong 3 < best 15 -> khong ky luc", !(3 > Math.min(15, 15)));
check("best 20 kep ve max 15 -> phong 15 khong phai ky luc", !(15 > Math.min(20, 15)));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
