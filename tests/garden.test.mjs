// ============================================================================
// SỰ KIỆN: VƯỜN THỦ HỘ (guardplant)
//
// Bản thật có 8 màn guardplant (docs/APK_000000_ARCHERO_ANALYSIS.md mục 3.4):
// main/multi/rank/recruit/shop/weektask/loading/battleresult. Bản web làm bản
// đơn người: trồng → tưới → thu hoạch → đổi thưởng.
//
// RỦI RO ĐÃ TRÁNH:
//   1. Trồng khi hết hạt → chặn, không trừ âm
//   2. Tưới 2 lần cùng ô → lần 2 vô hiệu (không rút ngắn vô hạn)
//   3. Thu hoạch khi chưa chín → trả null, không cộng sản lượng
//   4. Đổi thưởng khi thiếu nông sản → chặn, không trừ âm
//   5. Đồng hồ 1s chỉ chạy khi tab mở (không tốn CPU lúc đánh nhau)
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
console.log('\n=== 1. STATE ===');
check('SaveState co truong garden', /garden: null,/.test(html));
check('ensureGarden tao 6 o dat', /GARDEN_PLOTS = 6/.test(html));
const eg = fnBody('ensureGarden');
check('ensureGarden tao 6 plot', /for \(let i = 0; i < GARDEN_PLOTS; i\+\+\)/.test(eg));
check('tan thu co 2 hat mam', /seeds: \{ sprout: 2 \}/.test(eg));
check('co 4 loai nong san', (html.match(/leaf:|petal:|dew:|essence:/g) || []).length >= 4);

// ============================================================ 2. HẠT GIỐNG
console.log('\n=== 2. HAT GIONG ===');
check('4 loai hat', /GARDEN_SEEDS = \[[\s\S]{0,1200}?\];/.test(html)
  && (html.slice(html.indexOf('GARDEN_SEEDS = ['), html.indexOf('GARDEN_PRODUCE =')).match(/id: '/g) || []).length === 4);
check('moi hat co thoi gian chin rieng', /growSec: 60/.test(html) && /growSec: 900/.test(html));
check('moi hat co san luong', /yield: 1/.test(html) && /yield: 5/.test(html));

const buyFn = fnBody('buySeed');
check('mua hat chan khi thieu vang', /SaveState\.gold < seed\.price/.test(buyFn));
check('chi tru vang sau khi kiem tra', buyFn.indexOf('gold < seed.price') < buyFn.indexOf('SaveState.gold -= seed.price'));

// ============================================================ 3. TRỒNG / TƯỚI
console.log('\n=== 3. TRONG / TUOI ===');
const plantFn = fnBody('plantSeed');
check('trong chan o da co cay', /if \(!plot \|\| plot\.seedId\) return false;/.test(plantFn));
check('trong chan khi het hat', /if \(have < 1\)/.test(plantFn));
check('tru hat khi trong', /g\.seeds\[seedId\] = have - 1/.test(plantFn));
check('dat readyAt = now + growSec', /plot\.readyAt = now \+ seed\.growSec \* 1000/.test(plantFn));

const waterFn = fnBody('waterPlot');
check('tuoi chan khi da tuoi roi', /plot\.watered\) return false/.test(waterFn));
check('tuoi chan khi cay da chin', /now >= plot\.readyAt\) return false/.test(waterFn));
check('tuoi giam 40% thoi gian CON LAI', /left \* \(1 - GARDEN_WATER_SPEEDUP\)/.test(waterFn));
check('GARDEN_WATER_SPEEDUP = 0.4', /GARDEN_WATER_SPEEDUP = 0\.4/.test(html));

// ============================================================ 4. THU HOẠCH
console.log('\n=== 4. THU HOACH ===');
const harvFn = fnBody('harvestPlot');
check('thu hoach chan khi chua chin', /if \(st\.state !== 'ready'\) return null;/.test(harvFn));
check('cong nong san theo yield', /g\.produce\[seed\.produce\] = \(g\.produce\[seed\.produce\] \|\| 0\) \+ amount/.test(harvFn));
check('tang totalHarvest', /g\.totalHarvest \+= amount/.test(harvFn));
check('tang tien do nhiem vu tuan', /g\.weekTask\.done = Math\.min/.test(harvFn));
check('xoa o sau thu hoach', /plot\.seedId = null/.test(harvFn));

// ============================================================ 5. ĐỔI THƯỞNG
console.log('\n=== 5. DOI THUONG ===');
const exFn = fnBody('exchangeGarden');
check('chan khi thieu nong san', /g\.produce\[k\] \|\| 0\) < v/.test(exFn));
check('tru nong san dung so luong', /g\.produce\[k\] -= v/.test(exFn));
check('cong vang hoac da quy', /SaveState\.gold \+= it\.give\.gold/.test(exFn) && /SaveState\.gems \+= it\.give\.gems/.test(exFn));
check('4 vat pham doi', (html.slice(html.indexOf('GARDEN_SHOP = ['), html.indexOf('GARDEN_PLOTS =')).match(/id: 'sh_/g) || []).length === 4);

// ============================================================ 6. UI
console.log('\n=== 6. UI ===');
check('co #gardenContent trong tab Su Kien',
  /id="tabEvents"[\s\S]{0,3000}?id="gardenContent"/.test(html));
check('co 6 o dat hien thi', /g\.plots\.map\(p =>/.test(fnBody('renderGardenPanel')));
check('o rong co nut Trong', /data-act="plant"/.test(html));
check('o chin co nut Thu hoach', /data-act="harvest"/.test(html));
check('o dang lon co nut Tuoi', /data-act="\$\{p\.watered \? 'none' : 'water'\}"/.test(html));
check('hien dem nguoc giay', /\$\{st\.leftSec\}s/.test(html));
check('co 4 nut man con', (html.match(/data-garden-screen="/g) || []).length === 4);
for (const s of ['seeds', 'shop', 'task', 'rank']) {
  check(`co man "${s}"`, new RegExp(`data-garden-screen="${s}"`).test(html));
}
check('tab Su Kien goi renderGardenPanel',
  /targetId === 'tabEvents'[\s\S]{0,1200}?renderGardenPanel\(\)/.test(html));
// Phan biet trang thai phai dua vao CHU, khong chi mau: 3 loai cay co 3 mau
// khac nhau nen neu chi doc mau thi tuong la 3 trang thai.
check('o dang lon co nhan chu "Dang lon"', /Đang lớn<\/span>/.test(html));
check('o chin co badge "!" to hon (w-4.5 + glow)', /w-4\.5 h-4\.5 rounded-full bg-amber-400/.test(html));
check('o trong co nhan chu "Trong"', />Trồng<\/span>/.test(html));
check('dem nguoc du to doc (10px trang dam)',
  /text-\[10px\] text-white font-black tabular-nums/.test(html));
check('nhan "Dang lon" du tuong phan (slate-200, khong phai 400)',
  /text-\[7\.5px\] uppercase tracking-wide text-slate-200 font-black/.test(html));

// ============================================================ 7. ĐỒNG HỒ
console.log('\n=== 7. DONG HO 1S ===');
check('co startGardenTicker', /function startGardenTicker\(\)/.test(html));
check('chi chay 1 lan (khong tao nhieu interval)', /if \(gardenTicker\) return;/.test(html));
check('chi ve lai khi tab dang mo',
  /sec\.classList\.contains\('hidden'\)\) return;/.test(html));
check('chi ve khi co o dang lon hoac chin', /if \(growing \|\| readyUnclaimed\) renderGardenPanel\(\)/.test(html));
check('khoi dong khi mo tab',
  /renderGardenPanel\(\);[\s\S]{0,1200}?if \(typeof startGardenTicker === 'function'\) startGardenTicker\(\)/.test(html.replace(/\r/g, '')));

// ============================================================ 8. NHIỆM VỤ TUẦN
console.log('\n=== 8. NHIEM VU TUAN ===');
check('muc tieu 10 cay', /target: 10/.test(html));
check('thuong 2000 vang + 80 da quy',
  /SaveState\.gold \+= 2000/.test(html) && /SaveState\.gems \+= 80/.test(html));
check('chan nhan thuong 2 lan', /if \(t\.done < t\.target \|\| t\.claimed\) return;/.test(html));

// ============================================================ 9. EXPORT
console.log('\n=== 9. EXPORT ===');
for (const n of ['renderGardenPanel', 'ensureGarden', 'plantSeed', 'waterPlot', 'harvestPlot', 'buySeed', 'exchangeGarden', 'getPlotState']) {
  check(`export ${n}`, new RegExp(`\\n\\s+${n},`).test(html));
}

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
