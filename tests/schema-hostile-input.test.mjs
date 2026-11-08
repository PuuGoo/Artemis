import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/save/schema.js';

const clean = raw => sanitizeSave(raw).data;

test('ECO-009/010: NaN và Infinity không lọt vào currency hay level', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const d = clean({ gold: bad, gems: bad, stamina: bad, playerLevel: bad, gearLevel: bad, salvageMaterials: bad });
    for (const [k, v] of Object.entries({ gold: d.gold, gems: d.gems, stamina: d.stamina, playerLevel: d.playerLevel, gearLevel: d.gearLevel, salvageMaterials: d.salvageMaterials })) {
      assert.ok(Number.isFinite(v), `${k} phải hữu hạn, nhận ${v}`);
      assert.equal(JSON.stringify(v).includes('null'), false, `${k} không được thành null`);
    }
  }
});

test('ECO-011: currency/level âm bị clamp về 0 hoặc giá trị sàn hợp lệ', () => {
  const d = clean({ gold: -500, gems: -1, stamina: -20, gearLevel: -3, salvageMaterials: -9 });
  assert.equal(d.gold, 0);
  assert.equal(d.gems, 0);
  assert.equal(d.stamina, 0);
  assert.equal(d.gearLevel, 1);
  assert.equal(d.salvageMaterials, 0);
});

test('ECO-012: prototype pollution qua body lồng và __proto__ không nhiễm Object.prototype', () => {
  const raw = JSON.parse('{"gold":5,"__proto__":{"polluted":"yes"},"talents":{"__proto__":{"polluted":"yes"}},"gearBag":[{"__proto__":{"polluted":"yes"}}]}');
  const d = clean(raw);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(d.gold, 5);
});

test('Giá trị siêu lớn bị clamp đúng trần, không tràn thành Infinity', () => {
  const d = clean({ gold: 1e300, gems: 1e300 });
  assert.equal(d.gold, 1e12);
  assert.equal(d.gems, 1e12);
  assert.ok(Number.isFinite(d.gold) && Number.isFinite(d.gems));
});

test('Currency dạng string được coerce thành số (chấp nhận có chủ đích, không thêm quyền)', () => {
  // Lý do giữ: save legacy có thể lưu số dưới dạng string; từ chối sẽ làm mất tiến trình cũ.
  // Coerce KHÔNG vượt qua kiểm soát nào: sau sanitize vẫn đi qua validateEconomyDelta.
  const d = clean({ gold: '999999', gems: { v: 5 }, stamina: [5], playerLevel: 'abc' });
  assert.equal(d.gold, 999999);
  assert.equal(d.gems, 0);        // object -> NaN -> default
  assert.equal(d.stamina, 5);     // Number([5]) === 5: array coerce được, vẫn qua delta validator
  assert.equal(d.playerLevel, 1);
});
