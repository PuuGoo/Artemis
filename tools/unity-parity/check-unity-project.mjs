#!/usr/bin/env node
// ==================== KIỂM TRA TÍNH NHẤT QUÁN CỦA DỰ ÁN UNITY ====================
// Máy này không có Unity Editor, nên không thể "mở project xem có lỗi không".
// Script này thay thế một phần việc đó: kiểm tra những lỗi mà Unity SẼ báo khi mở
// project, nhưng phát hiện được bằng đọc file.
//
// Chạy: node tools/unity-parity/check-unity-project.mjs
// Exit code 1 nếu có lỗi.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROJECT = path.join(ROOT, "unity-client");
const ASSETS = path.join(PROJECT, "Assets");

let pass = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { failures.push(name + (detail ? " -> " + detail : "")); console.log("  FAIL  " + name + (detail ? " -> " + detail : "")); }
}

function guidFor(relPath) {
  return crypto.createHash("md5").update("artemis-unity:" + relPath.replace(/\\/g, "/")).digest("hex");
}

function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith(".")) walkFiles(full, out); }
    else out.push(full);
  }
  return out;
}

console.log("=== 1. CẤU TRÚC DỰ ÁN ===");
check("ProjectVersion.txt tồn tại", fs.existsSync(path.join(PROJECT, "ProjectSettings", "ProjectVersion.txt")));
const pv = fs.existsSync(path.join(PROJECT, "ProjectSettings", "ProjectVersion.txt"))
  ? fs.readFileSync(path.join(PROJECT, "ProjectSettings", "ProjectVersion.txt"), "utf8") : "";
check("Khoá Unity 2022.3 LTS", /m_EditorVersion: 2022\.3\./.test(pv), pv.trim());

check("Packages/manifest.json hợp lệ", (() => {
  try { JSON.parse(fs.readFileSync(path.join(PROJECT, "Packages", "manifest.json"), "utf8")); return true; }
  catch { return false; }
})());

const manifest = JSON.parse(fs.readFileSync(path.join(PROJECT, "Packages", "manifest.json"), "utf8"));
for (const pkg of ["com.unity.inputsystem", "com.unity.test-framework", "com.unity.render-pipelines.universal"]) {
  check("manifest có " + pkg, !!manifest.dependencies[pkg]);
}

console.log("\n=== 2. META & GUID ===");
const allFiles = walkFiles(ASSETS);
const assetFiles = allFiles.filter((f) => !f.endsWith(".meta"));
const missingMeta = assetFiles.filter((f) => !fs.existsSync(f + ".meta"));
check("Mọi asset có .meta", missingMeta.length === 0,
  missingMeta.slice(0, 5).map((f) => path.relative(PROJECT, f)).join(", "));

// GUID phải duy nhất và khớp giá trị tất định (để chạy lại script không đổi).
const seen = new Map();
const guidMismatch = [];
const duplicateGuids = [];
for (const f of allFiles.filter((x) => x.endsWith(".meta"))) {
  const text = fs.readFileSync(f, "utf8");
  const m = text.match(/^guid: ([a-f0-9]{32})$/m);
  if (!m) continue;
  const guid = m[1];
  if (seen.has(guid)) duplicateGuids.push(path.relative(PROJECT, f) + " == " + seen.get(guid));
  seen.set(guid, path.relative(PROJECT, f));

  const target = f.slice(0, -5);
  const rel = path.relative(PROJECT, target).replace(/\\/g, "/");
  if (guid !== guidFor(rel)) guidMismatch.push(rel);
}
check("GUID không trùng", duplicateGuids.length === 0, duplicateGuids.slice(0, 3).join("; "));
check("GUID khớp hàm tất định", guidMismatch.length === 0, guidMismatch.slice(0, 3).join(", "));

console.log("\n=== 3. SCENE THAM CHIẾU SCRIPT THẬT ===");
const scenePath = path.join(ASSETS, "Artemis", "Scenes", "Bootstrap.unity");
check("Bootstrap.unity tồn tại", fs.existsSync(scenePath));

if (fs.existsSync(scenePath)) {
  const scene = fs.readFileSync(scenePath, "utf8");

  // Mọi GUID dạng script trong scene phải trỏ tới một .meta của file .cs.
  const scriptGuids = [...scene.matchAll(/m_Script: \{fileID: 11500000, guid: ([a-f0-9]{32})/g)]
    .map((m) => m[1]);
  check("Scene có component MonoBehaviour", scriptGuids.length > 0, scriptGuids.length + " component");

  const zeroGuid = "0".repeat(32);
  const unresolved = scriptGuids.filter((g) => g === zeroGuid);
  check("Không còn placeholder GUID 0", unresolved.length === 0,
    unresolved.length + " component chưa gán script");

  const brokenLinks = [];
  for (const g of new Set(scriptGuids)) {
    if (g === zeroGuid) continue;
    const meta = allFiles.find((f) => f.endsWith(".cs.meta") && fs.readFileSync(f, "utf8").includes("guid: " + g));
    if (!meta) brokenLinks.push(g);
  }
  check("Mọi GUID script trỏ tới .cs.meta tồn tại", brokenLinks.length === 0, brokenLinks.join(", "));

  // Camera phải orthographic — yêu cầu 2.5D top-down.
  check("Camera orthographic", /orthographic: 1/.test(scene));
  check("Build settings có scene", fs.existsSync(path.join(PROJECT, "ProjectSettings", "EditorBuildSettings.asset"))
    && fs.readFileSync(path.join(PROJECT, "ProjectSettings", "EditorBuildSettings.asset"), "utf8").includes("Bootstrap.unity"));
}

console.log("\n=== 4. ASMDEF ===");
const domainAsmdef = path.join(ASSETS, "Artemis", "Domain", "Artemis.Domain.asmdef");
check("Artemis.Domain.asmdef tồn tại", fs.existsSync(domainAsmdef));
if (fs.existsSync(domainAsmdef)) {
  const d = JSON.parse(fs.readFileSync(domainAsmdef, "utf8"));
  check("Domain KHÔNG tham chiếu UnityEngine (noEngineReferences)",
    d.noEngineReferences === true,
    "nếu false, domain có thể lén dùng UnityEngine và mất khả năng test bằng dotnet");
  check("Domain không reference asmdef nào",
    Array.isArray(d.references) && d.references.length === 0);
}

const runtimeAsmdef = path.join(ASSETS, "Artemis", "Scripts", "Artemis.Runtime.asmdef");
check("Artemis.Runtime.asmdef tồn tại", fs.existsSync(runtimeAsmdef));
if (fs.existsSync(runtimeAsmdef)) {
  const r = JSON.parse(fs.readFileSync(runtimeAsmdef, "utf8"));
  check("Runtime tham chiếu Artemis.Domain",
    Array.isArray(r.references) && r.references.includes("Artemis.Domain"));
}

console.log("\n=== 5. KHÔNG LẪN ENGINE VÀO DOMAIN ===");
const domainDir = path.join(ASSETS, "Artemis", "Domain");
const domainFiles = walkFiles(domainDir).filter((f) => f.endsWith(".cs"));
check("Domain có source", domainFiles.length > 0, domainFiles.length + " file");

const engineLeaks = [];
for (const f of domainFiles) {
  const text = fs.readFileSync(f, "utf8");
  if (/using\s+UnityEngine/.test(text) || /using\s+TMPro/.test(text)) {
    engineLeaks.push(path.relative(PROJECT, f));
  }
}
check("Không file domain nào dùng UnityEngine/TMPro", engineLeaks.length === 0, engineLeaks.join(", "));

console.log("\n=== 6. DỮ LIỆU GAME ===");
const dataDir = path.join(ASSETS, "Artemis", "Resources", "ArtemisData");
check("Resources/ArtemisData tồn tại", fs.existsSync(dataDir));
if (fs.existsSync(dataDir)) {
  const required = ["chapters", "gameModes", "heroes", "weapons", "pets", "talents", "skills",
    "gearQualities", "gearTemplates", "gearSlots", "fusionRecipes", "gems", "runes",
    "runeBaseStats", "gearSets", "heroSkins", "affixPool", "artifacts", "artifactSets",
    "bestiary", "starMilestones", "season", "garden", "plinko", "guild",
    "beginnerJourney", "achievements"];
  const missing = required.filter((n) => !fs.existsSync(path.join(dataDir, n + ".json")));
  check("Đủ " + required.length + " bảng dữ liệu", missing.length === 0, missing.join(", "));

  // Mọi file phải parse được.
  const badJson = [];
  for (const f of fs.readdirSync(dataDir).filter((x) => x.endsWith(".json"))) {
    try { JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8")); }
    catch { badJson.push(f); }
  }
  check("Mọi JSON parse được", badJson.length === 0, badJson.join(", "));

  // Số lượng mục phải khớp bản web (khoá hồi quy đếm).
  const counts = {
    heroes: 18, weapons: 3, pets: 3, skills: 72, talents: 32, runes: 46,
    artifacts: 46, artifactSets: 13, bestiary: 16, achievements: 25,
    beginnerJourney: 8, fusionRecipes: 15, chapters: 5, gameModes: 5,
  };
  const countIssues = [];
  for (const [name, expected] of Object.entries(counts)) {
    const p = path.join(dataDir, name + ".json");
    if (!fs.existsSync(p)) continue;
    const arr = JSON.parse(fs.readFileSync(p, "utf8"));
    const n = Array.isArray(arr) ? arr.length : Object.keys(arr).length;
    if (n !== expected) countIssues.push(name + ": " + n + " (mong đợi " + expected + ")");
  }
  check("Số mục dữ liệu khớp bản web", countIssues.length === 0, countIssues.join("; "));
}

console.log("\n=== KẾT QUẢ ===");
console.log(pass + " PASS, " + failures.length + " FAIL");
if (failures.length) {
  console.log("\nLỗi:");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
