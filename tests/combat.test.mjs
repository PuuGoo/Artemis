// Test combat formulas: DEF, CRIT DMG, HP clamp, cân bằng quái/boss.
// Chạy: node tests/combat.test.mjs
//
// Vì các hàm combat sống trong <script> inline của index.html (không export),
// test này READ source và (a) kiểm tra công thức tồn tại & đúng hình dạng,
// (b) tính lại công thức bằng JS thuần để đối chiếu số học.
import fs from "node:fs";

const HTML = new URL("../public/index.html", import.meta.url);
const src = fs.readFileSync(HTML, "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ---------------------------------------------------------------- 1. DEF
console.log("\n=== 1. DEF / DAMAGE REDUCTION ===");
check("getComputedStats co tinh defFlat", src.includes("const defFlat = Math.round("));
check("getComputedStats co tinh dmgReduction", src.includes("const dmgReduction ="));
check("defK phu thuoc so phong cua chuong", /const defK = 400 \+ 120 \* /.test(src));
check("dmgReduction chan tren 0.75", /Math\.min\(0\.75, defFlat \/ \(defFlat \+ defK\)\)/.test(src));
check("hurtPlayer nối dmgReduction vào hệ số pipeline, không giữ phép giảm cũ song song",
  src.includes("const coefficientModifiers = [1 - Math.max(0, Math.min(0.75, p.dmgReduction || 0))]") &&
  src.includes("attack:dmg, source, target:p, canCrit") &&
  !src.includes("dmg = Math.max(1, Math.round(dmg * (1 - p.dmgReduction)))"));
check("Game.player duoc gan dmgReduction", src.includes("dmgReduction: stats.dmgReduction || 0"));

// Tính lại công thức để đối chiếu số học
function computeReduction(defFlat, maxRooms) {
  const K = 400 + 120 * maxRooms;
  return Math.min(0.75, defFlat / (defFlat + K));
}
check("DEF 0 -> giam 0%", computeReduction(0, 15) === 0);
check("DEF 100, 15 phong -> ~4.3%", Math.abs(computeReduction(100, 15) - 0.0435) < 0.005,
  (computeReduction(100, 15) * 100).toFixed(2) + "%");
check("DEF 1000, 15 phong -> ~31.3%", Math.abs(computeReduction(1000, 15) - 0.3125) < 0.005,
  (computeReduction(1000, 15) * 100).toFixed(2) + "%");
check("DEF tang don dieu", computeReduction(500, 15) < computeReduction(1500, 15));
check("DEF khong bao gio vuot 75%", computeReduction(1e9, 15) === 0.75);
check("DEF am khong tao reduction am", computeReduction(-50, 15) < 0);

// ---------------------------------------------------------------- 2. CRIT DMG
console.log("\n=== 2. CRIT DMG ===");
check("getComputedStats co critDmgBonus", src.includes("const critDmgBonus = ("));
check("critDmgBonus gom talent", src.includes("(talentTotals.critDmgPct || 0)"));
check("critDmgBonus gom artifact", src.includes("(artifactTotals.critDmgPct || 0)"));
check("critDmgBonus gom hero star global", src.includes("(globalAll.critDmgPct || 0)"));
check("critDmgBonus gom set bonus", src.includes("setBonuses.reduce((n, b) => n + (b.critDmgPct || 0), 0)"));
check("critDmgMult = 1.85 + bonus", src.includes("const critDmgMult = +(1.85 + critDmgBonus).toFixed(3)"));
check("damageEnemy dùng critDmgMult qua SourceData của pipeline (không hardcode finalDmg)",
  src.includes("CritValue: number(entity?.critDmgMult, 1.85)") && src.includes("const hit = applyEnemyCombatHit(e, rawDmg * markMult"));
check("khong con hardcode 'isCrit ? 1.85' o cho tinh finalDmg",
  !/finalDmg = Math\.round\(rawDmg \* \(isCrit \? 1\.85/.test(src));

// ---------------------------------------------------------------- 3. HP clamp
console.log("\n=== 3. HP / NaN / Infinity ===");
check("hurtPlayer chan HP am", src.includes("if (p.hp < 0) p.hp = 0;"));
check("damageEnemy chan NaN o rawDmg", !/e\.hp -= NaN/.test(src));
check("khong con phep nhan 225 * undefined", !src.includes("225 * stats.hero.bonusSpd"));
check("speed co fallback so", src.includes("Number(stats.hero && stats.hero.bonusSpd) || 1"));

// ---------------------------------------------------------------- 4. Cân bằng
console.log("\n=== 4. CAN BANG QUAI / BOSS ===");
// CÂN BẰNG MỚI (Đợt 6): chiến dịch dùng số TUYỆT ĐỐI theo chương, không neo người chơi.
//   quái HP  = CAMPAIGN_TUNING[chương].mobHp × typeMul × (1 + depth*1.2)
//   quái ATK = ...mobAtk × (1 + depth*0.5) / sqrt(count/3)
//   boss HP  = ...bossHp × (1 + depth*0.35)   |  boss ATK = ...bossAtk × (1 + depth*0.3)
// Lý do đổi: đo thật cho thấy neo theo người chơi làm nâng cấp vô nghĩa
// (ATK ×39 → TTK chỉ giảm 1,96×; HP ×25 → số đòn chịu vẫn 16,1). Xem
// docs/audit/artemis-new-player/13-GAME-BALANCE-MEASURED.md và 15-CAMPAIGN-DIFFICULTY.md.
// Vô Tận/Tháp vẫn giữ công thức thích ứng cũ.
check("chien dich dung bang tuyet doi CAMPAIGN_TUNING", /const CAMPAIGN_TUNING = \{/.test(src) &&
  /const campaign = usesCampaignTuning\(\)/.test(src));
check("quai HP chien dich lay tu bang tuyet doi", /campaign\s*\?\s*Math\.max\(1, Math\.round\(campaign\.mobHp \* typeMul\)\)/.test(src));
check("quai ATK chien dich lay tu bang tuyet doi", /campaign\.mobAtk \/ Math\.max\(1, Math\.sqrt\(count \/ 3\)\)/.test(src));
check("Vô Tận vẫn gĩu cong thuc thich ung (quai HP neo playerAtk)", /playerAtk \* typeMul \* baseHits \* scale/.test(src));
check("Vô Tận vẫn giu ATK neo playerMaxHp", /playerMaxHp\s*\/\s*\(16\s*-\s*depth\s*\*\s*10\)/.test(src));
check("Vô Tận vẫn giu duong cong baseHits", /const baseHits = 1\.4 \+ depth \* 1\.0/.test(src));
check("boss chien dich dung bossHp tuyet doi", /campaign\.bossHp/.test(src));
check("boss chien dich dung bossAtk tuyet doi", /campaign\.bossAtk/.test(src));
check("Vô Tận vẫn giu boss HP theo hitsToKill", /playerAtk \* hitsToKill \* chapterMul/.test(src) &&
  /const hitsToKill = roomNum === 5 \? 24 : \(roomNum === 10 \? 30 : 40\)/.test(src));
check("Vô Tận vẫn giu boss ATK theo so don giam dan",
  /playerMaxHp \/ \(roomNum === 5 \? 9 : \(roomNum === 10 \? 7 : 5\)\)/.test(src));
check("quai ATK giam so don chiu duoc khi cang sau", /16 - depth \* 10/.test(src));
check("khong con so tuyet doi 1450 cho boss HP", !src.includes("Math.round(1450 * scale"));
check("khong con so tuyet doi 28 cho quai ATK", !src.includes("atk: Math.round(28 * scale)"));
check("van giu enemyScale theo chuong", src.includes("const chapterMul = Game.chapter.enemyScale || 1"));
check("van giu duong cong tang theo phong", src.includes("const roomMul = 1 + (roomNum - 1) * 0.13"));

// Mô phỏng TTK/TTB để kiểm tra độ khó có ý nghĩa
function simulate(playerMaxHp, playerAtk, playerCrit, critDmg, maxRooms, enemyScale, roomNum) {
  const scale = enemyScale * (1 + (roomNum - 1) * 0.13);
  const count = Math.min(8, 3 + Math.floor(roomNum / 2));
  const avgCrit = 1 + playerCrit * (critDmg - 1);
  const dps = playerAtk * avgCrit; // ~1 đòn/giây (aspd cơ bản)
  const enemyHp = playerAtk * 2.6 * scale;
  const enemyAtk = playerMaxHp * 0.055 * Math.min(2.5, scale) / Math.max(2, count * 0.6);
  const bossHp = playerAtk * 30 * scale;
  const bossAtk = playerMaxHp * 0.075 * Math.min(2.5, scale);
  return {
    ttk: enemyHp / dps,
    hitsToDie: playerMaxHp / enemyAtk,
    bossHits: playerMaxHp / bossAtk,
    ttb: bossHp / dps,
  };
}
const beginner = simulate(75623, 22718, 0.36, 1.85, 15, 1.0, 1);
check("TTK quai phong 1 trong 0.5-3s", beginner.ttk > 0.5 && beginner.ttk < 3,
  beginner.ttk.toFixed(2) + "s");
check("an don lien tuc chet sau >= 15 don o phong 1", beginner.hitsToDie >= 15,
  beginner.hitsToDie.toFixed(1) + " don");
const boss10 = simulate(75623, 22718, 0.36, 1.85, 15, 1.0, 10);
check("boss phong 10 khong chet trong 1 don", boss10.ttb > 3, boss10.ttb.toFixed(2) + "s de ha boss");
check("boss phong 10 giet nguoi choi trong <= 15 don", boss10.bossHits <= 15,
  boss10.bossHits.toFixed(1) + " don");
const lateGame = simulate(500000, 150000, 0.6, 2.4, 10, 2.0, 9);
check("chuong 3 van co TTK hop ly (0.5-6s)", lateGame.ttk > 0.5 && lateGame.ttk < 6,
  lateGame.ttk.toFixed(2) + "s");
check("chuong 3 boss van khong chet tuc thi", lateGame.ttb > 3, lateGame.ttb.toFixed(2) + "s");
// ATK/HP ratio bất biến: trang bị mạnh lên gấp 10 thì TTK không đổi
const strong = simulate(756230, 227180, 0.36, 1.85, 15, 1.0, 1);
check("TTK khong phu thuoc muc trang bi (chi so ATK/HP khong doi)",
  Math.abs(strong.ttk - beginner.ttk) < 0.01,
  `tan thu ${beginner.ttk.toFixed(2)}s vs manh ${strong.ttk.toFixed(2)}s`);
check("so don chiu duoc khong phu thuoc muc trang bi",
  Math.abs(strong.hitsToDie - beginner.hitsToDie) < 0.5);

// ---------------------------------------------------------------- 5. Không cộng trùng
console.log("\n=== 5. KHONG CONG TRUNG CHI SO ===");
// critDmgPct phải xuất hiện đúng 1 lần trong tổng hợp (không cộng 2 lần)
const critBonusBlock = src.slice(src.indexOf("const critDmgBonus = ("), src.indexOf("const critDmgMult"));
const talentMentions = (critBonusBlock.match(/talentTotals\.critDmgPct/g) || []).length;
check("talentTotals.critDmgPct chi xuat hien 1 lan trong critDmgBonus", talentMentions === 1, "gap " + talentMentions);
const artifactMentions = (critBonusBlock.match(/artifactTotals\.critDmgPct/g) || []).length;
check("artifactTotals.critDmgPct chi xuat hien 1 lan", artifactMentions === 1, "gap " + artifactMentions);
// defFlat không được cộng 2 lần
const defBlock = src.slice(src.indexOf("const defFlat = Math.round("), src.indexOf("const defK"));
check("defFlat khong chua dmgReduction (khong tu tham chieu)", !defBlock.includes("dmgReduction"));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
