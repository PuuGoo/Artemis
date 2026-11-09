import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
function loadExp() {
  const path = new URL('public/campaign-exp.js', root);
  assert.ok(fs.existsSync(path), 'Thiếu module EXP chiến dịch');
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path, 'utf8'), sandbox);
  return sandbox.ArtemisCampaignExp;
}

test('EXP classic global: gain trả số cấp tăng, cập nhật player, không cấp kỹ năng', () => {
  const exp = loadExp();
  const skills = { attack: 2 };
  const player = { level: 1, xp: 0, xpNext: 80, skills, hp: 775, atk: 152 };
  assert.equal(exp.threshold(1), 66);
  assert.equal(exp.threshold(2), 107);
  assert.equal(exp.gain(player, 67), 1);
  assert.deepEqual(player, { level: 2, xp: 1, xpNext: 107, skills, hp: 775, atk: 152 });
});

test('giữ đúng drop production, làm tròn từng ngọc trước khi cộng greed', () => {
  const exp = loadExp();
  assert.equal(exp.dropValue(false, 1), 22);
  assert.equal(exp.dropValue(true, 1), 35);
  assert.equal(exp.dropValue(false, 1.15), Math.round(22 * 1.15));
  assert.equal(exp.dropValue(true, 2.2), Math.round(35 * 2.2));
});

test('cap 10 xóa phần dư, không overflow dù nhận lượng EXP cực lớn hoặc save cũ quá cấp', () => {
  const exp = loadExp();
  const player = { level: 1, xp: 0, skills: {} };
  assert.equal(exp.gain(player, Number.MAX_VALUE), 9);
  assert.equal(player.level, 10);
  assert.equal(player.xp, 0);
  assert.equal(exp.gain(player, 99), 0);
  assert.equal(player.xp, 0);
  assert.ok(Number.isFinite(player.xpNext) && player.xpNext > 0);
  Object.assign(player, { level: 35, xp: 100000 });
  exp.gain(player, 0);
  assert.equal(player.level, 10);
  assert.equal(player.xp, 0);
});

test('amount không hợp lệ không làm mất EXP hay sinh NaN', () => {
  const exp = loadExp();
  const player = { level: 1, xp: 3 };
  for (const amount of [-100, NaN, Infinity, '80', undefined]) exp.gain(player, amount);
  assert.equal(player.level, 1);
  assert.equal(player.xp, 3);
});

test('50 phòng cấu hình thật: greed 0 đạt cấp 10 ở phòng 40–47, không nhận skill', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(new URL('public/campaign-config.js', root), 'utf8'), sandbox);
  vm.runInNewContext(fs.readFileSync(new URL('public/campaign-rooms.js', root), 'utf8'), sandbox);
  const config = sandbox.ArtemisCampaignRooms;
  const exp = loadExp();
  const player = { level: 1, xp: 0, skills: {} };
  let firstCap = null;
  for (let room = 1; room <= 50; room++) {
    const boss = config.roomPlan(1, room).isBoss;
    const count = config.getRoster(1, room).length;
    for (let mob = 0; mob < count; mob++) {
      for (let gem = 0; gem < (boss ? 8 : 2); gem++) exp.gain(player, exp.dropValue(boss, 1));
    }
    if (player.level === 10 && firstCap === null) firstCap = room;
  }
  assert.ok(firstCap >= 40 && firstCap <= 47, `Cấp 10 ở phòng ${firstCap}`);
  assert.equal(player.xp, 0);
  assert.deepEqual(player.skills, {});
});

test('báo cáo phân tích dùng đủ chương/hồ sơ thật và 12 mốc, không giả winrate', () => {
  const result = spawnSync(process.execPath, ['--max-old-space-size=192', 'tools/campaign-balance-sim.mjs', '--json'], {
    cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const profiles = JSON.parse(fs.readFileSync(new URL('tools/combat-profiles.json', root))).profiles;
  assert.equal(report.profiles.length, profiles.length);
  assert.equal(report.chapterIds.length, 19);
  assert.equal(report.milestones.length, 12);
  assert.equal(report.rows.length, profiles.length * report.chapterIds.length * report.milestones.length);
  assert.equal(report.evidence, 'analytical-only');
  const html = fs.readFileSync(new URL('public/index.html', root), 'utf8');
  const gold = html.match(/type: 'gold',[^}]*?val: Math\.round\(\(e\.isBoss \? (\d+) : (\d+)\) \* greedMult\)/);
  assert.ok(gold, 'Đọc đúng object gold production');
  const firstRoom = report.rows.find(r => r.chapter === 1 && r.room === 1);
  assert.equal(firstRoom.gold, firstRoom.count * 2 * Number(gold[2]));
  assert.ok(report.exp.firstLevel10Room >= 40 && report.exp.firstLevel10Room <= 47);
  for (const row of report.rows) {
    for (const key of ['roomTtkSeconds', 'damagePerHit', 'hitsToDie', 'xpPerMinute', 'goldPerMinute']) {
      assert.ok(Number.isFinite(row[key]) && row[key] > 0, `${key}: ${row[key]}`);
    }
    assert.equal('winRate' in row, false);
  }
  const a = report.rows.find(r => r.profile === profiles[0].name && r.chapter === 1 && r.room === 1);
  const f = report.rows.find(r => r.profile === profiles[5].name && r.chapter === 1 && r.room === 1);
  assert.ok(a.roomTtkSeconds > f.roomTtkSeconds * 10);
  assert.ok(f.hitsToDie > a.hitsToDie * 10);
});
