// Regression tests cho Hang Vàng — mode tài nguyên mới, không đổi combat core.
import fs from 'node:fs';
import { sanitizeSave } from '../lib/saveSchema.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? ' -> ' + extra : '')); }
}
function fnBody(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) return '';
  const open = html.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return '';
}
function blockAfter(marker, nextMarker) {
  const start = html.indexOf(marker);
  if (start < 0) return '';
  const end = html.indexOf(nextMarker, start + marker.length);
  return html.slice(start, end < 0 ? html.length : end);
}

console.log('\n=== 1. MODE CONFIG ===');
const modes = blockAfter('const GAME_MODES = [', '\n      ];');
check('Hang Vàng được đăng ký đúng một lần', (modes.match(/id: 'goldcave'/g) || []).length === 1);
check('Hang Vàng có đúng 5 phòng', /id: 'goldcave',[\s\S]{0,450}?maxRooms: 5/.test(modes));
check('Hang Vàng không phụ thuộc mở khóa chương', /id: 'goldcave',[\s\S]{0,250}?hasChapters: false/.test(modes));
check('Hang Vàng dùng boss cuối theo luật phòng hiện tại', /id: 'goldcave',[\s\S]{0,350}?bossOnly: false/.test(modes));
check('Hang Vàng có hệ số vàng x3', /id: 'goldcave',[\s\S]{0,500}?goldMultiplier: 3/.test(modes));

console.log('\n=== 2. REUSE EXISTING COMBAT ===');
check('setupRoom vẫn dùng isBossRoom duy nhất', /const isBossRoomNow = isBossRoom\(roomNum\)/.test(fnBody('setupRoom')));
check('startNewRun lấy maxRooms từ cấu hình mode', /mode\.maxRooms \|\|/.test(fnBody('startNewRun')));
check('không có combat engine riêng cho Hang Vàng', !/function (?:goldCaveCombat|updateGoldCaveCombat|damageGoldCaveEnemy)\(/.test(html));

console.log('\n=== 3. GOLD-ONLY REWARDS ===');
const update = fnBody('updateGame');
check('hệ số chỉ áp dụng khi mode goldOnly', /goldMode\.goldOnly \? \(goldMode\.goldMultiplier \|\| 1\) : 1/.test(update));
check('giữ nguyên goldBonus của nhân vật', /d\.val \* \(1 \+ \(p\.goldBonus \|\| 0\)\) \* modeGoldMultiplier/.test(update));
const finish = fnBody('finishRun');
check('không thưởng vàng kết thúc ngoài vàng nhặt được', /curMode\.goldOnly \? 0 : \(isVictory/.test(finish));
check('không cấp gems trong Hang Vàng', /if \(!curMode\.goldOnly\) SaveState\.gems \+= bonusGems/.test(finish));
check('không rơi trang bị ngẫu nhiên trong Hang Vàng', /!curMode\.practice && !curMode\.goldOnly && \(isVictory/.test(finish));
check('không tăng winsByChapter hoặc kích hoạt beginner clear', /if \(!curMode\.goldOnly\) \{[\s\S]{0,450}?BeginnerHooks/.test(finish));
check('có màn kết quả riêng khi thắng Hang Vàng', /winMode\.goldOnly[\s\S]{0,200}?Thu thập/.test(finish));
check('có màn kết quả riêng khi thua Hang Vàng', /if \(curMode\.goldOnly\)[\s\S]{0,250}?HANG VÀNG KẾT THÚC/.test(finish));

console.log('\n=== 4. KEEP CAMPAIGN PROGRESS SEPARATE ===');
const roomRecord = blockAfter('// Chỉ Chiến Dịch mới cập nhật kỷ lục chương.', 'const isBossRoomNow');
check('chỉ campaign ghi bestRooms', /Game\.mode \|\| 'campaign'\) === 'campaign'/.test(roomRecord));
check('modeBest vẫn lưu kỷ lục riêng', /SaveState\.modeBest\[modeRec\.id\] = Game\.room/.test(finish));

console.log('\n=== 5. SERVER SAVE WHITELIST ===');
const save = sanitizeSave({ gameMode: 'goldcave', modeBest: { goldcave: 5, campaign: 15, unknown: 999 } });
check('server schema giữ gameMode goldcave', save.ok && save.data.gameMode === 'goldcave');
check('server schema giữ kỷ lục Hang Vàng', save.ok && save.data.modeBest.goldcave === 5);
check('server schema vẫn giữ kỷ lục campaign', save.ok && save.data.modeBest.campaign === 15);
check('server schema loại modeBest không hợp lệ', save.ok && !Object.prototype.hasOwnProperty.call(save.data.modeBest, 'unknown'));
const legacy = sanitizeSave({});
check('save cũ không có mode vẫn mặc định campaign', legacy.ok && legacy.data.gameMode === 'campaign');

console.log('\n================ ' + pass + ' PASS / ' + fail + ' FAIL ================\n');
process.exit(fail > 0 ? 1 : 0);
