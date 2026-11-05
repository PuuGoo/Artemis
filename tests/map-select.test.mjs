// Khoá lại UI chọn bản đồ (map selection) + asset minh hoạ.
//
// Chạy: node tests/map-select.test.mjs
import fs from "node:fs";
import path from "node:path";

const root = new URL("..", import.meta.url);
const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ============================================================ 1. Asset
console.log("\n=== 1. ASSET BAN DO ===");
const assets = [
  { file: "map-ch1-ancient-stone.svg", ch: 1 },
  { file: "map-ch2-lava-valley.svg", ch: 2 },
  { file: "map-ch3-void-sanctum.svg", ch: 3 },
];
for (const a of assets) {
  const p = new URL("../public/assets/" + a.file, import.meta.url);
  const exists = fs.existsSync(p);
  check(`ton tai ${a.file}`, exists);
  if (!exists) continue;
  const svg = fs.readFileSync(p, "utf8");
  const size = fs.statSync(p).size;
  check(`  ${a.file} la SVG hop le`, svg.trimStart().startsWith("<svg") && svg.includes("</svg>"));
  check(`  ${a.file} co viewBox 1200x600`, /viewBox="0 0 1200 600"/.test(svg));
  check(`  ${a.file} co preserveAspectRatio (khong meo)`, svg.includes('preserveAspectRatio="xMidYMid slice"'));
  check(`  ${a.file} co it nhat 7 gradient`, (svg.match(/<(linear|radial)Gradient/g) || []).length >= 7,
    String((svg.match(/<(linear|radial)Gradient/g) || []).length));
  check(`  ${a.file} co it nhat 15 path (co chieu sau)`, (svg.match(/<path/g) || []).length >= 15,
    String((svg.match(/<path/g) || []).length));
  check(`  ${a.file} co filter blur (mem)`, /<filter /.test(svg));
  check(`  ${a.file} KHONG chua chu (da ngon ngu)`,
    !/<text[^>]*>[^<]*[A-Za-zÀ-ỹ]{3,}/.test(svg.replace(/aria-label="[^"]*"/g, "")));
  check(`  ${a.file} dung luong < 40KB`, size < 40 * 1024, size + " bytes");
  check(`  ${a.file} khong tham chieu URL ngoai`, !/https?:\/\//.test(svg.replace(/xmlns="[^"]*"/g, "")));
}

// ============================================================ 2. CHAPTERS metadata
console.log("\n=== 2. METADATA CHAPTERS ===");
check("moi chuong co mapAsset", (html.match(/mapAsset: '\/assets\//g) || []).length === 3,
  String((html.match(/mapAsset: '\/assets\//g) || []).length));
check("ch1 tro dung asset", html.includes("mapAsset: '/assets/map-ch1-ancient-stone.svg'"));
check("ch2 tro dung asset", html.includes("mapAsset: '/assets/map-ch2-lava-valley.svg'"));
check("ch3 tro dung asset", html.includes("mapAsset: '/assets/map-ch3-void-sanctum.svg'"));
check("moi chuong co mapRegion", (html.match(/mapRegion:/g) || []).length === 3);
check("moi chuong co mapTagline", (html.match(/mapTagline:/g) || []).length === 3);
check("khong dung URL anh ben ngoai", !/mapAsset: 'https?:/.test(html));

// ============================================================ 3. DOM + CSS
console.log("\n=== 3. DOM & CSS ===");
check("co #mapSelectPanel", html.includes('id="mapSelectPanel"'));
check("chapterSelectStrip cu da an (hidden)", /id="chapterSelectStrip" class="hidden"/.test(html));
check("co .ms-stage", /\.ms-stage \{/.test(html));
check("co .ms-art voi aspect-ratio 21/9 (gon hon 2/1)",
  /\.ms-art \{[^}]*aspect-ratio: 21 \/ 9/.test(html));
check("co .ms-art img object-fit cover", /\.ms-art img \{[^}]*object-fit: cover/.test(html));
check("co .ms-scrim (gradient doc chu)", /\.ms-scrim \{/.test(html));
check("co .ms-aura", /\.ms-aura \{/.test(html));
check("co .ms-kicker / .ms-name / .ms-tagline", /\\.ms-kicker \{/.test(html.replace(/\\\\/g, "\\")) || /\.ms-kicker \{/.test(html));
check("KHONG con 4 o stats (da gop thanh 1 dong tien do)",
  !/\.ms-stats \{/.test(html));
check("co .ms-progline (1 dong tien do duy nhat)",
  /\.ms-progline \{/.test(html));
check("co .ms-bossline (1 dong trum duy nhat)",
  /\.ms-bossline \{/.test(html));
check("co .ms-node", /\.ms-node \{/.test(html));
check("co .ms-node.done", /\.ms-node\.done \{/.test(html));
check("co .ms-node.now", /\.ms-node\.now \{/.test(html));
check("co .ms-node.boss-node tron", /\.ms-node\.boss-node \{[^}]*border-radius: 50%/.test(html));
check("co .ms-tab", /\.ms-tab \{/.test(html));
check("co .ms-tab.is-locked", /\.ms-tab\.is-locked/.test(html));
check("co .ms-tab-lock overlay", /\.ms-tab-lock \{/.test(html));
check("co .ms-btn-start", /\.ms-btn-start \{/.test(html));
check("co .ms-lockbar", /\.ms-lockbar \{/.test(html));
check("node 'hien tai' rong ruot + vien vang (khong to dac)",
  /\.ms-node\.now \{[^}]*background:\s*transparent/.test(html) &&
  /\.ms-node\.now \{[^}]*border:\s*2px solid #fbbf24/.test(html));
check("node trum co animation rieng hoac vien do",
  /\.ms-node\.boss-node\.now \{/.test(html));
check("co responsive <= 640px", /@media \(max-width: 640px\) \{\s*\.ms-art/.test(html));
check("responsive thu nho pips tren mobile",
  /@media \(max-width: 640px\) \{[\s\S]{0,600}?\.ms-node \{[^}]*height: 6px/.test(html));
check("responsive thu nho nut icon",
  /@media \(max-width: 640px\) \{[\s\S]{0,900}?\.ms-btn-icon \{[^}]*width: 38px/.test(html));

// ============================================================ 4. Hàm render
console.log("\n=== 4. HAM renderMapSelect ===");
const idx = html.indexOf("function renderMapSelect()");
check("co renderMapSelect", idx > 0);
const block = html.slice(idx, idx + 9000);
check("goi normalizeSelectedChapter (khong tin state)", /normalizeSelectedChapter\(\)/.test(block));
check("dung isChapterLocked (logic that)", /isChapterLocked\(ch\)/.test(block));
check("dung getChapterBest (logic that)", /getChapterBest\(ch\.id\)/.test(block));
check("doc winsByChapter", /SaveState\.winsByChapter/.test(block));
check("ve 1 node cho moi phong", /for \(let r = 1; r <= ch\.rooms; r\+\+\)/.test(block));
check("phong trum = boi 5 hoac cuoi", /const isBoss = \(r % 5 === 0\) \|\| \(r === ch\.rooms\)/.test(block));
check("phong trum hinh tron", /boss-node/.test(block));
check("ve 3 tab chuong", /CHAPTERS\.map\(\(c, i\)/.test(block));
check("nut start goi openRunBriefing (luong cu)", /openRunBriefing\(\)/.test(block));
check("chot selectedChapterIdx truoc khi start", /SaveState\.selectedChapterIdx = selIdx/.test(block));
check("export renderMapSelect", /^\s+renderMapSelect,$/m.test(html));
check("goi trong renderChapterHeader", /safeRender\('mapSelect', \(\) => renderMapSelect\(\)\)/.test(html));

// ============================================================ 5. Không đổi logic lõi
console.log("\n=== 5. KHONG DUNG LOGIC MO KHOA ===");
check("isChapterLocked khong bi sua (van chi 1 dinh nghia)",
  (html.match(/function isChapterLocked/g) || []).length === 1);
check("getChapterBest khong bi sua", (html.match(/function getChapterBest/g) || []).length === 1);
check("normalizeSelectedChapter khong bi sua", (html.match(/function normalizeSelectedChapter/g) || []).length === 1);
check("startNewRun khong bi sua", (html.match(/function startNewRun/g) || []).length === 1);
check("renderMapSelect KHONG tu cap quyen mo khoa",
  !/isChapterLocked\s*=\s*/.test(block) && !/unlock\s*=\s*true/.test(block));
// Đảm bảo nhánh khoá kết thúc bằng return TRƯỚC dòng gán selectedChapterIdx.
check("tab khoa khong doi selectedChapterIdx", (() => {
  const lockAt = block.indexOf("if (isChapterLocked(target))");
  const assignAt = block.indexOf("SaveState.selectedChapterIdx = idx;");
  if (lockAt < 0 || assignAt < 0 || assignAt < lockAt) return false;
  const between = block.slice(lockAt, assignAt);
  return between.includes("return;");
})());

// ============================================================ 6. Mô phỏng dải mốc
console.log("\n=== 6. MO PHONG DAI MOC PHONG ===");
/** Mô phỏng logic vẽ node trong renderMapSelect. */
function buildTrail(rooms, best, cleared) {
  const nodes = [];
  for (let r = 1; r <= rooms; r++) {
    const isBoss = (r % 5 === 0) || (r === rooms);
    const done = r <= best;
    const isNow = r === Math.min(rooms, best + 1) && !isBoss;
    nodes.push({
      room: r, boss: isBoss, done,
      now: isNow && !cleared,
      glyph: isBoss ? "★" : r,
    });
  }
  return nodes;
}

// Chương 1: 15 phòng, boss 5/10/15
let t = buildTrail(15, 0, false);
check("C1 moi trang: 15 node", t.length === 15);
check("C1 boss o 5, 10, 15", t.filter(n => n.boss).map(n => n.room).join(",") === "5,10,15");
check("C1 moi trang: node nao cung chua done", t.every(n => !n.done));
check("C1 moi trang: phong 1 la 'now'", t[0].now === true);
check("C1 moi trang: phong 5 (truoc boss) khong phai now", t[4].now === false);

t = buildTrail(15, 4, false);
check("C1 qua 4 phong: 4 done", t.filter(n => n.done).length === 4);
check("C1 qua 4 phong: phong 5 la now nhung la boss -> khong now", t[4].now === false);

t = buildTrail(15, 15, true);
check("C1 pha dao: 15 done", t.filter(n => n.done).length === 15);
check("C1 pha dao: khong con node now", t.every(n => !n.now));

// Chương 2: 12 phòng, boss 5/10/12
t = buildTrail(12, 0, false);
check("C2 boss o 5, 10, 12", t.filter(n => n.boss).map(n => n.room).join(",") === "5,10,12");
check("C2: 12 node", t.length === 12);

// Chương 3: 10 phòng, boss 5/10 (10 vua boi 5 vua cuoi)
t = buildTrail(10, 0, false);
check("C3 boss o 5, 10 (khong trung)", t.filter(n => n.boss).map(n => n.room).join(",") === "5,10");
check("C3: 10 node", t.length === 10);
check("C3: khong co node trum trung lap", new Set(t.filter(n => n.boss).map(n => n.room)).size === 2);

// ============================================================ 7. Mô phỏng phân quyền
console.log("\n=== 7. MO PHONG PHAN QUYEN ===");
/** Mô phỏng isChapterLocked theo dữ liệu CHAPTERS thật. */
const CHAPTERS = [
  { id: 1, rooms: 15, unlock: null },
  { id: 2, rooms: 12, unlock: { type: "chapterWin", chapterId: 1 } },
  { id: 3, rooms: 10, unlock: { type: "chapterWin", chapterId: 2 } },
];
function isWon(id, wins, best) {
  if ((wins[id] || 0) > 0) return true;
  const ch = CHAPTERS.find(c => c.id === id);
  return (best[id] || 0) >= (ch ? ch.rooms : 999);
}
function isLocked(ch, wins, best) {
  if (!ch.unlock) return false;
  if (ch.unlock.type === "chapterWin") return !isWon(ch.unlock.chapterId, wins, best);
  return true;
}

let wins = {}, best = {};
check("tai khoan moi: C1 mo", !isLocked(CHAPTERS[0], wins, best));
check("tai khoan moi: C2 khoa", isLocked(CHAPTERS[1], wins, best));
check("tai khoan moi: C3 khoa", isLocked(CHAPTERS[2], wins, best));

wins = { 1: 1 };
check("thang C1: C2 mo", !isLocked(CHAPTERS[1], wins, best));
check("thang C1: C3 van khoa", isLocked(CHAPTERS[2], wins, best));

wins = { 1: 1, 2: 1 };
check("thang C1+C2: C3 mo", !isLocked(CHAPTERS[2], wins, best));

// Nguoi choi cu: khong co winsByChapter nhung bestRooms day du
wins = {}; best = { 1: 15 };
check("cu: best 15/15 mo C2 du khong co wins", !isLocked(CHAPTERS[1], wins, best));
best = { 1: 15, 2: 12 };
check("cu: best day du mo C3", !isLocked(CHAPTERS[2], wins, best));

// ============================================================ 8. DAI PIPS KHONG TRAN
// Bug tung gap: .ms-node co width:100% nen moi moc rong bang ca khung,
// 15 moc cong lai dai ~14.000px -> hien nhu MOT thanh lien thay vi 15 doan.
console.log("\n=== 8. DAI PIPS KHONG TRAN (regression) ===");
const nodeCssM = html.match(/\.ms-node \{[^}]*\}/);
check("tim thay khung .ms-node", !!nodeCssM);
if (nodeCssM) {
  const ncss = nodeCssM[0];
  check("ms-node dung flex co gian, KHONG dung width:100%",
    !/width:\s*100%/.test(ncss) && /flex:\s*1 1 0/.test(ncss));
  check("ms-node co min-width de khong bi bep", /min-width:\s*\d+px/.test(ncss));
}
check("ms-node (tram trum) van co dinh kich thuoc",
  /\.ms-node\.boss-node \{[^}]*flex:\s*none/.test(html) &&
  /\.ms-node\.boss-node \{[^}]*width:\s*\d+px/.test(html));
check("trail co overflow-x de khong tran ra ngoai panel",
  /\.ms-trail \{[^}]*overflow-x:\s*auto/.test(html));
check("node 'hien tai' co animation de phan biet voi 'da qua'",
  /\.ms-node\.now \{[^}]*animation:\s*msNowPulse/.test(html) &&
  /@keyframes msNowPulse/.test(html));
check("node 'da qua' to xanh, 'hien tai' vien vang (khac kieu)",
  /\.ms-node\.done \{[^}]*#22c55e/.test(html) &&
  /\.ms-node\.now \{[^}]*rgba\(251,191,36/.test(html));

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
