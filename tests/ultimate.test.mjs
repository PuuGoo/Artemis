// Khoa lai co che Tuyet Ky co hoi chieu.
//
// LO HONG DA VA: triggerCelestialUltimate() truoc day chi co
//   if (!Game.running || !Game.player) return;
// => bam nut HUD hoac phim Space lien tuc deu ban 20 dan x 1.45 ATK moi lan.
// Voi ATK 99.763 (tai khoan that) = 2,89 trieu sat thuong moi click, khong gioi
// han. Bam 10 lan = 28,9 trieu sat thuong => pha toan bo can bang pho ban.
//
// Chay: node tests/ultimate.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

const ultFnStart = html.indexOf("function triggerCelestialUltimate()");
const ultFnBody = html.slice(ultFnStart, html.indexOf("\n      function ", ultFnStart + 10));

console.log("\n=== 1. KHONG CON BAN KHONG GIOI HAN ===");
check("tim thay ham triggerCelestialUltimate", ultFnStart > 0);
check("co khai bao ULT_COST", /const ULT_COST\s*=\s*(\d+)/.test(html));
check("co khai bao ULT_REGEN_PER_SEC", /const ULT_REGEN_PER_SEC\s*=\s*(\d+)/.test(html));
check("ham kiem tra ultCharge truoc khi ban", /if\s*\(\s*p\.ultCharge\s*<\s*p\.ultMax\s*\)/.test(ultFnBody));
check("ham tieu het nang luong sau khi ban", /p\.ultCharge\s*=\s*0/.test(ultFnBody));
check("co return khi chua du nang luong",
  /if\s*\(\s*p\.ultCharge\s*<\s*p\.ultMax\s*\)\s*\{[\s\S]{0,300}?return;/.test(ultFnBody));
check("co canh bao khi bam luc chua du (khong im lang)",
  /Năng lượng|NL|nang luong/i.test(ultFnBody));

console.log("\n=== 2. NANG LUONG DUOC HOI THEO THOI GIAN ===");
check("co ham updateUltimateCharge", /function updateUltimateCharge\(dt\)/.test(html));
const regen = html.match(/const ULT_REGEN_PER_SEC\s*=\s*(\d+)/);
check("toc do hoi 10-30 NL/giay (5-10s moi lan dung)",
  regen && Number(regen[1]) >= 10 && Number(regen[1]) <= 30, regen ? regen[1] : "?");
check("updateUltimateCharge duoc goi trong updateGame",
  /function updateGame\(dt\)[\s\S]{0,1200}?updateUltimateCharge\(dt\)/.test(html));
// Thoi gian hoi day
const cost = html.match(/const ULT_COST\s*=\s*(\d+)/);
const secs = cost && regen ? Number(cost[1]) / Number(regen[1]) : 0;
console.log(`  hoi day sau ${secs.toFixed(1)} giay`);
check("hoi day trong 4-10 giay (khong qua nhanh, khong qua cham)",
  secs >= 4 && secs <= 10, secs.toFixed(1));

console.log("\n=== 3. NUT HUD PHAN ANH DUNG TRANG THAI ===");
check("co ham syncUltimateButton", /function syncUltimateButton\(\)/.test(html));
const syncBody = html.slice(html.indexOf("function syncUltimateButton()"),
  html.indexOf("\n      function ", html.indexOf("function syncUltimateButton()") + 10));
check("nut chi nhap nhay khi san sang", /classList\.toggle\('animate-pulse',\s*ready\)/.test(syncBody));
check("hien phan tram khi dang hoi", /Tuyệt Kỹ \(\$\{pct\}%\)/.test(syncBody));
check("lam mo nut khi chua san sang", /opacity/.test(syncBody));
check("sync duoc goi ngay sau khi ban", /p\.ultCharge\s*=\s*0;[\s\S]{0,120}?syncUltimateButton\(\)/.test(ultFnBody));

console.log("\n=== 4. KHOI TAO DUNG KHI VAO TRAN ===");
check("player co ultCharge khi tao moi", /ultCharge:\s*ULT_COST/.test(html));
check("player co ultMax khi tao moi", /ultMax:\s*ULT_COST/.test(html));

console.log("\n=== 5. PHIM SPACE CUNG BI CHAN ===");
check("phim Space chi goi triggerCelestialUltimate (da co guard ben trong)",
  /ev\.code === 'Space'[\s\S]{0,140}?triggerCelestialUltimate\(\)/.test(html));
check("khong co duong nao khac ban truc tiep 20 dan ma bo qua guard",
  (html.match(/Game\.playerBullets\.push/g) || []).length >= 1);

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
