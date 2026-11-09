// ============================================================================
// MÀN THẺ + KHUNG 6 TAB (theo kiến trúc Archero 2 thật)
//
// LỖI TỪNG CÓ: sao rỗng "☆" được tô màu vàng đậm (text-amber-300) nên nhìn
// như sao ĐẦY. Thẻ Alex 0★ hiện thành "6 sao vàng" — người xem tưởng hero
// đã lên 6 sao trong khi panel ghi 0★. Sai lệch thông tin nghiêm trọng.
//
// Test khoá:
//   1. 6 tab đúng chuẩn bản thật (uimainbattle/card/equip/activity/shop/guild)
//   2. Sao rỗng phải màu mờ, sao đầy mới vàng
//   3. renderHeroRoster đọc sao từ getHeroStarLevel, không hardcode
//   4. Panel chi tiết khớp với thẻ
// ============================================================================
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log(`  PASS  ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
}

// ============================================================ 1. SÁU TAB
console.log('\n=== 1. KHUNG 6 TAB THEO BAN THAT ===');

const navIds = html.match(/const NAV_TAB_IDS = \[([^\]]+)\]/);
check('co hang so NAV_TAB_IDS', !!navIds);
if (navIds) {
  const ids = navIds[1].match(/'tab[A-Za-z]+'/g).map(s => s.replace(/'/g, ''));
  check('dung 6 tab', ids.length === 6, ids.join(','));
  for (const want of ['tabBattle', 'tabHeroes', 'tabEquip', 'tabEvents', 'tabShopVn', 'tabGuild']) {
    check(`co ${want}`, ids.includes(want));
  }
}
check('luoi nav dung grid-cols-6', /bottomNavBar[\s\S]{0,300}?grid-cols-6/.test(html));
check('moi tab co section tuong ung',
  ['tabHeroes', 'tabGuild'].every(id => new RegExp(`id="${id}"`).test(html)));
check('tab Bang Hoi da lam that (khong con "Sap mo")',
  /id="guildContent"/.test(html) && !/Bang Hội[\s\S]{0,300}?Sắp mở/.test(html));
check('KHONG con nhan "SOON" tieng Anh', !/>SOON</.test(html));

// ============================================================ 2. SAO RONG ≠ SAO DAY
console.log('\n=== 2. SAO RONG PHAI MO, SAO DAY MOI VANG ===');

const rosterStart = html.indexOf('function renderHeroRoster() {');
check('tim thay renderHeroRoster', rosterStart > 0);
// Lấy đúng biên hàm bằng cân bằng ngoặc, không cắt theo số ký tự
// (hàm dài ra sau mỗi lần thêm tính năng nên offset cố định sẽ sai).
const rosterBody = (() => {
  let d = 0, j = html.indexOf('{', rosterStart), e = -1;
  for (let k = j; k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return html.slice(rosterStart, e + 1);
})();
check('lay duoc than ham renderHeroRoster', rosterBody.length > 2000, rosterBody.length + ' ky tu');

// KP: sao rong phai nam trong span mau mo (slate), khong phai amber
check('sao rong dung mau mo (slate-600/500), KHONG phai amber',
  /'☆'\.repeat[\s\S]{0,50}?text-slate-600|text-slate-600[\s\S]{0,80}?'☆'/.test(rosterBody));
check('sao day dung mau vang (amber-300)',
  /text-amber-300[\s\S]{0,60}?'★'/.test(rosterBody));

// KP: khong con cho nao to ca chuoi stars bang amber (loi cu)
check('KHONG to ca chuoi sao bang mot mau amber duy nhat',
  !/<i class="block text-\[8px\] text-amber-300[^>]*>\$\{starStr\}<\/i>/.test(rosterBody));
check('khong con bien starStr (da bo)',
  !/const starStr =/.test(rosterBody));

check('khi 0 sao hien ro "0★" chu khong chi sao rong',
  /0★ · /.test(rosterBody));

// ============================================================ 3. DOC TU SAVE
console.log('\n=== 3. SAO DOC TU SAVE, KHONG HARDCODE ===');

check('renderHeroRoster dung getHeroStarLevel',
  /getHeroStarLevel\(h\.id\)/.test(rosterBody));
check('panel chi tiet cung dung getHeroStarLevel',
  /const stars = getHeroStarLevel\(hero\.id\)/.test(rosterBody));
check('moi card deu co data-hero-pick', /data-hero-pick="\$\{h\.id\}"/.test(rosterBody));
check('bam the doi selectedHeroId', /SaveState\.selectedHeroId = id/.test(rosterBody));

// ============================================================ 3b. HERO CHUA SO HUU
console.log('\n=== 3b. HERO CHUA SO HUU PHAI BI KHOA ===');

check('co ham isHeroOwned', /function isHeroOwned\(heroId\)/.test(html));
check('owned = 1 sao tro len, hoac dang xuat chien',
  /function isHeroOwned[\s\S]{0,600}?getHeroStarLevel\(heroId\) >= 1[\s\S]{0,400}?heroId === SaveState\.selectedHeroId/.test(html));
check('card chua so huu co data-locked', /data-locked="1"/.test(rosterBody));
check('card chua so huu hien o khoa 🔒', /owned \? \(h\.spriteEmoji/.test(rosterBody) && /🔒/.test(rosterBody));
check('card chua so huu bi lam mo (opacity/grayscale)', /opacity-60 grayscale/.test(rosterBody));
check('bam hero chua so huu thi bao, KHONG doi hero',
  /if \(!isHeroOwned\(id\)\) \{[\s\S]{0,300}?return;/.test(rosterBody));
check('thong bao neu ro so shard can va dang co',
  /chưa mở khoá — cần[\s\S]{0,80}?mảnh/.test(rosterBody));
check('panel chi tiet hien nhan CHUA SO HUU', /CHƯA SỞ HỮU/.test(rosterBody));
check('getAllUnlockedSkinBonuses dung isHeroOwned (khong trung logic)',
  /function getAllUnlockedSkinBonuses[\s\S]{0,500}?isHeroOwned\(h\.id\)/.test(html));

// ============================================================ 4. PANEL CHI TIET
console.log('\n=== 4. PANEL CHI TIET DAY DU ===');

check('hien moc sao (ms.name)', /\$\{ms\.name\}/.test(rosterBody));
check('hien mo ta perk (ms.perkDesc)', /\$\{ms\.perkDesc\}/.test(rosterBody));
check('chỉ một studio nâng sao trong chi tiết roster', (html.match(/data-hero-upgrade-disclosure=/g)||[]).length === 1 && /id="charHeroStatsStarSkinPanel"/.test(html));
check('không còn nút nâng sao thứ hai trong roster', !/btnUpgradeStar/.test(rosterBody));
check('studio vẫn hiển thị mảnh và chi phí', /nextMilestone.shardCost/.test(html) && /nextMilestone.goldCost/.test(html));
check('studio gọi upgradeHeroStar qua handler thật', /upgradeHeroStar\(btn.getAttribute\('data-upgrade-star-hero'\)\)/.test(html));

// ============================================================ 5. RESPONSIVE
console.log('\n=== 5. RESPONSIVE ===');

check('luoi the: 2 cot mobile, 3 sm, 4 lg',
  /grid-cols-2 sm:grid-cols-3 lg:grid-cols-4/.test(html));
check('nav tab khong tran ngang tren mobile (text nho + gap nho)',
  /grid-cols-6 gap-0\.5/.test(html));

// ============================================================ 6. EXPORT
console.log('\n=== 6. EXPORT CHO DEBUG/API ===');
check('export renderHeroRoster', /renderHeroRoster,/.test(html));
check('export gotoNavTab', /gotoNavTab,/.test(html));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
