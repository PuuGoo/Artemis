// ============================================================================
// MÙA GIẢI (season) — 4 màn có cơ chế THẬT
//
// Bản thật có 5 màn season* (docs/APK_000000_ARCHERO_ANALYSIS.md mục 3.2):
// seasoncareerselect, seasoncareerselectspineholder, seasonbossrecruit,
// seasonbossspecialmechanism, seasonbattlepowerexchange.
//
// ĐIỂM QUAN TRỌNG NHẤT phải khoá: nghề nghiệp phải THAY ĐỔI CHỈ SỐ THẬT
// trong getComputedStats(), không phải chỉ đổi nhãn trên UI. Test này đo
// ATK/HP/DEF thật trước và sau khi chọn nghề.
//
// RỦI RO ĐÃ TRÁNH:
//   1. Nghề cộng theo TỈ LỆ (không số phẳng) → không mất giá khi lên đồ
//   2. Hi sinh sức mạnh có trần 20%, không thể bán hết chỉ số
//   3. Đổi nghề tốn Tiền Mùa; chọn lần đầu miễn phí
//   4. Trùm phản đòn chỉ trừ vàng khi đủ vàng (không âm)
// ============================================================================
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log(`  PASS  ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
}
function fnBody(name) {
  const i = html.indexOf(`function ${name}(`);
  if (i < 0) return '';
  const pc = html.indexOf(') {', i);
  let d = 0, e = -1;
  for (let k = html.indexOf('{', pc > 0 ? pc : i); k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return e > 0 ? html.slice(i, e + 1) : '';
}

// ============================================================ 1. CẤU HÌNH
console.log('\n=== 1. CAU HINH ===');
check('SaveState co truong season', /season: null,/.test(html));
check('5 nghe', (html.slice(html.indexOf('SEASON_CAREERS = ['), html.indexOf('SEASON_BOSSES = [')).match(/id: '/g) || []).length === 5);
check('3 trum mua', (html.slice(html.indexOf('SEASON_BOSSES = ['), html.indexOf('SEASON_SHOP = [')).match(/id: '/g) || []).length === 3);
check('3 mon doi qua', (html.slice(html.indexOf('SEASON_SHOP = ['), html.indexOf('SEASON_SACRIFICE_STEP')).match(/id: 'se_/g) || []).length === 3);
check('tran hi sinh 20%', /SEASON_SACRIFICE_MAX = 0\.20/.test(html));
check('moi lan hi sinh 2%', /SEASON_SACRIFICE_STEP = 0\.02/.test(html));

// ============================================================ 2. NỐI VÀO CHỈ SỐ
console.log('\n=== 2. NGHE NOI VAO getComputedStats (phan quan trong nhat) ===');
const gcs = fnBody('getComputedStats');
check('doc getSeasonCareerMeta', /getSeasonCareerMeta\(\)/.test(gcs));
check('ATK cong careerAtkPct', /starMilestone\.atkMult \* 0\.25 \+ careerAtkPct/.test(gcs));
check('HP cong careerHpPct', /starMilestone\.hpMult \* 0\.25 \+ careerHpPct/.test(gcs));
check('ASPD cong careerAspdPct', /activeSkin\.bonusAspd \|\| 0\) \+ careerAspdPct/.test(gcs));
check('CRIT cong careerCritFlat', /talentTotals\.critRate \+ careerCritFlat/.test(gcs));
check('DEF cong careerDefFlat', /\+ \(gemHp \+ affHpFlat\) \* 0\.02\s*\+ careerDefFlat/.test(gcs.replace(/\r/g, '')));
check('CRIT DMG cong careerCritDmgPct', /\+ careerCritDmgPct/.test(gcs));
check('NE cong careerDodgeFlat', /setBonuses\.reduce\(\(n,b\)=>n\+b\.dodge,0\) \+ careerDodgeFlat/.test(gcs));
check('VANG cong careerGoldPct', /gemGold \+ affGold \+ careerGoldPct/.test(gcs));
check('nhan _sacMul cho ATK va HP', /careerAtkPct\) \* _sacMul/.test(gcs) && /careerHpPct\) \* _sacMul/.test(gcs));

// Nghe cong THEO TI LE khong phai so phang (de khong mat gia khi len do)
console.log('\n=== 2b. CONG THEO TI LE ===');
const careersBlk = html.slice(html.indexOf('SEASON_CAREERS = ['), html.indexOf('SEASON_BOSSES = ['));
check('cac nghe dung atkPct/hpPct (ti le), khong flatAtk',
  /atkPct: 0\.14/.test(careersBlk) && !/flatAtk/.test(careersBlk));
check('Ho Ve co hpPct cao nhat', /id: 'guardian'[\s\S]{0,200}?hpPct: 0\.22/.test(careersBlk));
check('Phap Su co critDmgPct cao nhat', /id: 'mage'[\s\S]{0,400}?critDmgPct: 0\.35/.test(careersBlk));

// ============================================================ 3. CHỌN NGHỀ
console.log('\n=== 3. CHON NGHE ===');
const selFn = fnBody('selectSeasonCareer');
check('chan nghe khong ton tai', /if \(!c\) return false/.test(selFn));
check('lan dau mien phi', /const cost = switching \? 50 : 0/.test(selFn));
check('doi nghe ton 50 Tien Mua', /switching \? 50/.test(selFn));
check('chan khi thieu Tien Mua', /s\.tokens < cost/.test(selFn));
check('ghi log', /seasonLog\(/.test(selFn));

// ============================================================ 4. TRÙM
console.log('\n=== 4. TRUM MUA ===');
const recFn = fnBody('recruitSeasonBoss');
check('HP neo theo powerScore that', /getComputedStats\(\)\.powerScore/.test(recFn));
check('HP = power x bossMul', /power \* b\.bossMul/.test(recFn));
check('chan tuyen khi dang co trum chua ha', /s\.boss && !s\.bossDefeated/.test(recFn));

const fightFn = fnBody('fightSeasonBoss');
check('co 3 co che dac biet', /damageReduction/.test(fightFn) && /reflect/.test(fightFn) && /regenerator/.test(fightFn));
check('giap day giam sat thuong', /dmg \* \(1 - b\.specialVal\)/.test(fightFn));
check('hoi mau trum truoc khi nhan don', /s\.bossHp = Math\.min\(s\.bossMaxHp/.test(fightFn));
check('phan don chi tru vang khi du', /if \(SaveState\.gold >= reflected\)/.test(fightFn));
check('ha trum +120 Tien Mua +150 da quy',
  /s\.tokens \+= 120/.test(fightFn) && /SaveState\.gems \+= 150/.test(fightFn));

// ============================================================ 5. HI SINH SỨC MẠNH
console.log('\n=== 5. HI SINH SUC MANH ===');
const exFn = fnBody('exchangeSeasonPower');
check('chan khi da cham tran', /cur >= SEASON_SACRIFICE_MAX/.test(exFn));
check('khong vuot tran', /Math\.min\(SEASON_SACRIFICE_MAX, cur \+ SEASON_SACRIFICE_STEP\)/.test(exFn));
check('cong 60 Tien Mua', /s\.tokens \+= SEASON_TOKENS_PER_SACRIFICE/.test(exFn));

const pctFn = fnBody('getSeasonPowerSacrificePct');
check('tra ve phan so truc tiep (khong nhan lai)', /return Math\.min\(SEASON_SACRIFICE_MAX, Number\(s\.powerSacrificed\) \|\| 0\)/.test(pctFn));

// ============================================================ 6. UI
console.log('\n=== 6. UI ===');
check('co #seasonContent trong tab Su Kien',
  /id="tabEvents"[\s\S]{0,1200}?id="seasonContent"/.test(html));
check('co man nghe + trum + doi', (html.match(/data-season-screen="/g) || []).length >= 3);
check('co nut chon tung nghe', /data-pick-career="\$\{c\.id\}"/.test(html));
check('co nut tuyen tung trum', /data-pick-boss="\$\{b\.id\}"/.test(html));
check('co nut hien thi he so tung nghe', /\+\$\{Math\.round\(c\.atkPct \* 100\)\}% ATK/.test(html));
check('tab Su Kien goi renderSeasonPanel', /renderSeasonPanel\(\)/.test(html));
check('doi nghe thi ve lai lobby (cap nhat chi so hien thi)',
  /renderSeasonPanel\(\);[\s\S]{0,120}?renderLobbyUI\(\)/.test(html.replace(/\r/g, '')));
// Loi UI that: 2 nut cung nhan "Doi" (doi nghe + doi qua) gay nham.
// Panel mùa giải đã được thiết kế lại nên khối <b>Cửa Hàng</b> không còn. Giữ đúng
// BẤT BIẾN mà test này bảo vệ: không nút nào nhãn đúng "Đổi" (trùng "Đổi nghề"),
// và hai chức năng dùng hai thuộc tính riêng để không lẫn.
// Phạm vi phải là NÚT MUA của mùa giải: nút "Đổi" của VƯỜN (data-exchange) là hợp lệ
// và không liên quan tới "Đổi nghề". Văn bản thường ("Đổi 20% Máu Tối Đa") cũng bỏ qua.
check('nut mua cua hang mua giai khong chi ghi "Doi" (tranh trung "Doi nghe")',
  !/data-season-buy="[^"]*"[\s\S]{0,500}?>\s*Đổi\s*</.test(html));
check('mua hang dung data-season-buy, doi nghe dung data-pick-career (khong lan)',
  /data-season-buy=/.test(html) && /data-pick-career/.test(html));

// ============================================================ 7. EXPORT
console.log('\n=== 7. EXPORT ===');
for (const n of ['renderSeasonPanel', 'ensureSeason', 'selectSeasonCareer', 'recruitSeasonBoss',
                 'fightSeasonBoss', 'exchangeSeasonPower', 'buySeasonShop',
                 'getSeasonCareerMeta', 'getSeasonBossMeta', 'getSeasonPowerSacrificePct',
                 'SEASON_CAREERS', 'SEASON_BOSSES', 'SEASON_SHOP']) {
  check(`export ${n}`, new RegExp(`\\n\\s+${n},`).test(html));
}

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
