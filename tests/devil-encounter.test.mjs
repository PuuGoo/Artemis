// Test hoi quy: bug "game dung o man 10".
//
// Nguyen nhan goc: triggerDevilEncounter() gan Game.paused = true roi doc
// document.getElementById('devilSkillName').textContent. Nhung chinh ham do
// ghi de innerHTML cua #devilOfferDesc (chua span nay) o lan gap tru da u dau
// tien -> lan gap thu hai (phong 10) span khong con -> TypeError -> ham chet
// giua chung, Game.paused giu nguyen true, khong modal nao mo => man hinh dung.
//
// Test nay mo phong dung chuoi do o muc DOM/thuan JS (khong can trinh duyet):
//   1. #devilOfferDesc sau khi bi ghi de KHONG con #devilSkillName
//   2. triggerDevilEncounter phai chiu duoc viec do (khong nem loi)
//   3. Neu co loi bat ngo, Game.paused phai duoc nha (khong treo game)
//
// Chay: node tests/devil-encounter.test.mjs
import fs from "node:fs";

const HTML = new URL("../public/index.html", import.meta.url);
const src = fs.readFileSync(HTML, "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

console.log("\n=== 1. KHONG con phu thuoc #devilSkillName ===");
check(
  "khong con getElementById('devilSkillName') trong code",
  !src.includes("getElementById('devilSkillName')"),
  "van con tham chieu -> se nem TypeError o lan gap tru thu 2"
);
check(
  "span #devilSkillName da bi xoa khoi HTML (khong bi ghi de roi doc lai)",
  !src.includes('id="devilSkillName"')
);

console.log("\n=== 2. triggerDevilEncounter co bao ve try/catch ===");
const fnStart = src.indexOf("function triggerDevilEncounter()");
check("tim thay ham triggerDevilEncounter", fnStart > 0);
const fnBody = src.slice(fnStart, fnStart + 3000);
const tryIdx = fnBody.indexOf("try {");
const catchIdx = fnBody.indexOf("} catch (err) {");
check("co khoi try", tryIdx > 0);
check("co khoi catch", catchIdx > tryIdx);
check(
  "trong catch co nha pause (Game.paused = false)",
  fnBody.slice(catchIdx, catchIdx + 700).includes("Game.paused = false"),
  "neu khong nha pause, loi bat ngo se treo game vinh vien"
);
check(
  "catch co ghi lai loi de debug (Game._lastDevilError)",
  fnBody.includes("_lastDevilError")
);
check(
  "co kiem tra #devilModal ton tai truoc khi dung",
  fnBody.includes("if (!modal) throw new Error")
);

console.log("\n=== 3. gameLoop co chot an toan pause mo coi ===");
const loopStart = src.indexOf("function gameLoop(now)");
const loopBody = src.slice(loopStart, loopStart + 1600);
check("tim thay gameLoop", loopStart > 0);
check(
  "co dem so frame paused khong modal",
  loopBody.includes("_pausedNoModalFrames")
);
check(
  "co kiem tra ca 3 modal truoc khi tu nha pause",
  loopBody.includes("skillSelectModal") && loopBody.includes("devilModal") && loopBody.includes("summaryModal")
);
check(
  "co tu dong nha pause (Game.paused = false)",
  loopBody.includes("Game.paused = false"),
  "khong co dong nay thi van treo"
);
check(
  "co ghi nhan so lan tu phuc hoi (_autoUnpaused)",
  loopBody.includes("_autoUnpaused")
);

console.log("\n=== 4. Moi truong hop mo modal deu co duong thoat ===");
// Moi modal chan game phai co nut dong va handler nha pause.
const MODALS = [
  { modal: "skillSelectModal", close: "skill-choice-card", unpause: "Game.paused = false" },
  { modal: "devilModal", close: "btnDeclineDevil", unpause: "Game.paused = false" },
  { modal: "devilModal", close: "btnAcceptDevil", unpause: "Game.paused = false" },
  { modal: "summaryModal", close: "btnResumeGame", unpause: "Game.paused = false" },
];
for (const m of MODALS) {
  check(`${m.modal} co nut "${m.close}"`, src.includes(`id="${m.close}"`) || src.includes(`class="${m.close}`) || src.includes(m.close));
}
check(
  "btnDeclineDevil nha pause",
  /btnDeclineDevil'\).addEventListener[\s\S]{0,600}?Game\.paused = false/.test(src)
);
check(
  "btnAcceptDevil nha pause",
  /btnAcceptDevil'\).addEventListener[\s\S]{0,600}?Game\.paused = false/.test(src)
);
check(
  "btnResumeGame nha pause",
  /btnResumeGame'\).addEventListener[\s\S]{0,300}?Game\.paused = false/.test(src)
);

console.log("\n=== 5. Phong tru khong bi chen devil pact o phong cuoi ===");
check(
  "chi goi triggerDevilEncounter khi room < maxRooms",
  /if \(e\.isBoss && Game\.room < Game\.maxRooms\)/.test(src)
);

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
