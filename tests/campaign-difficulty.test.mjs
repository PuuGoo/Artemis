// Khoá lại: độ khó CHIẾN DỊCH phải TUYỆT ĐỐI, không neo theo chỉ số người chơi.
//
// Lý do (docs/audit/artemis-new-player/13-GAME-BALANCE-MEASURED.md): khi HP địch =
// playerAtk × hệ số và ATK địch = playerMaxHp / hệ số, nâng cấp bị triệt tiêu —
// đo được ATK tăng 39× mà TTK chỉ giảm 1,96×, HP tăng 25× mà số đòn chịu vẫn 16,1.
// Người mặc đồ tân thủ ở chương 5 vẫn sống đúng 16 đòn như chương 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(resolve(root, 'public/index.html'), 'utf8').replace(/\r\n/g, '\n');

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

test('có bảng độ khó tuyệt đối cho cả 7 chương', () => {
  assert.match(html, /const CAMPAIGN_TUNING = \{/);
  const blk = html.slice(html.indexOf('const CAMPAIGN_TUNING = {'), html.indexOf('};', html.indexOf('const CAMPAIGN_TUNING = {')));
  const rows = [...blk.matchAll(/(\d): \{ mobHp: (\d+), mobAtk: (\d+), bossHp: (\d+), bossAtk: (\d+) \}/g)];
  assert.equal(rows.length, 7, 'phải có đủ 7 chương');
  for (const m of rows) {
    for (let k = 2; k <= 5; k++) assert.ok(Number(m[k]) > 0, `giá trị không dương ở chương ${m[1]}`);
  }
});

test('bảng tuyệt đối đơn điệu: chương sau khó hơn chương trước', () => {
  const blk = html.slice(html.indexOf('const CAMPAIGN_TUNING = {'), html.indexOf('};', html.indexOf('const CAMPAIGN_TUNING = {')));
  const rows = [...blk.matchAll(/(\d): \{ mobHp: (\d+), mobAtk: (\d+), bossHp: (\d+), bossAtk: (\d+) \}/g)]
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
  assert.match(body, /campaign\s*\?[\s\S]{0,120}?campaign\.mobAtk/, 'ATK quái chiến dịch phải lấy từ bảng tuyệt đối');
  assert.match(body, /campaign\s*\?[\s\S]{0,160}?campaign\.bossHp/, 'HP trùm chiến dịch phải lấy từ bảng tuyệt đối');

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
    const seg = modes.slice(modes.indexOf(`id: '${id}'`), modes.indexOf(`id: '${id}'`) + 400);
    assert.match(seg, /hasChapters: false/, `${id} phải giữ hasChapters: false`);
  }
});

test('simulator xác nhận các bất biến cân bằng (chạy thật)', () => {
  const out = execFileSync(process.execPath, ['tools/combat-sim.mjs'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  assert.match(out, /=== \d+ PASS \/ 0 FAIL ===/, 'simulator phải 0 FAIL:\n' + out.slice(-800));
  // Các kết luận then chốt phải xuất hiện.
  assert.match(out, /giảm TTK \d+(\.\d+)?× \(yêu cầu ≥ 8×\)/);
  assert.match(out, /tăng số đòn chịu \d+(\.\d+)?× \(yêu cầu ≥ 2×\)/);
  assert.match(out, /hồ sơ G ở C5-P1 chỉ chịu [\d.]+ đòn \(yêu cầu ≤ 5\)/);
  assert.match(out, /cùng chương\+phòng: mọi hồ sơ gặp ĐÚNG cùng quái/);
});
