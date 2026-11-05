// Khoá lại hệ thống text nổi (float text) phân loại theo ngữ cảnh.
//
// Chạy: node tests/float-text.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ============================================================ 1. Hàm spawnFloatText
console.log("\n=== 1. HAM spawnFloatText ===");
const fnStart = html.indexOf("function spawnFloatText(x, y, text");
const fnBlock = html.slice(fnStart, fnStart + 2200);
check("co tham so opts", /function spawnFloatText\(x, y, text, color = '#ffffff', size = 13, opts = \{\}\)/.test(html));
check("co bang PRESET", /const PRESET = \{/.test(fnBlock));
for (const kind of ["normal", "crit", "boss", "heal", "info"]) {
  check(`PRESET co loai '${kind}'`, new RegExp(kind + ":\\s*\\{").test(fnBlock));
}
check("crit to hon normal (size do nguoi goi truyen)", /isCrit \? 17/.test(html));
check("crit co glow", /crit:\s*\{[^}]*glow:\s*1[0-9]/.test(fnBlock));
check("normal khong glow", /normal:\s*\{[^}]*glow:\s*0/.test(fnBlock));
check("crit song lau hon normal",
  (() => {
    const crit = fnBlock.match(/crit:\s*\{[^}]*life:\s*([\d.]+)/);
    const norm = fnBlock.match(/normal:\s*\{[^}]*life:\s*([\d.]+)/);
    return crit && norm && Number(crit[1]) > Number(norm[1]);
  })());
check("crit co shake", /crit:\s*\{[^}]*shake:\s*[\d.]+/.test(fnBlock));
check("crit bay len cao hon normal (vy)",
  (() => {
    const crit = fnBlock.match(/crit:\s*\{[^}]*vy:\s*([\d.]+)/);
    const norm = fnBlock.match(/normal:\s*\{[^}]*vy:\s*([\d.]+)/);
    return crit && norm && Number(crit[1]) > Number(norm[1]);
  })());
check("ghi maxLife (de tinh pop animation)", /maxLife:/.test(fnBlock));
check("co driftX ngau nhien (tranh chong so)", /driftX: \(Math\.random\(\) - 0\.5\)/.test(fnBlock));

// ============================================================ 2. Gắn kind đúng chỗ
console.log("\n=== 2. GAN KIND DUNG NGU CANH ===");
check("damage: crit -> 'crit'", /\{ kind: isCrit \? 'crit' :/.test(html));
check("damage: khong crit + trum -> 'boss'", /\{ kind: isCrit \? 'crit' : \(e\.isBoss \? 'boss' : 'normal'\) \}/.test(html));
check("damage len trum doi mau hong (#fda4af)", /e\.isBoss \? '#fda4af'/.test(html));
check("damage len trum size 14", /e\.isBoss \? 14 : 12/.test(html));
const healCount = (html.match(/kind: 'heal'/g) || []).length;
check("co it nhat 5 cho hoi mau gan kind 'heal'", healCount >= 5, String(healCount));

// ============================================================ 3. Render
console.log("\n=== 3. RENDER ===");
const rStart = html.indexOf("for (const ft of Game.floatTexts) {");
const rBlock = html.slice(rStart, rStart + 2200);
check("tim thay vong render", rStart > 0);
check("co pop animation theo tuoi (born)", /const born = maxLife - ft\.life/.test(rBlock));
check("co scale theo loai", /const baseScale = ft\.scale \|\| 1/.test(rBlock));
check("co rung khi shake > 0", /const sx = ft\.shake \?/.test(rBlock));
check("co glow khi glow > 0", /if \(ft\.glow > 0\) \{[\s\S]{0,120}?shadowBlur/.test(rBlock));
check("glow nhap nhay (sin) cho crit", /Math\.sin\(born \* 22\)/.test(rBlock));
check("stroke width theo loai", /ctx\.lineWidth = ft\.stroke \|\| 3\.8/.test(rBlock));
check("lineJoin round (vien dep)", /ctx\.lineJoin = 'round'/.test(rBlock));
check("crit co lop highlight trang", /if \(ft\.kind === 'crit'\)[\s\S]{0,200}?fillText\(ft\.text, 0, -1\)/.test(rBlock));
check("alpha dam dan khi het doi", /const alpha = Math\.min\(1, ft\.life \*/.test(rBlock));

// ============================================================ 4. Update
console.log("\n=== 4. UPDATE CHUYEN DONG ===");
const uStart = html.indexOf("for (let i = Game.floatTexts.length - 1; i >= 0; i--) {");
const uBlock = html.slice(uStart, uStart + 700);
check("bay len theo vy rieng", /ft\.y -= \(ft\.vy \|\| 32\) \* dt/.test(uBlock));
check("troi ngang theo driftX", /ft\.x \+= \(ft\.driftX \|\| 0\) \* dt/.test(uBlock));
check("xoa khi het doi", /if \(ft\.life <= 0\) Game\.floatTexts\.splice/.test(uBlock));

// ============================================================ 5. Mô phỏng bảng preset
console.log("\n=== 5. MO PHONG PRESET ===");
const PRESET = {
  normal: { life: 0.62, vy: 34, scale: 1.0, stroke: 3.4, glow: 0, shake: 0 },
  crit: { life: 0.95, vy: 42, scale: 1.18, stroke: 4.6, glow: 14, shake: 2.2 },
  boss: { life: 0.72, vy: 32, scale: 1.08, stroke: 4.2, glow: 8, shake: 1.1 },
  heal: { life: 0.85, vy: 30, scale: 1.05, stroke: 3.6, glow: 6, shake: 0 },
  info: { life: 0.75, vy: 32, scale: 1.0, stroke: 3.8, glow: 0, shake: 0 },
};
// Đọc preset từ source để so khớp (tránh lệch bản sao)
const srcPresets = {};
for (const k of Object.keys(PRESET)) {
  const m = fnBlock.match(new RegExp(k + ":\\s*\\{\\s*life:\\s*([\\d.]+),\\s*vy:\\s*([\\d.]+),\\s*scale:\\s*([\\d.]+),\\s*stroke:\\s*([\\d.]+),\\s*glow:\\s*([\\d.]+),\\s*shake:\\s*([\\d.]+)"));
  if (m) srcPresets[k] = { life: +m[1], vy: +m[2], scale: +m[3], stroke: +m[4], glow: +m[5], shake: +m[6] };
}
check("doc duoc 5 preset tu source", Object.keys(srcPresets).length === 5, JSON.stringify(Object.keys(srcPresets)));
check("crit: glow > boss > heal > normal=info=0",
  srcPresets.crit.glow > srcPresets.boss.glow &&
  srcPresets.boss.glow > srcPresets.heal.glow &&
  srcPresets.normal.glow === 0 && srcPresets.info.glow === 0);
check("crit song lau nhat", Object.values(srcPresets).every(p => p.life <= srcPresets.crit.life));
check("crit rung manh nhat", Object.values(srcPresets).every(p => p.shake <= srcPresets.crit.shake));
check("crit co scale lon nhat", Object.values(srcPresets).every(p => p.scale <= srcPresets.crit.scale));
check("moi loai co life 0.5-1.0s (khong qua ngan/dai)",
  Object.values(srcPresets).every(p => p.life >= 0.5 && p.life <= 1.0));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
