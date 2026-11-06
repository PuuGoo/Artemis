// ==================== KIỂM TRA TÍNH HỢP LỆ CỦA DỮ LIỆU BIOME ====================
//
// Vì sao có file này: Biome chương 6 từng dùng `props: ['icicles']` — nhưng
// `icicles` chỉ tồn tại trong WALLPROP, không có trong PROP. Khi vào phòng có
// biome đó, buildStatic gọi PROP['icicles'] -> "TypeError: PROP[id] is not a
// function", làm renderGame ném lỗi mỗi frame và toàn bộ sân thành đen.
//
// Cách chặn: đọc thẳng registry PROP / WALLPROP / OBSTACLES từ source rồi đối
// chiếu với mọi biome. Chạy trong CI hoặc trước khi commit.
//
// Chạy: node tools/validate-biomes.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "public", "index.html");

const src = fs.readFileSync(SRC, "utf8");
const lines = src.split("\n");

/** Lấy tập key của một object literal bắt đầu ở dòng (1-based). */
function objectKeysAt(startLine) {
  const start = startLine - 1;
  let depth = 0;
  let end = start;
  for (let i = start; i < Math.min(start + 500, lines.length); i++) {
    depth += lines[i].count ? lines[i].count("{") : (lines[i].match(/{/g) || []).length;
    depth -= lines[i].count ? lines[i].count("}") : (lines[i].match(/}/g) || []).length;
    if (i > start && depth <= 0) { end = i; break; }
  }
  const block = lines.slice(start, end + 1).join("\n");
  // key ở mức thụt 4 dấu cách: "    name(...)" hoặc "    name:"
  return new Set([...block.matchAll(/^\s{4}([a-zA-Z_$][\w$]*)\s*[:(]/gm)].map((m) => m[1]));
}

function findLine(pattern) {
  for (let i = 0; i < lines.length; i++) if (pattern.test(lines[i])) return i + 1;
  return 0;
}

const fail = [];
const pass = [];

function check(name, cond, detail) {
  if (cond) pass.push(name);
  else fail.push(name + (detail ? "  -> " + detail : ""));
}

// ---------- 1. Tìm registry ----------

const propLine = findLine(/^\s*const PROP = \{/);
const wallLine = findLine(/^\s*const WALLPROP = \{/);
const obstLine = findLine(/^\s*const OBSTACLE = \{/) || findLine(/^\s*const OBST = \{/);

check("tìm thấy PROP", propLine > 0, "dòng " + propLine);
check("tìm thấy WALLPROP", wallLine > 0, "dòng " + wallLine);

const PROP = propLine ? objectKeysAt(propLine) : new Set();
const WALLPROP = wallLine ? objectKeysAt(wallLine) : new Set();
const OBST = obstLine ? objectKeysAt(obstLine) : new Set();

console.log("=== REGISTRY ===");
console.log("  PROP:     " + PROP.size + "  " + [...PROP].sort().join(", "));
console.log("  WALLPROP: " + WALLPROP.size + "  " + [...WALLPROP].sort().join(", "));
if (OBST.size) console.log("  OBST:" + OBST.size);
console.log("");

// ---------- 2. Đối chiếu từng biome ----------

// def('id', { ... });  — body có thể trải nhiều dòng
const defs = [];
const re = /def\('([a-z0-9_]+)',\s*\{([\s\S]*?)\}\);/g;
let m;
while ((m = re.exec(src))) defs.push({ id: m[1], body: m[2] });

console.log("=== BIOME: " + defs.length + " ===");

const issues = [];
for (const d of defs) {
  const pm = d.body.match(/props:\s*\[([^\]]*)\]/);
  const wm = d.body.match(/wallProps:\s*\[([^\]]*)\]/);
  const om = d.body.match(/obstacles:\s*\[([^\]]*)\]/);

  if (pm) {
    for (const p of [...pm[1].matchAll(/'([a-zA-Z_$][\w$]*)'/g)].map((x) => x[1])) {
      if (!PROP.has(p)) issues.push({ biome: d.id, field: "props", name: p });
    }
  }
  if (wm) {
    for (const p of [...wm[1].matchAll(/'([a-zA-Z_$][\w$]*)'/g)].map((x) => x[1])) {
      if (!WALLPROP.has(p)) issues.push({ biome: d.id, field: "wallProps", name: p });
    }
  }
  if (om && OBST.size) {
    for (const p of [...om[1].matchAll(/'([a-zA-Z_$][\w$]*)'/g)].map((x) => x[1])) {
      if (!OBST.has(p)) issues.push({ biome: d.id, field: "obstacles", name: p });
    }
  }
}

if (issues.length === 0) {
  console.log("  Mọi biome dùng prop/wallProp/obstacle hợp lệ");
  pass.push("mọi biome dùng prop hợp lệ");
} else {
  for (const i of issues) {
    console.log("  ❌ " + i.biome + "." + i.field + " -> '" + i.name + "' KHÔNG tồn tại");
    fail.push(i.biome + "." + i.field + " = '" + i.name + "' không có trong registry");
  }
}

// ---------- 3. Kiểm tra POOLS trỏ tới biome có thật ----------

console.log("");
console.log("=== POOLS ===");
const defined = new Set(defs.map((d) => d.id));
const poolMatch = src.match(/const POOLS = \{([\s\S]*?)\};/);
if (poolMatch) {
  const entries = [...poolMatch[1].matchAll(/(\d+):\s*\[([^\]]*)\]/g)];
  for (const [, ch, body] of entries) {
    const ids = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
    const missing = ids.filter((id) => !defined.has(id));
    if (missing.length) {
      console.log("  ❌ POOLS[" + ch + "] trỏ tới biome không tồn tại: " + missing.join(", "));
      fail.push("POOLS[" + ch + "] có biome không tồn tại: " + missing.join(","));
    } else {
      console.log("  ✅ POOLS[" + ch + "]: " + ids.join(", "));
      pass.push("POOLS[" + ch + "] hợp lệ");
    }
  }
}

// POOL_ALL
const poolAll = src.match(/const POOL_ALL = \[([^\]]*)\]/);
if (poolAll) {
  const ids = [...poolAll[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
  const missing = ids.filter((id) => !defined.has(id));
  check("POOL_ALL chỉ chứa biome có thật", missing.length === 0, missing.join(","));
}

// BOSS_ARENA
const bossArena = src.match(/const BOSS_ARENA = \{([^}]*)\}/);
if (bossArena) {
  const entries = [...bossArena[1].matchAll(/(\w+):\s*'([a-z0-9_]+)'/g)];
  const missing = entries.filter(([, , arena]) => !defined.has(arena));
  check("BOSS_ARENA trỏ tới arena có thật", missing.length === 0,
    missing.map(([b, , a]) => b + "->" + a).join(", "));
}

// ---------- 4. Đối chiếu loại quái/boss có hàm vẽ ----------

console.log("");
console.log("=== HÀM VẼ QUÁI ===");
// drawBody dispatch
const bodyStart = findLine(/function drawBody\(ctx, e, t, B, v\)/);
const bodyBlock = bodyStart
  ? lines.slice(bodyStart - 1, bodyStart + 60).join("\n")
  : "";
const dispatched = new Set(
  [...bodyBlock.matchAll(/ty === '([a-z0-9_]+)'/g)].map((x) => x[1]),
);

// BOSSFN keys
const bossFnMatch = src.match(/const BOSSFN = \{([\s\S]*?)\};/);
const bossKeys = bossFnMatch
  ? new Set([...bossFnMatch[1].matchAll(/(\w+):\s*draw\w+/g)].map((x) => x[1]))
  : new Set();

// Mọi loại quái được spawn trong setupRoom
const spawnBlocks = [...src.matchAll(/\[\s*'([a-z0-9_]+)',\s*'([a-z0-9_]+)',\s*'([a-z0-9_]+)'\s*\]/g)];
const spawned = new Set();
for (const b of spawnBlocks) { spawned.add(b[1]); spawned.add(b[2]); spawned.add(b[3]); }

// Chỉ kiểm tra các loại nằm trong danh sách spawn của chương 4/5/6 (có hàm vẽ riêng)
const customTypes = [...spawned].filter((t) =>
  ["dragon_whelp", "cloud_wisp", "sky_sentinel",
   "rift_stalker", "eclipse_oracle", "obsidian_brute",
   "nebula_herald", "frost_sentinel", "star_wraith"].includes(t));

console.log("  quái có hàm vẽ riêng:", customTypes.join(", "));
const missingDraw = customTypes.filter((t) => !dispatched.has(t));
check("mọi quái chương 4-6 có nhánh vẽ trong drawBody",
  missingDraw.length === 0, missingDraw.join(","));

// Boss
console.log("  boss có hàm vẽ:", [...bossKeys].join(", "));
const bossTypes = new Set(["golem", "queen", "demon_king", "elder_dragon", "eclipse_sovereign", "astral_devourer"]);
const missingBoss = [...bossTypes].filter((b) => !bossKeys.has(b));
check("mọi boss có trong BOSSFN", missingBoss.length === 0, missingBoss.join(","));

// AURA_T phải có đủ
const auraMatch = src.match(/const AURA_T = \{([\s\S]*?)\};/);
if (auraMatch) {
  const auraKeys = new Set([...auraMatch[1].matchAll(/(\w+):/g)].map((x) => x[1]));
  const needAura = [...customTypes, ...bossTypes];
  const missingAura = needAura.filter((t) => !auraKeys.has(t));
  check("AURA_T có đủ quái/boss mới", missingAura.length === 0, missingAura.join(","));
}

// ---------- Kết quả ----------

console.log("");
console.log("=== KẾT QUẢ ===");
console.log(pass.length + " PASS, " + fail.length + " FAIL");
if (fail.length) {
  console.log("");
  for (const f of fail) console.log("  ❌ " + f);
  process.exit(1);
}
