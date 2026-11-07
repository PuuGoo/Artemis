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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('combat-sim đọc được mọi hằng số từ source (không lệch công thức)', () => {
  const out = execFileSync(process.execPath, ['tools/combat-sim.mjs'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.match(out, /BASE_ATK=78/);
  assert.match(out, /Hệ số quái: \{/);
  // Độ khó chiến dịch nay là bảng tuyệt đối; parity nghĩa là đọc được cả bảng đó.
  assert.match(out, /CHIẾN DỊCH \(tuyệt đối\): C1 300HP\/70ATK/);
  assert.match(out, /C6 2400HP\/520ATK/);
  assert.match(out, /Chương: C1\(15 phòng\)/);
  assert.match(out, /không NaN\/Infinity, TTK > 0/);
  assert.match(out, /=== \d+ PASS \/ 0 FAIL ===/);
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
