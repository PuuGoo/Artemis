// Khoá lại màn hình chinh phục chương (victory panel) và luồng mở khoá chương.
//
// Chạy: node tests/chapter-victory.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

function fnBody(name, len = 3200) {
  const i = html.indexOf("function " + name);
  if (i < 0) return "";
  // Cắt theo CÂN BẰNG NGOẶC, không theo độ dài cố định: hàm dài ra sau mỗi
  // lần thêm tính năng nên offset cố định sẽ cụt giữa chừng và test báo
  // FAIL sai trong khi code vẫn đúng.
  let d = 0, j = html.indexOf('{', i), e = -1;
  for (let k = j; k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return e > 0 ? html.slice(i, e + 1) : html.slice(i, i + len);
}

// ============================================================ 1. Modal + hàm
console.log("\n=== 1. MODAL CHINH PHUC CHUONG ===");
check("co chapterVictoryModal", html.includes('id="chapterVictoryModal"'));
check("co chapterVictoryCard", html.includes('id="chapterVictoryCard"'));
check("co ham openChapterVictory", /function openChapterVictory\(ch, next, stats\)/.test(html));
check("modal co z-45 (tren summary z-40)", /id="chapterVictoryModal"[^>]*z-45/.test(html));

// ============================================================ 2. Nội dung panel
console.log("\n=== 2. NOI DUNG PANEL ===");
const cv = fnBody("openChapterVictory", 3600);
check("hien cup 🏆", cv.includes("cv-trophy") && cv.includes("🏆"));
check("hien 'CHIEN THANG'", cv.includes("CHIẾN THẮNG"));
check("hien ten chuong", cv.includes("cv-subtitle"));
check("thong ke 4 o: phong / ha guc / vang / da quy",
  cv.includes("PHÒNG") && cv.includes("HẠ GỤC") && cv.includes("VÀNG") && cv.includes("ĐÁ QUÝ"));
check("co khoi MO KHOÁ CHUONG MOI", cv.includes("MỞ KHOÁ CHƯƠNG MỚI"));
check("hien ten chuong moi + do kho + trum", cv.includes("cv-unlock-name") && cv.includes("cv-unlock-diff"));
check("truong hop het chuong: 'TAT CA CHUONG DA CHINH PHUC'", cv.includes("TẤT CẢ CHƯƠNG ĐÃ CHINH PHỤC"));
check("nut 'Ve Sanh'", cv.includes("btnCvLobby") && cv.includes("Về Sảnh"));
check("nut 'Chuong Tiep' khi con chuong", cv.includes("btnCvNext") && cv.includes("Chương Tiếp"));
check("nut 'Choi Lai' khi het chuong", cv.includes("🔄 Chơi Lại"));
check("mau nut theo chuong moi", /background:linear-gradient\(135deg,\$\{next\.accent\},\$\{next\.accent2\}\)/.test(cv));

// ============================================================ 3. Hành vi nút
console.log("\n=== 3. HANH VI NUT ===");
check("btnCvLobby goi returnToLobby", /btnCvLobby[\s\S]{0,320}?returnToLobby\(\)/.test(cv));
check("btnCvLobby dong ca 2 modal",
  /btnCvLobby[\s\S]{0,200}?chapterVictoryModal'\)\.classList\.add\('hidden'\)/.test(cv) ||
  /btnCvLobby[\s\S]{0,260}?summaryModal'\)\.classList\.add\('hidden'\)/.test(cv));
check("btnCvNext chuyen selectedChapterIdx sang chuong moi",
  /btnCvNext[\s\S]{0,420}?SaveState\.selectedChapterIdx = CHAPTERS\.findIndex/.test(cv));
check("btnCvNext goi startNewRun('fresh')", /btnCvNext[\s\S]{0,520}?startNewRun\('fresh'\)/.test(cv));

// ============================================================ 4. Nối vào finishRun
console.log("\n=== 4. NOI VAO finishRun ===");
const fr = fnBody("finishRun", 4200);
check("finishRun goi openChapterVictory khi thang chien dich",
  /if \(isVictory\) \{[\s\S]*?if \(winMode\.hasChapters\) \{[\s\S]*?openChapterVictory\(/.test(fr));
check("tinh dung chuong tiep theo", /const nextCh = CHAPTERS\[curIdx \+ 1\] \|\| null/.test(fr));
check("chi bao mo khoa khi chuong that su mo", /const unlockedNext = nextCh && !isChapterLocked\(nextCh\)/.test(fr));
check("truyen du stats (rooms/kills/gold/gems)",
  /rooms: Game\.maxRooms[\s\S]{0,120}?kills: Game\.kills[\s\S]{0,120}?gold: Game\.runGold/.test(fr));
check("return som de khong hien summary thuong", /openChapterVictory\([\s\S]{0,320}?return;/.test(fr));
check("thua hien man hinh that bai rieng (khong phai summary thuong)",
  /openRunDefeat\(\{[\s\S]{0,700}?room: Game\.room/.test(fr));
check("man hinh that bai nhan duoc nguyen nhan + sat thuong cuoi",
  /source: Game\.lastDamageSource[\s\S]{0,200}?lastHit: Game\.lastDamageAmount/.test(fr));
check("summary thuong khong con dung cho nhanh thua", !/showSummaryModal\(\s*isVictory \?/.test(fr));

// ============================================================ 5. returnToLobby
console.log("\n=== 5. returnToLobby (mot cho duy nhat) ===");
const rl = fnBody("returnToLobby", 1400);
check("co ham returnToLobby", rl.length > 100);
check("don Game.running = false", /Game\.running = false/.test(rl));
check("dong summaryModal", /summaryModal'\)\.classList\.add\('hidden'\)/.test(rl));
check("dong chapterVictoryModal", /chapterVictoryModal'\)[\s\S]{0,60}?classList\.add\('hidden'\)/.test(rl));
check("hien tabBattle + bottomNavBar", /tabBattle'\)\.classList\.remove\('hidden'\)/.test(rl) &&
  /bottomNavBar'\)\.classList\.remove\('hidden'\)/.test(rl));
check("renderLobbyUI sau khi ve", /renderLobbyUI\(\)/.test(rl));
check("btnReturnLobby dung returnToLobby sau xac nhan roi tran",
  /btnReturnLobby'\)\.addEventListener\('click', \(\) => \{[\s\S]{0,320}?returnToLobby\(\);/.test(html));

// ============================================================ 6. CSS
console.log("\n=== 6. CSS ===");
for (const cls of [".cv-hero", ".cv-rays", ".cv-trophy", ".cv-title", ".cv-stats", ".cv-stat",
                   ".cv-unlock", ".cv-unlock-row", ".cv-unlock-name", ".cv-actions", ".cv-btn",
                   ".cv-btn-ghost", ".cv-btn-primary"]) {
  check(`co CSS ${cls}`, html.includes(cls + " {") || html.includes(cls + ".") || html.includes(cls + ","));
}
check("co hieu ung tia sang quay (cvRays)", /@keyframes cvRays/.test(html));
check("co hieu ung cup nay vao (cvTrophy)", /@keyframes cvTrophy/.test(html));
check("co hieu ung khoi mo khoa truot vao (cvUnlockRow)", /@keyframes cvUnlockRow/.test(html));
check("co responsive <= 520px cho panel", /@media \(max-width: 520px\) \{\s*\n?\s*\.cv-trophy/.test(html));

// ============================================================ 7. API debug
console.log("\n=== 7. API DEBUG ===");
for (const fn of ["openChapterVictory", "finishRun", "returnToLobby", "getChapterBest"]) {
  check(`export ${fn}`, new RegExp("^\\s+" + fn + ",", "m").test(html));
}

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
