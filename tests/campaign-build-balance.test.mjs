import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';
const result = spawnSync(process.execPath, ['--max-old-space-size=192', 'tools/campaign-balance-sim.mjs', '--json'], {cwd:new URL('../', import.meta.url), encoding:'utf8', timeout:40000,maxBuffer:32*1024*1024});
assert.equal(result.status,0,result.stderr);
const report=JSON.parse(result.stdout);
test('ma trận build thật giữ nguồn 7 hồ sơ, 19 chương và 12 mốc; có Common/Rare và Legend',()=>{
 assert.ok(Array.isArray(report.builds), 'Thiếu build production');
 assert.equal(report.profiles.length,7);
 assert.deepEqual(report.milestones,[1,5,10,15,20,25,30,35,40,45,49,50]);
 for(const id of ['none','common-rare-good','common-rare-weak','legend-good','legend-defense']) assert.ok(report.builds.some(b=>b.id===id),id);
 assert.equal(report.buildRows.length,report.rows.length*report.builds.length);
 for(const r of report.buildRows) assert.ok(Number.isFinite(r.dps)&&r.dps>0);
});
test('DPS và HP build đối chiếu độc lập catalogue, multiplier và resolver production',()=>{
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const section=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return html.slice(a,b+end.length);};
 const sandbox={};vm.runInNewContext(fs.readFileSync(new URL('../public/combat-damage.js',import.meta.url),'utf8'),sandbox);
 const skills=vm.runInNewContext(section('const ROGUE_SKILLS = [','\n      ];')+'\nROGUE_SKILLS;',{});
 const formula=section('function computeWikiSkillMultipliers(skillIdsList) {','\n      }');
 for(const build of report.builds){
  const fm=vm.runInNewContext(formula+'\ncomputeWikiSkillMultipliers(ids);',{ROGUE_SKILLS:skills,ids:build.skillIds});
  assert.deepEqual(build.multipliers,JSON.parse(JSON.stringify(fm)));
  if(build.id.startsWith('common-rare'))assert.ok(build.rarities.every(r=>['common','rare'].includes(r)));
  for(const p of report.profiles){
   const r=report.buildRows.find(r=>r.profile===p.name&&r.chapter===1&&r.room===50&&r.build===build.id);
   const source={CritRate:p.crit,CritValue:p.critMult};
   const atk=Math.round(p.atk*fm.atkCatMult)*fm.mainWepCatMult*fm.dmgCatMult*(build.skillIds.includes('boss_slayer')?1.25:1);
   const hit=roll=>sandbox.CombatDamage.resolve({attack:atk,source,target:{},canCrit:true,critRoll:roll}).hpDamage;
   const chance=Math.round(p.crit*65536)/65536;
   assert.equal(r.dps,(hit(65535)*(1-chance)+hit(0)*chance)*+(p.aspd*fm.effectiveAspdMult).toFixed(2));
   assert.equal(r.hp,p.hp+build.skillIds.reduce((n,id)=>n+Math.round(p.hp*(skills.find(s=>s.id===id).maxHpPct||0)),0));
  }
 }
});
test('roster, elite và nghỉ 49 dùng module thật trên mọi hàng',()=>{
 const sandbox={};for(const file of ['campaign-config','campaign-rooms'])vm.runInNewContext(fs.readFileSync(new URL('../public/'+file+'.js',import.meta.url),'utf8'),sandbox);
 for(const row of report.rows){const roster=sandbox.ArtemisCampaignRooms.getRoster(row.chapter,row.room);assert.deepEqual(row.enemies.map(e=>e.type),Array.from(roster,e=>e.type));assert.equal(row.count,roster.length);for(let i=0;i<roster.length;i++)assert.equal(row.enemies[i].modifiers.hpMultiplier,sandbox.ArtemisCampaignRooms.getModifiers(row.chapter,row.room,i).hpMultiplier);if(row.room===49)assert.equal(row.count,3);}
});
test('upgrade ATK/HP có lợi, DEF có thể không đổi do làm tròn; không bịa hồ sơ chương cao',()=>{
 for(const r of report.upgradeBenefits){assert.ok(r.ttkBenefit>1.98);assert.ok(r.hpHitsBenefit>=1);assert.ok(r.defHitsBenefit>=1);}
 assert.equal(report.chapterProfileAssignments.filter(a=>a.profile===null).length,18);
 assert.ok(report.bossTargets.some(t=>t.appropriateProfile&&t.status==='TOO_FAST'));
 for(const r of report.rows){const b=report.buildRows.find(b=>b.profile===r.profile&&b.chapter===r.chapter&&b.room===r.room&&b.build==='none');assert.equal(b.roomTtkSeconds,r.roomTtkSeconds);assert.equal(b.damagePerHit,r.damagePerHit);}
});
test('đề xuất EXP phải nằm trong cửa sổ TẤT CẢ chương, không chỉ chương ít quái',()=>{
 const c=report.exp.calibration;
 const total=Array.from({length:9},(_,i)=>Math.round(c.recommendedBaseAtFixedGrowth1_62*1.62**i)).reduce((a,b)=>a+b,0);
 assert.ok(total>c.thresholdTotalWindow.exclusiveMin&&total<=c.thresholdTotalWindow.inclusiveMax, `Tổng đề xuất ${total} ngoài cửa sổ`);
});
