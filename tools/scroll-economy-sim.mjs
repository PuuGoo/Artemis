// Chi phi that de nang cap trang bi — tinh GIAI TICH tu cong thuc trong source,
// doi chieu voi nguon cung do duoc tren production.
//
// Chay: node tools/scroll-economy-sim.mjs
//
// Cong thuc lay TU SOURCE (public/index.html):
//   needScrolls(lv) = max(1, min(25, ceil(lv/4)))
//   upgradeCost(lv) = 80 + lv*45
//   quai thuong: 28% roi cuon, gia tri 2
//   boss: 100% roi cuon, gia tri 5
//   slot: ngau nhien DEU trong 6 slot
//   1 chuong = 15 phong, boss o 5/10/15, 3-8 quai/phong
//
// Nguon cung DO THUC TE tren production (tai khoan e2e842149):
//   thang chuong 1: 656 -> 2.705 vang => 2.049 vang/tran

const SLOTS = ["weapon", "armor", "helmet", "ring", "necklace", "boots"];

const needScrolls = (lv) => Math.max(1, Math.min(25, Math.ceil(lv / 4)));
const upgradeCost = (lv) => 80 + lv * 45;

const GOLD_PER_RUN = 2049;                 // do thuc te
const ROOMS = 15;
const BOSS_ROOMS = [5, 10, 15];
const AVG_NORMAL = 5.5;                    // (3+8)/2
const KILLS_PER_RUN = (ROOMS - BOSS_ROOMS.length) * AVG_NORMAL + BOSS_ROOMS.length;
const SCROLLS_PER_RUN = (ROOMS - BOSS_ROOMS.length) * AVG_NORMAL * 0.28 * 2 + BOSS_ROOMS.length * 1.0 * 5;
const SCROLLS_PER_SLOT_PER_RUN = SCROLLS_PER_RUN / SLOTS.length;

function totalFor(maxLv) {
  let scrolls = 0, gold = 0;
  for (let lv = 1; lv < maxLv; lv++) { scrolls += needScrolls(lv); gold += upgradeCost(lv); }
  return { scrolls, gold };
}

const line = (s) => console.log(s);
line("=".repeat(72));
line("CHI PHI NANG CAP TRANG BI vs NGUON CUNG DO DUOC");
line("=".repeat(72));

line("\nNGUON CUNG (do thuc te tren production, 1 tran = 1 chuong):");
line(`  Vang:            ${GOLD_PER_RUN.toLocaleString("vi-VN")} / tran`);
line(`  Quai:            ~${KILLS_PER_RUN.toFixed(0)} / tran`);
line(`  Cuon giay:       ~${SCROLLS_PER_RUN.toFixed(1)} / tran (tong 6 slot)`);
line(`  -> moi slot:     ~${SCROLLS_PER_SLOT_PER_RUN.toFixed(2)} cuon / tran`);

line("\n" + "-".repeat(72));
line("CHI PHI de MOT slot dat moc (tu level 1):");
line("-".repeat(72));
line("  Moc   Cuon can   Vang can      Tran(vang)   Tran(cuon)   Nghen");
for (const target of [5, 10, 15, 20, 30]) {
  const { scrolls, gold } = totalFor(target);
  const runGold = gold / GOLD_PER_RUN;
  const runScroll = scrolls / SCROLLS_PER_SLOT_PER_RUN;
  const bottleneck = runGold > runScroll ? "VANG" : "CUON GIAY";
  line(`  ${String(target).padStart(3)}   ${String(scrolls).padStart(8)}   ${gold.toLocaleString("vi-VN").padStart(10)}   ${runGold.toFixed(1).padStart(11)}   ${runScroll.toFixed(1).padStart(11)}   ${bottleneck}`);
}

line("\n" + "-".repeat(72));
line("CHI PHI de CA 6 slot cung dat moc (cach nguoi choi thuong lam):");
line("-".repeat(72));
line("  Moc   Vang can      Tran(vang)   Tran(cuon)   Nghen");
for (const target of [5, 10, 15, 20]) {
  const one = totalFor(target);
  const gold = one.gold * SLOTS.length;
  const scrolls = one.scrolls * SLOTS.length;
  const runGold = gold / GOLD_PER_RUN;
  const runScroll = scrolls / SCROLLS_PER_RUN;
  line(`  ${String(target).padStart(3)}   ${gold.toLocaleString("vi-VN").padStart(10)}   ${runGold.toFixed(1).padStart(11)}   ${runScroll.toFixed(1).padStart(11)}   ${runGold > runScroll ? "VANG" : "CUON GIAY"}`);
}

line("\n" + "-".repeat(72));
line("VAN DE THAT: cuon giay roi NGAU NHIEN 1/6 slot");
line("-".repeat(72));
const pSpecific = 0.28 / SLOTS.length;
line(`  Xac suat 1 quai roi DUNG cuon vu khi: ${(pSpecific * 100).toFixed(2)}%`);
line(`  => ${(1 / pSpecific).toFixed(1)} quai moi co 1 cuon vu khi (= 2 cuon)`);
line(`  => 1 tran (~${KILLS_PER_RUN.toFixed(0)} quai) cho ~${(KILLS_PER_RUN * pSpecific * 2).toFixed(1)} cuon vu khi`);
line("");
line("  Cuon roi dung slot can chi 1/6. Nhung cuon khong dung van co ich");
line("  (nang slot khac), nen day la van de NHIP DO, khong phai chan hoan toan.");

line("\n" + "=".repeat(72));
line("KET LUAN");
line("=".repeat(72));
line(`  • Vang la diem nghen chinh o moi moc tu 5 tro len.`);
line(`  • Level 10 ca 6 slot: ${((totalFor(10).gold * 6) / GOLD_PER_RUN).toFixed(0)} tran`);
line(`  • Level 20 ca 6 slot: ${((totalFor(20).gold * 6) / GOLD_PER_RUN).toFixed(0)} tran`);
line(`  • Cuon giay khong thieu ve tong luong, chi lech slot.`);
line("=".repeat(72));
