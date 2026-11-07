// Test kiem tra kinh te phia server: chan tu cap vang/da quy qua /api/save.
// Chay: node tests/economy.test.mjs
import fs from "node:fs";

const economySrc = fs.readFileSync(new URL("../lib/economy.js", import.meta.url), "utf8");
const saveSrc = fs.readFileSync(new URL("../api/save.js", import.meta.url), "utf8");
const {
  validateEconomyDelta,
  MAX_GOLD_GAIN_PER_REVISION,
  MAX_GEMS_GAIN_PER_REVISION,
  HARD_CAP_GOLD,
} = await import(new URL("../lib/economy.js", import.meta.url));

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ---------------------------------------------------------------- 1. Nối vào API
console.log("\n=== 1. DA NOI VAO /api/save ===");
// Import có thể kèm nhiều tên (validateSeasonDelta...) — kiểm tra THÀNH PHẦN,
// không so khớp nguyên chuỗi.
check("api/save.js import validateEconomyDelta",
  /import \{[^}]*\bvalidateEconomyDelta\b[^}]*\} from "\.\.\/lib\/economy\.js"/.test(saveSrc));
check("goi validateEconomyDelta truoc khi ghi", /validateEconomyDelta\(existing\?\.data \|\| null, check\.data, 1\)/.test(saveSrc));
check("tra 422 kem code khi bi chan", saveSrc.includes("code: economy.code"));
check("tra serverData de client khong ghi de", saveSrc.includes("serverData: save?.data || null"));
check("projection lay data de so sanh", saveSrc.includes('"data.gold": 1'));
check("chan xay ra TRUOC updateOne", saveSrc.indexOf("validateEconomyDelta") < saveSrc.indexOf("await saves.updateOne"));

// ---------------------------------------------------------------- 2. Người chơi hợp lệ
console.log("\n=== 2. NGUOI CHOI HOP LE VAN QUA ===");
const base = { gold: 500, gems: 50, lifetimeStats: { goldEarned: 0 } };
check("tang vang trong nguong -> ok",
  validateEconomyDelta(base, { ...base, gold: 1500 }).ok === true);
check("tang dung bang nguong -> ok",
  validateEconomyDelta(base, { ...base, gold: 500 + MAX_GOLD_GAIN_PER_REVISION }).ok === true);
check("tang nguong + 1 -> bi chan",
  validateEconomyDelta(base, { ...base, gold: 500 + MAX_GOLD_GAIN_PER_REVISION + 1 }).ok === false);

// Tiêu vàng phải luôn hợp lệ
check("giam vang (tieu) -> ok", validateEconomyDelta({ ...base, gold: 100000 }, { ...base, gold: 5 }).ok === true);
check("giam manh ve 0 -> ok", validateEconomyDelta({ ...base, gold: 9999999 }, { ...base, gold: 0 }).ok === true);

// Trận thắng chương 1: ~1050*(1+phòng) vàng. Vài chục trận liên tiếp vẫn phải qua.
let g = 500;
for (let i = 0; i < 50; i++) g += 1500;
check("50 tran lien tiep (moi tran +1500) -> ok",
  validateEconomyDelta({ gold: 500, gems: 50, lifetimeStats: {} }, { gold: g, gems: 50, lifetimeStats: {} }).ok === true);

// Merge trang bị hoàn tới ~230.000 vàng
check("hoan tien merge 230.000 vang -> ok",
  validateEconomyDelta({ gold: 1000, gems: 0, lifetimeStats: {} }, { gold: 231000, gems: 0, lifetimeStats: {} }).ok === true);

// ---------------------------------------------------------------- 3. Tấn công
console.log("\n=== 3. TAN CONG BI CHAN ===");
const atk1 = validateEconomyDelta(base, { ...base, gold: 9999999 });
check("+9.999.999 vang mot request -> chan", atk1.ok === false);
check("code = ECONOMY_GOLD_JUMP", atk1.code === "ECONOMY_GOLD_JUMP");
check("co detail de client hieu", !!atk1.detail && typeof atk1.detail.gain === "number");

const atk2 = validateEconomyDelta(base, { ...base, gems: 999999 });
check("+999.999 da quy mot request -> chan", atk2.ok === false);
check("code = ECONOMY_GEMS_JUMP", atk2.code === "ECONOMY_GEMS_JUMP");

const atk3 = validateEconomyDelta(base, { ...base, gold: 1e11 });
check("+100 ty vang -> chan", atk3.ok === false);

// Khai khống goldEarned để hợp thức hoá
const atk4 = validateEconomyDelta(base, {
  ...base, gold: 500, lifetimeStats: { goldEarned: 999999999 },
});
check("khai khong goldEarned -> chan", atk4.ok === false);
check("code = ECONOMY_FAKE_EARNED", atk4.code === "ECONOMY_FAKE_EARNED");

// ---------------------------------------------------------------- 4. Không phá dữ liệu cũ
console.log("\n=== 4. KHONG PHA DU LIEU NGUOI CHOI CU ===");
// Người chơi đã có 9.999.999 vàng từ trước (di sản lỗi cũ) phải GIỮ nguyên.
const legacy = { gold: 9999999, gems: 999999, lifetimeStats: { goldEarned: 0 } };
check("giu nguyen 9.999.999 vang (khong bi cat)", validateEconomyDelta(legacy, { ...legacy }).ok === true);
check("tieu bot tu 9.999.999 -> ok", validateEconomyDelta(legacy, { ...legacy, gold: 5000000 }).ok === true);

// Người chơi thật: puugoo 10.357.405 vàng, goldEarned 352.156
const puugoo = { gold: 10357405, gems: 1039959, lifetimeStats: { goldEarned: 352156 } };
check("puugoo 10.357.405 vang van qua", validateEconomyDelta(puugoo, { ...puugoo }).ok === true);
check("puugoo kiem them 1 tran -> ok",
  validateEconomyDelta(puugoo, { ...puugoo, gold: puugoo.gold + 1500 }).ok === true);

// Lần lưu ĐẦU TIÊN (không có prevData) không được chặn nhầm
check("lan luu dau (prevData null) voi gold hop le -> ok",
  validateEconomyDelta(null, { gold: 500, gems: 50 }).ok === true);
check("lan luu dau voi gold vuot tran cung -> chan",
  validateEconomyDelta(null, { gold: HARD_CAP_GOLD + 1 }).ok === false);
check("prevData khong phai object -> coi nhu lan dau",
  validateEconomyDelta("rác", { gold: 500 }).ok === true);

// ---------------------------------------------------------------- 5. Không chặn nhầm
console.log("\n=== 5. KHONG CHAN NHAM ===");
check("NaN gold -> coi la 0, khong crash", (() => {
  try { return validateEconomyDelta(base, { ...base, gold: NaN }).ok === true; } catch (e) { return false; }
})());
check("undefined gems -> coi la 0", (() => {
  try { return validateEconomyDelta(base, { gold: 600 }).ok === true; } catch (e) { return false; }
})());
check("lifetimeStats thieu -> khong crash", (() => {
  try { return validateEconomyDelta({ gold: 500 }, { gold: 600 }).ok === true; } catch (e) { return false; }
})());
check("revisionDelta 0 -> van cho 1 buoc", validateEconomyDelta(base, { ...base, gold: 500 + MAX_GOLD_GAIN_PER_REVISION }, 0).ok === true);
check("revisionDelta 3 -> cho 3 buoc",
  validateEconomyDelta(base, { ...base, gold: 500 + MAX_GOLD_GAIN_PER_REVISION * 3 }, 3).ok === true);

// ---------------------------------------------------------------- 6. Nguồn gốc ngưỡng
console.log("\n=== 6. NGUONG CO CAN CU ===");
check("nguong vang 500.000", MAX_GOLD_GAIN_PER_REVISION === 500000);
check("nguong da quy 20.000", MAX_GEMS_GAIN_PER_REVISION === 20000);
check("co ghi chu giai thich nguong trong source",
  economySrc.includes("computeTotalUpgradeGoldSpent") || economySrc.includes("350*3"));
check("tran cung 1e12 chi de chan tran so", economySrc.includes("HARD_CAP_GOLD = 1e12"));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
