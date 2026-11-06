// Khoá lại: chọn chương, khoá chương theo tiến trình, và chống rò rỉ dữ liệu
// giữa các tài khoản trên cùng trình duyệt.
//
// Chạy: node tests/chapter-select.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const cloud = fs.readFileSync(new URL("../public/cloud.js", import.meta.url), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ============================================================ 1. Dữ liệu chương
console.log("\n=== 1. DU LIEU CHUONG CO DU METADATA UI ===");
const chStart = html.indexOf("const CHAPTERS = [");
const chBlock = html.slice(chStart, html.indexOf("\n      ];", chStart) + 8);
const chapterCount = (chBlock.match(/^\s+id: \d+,/gm) || []).length;
check("co 4 chuong", chapterCount === 4, String(chapterCount));
for (const field of ["icon", "accent", "gradFrom", "difficulty", "difficultyLabel", "themeName", "bossIcon", "bossName", "unlock"]) {
  const n = (chBlock.match(new RegExp(field + ":", "g")) || []).length;
  check(`ca 4 chuong deu co '${field}'`, n === 4, `${n}/4`);
}
check("chuong 1 khong co dieu kien mo khoa", /id: 1[\s\S]{0,900}?unlock: null/.test(chBlock));
check("chuong 2 doi thang chuong 1", /id: 2[\s\S]{0,900}?chapterId: 1/.test(chBlock));
check("chuong 3 doi thang chuong 2", /id: 3[\s\S]{0,900}?chapterId: 2/.test(chBlock));
check("chuong 4 doi thang chuong 3", /id: 4[\s\S]{0,900}?chapterId: 3/.test(chBlock));
check("chuong 4 co boss va map rieng", /id: 4[\s\S]{0,900}?bossName: 'Cổ Long Thiên Không'[\s\S]{0,500}?map-ch4-dragon-realm\.svg/.test(chBlock));

// ============================================================ 2. Luật khoá chương
console.log("\n=== 2. LUAT KHOÁ CHUONG ===");
check("co ham isChapterWon", /function isChapterWon\(chapterId\)/.test(html));
check("co ham isChapterLocked", /function isChapterLocked\(ch\)/.test(html));
check("isChapterWon doc winsByChapter", /winsByChapter \|\| \{\}\)\[chapterId\]/.test(html));
check("isChapterWon suy ra tu bestRooms (khong khoa oan tai khoan cu)",
  /getChapterBest\(chapterId\) >= ch\.rooms/.test(html));
check("co ham getChapterBest kep ky luc ve so phong cua chuong",
  /function getChapterBest\(chapterId\)/.test(html) &&
  /Math\.max\(0, Math\.min\(ch\.rooms, Math\.floor\(raw\)\)\)/.test(html));
check("isChapterWon dung getChapterBest (khong doc bestRooms tho)",
  !/\(SaveState\.bestRooms \|\| \{\}\)\[chapterId\] >= ch\.rooms/.test(html));
check("co ham normalizeSelectedChapter", /function normalizeSelectedChapter\(\)/.test(html));
check("renderLobbyUI goi normalizeSelectedChapter", /function renderLobbyUI\(\)[\s\S]{0,300}?normalizeSelectedChapter\(\)/.test(html));
const snrStart = html.indexOf("function startNewRun(reason = 'fresh')");
const snrBlock = html.slice(snrStart, snrStart + 1600);
check("startNewRun chan chuong khoa", /isChapterLocked\(ch\)/.test(snrBlock));
check("startNewRun tra false khi bi chan", /isChapterLocked\(ch\)[\s\S]{0,200}?return false;/.test(snrBlock));

// ============================================================ 3. UI chọn chương
console.log("\n=== 3. UI CHON CHUONG ===");
check("co the chua chapterSelectStrip", html.includes('id="chapterSelectStrip"'));
check("co ham renderChapterSelectStrip", /function renderChapterSelectStrip\(\)/.test(html));
check("renderLobbyUI goi renderChapterSelectStrip", /safeRender\('chapterStrip'/.test(html));
check("the chuong co data-chapter-card", /data-chapter-card="\$\{idx\}"/.test(html));
check("the chuong hien so phong", /\$\{ch\.rooms\} phòng/.test(html));
check("the chuong hien ky luc tot nhat", /Tốt nhất \$\{best\}\/\$\{ch\.rooms\}/.test(html));
check("the chuong hien ten trum", /\$\{ch\.bossIcon\} \$\{ch\.bossName\}/.test(html));
check("the chuong hien thanh do kho 3 bac", /\[1, 2, 3\]\.map\(n =>/.test(html));
check("the chuong co lop khoa khi chua mo", /const lockOverlay = locked/.test(html));
check("bam the khoa thi bao, khong doi chuong",
  /if \(isChapterLocked\(ch\)\) \{[\s\S]{0,200}?return;/.test(html));

console.log("\n=== 4. CHUYEN CHUONG TON TRONG LUAT KHOA ===");
// Nút ◀ ▶ đã bỏ khỏi UI (thay bằng 3 tab chương trong mapSelectPanel).
// Logic chuyển chương giữ lại ở hàm switchChapter(dir) và vẫn phải tôn trọng khoá.
check("switchChapter chan chuong khoa",
  /function switchChapter\(dir\)[\s\S]{0,1400}?isChapterLocked\(CHAPTERS\[next\]\)/.test(html));
check("switchChapter bo qua chuong khoa khi lui",
  /function switchChapter\(dir\)[\s\S]{0,900}?if \(!isChapterLocked\(CHAPTERS\[idx\]\)\) break;/.test(html));
check("khong con nut ◀ ▶ trong DOM",
  !/id="btnPrevChapter"/.test(html) && !/id="btnNextChapter"/.test(html));
check("tab chuong khoa khong doi selectedChapterIdx",
  /if \(isChapterLocked\(target\)\) \{[\s\S]{0,300}?return;/.test(html));

// ============================================================ 5. Rò rỉ dữ liệu
console.log("\n=== 5. CHONG RO RI DU LIEU GIUA TAI KHOAN ===");
// Đây là lỗi nghiêm trọng: SaveState.load() cũ chỉ chạy khi có save trong
// localStorage. Khi trống (tài khoản mới / vừa đăng xuất) nó KHÔNG làm gì,
// giữ nguyên dữ liệu của tài khoản trước -> tài khoản mới thừa hưởng wins,
// bestRooms, trang bị của người khác.
const loadBlock = html.slice(html.indexOf("        load() {"), html.indexOf("        save()"));
check("SaveState.load() xu ly truong hop localStorage TRONG",
  /if \(!raw\) \{/.test(loadBlock));
check("khi trong thi dua ve trang thai mac dinh",
  /SAVE_STATE_DEFAULTS/.test(loadBlock));
check("co hang so SAVE_STATE_DEFAULTS", /const SAVE_STATE_DEFAULTS = JSON\.parse\(JSON\.stringify\(/.test(html));
check("SAVE_STATE_DEFAULTS chi chua du lieu, khong chua ham",
  /Object\.entries\(SaveState\)\.filter\(\(\[, v\]\) => typeof v !== 'function'\)/.test(html));
check("SaveState.load() return som khi khong co save",
  /if \(!raw\) \{[\s\S]{0,320}?return;/.test(loadBlock));

// cloud.js: tài khoản mới KHÔNG được giữ save cũ (kiến trúc buffer).
check("cloud.js don save cu bang purgeLegacyLocalSave",
  /function purgeLegacyLocalSave\(\)[\s\S]{0,420}?localStorage\.removeItem\(SAVE_KEY\)/.test(cloud));
check("loadCloudSave goi purge truoc khi nap",
  /function loadCloudSave\(\)[\s\S]{0,120}?purgeLegacyLocalSave\(\)/.test(cloud));
check("tai khoan moi -> buffer = null (ve tan thu)",
  /Tai khoan moi: buffer = null[\s\S]{0,160}?__ARTEMIS_SAVE_BUFFER = null/.test(cloud));
check("cloud.js xoa save khi dang xuat",
  /logout[\s\S]{0,600}?purgeLegacyLocalSave\(\)/i.test(cloud));
check("cloud.js KHONG dung localStorage lam nguon doc",
  !/localStorage\.getItem/.test(cloud));
check("cloud.js khong hook Storage.prototype",
  !/Storage\.prototype\.setItem\s*=/.test(cloud));

// ============================================================ 6. Đường cong độ khó
console.log("\n=== 6. DUONG CONG DO KHO KHO DAN ===");
const setupStart = html.indexOf("function setupRoom(roomNum)");
const setupBlock = html.slice(setupStart, html.indexOf("function updateInGameHUD", setupStart) + 40);
check("quai: do sau tang theo phong", /const depth = Math\.min\(1, \(roomNum - 1\)/.test(setupBlock));
check("quai: HP tang theo do sau (1.4 -> 2.4 don)", /const baseHits = 1\.4 \+ depth \* 1\.0/.test(setupBlock));
check("quai: so don chiu duoc GIAM khi cang sau", /16 - depth \* 10/.test(setupBlock));
check("boss: so don giet tang dan (24/30/40)", /hitsToKill = roomNum === 5 \? 24 : \(roomNum === 10 \? 30 : 40\)/.test(setupBlock));
check("boss: so don chiu duoc GIAM dan (9/7/5)", /roomNum === 5 \? 9 : \(roomNum === 10 \? 7 : 5\)/.test(setupBlock));
check("boss HP KHONG nhan them roomMul (tung gay tran 53s)",
  !/playerAtk \* \d+ \* scale \* \(bossType/.test(setupBlock));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
