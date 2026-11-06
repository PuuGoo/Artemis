#!/usr/bin/env node
// ==================== TRÍCH UI PRODUCTION -> DỮ LIỆU CHO UNITY ====================
//
// Production là HTML + Tailwind. Unity không đọc được HTML, nhưng Unity đọc JSON
// được. Script này parse <body> của public/index.html thành một CÂY UI có đủ
// thông tin để dựng lại bằng Unity UI:
//
//   { tag, id, cls[], text, attrs{}, kids[] }
//
// Nhờ vậy Unity dựng lại ĐÚNG cấu trúc production (cùng div, cùng thứ tự, cùng
// class Tailwind), thay vì tôi vẽ tay từng màn hình rồi lệch dần.
//
// Chạy: node tools/unity-ui/extract-ui.mjs
//
// Không sửa gì trong public/ — chỉ đọc.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SRC = path.join(REPO, "public", "index.html");
const OUT_DIR = path.join(REPO, "unity-client", "Assets", "Artemis", "Resources", "ArtemisUi");

// ---------- Tokenizer HTML tối giản nhưng chịu được file 32k dòng ----------

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function tokenize(html) {
  const tokens = [];
  let i = 0;
  const n = html.length;

  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      pushText(html.slice(i));
      break;
    }
    if (lt > i) pushText(html.slice(i, lt));

    // Comment
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }

    const gt = findTagEnd(html, lt);
    if (gt < 0) { pushText(html.slice(lt)); break; }

    const raw = html.slice(lt + 1, gt);
    i = gt + 1;

    if (raw.startsWith("/")) {
      tokens.push({ type: "close", name: raw.slice(1).trim().toLowerCase() });
      continue;
    }

    const selfClose = raw.endsWith("/");
    const body = selfClose ? raw.slice(0, -1) : raw;
    const m = body.match(/^([a-zA-Z][\w:-]*)([\s\S]*)$/);
    if (!m) { pushText("<" + raw + ">"); continue; }

    const tag = m[1].toLowerCase();
    const attrs = parseAttrs(m[2]);
    tokens.push({ type: "open", tag, attrs, selfClose: selfClose || VOID_TAGS.has(tag) });
  }

  return tokens;

  function pushText(t) {
    if (!t) return;
    var clean = t.replace(/\s+/g, " ").trim();
    if (!clean) return;
    // Giải mã HTML entity: production dùng &amp; &lt; &gt; &nbsp; &middot;...
    // Không giải mã thì Unity hiện nguyên "&amp;" trên màn hình (đã thấy trong ảnh chụp).
    clean = decodeEntities(clean);
    tokens.push({ type: "text", text: clean });
  }

  function decodeEntities(s) {
    var named = {
      amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
      middot: "·", bull: "•", times: "×", divide: "÷", hellip: "…",
      mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
      deg: "°", plusmn: "±", frac12: "½", laquo: "«", raquo: "»",
      copy: "©", reg: "®", trade: "™", euro: "€", pound: "£", yen: "¥",
      arrow: "→", larr: "←", uarr: "↑", darr: "↓", check: "✓", cross: "✗",
    };
    return s
      .replace(/&#x([0-9a-fA-F]+);/g, function (m, h) {
        var cp = parseInt(h, 16);
        return cp > 0 ? String.fromCodePoint(cp) : m;
      })
      .replace(/&#(\d+);/g, function (m, d) {
        var cp = parseInt(d, 10);
        return cp > 0 ? String.fromCodePoint(cp) : m;
      })
      .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, function (m, n) {
        var v = named[n];
        return v !== undefined ? v : m;
      });
  }
}

// Tìm '>' đóng thẻ, bỏ qua '>' nằm trong chuỗi thuộc tính.
function findTagEnd(html, start) {
  let q = null;
  for (let i = start + 1; i < html.length; i++) {
    const c = html[i];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === ">") return i;
  }
  return -1;
}

function parseAttrs(s) {
  const out = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))|([a-zA-Z_:][\w:.-]*)/g;
  let m;
  while ((m = re.exec(s))) {
    const name = (m[1] || m[6]).toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    if (name) out[name] = value;
  }
  return out;
}

// ---------- Dựng cây ----------

function buildTree(tokens) {
  const root = { tag: "#root", cls: [], attrs: {}, kids: [], text: "" };
  const stack = [root];

  for (const t of tokens) {
    const top = stack[stack.length - 1];

    if (t.type === "open") {
      const node = {
        tag: t.tag,
        id: t.attrs.id || "",
        cls: (t.attrs.class || "").split(/\s+/).filter(Boolean),
        attrs: t.attrs,
        kids: [],
        text: "",
      };
      top.kids.push(node);
      if (!t.selfClose) stack.push(node);
    } else if (t.type === "close") {
      // Đóng tới thẻ khớp gần nhất; nếu không khớp thì bỏ qua (HTML lỏng).
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === t.name) { stack.length = k; break; }
      }
    } else {
      top.text = (top.text ? top.text + " " : "") + t.text;
    }
  }

  return root;
}

// ---------- Lọc bỏ phần không phải nội dung ----------

const SKIP_TAGS = new Set(["script", "style", "svg", "path", "defs", "use", "link", "meta"]);

function prune(node) {
  node.kids = node.kids
    .filter((k) => !SKIP_TAGS.has(k.tag))
    .map(prune);
  return node;
}

// ---------- Thống kê ----------

function walk(node, fn) {
  fn(node);
  for (const k of node.kids) walk(k, fn);
}

// ---------- Main ----------

if (!fs.existsSync(SRC)) {
  console.error("Không thấy " + SRC);
  process.exit(1);
}

const src = fs.readFileSync(SRC, "utf8");

const b0 = src.indexOf("<body");
const b1 = src.indexOf("<script", b0);
if (b0 < 0 || b1 < 0) {
  console.error("Không tìm được <body>...</script> trong index.html");
  process.exit(1);
}

// Lấy phần trong <body ...> tới <script> đầu tiên.
const bodyOpen = src.indexOf(">", b0) + 1;
const html = src.slice(bodyOpen, b1);

const tokens = tokenize(html);
const tree = prune(buildTree(tokens));

// Gom tất cả id gốc (màn hình) để Unity biết node nào là "trang".
const screens = [];
walk(tree, (n) => {
  if (n.id && /(Screen|Modal|Panel|View|Tab|SubScreen)$/.test(n.id)) {
    screens.push({ id: n.id, tag: n.tag, hidden: n.cls.includes("hidden") });
  }
});

// Xác định màn hình ĐANG HIỆN khi mở production.
//
// Vì sao cần: cây có 6 tab (tabBattle, tabEquip, tabHeroes, tabGuild, tabTalents,
// tabShopVn) và ~12 modal. Tab không có class "hidden" chính là tab mặc định —
// production đang đứng ở đó. Render tất cả cùng lúc sẽ ra một màn hình lộn xộn,
// không giống production (đúng lỗi đã thấy khi so ảnh).
//
// Ghi vào uiScreens.json để Unity quyết định bật/tắt theo đúng trạng thái này.
const visibleScreens = screens.filter((s) => !s.hidden).map((s) => s.id);

// Tab đang mở: node có id bắt đầu bằng "tab" và KHÔNG có class "hidden".
// (production: tabBattle/tabEquip/tabHeroes/tabGuild/tabTalents/tabShopVn; chỉ
// một cái không hidden — với index.html hiện tại là tabEquip.)
const openTabs = [];
walk(tree, (n) => {
  if (!/^tab[A-Z]/.test(n.id)) return;
  if (!n.cls.includes("hidden")) openTabs.push(n.id);
});

const defaultState = {
  openTab: openTabs[0] || "",
  visible: visibleScreens,
  allScreens: screens.map((s) => s.id),
};

// Đếm node / text để biết khối lượng thật.
let nodeCount = 0, textCount = 0, withId = 0;
const tagHist = {};
walk(tree, (n) => {
  nodeCount++;
  if (n.tag !== "#root") tagHist[n.tag] = (tagHist[n.tag] || 0) + 1;
  if (n.id) withId++;
  if (n.text) textCount++;
});

fs.mkdirSync(OUT_DIR, { recursive: true });

// 1. Toàn bộ cây — Unity dựng từ đây.
fs.writeFileSync(
  path.join(OUT_DIR, "uiTree.json"),
  JSON.stringify(tree),
  "utf8",
);

// 2. Danh sách màn hình + trạng thái hiển thị mặc định.
fs.writeFileSync(
  path.join(OUT_DIR, "uiScreens.json"),
  JSON.stringify({ screens, defaultState }, null, 1),
  "utf8",
);

console.log("=== TRÍCH UI PRODUCTION ===");
console.log("  Nguồn:            public/index.html (<body> tới <script> đầu)");
console.log("  Số node:          " + nodeCount);
console.log("  Node có id:       " + withId);
console.log("  Node có text:     " + textCount);
console.log("  Màn hình phát hiện: " + screens.length);
console.log("");
console.log("  Thẻ nhiều nhất:");
for (const [t, c] of Object.entries(tagHist).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log("    " + t.padEnd(10) + c);
}
console.log("");
console.log("  Màn hình:");
for (const s of screens) {
  console.log("    " + (s.hidden ? "(ẩn) " : "     ") + s.id);
}
console.log("");
console.log("  Ghi: unity-client/Assets/Artemis/Resources/ArtemisUi/");
