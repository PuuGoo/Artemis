// Khoá lại UI/UX chiến đấu: thẻ chọn chương, briefing trước trận, boss intro,
// thanh máu người chơi.
//
// Chạy: node tests/battle-ui.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const arenaCss = fs.readFileSync(new URL("../public/arena-viewport.css", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ============================================================ 1. Briefing
console.log("\n=== 1. BRIEFING TRUOC TRAN ===");
check("co modal runBriefingModal", html.includes('id="runBriefingModal"'));
check("co vung noi dung runBriefingCard", html.includes('id="runBriefingCard"'));
check("co ham openRunBriefing", /function openRunBriefing\(\)/.test(html));
check("btnStartGame mo briefing (khong vao tran ngay)",
  /btnStartGame'\)\.addEventListener\('click', \(\) => \{\s*openRunBriefing\(\);/.test(html));
check("briefing co nut Xuat Chinh goi startNewRun",
  /btnBriefingStart[\s\S]{0,200}?startNewRun\('fresh'\)/.test(html));
check("briefing co nut Quay Lai dong modal",
  /function closeRunBriefing\(\)[\s\S]{0,200}?classList\.add\('hidden'\)/.test(html));
check("briefing hien luc chien", /LỰC CHIẾN/.test(html));
check("briefing hien ky luc", /KỶ LỤC/.test(html));
check("briefing hien so lan thang", /SỐ LẦN THẮNG/.test(html));
check("briefing hien trum cuoi", /TRÙM CUỐI/.test(html));
check("briefing noi ro luot moi tu phong 1", /Lượt mới từ phòng 1\. Tiến trình kỷ lục không phải điểm lưu/.test(html));
check("khong danh gia manh yeu bang moc power hardcode", !/const expectedPower = \[200000, 420000, 800000\]/.test(html));

// ============================================================ 2. Boss intro
console.log("\n=== 2. BOSS INTRO BANNER ===");
check("co bossIntroBanner", html.includes('id="bossIntroBanner"'));
check("co bossIntroIcon + bossIntroName", html.includes('id="bossIntroIcon"') && html.includes('id="bossIntroName"'));
check("co ham showBossIntro", /function showBossIntro\(bossType, bossNameText\)/.test(html));
check("co ham hideBossIntro", /function hideBossIntro\(\)/.test(html));
check("showBossIntro duoc goi khi boss spawn", /showBossIntro\(bossType, bossNames\[bossType\] \|\| Game\.chapter\.bossName\)/.test(html));
check("hideBossIntro duoc goi o phong thuong", /classList\.add\('hidden'\);\s*hideBossIntro\(\);/.test(html));
check("banner tu an sau ~2.2s", /_bossIntroTimer = setTimeout\([\s\S]{0,200}?\}, 2200\)/.test(html));
check("ten trum duoc cat tien to 'TRUM:'",
  /replace\(\/\^TRÙM:\\s\*\/i, ''\)/.test(html));
check("co CSS .hv2-bossintro", /\.hv2-bossintro \{/.test(html));
check("co animation vao (hv2introIn)", /@keyframes hv2introIn/.test(html));
check("co animation ra (hv2introOut)", /@keyframes hv2introOut/.test(html));
check("co vet scan", /@keyframes hv2introScan/.test(html));
check("icon dung theo loai trum", /golem: '🔥', queen: '🕷️', demon_king: '👑'/.test(html));

// ============================================================ 3. Thanh máu
console.log("\n=== 3. THANH MAU NGUOI CHOI ===");
check("co hudHpBar", html.includes('id="hudHpBar"'));
check("co hudHpText (so HP)", html.includes('id="hudHpText"'));
check("co hudHpPct (phan tram)", html.includes('id="hudHpPct"'));
check("co hudHpGhost (vet mau vua mat)", html.includes('id="hudHpGhost"'));
check("updateInGameHUD cap nhat thanh HP", /const hpPct = Math\.max\(0, Math\.min\(100, \(Game\.player\.hp \/ Game\.player\.maxHp\) \* 100\)\)/.test(html));
check("mau vang khi <= 50%", /classList\.toggle\('warn', hpPct <= 50 && hpPct > 22\)/.test(html));
check("mau do khi <= 22%", /classList\.toggle\('crit', hpPct <= 22\)/.test(html));
check("hien so HP co dinh dang vi-VN", /toLocaleString\('vi-VN'\)/.test(html.slice(html.indexOf("const hpNumEl"), html.indexOf("const hpNumEl") + 400)));
check("co CSS .hv2-vitals", /\.hv2-vitals \{/.test(html));
check("co .hv2-vitals-fill.warn", /\.hv2-vitals-fill\.warn/.test(html));
check("co .hv2-vitals-fill.crit", /\.hv2-vitals-fill\.crit/.test(html));
check("thanh HP o footer rieng, khong de len skills strip",
  /<footer id="arenaHudFooter"[^>]*>[\s\S]{0,500}?class="arena-vitals"/.test(html) &&
  /#arenaHudFooter\s*\{[^}]*display:flex;[^}]*justify-content:center/.test(arenaCss) &&
  /#arenaHudFooter \.arena-vitals\s*\{[^}]*width:min\(280px,100%\)/.test(arenaCss));

// ============================================================ 4. API debug
console.log("\n=== 4. API DEBUG DE KIEM CHUNG ===");
for (const fn of ["updateInGameHUD", "showBossIntro", "hideBossIntro", "openRunBriefing",
                  "renderChapterSelectStrip", "isChapterLocked", "isChapterWon", "normalizeSelectedChapter"]) {
  check(`Archero2FusionAPI export ${fn}`, new RegExp("^\\s+" + fn + ",", "m").test(html));
}

// ============================================================ 5. Không phá vỡ luồng cũ
console.log("\n=== 5. KHONG PHA VO LUONG CU ===");
check("Continue van di thang vao checkpoint (khong qua briefing)",
  /btnContinueRun[\s\S]{0,160}?continueRun\(\)/.test(html));
check("startNewRun van xoa checkpoint khi fresh", /startNewRun\('fresh'\)/.test(html));
check("briefing dong truoc khi vao tran",
  /btnBriefingStart'\)\.addEventListener\('click', \(\) => \{\s*modal\.classList\.add\('hidden'\);[\s\S]{0,300}?startNewRun\('fresh'\)/.test(html));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
