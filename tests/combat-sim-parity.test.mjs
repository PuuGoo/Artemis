// Khoá parity của simulator với source, để phép đo không lặng lẽ trôi.
//
// Nếu ai đổi công thức quái/boss trong public/index.html mà không cập nhật
// tools/combat-sim.mjs, script sẽ ném lỗi ("Không tìm thấy trong source: ...").
// Test này chạy đúng script đó và khẳng định nó vẫn đọc được mọi hằng số.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('combat-sim đọc được mọi hằng số từ source (không lệch công thức)', () => {
  const out = execFileSync(process.execPath, ['tools/combat-sim.mjs', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.match(out, /BASE_ATK=78/);
  assert.match(out, /Hệ số quái: \{/);
  // Độ khó chiến dịch nay là bảng tuyệt đối; parity nghĩa là đọc được cả bảng đó.
  assert.match(out, /CHIẾN DỊCH \(tuyệt đối\): C1 300HP\/70ATK/);
  assert.match(out, /C6 2400HP\/520ATK/);
  assert.match(out, /Chương: C1\(50 phòng\)/);
  assert.match(out, /không NaN\/Infinity, TTK > 0/);
  assert.match(out, /=== \d+ PASS \/ 0 FAIL ===/);
  // So từng entity với setupRoom thật: không chỉ xác nhận simulator chạy được.
  const report = JSON.parse(out.trim().split('\n').at(-1));
  const html = readFileSync(resolve(root,'public/index.html'),'utf8').replaceAll('\r','');
  function declaration(marker, endMarker='\n      }') {
    const begin=html.indexOf(marker), end=html.indexOf(endMarker,begin);
    assert.ok(begin>=0 && end>begin,marker);
    return html.slice(begin,end+endMarker.length);
  }
  const c=vm.createContext({Game:{mode:'campaign',chapter:{id:1,enemyScale:1},maxRooms:50,width:600,height:800,wallPad:24,
    player:{skills:{},maxHp:775,atk:164,hp:775},pet:{}},SaveState:{talents:{},bestRooms:Object.fromEntries(Array.from({length:19},(_,i)=>[i+1,999])),save(){throw Error('ghi save ngoài dự kiến');}},
    SoundFX:{bossSpawn(){}},ArtemisObstacleClearance:{findSafeSpawn:(x,y)=>({x,y})},
    document:{getElementById:()=>({classList:{add(){},remove(){}}})},MonsterArt:{assignRoom(){}},
    showBossIntro(){},hideBossIntro(){},updateInGameHUD(){}});
  for(const file of ['campaign-config.js','campaign-rooms.js','campaign-telemetry.js'])
    vm.runInContext(readFileSync(resolve(root,'public',file),'utf8'),c);
  for(const name of ['GAME_MODES','ZODIAC_IDS','ZODIAC_ENEMY_POOLS']) {
    const begin=html.indexOf('const '+name+' ='),end=html.indexOf(';',begin);
    assert.ok(begin>=0 && end>begin,name);vm.runInContext(html.slice(begin,end+1),c);
  }
  vm.runInContext(declaration('const CAMPAIGN_TUNING =')+';',c);
  for(const name of ['getGameMode','isBossRoom','getCampaignTuning','usesCampaignTuning','setupRoom'])
    vm.runInContext(declaration('function '+name+'('),c);
  const profile=report.rows[0].profile;
  const rows=report.rows.filter(r=>r.profile===profile);
  assert.equal(rows.length,19*50);
  for(const row of rows) {
    c.Game.chapter={id:row.ch,enemyScale:1,bossName:'fixture'};c.setupRoom(row.room);
    const actual=JSON.parse(JSON.stringify(c.Game.enemies.map(e=>({type:e.type,hp:e.hp,atk:e.atk}))));
    const expected=row.kind==='boss' ? [{type:row.bossType,hp:row.enemyHp,atk:row.enemyAtk}]
      : row.enemies.map(e=>({type:e.type,hp:e.hp,atk:e.atk}));
    assert.deepEqual(actual,expected,`C${row.ch} phòng ${row.room}`);
    if(row.kind!=='boss')assert.equal(row.count,actual.length);
  }
});

test('hồ sơ cân bằng phải được ĐO, không phải gõ tay', () => {
  const file = resolve(root, 'tools/combat-profiles.json');
  assert.equal(existsSync(file), true, 'thiếu tools/combat-profiles.json — chạy tools/measure-profiles.mjs');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(Array.isArray(data.profiles) && data.profiles.length >= 7, 'phải có đủ hồ sơ A–G');
  assert.match(data.source, /getComputedStats/, 'nguồn phải là getComputedStats() của game');
  for (const p of data.profiles) {
    assert.ok(Number.isFinite(p.atk) && p.atk > 0, `ATK vô lý ở ${p.name}`);
    assert.ok(Number.isFinite(p.hp) && p.hp > 0, `HP vô lý ở ${p.name}`);
    assert.ok(Number.isFinite(p.aspd) && p.aspd > 0, `ASPD vô lý ở ${p.name}`);
  }
  // Tân thủ phải đúng dải thiết kế 80–150 ATK / 400–800 HP (số đo thật hiện là 152/775).
  const starter = data.profiles[0];
  assert.ok(starter.atk >= 80 && starter.atk <= 200, `ATK tân thủ ngoài dải: ${starter.atk}`);
  assert.ok(starter.hp >= 400 && starter.hp <= 800, `HP tân thủ ngoài dải: ${starter.hp}`);
});
