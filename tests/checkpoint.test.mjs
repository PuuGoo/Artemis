// Test checkpoint / Continue: chỉ lưu khi phòng sạch, hết hạn 24h, xoá đúng lúc,
// server validate đúng.
// Chạy: node tests/checkpoint.test.mjs
import fs from "node:fs";
import vm from "node:vm";
import { loadCampaignDependencies } from './fixtures/campaign-vm.mjs';

const HTML = new URL("../public/index.html", import.meta.url);
const src = fs.readFileSync(HTML, "utf8");
const schemaSrc = fs.readFileSync(new URL("../lib/save/schema.js", import.meta.url), "utf8");


// Trích khối cân bằng ngoặc; thất bại rõ nếu anchor bị đổi, không cắt cửa sổ ký tự.
function section(marker, opening = '{', closing = '}') {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('Thiếu anchor: ' + marker);
  const begin = src.indexOf(opening, start + marker.length);
  let depth = 0;
  for (let i = begin; i < src.length; i++) {
    if (src[i] === opening) depth++;
    else if (src[i] === closing && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error('Khối không đóng: ' + marker);
}

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ---------------------------------------------------------------- 1. Điều kiện lưu
console.log("\n=== 1. CHI LUU KHI PHONG SACH ===");
const canStart = src.indexOf("function canSaveCheckpoint()");
check("co canSaveCheckpoint", canStart > 0);
const canBody = section("function canSaveCheckpoint()");
check("yeu cau Game.running", canBody.includes("Game.running"));
check("yeu cau Game.roomCleared (diem an toan)", canBody.includes("Game.roomCleared"));
check("yeu cau Game.player ton tai", canBody.includes("Game.player"));
check("yeu cau Game.room >= 1", canBody.includes("Game.room >= 1"));
check("yeu cau room < maxRooms (khong luu phong cuoi)", canBody.includes("Game.room < Game.maxRooms"));

const saveStart = src.indexOf("function saveCheckpoint()");
const saveBody = section("function saveCheckpoint()");
check("saveCheckpoint goi canSaveCheckpoint", saveBody.includes("if (!canSaveCheckpoint()) return false"));
check("luu vao SaveState.dungeonCheckpoint", saveBody.includes("SaveState.dungeonCheckpoint = {"));
check("luu ngay qua SaveState.save()", saveBody.includes("SaveState.save()"));
check("co version de migrate rieng campaign", saveBody.includes("v: usesCampaignTuning() ? CHECKPOINT_VERSION : 1"));
check("luu chapterIdx de so khop", saveBody.includes("chapterIdx: SaveState.selectedChapterIdx"));

// Chỉ lưu scalar, không lưu entity
const ENTITIES = ["enemies", "playerBullets", "enemyBullets", "particles", "drops", "obstacles"];
for (const e of ENTITIES) {
  check(`KHONG luu entity ${e}`, !new RegExp('\\b' + e + '\\s*:').test(saveBody));
}

// ---------------------------------------------------------------- 2. Điều kiện dùng
console.log("\n=== 2. DIEU KIEN DUNG CHECKPOINT ===");
const useStart = src.indexOf("function getUsableCheckpoint()");
const useBody = section("function getUsableCheckpoint()");
check("chan khi khong co checkpoint", useBody.includes("if (!cp || ![1, CHECKPOINT_VERSION].includes(cp.v)) return null"));
check("chan khi khac chuong", useBody.includes("if (cp.chapterIdx !== SaveState.selectedChapterIdx) return null"));
check("chan khi room ngoai khoang", useBody.includes("if (!cp.player || !(cp.room >= 1) || !(cp.room < cp.maxRooms)) return null"));
check("het han 24h", useBody.includes("24 * 60 * 60 * 1000"));

// ---------------------------------------------------------------- 3. Continue
console.log("\n=== 3. CONTINUE ===");
const contStart = src.indexOf("function continueRun()");
check("co continueRun", contStart > 0);
const contBody = section("function continueRun()");
check("goi startNewRun('continue')", contBody.includes("startNewRun('continue')"));
check("khoi phuc Game.room tu checkpoint", contBody.includes("Game.room = cp.room"));
check("khoi phuc kills", contBody.includes("Game.kills = cp.kills"));
check("khoi phuc runGold", contBody.includes("Game.runGold = cp.runGold"));
check("ghim hp trong [1, maxHp]", contBody.includes("p.hp = Math.min(p.maxHp, Math.max(1,"));
check("khoi phuc ky nang da nhat", contBody.includes("for (const [skId, tier] of Object.entries(sp.skills || {}))"));
check("whitelist skill id khi khoi phuc", contBody.includes("if (!ROGUE_SKILLS.some(s => s.id === skId)) continue"));
check("khôi phục phòng campaign đã sạch không spawn lại; mode khác giữ setup cũ", contBody.includes("if (usesCampaignTuning()) restoreClearedCampaignRoom(cp);") && contBody.includes("else setupRoom(cp.room)"));
check("ghi lại checkpoint an toàn sau Continue", contBody.indexOf("saveCheckpoint()") > contBody.indexOf("restoreClearedCampaignRoom(cp)"));

// ---------------------------------------------------------------- 4. Vòng đời xoá
console.log("\n=== 4. XOA DUNG LUC ===");
check("startNewRun xoa checkpoint tru khi 'continue'",
  /if \(reason !== 'continue'\) \{[\s\S]*?SaveState\.dungeonCheckpoint = null/.test(section("function startNewRun(reason = 'fresh')")));
check("finishRun xoa checkpoint", section("function finishRun(isVictory)").includes("SaveState.dungeonCheckpoint = null"));
check("Retry ('fresh') xoa checkpoint", src.includes("startNewRun('fresh')"));
check("saveCheckpoint goi khi phong sach", /Game\.roomCleared = true;[\s\S]*?saveCheckpoint\(\);/.test(section("function onEnemyKilled(e)")));

// ---------------------------------------------------------------- 5. Nút Continue
console.log("\n=== 5. NUT CONTINUE ===");
check("co nut btnContinueRun trong HTML", src.includes('id="btnContinueRun"'));
check("nut an mac dinh (class hidden)", /<button\b[^>]*id="btnContinueRun"[^>]*class="hidden/.test(src));
check("co ham syncContinueButton", src.includes("function syncContinueButton()"));
const syncStart = src.indexOf("function syncContinueButton()");
const syncBody = section("function syncContinueButton()");
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


// VM: chạy hàm production, không mock công thức khôi phục/chỉ số.
const restoreBody = section('function restoreClearedCampaignRoom(cp)');
check('restore không spawn quái, clear lại hay cấp kỹ năng',
  !/setupRoom\(|damageEnemy\(|applyRogueSkill\(|grant|onRoomCleared\(/.test(restoreBody));
const fixture = {Game: {player: {maxHp: 1000, hp: 500}, runProgression: {pendingOffer: null},
  runGold: 90, kills: 8}, spawnCampaignValkyrie() {}, spawnCampaignWheel() {}, openCampaignOffer() {}};
vm.createContext(fixture); vm.runInContext(restoreBody, fixture);
for (let i = 0; i < 2; i++) {
  fixture.Game.enemies = [{hp:100}]; fixture.Game.drops = [{val:999}];
  fixture.restoreClearedCampaignRoom({room:10});
  check(`restore lần ${i+1}: không địch/drop, cổng mở`, fixture.Game.enemies.length === 0 &&
    fixture.Game.drops.length === 0 && fixture.Game.roomCleared && fixture.Game.portalOpen);
  check(`restore lần ${i+1}: không cấp lại vàng/kills/MaxHP`, fixture.Game.runGold === 90 &&
    fixture.Game.kills === 8 && fixture.Game.player.maxHp === 1000 && fixture.Game.player.hp === 500);
}
const usable = {SaveState: {selectedChapterIdx:0}, CHECKPOINT_VERSION:2, Date};
vm.createContext(usable); vm.runInContext(useBody, usable);
for (const v of [1,2]) {
  usable.SaveState.dungeonCheckpoint = {v, chapterIdx:0, room:10, maxRooms:50, savedAt:Date.now(), player:{hp:1}};
  check(`client nhận checkpoint v${v}`, !!usable.getUsableCheckpoint());
}
usable.SaveState.dungeonCheckpoint.v = 99;
check('client từ chối version lạ', usable.getUsableCheckpoint() === null);
usable.SaveState.dungeonCheckpoint.v = 2;
usable.SaveState.dungeonCheckpoint.savedAt = Date.now() - 24*60*60*1000 - 1;
check('client từ chối checkpoint hết hạn thật', usable.getUsableCheckpoint() === null);
const v2 = sanitizeSave({dungeonCheckpoint:{v:2, room:49, maxRooms:50, roomCleared:true,
  player:{hp:99999,maxHp:100,level:99,skills:{multishot:99,'../hack':5}}}}).data.dungeonCheckpoint;
check('schema v2 giữ phòng 49/50 và cờ cleared', v2?.room === 49 && v2?.maxRooms === 50 && v2?.roomCleared === true);
check('schema v2 chặn level 10 và HP', v2?.player.level === 10 && v2?.player.hp === 100);
check('schema v2 bỏ skill rác', !('../hack' in v2.player.skills));
check('schema v2 từ chối phòng chưa sạch', sanitizeSave({dungeonCheckpoint:{...v2,roomCleared:false}}).data.dungeonCheckpoint === null);
check('schema v2 từ chối phòng cuối', sanitizeSave({dungeonCheckpoint:{...v2,room:50}}).data.dungeonCheckpoint === null);


// Vòng serializer → sanitizer → Continue thật, lặp hai lần; hiệu ứng không được áp lại.
const resume = {Game:{running:true,roomCleared:true,chapter:{id:1},room:10,maxRooms:50,kills:42,runGold:900,
  player:{hp:700,maxHp:1000,atk:164,aspd:2,level:4,xp:20,xpNext:100,skills:{multishot:2},speed:260}},
  SaveState:{selectedChapterIdx:0,gold:12345,save(){}},CHECKPOINT_VERSION:2,Date,
  ROGUE_SKILLS:[{id:'multishot',maxStack:2,rarity:'rare'}],usesCampaignTuning:()=>true,
  startNewRun(reason){ if(reason!=='continue')throw Error('sai reason');resume.Game.player={skills:{},maxHp:1000,atk:164}; },
  spawnCampaignValkyrie(){},spawnCampaignWheel(){},openCampaignOffer(){},updateInGameHUD(){},syncContinueButton(){},showToast(){}};
vm.createContext(resume);
loadCampaignDependencies(resume);
resume.usesCampaignTuning=()=>true;
resume.Game.runProgression=resume.ArtemisCampaignSkills.normalizeState({skills:{multishot:2}},resume.ROGUE_SKILLS);
vm.runInContext([canBody,saveBody,useBody,restoreBody,contBody].join('\n'),resume);
resume.Game.drops=[{val:999}];
resume.saveCheckpoint();
check('serializer không lưu entity/drop dù đọc rewardSettled', ENTITIES.every(key=>!Object.hasOwn(resume.SaveState.dungeonCheckpoint,key)) && resume.SaveState.dungeonCheckpoint.rewardSettled===false);
resume.Game.drops=[];
resume.saveCheckpoint();
check('rewardSettled phản ánh đã nhặt hết drop',resume.SaveState.dungeonCheckpoint.rewardSettled===true);
for(let round=1;round<=2;round++) {
  const sanitized=sanitizeSave({dungeonCheckpoint:JSON.parse(JSON.stringify(resume.SaveState.dungeonCheckpoint))}).data.dungeonCheckpoint;
  resume.SaveState.dungeonCheckpoint=sanitized;
  const ok=resume.continueRun();
  check(`Continue ${round}: giữ cleared room và counters`,ok&&resume.Game.room===10&&resume.Game.kills===42&&resume.Game.runGold===900&&resume.Game.enemies.length===0);
  check(`Continue ${round}: không cấp lại hiệu ứng/skill/vàng account`,resume.Game.player.maxHp===1000&&resume.Game.player.hp===700&&resume.Game.player.skills.multishot===2&&resume.SaveState.gold===12345);
  check(`Continue ${round}: checkpoint mới vẫn cleared`,resume.SaveState.dungeonCheckpoint.v===2&&resume.SaveState.dungeonCheckpoint.roomCleared===true);
}

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
