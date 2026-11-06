// ============================================================================
// TÂN THỦ BẮT ĐẦU TAY KHÔNG
//
// Yêu cầu: tài khoản mới KHÔNG có gear, runes, artifacts, talent card;
// nhân vật mặc định là Alex.
//
// Lỗi từng có: createDefaultEquipped() tặng sẵn 6 món common Lv.1
// (rusty_bow, wooden_charm, copper_ring, cloth_vest, leather_cap,
// worn_boots) và selectedHeroId = 'artemis'.
//
// Test khoá 3 tầng:
//   1. Default state đúng (gear null, hero alex, runes/artifacts/talents 0)
//   2. Không có đường nào tự điền lại gear đã bỏ
//   3. Có đường nhận vũ khí đầu tiên (nếu không người chơi kẹt vĩnh viễn)
// ============================================================================
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../lib/saveSchema.js', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); }
}

// ============================================================ 1. DEFAULT EQUIPPED
console.log('\n=== 1. TAN THU KHONG CO GEAR ===');

const eqStart = html.indexOf('function createDefaultEquipped()');
check('tim thay createDefaultEquipped', eqStart > 0);
const eqBody = html.slice(eqStart, eqStart + 700);

for (const slot of ['weapon', 'necklace', 'ring', 'armor', 'helmet', 'boots']) {
  check(`slot ${slot} = null`, new RegExp(`${slot}:\\s*null`).test(eqBody));
}
check('KHONG con makeStarterItem trong default equipped',
  !/makeStarterItem/.test(eqBody));
check('KHONG con rusty_bow/wooden_charm/... trong default',
  !/rusty_bow|wooden_charm|copper_ring|cloth_vest|leather_cap|worn_boots/.test(eqBody));

// ============================================================ 2. BAG + PRESETS
console.log('\n=== 2. TUI DO RONG + PRESET KHONG TRO UID CHET ===');

const bagStart = html.indexOf('function createDefaultBag()');
const bagBody = html.slice(bagStart, bagStart + 300);
check('createDefaultBag tra ve []', /return \[\];/.test(bagBody));

const presetStart = html.indexOf('function createDefaultPresets()');
// Bỏ comment trước khi kiểm tra: comment có nhắc 'eq_w1' để giải thích
// tại sao KHÔNG dùng UID đó, không phải code thật.
const presetBody = html.slice(presetStart, presetStart + 900)
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
check('KHONG con preset tro eq_w1/eq_n1/... (UID khong ton tai)',
  !/eq_w1|eq_n1|eq_r1|eq_a1|eq_h1|eq_b1/.test(presetBody));
check('ca 3 preset deu null', (presetBody.match(/weapon:\s*null/g) || []).length === 3);

// ============================================================ 3. HERO MAC DINH
console.log('\n=== 3. NHAN VAT MAC DINH = ALEX ===');

check('SaveState.selectedHeroId = alex',
  /selectedHeroId:\s*'alex'/.test(html));
check('server schema default cung la alex',
  /safeId\(raw\.selectedHeroId\) \|\| "alex"/.test(schema));
check('Alex khong co sao mac dinh (tranh bonus moc sao 1*)',
  /alex:\s*0/.test(html.slice(html.indexOf('heroStars: {'))));
check('Artemis ve 0 sao (khong con la hero mac dinh)',
  /artemis:\s*0/.test(html.slice(html.indexOf('heroStars: {'))));
check('hero skill van chay o 0* (chi so hero.id)',
  /function hasHeroSkillActive[\s\S]{0,300}?p\.hero\.id === checkHeroId/.test(html));

// ============================================================ 4. RUNES/ARTIFACTS/TALENTS = 0
console.log('\n=== 4. RUNES, ARTIFACTS, TALENT CARD = 0 ===');

const runesStart = html.indexOf('runes: {');
const runesBody = html.slice(runesStart, runesStart + 250);
check('moi rune default = 0',
  !/rune_[a-z]+:\s*[1-9]/.test(runesBody));

const talentsStart = html.indexOf('        talents: {');
const talentsEnd = html.indexOf('        },', talentsStart) + 10;
const talentsBody = html.slice(talentsStart, talentsEnd);
check('moi talent card default = 0',
  !/[a-z_]+:\s*[1-9]\d*/.test(talentsBody),
  `${(talentsBody.match(/[a-z_]+:\s*\d+/g) || []).length} card`);

check('artifact default 0 sao (getArtifactStarLevel tra 0 khi thieu)',
  /function getArtifactStarLevel[\s\S]{0,600}?return 0;/.test(html));

// ============================================================ 5. KHONG TU DIEN LAI GEAR
console.log('\n=== 5. KHONG DUONG NAO TU DIEN LAI GEAR ===');

// normalizeLoadedGear tung co `normEq || defaultEq[slotKey]` -> luon nhet lai item
const normStart = html.indexOf('normalizeLoadedGear() {');
// Bỏ comment: comment giải thích lỗi cũ có nhắc chính chuỗi đó.
const normBody = html.slice(normStart, normStart + 1800)
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
check('normalizeLoadedGear KHONG dung `|| defaultEq[...]` (se nhet lai gear)',
  !/normEq \|\| defaultEq\[/.test(normBody));
check('normalizeLoadedGear ton trong null tuong minh',
  /rawItem === undefined/.test(normBody) && /this\.equippedGear\[slotKey\] = null/.test(normBody));

// ============================================================ 6. CO DUONG NHAN VU KHI DAU
console.log('\n=== 6. CO DUONG NHAN VU KHI DAU TIEN (neu khong nguoi choi ket) ===');

check('co ham grantStarterWeaponIfNeeded', /function grantStarterWeaponIfNeeded\(/.test(html));
check('co co chong tang trung starterWeaponGranted',
  /starterWeaponGranted/.test(html));
check('co goi tu BeginnerHooks.onRoomCleared',
  /onRoomCleared\(\)[\s\S]{0,400}?grantStarterWeaponIfNeeded\(\)/.test(html));
check('schema server giu co starterWeaponGranted',
  /starterWeaponGranted/.test(schema));

// ============================================================ 7. BASE STAT DU SONG
console.log('\n=== 7. BASE STAT DU CHO TAN THU KHONG GEAR ===');

const csIdx = html.indexOf('const baseAtk = Math.round((');
const csLine = html.slice(csIdx, csIdx + 200);
const atkBase = csLine.match(/\((\d+) \+ gearAtk/);
const hpIdx = html.indexOf('const baseHp = Math.round((');
const hpLine = html.slice(hpIdx, hpIdx + 200);
const hpBase = hpLine.match(/\((\d+) \+ gearHp/);

check('base ATK >= 78', atkBase && Number(atkBase[1]) >= 78, atkBase ? atkBase[1] : '?');
check('base HP >= 420', hpBase && Number(hpBase[1]) >= 420, hpBase ? hpBase[1] : '?');
check('base ATK nam trong dai hop ly (<= 150)',
  atkBase && Number(atkBase[1]) <= 150, atkBase ? atkBase[1] : '?');
check('base HP nam trong dai hop ly (<= 800)',
  hpBase && Number(hpBase[1]) <= 800, hpBase ? hpBase[1] : '?');

// ============================================================ 8. UI KHONG CRASH
console.log('\n=== 8. UI CHIU DUOC SLOT NULL ===');

// Doc truc tiep equippedGear.weapon.templateId ma khong guard se crash
const badAccess = [...html.matchAll(/SaveState\.equippedGear\.(weapon|necklace|ring|armor|helmet|boots)\.(?!templateId =)/g)];
check('khong co cho nao doc thang .slot.property ma thieu guard',
  badAccess.length === 0, `tim thay ${badAccess.length}`);

// Selector chỉ mặc món đã sở hữu; starter được cấp từ room-clear, không từ preview.
// Runtime handler và bảo toàn UID/template: new-player-gameplay-runtime.test.mjs.
const selectorStart = html.indexOf("document.querySelectorAll('.select-weapon-btn').forEach");
const selectorEnd = html.indexOf("const petGrid =", selectorStart);
const weaponSelector = html.slice(selectorStart, selectorEnd);
check('selector vu khi khong tao item mien phi hoac sua template',
  selectorStart >= 0 && selectorEnd > selectorStart
  && /bagIdx < 0/.test(weaponSelector)
  && !/makeStarterItem|\.templateId\s*=/.test(weaponSelector));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
