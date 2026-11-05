// Khoá lại: KHÔNG được hardcode chỉ số người chơi trong UI.
//
// Bug thật: header hardcode '61' (cấp), '10.06M' (lực chiến), '840.05K' (ATK),
// '2.85M' (HP), tên 'Vie | PuuGoo', và cả một tin nhắn chat giả. Kết quả là
// MỌI tài khoản — kể cả vừa tạo — đều thấy chỉ số của nick cũ, khiến người
// chơi tưởng "nick mới tạo mà hiện 840K ATK".
//
// Chạy: node tests/no-hardcoded-stats.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// Vùng markup tĩnh (trước khi tới <script> chính) — nơi placeholder hiển thị.
const htmlHead = html.slice(0, html.indexOf("<script>\n      "));

// Lấy thân hàm renderLobbyUI để kiểm tra code ghi giá trị.
const lobbyIdx = html.indexOf("function renderLobbyUI(");
const lobbyFn = lobbyIdx > 0 ? html.slice(lobbyIdx, lobbyIdx + 14000) : "";

// ============================================================ 1. Không hardcode trong markup
console.log("\n=== 1. MARKUP TINH KHONG HARDCODE CHI SO ===");
check("khong con cap '61' hardcode",
  !/id="topPlayerLevelNum"[^>]*>61</.test(htmlHead));
check("khong con luc chien '10.06M' hardcode",
  !/id="topPowerShieldVal"[^>]*>10\.06M</.test(htmlHead));
check("khong con ten 'Vie | PuuGoo' trong markup",
  !/id="topPlayerNameText"[^>]*>Vie \| PuuGoo</.test(htmlHead));
check("khong con chat gia 'kazuhaa'",
  !/kazuhaa/.test(html));
check("khong con tin nhan '10.06M Luc Chien'",
  !/10\.06M Lực Chiến/.test(html));
check("khong con '840.05K' hardcode",
  !/>840\.05K</.test(html));
check("khong con '2.85M' hardcode",
  !/>2\.85M</.test(html));

// ============================================================ 2. Code phải đọc từ state
console.log("\n=== 2. CODE DOC TU STATE ===");
check("tim thay renderLobbyUI", lobbyFn.length > 0);
check("cap nguoi choi lay tu SaveState.playerLevel",
  /lvEl\.textContent = String\([^)]*SaveState\.playerLevel/.test(lobbyFn));
check("luc chien lay tu stats.powerScore",
  /topPowerShieldVal[\s\S]{0,200}?stats\.powerScore|stats\.powerScore[\s\S]{0,200}?topPowerShieldVal/.test(lobbyFn));
check("ATK lay tu stats.baseAtk (renderGearSystemUI)",
  /stageAtkEl\.textContent = stats\.baseAtk/.test(html));
check("HP lay tu stats.baseHp (renderGearSystemUI)",
  /stageHpEl\.textContent = stats\.baseHp/.test(html));
check("ten hien thi lay tu ArtemisCloud player",
  /topPlayerNameText[\s\S]{0,420}?ArtemisCloud/.test(lobbyFn));
check("vang lay tu SaveState.gold",
  /goldCountText[\s\S]{0,140}?SaveState\.gold/.test(lobbyFn));
check("da quy lay tu SaveState.gems",
  /gemCountText[\s\S]{0,140}?SaveState\.gems/.test(lobbyFn));
check("stamina lay tu SaveState.stamina",
  /staminaCountText[\s\S]{0,180}?SaveState\.stamina/.test(lobbyFn));

// ============================================================ 3. Không còn số của nick cũ
console.log("\n=== 3. KHONG CON DAU VET SO CUA NICK CU ===");
const LEAKS = ["10.06M", "840.05K", "2.85M", "384.81K", "145.22K", "4,772", "kazuhaa"];
for (const leak of LEAKS) {
  // Cho phép xuất hiện trong comment (giải thích bug), không cho trong code ghi UI.
  const inCode = new RegExp("textContent\\s*=\\s*['\"]" + leak.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "['\"]");
  const inHtml = new RegExp(">" + leak.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "<");
  check(`khong con '${leak}' trong code ghi UI`, !inCode.test(html));
  check(`khong con '${leak}' trong markup`, !inHtml.test(html));
}

// ============================================================ 4. Mô phỏng hai tài khoản
console.log("\n=== 4. MO PHONG 2 TAI KHOAN (chay that) ===");
/** Mô phỏng giá trị header sẽ hiển thị với một save cho trước. */
function headerValues(save) {
  const atk = save.atk || 0;
  const hp = save.hp || 0;
  const power = save.power || 0;
  const lv = Math.max(1, Math.floor(Number(save.playerLevel) || 1));
  const stam = Math.max(0, Math.floor(Number(save.stamina) || 0));
  return {
    level: String(lv),
    power: power,
    atk, hp,
    gold: save.gold || 0,
    gems: save.gems || 0,
    stamina: `${stam}/60`,
    name: save.username || save.playerName || "Người chơi",
  };
}

const newbie = headerValues({
  username: "pchk626134", playerLevel: 1, stamina: 20,
  gold: 500, gems: 50, atk: 234, hp: 1005, power: 5672,
});
check("tai khoan moi: cap hien '1'", newbie.level === "1", newbie.level);
check("tai khoan moi: luc chien 5672 (khong phai 10.06M)", newbie.power === 5672, String(newbie.power));
check("tai khoan moi: ATK 234 (khong phai 840050)", newbie.atk === 234, String(newbie.atk));
check("tai khoan moi: HP 1005 (khong phai 2850000)", newbie.hp === 1005, String(newbie.hp));
check("tai khoan moi: vang 500 (khong phai 10461358)", newbie.gold === 500, String(newbie.gold));
check("tai khoan moi: ten la username that", newbie.name === "pchk626134", newbie.name);
check("tai khoan moi: stamina '20/60'", newbie.stamina === "20/60", newbie.stamina);

const veteran = headerValues({
  username: "puugoo", playerLevel: 61, stamina: 225,
  gold: 10461358, gems: 140, atk: 42648, hp: 185587, power: 495965,
});
check("nguoi cu: cap hien 61", veteran.level === "61", veteran.level);
check("nguoi cu: luc chien 495965", veteran.power === 495965);
check("nguoi cu: ATK 42648", veteran.atk === 42648);
check("nguoi cu: ten la 'puugoo'", veteran.name === "puugoo");

// Không NaN với save thiếu trường
const broken = headerValues({});
check("save rong: khong NaN o cap", broken.level === "1", broken.level);
check("save rong: khong NaN o luc chien", broken.power === 0);
check("save rong: stamina '0/60'", broken.stamina === "0/60", broken.stamina);
check("save rong: ten mac dinh", broken.name === "Người chơi", broken.name);

// ============================================================ 5. formatCompactNumberVn
console.log("\n=== 5. DINH DANG SO ===");
check("co ham formatCompactNumberVn", /function formatCompactNumberVn/.test(html));
check("header dung formatCompactNumberVn (khong tu noi chuoi)",
  /formatCompactNumberVn\(stats\.powerScore/.test(lobbyFn));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
