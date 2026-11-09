// Khoá lại: độ khó CHIẾN DỊCH phải TUYỆT ĐỐI, không neo theo chỉ số người chơi.
//
// Lý do (docs/audit/artemis-new-player/13-GAME-BALANCE-MEASURED.md): khi HP địch =
// playerAtk × hệ số và ATK địch = playerMaxHp / hệ số, nâng cấp bị triệt tiêu —
// đo được ATK tăng 39× mà TTK chỉ giảm 1,96×, HP tăng 25× mà số đòn chịu vẫn 16,1.
// Người mặc đồ tân thủ ở chương 5 vẫn sống đúng 16 đòn như chương 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(resolve(root, 'public/index.html'), 'utf8').replaceAll(String.fromCharCode(13), '');

/** Lấy thân hàm theo dấu ngoặc nhọn (không cắt bằng độ dài mò). */
function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start > 0, `không tìm thấy ${marker}`);
  let depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  throw new Error('không tìm thấy điểm kết của ' + marker);
}

test('có bảng độ khó tuyệt đối cho cả 19 chương', () => {
  assert.match(html, /const CAMPAIGN_TUNING = \{/);
  const blk = fnBody('const CAMPAIGN_TUNING =');
  const rows = [...blk.matchAll(/(\d+): \{ mobHp: (\d+), mobAtk: (\d+), bossHp: (\d+), bossAtk: (\d+) \}/g)];
  assert.equal(rows.length, 19, 'phải có đủ 19 chương');
  for (const m of rows) {
    for (let k = 2; k <= 5; k++) assert.ok(Number(m[k]) > 0, `giá trị không dương ở chương ${m[1]}`);
  }
});

test('bảng tuyệt đối đơn điệu: chương sau khó hơn chương trước', () => {
  const blk = fnBody('const CAMPAIGN_TUNING =');
  const rows = [...blk.matchAll(/(\d+): \{ mobHp: (\d+), mobAtk: (\d+), bossHp: (\d+), bossAtk: (\d+) \}/g)]
    .map((m) => ({ ch: Number(m[1]), mobHp: Number(m[2]), mobAtk: Number(m[3]), bossHp: Number(m[4]), bossAtk: Number(m[5]) }))
    .sort((a, b) => a.ch - b.ch);
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1], cur = rows[i];
    assert.ok(cur.mobHp > prev.mobHp, `mobHp C${cur.ch} phải > C${prev.ch}`);
    assert.ok(cur.mobAtk > prev.mobAtk, `mobAtk C${cur.ch} phải > C${prev.ch}`);
    assert.ok(cur.bossHp > prev.bossHp, `bossHp C${cur.ch} phải > C${prev.ch}`);
    assert.ok(cur.bossAtk > prev.bossAtk, `bossAtk C${cur.ch} phải > C${prev.ch}`);
  }
});

test('HP quái chiến dịch KHÔNG phụ thuộc playerAtk', () => {
  const body = fnBody('function setupRoom(roomNum)');
  // Nhánh chiến dịch phải dùng campaign.mobHp; playerAtk chỉ được xuất hiện ở nhánh thích ứng.
  assert.match(body, /const campaign = usesCampaignTuning\(\)/, 'phải có nhánh chiến dịch');
  assert.match(body, /campaign\s*\?\s*Math\.max\(1, Math\.round\(campaign\.mobHp \* typeMul\)\)/,
    'HP quái chiến dịch phải lấy từ bảng tuyệt đối');
  assert.match(body, /atk: campaign\s*\?[^:]*campaign\.mobAtk/, 'ATK quái chiến dịch phải lấy từ bảng tuyệt đối');
  assert.match(body, /const maxHp = campaign\s*\?[^:]*campaign\.bossHp/, 'HP trùm chiến dịch phải lấy từ bảng tuyệt đối');

  // Nhánh thích ứng vẫn phải còn (Vô Tận/Tháp).
  assert.match(body, /playerAtk \* typeMul \* baseHits \* scale/, 'nhánh Vô Tận phải giữ công thức thích ứng');
  assert.match(body, /playerMaxHp \/ \(16 - depth \* 10\)/, 'nhánh Vô Tận phải giữ ATK thích ứng');
});

test('chỉ chế độ có chương mới dùng độ khó tuyệt đối', () => {
  const body = fnBody('function usesCampaignTuning()');
  assert.match(body, /hasChapters === true/, 'phải phân biệt theo hasChapters');
  // Vô Tận/Tháp/Săn Trùm/Luyện Tập đều hasChapters: false
  const modes = html.slice(html.indexOf('const GAME_MODES = ['), html.indexOf('function getGameMode'));
  for (const id of ['endless', 'tower', 'bossrush', 'practice']) {
    const seg = modes.match(new RegExp(`\\{[^{}]*id: '${id}'[^{}]*\\}`))?.[0] || '';
    assert.match(seg, /hasChapters: false/, `${id} phải giữ hasChapters: false`);
  }
});

// combat-sim.mjs cũ đọc regex count/độ sâu inline và lịch 5/10/15: không tương thích.
// Thay bằng chạy chính setupRoom, giữ đủ bất biến độc lập người chơi/nâng cấp.
function spawnHarness() {
  const c=vm.createContext({Game:{mode:'campaign',chapter:{id:1,enemyScale:1,bossName:'fixture'},
    maxRooms:50,width:600,height:800,wallPad:24,player:{skills:{},maxHp:775,atk:164,hp:775},pet:{}},
    SaveState:{talents:{},bestRooms:Object.fromEntries(Array.from({length:19},(_,i)=>[i+1,999])),save(){throw Error('ghi save ngoài dự kiến')}},
    SoundFX:{bossSpawn(){}},ArtemisObstacleClearance:{findSafeSpawn:(x,y)=>({x,y})},
    document:{getElementById:()=>({classList:{add(){},remove(){}}})},
    MonsterArt:{assignRoom(){}},showBossIntro(){},hideBossIntro(){},updateInGameHUD(){}});
  vm.runInContext(fs.readFileSync(resolve(root,'public/campaign-config.js'),'utf8'),c);
  for (const marker of ['const GAME_MODES =','const ZODIAC_IDS =','const ZODIAC_ENEMY_POOLS =']) {
    const begin=html.indexOf(marker), end=html.indexOf(';',begin);
    assert.ok(begin>0&&end>begin); vm.runInContext(html.slice(begin,end+1),c);
  }
  vm.runInContext(fnBody('const CAMPAIGN_TUNING =')+';',c);
  for(const name of ['getGameMode(', 'isBossRoom(', 'getCampaignTuning(', 'usesCampaignTuning(', 'setupRoom('])
    vm.runInContext(fnBody('function '+name),c);
  return c;
}
function enemies(c,ch,room,p) {
  c.Game.chapter.id=ch; c.Game.player={skills:{},atk:p.atk,maxHp:p.hp,hp:p.hp};
  c.setupRoom(room);
  return JSON.parse(JSON.stringify(c.Game.enemies.map(e=>({type:e.type,isBoss:e.isBoss,hp:e.maxHp,atk:e.atk}))));
}
const profiles=JSON.parse(fs.readFileSync(resolve(root,'tools/combat-profiles.json'),'utf8')).profiles;
test('setupRoom thật: cả 19×50 phòng độc lập hồ sơ, số quái/trùm theo shared config',()=>{
  const c=spawnHarness();
  for(let ch=1;ch<=19;ch++) for(let room=1;room<=50;room++) {
    const a=enemies(c,ch,room,profiles[1]), b=enemies(c,ch,room,profiles[5]);
    assert.deepEqual(a,b,`C${ch}-P${room}: không được neo theo người chơi`);
    const plan=c.ArtemisCampaignConfig.roomPlan(ch,room);
    assert.equal(a.length,plan.count,`C${ch}-P${room}: số quái`);
    for(const e of a) {assert.equal(e.isBoss,plan.isBoss);assert.ok(e.hp>0&&e.atk>0&&Number.isFinite(e.hp)&&Number.isFinite(e.atk));}
    if(plan.isBoss) assert.equal(a[0].type,plan.bossType);
  }
});
test('nâng cấp giảm TTK ≥8×, tăng số đòn chịu ≥2×; starter ở C5 chỉ chịu ≤5 đòn (phân tích)',()=>{
  const c=spawnHarness(), weak=profiles[1],strong=profiles[5];
  const mob=enemies(c,1,1,weak)[0];
  const dps=p=>p.atk*p.aspd*(1+p.crit*(p.critMult-1));
  const ttk=p=>mob.hp/dps(p), hits=p=>p.hp/(mob.atk*(1-p.dmgReduction));
  assert.ok(ttk(weak)/ttk(strong)>=8);
  assert.ok(hits(strong)/hits(weak)>=2);
  assert.ok(profiles[6].hp/enemies(c,5,1,profiles[6])[0].atk<=5);
});
test('chế độ không chiến dịch giữ quái thích ứng và lịch trùm cũ',()=>{
  const c=spawnHarness(); c.Game.maxRooms=15;
  for(const mode of ['endless','tower','bossrush','practice']) {
    c.Game.mode=mode;
    const a=enemies(c,1,1,profiles[1]),b=enemies(c,1,1,profiles[5]);
    assert.ok(b[0].hp>a[0].hp&&b[0].atk>a[0].atk,mode+' phải thích ứng');
    assert.equal(c.isBossRoom(5),true);
    assert.equal(c.isBossRoom(1),mode==='tower'||mode==='bossrush');
  }
});
