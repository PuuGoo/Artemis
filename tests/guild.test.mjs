// ============================================================================
// BANG HỘI (GUILD) — 6 màn cốt lõi theo bản thật
//
// Bản thật có 41 màn guild (docs/APK_000000_ARCHERO_ANALYSIS.md), cần máy chủ
// nhiều người. Bản web chơi đơn dựng 6 màn cốt lõi với thành viên NPC:
//   camp → guildinfopop(members) → guildboss → guildexpedition →
//   guildrank → guildlog
//
// RỦI RO ĐÃ TRÁNH:
//   1. Log không được phình vô hạn trong save (cap 60 dòng)
//   2. Không cho lập bang khi thiếu vàng, không trừ vàng khi tên sai
//   3. Lực chiến NPC neo theo lực chiến thật → bang luôn vừa sức
//   4. Trùm bang HP theo TỔNG lực bang, mỗi lượt chỉ gây một phần
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

// ============================================================ 1. STATE
console.log('\n=== 1. STATE LUU TRU ===');
check('SaveState co truong guild', /guild: null,/.test(html));
check('bang luu trong save (khong localStorage)', !/localStorage[\s\S]{0,80}guild/.test(html));

// ============================================================ 2. TẠO BANG
console.log('\n=== 2. TAO BANG ===');
const createFn = fnBody('createGuild');
check('co ham createGuild', createFn.length > 100);
check('chan ten ngan hon 3 ky tu', /clean\.length < 3/.test(createFn));
check('chan khi thieu vang', /SaveState\.gold < 5000/.test(createFn));
check('chi tru vang SAU khi qua kiem tra', 
  createFn.indexOf('clean.length < 3') < createFn.indexOf('SaveState.gold -= 5000')
  && createFn.indexOf('SaveState.gold < 5000') < createFn.indexOf('SaveState.gold -= 5000'));
check('tao 12 thanh vien ban dau', /for \(let i = 0; i < 12; i\+\+\)/.test(createFn));
check('chu bang la nguoi choi (idx 0)', /isPlayer: idx === 0/.test(html));
check('HP trum theo TONG luc bang', /members\.reduce\(\(s, m\) => s \+ m\.power, 0\) \* 2\.4/.test(createFn));
check('co goi SaveState.save', /SaveState\.save\(\)/.test(createFn));

// ============================================================ 3. NPC SINH THEO LUC
console.log('\n=== 3. NPC NEO THEO LUC NGUOI CHOI ===');
const mkFn = fnBody('makeGuildMember');
check('co ham makeGuildMember', mkFn.length > 100);
check('NPC sinh tu basePower (khong hardcode)', /basePower \* rankMeta\.power/.test(mkFn));
check('co dao dong tu nhien +-18%', /0\.82 \+ Math\.random\(\) \* 0\.36/.test(mkFn));
check('basePower tinh tu baseAtk that', /baseAtk \|\| 100\) \* 6\.5/.test(createFn));

// ============================================================ 4. LOG KHONG PHINH
console.log('\n=== 4. LOG KHONG PHINH VO HAN ===');
const logFn = fnBody('addGuildLog');
check('co ham addGuildLog', logFn.length > 50);
check('gioi han 60 dong', /length > 60/.test(logFn));
check('cat bot khi vuot', /log\.length = 60/.test(logFn));

// ============================================================ 5. TRUM BANG
console.log('\n=== 5. TRUM BANG ===');
const bossFn = fnBody('startGuildBossFight');
check('co ham startGuildBossFight', bossFn.length > 200);
check('chan khi da ha trum', /boss\.defeated\) return/.test(bossFn));
check('sat thuong nguoi choi tinh tu baseAtk', /stats\.baseAtk \* 55/.test(bossFn));
check('NPC cung gay sat thuong (ca bang cung danh)', /for \(const m of g\.members\)[\s\S]{0,120}?m\.power \* 0\.16/.test(bossFn));
check('ha trum co thuong vang + da quy', /SaveState\.gold \+= bonus[\s\S]{0,80}?SaveState\.gems \+= 120/.test(bossFn));
check('dong gop tang theo sat thuong', /me\.contribution = \(me\.contribution \|\| 0\) \+ Math\.round\(dmg \* 0\.4\)/.test(bossFn));
check('co ghi log', /addGuildLog\(/.test(bossFn));

// ============================================================ 6. VIEN CHINH
console.log('\n=== 6. VIEN CHINH ===');
const expFn = fnBody('renderGuildExpedition');
check('co man vien chinh', expFn.length > 200);
check('do kho tang theo tang', /0\.08 \+ nextFloor \* 0\.012/.test(expFn));
check('chan khi bang chua du manh', /power < needPower/.test(expFn));
check('co luu ky luc tang', /expedition\.best = Math\.max/.test(expFn));

// ============================================================ 7. UI
console.log('\n=== 7. UI ===');
check('co #guildContent trong DOM', /id="guildContent"/.test(html));
check('tab Guild KHONG con la "Sap mo"', !/Bang Hội[\s\S]{0,300}?Sắp mở/.test(html));
check('co man camp (tao bang)', /data-guild-suggest/.test(html) && /btnCreateGuild/.test(html));
check('co 6 nut man con', (html.match(/data-guild-screen="/g) || []).length === 6);
for (const s of ['boss', 'expedition', 'members', 'rank', 'log', 'notice']) {
  check(`co man "${s}"`, new RegExp(`data-guild-screen="${s}"`).test(html));
}
check('co noi dung tieng Viet (Bang Chu / Truong Lao)',
  /Bang Chủ/.test(html) && /Trưởng Lão/.test(html));
check('tab Guild goi renderGuildPanel',
  /targetId === 'tabGuild'[\s\S]{0,80}?renderGuildPanel\(\)/.test(html));

// ============================================================ 8. EXPORT
console.log('\n=== 8. EXPORT ===');
for (const n of ['renderGuildPanel', 'createGuild', 'addGuildLog', 'getGuildTotalPower', 'getGuildLevelInfo']) {
  check(`export ${n}`, new RegExp(`\\n\\s+${n},`).test(html));
}

// ============================================================ 9. MÀN KẾT QUẢ THEO CHẾ ĐỘ
console.log('\n=== 9. MAN KET QUA THEO CHE DO ===');
const dfFn = fnBody('openRunDefeat');
check('openRunDefeat doc Game.mode', /getGameMode\(Game\.mode \|\| 'campaign'\)/.test(dfFn));
check('Vo Tan do do sau', /mode\.id === 'endless'[\s\S]{0,300}?ĐỘ SÂU/.test(dfFn));
check('Thap do tang', /mode\.id === 'tower'[\s\S]{0,300}?TẦNG THÁP/.test(dfFn));
check('San Trum do so trum', /mode\.id === 'bossrush'[\s\S]{0,300}?trùm/.test(dfFn));
check('Luyen Tap khong tinh ky luc', /mode\.id === 'practice'[\s\S]{0,200}?không tính kỷ lục/.test(dfFn));
check('tieu de doi theo che do (KET THUC vs THAT BAI)',
  /mode\.hasChapters \? 'THẤT BẠI' : /.test(dfFn));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
