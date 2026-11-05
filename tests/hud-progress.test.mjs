// Khoá lại dòng định hướng trong HUD (còn bao xa tới trùm) và việc kẹp số phòng.
//
// Chạy: node tests/hud-progress.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ============================================================ 1. DOM + CSS
console.log("\n=== 1. DOM & CSS ===");
check("co #hudNextUp trong HUD", html.includes('id="hudNextUp"'));
check("dat trong khoi hv2-room (truoc pips)",
  html.indexOf('id="hudNextUp"') < html.indexOf('id="hudRoomPips"'));
check("co CSS .hv2-nextup", /\.hv2-nextup \{/.test(html));
check("co trang thai is-boss (nhap nhay)", /\.hv2-nextup\.is-boss/.test(html));
check("co trang thai is-final (tim)", /\.hv2-nextup\.is-final/.test(html));
check("co trang thai is-clear (xanh)", /\.hv2-nextup\.is-clear/.test(html));
check("co animation hv2nextPulse", /@keyframes hv2nextPulse/.test(html));

// ============================================================ 2. Logic
console.log("\n=== 2. LOGIC DINH HUONG ===");
const hudStart = html.indexOf("const nextEl = document.getElementById('hudNextUp')");
const hudBlock = html.slice(hudStart, hudStart + 2400);
check("tim thay khoi logic", hudStart > 0);
check("xac dinh phong trum dung luat setupRoom (boi so 5 HOAC phong cuoi)",
  /const isBossRoom = \(room % 5 === 0\) \|\| \(room === max\)/.test(hudBlock));
check("phong cuoi LUON la trum cuoi (khong phu thuoc chia het 5)",
  /const isFinalBoss = room === max;/.test(hudBlock));
check("KHONG con dieu kien sai 'max % 5 !== 0'", !/max % 5 !== 0/.test(hudBlock));
check("bao 'Con N phong toi Trum'", /Còn \$\{dist\} phòng tới/.test(hudBlock));
check("bao 'TRUM CUOI' khi o phong cuoi", /TRÙM CUỐI/.test(hudBlock));
check("co trang thai 'da toi cong cuoi'", /cổng cuối/.test(hudBlock));
check("chi cap nhat DOM khi text doi (tranh reflow)",
  /if \(nextEl\.textContent !== txt\) nextEl\.textContent = txt/.test(hudBlock));
check("gan class theo trang thai", /nextEl\.className = 'hv2-nextup ' \+ cls/.test(hudBlock));

// ============================================================ 3. Kẹp số phòng
console.log("\n=== 3. KEP SO PHONG (bug: setupRoom(15) tren chuong 10 phong) ===");
const srStart = html.indexOf("function setupRoom(roomNum)");
const srBlock = html.slice(srStart, srStart + 900);
check("setupRoom kep ve [1, Game.maxRooms]", /roomNum = Math\.max\(1, Math\.min\(_maxRooms, Math\.floor\(Number\(roomNum\) \|\| 1\)\)\)/.test(srBlock));
check("lay _maxRooms tu Game.maxRooms", /const _maxRooms = Math\.max\(1, Game\.maxRooms \|\| 1\)/.test(srBlock));
check("kep chay TRUOC khi gan Game.room", srBlock.indexOf("roomNum = Math.max") < srBlock.indexOf("Game.room = roomNum"));

// ============================================================ 4. Mô phỏng logic
console.log("\n=== 4. MO PHONG LOGIC (chay that) ===");
// Trich logic ra va chay tren các cặp (room, max) để khoá hành vi.
function nextUpText(room, max) {
  const isBossRoom = (room % 5 === 0) || (room === max);
  const isFinalBoss = room === max;
  if (isBossRoom) {
    return isFinalBoss ? "FINAL" : "BOSS";
  }
  let nextBoss = null;
  for (let i = room + 1; i <= max; i++) {
    if (i % 5 === 0 || i === max) { nextBoss = i; break; }
  }
  if (nextBoss === null) return "CLEAR";
  const dist = nextBoss - room;
  return (nextBoss === max ? "DIST_FINAL_" : "DIST_") + dist;
}

// Chương 1: 15 phòng (5, 10, 15 là trùm)
check("C1 P1 -> con 4 phong", nextUpText(1, 15) === "DIST_4", nextUpText(1, 15));
check("C1 P4 -> con 1 phong", nextUpText(4, 15) === "DIST_1", nextUpText(4, 15));
check("C1 P5 -> PHONG TRUM", nextUpText(5, 15) === "BOSS", nextUpText(5, 15));
check("C1 P10 -> PHONG TRUM", nextUpText(10, 15) === "BOSS", nextUpText(10, 15));
check("C1 P14 -> con 1 toi TRUM CUOI", nextUpText(14, 15) === "DIST_FINAL_1", nextUpText(14, 15));
check("C1 P15 -> TRUM CUOI (15 % 5 === 0 nhung van la cuoi)", nextUpText(15, 15) === "FINAL", nextUpText(15, 15));

// Chương 2: 12 phòng (5, 10, 12 là trùm)
check("C2 P1 -> con 4 phong", nextUpText(1, 12) === "DIST_4", nextUpText(1, 12));
check("C2 P5 -> PHONG TRUM", nextUpText(5, 12) === "BOSS", nextUpText(5, 12));
check("C2 P10 -> PHONG TRUM", nextUpText(10, 12) === "BOSS", nextUpText(10, 12));
check("C2 P11 -> con 1 toi TRUM CUOI", nextUpText(11, 12) === "DIST_FINAL_1", nextUpText(11, 12));
check("C2 P12 -> TRUM CUOI (12 % 5 !== 0)", nextUpText(12, 12) === "FINAL", nextUpText(12, 12));

// Chương 3: 10 phòng (5, 10 là trùm; 10 vừa bội 5 vừa cuối)
check("C3 P1 -> con 4 phong", nextUpText(1, 10) === "DIST_4", nextUpText(1, 10));
check("C3 P4 -> con 1 phong", nextUpText(4, 10) === "DIST_1", nextUpText(4, 10));
check("C3 P5 -> PHONG TRUM", nextUpText(5, 10) === "BOSS", nextUpText(5, 10));
check("C3 P9 -> con 1 toi TRUM CUOI", nextUpText(9, 10) === "DIST_FINAL_1", nextUpText(9, 10));
check("C3 P10 -> TRUM CUOI (boi 5 VA cuoi)", nextUpText(10, 10) === "FINAL", nextUpText(10, 10));

// Kẹp số phòng
function clampRoom(r, max) { return Math.max(1, Math.min(max, Math.floor(Number(r) || 1))); }
check("kep: 15 tren chuong 10 -> 10", clampRoom(15, 10) === 10);
check("kep: 0 -> 1", clampRoom(0, 10) === 1);
check("kep: -5 -> 1", clampRoom(-5, 10) === 1);
check("kep: NaN -> 1", clampRoom(NaN, 10) === 1);
check("kep: 7.9 -> 7", clampRoom(7.9, 10) === 7);
check("kep: 10 tren chuong 15 -> 10 (khong doi)", clampRoom(10, 15) === 10);

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
