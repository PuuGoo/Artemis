// Khóa hành vi của hai quyết định Đợt 3:
//   1. Vũ khí khởi đầu chỉ được tặng cho tài khoản đang đi Hành Trình Tân Thủ.
//      Tài khoản cũ (startedAt = 0) không bị thêm vật phẩm ngoài ý muốn.
//   2. Nhãn bước chưa tới không được nói "khoá", và UI phải nói rõ hành động
//      làm sớm vẫn được tính (vì completeBeginnerStep cố ý tích luỹ).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('vũ khí khởi đầu chỉ tặng khi Hành Trình Tân Thủ đang mở', () => {
  const start = html.indexOf('const BeginnerHooks = {');
  assert.ok(start > 0, 'không tìm thấy BeginnerHooks');
  const end = html.indexOf('};', html.indexOf('onFinalStepDone()', start));
  const hooks = html.slice(start, end);

  const roomCleared = hooks.slice(hooks.indexOf('onRoomCleared()'), hooks.indexOf('onLoot('));
  assert.match(roomCleared, /isBeginnerJourneyActive\(\)/, 'phải kiểm journey trước khi tặng');
  assert.match(roomCleared, /grantStarterWeaponIfNeeded\(\)/);
  // Thứ tự: kiểm điều kiện TRƯỚC khi gọi hàm tặng.
  assert.ok(
    roomCleared.indexOf('isBeginnerJourneyActive()') < roomCleared.indexOf('grantStarterWeaponIfNeeded()'),
    'phải chặn trước rồi mới tặng',
  );
});

test('không còn nhãn "khoá" cho bước chưa tới, và có ghi chú tích luỹ', () => {
  assert.equal(html.includes('🔒 CHƯA MỞ'), false, 'nhãn cũ gây hiểu nhầm là bị khoá');
  assert.match(html, /⏳ CHƯA XONG/);
  assert.match(html, /Không bắt buộc làm đúng thứ tự/);
});

test('completeBeginnerStep vẫn tích luỹ (không chặn theo thứ tự) để tránh soft-lock', () => {
  const start = html.indexOf('function completeBeginnerStep(');
  const end = html.indexOf('\n      }', start);
  const body = html.slice(start, end);
  // Không được so sánh với currentStep để từ chối ghi nhận.
  assert.equal(/currentStep\s*!==/.test(body), false, 'không được chặn bước ngoài thứ tự');
  assert.match(body, /completedSteps\.includes\(stepId\)/, 'vẫn phải idempotent');
  assert.match(body, /BEGINNER_STEP_IDS\.has\(stepId\)/, 'vẫn phải whitelist');
});

test('tài khoản cũ không có startedAt -> isBeginnerJourneyActive false', () => {
  const start = html.indexOf('function isBeginnerJourneyActive()');
  const end = html.indexOf('\n      }', start);
  const body = html.slice(start, end);
  assert.match(body, /startedAt\s*<=\s*0/);
  assert.match(body, /return false/);
});
