// ============================================================================
// SỰ KIỆN: PLINKO
//
// Bản thật có 2 màn: ui_activityplinko + ui_plinkoactivitychoosereward.
//
// LỖI TÔI TỰ GÂY RA (đã sửa): bộ hệ số đầu tiên [14, 5.2, 2.1, 1.1, 0.5, ...]
// cho EV = 1,51 — nghĩa là người chơi LÃI 51% mỗi lượt, game sẽ bị farm vô
// hạn. Comment trong code còn ghi "EV ≈ 0,92, house edge 8%" — sai hoàn toàn
// so với số thật. Đây là bài học: mọi con số cân bằng phải TÍNH, không đoán.
//
// Test khoá:
//   1. Phân bố bóng rơi ĐÚNG nhị thức B(8, 0.5) — kiểm bằng 200k mẫu
//   2. EV < 1 (nhà cái có lợi), trong dải 0,90–0,95
//   3. Không thả bóng khi thiếu vàng
//   4. Lịch sử cap 20, không phình save
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
check('SaveState co truong plinko', /plinko: null,/.test(html));
check('8 hang chot -> 9 o', /PLINKO_ROWS = 8/.test(html) && /PLINKO_BINS = PLINKO_ROWS \+ 1/.test(html));
check('3 muc cuoc', /PLINKO_BETS = \[50, 200, 1000\]/.test(html));

const multsSrc = html.slice(html.indexOf('const PLINKO_MULTS = ['), html.indexOf('\n', html.indexOf('const PLINKO_MULTS = [')));
const MULT = multsSrc.match(/\[([\d.,\s]+)\]/)[1].split(',').map(Number);
check('9 he so', MULT.length === 9, JSON.stringify(MULT));
check('doi xung qua o giua', MULT.every((m, i) => m === MULT[8 - i]));
check('o giua he so thap nhat (xac suat cao nhat)', MULT[4] === Math.min(...MULT));
check('o ria he so cao nhat (xac suat thap nhat)', MULT[0] === Math.max(...MULT));

// ============================================================ 2. PHÂN BỐ THẬT
console.log('\n=== 2. PHAN BO BONG ROI (200.000 mau) ===');
// odds lý thuyết
const odds = []; let c = 1;
for (let k = 0; k <= 8; k++) { odds.push(c / Math.pow(2, 8)); c = c * (8 - k) / (k + 1); }
const sumOdds = odds.reduce((a, b) => a + b, 0);
check('tong xac suat = 1', Math.abs(sumOdds - 1) < 1e-9, sumOdds.toFixed(6));
check('o giua ~27,34%', Math.abs(odds[4] - 70 / 256) < 1e-9, (odds[4] * 100).toFixed(2) + '%');
check('o ria ~0,39%', Math.abs(odds[0] - 1 / 256) < 1e-9, (odds[0] * 100).toFixed(2) + '%');

// Mô phỏng đúng thuật toán trong game (nảy 50/50 mỗi hàng)
const N = 200000;
const hits = new Array(9).fill(0);
for (let i = 0; i < N; i++) {
  let bin = 0;
  for (let r = 0; r < 8; r++) if (Math.random() < 0.5) bin++;
  hits[bin]++;
}
const maxDev = Math.max(...hits.map((h, i) => Math.abs(h / N - odds[i])));
check('phan bo khop nhị thức (lệch < 0,5%)', maxDev < 0.005, `lệch max ${(maxDev * 100).toFixed(3)}%`);
console.log('     thực tế :', hits.map(h => (h / N * 100).toFixed(2) + '%').join(' '));
console.log('     lý thuyết:', odds.map(o => (o * 100).toFixed(2) + '%').join(' '));

// ============================================================ 3. EV
console.log('\n=== 3. EV — NHA CAI PHAI CO LOI ===');
const ev = MULT.reduce((s, m, i) => s + m * odds[i], 0);
console.log('     EV =', ev.toFixed(4), '| house edge =', ((1 - ev) * 100).toFixed(2) + '%');
check('EV < 1 (khong the farm vo han)', ev < 1, ev.toFixed(4));
check('EV trong dai hop ly 0,90-0,95', ev >= 0.90 && ev <= 0.95, ev.toFixed(4));
check('house edge 3%-10%', (1 - ev) >= 0.03 && (1 - ev) <= 0.10, ((1 - ev) * 100).toFixed(2) + '%');

// Mô phỏng EV thực bằng cách chơi 100k lượt cược 100
let bank = 0;
for (let i = 0; i < 100000; i++) {
  let bin = 0;
  for (let r = 0; r < 8; r++) if (Math.random() < 0.5) bin++;
  bank += Math.round(100 * MULT[bin]) - 100;
}
const evReal = 1 + bank / (100000 * 100);
check('EV mo phong khop EV ly thuyet (sai so < 0,02)',
  Math.abs(evReal - ev) < 0.02, `mô phỏng ${evReal.toFixed(4)} vs lý thuyết ${ev.toFixed(4)}`);

// ============================================================ 4. CHẶN
console.log('\n=== 4. CHAN LAM DUNG ===');
const playFn = fnBody('plinkoPlay');
check('chan khi thieu vang', /SaveState\.gold < amount/.test(playFn));
check('tru cuoc truoc khi tra thuong', playFn.indexOf('gold -= amount') < playFn.indexOf('gold += win'));
check('tra thuong = cuoc x he so', /Math\.round\(amount \* mult\)/.test(playFn));
check('cap lich su 20', /history\.length > 20/.test(playFn));
check('ghi bestMult', /p\.bestMult = Math\.max/.test(playFn));

// ============================================================ 5. UI
console.log('\n=== 5. UI ===');
check('co #plinkoContent trong tab Su Kien',
  /id="tabEvents"[\s\S]{0,900}?id="plinkoContent"/.test(html));
check('hien xac suat tung o', /Math\.round\(odds\[i\] \* 1000\) \/ 10/.test(html));
check('hien he so tung o', /\$\{m\}×/.test(html));
check('co nut chon cuoc', /data-plinko-bet="\$\{b\}"/.test(html));
check('co nut tha bong', /id="btnPlinkoDrop"/.test(html));
check('co o hien ket qua', /id="plinkoResult"/.test(html));
check('hien lich su gan day (bo bong chua ve dich)', /p\.history\.slice\(pend, pend \+ 10\)/.test(html));
check('tab Su Kien goi renderPlinkoPanel', /renderPlinkoPanel\(\)/.test(html));
// 3 loi tham my phat hien qua anh chup:
check('xac suat >=7.5px mau sang (truoc la 6px xam)', /text-\[7\.5px\] text-slate-300 leading-none mt-1 font-bold/.test(html));
check('he so 10px (truoc 8px)', /text-\[10px\] font-black leading-none/.test(html));
check('co 1 dong giai thich luat cho nguoi moi', /hệ số ô đó × tiền cược/.test(html));
check('tab Su Kien co padding-bottom tranh nav che nut',
  /id="tabEvents"[^>]*pb-24/.test(html));


// ============================================================ 5b. ANIMATION BONG ROI
console.log('\n=== 5b. ANIMATION BONG ROI ===');
check('co canvas ban choi', /id="plinkoCanvas"/.test(html));
check('dung requestAnimationFrame', /plinkoFxFrame[\s\S]{0,4000}requestAnimationFrame\(plinkoFxFrame\)/.test(html));
check('ket qua chot truoc: plinkoPlay tra ve path', /return \{ bin, mult, win, delta, bet: amount, path \}/.test(playFn));
check('bin = tong duong di (animation khong tu quyet ket qua)', /const bin = path\.reduce/.test(playFn));
check('plinkoDropPath 8 buoc 0/1', /function plinkoDropPath\(\)[\s\S]{0,200}Math\.random\(\) < 0\.5 \? 1 : 0/.test(html));
check('bong cham chot -> chot sang len', /function plinkoFxHitPeg/.test(html) && /fx\.glow\[row\]\[j\] = 1/.test(html));
check('ket qua chi hien khi bong cham o (plinkoFxLand)', /function plinkoFxLand[\s\S]{0,1800}plinkoResultHtml\(res\)/.test(html));
check('khong ve lai panel khi doi cuoc (giu bong dang roi)',
  /data-plinko-bet[\s\S]{0,400}plinkoRefreshMeta\(\);/.test(html));
check('gioi han bong dang roi', /PLINKO_MAX_INFLIGHT = 10/.test(html));
check('ton trong prefers-reduced-motion', /prefers-reduced-motion: reduce[\s\S]{0,40}/.test(html) && /plinkoReducedMotion/.test(html));

// Mô phỏng hình học: bóng phải kết thúc đúng tâm ô theo path (chạy thật hàm trong game)
const vm = await import('node:vm');
function grab(name){ return fnBody(name); }
const src = ['plinkoBuildPts','plinkoBallPos'].map(grab).join('\n');
const ctx = vm.createContext({ PLINKO_ROWS: 8 });
vm.runInContext(src, ctx);
const fx = { cx: 150, s: 34, rowH: 29, topPad: 32, pegR: 2.6, ballR: 5.8, lastRowY: 235, H: 280,
  dur: [320, ...new Array(8).fill(250), 300], bounceMs: 380 };
let geomOk = true;
for (let trial = 0; trial < 500; trial++) {
  const path = Array.from({ length: 8 }, () => (Math.random() < 0.5 ? 1 : 0));
  const bin = path.reduce((a, b) => a + b, 0);
  const pts = ctx.plinkoBuildPts(fx, path);
  const end = ctx.plinkoBallPos(fx, { pts }, 99999);
  const expectX = fx.cx + (bin - 4) * fx.s;
  if (Math.abs(end.x - expectX) > 1e-6) geomOk = false;
}
check('500 duong di ngau nhien: bong luon dung dung o cua no', geomOk);
// Vị trí liên tục: không "teleport" giữa 2 frame 16ms
{
  const path = [1,0,1,1,0,0,1,0];
  const pts = ctx.plinkoBuildPts(fx, path);
  let prev = ctx.plinkoBallPos(fx, { pts }, 0), maxJump = 0;
  for (let t = 16; t < 3200; t += 16) {
    const cur = ctx.plinkoBallPos(fx, { pts }, t);
    maxJump = Math.max(maxJump, Math.hypot(cur.x - prev.x, cur.y - prev.y));
    prev = cur;
  }
  check('chuyen dong muot (nhay toi da < 1 hang chot/frame)', maxJump < fx.rowH, 'max ' + maxJump.toFixed(1) + 'px/frame');
}

// ============================================================ 6. EXPORT
console.log('\n=== 6. EXPORT ===');
for (const n of ['ensurePlinko', 'plinkoDrop', 'plinkoDropPath', 'plinkoPlay', 'plinkoBinOdds', 'renderPlinkoPanel', 'PLINKO_MULTS', 'PLINKO_ROWS']) {
  check(`export ${n}`, new RegExp(`\\n\\s+${n},`).test(html));
}

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
