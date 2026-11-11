// Chỉ phân tích toán học: không browser, tài khoản, DB, mạng hoặc mô phỏng tỉ lệ thắng.
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const html = read('public/index.html');
const sandbox = {};
for (const path of ['public/campaign-config.js', 'public/campaign-exp.js', 'public/campaign-rooms.js', 'public/combat-damage.js']) {
  vm.runInNewContext(read(path), sandbox, { timeout: 1000 });
}
const config = sandbox.ArtemisCampaignConfig;
const exp = sandbox.ArtemisCampaignExp;
function match(re, label, text = html) {
  const m = text.match(re);
  if (!m) throw new Error('Source không còn khớp: ' + label);
  return m;
}
function section(start, end) {
  const i = html.indexOf(start);
  const j = html.indexOf(end, i + start.length);
  if (i < 0 || j < 0) throw new Error('Thiếu khối source: ' + start);
  return html.slice(i, j + end.length);
}
function evaluate(source, extra = {}) {
  return vm.runInNewContext(source, extra, { timeout: 1000 });
}
// Cùng dữ liệu profile/base tuning với combat-sim, nhưng không import CLI cũ có side effect.
const measured = JSON.parse(read('tools/combat-profiles.json'));
if (!Array.isArray(measured.profiles) || !measured.profiles.length) throw new Error('Thiếu hồ sơ đo thật');
for (const p of measured.profiles) {
  for (const key of ['atk', 'hp', 'aspd', 'crit', 'critMult', 'def']) {
    if (!Number.isFinite(p[key])) throw new Error(`Hồ sơ thiếu ${key}: ${p.name}`);
  }
}
const base = evaluate(section('const CAMPAIGN_TUNING = {', '\n      };') + '\nCAMPAIGN_TUNING;');
const chapters = evaluate(section('const CHAPTERS = [', '\n      ];') + '\nCHAPTERS;', { ArtemisCampaignConfig: config });
const skills = evaluate(section('const ROGUE_SKILLS = [', '\n      ];') + '\nROGUE_SKILLS;');
const skillFormula = section('function computeWikiSkillMultipliers(skillIdsList) {', '\n      }');
// Không tự gán kỹ năng hoặc buff mỗi lần lên cấp. Bộ rỗng qua công thức ROGUE thật.
const skillMult = evaluate(skillFormula + '\ncomputeWikiSkillMultipliers([]);', { ROGUE_SKILLS: skills });
const typeMult = evaluate('({' + match(/const typeMul = \(\{([^}]+)\}\)\[t\]/s, 'typeMul')[1] + '})');
const rooms = sandbox.ArtemisCampaignRooms;
const combat = sandbox.CombatDamage;
const chapterIds = chapters.map(c => Number(c.id));
if (chapterIds.length !== 12 || chapterIds.some(id => !base[id])) throw new Error('Không đủ bảng thật 12 chương');
const dropCount = match(/const dropCount = e\.isBoss \? (\d+) : (\d+);/, 'dropCount').slice(1).map(Number);
const dropXp = match(/val: Math\.round\(\(e\.isBoss \? (\d+) : (\d+)\) \* greedMult\)/, 'xp drop').slice(1).map(Number);
const goldValues = match(/type: 'gold',[^}]*?val: Math\.round\(\(e\.isBoss \? (\d+) : (\d+)\) \* greedMult\)/, 'gold drop').slice(1).map(Number);
const greedStep = Number(match(/const greedMult = 1 \+ \(SaveState\.talents\.greed \|\| 0\) \* ([\d.]+)/, 'greed')[1]);

const defBase = Number(match(/const defK = (\d+) \+ 120 \*/, 'def base')[1]);
const defStep = Number(match(/const defK = \d+ \+ (\d+) \*/, 'def step')[1]);
const defCap = Number(match(/Math\.min\((0\.\d+), defFlat \/ \(defFlat \+ defK\)\)/, 'def cap')[1]);
for (const boss of [false, true]) {
  if (exp.dropValue(boss, 1) !== dropXp[boss ? 0 : 1]) throw new Error('Giá trị EXP khác production');
}
const milestones = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 49, 50];
const player = { level: 1, xp: 0 };
const progression = [];
let firstLevel10Room = null;
let totalXp = 0, totalGold = 0, mobs = 0, bosses = 0;
for (let room = 1; room <= config.ROOM_COUNT; room++) {
  const boss = !!config.bossType(1, room);
  const index = boss ? 0 : 1;
  const count = rooms.getRoster(1, room).length;
  const xp = count * dropCount[index] * exp.dropValue(boss, 1);
  totalXp += xp;
  totalGold += count * dropCount[index] * goldValues[index];
  if (boss) bosses += count; else mobs += count;
  exp.gain(player, xp);
  if (player.level === 10 && firstLevel10Room === null) firstLevel10Room = room;
  progression.push({ room, count, boss, gainedXp: xp, level: player.level, xp: player.xp });
}
const builds = [
  { id:'none', skillIds:[], note:'Không chọn kỹ năng.' },
  { id:'common-rare-good', skillIds:['warriors_breath','fairys_breath','boss_slayer','swift_arrow','max_hp_up'], note:'Common/Rare, đòn chính liên tục.' },
  { id:'common-rare-weak', skillIds:['max_hp_up','fountain_of_life','angelic_shelter'], note:'Common/Rare thiên HP, không tăng DPS.' },
  { id:'legend-good', skillIds:['warriors_soul','power_trio','warriors_breath','fairys_breath','boss_slayer'], note:'Legend trộn Common; không giả định có toàn bộ Legend.' },
  { id:'legend-defense', skillIds:['soul_of_strength','power_trio','max_hp_up','fountain_of_life','angelic_shelter'], note:'Legend thiên HP; không tính né/khiên thành DPS.' }
].map(build => {
  const selected = build.skillIds.map(id => { const sk=skills.find(s=>s.id===id); if(!sk) throw Error('Thiếu skill '+id); return sk; });
  return { ...build, rarities:selected.map(s=>s.rarity), multipliers:evaluate(skillFormula+'\ncomputeWikiSkillMultipliers(ids);',{ROGUE_SKILLS:skills,ids:build.skillIds}), maxHpPct:selected.reduce((n,s)=>n+(s.maxHpPct||0),0) };
});
// Crit kỳ vọng từ hai nhánh resolver fixed-point thật, không lấy raw ATK × critMult.
function expectedHit(attack,p) {
  const source={CritRate:p.crit,CritValue:p.critMult,OwnerRaceFlag:16};
  const normal=combat.resolve({attack,source,target:{},canCrit:true,critRoll:65535,context:{exHurtAttack:4,attackerType:1,ownerRaceFlag:16}}).hpDamage;
  const critical=combat.resolve({attack,source,target:{},canCrit:true,critRoll:0,context:{exHurtAttack:4,attackerType:1,ownerRaceFlag:16}}).hpDamage;
  const chance=Math.min(1,Math.max(0,Math.round(p.crit*65536)/65536));
  return normal*(1-chance)+critical*chance;
}
function buildStats(p,build,boss=false) {
 const fm=build.multipliers;
 const atk=Math.round(p.atk*fm.atkCatMult), aspd=+(p.aspd*fm.effectiveAspdMult).toFixed(2);
 const mark=boss&&build.skillIds.includes('boss_slayer')?1.25:1;
 const raw=atk*fm.mainWepCatMult*fm.dmgCatMult*mark;
 const hp=p.hp+build.skillIds.reduce((n,id)=>n+Math.round(p.hp*(skills.find(s=>s.id===id).maxHpPct||0)),0);
 return {atk,aspd,hp,expectedDamage:expectedHit(raw,p),dps:expectedHit(raw,p)*aspd};
}
function incomingDamage(attack,dr) {
 return combat.resolve({attack,target:{},canCrit:false,context:{targetIsHero:true,attackerType:1,coefficientModifiers:[1-dr]}}).hpDamage;
}
const rows = [];
for (const p of measured.profiles) {
  const atk = Math.round(p.atk * skillMult.atkCatMult);
  const aspd = +(p.aspd * skillMult.effectiveAspdMult).toFixed(2);
  const dps = buildStats(p, builds[0]).dps;
  // DEF tính lại theo 50 phòng; snapshot cũ đo dưới số phòng cũ không dùng làm truth mới.
  const dr = +Math.min(defCap, p.def / (p.def + defBase + defStep * config.ROOM_COUNT)).toFixed(4);
  for (const chapter of chapterIds) {
    for (const room of milestones) {
      const tuning = config.tuning(base[chapter], room);
      const type = config.bossType(chapter, room);
      const boss = !!type;
      const roster = rooms.getRoster(chapter, room);
      const count = roster.length;
      const enemies = roster.map((entry,i) => {
        const mods=rooms.getModifiers(chapter,room,i);
        const rawHp=boss ? Math.round(tuning.bossHp) : Math.max(1,Math.round(tuning.mobHp*(typeMult[entry.type]||1)));
        return {...entry, hp:Math.max(1,Math.round(rawHp*mods.hpMultiplier)), modifiers:mods};
      });
      const incomingAtk = !count ? 0 : boss ? Math.max(1, tuning.bossAtk) : Math.max(1, Math.round(tuning.mobAtk / Math.max(1, Math.sqrt(count / 3))));
      const damagePerHit = count ? incomingDamage(Math.max(...enemies.map(e=>Math.round(incomingAtk*e.modifiers.atkMultiplier))), dr) : 0;
      const roomTtkSeconds = enemies.reduce((sum, enemy) => sum + enemy.hp, 0) / dps;
      const index = boss ? 0 : 1;
      const xp = count * dropCount[index] * exp.dropValue(boss, 1);
      const gold = count * dropCount[index] * goldValues[index];
      rows.push({ profile: p.name, chapter, room, kind: !count ? 'safe' : boss ? 'boss' : 'mob', count,
        enemies, incomingAtk, dps, damageReduction: dr, damagePerHit,
        hitsToDie: count ? Math.ceil(p.hp / damagePerHit) : null, roomTtkSeconds,
        xp, gold, xpPerMinute: count ? xp * 60 / roomTtkSeconds : 0, goldPerMinute: count ? gold * 60 / roomTtkSeconds : 0 });
    }
  }
}
const buildRows = rows.flatMap(row => builds.map(build => {
 const p=measured.profiles.find(p=>p.name===row.profile), stats=buildStats(p,build,row.kind==='boss');
 const attack=Math.max(0,...row.enemies.map(e=>Math.max(1,Math.round(row.incomingAtk*e.modifiers.atkMultiplier))));
 const damagePerHit=row.count ? incomingDamage(attack,row.damageReduction) : 0;
 const roomTtkSeconds=row.enemies.reduce((n,e)=>n+e.hp,0)/stats.dps;
 return {profile:row.profile,chapter:row.chapter,room:row.room,kind:row.kind,build:build.id,...stats,damagePerHit,hitsToDie:row.count ? Math.ceil(stats.hp/damagePerHit) : null,roomTtkSeconds};
}));
// Không gọi F là hồ sơ đo cho chương 19: fixture chỉ chứng minh cựu binh ở chương 1.
const chapterProfileAssignments = chapterIds.map(chapter=>({chapter,profile:chapter===1?measured.profiles[4].name:null,status:chapter===1?'fixture-labelled-chapter-1':'BLOCKED: chưa có hồ sơ đo phù hợp chương'}));
const bossTargets = buildRows.filter(r=>r.kind==='boss').map(r=>{
 const assignment=chapterProfileAssignments.find(a=>a.chapter===r.chapter), min=r.room===50?60:25,max=r.room===50?90:45;
 return {profile:r.profile,chapter:r.chapter,room:r.room,build:r.build,seconds:r.roomTtkSeconds,min,max,appropriateProfile:r.profile===assignment.profile,status:r.profile!==assignment.profile?'UNASSIGNED':r.roomTtkSeconds<min?'TOO_FAST':r.roomTtkSeconds>max?'TOO_SLOW':'IN_RANGE'};
});
const upgradeBenefits=rows.map(row=>{
 if(!row.count) return {profile:row.profile,chapter:row.chapter,room:row.room,atkMultiplier:2,ttkBenefit:null,hpMultiplier:2,hpHitsBenefit:null,defAdded:100,defHitsBenefit:null,enemyHpUnchanged:true,enemyAtkUnchanged:true};
 const p=measured.profiles.find(p=>p.name===row.profile), b=builds[0];
 const baseStats=buildStats(p,b,row.kind==='boss'), upgraded=buildStats({...p,atk:p.atk*2},b,row.kind==='boss');
 const attack=Math.max(...row.enemies.map(e=>Math.round(row.incomingAtk*e.modifiers.atkMultiplier)));
 const dr=def=>+Math.min(defCap,def/(def+defBase+defStep*config.ROOM_COUNT)).toFixed(4);
 const damage=incomingDamage(attack,dr(p.def)), defDamage=incomingDamage(attack,dr(p.def+100));
 return {profile:p.name,chapter:row.chapter,room:row.room,atkMultiplier:2,ttkBenefit:upgraded.dps/baseStats.dps,hpMultiplier:2,hpHitsBenefit:Math.ceil(p.hp*2/damage)/Math.ceil(p.hp/damage),defAdded:100,defHitsBenefit:Math.ceil(p.hp/defDamage)/Math.ceil(p.hp/damage),enemyHpUnchanged:true,enemyAtkUnchanged:true};
});
const chapterProgressions=chapterIds.map(chapter=>{
 const player={level:1,xp:0};let cap=null,cumulativeXp=0;const progression=[];
 for(let room=1;room<=config.ROOM_COUNT;room++) {
  const boss=!!config.bossType(chapter,room),count=rooms.getRoster(chapter,room).length;
  const gainedXp=count*dropCount[boss?0:1]*exp.dropValue(boss,1);cumulativeXp+=gainedXp;exp.gain(player,gainedXp);
  if(player.level===10&&cap===null)cap=room;
  progression.push({room,count,boss,gainedXp,cumulativeXp,level:player.level});
 }
 return {chapter,firstLevel10Room:cap,totalXp:cumulativeXp,progression};
});
const thresholdTotal=Array.from({length:9},(_,i)=>exp.threshold(i+1)).reduce((a,b)=>a+b,0);
const allAt=room=>chapterProgressions.map(c=>c.progression[room-1].cumulativeXp);
const calibration={targetRoom:45,targetWindow:[40,47],currentThresholdTotal:thresholdTotal,
 thresholdTotalWindow:{exclusiveMin:Math.max(...allAt(39)),inclusiveMax:Math.min(...allAt(47))},
 recommendedBaseAtFixedGrowth1_62:Math.round(exp.threshold(1)*((Math.max(...allAt(39))+Math.min(...allAt(47)))/2)/thresholdTotal),
 note:'Đề xuất hệ số, không sửa tuning. Chỉ greed 0, thu đủ ngọc, không thêm quái triệu hồi.'};
const report = {
  builds,buildRows,upgradeBenefits,bossTargets,chapterProfileAssignments,
  productionSources:{roster:'public/campaign-rooms.js',skills:'ROGUE_SKILLS + computeWikiSkillMultipliers',damage:'public/combat-damage.js / CombatDamage.resolve'},
  evidence: 'analytical-only', measuredAt: measured.measuredAt, profileSource: measured.source,
  profileNote: measured.note, profiles: measured.profiles, chapterIds, milestones,
  assumptions: [
    'Hồ sơ fixture đo sẵn, không phải tài khoản thật hay chỉ số được đo lại hiện tại.',
    '12 mốc theo yêu cầu: 1,5,10,15,20,25,30,35,40,45,49,50.',
    'DPS kỳ vọng crit, bắn liên tục đứng yên, một mục tiêu; tổng HP từng loại quái thật trong phòng.',
    'rows là bộ rỗng; buildRows dùng 5 bộ kỹ năng thật, chạy computeWikiSkillMultipliers và CombatDamage.resolve.',
    'Chỉ đòn chính đứng yên, một đạn trúng/mỗi chu kỳ; không phụ trợ, set/rune, hero active, phản kích. Snapshot thiếu toàn bộ trạng thái để dựng lại các passive.',
    'boss_slayer áp dụng dmgPct global và mark boss 1.25 như production; không sửa double application ngầm.',
    'Build là đối chiếu full-build tại cùng mốc, không khẳng định nhận đủ kỹ năng đó sớm hoặc tỷ lệ offer.',
    'Số đòn chịu là đòn ATK thường sau DEF 50 phòng, không dodge/khiên/rune/crit địch/burst.',
    'Phần thưởng/phút là trần phân tích thời gian DPS thuần; chưa có di chuyển, né, nhặt, menu hay chuyển phòng.',
    'Safe rooms: không có địch, TTK/damage/EXP/vàng = 0; số đòn chịu và tỷ lệ lợi nâng cấp = null (không áp dụng), không chia 0.',
    'Giữ greed 0; talent production = 1 + greed * ' + greedStep + ', làm tròn từng ngọc.',
    'Không mô phỏng AI, va chạm hay xác suất thắng; không chứng minh gameplay thắng 50 phòng.'
  ],
  legacyAudit: [
    'combat-sim.mjs đọc count cũ 3+floor(room/2), boss mỗi 5 phòng, và DEPTH inline đã chuyển sang config.',
    'Bảng quái cũ chỉ regex chương một chữ số, fallback slime; thiếu pool zodiac và loại từng mob.',
    'Hồ sơ thật có 7 fixture, base tuning có 12 chương; giữ nguồn đó, không bịa snapshot tài khoản.',
    'TTK cũ là một quái đại diện, không phải thời gian cả phòng; script mới cộng HP mọi quái.'
  ],
  exp: { chapterProgressions, calibration, thresholds: Array.from({ length: 9 }, (_, i) => exp.threshold(i + 1)), firstLevel10Room,
    totalXp, totalGold, mobs, bosses, progression }, rows
};
if (process.argv.includes('--summary-json')) console.log(JSON.stringify({evidence:report.evidence,profileSource:report.profileSource,profiles:report.profiles.length,chapters:chapterIds.length,milestones,rows:rows.length,buildRows:buildRows.length,builds,calibration,caps:chapterProgressions.map(({chapter,firstLevel10Room,totalXp})=>({chapter,firstLevel10Room,totalXp})),bossTargets:bossTargets.filter(t=>t.appropriateProfile),chapterProfileAssignments}));
else if (process.argv.includes('--json')) console.log(JSON.stringify(report));
else {
  console.log('PHÂN TÍCH TOÁN HỌC — KHÔNG PHẢI PLAYTEST / WIN RATE');
  console.log(JSON.stringify({ profiles: report.profiles.length, chapters: chapterIds.length, milestones, rows: rows.length,
    firstLevel10Room, totalXp, totalGold, mobs, bosses, thresholds: report.exp.thresholds }, null, 2));
  for (const note of [...report.legacyAudit, ...report.assumptions]) console.log('- ' + note);
  console.log('\n| Hồ sơ | Chương | Phòng | Loại | TTK cả phòng (s) | Đòn chịu | EXP/phút | Vàng/phút |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const row of rows) console.log(`| ${row.profile.slice(0, 2)} | ${row.chapter} | ${row.room} | ${row.kind} | ${row.roomTtkSeconds.toFixed(2)} | ${row.hitsToDie} | ${row.xpPerMinute.toFixed(1)} | ${row.goldPerMinute.toFixed(1)} |`);
}
