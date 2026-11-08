// Test checkpoint / Continue: chỉ lưu khi phòng sạch, hết hạn 24h, xoá đúng lúc,
// server validate đúng.
// Chạy: node tests/checkpoint.test.mjs
import fs from "node:fs";

const HTML = new URL("../public/index.html", import.meta.url);
const src = fs.readFileSync(HTML, "utf8");
const schemaSrc = fs.readFileSync(new URL("../lib/save/schema.js", import.meta.url), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ---------------------------------------------------------------- 1. Điều kiện lưu
console.log("\n=== 1. CHI LUU KHI PHONG SACH ===");
const canStart = src.indexOf("function canSaveCheckpoint()");
check("co canSaveCheckpoint", canStart > 0);
const canBody = src.slice(canStart, canStart + 500);
check("yeu cau Game.running", canBody.includes("Game.running"));
check("yeu cau Game.roomCleared (diem an toan)", canBody.includes("Game.roomCleared"));
check("yeu cau Game.player ton tai", canBody.includes("Game.player"));
check("yeu cau Game.room >= 1", canBody.includes("Game.room >= 1"));
check("yeu cau room < maxRooms (khong luu phong cuoi)", canBody.includes("Game.room < Game.maxRooms"));

const saveStart = src.indexOf("function saveCheckpoint()");
const saveBody = src.slice(saveStart, saveStart + 1400);
check("saveCheckpoint goi canSaveCheckpoint", saveBody.includes("if (!canSaveCheckpoint()) return false"));
check("luu vao SaveState.dungeonCheckpoint", saveBody.includes("SaveState.dungeonCheckpoint = {"));
check("luu ngay qua SaveState.save()", saveBody.includes("SaveState.save()"));
check("co version de migrate", saveBody.includes("v: CHECKPOINT_VERSION"));
check("luu chapterIdx de so khop", saveBody.includes("chapterIdx: SaveState.selectedChapterIdx"));

// Chỉ lưu scalar, không lưu entity
const ENTITIES = ["enemies", "playerBullets", "enemyBullets", "particles", "drops", "obstacles"];
for (const e of ENTITIES) {
  check(`KHONG luu entity ${e}`, !saveBody.includes(e));
}

// ---------------------------------------------------------------- 2. Điều kiện dùng
console.log("\n=== 2. DIEU KIEN DUNG CHECKPOINT ===");
const useStart = src.indexOf("function getUsableCheckpoint()");
const useBody = src.slice(useStart, useStart + 800);
check("chan khi khong co checkpoint", useBody.includes("if (!cp || cp.v !== CHECKPOINT_VERSION) return null"));
check("chan khi khac chuong", useBody.includes("if (cp.chapterIdx !== SaveState.selectedChapterIdx) return null"));
check("chan khi room ngoai khoang", useBody.includes("if (!cp.player || !(cp.room >= 1) || !(cp.room < cp.maxRooms)) return null"));
check("het han 24h", useBody.includes("24 * 60 * 60 * 1000"));

// ---------------------------------------------------------------- 3. Continue
console.log("\n=== 3. CONTINUE ===");
const contStart = src.indexOf("function continueRun()");
check("co continueRun", contStart > 0);
const contBody = src.slice(contStart, contStart + 2200);
check("goi startNewRun('continue')", contBody.includes("startNewRun('continue')"));
check("khoi phuc Game.room tu checkpoint", contBody.includes("Game.room = cp.room"));
check("khoi phuc kills", contBody.includes("Game.kills = cp.kills"));
check("khoi phuc runGold", contBody.includes("Game.runGold = cp.runGold"));
check("ghim hp trong [1, maxHp]", contBody.includes("p.hp = Math.min(p.maxHp, Math.max(1,"));
check("khoi phuc ky nang da nhat", contBody.includes("for (const [skId, tier] of Object.entries(sp.skills || {}))"));
check("whitelist skill id khi khoi phuc", contBody.includes("if (!ROGUE_SKILLS.some(s => s.id === skId)) continue"));
check("dung lai phong da luu", contBody.includes("setupRoom(cp.room)"));
check("xoa checkpoint sau khi dung", contBody.includes("clearCheckpoint()"));

// ---------------------------------------------------------------- 4. Vòng đời xoá
console.log("\n=== 4. XOA DUNG LUC ===");
check("startNewRun xoa checkpoint tru khi 'continue'",
  /if \(reason !== 'continue'\) \{[\s\S]{0,120}?SaveState\.dungeonCheckpoint = null/.test(src));
check("finishRun xoa checkpoint", /finishRun\(isVictory\)[\s\S]{0,700}?SaveState\.dungeonCheckpoint = null/.test(src));
check("Retry ('fresh') xoa checkpoint", src.includes("startNewRun('fresh')"));
check("saveCheckpoint goi khi phong sach", /Game\.roomCleared = true;[\s\S]{0,1200}?saveCheckpoint\(\);/.test(src));

// ---------------------------------------------------------------- 5. Nút Continue
console.log("\n=== 5. NUT CONTINUE ===");
check("co nut btnContinueRun trong HTML", src.includes('id="btnContinueRun"'));
check("nut an mac dinh (class hidden)", /id="btnContinueRun"[\s\S]{0,200}?class="hidden/.test(src));
check("co ham syncContinueButton", src.includes("function syncContinueButton()"));
const syncStart = src.indexOf("function syncContinueButton()");
const syncBody = src.slice(syncStart, syncStart + 700);
check("an nut khi khong co checkpoint", syncBody.includes("btn.classList.add('hidden')"));
check("hien nut khi co checkpoint", syncBody.includes("btn.classList.remove('hidden')"));
check("hien so phong tren nhan nut", syncBody.includes("PHÒNG ${cp.room}/${cp.maxRooms}"));
check("co handler click cho nut", src.includes("getElementById('btnContinueRun')?.addEventListener"));
check("handler goi continueRun", /btnContinueRun'\)\?\.addEventListener\('click', \(\) => \{\s*\n\s*continueRun\(\);/.test(src));
check("syncContinueButton goi trong renderLobbyUI", src.includes("safeRender('continueButton'"));

// ---------------------------------------------------------------- 6. Save / schema
console.log("\n=== 6. SAVE & SCHEMA ===");
check("SaveState co dungeonCheckpoint mac dinh", src.includes("dungeonCheckpoint: null,"));
check("save() ghi dungeonCheckpoint", src.includes("dungeonCheckpoint: this.dungeonCheckpoint,"));
check("schema co sanitizeDungeonCheckpoint", schemaSrc.includes("function sanitizeDungeonCheckpoint(raw)"));
check("sanitizeSave gan dungeonCheckpoint", schemaSrc.includes("dungeonCheckpoint: sanitizeDungeonCheckpoint(raw.dungeonCheckpoint)"));

// Kiểm tra thật
const { sanitizeSave } = await import(new URL("../lib/save/schema.js", import.meta.url));

const good = sanitizeSave({
  dungeonCheckpoint: {
    v: 1, chapterIdx: 0, chapterId: 1, room: 7, maxRooms: 15,
    kills: 42, runGold: 900, savedAt: Date.now(),
    player: { hp: 50000, maxHp: 75623, atk: 22718, aspd: 2.15, critRate: 0.36,
              critDmgMult: 2.09, defFlat: 2, dmgReduction: 0.0009,
              level: 8, xp: 20, xpNext: 240, skills: { multishot: 2, diag_arrow: 1 } },
  },
});
const cp = good.data.dungeonCheckpoint;
check("accept checkpoint hop le", cp !== null);
check("giu room", cp?.room === 7);
check("giu ky nang", cp?.player?.skills?.multishot === 2);
check("hp khong vuot maxHp", cp?.player?.hp <= cp?.player?.maxHp);

check("tu choi room >= maxRooms",
  sanitizeSave({ dungeonCheckpoint: { room: 15, maxRooms: 15, player: { maxHp: 100 } } }).data.dungeonCheckpoint === null);
check("tu choi khi thieu player",
  sanitizeSave({ dungeonCheckpoint: { room: 5, maxRooms: 15 } }).data.dungeonCheckpoint === null);
check("tu choi khi khong phai object",
  sanitizeSave({ dungeonCheckpoint: "hack" }).data.dungeonCheckpoint === null);

// HP âm phải được kéo lên tối thiểu 1
const negHp = sanitizeSave({
  dungeonCheckpoint: { room: 3, maxRooms: 15, player: { hp: -99999, maxHp: 1000 } },
}).data.dungeonCheckpoint;
check("hp am duoc keo len >= 1", negHp?.player?.hp >= 1, "got " + negHp?.player?.hp);

// Kỹ năng rác phải bị loại
const dirtySkills = sanitizeSave({
  dungeonCheckpoint: {
    room: 3, maxRooms: 15,
    player: { maxHp: 1000, hp: 500, skills: { "ok_skill": 2, "../hack": 5, "": 3 } },
  },
}).data.dungeonCheckpoint;
check("loai skill id khong hop le", dirtySkills?.player?.skills && !("../hack" in dirtySkills.player.skills));
check("giu skill hop le", dirtySkills?.player?.skills?.ok_skill === 2);

// dmgReduction bị chặn 0.75
const capped = sanitizeSave({
  dungeonCheckpoint: { room: 3, maxRooms: 15, player: { maxHp: 1000, hp: 500, dmgReduction: 5 } },
}).data.dungeonCheckpoint;
check("dmgReduction chan 0.75", capped?.player?.dmgReduction === 0.75, "got " + capped?.player?.dmgReduction);

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
