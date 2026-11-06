#!/usr/bin/env node
// ==================== TRÍCH THEME PRODUCTION -> DỮ LIỆU CHO UNITY ====================
//
// Production dùng Tailwind. Unity không có Tailwind, nên phải quy đổi:
//
//   Tailwind class  ->  giá trị cụ thể (màu hex, px, enum căn chỉnh...)
//
// Script này sinh theme.json chứa:
//   colors   : mọi màu Tailwind thực dùng (bg-*, text-*, border-*) đã quy về hex
//   spacing  : p-*, m-*, gap-*, w-*, h-* đã quy về px (thang 4px của Tailwind)
//   fontSize : text-xs, text-[11px]... -> px
//   radius   : rounded-* -> px
//   fonts    : font-family thật trong CSS
//   gradients: các class gradient tự định nghĩa (gold-gradient, epic-gradient...)
//
// Nhờ vậy Unity vẽ ra ĐÚNG màu/kích thước production, không phải tôi đoán.
//
// Chạy: node tools/unity-ui/extract-theme.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SRC = path.join(REPO, "public", "index.html");
const OUT_DIR = path.join(REPO, "unity-client", "Assets", "Artemis", "Resources", "ArtemisUi");

const src = fs.readFileSync(SRC, "utf8");
const b0 = src.indexOf("<body");
const b1 = src.indexOf("<script", b0);
const html = src.slice(b0, b1);

// ---------- Bảng màu Tailwind (đúng spec v3) ----------
// Chỉ cần các họ màu production thật dùng, nhưng để đủ cho tiện.
const PALETTE = {
  slate:   { 50:"f8fafc",100:"f1f5f9",200:"e2e8f0",300:"cbd5e1",400:"94a3b8",500:"64748b",600:"475569",700:"334155",800:"1e293b",900:"0f172a",950:"020617" },
  gray:    { 50:"f9fafb",100:"f3f4f6",200:"e5e7eb",300:"d1d5db",400:"9ca3af",500:"6b7280",600:"4b5563",700:"374151",800:"1f2937",900:"111827",950:"030712" },
  zinc:    { 50:"fafafa",100:"f4f4f5",200:"e4e4e7",300:"d4d4d8",400:"a1a1aa",500:"71717a",600:"52525b",700:"3f3f46",800:"27272a",900:"18181b",950:"09090b" },
  amber:   { 50:"fffbeb",100:"fef3c7",200:"fde68a",300:"fcd34d",400:"fbbf24",500:"f59e0b",600:"d97706",700:"b45309",800:"92400e",900:"78350f",950:"451a03" },
  yellow:  { 50:"fefce8",100:"fef9c3",200:"fef08a",300:"fde047",400:"facc15",500:"eab308",600:"ca8a04",700:"a16207",800:"854d0e",900:"713f12",950:"422006" },
  emerald: { 50:"ecfdf5",100:"d1fae5",200:"a7f3d0",300:"6ee7b7",400:"34d399",500:"10b981",600:"059669",700:"047857",800:"065f46",900:"064e3b",950:"022c22" },
  green:   { 50:"f0fdf4",100:"dcfce7",200:"bbf7d0",300:"86efac",400:"4ade80",500:"22c55e",600:"16a34a",700:"15803d",800:"166534",900:"14532d",950:"052e16" },
  sky:     { 50:"f0f9ff",100:"e0f2fe",200:"bae6fd",300:"7dd3fc",400:"38bdf8",500:"0ea5e9",600:"0284c7",700:"0369a1",800:"075985",900:"0c4a6e",950:"082f49" },
  blue:    { 50:"eff6ff",100:"dbeafe",200:"bfdbfe",300:"93c5fd",400:"60a5fa",500:"3b82f6",600:"2563eb",700:"1d4ed8",800:"1e40af",900:"1e3a8a",950:"172554" },
  indigo:  { 50:"eef2ff",100:"e0e7ff",200:"c7d2fe",300:"a5b4fc",400:"818cf8",500:"6366f1",600:"4f46e5",700:"4338ca",800:"3730a3",900:"312e81",950:"1e1b4b" },
  violet:  { 50:"f5f3ff",100:"ede9fe",200:"ddd6fe",300:"c4b5fd",400:"a78bfa",500:"8b5cf6",600:"7c3aed",700:"6d28d9",800:"5b21b6",900:"4c1d95",950:"2e1065" },
  purple:  { 50:"faf5ff",100:"f3e8ff",200:"e9d5ff",300:"d8b4fe",400:"c084fc",500:"a855f7",600:"9333ea",700:"7e22ce",800:"6b21a8",900:"581c87",950:"3b0764" },
  rose:    { 50:"fff1f2",100:"ffe4e6",200:"fecdd3",300:"fda4af",400:"fb7185",500:"f43f5e",600:"e11d48",700:"be123c",800:"9f1239",900:"881337",950:"4c0519" },
  red:     { 50:"fef2f2",100:"fee2e2",200:"fecaca",300:"fca5a5",400:"f87171",500:"ef4444",600:"dc2626",700:"b91c1c",800:"991b1b",900:"7f1d1d",950:"450a0a" },
  orange:  { 50:"fff7ed",100:"ffedd5",200:"fed7aa",300:"fdba74",400:"fb923c",500:"f97316",600:"ea580c",700:"c2410c",800:"9a3412",900:"7c2d12",950:"431407" },
  teal:    { 50:"f0fdfa",100:"ccfbf1",200:"99f6e4",300:"5eead4",400:"2dd4bf",500:"14b8a6",600:"0d9488",700:"0f766e",800:"115e59",900:"134e4a",950:"042f2e" },
  cyan:    { 50:"ecfeff",100:"cffafe",200:"a5f3fc",300:"67e8f9",400:"22d3ee",500:"06b6d4",600:"0891b2",700:"0e7490",800:"155e75",900:"164e63",950:"083344" },
  pink:    { 50:"fdf2f8",100:"fce7f3",200:"fbcfe8",300:"f9a8d4",400:"f472b6",500:"ec4899",600:"db2777",700:"be185d",800:"9d174d",900:"831843",950:"500724" },
  fuchsia: { 50:"fdf4ff",100:"fae8ff",200:"f5d0fe",300:"f0abfc",400:"e879f9",500:"d946ef",600:"c026d3",700:"a21caf",800:"86198f",900:"701a75",950:"4a044e" },
  lime:    { 50:"f7fee7",100:"ecfccb",200:"d9f99d",300:"bef264",400:"a3e635",500:"84cc16",600:"65a30d",700:"4d7c0f",800:"3f6212",900:"365314",950:"1a2e05" },
};
const NEUTRAL = { white: "ffffff", black: "000000", transparent: null };

// Thang khoảng cách Tailwind (đơn vị rem, 1 = 0.25rem = 4px ở root 16px)
const SPACE = {
  "0":"0","0.5":"2","1":"4","1.5":"6","2":"8","2.5":"10","3":"12","3.5":"14","4":"16",
  "5":"20","6":"24","7":"28","8":"32","9":"36","10":"40","11":"44","12":"48","14":"56",
  "16":"64","20":"80","24":"96","28":"112","32":"128","36":"144","40":"160","44":"176",
  "48":"192","52":"208","56":"224","60":"240","64":"256","72":"288","80":"320","96":"384",
};

const RADIUS = { none:"0", sm:"2", "":"4", md:"6", lg:"8", xl:"12", "2xl":"16", "3xl":"24", full:"9999" };

const FONTSIZE = {
  xs:["12","16"], sm:["14","20"], base:["16","24"], lg:["18","28"],
  xl:["20","28"], "2xl":["24","32"], "3xl":["30","36"], "4xl":["36","40"],
  "5xl":["48","48"], "6xl":["60","60"], "7xl":["72","72"],
  "8xl":["96","96"], "9xl":["128","128"],
};

// ---------- Quét class thực dùng ----------

const used = new Set();
for (const m of html.matchAll(/class="([^"]*)"/g)) {
  for (const c of m[1].split(/\s+/)) if (c) used.add(c);
}

function hexOf(family, shade) {
  if (NEUTRAL[family] !== undefined) return NEUTRAL[family];
  const fam = PALETTE[family];
  if (!fam) return undefined;
  return fam[shade] ?? undefined;
}

function parseColor(cls, prefix) {
  // bg-amber-400/60 | text-white | border-slate-800
  // Và dạng arbitrary: bg-[#0b132b] / text-[#fde047] / border-[#26364d]
  const arb = cls.match(new RegExp("^" + prefix + "-\\[#([0-9a-fA-F]{3,8})\\](?:/(\\d{1,3}))?$"));
  if (arb) {
    return {
      family: "arbitrary",
      shade: "",
      hex: arb[1],
      alpha: arb[2] ? Number(arb[2]) / 100 : 1,
    };
  }

  const m = cls.match(new RegExp("^" + prefix + "-([a-z]+)(?:-(\\d{2,3}))?(?:/(\\d{1,3}))?$"));
  if (!m) return null;
  const [, family, shade, alpha] = m;
  const hex = hexOf(family, shade || "500");
  if (hex === undefined) return null;
  return { family, shade: shade || "", hex, alpha: alpha ? Number(alpha) / 100 : 1 };
}

const colors = {};
const spacing = {};
const fontSize = {};
const radius = {};
const custom = {};

for (const c of used) {
  // bỏ biến thể responsive
  const base = c.replace(/^(sm|md|lg|xl|2xl|hover|focus|active|disabled|group-hover):/, "");

  for (const p of ["bg", "text", "border"]) {
    const cr = parseColor(base, p);
    if (cr) { colors[base] = cr; break; }
  }

  // text-xs / text-[11px] / text-[10px]
  let m = base.match(/^text-(\d+xl|xs|sm|base|lg|xl)$/);
  if (m && FONTSIZE[m[1]]) { fontSize[base] = { size: FONTSIZE[m[1]][0], line: FONTSIZE[m[1]][1] }; }
  m = base.match(/^text-\[(\d+(?:\.\d+)?)px\]$/);
  if (m) fontSize[base] = { size: m[1], line: String(Math.round(Number(m[1]) * 1.4)) };

  // spacing: p-4 / px-2.5 / m-3 / gap-2 / w-16 / h-11 / top-1 / inset-0
  m = base.match(/^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y)-([\d.]+)$/);
  if (m && SPACE[m[2]] !== undefined) spacing[base] = { kind: m[1], px: SPACE[m[2]] };
  m = base.match(/^(w|h|min-w|max-w|min-h)-([\d.]+)$/);
  if (m && SPACE[m[2]] !== undefined) spacing[base] = { kind: m[1], px: SPACE[m[2]] };
  m = base.match(/^(top|left|right|bottom|inset)-([\d.]+)$/);
  if (m && SPACE[m[2]] !== undefined) spacing[base] = { kind: m[1], px: SPACE[m[2]] };

  // rounded
  m = base.match(/^rounded(?:-(\w+))?$/);
  if (m) { const k = m[1] || ""; if (RADIUS[k] !== undefined) radius[base] = RADIUS[k]; }

  // class tự định nghĩa (a2-*, gold-gradient, hd-panel...)
  if (/^(a2-|gold-|epic-|rare-|common-|legend-|hd-|cyber-|animate-|glow-|card-shine)/.test(base)) {
    custom[base] = true;
  }
}

// ---------- Gradient tự định nghĩa: đọc thẳng từ <style> ----------

const styleBlock = src.slice(src.indexOf("<style"), src.indexOf("</style>"));
const gradients = {};
for (const m of styleBlock.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
  const [, name, body] = m;
  const g = body.match(/background\s*:\s*linear-gradient\(([^;]+)\)/);
  if (!g) continue;
  const stops = [...g[1].matchAll(/#([0-9a-fA-F]{3,8})/g)].map((x) => x[1]);
  if (stops.length >= 2) gradients[name] = { stops };
}

// from-[#hex] / to-[#hex] / via-[#hex] (giá trị tuỳ ý) cũng phải có trong bảng
// gradient, nếu không Unity sẽ bỏ qua và mất dải màu — đã thấy trong ảnh chụp.
for (const c of used) {
  const base = c.replace(/^(sm|md|lg|xl|2xl|hover|focus):/, "");
  const m = base.match(/^(from|to|via)-\[#([0-9a-fA-F]{3,8})\]$/);
  if (m) {
    if (!colors[base]) colors[base] = { family: "arbitrary", shade: "", hex: m[2], alpha: 1 };
  }
}

// ---------- Font thật ----------

const fontFamilies = [...new Set([...src.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim()))];
const fontLinks = [...src.matchAll(/fonts\.googleapis\.com[^"']*/g)].map((m) => m[0]);

// ---------- Body background ----------

const bodyBg = (styleBlock.match(/body\s*\{[^}]*background:\s*([^;]+);/) || [])[1] || "";

const theme = {
  colors,
  spacing,
  fontSize,
  radius,
  custom: Object.keys(custom).sort(),
  gradients,
  fonts: { families: fontFamilies, links: fontLinks },
  bodyBackground: bodyBg.trim(),
  counts: {
    classesUsed: used.size,
    colors: Object.keys(colors).length,
    spacing: Object.keys(spacing).length,
    fontSize: Object.keys(fontSize).length,
    radius: Object.keys(radius).length,
    custom: Object.keys(custom).length,
    gradients: Object.keys(gradients).length,
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "uiTheme.json"), JSON.stringify(theme, null, 1), "utf8");

console.log("=== TRÍCH THEME PRODUCTION ===");
for (const [k, v] of Object.entries(theme.counts)) console.log("  " + k.padEnd(14) + v);
console.log("");
console.log("  Font: " + fontFamilies.join(" | "));
console.log("  Body background: " + bodyBg.trim().slice(0, 90));
console.log("");
console.log("  Gradient tự định nghĩa:");
for (const [k, v] of Object.entries(gradients)) {
  console.log("    " + k.padEnd(18) + "#" + v.stops.join(" #"));
}
