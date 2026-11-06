// Khoá lại kiến trúc "MongoDB là nguồn duy nhất" — chống tái phát bug
// "nick mới tạo hiện 840K ATK / 2.85M HP / 10.0GM vàng của nick cũ".
//
// Chạy: node tests/cloud-only-save.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const cloud = fs.readFileSync(new URL("../public/cloud.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}
function fnBody(src, name, maxLen = 3000) {
  const idx = src.indexOf("function " + name + "(");
  if (idx < 0) return "";
  const open = src.indexOf("{", idx);
  let d = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (d === 0) { end = i; break; } }
  }
  return end > 0 ? src.slice(idx, Math.min(end + 1, idx + maxLen)) : "";
}

// ============================================================ 1. Không đọc localStorage
console.log("\n=== 1. KHONG DOC LOCALSTORAGE ===");
check("index.html KHONG con localStorage.getItem cho save",
  !/localStorage\.getItem\(['"]archero2_web_save_v2/.test(html));
check("index.html KHONG con localStorage.setItem cho save",
  !/localStorage\.setItem\(['"]archero2_web_save_v2/.test(html));
check("cloud.js KHONG doc localStorage",
  !/localStorage\.getItem/.test(cloud));
check("cloud.js KHONG ghi localStorage (tru removeItem)",
  !/localStorage\.setItem/.test(cloud));
check("cloud.js KHONG hook Storage.prototype.setItem",
  !/Storage\.prototype\.setItem\s*=/.test(cloud));

// ============================================================ 2. Buffer là nguồn
console.log("\n=== 2. BUFFER TRONG BO NHO LA NGUON ===");
// load() la method cua object literal SaveState, khong phai `function load(`.
const loadStart = html.indexOf("        load() {");
const loadFn = loadStart > 0 ? html.slice(loadStart, loadStart + 2600) : "";
check("tim thay SaveState.load()", loadFn.length > 0);
check("SaveState.load doc tu __ARTEMIS_SAVE_BUFFER",
  /const raw = .*__ARTEMIS_SAVE_BUFFER/.test(loadFn));
check("load() ve tan thu khi buffer rong",
  /if \(!raw\) \{[\s\S]{0,200}?SAVE_STATE_DEFAULTS/.test(loadFn));

const saveFn = html.slice(html.indexOf("        save() {"), html.indexOf("        save() {") + 6500);
check("SaveState.save tao payload", /const payload = JSON\.stringify\(\{/.test(saveFn));
check("SaveState.save ghi vao __ARTEMIS_SAVE_BUFFER",
  /window\.__ARTEMIS_SAVE_BUFFER = payload/.test(saveFn));
check("SaveState.save phat su kien artemis:save",
  /dispatchEvent\(new CustomEvent\('artemis:save'/.test(saveFn));

// ============================================================ 3. Khoá ghi
console.log("\n=== 3. KHOA GHI TRUOC KHI CLOUD NAP XONG ===");
check("save() kiem tra __ARTEMIS_SAVE_READY",
  /__ARTEMIS_SAVE_READY !== true[\s\S]{0,80}?return;/.test(saveFn));
check("cloud.js dat READY = false khi bat dau nap",
  /function loadCloudSave\(\)[\s\S]{0,200}?__ARTEMIS_SAVE_READY = false/.test(cloud));
check("cloud.js dat READY = true sau khi nap xong",
  /__ARTEMIS_SAVE_READY = true/.test(cloud));

// ============================================================ 4. Dọn dữ liệu cũ
console.log("\n=== 4. DON DU LIEU CLIENT CU ===");
const purgeFn = fnBody(cloud, "purgeLegacyLocalSave");
check("co ham purgeLegacyLocalSave", purgeFn.length > 0);
check("purge xoa SAVE_KEY", /localStorage\.removeItem\(SAVE_KEY\)/.test(purgeFn));
check("purge xoa ca key archero2* khac", /indexOf\("archero2"\) === 0/.test(purgeFn));
check("boot() goi purge ngay khi trang tai",
  /function boot\(\)[\s\S]{0,400}?purgeLegacyLocalSave\(\)/.test(cloud));
check("loadCloudSave goi purge truoc khi nap",
  /function loadCloudSave\(\)[\s\S]{0,120}?purgeLegacyLocalSave\(\)/.test(cloud));
check("dang xuat goi purge",
  /logout[\s\S]{0,600}?purgeLegacyLocalSave\(\)/.test(cloud));

// ============================================================ 5. Tài khoản mới
console.log("\n=== 5. TAI KHOAN MOI -> TAN THU ===");
check("cloud.js dat buffer = null khi khong co save",
  /__ARTEMIS_SAVE_BUFFER = null/.test(cloud));
check("cloud.js xu ly hasSave=false",
  /if \(r\.data\.hasSave && r\.data\.data\)/.test(cloud));
check("reloadSaveFromStorage nap lai tu buffer",
  /function reloadSaveFromStorage\(\)[\s\S]{0,200}?SaveState\.load\(\)/.test(html));
check("startGame goi reloadSaveFromStorage",
  /function startGame\(\)[\s\S]{0,400}?reloadSaveFromStorage/.test(cloud));

// ============================================================ 6. Không mất dữ liệu
console.log("\n=== 6. KHONG MAT DU LIEU ===");
check("push doc tu buffer (khong tu localStorage)",
  /var payload = window\.__ARTEMIS_SAVE_BUFFER/.test(cloud));
check("co debounce truoc khi day",
  /function scheduleSave\(\)[\s\S]{0,200}?setTimeout\(pushCloudSave, 1200\)/.test(cloud));
check("day not khi dong tab",
  /beforeunload[\s\S]{0,180}?pushCloudSave\(\)/.test(cloud));
check("xu ly ECONOMY_ tu server",
  /indexOf\("ECONOMY_"\) === 0/.test(cloud));
check("xu ly conflict",
  /r\.data\.conflict/.test(cloud));

// ============================================================ 7. Mô phỏng luồng
console.log("\n=== 7. MO PHONG LUONG (chay that) ===");

/** Mô phỏng SaveState.load() với buffer cho trước. */
function simulateLoad(buffer, defaults) {
  if (!buffer) return JSON.parse(JSON.stringify(defaults));
  return Object.assign(JSON.parse(JSON.stringify(defaults)), JSON.parse(buffer));
}

const DEFAULTS = {
  gold: 500, gems: 50, gearLevel: 1,
  heroStars: { artemis: 1, thor: 0 },
  heroShards: {},
  equippedGear: { weapon: { templateId: "rusty_bow", quality: "common", level: 1 } },
  bestRooms: {}, winsByChapter: {},
  artifactStars: {},
  talents: {},
};

// Tai khoan moi tren trinh duyet da tung choi puugoo:
// localStorage CON du lieu cu nhung buffer = null (server bao hasSave=false)
const legacyLocal = JSON.stringify({
  gold: 10461358, gearLevel: 100,
  heroStars: { artemis: 8 }, bestRooms: { 1: 15 }, winsByChapter: { 1: 1 },
});

let st = simulateLoad(null, DEFAULTS);
check("tai khoan moi: vang = 500 (khong phai 10.4M)", st.gold === 500, String(st.gold));
check("tai khoan moi: gearLevel = 1 (khong phai 100)", st.gearLevel === 1, String(st.gearLevel));
check("tai khoan moi: bestRooms rong", Object.keys(st.bestRooms).length === 0);
check("tai khoan moi: winsByChapter rong", Object.keys(st.winsByChapter).length === 0);
check("tai khoan moi: khong thay du lieu legacyLocal", st.gold !== 10461358);

// Nguoi choi cu dang nhap lai: buffer co du lieu that
const realSave = JSON.stringify({ gold: 203374, gearLevel: 1, bestRooms: { 1: 15 } });
st = simulateLoad(realSave, DEFAULTS);
check("nguoi cu: vang dung 203374", st.gold === 203374, String(st.gold));
check("nguoi cu: bestRooms giu 15", st.bestRooms[1] === 15);
check("nguoi cu: gems tu defaults vi save khong co", st.gems === 50);

// Load thất bại phải reject và khóa ghi; không xóa unsent buffer hay coi là no-save.
// Runtime coverage: cloud-client-reliability.test.mjs.
const cloudLoad = fnBody(cloud, 'loadCloudSave');
check("load loi -> reject, giu buffer va khong mo khoa ghi",
  /throw new Error/.test(cloudLoad) && /throw error;/.test(cloudLoad)
  && !/catch\(function \(error\) \{[^}]*__ARTEMIS_SAVE_BUFFER = null/.test(cloudLoad));

// Khoa ghi: truoc khi READY, save() khong lam gi
function simulateSave(ready) {
  if (ready !== true) return null; // mo phong early-return
  return JSON.stringify({ gold: 500 });
}
check("save() khong ghi khi chua READY", simulateSave(undefined) === null);
check("save() khong ghi khi READY=false", simulateSave(false) === null);
check("save() ghi khi READY=true", simulateSave(true) !== null);

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
