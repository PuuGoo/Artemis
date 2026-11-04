import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const file = 'index.html';
let content = fs.readFileSync(file, 'utf8');

function replaceExactly(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`Patch aborted: expected one match for "${label}", found ${count}.`);
  }
  return source.replace(oldText, newText);
}

const oldSalvage = "const chosen=SaveState.gearBag.filter(i=>ids.includes(i.uid)&&!i.locked&&!i.favorite&&!getEquippedUidSet().has(i.uid));if(!chosen.length)return;const rewards=chosen.reduce((n,i)=>n+Math.round((GEAR_QUALITIES[i.quality]?.order||1)*35+(i.level||1)*8),0);SaveState.gearBag=SaveState.gearBag.filter(i=>!ids.includes(i.uid)||i.locked||i.favorite);SaveState.gold+=rewards;SaveState.salvageMaterials=(SaveState.salvageMaterials||0)+chosen.length*1;";
const newSalvage = "const selectedIds=new Set(ids);const equippedUids=getEquippedUidSet();const chosen=SaveState.gearBag.filter(i=>selectedIds.has(i.uid)&&!i.locked&&!i.favorite&&!equippedUids.has(i.uid));if(!chosen.length){showToast('⚠️ Các món đã chọn không còn đủ điều kiện phân rã.');renderSalvageTool();return;}const consumedUids=new Set(chosen.map(i=>i.uid));if(consumedUids.size!==chosen.length){showToast('⚠️ Phát hiện UID trang bị trùng lặp. Đã hủy phân rã để bảo vệ kho đồ.');return;}const nextBag=SaveState.gearBag.filter(i=>!consumedUids.has(i.uid));if(SaveState.gearBag.length-nextBag.length!==chosen.length){showToast('⚠️ Dữ liệu kho đồ không nhất quán. Đã hủy phân rã.');return;}const rewards=chosen.reduce((n,i)=>n+Math.round((GEAR_QUALITIES[i.quality]?.order||1)*35+(i.level||1)*8),0);SaveState.gearBag=nextBag;SaveState.gold+=rewards;SaveState.salvageMaterials=(SaveState.salvageMaterials||0)+chosen.length*1;";
const oldMissing = "const missing = Object.entries(preset.slots || {}).filter(([slot, uid]) => !uid || !owned.has(uid) || GEAR_TEMPLATES[owned.get(uid)?.templateId]?.slot !== slot);";
const newMissing = "const presetSlots = preset.slots || {};\n        const presetUids = Object.values(presetSlots).filter(Boolean);\n        if (new Set(presetUids).size !== presetUids.length) { showToast('⚠️ Bộ lưu có trang bị trùng UID, không thể áp dụng an toàn.'); return; }\n        const missing = Object.entries(presetSlots).filter(([slot, uid]) => Boolean(uid) && (!owned.has(uid) || GEAR_TEMPLATES[owned.get(uid)?.templateId]?.slot !== slot));";
const oldWanted = "const wanted = new Set(Object.values(preset.slots));";
const newWanted = "const wanted = new Set(presetUids);";
const oldLoop = `          const uid = preset.slots[slot];
          const already = Object.values(SaveState.equippedGear || {}).find(x => x?.uid === uid);
          const picked = already || nextBag.find(x => x.uid === uid);
          if (!picked) { showToast('⚠️ Không tìm thấy trang bị trong kho.'); return; }
          nextEquipped[slot] = picked;`;
const newLoop = `          const uid = presetSlots[slot] || null;
          if (!uid) { nextEquipped[slot] = null; continue; }
          const already = Object.values(SaveState.equippedGear || {}).find(x => x?.uid === uid);
          const picked = already || nextBag.find(x => x.uid === uid);
          if (!picked) { showToast('⚠️ Không tìm thấy trang bị trong kho.'); return; }
          nextEquipped[slot] = picked;`;

content = replaceExactly(content, oldSalvage, newSalvage, 'bulk salvage revalidation');
content = replaceExactly(content, oldMissing, newMissing, 'partial loadout validation');
content = replaceExactly(content, oldWanted, newWanted, 'loadout selected UID set');
content = replaceExactly(content, oldLoop, newLoop, 'empty loadout slot handling');

if (!content.includes('const consumedUids=new Set(chosen.map(i=>i.uid))') ||
    !content.includes('if (!uid) { nextEquipped[slot] = null; continue; }')) {
  throw new Error('Post-patch verification failed.');
}

fs.writeFileSync(file, content, 'utf8');
console.log('Updated index.html with protected salvage and partial-loadout fixes.');

execFileSync('git', ['config', 'user.name', 'github-actions[bot]']);
execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git', ['rm', '-f', 'scripts/patch-gear-safety-once.mjs', '.github/workflows/gear-safety-patch.yml']);
execFileSync('git', ['add', 'index.html']);
execFileSync('git', ['commit', '-m', 'Harden gear salvage and fix partial loadout apply [skip ci]']);
execFileSync('git', ['push', 'origin', 'HEAD:main'], { stdio: 'inherit' });
