// ============================================================================
// DEVIL PACT — ky khe uoc phai GIAM MAU thuc su
//
// LOI TUNG CO: handler chi lam
//     p.maxHp = Math.round(p.maxHp * (1 - costPct / 100));
//     p.hp = Math.min(p.hp, p.maxHp);
// Sau khi diet trum, nguoi choi con it mau (502/1005). maxHp giam ve 774
// nhung hp 502 < 774 nen Math.min KHONG lam gi -> khong mat giot mau nao,
// ty le mau con TANG (50% -> 64.9%). Bao cao: "ky khe uoc khong giam mau".
//
// Test khoa:
//   1. Phai tru ca HP hien tai, khong chi kep tran
//   2. Co san an toan (khong giet nguoi choi khi HP dang thap)
//   3. Chi phi tinh 1 lan, hien thi va tru mau dung cung mot con so
//   4. Rune Devil Pact / Seraph duoc ap dung
// ============================================================================
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); }
}

// ============================================================ 1. TRU HP THAT
console.log('\n=== 1. KY KHE UOC PHAI TRU HP HIEN TAI ===');

const accIdx = src.indexOf("document.getElementById('btnAcceptDevil').addEventListener");
check('tim thay handler btnAcceptDevil', accIdx > 0);
const accBlock = src.slice(accIdx, accIdx + 3000);

check('co tru HP hien tai (beforeHp - lostMaxHp)',
  /beforeHp\s*-\s*lostMaxHp/.test(accBlock));
check('KHONG con chi dung Math.min(hp, maxHp) don thuan',
  !/p\.hp = Math\.min\(p\.hp, p\.maxHp\)\s*;/.test(accBlock));
check('co tinh lostMaxHp = beforeMaxHp - newMaxHp',
  /lostMaxHp\s*=\s*beforeMaxHp\s*-\s*newMaxHp/.test(accBlock));
check('co san an toan (khong giet nguoi choi)',
  /safeFloor/.test(accBlock) && /newMaxHp \* 0\.15/.test(accBlock));
// KP: san an toan khong duoc vuot HP hien tai, neu khong ky khe uoc se HOI mau
check('san an toan khong vuot HP hien tai (khong hoi mau)',
  /safeFloor = Math\.min\(beforeHp/.test(accBlock));
check('co hien thi sat thuong bang float text',
  /spawnFloatText[\s\S]{0,120}?HP.*'#f43f5e'/.test(accBlock));

// ============================================================ 2. CHI PHI 1 LAN
console.log('\n=== 2. CHI PHI TINH 1 LAN, HIEN THI VA TRU CUNG CON SO ===');

check('co ham computeDevilCost dung chung', /function computeDevilCost\(/.test(src));
check('computeDevilCost tra ve pct, costHp, freeReason',
  /return \{[\s\S]{0,150}?pct,[\s\S]{0,150}?costHp:[\s\S]{0,150}?freeReason/.test(src));
check('triggerDevilEncounter dung computeDevilCost',
  /function triggerDevilEncounter\(\)[\s\S]{0,1200}?computeDevilCost\(/.test(src));
check('chi phi duoc chot vao data-devil-cost-pct',
  /data-devil-cost-pct', String\(hpCostPct\)/.test(src));
check('chi phi HP duoc chot vao data-devil-cost-hp',
  /data-devil-cost-hp', String\(costHp\)/.test(src));
check('loi moi hien thi so HP cu the (-N HP)',
  /-\$\{costHp\.toLocaleString/.test(src));

// ============================================================ 3. TY LE GOC
console.log('\n=== 3. TY LE GOC THEO DO HIEM (Wiki 15/23/30) ===');
check('Legend 30%', /=== 'legend' \? 30/.test(src));
check('Epic 23%', /=== 'epic' \? 23/.test(src));
check('Rare 15%', /: 15;/.test(src) || /: 15\b/.test(src));

// ============================================================ 4. RUNE + SERAPH
console.log('\n=== 4. RUNE DEVIL PACT VA SERAPH ===');
check('Seraph mien phi', /hasHeroSkillActive\(p, 'seraph'\)[\s\S]{0,120}?pct = 0/.test(src));
check('Rune Devil Pact duoc kiem tra', /isRuneEquipped\('devil_pact'\)/.test(src));
check('Mythic Enchant mien tru hoan toan',
  /runeMythicEnchant === true[\s\S]{0,150}?copies\(SaveState\.runes\?\.devil_pact\) >= 6[\s\S]{0,120}?pct = 0/.test(src));
check('Blessing thuong giam 50%', /pct = basePct \/ 2/.test(src));

// ============================================================ 5. KHONG GHI DE HAI LAN
console.log('\n=== 5. KHONG CO HANDLER TRUNG ===');
for (const id of ['btnAcceptDevil', 'btnDeclineDevil']) {
  const n = (src.match(new RegExp(`${id}'\\)\\.addEventListener`, 'g')) || []).length;
  check(`${id} chi co DUNG 1 handler`, n === 1);
}

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
