// ============================================================================
// BOSS HP HUD — thanh mau tru phai tuot khi trum nhan sat thuong
//
// LOI TUNG CO: updateInGameHUD() chi duoc goi ben trong nhanh GIOET QUAI
// (sau `Game.enemies = Game.enemies.filter(en => en.hp > 0)` trong damageEnemy).
// Trum con song => khong quai nao chet => HUD khong bao gio cap nhat.
// Nguoi choi danh trum thay so sat thuong bay len nhung thanh mau dung yen
// o 100% cho toi luc trum chet. Bao cao nguoi dung: "mau boss ko tuot khi
// nhan sat thuong".
//
// Test nay khoa o 3 tang:
//   1. updateGame() phai goi updateInGameHUD() moi frame (khong phu thuoc quai chet)
//   2. updateInGameHUD() phai doc boss.hp va ghi vao #bossHpNumbers / #bossHpBar
//   3. Khong duoc con duong nao ghi HP boss ma bo qua HUD
// ============================================================================
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); }
}

// ============================================================ 1. HUD MOI FRAME
console.log('\n=== 1. HUD CAP NHAT MOI FRAME ===');

// Lay than updateGame
const ugStart = html.indexOf('      function updateGame(dt) {');
check('tim thay updateGame', ugStart > 0);

// HUD phai nam CUOI updateGame (sau khi damage trong frame da ap dung),
// khong phai dau ham (se tre 1 frame).
const ugEnd = (() => {
  let d = 0, j = html.indexOf('{', ugStart), e = -1;
  for (let k = j; k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return e;
})();
check('tim thay than updateGame', ugEnd > ugStart);
const ugBody = html.slice(ugStart, ugEnd + 1);
const hudCallIdx = ugBody.lastIndexOf('updateInGameHUD();');
check('updateGame co goi updateInGameHUD()', hudCallIdx > 0);
check('loi goi HUD nam o CUOI updateGame (khong tre 1 frame)',
  hudCallIdx > ugBody.length - 700);

// KP: HUD khong duoc chi nam trong damageEnemy sau filter
const dmgStart = html.indexOf('      function damageEnemy(');
check('tim thay damageEnemy', dmgStart > 0);
const dmgSection = html.slice(dmgStart, dmgStart + 16000);
const filterIdx = dmgSection.indexOf('Game.enemies = Game.enemies.filter(en => en.hp > 0);');
const hudAfterFilter = dmgSection.indexOf('updateInGameHUD();', filterIdx);
check('damageEnemy van goi HUD sau khi don quai chet (giu duong cu)',
  filterIdx > 0 && hudAfterFilter > filterIdx);

// ============================================================ 2. HUD DOC BOSS.HP
console.log('\n=== 2. HUD DOC boss.hp VA GHI DUNG ELEMENT ===');

const hudStart = html.indexOf('      function updateInGameHUD() {');
check('tim thay updateInGameHUD', hudStart > 0);
const hudBody = html.slice(hudStart, hudStart + 4000);

check('tim boss qua isBoss',
  /Game\.enemies\.find\(e => e\.isBoss\)/.test(hudBody));
check('ghi boss.hp vao #bossHpNumbers',
  /getElementById\('bossHpNumbers'\)\.textContent\s*=\s*`?\$\{[^}]*boss\.hp/.test(hudBody));
check('ghi ti le boss.hp/boss.maxHp vao width #bossHpBar',
  /getElementById\('bossHpBar'\)\.style\.width\s*=\s*`?\$\{[^}]*boss\.hp \/ boss\.maxHp/.test(hudBody));
check('co clamp Math.max(0, ...) cho boss.hp (khong am)',
  /bossHpNumbers[\s\S]{0,200}?Math\.max\(0/.test(hudBody));
check('co clamp 100% tran tren (khong tran thanh)',
  /bossHpBar[\s\S]{0,200}?Math\.max\(0,\s*\(boss\.hp \/ boss\.maxHp\)/.test(hudBody));

// ============================================================ 3. MOI DUONG GHI HP
console.log('\n=== 3. MOI CHO TRU HP DEU QUA damageEnemy ===');

// Tru HP truc tiep ngoai damageEnemy la loi: khong co hitFlash, khong HUD,
// khong float text. Cho phep trong damageEnemy va cac passive AoE noi bo.
const directHpWrites = [...html.matchAll(/\.hp\s*-=\s*/g)].length;
check('so cho tru HP truc tiep co kiem soat (< 30)', directHpWrites < 30);

// Khong duoc co cho nao set boss.hp = maxHp (hoi mau boss)
check('khong co code hoi mau boss',
  !/isBoss[\s\S]{0,120}?\.hp\s*=\s*[a-z]*\.?maxHp/.test(html));

// ============================================================ 4. KHONG DUPLICATE ID
console.log('\n=== 4. KHONG TRUNG ID (HUD ghi nham cho) ===');
for (const id of ['bossHpNumbers', 'bossHpBar', 'bossHudContainer', 'bossNameText']) {
  const n = (html.match(new RegExp(`id="${id}"`, 'g')) || []).length;
  check(`id "${id}" xuat hien dung 1 lan`, n === 1);
}

// ============================================================ 5. PERFORMANCE
console.log('\n=== 5. KHONG REBUILD DOM VO ICH MOI FRAME ===');
check('skill strip co guard _lastSig (khong innerHTML moi frame)',
  /strip\._lastSig !== skillSig/.test(html));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
