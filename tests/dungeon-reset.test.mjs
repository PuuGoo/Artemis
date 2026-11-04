// Test dungeon reset: retry luôn về màn 1, xoá đúng state, giữ dữ liệu nhân vật.
// Chạy: node tests/dungeon-reset.test.mjs
import fs from "node:fs";

const HTML = new URL("../public/index.html", import.meta.url);
const src = fs.readFileSync(HTML, "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ---------------------------------------------------------------- 1. Session
console.log("\n=== 1. SESSION PHO BAN ===");
check("co DungeonSession", src.includes("const DungeonSession = {"));
check("DungeonSession co begin()", src.includes("begin(chapterIdx) {"));
check("DungeonSession co end()", src.includes("end() {"));
check("startNewRun goi DungeonSession.begin", src.includes("DungeonSession.begin(SaveState.selectedChapterIdx)"));
check("finishRun goi DungeonSession.end", src.includes("DungeonSession.end();"));

// ---------------------------------------------------------------- 2. clearRunState
console.log("\n=== 2. CLEAR RUN STATE ===");
const clearStart = src.indexOf("function clearRunState() {");
check("co ham clearRunState", clearStart > 0);
const clearBody = src.slice(clearStart, clearStart + 2200);

// Tất cả array entity phải được reset
const ARRAYS = ["enemies", "obstacles", "playerBullets", "enemyBullets", "swords",
  "drops", "shockwaves", "lightningBolts", "meteors", "artemisHawks",
  "particles", "floatTexts", "ambientMotes", "floorDetails", "floorDecals",
  "afterimages", "muzzleFlashes", "wallTorches"];
for (const a of ARRAYS) {
  check(`clearRunState reset Game.${a}`, clearBody.includes(`Game.${a} = []`));
}

// Timer phải reset
const TIMERS = ["shakeTime", "shakeMag", "roomBannerTimer", "nyanjaSwordTimer",
  "artemisHawkTimer", "flyingSwordSkillTimer", "meteorTimer", "afterimageTimer",
  "comboCount", "comboTimer"];
for (const t of TIMERS) {
  check(`clearRunState reset Game.${t}`, clearBody.includes(`Game.${t} = 0`));
}

// Cờ phòng phải reset
check("reset Game.roomCleared", clearBody.includes("Game.roomCleared = false"));
check("reset Game.portalOpen", clearBody.includes("Game.portalOpen = false"));
check("reset Game.playerTookDamageThisRoom", clearBody.includes("Game.playerTookDamageThisRoom = false"));
check("reset joystick", clearBody.includes("Game.joy.active = false"));

// ---------------------------------------------------------------- 3. Double-run
console.log("\n=== 3. CHAN HAI SESSION SONG SONG ===");
check("co ham stopGameLoop", src.includes("function stopGameLoop() {"));
check("stopGameLoop dung cancelAnimationFrame", src.includes("cancelAnimationFrame(Game.animId)"));
const snrStart = src.indexOf("function startNewRun(reason = 'fresh')");
const snrBody = src.slice(snrStart, snrStart + 900);
check("startNewRun goi stopGameLoop TRUOC khi dung tran", snrBody.indexOf("stopGameLoop()") < snrBody.indexOf("clearRunState()"));
check("startNewRun goi clearRunState", snrBody.includes("clearRunState()"));
check("finishRun dung stopGameLoop (khong let animId cu)", /finishRun\(isVictory\) \{[\s\S]{0,300}?stopGameLoop\(\);/.test(src));

// ---------------------------------------------------------------- 4. Retry về màn 1
console.log("\n=== 4. RETRY LUON BAT DAU MAN 1 ===");
const fullSnr = src.slice(snrStart, src.indexOf("// Setup Room Obstacles", snrStart));
check("startNewRun dat Game.room = 1", fullSnr.includes("Game.room = 1"));
check("startNewRun dat Game.kills = 0", fullSnr.includes("Game.kills = 0"));
check("startNewRun dat Game.runGold = 0", fullSnr.includes("Game.runGold = 0"));
check("startNewRun goi setupRoom(1)", fullSnr.includes("setupRoom(1)"));
check("startNewRun tao lai Game.player tu getComputedStats", fullSnr.includes("const stats = getComputedStats()"));
check("HP duoc khoi tao lai tu stats.baseHp", fullSnr.includes("hp: stats.baseHp"));
check("skillList duoc tao moi (khong ke thua tran cu)", fullSnr.includes("skillList: []"));

// ---------------------------------------------------------------- 5. Không xoá dữ liệu nhân vật
console.log("\n=== 5. RESET KHONG XOA DU LIEU NHAN VAT ===");
// Các field nhân vật KHÔNG được xuất hiện trong clearRunState
const PLAYER_DATA = ["gold", "gems", "equippedGear", "gearBag", "heroStars",
  "heroShards", "talents", "runes", "artifactStars", "achievementsClaimed",
  "lifetimeStats", "bestRooms", "beginnerJourney", "gearScrolls", "chestKeys"];
for (const f of PLAYER_DATA) {
  check(`clearRunState KHONG dong toi SaveState.${f}`, !clearBody.includes(`SaveState.${f}`));
}
check("startNewRun khong reset SaveState.gold", !fullSnr.includes("SaveState.gold ="));
check("startNewRun khong reset SaveState.gems", !fullSnr.includes("SaveState.gems ="));

// ---------------------------------------------------------------- 6. Phân biệt hành động
console.log("\n=== 6. PHAN BIET RETRY / RESET / CONTINUE ===");
check("DungeonSession co truong active", src.includes("active: false,"));
check("DungeonSession co id tang dan", src.includes("this.id += 1;"));
check("Game.sessionId duoc gan khi begin", src.includes("Game.sessionId = this.id;"));
check("finishRun set Game.running = false", /finishRun\(isVictory\) \{\s*\n\s*Game\.running = false;/.test(src));

// ---------------------------------------------------------------- 7. Không phát thưởng trùng
console.log("\n=== 7. RESET KHONG PHAT THUONG TRUNG ===");
check("runs chi dem 1 lan (o startNewRun)", fullSnr.includes("bumpLifetimeStat('runs', 1)"));
check("finishRun KHONG dem runs nua", !src.includes("bumpLifetimeStat('runs', 1);\n        bumpLifetimeStat('goldEarned'"));
check("beginnerJourney chi kich hoat neu startedAt = 0",
  src.includes("if (bj.startedAt > 0) return false;"));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
