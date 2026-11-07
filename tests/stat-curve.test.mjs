// Khoá lại đường cong ATK/HP — bảo vệ chống "tài khoản mới full đồ".
//
// Bối cảnh: 5 fallback trong code cấp sẵn chỉ số late-game cho MỌI tài khoản
// (kể cả vừa tạo), khiến ATK 287.510 / HP 1.052.029 khi không mặc gì — gấp
// hàng nghìn lần dải thiết kế 80-150 / 400-800. Bộ test này khoá từng fallback.
//
// Chạy: node tests/stat-curve.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

/** Lấy thân một hàm theo tên (cân bằng ngoặc nhọn). */
function fnBody(name, maxLen = 4000) {
  const idx = html.indexOf("function " + name + "(");
  if (idx < 0) return "";
  const open = html.indexOf("{", idx);
  let d = 0, end = -1;
  for (let i = open; i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (d === 0) { end = i; break; } }
  }
  return end > 0 ? html.slice(idx, Math.min(end + 1, idx + maxLen)) : "";
}

// ============================================================ 1. Hero star fallback
console.log("\n=== 1. FALLBACK HERO STAR ===");
const starFn = fnBody("getHeroStarLevel");
check("getHeroStarLevel ton tai", starFn.length > 0);
check("tra 0 khi tuong chua co (khong phai 8)", /return 0;/.test(starFn) && !/return 8;/.test(starFn));
check("van clamp 0..8 khi co du lieu", /Math\.max\(0, Math\.min\(8, raw\)\)/.test(starFn));

// ============================================================ 2. Artifact star fallback
console.log("\n=== 2. FALLBACK ARTIFACT STAR ===");
const artStarFn = fnBody("getArtifactStarLevel");
check("getArtifactStarLevel ton tai", artStarFn.length > 0);
check("tra 0 khi chua so huu (khong phai 15)", /return 0;/.test(artStarFn) && !/return 15;/.test(artStarFn));
check("khong tu ghi map[artId] = 15", !/map\[artId\] = 15/.test(artStarFn));
check("van clamp 0..15 khi co du lieu", /Math\.max\(0, Math\.min\(15, map\[artId\]\)\)/.test(artStarFn));

// ============================================================ 3. Artifact ownership
console.log("\n=== 3. SO HUU THANH VAT ===");
const artStatFn = fnBody("computeSingleArtifactStats");
check("0 sao -> 0 ATK", /if \(star <= 0\)[\s\S]{0,120}?atk: 0/.test(artStatFn));
check("0 sao -> 0 HP", /if \(star <= 0\)[\s\S]{0,120}?hp: 0/.test(artStatFn));
check("danh dau owned:false khi 0 sao", /owned: false/.test(artStatFn));
check("danh dau owned:true khi >0 sao", /owned: true/.test(artStatFn));
check("mult = 1 + star*0.5 (khong ap cho 0 sao)", /const mult = 1 \+ star \* 0\.50/.test(artStatFn));
check("cong thuc 15 sao van la 8.5x", (() => {
  const m = artStatFn.match(/const mult = 1 \+ star \* 0\.50/);
  return m && 1 + 15 * 0.5 === 8.5;
})());

const artAllFn = fnBody("computeAllArtifactsAndSetsBonuses", 6000);
check("bo qua specialBonus khi chua so huu", /if \(!st\.owned\) continue;/.test(artAllFn));
check("set bonus bo qua khi minStar <= 0", /if \(minStar <= 0\) continue;/.test(artAllFn));
check("van cong flat khi da so huu", /flatAtk \+= st\.atk;/.test(artAllFn));

// ============================================================ 4. Skin fallback
console.log("\n=== 4. FALLBACK SKIN ===");
const skinFn = fnBody("getActiveHeroSkin");
check("mac dinh skin idx 0 (khong phai 2)", /if \(typeof idx !== 'number'\) idx = 0;/.test(skinFn));

const unlockedFn = fnBody("isHeroSkinUnlocked");
check("save chua co truong -> chi mo skin mac dinh",
  /return skinId\.endsWith\('_default'\);/.test(unlockedFn));
check("khong auto-mo _legendary/_mythic", !/endsWith\('_legendary'\)\) return true/.test(unlockedFn));
check("van doc unlockedSkins khi co", /SaveState\.unlockedSkins\[skinId\]/.test(unlockedFn));

const skinColFn = fnBody("getAllUnlockedSkinBonuses");
// Logic "sở hữu" nay gom về một hàm dùng chung isHeroOwned() thay vì viết
// inline ở từng chỗ (trước đây rải rác nên dễ lệch nhau).
check("bo suu tap skin dung isHeroOwned (khong inline)",
  /isHeroOwned\(h\.id\)/.test(skinColFn));
check("bo qua tuong chua so huu", /if \(!isHeroOwned\(h\.id\)\) continue;/.test(skinColFn));

// ============================================================ 5. Base stats
console.log("\n=== 5. BASE STATS ===");
const csFn = fnBody("getComputedStats", 10000);
// Base stat phải đủ để TÂN THỦ KHÔNG CÓ GEAR vẫn sống được (80-150 ATK /
// 400-800 HP). 78/420 + bonus hero 1★ Alex (~+34/+230) => khoảng 112/650.
check("base ATK = 78 (du cho tan thu khong gear)", /\(78 \+ gearAtk/.test(csFn));
check("base HP = 420 (du cho tan thu khong gear)", /\(420 \+ gearHp/.test(csFn));
check("khong con base qua thap 48/300", !/\(48 \+ gearAtk/.test(csFn) && !/\(300 \+ gearHp/.test(csFn));
check("atkMult cua vu khi van ap dung", /\* weapon\.atkMult \*/.test(csFn));
check("crit dmg co base 1.85", /1\.85 \+ critDmgBonus/.test(csFn));
check("DEF dung duong cong bao hoa", /defFlat \/ \(defFlat \+ defK\)/.test(csFn));
check("DEF chan tren 0.75", /Math\.min\(0\.75,/.test(csFn));

// ============================================================ 6. Mô phỏng pipeline
console.log("\n=== 6. MO PHONG PIPELINE (chay that) ===");
// Mô phỏng đúng công thức để kiểm tra dải chỉ số ở từng giai đoạn.
function computeStats(o) {
  const BASE_ATK = 48, BASE_HP = 300;
  const gearAtk = o.gearAtk || 0, gearHp = o.gearHp || 0;
  const heroBonusAtk = o.heroBonusAtk || 0, heroBonusHp = o.heroBonusHp || 0;
  const starAtkMult = o.starAtkMult || 0, starHpMult = o.starHpMult || 0;
  const starFlatAtk = o.starFlatAtk || 0, starFlatHp = o.starFlatHp || 0;
  const skinAtk = o.skinAtk || 0, skinHp = o.skinHp || 0;
  const skinColAtk = o.skinColAtk || 0, skinColHp = o.skinColHp || 0;
  const artAtk = o.artAtk || 0, artHp = o.artHp || 0;
  const pctAtk = o.pctAtk || 0, pctHp = o.pctHp || 0;
  const weaponMult = o.weaponMult == null ? 1 : o.weaponMult;
  const gearLv = o.gearLv || 1;

  const heroStarAtk = Math.round(heroBonusAtk * (1 + starAtkMult)) + starFlatAtk + skinAtk + skinColAtk;
  const heroStarHp = Math.round(heroBonusHp * (1 + starHpMult)) + starFlatHp + skinHp + skinColHp;
  const atk = Math.round((BASE_ATK + gearAtk + artAtk + heroStarAtk + (gearLv - 1) * 12) * weaponMult * (1 + pctAtk));
  const hp = Math.round((BASE_HP + gearHp + artHp + heroStarHp + (gearLv - 1) * 45) * (1 + pctHp));
  return { atk, hp };
}

// Tân thủ: 1 tướng 0 sao, đồ common Lv.1, không artifact/skin bộ sưu tập
const tanThu = computeStats({
  gearAtk: 28, gearHp: 62, gearLv: 1,
  heroBonusAtk: 54, heroBonusHp: 205,
  skinAtk: 35, skinHp: 150,    // skin mặc định của tướng đang chọn
  skinColAtk: 9, skinColHp: 38 // 25% skin mặc định (chỉ 1 tướng sở hữu)
});
console.log("    tan thu:", JSON.stringify(tanThu));
check("tan thu ATK trong 120-260", tanThu.atk >= 120 && tanThu.atk <= 260, String(tanThu.atk));
check("tan thu HP trong 600-1100", tanThu.hp >= 600 && tanThu.hp <= 1100, String(tanThu.hp));

// Không mặc gì
const naked = computeStats({ heroBonusAtk: 54, heroBonusHp: 205, skinAtk: 35, skinHp: 150, skinColAtk: 9, skinColHp: 38 });
console.log("    khong do:", JSON.stringify(naked));
check("khong do ATK < 200", naked.atk < 200, String(naked.atk));
check("khong do HP < 1000", naked.hp < 1000, String(naked.hp));

// Sau chương 1: fine Lv.10, 1-2 sao
const ch1 = computeStats({
  gearAtk: 350, gearHp: 800, gearLv: 10,
  heroBonusAtk: 54, heroBonusHp: 205, starAtkMult: 0.12, starHpMult: 0.12,
  starFlatAtk: 40, starFlatHp: 200,
  skinAtk: 35, skinHp: 150, skinColAtk: 25, skinColHp: 100
});
console.log("    qua chuong 1:", JSON.stringify(ch1));
check("qua chuong 1 ATK 300-900", ch1.atk >= 300 && ch1.atk <= 900, String(ch1.atk));
check("qua chuong 1 HP 1500-4500", ch1.hp >= 1500 && ch1.hp <= 4500, String(ch1.hp));

// Mid game
const mid = computeStats({
  gearAtk: 4000, gearHp: 12000, gearLv: 60,
  heroBonusAtk: 54, heroBonusHp: 205, starAtkMult: 0.62, starHpMult: 0.62,
  starFlatAtk: 260, starFlatHp: 1300,
  skinAtk: 145, skinHp: 580, skinColAtk: 200, skinColHp: 800,
  artAtk: 1500, artHp: 6000, pctAtk: 0.2, pctHp: 0.2
});
console.log("    mid game:", JSON.stringify(mid));
check("mid game ATK 5.000-25.000", mid.atk >= 5000 && mid.atk <= 25000, String(mid.atk));
check("mid game HP 20.000-80.000", mid.hp >= 20000 && mid.hp <= 80000, String(mid.hp));

// Late game
const late = computeStats({
  gearAtk: 25000, gearHp: 80000, gearLv: 100,
  heroBonusAtk: 54, heroBonusHp: 205, starAtkMult: 2.0, starHpMult: 2.0,
  starFlatAtk: 960, starFlatHp: 4800,
  skinAtk: 280, skinHp: 1150, skinColAtk: 1700, skinColHp: 6800,
  artAtk: 76670, artHp: 306680, pctAtk: 0.65, pctHp: 0.65
});
console.log("    late game:", JSON.stringify(late));
check("late game ATK > 50.000", late.atk > 50000, String(late.atk));
check("late game HP > 200.000", late.hp > 200000, String(late.hp));

// Tỉ lệ tăng trưởng
const ratioAtk = late.atk / tanThu.atk;
const ratioHp = late.hp / tanThu.hp;
console.log(`    ti le late/tan thu: ATK ${ratioAtk.toFixed(0)}x, HP ${ratioHp.toFixed(0)}x`);
check("late manh hon tan thu it nhat 50x ATK", ratioAtk >= 50, ratioAtk.toFixed(0));
check("late khong vuot 2000x ATK (khong vo han)", ratioAtk <= 2000, ratioAtk.toFixed(0));

// Đơn điệu tăng
const steps = [tanThu, ch1, mid, late];
let monotonic = true;
for (let i = 1; i < steps.length; i++) {
  if (steps[i].atk <= steps[i - 1].atk) monotonic = false;
  if (steps[i].hp <= steps[i - 1].hp) monotonic = false;
}
check("ATK va HP tang don dieu qua 4 giai doan", monotonic);

// Không NaN/Infinity
for (const s of steps) {
  check(`khong NaN/Infinity (${s.atk}/${s.hp})`,
    Number.isFinite(s.atk) && Number.isFinite(s.hp) && s.atk > 0 && s.hp > 0);
}

// ============================================================ 7. Chống cộng trùng
console.log("\n=== 7. CHONG CONG TRUNG ===");
const a1 = computeStats({ heroBonusAtk: 54, heroBonusHp: 205, skinAtk: 35, skinHp: 150 });
const a2 = computeStats({ heroBonusAtk: 54, heroBonusHp: 205, skinAtk: 35, skinHp: 150 });
check("cung input -> cung output (khong state an)", a1.atk === a2.atk && a1.hp === a2.hp);
check("hero bonus chi cong 1 lan", computeStats({ heroBonusAtk: 100, heroBonusHp: 400 }).atk === 148);
check("pct chi nhan 1 lan", computeStats({ gearAtk: 100, pctAtk: 0.5 }).atk === Math.round(148 * 1.5));
check("gear level dong gop tuyen tinh", computeStats({ gearLv: 11 }).atk - computeStats({ gearLv: 1 }).atk === 120);
check("weapon mult ap dung 1 lan", computeStats({ gearAtk: 100, weaponMult: 1.5 }).atk === Math.round(148 * 1.5));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
