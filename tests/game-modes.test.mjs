// ============================================================================
// CHẾ ĐỘ CHƠI (game modes)
//
// Bản thật Archero 2 có 15 chế độ (`ui_world_*`). Bản web chơi đơn làm 5 chế
// độ không cần máy chủ nhiều người, tái dùng CÙNG combat engine.
//
// LỖI TỪNG CÓ (tiềm ẩn): luật phòng trùm `room % 5 === 0 || room === maxRooms`
// được viết lặp ở 3 nơi. Thêm chế độ "chỉ đánh trùm" mà sửa 1 nơi là hỏng:
// HUD báo phòng thường trong khi thực tế là trùm, hoặc ngược lại.
//
// Test khoá:
//   1. Có đúng 5 chế độ với cờ hành vi đúng
//   2. isBossRoom là NGUỒN DUY NHẤT quyết định phòng trùm
//   3. maxRooms theo chế độ (chương thật / vô hạn / cố định)
//   4. Luyện Tập không sinh tài nguyên, không chết thật
//   5. Kỷ lục lưu riêng từng chế độ
// ============================================================================
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log(`  PASS  ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
}
function fnBody(name) {
  const s = html.indexOf(`function ${name}(`);
  if (s < 0) return '';
  let d = 0, j = html.indexOf('{', s), e = -1;
  for (let k = j; k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return html.slice(s, e + 1);
}

// ============================================================ 1. ĐỊNH NGHĨA
console.log('\n=== 1. NAM CHE DO CHOI ===');

const modesBlk = html.slice(html.indexOf('const GAME_MODES = ['), html.indexOf('const CHAPTERS = ['));
for (const id of ['campaign', 'endless', 'tower', 'bossrush', 'practice']) {
  check(`co che do "${id}"`, new RegExp(`id: '${id}'`).test(modesBlk));
}
check('Chiến Dịch có chương', /id: 'campaign'[\s\S]{0,400}?hasChapters: true/.test(modesBlk));
check('Vô Tận là vô hạn', /id: 'endless'[\s\S]{0,400}?endless: true/.test(modesBlk));
check('Tháp chỉ đánh trùm', /id: 'tower'[\s\S]{0,400}?bossOnly: true/.test(modesBlk));
check('Săn Trùm chỉ đánh trùm + 5 phòng',
  /id: 'bossrush'[\s\S]{0,500}?bossOnly: true[\s\S]{0,200}?maxRooms: 5/.test(modesBlk));
check('Luyện Tập không thưởng', /id: 'practice'[\s\S]{0,400}?practice: true/.test(modesBlk));
check('moi che do co ten tieng Viet + icon', (modesBlk.match(/name: '[^']+'/g) || []).length === 5
  && (modesBlk.match(/icon: '/g) || []).length === 5);

// ============================================================ 2. PHÒNG TRÙM
console.log('\n=== 2. isBossRoom LA NGUON DUY NHAT ===');

const bossFn = fnBody('isBossRoom');
check('isBossRoom doc Game.mode', /getGameMode\(Game\.mode/.test(bossFn));
check('isBossRoom tra true khi bossOnly', /bossOnly\) return true/.test(bossFn));
check('isBossRoom nhan maxRooms truyen vao', /function isBossRoom\(room, maxRooms\)/.test(bossFn));

// Khong con ban sao luat trum rai rac. Hai cho duoc phep:
//   - than isBossRoom() (block logic)
//   - isBossRoomForBiome() — block VE rieng, khong thay GAME_MODES, chi de to mau
let outside = html.replace(fnBody('isBossRoom'), '').replace(fnBody('isBossRoomForBiome'), '');
const copies = [...outside.matchAll(/\(room(?:Num)? % 5 === 0\) \|\| \(room(?:Num)? === (?:max|Game\.maxRooms)\)/g)];
check('KHONG con ban sao luat phong trum o noi khac', copies.length === 0,
  copies.length ? `con ${copies.length} ban sao` : 'oke');

check('setupRoom dung isBossRoom', /const isBossRoomNow = isBossRoom\(roomNum\)/.test(html));
check('HUD dung isBossRoom', /const isBossRoomHud = isBossRoom\(room, max\)/.test(html));
check('banner dung isBossRoom', /const isBossRm = isBossRoom\(roomNum\)/.test(html));
check('boss_slayer dung isBossRoom', /if \(isBossRoom\(roomNum\) && Game\.player/.test(html));
check('man thua dung isBossRoom', /const bossRoom = isBossRoom\(room, max\)/.test(html));
check('isBossRoom duoc export de test/API', /\n\s+isBossRoom,/.test(html));

// ============================================================ 3. SỐ PHÒNG
console.log('\n=== 3. SO PHONG THEO CHE DO ===');

const startFn = fnBody('startNewRun');
check('startNewRun doc che do', /const mode = getActiveGameMode\(\)/.test(startFn));
check('maxRooms: chương thật / maxRooms chế độ / 9999',
  /mode\.hasChapters[\s\S]{0,160}?ch\.rooms[\s\S]{0,160}?mode\.maxRooms \|\| \(mode\.endless \? 9999/.test(startFn));
check('khong chan chuong khi che do khong co chuong',
  /if \(mode\.hasChapters && isChapterLocked\(ch\)\)/.test(startFn));
check('Game.mode duoc gan', /Game\.mode = mode\.id/.test(startFn));

// ============================================================ 4. LUYỆN TẬP
console.log('\n=== 4. LUYEN TAP KHONG SINH TAI NGUYEN ===');

const finFn = fnBody('finishRun');
check('finishRun doc che do', /const curMode = getGameMode\(Game\.mode/.test(finFn));
check('khong cong vang khi practice', /if \(!curMode\.practice\) \{\s*SaveState\.gold \+= bonusGold/.test(finFn.replace(/\r/g, '')));
check('khong drop gear khi practice', /if \(!curMode\.practice && \(isVictory \|\| Game\.room >= 3\)\)/.test(finFn));

// Chet trong luyen tap -> hoi day mau, khong finishRun(false)
const deathSlice = html.slice(html.indexOf('Luyện Tập: không chết thật'));
check('Luyen Tap khong chet that (hoi day mau)',
  /practice\) \{[\s\S]{0,400}?p\.hp = p\.maxHp/.test(deathSlice));
check('Luyen Tap khong goi finishRun(false)',
  !/practice\) \{[\s\S]{0,300}?finishRun\(false\)/.test(deathSlice));

// ============================================================ 5. KỶ LỤC + THẮNG
console.log('\n=== 5. KY LUC + DIEU KIEN THANG ===');

check('co modeBest trong save', /modeBest: \{\}/.test(html));
check('ghi ky luc theo che do', /SaveState\.modeBest\[modeRec\.id\] = Game\.room/.test(finFn));
check('Chiến Dịch đo bằng bestRooms, không ghi modeBest',
  /modeRec\.id !== 'campaign'/.test(finFn));
check('chi Chien Dich moi mo man pha dao chuong',
  /if \(winMode\.hasChapters\) \{/.test(finFn));
check('che do khac hien tong ket rieng',
  /HOÀN THÀNH \$\{winMode\.name\.toUpperCase\(\)\}/.test(finFn));

// ============================================================ 6. UI
console.log('\n=== 6. UI CHON CHE DO ===');

check('co #gameModePanel trong DOM', /id="gameModePanel"/.test(html));
check('renderGameModePanel ton tai', /function renderGameModePanel\(\)/.test(html));
const modeUi = fnBody('renderGameModePanel');
check('render 5 the', /GAME_MODES\.map\(m =>/.test(modeUi));
check('bam the doi SaveState.gameMode', /SaveState\.gameMode = id/.test(modeUi));
check('hien ky luc neu co', /Kỷ lục: phòng/.test(modeUi));
check('duoc goi trong render lobby', /safeRender\('gameMode'/.test(html));
check('dai chon chuong cu luon an va rong',
  /el\.classList\.add\('hidden'\);\s*el\.innerHTML = '';/.test(fnBody('renderChapterSelectStrip')));
check('che do khac khong tao nut Bat dau trung', !/id="btnStartModeRun"/.test(html));
check('briefing cho moi che do goi startNewRun', /btnBriefingStart[\s\S]{0,200}?startNewRun\('fresh'\)/.test(html));

// ============================================================ 7. EXPORT
console.log('\n=== 7. EXPORT ===');
for (const n of ['renderGameModePanel', 'GAME_MODES', 'getGameMode', 'getActiveGameMode']) {
  check(`export ${n}`, new RegExp(`\\n\\s+${n},`).test(html));
}

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
