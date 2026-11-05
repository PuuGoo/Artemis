// Test an toan cua cong cu don tai khoan test.
// Chay: node tests/purge-safety.test.mjs
//
// Test nay KHONG ket noi DB. No kiem tra logic phan loai va cac chan an toan
// trong source, de chac chan khong bao gio xoa tai khoan that.
import fs from "node:fs";

const purgeSrc = fs.readFileSync(new URL("../tools/purge-test-accounts.mjs", import.meta.url), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ---------------------------------------------------------------- 1. Chốt an toàn
console.log("\n=== 1. CHOT AN TOAN ===");
check("co danh sach REAL_ACCOUNTS cung", purgeSrc.includes("const REAL_ACCOUNTS = new Set("));
check("REAL_ACCOUNTS chua puugoo", /REAL_ACCOUNTS = new Set\(\[[^\]]*"puugoo"/.test(purgeSrc));
check("REAL_ACCOUNTS chua web492972", purgeSrc.includes('"web492972"'));
check("REAL_ACCOUNTS chua puugoo1", purgeSrc.includes('"puugoo1"'));
check("kiem tra REAL truoc khi khop pattern",
  purgeSrc.indexOf("REAL_ACCOUNTS.has(n.toLowerCase())") < purgeSrc.indexOf("TEST_PATTERNS.some"));
check("co ABORT neu tai khoan THAT bi coi la test",
  purgeSrc.includes("ABORT:") && purgeSrc.includes("nam trong danh sach THAT"));
check("ABORT thoat voi exit code 1",
  /console\.error\(`ABORT:[\s\S]{0,200}?process\.exit\(1\)/.test(purgeSrc));

// ---------------------------------------------------------------- 2. Dry-run mặc định
console.log("\n=== 2. MAC DINH CHI XEM ===");
check("co co APPLY tu --apply", purgeSrc.includes('process.argv.includes("--apply")'));
check("mac dinh APPLY = false", /const APPLY = process\.argv\.includes\("--apply"\);/.test(purgeSrc));
check("thoat som khi khong co --apply", /if \(!APPLY\) \{[\s\S]{0,300}?process\.exit\(0\)/.test(purgeSrc));
check("in ro che do", purgeSrc.includes("CHI XEM (dry-run)"));
check("in ro che do xoa that", purgeSrc.includes("XOA THAT (--apply)"));

// ---------------------------------------------------------------- 3. Backup
console.log("\n=== 3. BACKUP TRUOC KHI XOA ===");
check("co tao thu muc backups", purgeSrc.includes('new URL("../backups/", import.meta.url)'));
check("backup ghi ca players lan saves",
  purgeSrc.includes("players: targets") && purgeSrc.includes("saves: targets.map"));
check("backup phai truoc deleteMany",
  purgeSrc.indexOf("fs.writeFileSync(backupPath") < purgeSrc.indexOf('deleteMany({ _id:'));
check("ABORT neu file backup qua nho",
  /size < 100[\s\S]{0,120}?process\.exit\(1\)/.test(purgeSrc));
check("co ten file kem timestamp", purgeSrc.includes("purge-test-accounts-${stamp}.json"));

// ---------------------------------------------------------------- 4. Phạm vi xoá
console.log("\n=== 4. PHAM VI XOA HEP ===");
check("chi xoa players theo _id", purgeSrc.includes('db.collection("players").deleteMany({ _id: { $in:'));
check("chi xoa saves theo playerId", purgeSrc.includes('db.collection("saves").deleteMany({ playerId: { $in:'));
check("chi xoa login_attempts theo username", purgeSrc.includes('db.collection("login_attempts").deleteMany'));
check("KHONG xoa collection khac (khong co dropDatabase)", !purgeSrc.includes("dropDatabase"));
check("KHONG co .drop() tren collection", !/\.drop\(\)/.test(purgeSrc));

// ---------------------------------------------------------------- 5. Logic phân loại
console.log("\n=== 5. LOGIC PHAN LOAI (chay that) ===");
// Trich xuat va chay lai logic phan loai tu source de kiem chung hanh vi that
const patternsBlock = purgeSrc.slice(
  purgeSrc.indexOf("const TEST_PATTERNS = ["),
  purgeSrc.indexOf("];", purgeSrc.indexOf("const TEST_PATTERNS = [")) + 2,
);
const realBlock = purgeSrc.slice(
  purgeSrc.indexOf("const REAL_ACCOUNTS = new Set("),
  purgeSrc.indexOf(");", purgeSrc.indexOf("const REAL_ACCOUNTS = new Set(")) + 2,
);
const fnBlock = purgeSrc.slice(
  purgeSrc.indexOf("function isTestAccount(name)"),
  purgeSrc.indexOf("\n}", purgeSrc.indexOf("function isTestAccount(name)")) + 2,
);
// eslint-disable-next-line no-new-func
const isTest = new Function(`${realBlock}\n${patternsBlock}\n${fnBlock}\nreturn isTestAccount;`)();

check("puugoo KHONG bi coi la test", isTest("puugoo") === false);
check("web492972 KHONG bi coi la test", isTest("web492972") === false);
check("puugoo1 KHONG bi coi la test", isTest("puugoo1") === false);
check("vi pham: PUUGOO viet hoa van duoc giu", isTest("PUUGOO") === false);
check("test_ab12cd la test", isTest("test_ab12cd") === true);
check("adm_xyz la test", isTest("adm_xyz") === true);
check("e2e213818 la test", isTest("e2e213818") === true);
check("u841537 la test", isTest("u841537") === true);
check("eco_n5q0f1k la test", isTest("eco_n5q0f1k") === true);
check("v2808075 la test", isTest("v2808075") === true);
check("newbie806465 la test", isTest("newbie806465") === true);
check("ten thuong 'alice' KHONG bi xoa", isTest("alice") === false);
check("ten thuong 'minh' KHONG bi xoa", isTest("minh") === false);
check("ten thuong 'player_one' KHONG bi xoa", isTest("player_one") === false);
check("chuoi rong KHONG bi xoa", isTest("") === false);
check("null KHONG bi xoa", isTest(null) === false);

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
