// Test Beginner Journey: kích hoạt đúng tài khoản, reward idempotent, skip,
// backward compatibility, server-side whitelist.
// Chạy: node tests/beginner-journey.test.mjs
import fs from "node:fs";

const HTML = new URL("../public/index.html", import.meta.url);
const src = fs.readFileSync(HTML, "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ---------------------------------------------------------------- 1. Định nghĩa bước
console.log("\n=== 1. DINH NGHIA 8 BUOC ===");
check("co BEGINNER_STEPS", src.includes("const BEGINNER_STEPS = ["));
const requiredIds = ["N01", "N02", "N03", "N04", "N05", "N06", "N07", "N08"];
for (const id of requiredIds) {
  check(`co buoc ${id}`, src.includes(`id: '${id}'`));
}
check("co BEGINNER_STEP_IDS (Set de whitelist)", src.includes("const BEGINNER_STEP_IDS = new Set("));

// ---------------------------------------------------------------- 2. Phân biệt tài khoản
console.log("\n=== 2. CHI TAI KHOAN MOI ===");
const activeFnStart = src.indexOf("function isBeginnerJourneyActive()");
check("co isBeginnerJourneyActive", activeFnStart > 0);
const activeBody = src.slice(activeFnStart, activeFnStart + 600);
check("tra false khi startedAt <= 0 (tai khoan cu)", activeBody.includes("if (!bj.startedAt || bj.startedAt <= 0) return false"));
check("tra false khi skipped", activeBody.includes("if (bj.skipped) return false"));
check("tra false khi da completed", activeBody.includes("if (bj.isCompleted) return false"));
check("KHONG dung playerLevel de xac dinh tai khoan moi", !activeBody.includes("playerLevel"));

// Kích hoạt chỉ từ đường đăng ký
check("activateBeginnerJourney idempotent (chan startedAt > 0)",
  src.includes("if (bj.startedAt > 0) return false;"));
const cloudSrc = fs.readFileSync(new URL("../public/cloud.js", import.meta.url), "utf8");
check("cloud.js CHI kich hoat khi mode === 'register'",
  cloudSrc.includes('pendingRegister = mode === "register";')
  && cloudSrc.includes('if (pendingRegister && window.Archero2FusionAPI'));

// ---------------------------------------------------------------- 3. Reward idempotent
console.log("\n=== 3. REWARD KHONG THE NHAN HAI LAN ===");
const claimStart = src.indexOf("function claimBeginnerReward(stepId)");
check("co claimBeginnerReward", claimStart > 0);
const claimBody = src.slice(claimStart, claimStart + 1600);
check("chan khi da co trong claimedRewards", claimBody.includes("if (bj.claimedRewards.includes(stepId)) return false"));
check("chan khi buoc chua hoan thanh", claimBody.includes("if (!(bj.completedSteps || []).includes(stepId)) return false"));
check("push vao claimedRewards sau khi trao", claimBody.includes("bj.claimedRewards.push(stepId)"));
check("luu SaveState sau khi trao", claimBody.includes("SaveState.save()"));

// ---------------------------------------------------------------- 4. Complete idempotent
console.log("\n=== 4. COMPLETE IDEMPOTENT ===");
const compStart = src.indexOf("function completeBeginnerStep(stepId)");
const compBody = src.slice(compStart, compStart + 1400);
check("chan stepId ngoai whitelist", compBody.includes("if (!BEGINNER_STEP_IDS.has(stepId)) return false"));
check("chan khi da hoan thanh", compBody.includes("if (bj.completedSteps.includes(stepId)) return false"));
check("tu dong chuyen currentStep", compBody.includes("bj.currentStep = BEGINNER_STEPS[nextIdx].id"));
check("danh dau isCompleted khi het buoc", compBody.includes("bj.isCompleted = true"));

// ---------------------------------------------------------------- 5. Hook gameplay thật
console.log("\n=== 5. HOOK GAMEPLAY THAT (khong phai nut gia) ===");
const HOOKS = [
  ["N02 roomCleared", "BeginnerHooks.onRoomCleared()", "Game.roomCleared = true;"],
  ["N03 loot", "BeginnerHooks.onLoot(1)", "Game.drops.splice(i, 1);"],
  ["N04 gear equipped", "BeginnerHooks.onGearEquipped()", "SaveState.equippedGear[slotKey] = newItem;"],
  ["N05 gear upgraded", "BeginnerHooks.onGearUpgraded()", "item.level = (item.level || 1) + 1;"],
  ["N06 skill picked", "BeginnerHooks.onSkillPicked()", "p.skills[skId] = (p.skills[skId] || 0) + 1;"],
  ["N07 chapter cleared", "BeginnerHooks.onChapterCleared", "if (isVictory) {"],
];
for (const [label, hook, anchor] of HOOKS) {
  const anchorIdx = src.indexOf(anchor);
  check(`${label}: co hook`, src.includes(hook));
  if (anchorIdx > 0) {
    const near = src.slice(anchorIdx, anchorIdx + 900);
    check(`${label}: hook nam ngay sau su kien that`, near.includes(hook));
  }
}

// ---------------------------------------------------------------- 6. Skip
console.log("\n=== 6. SKIP ===");
const skipStart = src.indexOf("function skipBeginnerJourney()");
check("co skipBeginnerJourney", skipStart > 0);
const skipBody = src.slice(skipStart, skipStart + 500);
check("set skipped = true", skipBody.includes("bj.skipped = true"));
check("set completedAt", skipBody.includes("bj.completedAt = Date.now()"));
check("van giu startedAt (khong kich hoat lai)", !skipBody.includes("startedAt = 0"));

// ---------------------------------------------------------------- 7. Save / migration
console.log("\n=== 7. SAVE & MIGRATION ===");
check("SaveState co beginnerJourney mac dinh", /beginnerJourney: \{[\s\S]{0,80}?version: 1,/.test(src));
check("save() ghi beginnerJourney", src.includes("beginnerJourney: this.beginnerJourney,"));
check("load() migration tao object rong khi thieu",
  src.includes("if (!this.beginnerJourney || typeof this.beginnerJourney !== 'object')"));
const migStart = src.indexOf("// ---- Migration Beginner Journey ----");
const migBody = src.slice(migStart, migStart + 1200);
check("migration dat startedAt = 0 cho tai khoan cu", migBody.includes("startedAt: 0"));
check("migration khong tu bat tutorial", !migBody.includes("startedAt: Date.now()"));
check("migration chuan hoa completedSteps ve array", migBody.includes("if (!Array.isArray(this.beginnerJourney.completedSteps))"));

// ---------------------------------------------------------------- 8. Server schema
console.log("\n=== 8. SERVER-SIDE VALIDATION ===");
const schemaSrc = fs.readFileSync(new URL("../lib/save/schema.js", import.meta.url), "utf8");
check("schema co BEGINNER_STEP_IDS whitelist", schemaSrc.includes("export const BEGINNER_STEP_IDS"));
check("schema co sanitizeBeginnerJourney", schemaSrc.includes("function sanitizeBeginnerJourney"));
check("schema dedupe step ids", schemaSrc.includes("if (!id || !BEGINNER_STEP_SET.has(id) || seen.has(id)) continue;"));
check("schema chan claim buoc chua xong", schemaSrc.includes("claimedRewards = claimedRaw.filter((id) => completedSteps.includes(id))"));
check("schema clamp startedAt", schemaSrc.includes("startedAt: clampNum(raw.startedAt, 0, 4e12, 0)"));
check("sanitizeSave gan beginnerJourney", schemaSrc.includes("beginnerJourney: sanitizeBeginnerJourney(raw.beginnerJourney)"));

// Kiểm tra thật bằng cách import
const { sanitizeSave } = await import(new URL("../lib/save/schema.js", import.meta.url));
const r1 = sanitizeSave({
  beginnerJourney: {
    startedAt: 1700000000000, currentStep: "N05",
    completedSteps: ["N01", "N02", "N03", "N04", "N05"],
    claimedRewards: ["N01", "N02", "N07"],
  },
});
check("accept buoc hop le", r1.data.beginnerJourney.completedSteps.length === 5);
check("loai claim buoc chua hoan thanh (N07)",
  !r1.data.beginnerJourney.claimedRewards.includes("N07"),
  JSON.stringify(r1.data.beginnerJourney.claimedRewards));
check("giu claim hop le (N01, N02)", r1.data.beginnerJourney.claimedRewards.length === 2);

const r2 = sanitizeSave({ beginnerJourney: { completedSteps: ["N01", "N01", "N01", "XX99", "N02"] } });
check("dedupe trung lap", r2.data.beginnerJourney.completedSteps.join(",") === "N01,N02",
  JSON.stringify(r2.data.beginnerJourney.completedSteps));
check("loai ID khong hop le", !r2.data.beginnerJourney.completedSteps.includes("XX99"));

const r3 = sanitizeSave({});
check("save cu khong co beginnerJourney -> tao mac dinh",
  r3.data.beginnerJourney && r3.data.beginnerJourney.startedAt === 0);
check("mac dinh KHONG kich hoat tutorial", r3.data.beginnerJourney.startedAt === 0);

const r4 = sanitizeSave({ beginnerJourney: { startedAt: 1700000000000, skipped: true } });
check("giu skipped = true", r4.data.beginnerJourney.skipped === true);

// ---------------------------------------------------------------- 9. UI
console.log("\n=== 9. UI ===");
check("co container beginnerJourneyContainer", src.includes('id="beginnerJourneyContainer"'));
check("co nut toggle", src.includes('id="btnBeginnerJourneyToggle"'));
check("co buildBeginnerJourneyPanelHtml", src.includes("function buildBeginnerJourneyPanelHtml()"));
check("co renderBeginnerJourneyUI", src.includes("function renderBeginnerJourneyUI()"));
check("render duoc goi trong renderLobbyUI", src.includes("safeRender('beginnerJourney'"));
check("panel co thanh tien do", src.includes('class="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden"'));
check("panel co nut nhan thuong", src.includes('data-bj-claim='));
check("panel co nut bo qua", src.includes('data-bj-skip='));
check("panel co avatar NPC Artemis", src.includes("🐴") && src.includes("Người Dẫn Đường"));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
