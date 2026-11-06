#!/usr/bin/env node
// ==================== SINH .META CHO DỰ ÁN UNITY ====================
// Unity nhận diện asset qua GUID trong file .meta. Một scene viết tay chỉ hoạt
// động nếu GUID của MonoBehaviour khớp GUID trong .meta của script tương ứng.
//
// Script này sinh .meta với GUID TẤT ĐỊNH (md5 của đường dẫn tương đối) cho mọi
// asset cần thiết, rồi vá lại GUID trong scene. Nhờ vậy scene không phải "mở ra
// rồi kéo thả lại bằng tay" mới chạy được.
//
// Chạy: node tools/unity-parity/gen-unity-meta.mjs
// Idempotent: chạy lại không đổi GUID đã có.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROJECT = path.join(ROOT, "unity-client");
const ASSETS = path.join(PROJECT, "Assets");

/** GUID tất định từ đường dẫn tương đối trong project. */
function guidFor(relPath) {
  return crypto.createHash("md5").update("artemis-unity:" + relPath.replace(/\\/g, "/")).digest("hex");
}

const META_TEMPLATES = {
  folder: (guid) => `fileFormatVersion: 2
guid: ${guid}
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`,
  cs: (guid) => `fileFormatVersion: 2
guid: ${guid}
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`,
  json: (guid) => `fileFormatVersion: 2
guid: ${guid}
TextScriptImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`,
  asmdef: (guid) => `fileFormatVersion: 2
guid: ${guid}
AssemblyDefinitionImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`,
  unity: (guid) => `fileFormatVersion: 2
guid: ${guid}
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`,
};

function kindOf(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".cs") return "cs";
  if (ext === ".json") return "json";
  if (ext === ".asmdef") return "asmdef";
  if (ext === ".unity") return "unity";
  return null;
}

/** Duyệt đệ quy, sinh .meta cho folder + file cần thiết. */
function walk(dir, written) {
  const relDir = path.relative(PROJECT, dir).replace(/\\/g, "/");

  // .meta cho thư mục (trừ chính Assets).
  if (relDir !== "Assets") {
    const metaPath = dir + ".meta";
    if (!fs.existsSync(metaPath)) {
      fs.writeFileSync(metaPath, META_TEMPLATES.folder(guidFor(relDir)), "utf8");
      written.push(path.relative(PROJECT, metaPath));
    }
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".")) continue;
      walk(full, written);
      continue;
    }
    const kind = kindOf(entry.name);
    if (!kind) continue;
    const metaPath = full + ".meta";
    if (fs.existsSync(metaPath)) continue;
    const rel = path.relative(PROJECT, full).replace(/\\/g, "/");
    fs.writeFileSync(metaPath, META_TEMPLATES[kind](guidFor(rel)), "utf8");
    written.push(rel + ".meta");
  }
}

const written = [];
walk(ASSETS, written);
console.log("Đã sinh " + written.length + " file .meta.");

// ==================== Vá GUID trong scene ====================
// MonoBehaviour trong scene cần trỏ đúng script. Ta đọc danh sách script cần
// gắn, lấy GUID của chúng, rồi thay các placeholder theo thứ tự.
const SCENE = path.join(ASSETS, "Artemis", "Scenes", "Bootstrap.unity");

/** Script gắn lên GameObject GameBootstrap, ĐÚNG thứ tự khối MonoBehaviour trong scene. */
const BOOTSTRAP_SCRIPTS = [
  "GameBootstrap",              // 100002
  "RoomController",             // 100003
  "CombatHud",                  // 100004
  "AuthScreen",                 // 100005
  "CombatController",           // 100006
  "PlayerStatsBehaviour",       // 100007
];

function findScript(className) {
  const dir = path.join(ASSETS, "Artemis", "Scripts");
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      if (!e.name.endsWith(".cs")) continue;
      const text = fs.readFileSync(full, "utf8");
      if (new RegExp("class\\s+" + className + "\\b").test(text)) {
        const rel = path.relative(PROJECT, full).replace(/\\/g, "/");
        return guidFor(rel);
      }
    }
  }
  return null;
}

const PLAYER_SCRIPTS = ["PlayerController"];

if (fs.existsSync(SCENE)) {
  let scene = fs.readFileSync(SCENE, "utf8");
  const ZERO = "guid: 00000000000000000000000000000000";

  // Thay lần lượt từng placeholder 0-guid bằng GUID thật, theo thứ tự khối.
  const order = [
    ...BOOTSTRAP_SCRIPTS.map((c) => ({ className: c })),
    ...PLAYER_SCRIPTS.map((c) => ({ className: c })),
  ];

  let replaced = 0;
  let idx = 0;
  scene = scene.replace(new RegExp(ZERO, "g"), () => {
    if (idx >= order.length) return ZERO;
    const guid = findScript(order[idx].className);
    idx++;
    if (!guid) return ZERO;
    replaced++;
    return "guid: " + guid;
  });

  fs.writeFileSync(SCENE, scene, "utf8");

  // Cảnh báo chỉ có ý nghĩa nếu THẬT SỰ còn placeholder 0-guid trỏ tới script.
  // (Lần chạy thứ hai sẽ thay 0 chỗ vì đã vá rồi — đó là trạng thái đúng.)
  const remainingZero = (scene.match(/m_Script: \{fileID: 11500000, guid: 0{32}/g) || []).length;
  if (replaced > 0) {
    console.log("Đã vá " + replaced + " GUID script trong " + path.relative(PROJECT, SCENE));
  } else {
    console.log("Scene đã có GUID script (không cần vá): " + path.relative(PROJECT, SCENE));
  }
  if (remainingZero > 0) {
    console.warn("CẢNH BÁO: còn " + remainingZero + " component chưa gán script — scene sẽ thiếu component khi mở trong Unity.");
  }
}

// ==================== ProjectSettings tối thiểu ====================
const PROJECT_SETTINGS = {
  "EditorBuildSettings.asset": `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!1045 &1
EditorBuildSettings:
  m_ObjectHideFlags: 0
  serializedVersion: 2
  m_Scenes:
  - enabled: 1
    path: Assets/Artemis/Scenes/Bootstrap.unity
    guid: ${guidFor("Assets/Artemis/Scenes/Bootstrap.unity")}
  m_configObjects: {}
`,
  "TagManager.asset": `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!78 &1
TagManager:
  serializedVersion: 2
  tags:
  - Enemy
  - Projectile
  layers:
  - Default
  - TransparentFX
  - Ignore Raycast
  - 
  - Water
  - UI
  - Obstacle
  m_SortingLayers:
  - name: Default
    uniqueID: 0
    locked: 0
  m_RenderingLayers:
  - Default
`,
};

for (const [name, content] of Object.entries(PROJECT_SETTINGS)) {
  const p = path.join(PROJECT, "ProjectSettings", name);
  if (fs.existsSync(p)) continue;
  fs.writeFileSync(p, content, "utf8");
  console.log("Đã tạo ProjectSettings/" + name);
}

console.log("\nXong.");
