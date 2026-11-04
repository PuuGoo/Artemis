import fs from "node:fs";
const D = String.fromCharCode(36);
const T = String.fromCharCode(96);
let html = fs.readFileSync("index.html", "utf8");

function replaceExactly(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(label + ": expected exactly one match, found " + count);
  html = html.replace(oldText, newText);
}

const fusionOld = [
  "      // Check if an inventory item is eligible for Fusion (not equipped, not locked, not favorite, and has valid recipe)",
  "      function isItemEligibleForFusion(item, equippedUids = getEquippedUidSet()) {",
  "        if (!item || typeof item !== 'object') return false;",
  "        if (equippedUids.has(item.uid)) return false;",
  "        if (item.locked || item.favorite) return false;",
  "        const recipe = getFusionRecipe(item.quality, item.awakening || 0);",
  "        return Boolean(recipe);",
  "      }"
].join("\n");
const fusionNew = [
  "      // Gear with permanent investment must never be consumed accidentally.",
  "      // Protect locked/favorite items, tempered items and items holding valid gems.",
  "      function getGearProtectionReasons(item) {",
  "        if (!item || typeof item !== 'object') return [];",
  "        const reasons = [];",
  "        if (item.locked) reasons.push('đã khóa');",
  "        if (item.favorite) reasons.push('yêu thích');",
  "        const temperingLevel = Math.max(0, Math.min(10, Math.floor(Number(item.temperingLevel) || 0)));",
  "        if (temperingLevel > 0) reasons.push('tinh luyện +' + temperingLevel);",
  "        if (Array.isArray(item.sockets) && item.sockets.some(gemId => Boolean(GEM_META[gemId]))) {",
  "          reasons.push('đã khảm đá');",
  "        }",
  "        return reasons;",
  "      }",
  "",
  "      function isGearProtectedFromDestruction(item) {",
  "        return getGearProtectionReasons(item).length > 0;",
  "      }",
  "",
  "      // Check if an inventory item is eligible for Fusion.",
  "      function isItemEligibleForFusion(item, equippedUids = getEquippedUidSet()) {",
  "        if (!item || typeof item !== 'object') return false;",
  "        if (equippedUids.has(item.uid)) return false;",
  "        if (isGearProtectedFromDestruction(item)) return false;",
  "        const recipe = getFusionRecipe(item.quality, item.awakening || 0);",
  "        return Boolean(recipe);",
  "      }"
].join("\n");
replaceExactly(fusionOld, fusionNew, "fusion eligibility helper");

replaceExactly(
  [
    "          if (item.locked || item.favorite) {",
    "            groupsMap[key].protectedItems.push(item);",
    "          } else {",
    "            groupsMap[key].eligibleItems.push(item);",
    "          }"
  ].join("\n"),
  [
    "          if (isGearProtectedFromDestruction(item)) {",
    "            groupsMap[key].protectedItems.push(item);",
    "          } else {",
    "            groupsMap[key].eligibleItems.push(item);",
    "          }"
  ].join("\n"),
  "blacksmith grouping"
);
replaceExactly(
  "        const protectedInBagCount = SaveState.gearBag.filter(i => i && (i.locked || i.favorite)).length;",
  "        const protectedInBagCount = SaveState.gearBag.filter(i => i && isGearProtectedFromDestruction(i)).length;",
  "protected count"
);

const summaryOld = "        if (protEl) protEl.textContent = " + T +
  D + "{equippedCount + protectedInBagCount} món (" + D + "{equippedCount} Mặc, " +
  D + "{protectedInBagCount} 🔒/❤️)" + T + ";";
const summaryNew = "        if (protEl) protEl.textContent = " + T +
  D + "{equippedCount + protectedInBagCount} món (" + D + "{equippedCount} Mặc, " +
  D + "{protectedInBagCount} 🔒/❤️/⚒️/💎)" + T + ";";
replaceExactly(summaryOld, summaryNew, "protected summary");

const noteOld = [
  "          const protectedNote = g.protectedItems.length > 0",
  "            ? " + T + "<span class=\"text-amber-300 ml-1\">(+" + D + "{g.protectedItems.length} món 🔒/❤️ được bảo vệ)</span>" + T,
  "            : '';"
].join("\n");
const noteNew = [
  "          const protectedNote = g.protectedItems.length > 0",
  "            ? " + T + "<span class=\"text-amber-300 ml-1\">(+" + D + "{g.protectedItems.length} món 🔒/❤️/⚒️/💎 được bảo vệ)</span>" + T,
  "            : '';"
].join("\n");
replaceExactly(noteOld, noteNew, "protected note");

replaceExactly(
  "        const eligible=SaveState.gearBag.filter(i=>!i.locked&&!i.favorite&&!getEquippedUidSet().has(i.uid));",
  "        const eligible=SaveState.gearBag.filter(i=>!isGearProtectedFromDestruction(i)&&!getEquippedUidSet().has(i.uid));",
  "salvage eligible"
);
replaceExactly(
  "<p class=\"text-[10px] text-slate-400\">Chỉ phân rã đồ trong túi; đồ đang mặc, khóa hoặc yêu thích luôn được bảo vệ.</p>",
  "<p class=\"text-[10px] text-slate-400\">Chỉ phân rã đồ trong túi; đồ đang mặc, khóa, yêu thích, đã tinh luyện hoặc đã khảm đá đều được bảo vệ.</p>",
  "salvage explanation"
);
replaceExactly(
  "const chosen=SaveState.gearBag.filter(i=>ids.includes(i.uid)&&!i.locked&&!i.favorite&&!getEquippedUidSet().has(i.uid));",
  "const chosen=SaveState.gearBag.filter(i=>ids.includes(i.uid)&&!isGearProtectedFromDestruction(i)&&!getEquippedUidSet().has(i.uid));",
  "salvage confirmation"
);
replaceExactly(
  "SaveState.gearBag=SaveState.gearBag.filter(i=>!ids.includes(i.uid)||i.locked||i.favorite);",
  "const chosenItems=new Set(chosen);SaveState.gearBag=SaveState.gearBag.filter(i=>!chosenItems.has(i));",
  "salvage exact removal"
);

const cardOld = D + "{getGearSetId(item) ? " + T +
  "<span class=\"absolute bottom-1 right-1 z-10 text-[9px] bg-slate-950/80 rounded px-1\">" +
  D + "{GEAR_SET_META[getGearSetId(item)].icon}" +
  D + "{(item.sockets||[]).length?" + T + " 💎" + D + "{item.sockets.length}" + T + ":''}</span>" +
  T + " : ''}";
const cardNew = D + "{(getGearSetId(item) || (item.sockets||[]).length || Number(item.temperingLevel)>0) ? " + T +
  "<span class=\"absolute bottom-1 right-1 z-10 text-[9px] bg-slate-950/85 rounded px-1\" title=\"Bộ trang bị • Đá quý • Tinh luyện\">" +
  D + "{getGearSetId(item) ? GEAR_SET_META[getGearSetId(item)].icon : ''}" +
  D + "{(item.sockets||[]).length?" + T + " 💎" + D + "{item.sockets.length}" + T + " :''}" +
  D + "{Number(item.temperingLevel)>0 ? " + T + " ⚒️+" + D + "{Math.min(10, Math.floor(Number(item.temperingLevel)||0))}" + T + " :''}</span>" +
  T + " : ''}";
replaceExactly(cardOld, cardNew, "gear card badge");

let parsedInlineScripts = 0;
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
let match;
while ((match = scriptPattern.exec(html)) !== null) {
  const attrs = match[1] || "";
  const body = match[2] || "";
  if (/\bsrc\s*=/.test(attrs) || !body.trim()) continue;
  if (/\btype\s*=\s*["']?(application\/json|application\/ld\+json|text\/template)/i.test(attrs)) continue;
  parsedInlineScripts++;
}

const required = [
  "function isGearProtectedFromDestruction(item)",
  "if (isGearProtectedFromDestruction(item)) {",
  "filter(i => i && isGearProtectedFromDestruction(i))",
  "!isGearProtectedFromDestruction(i)&&!getEquippedUidSet().has(i.uid)",
  "ids.includes(i.uid)&&!isGearProtectedFromDestruction(i)",
  "const chosenItems=new Set(chosen);",
  "⚒️+" + D + "{Math.min(10, Math.floor(Number(item.temperingLevel)||0))}"
];
for (const token of required) {
  if (!html.includes(token)) throw new Error("Missing post-patch invariant: " + token);
}

fs.writeFileSync("index.html", html, "utf8");
console.log("Gear safety patch passed. Inline scripts located: " + parsedInlineScripts + ". index.html bytes: " + Buffer.byteLength(html, "utf8"));
