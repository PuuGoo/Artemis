// Chỉ phân tích toán học: không browser, tài khoản, DB, mạng hoặc mô phỏng tỉ lệ thắng.
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const html = read('public/index.html');
const sandbox = {};
for (const path of ['public/campaign-config.js', 'public/campaign-exp.js']) {
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
const pools = evaluate(match(/const ZODIAC_ENEMY_POOLS = (\[.*\]);/, 'ZODIAC_ENEMY_POOLS')[1]);
const typesExpression = match(/const types = (Game\.chapter[\s\S]*?);/, 'types', html.slice(html.indexOf('function setupRoom(')))[1];
const chapterIds = chapters.map(c => Number(c.id));
if (chapterIds.length !== 19 || chapterIds.some(id => !base[id])) throw new Error('Không đủ bảng thật 19 chương');
const dropCount = match(/const dropCount = e\.isBoss \? (\d+) : (\d+);/, 'dropCount').slice(1).map(Number);
const dropXp = match(/val: Math\.round\(\(e\.isBoss \? (\d+) : (\d+)\) \* greedMult\)/, 'xp drop').slice(1).map(Number);
const goldValues = match(/type: 'gold',[^}]*?val: Math\.round\(\(e\.isBoss \? (\d+) : (\d+)\) \* greedMult\)/, 'gold drop').slice(1).map(Number);
const greedStep = Number(match(/const greedMult = 1 \+ \(SaveState\.talents\.greed \|\| 0\) \* ([\d.]+)/, 'greed')[1]);
const demonMult = Number(match(/campaign\.bossHp \* \(bossType === 'demon_king' \? ([\d.]+)/, 'demon boss')[1]);
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
  const count = boss ? 1 : config.mobCount(room);
  const xp = count * dropCount[index] * exp.dropValue(boss, 1);
  totalXp += xp;
  totalGold += count * dropCount[index] * goldValues[index];
  if (boss) bosses += count; else mobs += count;
  exp.gain(player, xp);
  if (player.level === 10 && firstLevel10Room === null) firstLevel10Room = room;
  progression.push({ room, count, boss, gainedXp: xp, level: player.level, xp: player.xp });
}
const rows = [];
for (const p of measured.profiles) {
  const atk = Math.round(p.atk * skillMult.atkCatMult);
  const aspd = +(p.aspd * skillMult.effectiveAspdMult).toFixed(2);
  const dps = atk * aspd * skillMult.mainWepCatMult * skillMult.dmgCatMult * (1 + p.crit * (p.critMult - 1));
  // DEF tính lại theo 50 phòng; snapshot cũ đo dưới số phòng cũ không dùng làm truth mới.
  const dr = +Math.min(defCap, p.def / (p.def + defBase + defStep * config.ROOM_COUNT)).toFixed(4);
  for (const chapter of chapterIds) {
    const types = evaluate(typesExpression, { Game: { chapter: { id: chapter } }, ZODIAC_ENEMY_POOLS: pools });
    for (const room of milestones) {
      const tuning = config.tuning(base[chapter], room);
      const type = config.bossType(chapter, room);
      const boss = !!type;
      const count = boss ? 1 : config.mobCount(room);
      const enemies = boss
        ? [{ type, hp: Math.round(tuning.bossHp * (type === 'demon_king' ? demonMult : 1)) }]
        : Array.from({ length: count }, (_, i) => {
          const kind = types[(room + i) % types.length];
          return { type: kind, hp: Math.max(1, Math.round(tuning.mobHp * (typeMult[kind] || 1))) };
        });
      const incomingAtk = boss ? Math.max(1, tuning.bossAtk) : Math.max(1, Math.round(tuning.mobAtk / Math.max(1, Math.sqrt(count / 3))));
      const damagePerHit = Math.max(1, Math.round(incomingAtk * (1 - dr)));
      const roomTtkSeconds = enemies.reduce((sum, enemy) => sum + enemy.hp, 0) / dps;
      const index = boss ? 0 : 1;
      const xp = count * dropCount[index] * exp.dropValue(boss, 1);
      const gold = count * dropCount[index] * goldValues[index];
      rows.push({ profile: p.name, chapter, room, kind: boss ? 'boss' : 'mob', count,
        enemies, incomingAtk, dps, damageReduction: dr, damagePerHit,
        hitsToDie: Math.ceil(p.hp / damagePerHit), roomTtkSeconds,
        xp, gold, xpPerMinute: xp * 60 / roomTtkSeconds, goldPerMinute: gold * 60 / roomTtkSeconds });
    }
  }
}
const report = {
  evidence: 'analytical-only', measuredAt: measured.measuredAt, profileSource: measured.source,
  profileNote: measured.note, profiles: measured.profiles, chapterIds, milestones,
  assumptions: [
    'Hồ sơ fixture đo sẵn, không phải tài khoản thật hay chỉ số được đo lại hiện tại.',
    '12 mốc theo yêu cầu: 1,5,10,15,20,25,30,35,40,45,49,50.',
    'DPS kỳ vọng crit, bắn liên tục đứng yên, một mục tiêu; tổng HP từng loại quái thật trong phòng.',
    'Không kỹ năng được chọn/pin; chạy công thức ROGUE production với bộ rỗng, cấp không buff chỉ số.',
    'Số đòn chịu là đòn ATK thường sau DEF 50 phòng, không dodge/khiên/rune/crit địch/burst.',
    'Phần thưởng/phút là trần phân tích thời gian DPS thuần; chưa có di chuyển, né, nhặt, menu hay chuyển phòng.',
    'Giữ greed 0; talent production = 1 + greed * ' + greedStep + ', làm tròn từng ngọc.',
    'Không mô phỏng AI, va chạm hay xác suất thắng; không chứng minh gameplay thắng 50 phòng.'
  ],
  legacyAudit: [
    'combat-sim.mjs đọc count cũ 3+floor(room/2), boss mỗi 5 phòng, và DEPTH inline đã chuyển sang config.',
    'Bảng quái cũ chỉ regex chương một chữ số, fallback slime; thiếu pool zodiac và loại từng mob.',
    'Hồ sơ thật có 7 fixture, base tuning có 19 chương; giữ nguồn đó, không bịa snapshot tài khoản.',
    'TTK cũ là một quái đại diện, không phải thời gian cả phòng; script mới cộng HP mọi quái.'
  ],
  exp: { thresholds: Array.from({ length: 9 }, (_, i) => exp.threshold(i + 1)), firstLevel10Room,
    totalXp, totalGold, mobs, bosses, progression }, rows
};
if (process.argv.includes('--json')) console.log(JSON.stringify(report));
else {
  console.log('PHÂN TÍCH TOÁN HỌC — KHÔNG PHẢI PLAYTEST / WIN RATE');
  console.log(JSON.stringify({ profiles: report.profiles.length, chapters: chapterIds.length, milestones, rows: rows.length,
    firstLevel10Room, totalXp, totalGold, mobs, bosses, thresholds: report.exp.thresholds }, null, 2));
  for (const note of [...report.legacyAudit, ...report.assumptions]) console.log('- ' + note);
  console.log('\n| Hồ sơ | Chương | Phòng | Loại | TTK cả phòng (s) | Đòn chịu | EXP/phút | Vàng/phút |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const row of rows) console.log(`| ${row.profile.slice(0, 2)} | ${row.chapter} | ${row.room} | ${row.kind} | ${row.roomTtkSeconds.toFixed(2)} | ${row.hitsToDie} | ${row.xpPerMinute.toFixed(1)} | ${row.goldPerMinute.toFixed(1)} |`);
}
