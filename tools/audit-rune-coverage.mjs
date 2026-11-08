// Ma trận bao phủ: giữ nguyên từng dòng nguồn, không suy diễn xác suất.
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}}; vm.runInNewContext(fs.readFileSync('public/rune-wiki-data.js','utf8'),context);
const verified={flame_poison_touch:{Epic:'combat-status: cháy 2s, không độc trước Legendary',Legendary:'combat-status: độc mở ở rank 7',Mythic:'combat-status: chu kỳ 1.5s'},rune_thunder:{Epic:'combat-status: sét 2s',Mythic:'combat-status: hai mục tiêu'},rune_flame:{Epic:'combat-status: fire ×1.5 trước flat +5',Legendary:'combat-status: poison ×1.5 trước flat +10'}};
const rows=Object.entries(context.window.RuneWikiData).map(([id,r])=>({id,name:r.name,type:r.type,effects:Object.entries(r.effects).map(([tier,text])=>({tier,text,status:'NOT TESTED',reason:'Chưa đối chiếu đường chạy thực tế.'})),enchantments:Object.entries(r.enchantments).map(([tier,text])=>({tier,text,status:'NOT TESTED',reason:'Chưa đối chiếu đường chạy thực tế.'})),sharedEnchantments:r.sharedEnchantments}));
for(const r of rows){
 for(const e of r.effects){
  const proof=verified[r.id]?.[e.tier];
  if(proof){e.status='PASS';e.reason=proof;e.scope='VM production damageEnemy/updateGame; không khẳng định parity đầy đủ';e.evidence=['tests/combat-status.test.mjs'];}
  if(r.id==='rune_flame'&&e.tier==='Mythic'){e.status='FAIL';e.reason='Nổ fire+poison mỗi giây chưa triển khai.';e.evidence=['public/js/game/runes/rune-workspace.js: combatNote','tests/combat-status.test.mjs'];}
 }
 r.sharedEnchantments=Object.entries(r.sharedEnchantments||{}).map(([tier,text])=>({tier,text,status:'NOT TESTED',reason:'Chưa phủ toàn bộ dòng bonus trên từng ngọc.'}));
 for(const e of r.enchantments)if(['sharp_arrow','rune_flame'].includes(r.id)&&e.tier==='Legendary')e.partialEvidence=['tests/rune-damage-handler.test.mjs: typed damage thật; chưa phủ đủ dòng đặc biệt'];
}
if(rows.length!==46 || new Set(rows.map(r=>r.id)).size!==46) throw Error('Danh mục không đủ 46 ngọc');
fs.mkdirSync('docs',{recursive:true});
fs.writeFileSync('docs/rune-coverage.json',JSON.stringify({source:context.window.RuneWikiSource.url,sourceParity:'46 loại từ snapshot hiện có; lượt này không đối chiếu lại Wiki live. Dữ liệu tham khảo không đồng nghĩa triển khai.',policy:'Không gán xác suất/công thức cho các mô tả định tính. Giá tiến cấp phù phép là quy tắc Artemis, không phải giá Wiki.',runes:rows},null,2)+'\n');
console.log('Coverage ledger:',rows.length,'unique runes');
