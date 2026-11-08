// Đợt 5 — UI tân thủ: một việc cần làm + một nút, danh hiệu thật, và chỉ số trước/sau.
//
// Khoá các hành vi:
//   1. Không còn nhãn "MAX VIP" tĩnh lừa người chơi.
//   2. Danh hiệu suy ra từ tiến trình thật (tân binh -> cung thủ -> ...).
//   3. Lobby có thẻ "việc cần làm" với đúng MỘT nút hành động chính, và nút đó
//      trỏ tới đúng nơi (chiến đấu / trang bị / hoàn tất).
//   4. Danh sách N01–N08 vẫn còn trong panel chi tiết (không bị thay thế).
//   5. Hint của mọi bước khớp nhãn nút có thật trong game.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('không còn nhãn "MAX VIP" tĩnh; danh hiệu do JS quyết định', () => {
  // Chỉ được còn trong comment giải thích; không được còn trong markup/JS hiển thị.
  const code = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(code.includes('MAX VIP'), false, 'nhãn MAX VIP vẫn còn trong code');
  assert.match(html, /id="topRankBadge"/);
  assert.match(html, /function renderRankBadge\(\)/);
  assert.match(html, /function getPlayerRankTitle\(\)/);
  // Danh hiệu phải lấy từ dữ liệu thật, không phải hằng chuỗi.
  const body = html.slice(html.indexOf('function getPlayerRankTitle()'), html.indexOf('function renderRankBadge()'));
  assert.match(body, /beginnerJourney/);
  assert.match(body, /winsByChapter|lifetimeStats/);
});

test('thẻ "việc cần làm" nằm trong lobby và có đúng một nút hành động chính', () => {
  assert.match(html, /id="beginnerQuickCard"/, 'thiếu container thẻ nhiệm vụ nhanh');
  // Container phải nằm trong tab Chiến Đấu (lobby), không phải tab phụ.
  const tabStart = html.indexOf('id="tabBattle"');
  const tabEnd = html.indexOf('id="tabEquip"', tabStart);
  const section = html.slice(tabStart, tabEnd);
  assert.ok(section.includes('beginnerQuickCard'), 'thẻ phải nằm trong tab Chiến Đấu');

  const fn = html.slice(html.indexOf('function buildBeginnerQuickCardHtml()'), html.indexOf('function renderBeginnerQuickCard()'));
  // Chỉ một TEMPLATE nút hành động chính + một nút "Tất cả".
  // (data-bj-quick="all" viết cứng, còn nút chính dùng data-bj-quick="${action.id}".)
  assert.equal((fn.match(/data-bj-quick="\$\{action\.id\}"/g) || []).length, 1,
    'phải có đúng 1 template nút hành động chính');
  assert.equal((fn.match(/data-bj-quick="all"/g) || []).length, 1);
  assert.match(fn, /data-bj-quick="all"/);
  assert.match(fn, /Hành động|Việc cần làm/);
});

test('nút hành động trỏ đúng nơi theo từng loại bước', () => {
  const fn = html.slice(html.indexOf('function getBeginnerQuickAction(step)'), html.indexOf('function getBeginnerStepProgressText(step)'));
  assert.match(fn, /case 'dialogue'/, 'thiếu nhánh hội thoại');
  assert.match(fn, /case 'gear_equipped'/, 'thiếu nhánh mặc đồ');
  assert.match(fn, /case 'gear_upgraded'/, 'thiếu nhánh nâng cấp');
  assert.match(fn, /case 'chapter_cleared'/, 'thiếu nhánh vượt chương');
  assert.match(fn, /Vào Trận Ngay|Mở Trang Bị/);

  const handler = html.slice(html.indexOf('function renderBeginnerQuickCard()'), html.indexOf('function bindBeginnerJourneyEvents()'));
  assert.match(handler, /data-tab="tabEquip"/, 'nút mặc/nâng phải mở tab Trang Bị');
  assert.match(handler, /data-tab="tabTalents"/, 'nút "Tất cả" phải mở tab chứa danh sách');
  assert.match(handler, /btnStartGame/, 'nút chiến đấu phải dùng nút bắt đầu thật');
});

test('panel chi tiết N01–N08 vẫn tồn tại (không bị thẻ nhanh thay thế)', () => {
  assert.match(html, /function buildBeginnerJourneyPanelHtml\(\)/);
  assert.match(html, /id="beginnerJourneyContainer"/);
  assert.match(html, /data-bj-claim=/);
  // Vẫn render đủ 8 bước từ BEGINNER_STEPS.
  assert.match(html, /BEGINNER_STEPS\.map\(/);
});

test('hint của từng bước khớp nhãn nút có thật trong game', () => {
  const steps = html.slice(html.indexOf('const BEGINNER_STEPS = ['), html.indexOf('const BEGINNER_STEP_IDS'));
  // N02 phải nói đúng tên nút bắt đầu thật.
  assert.match(steps, /BẮT ĐẦU CHIẾN ĐẤU/, 'hint N02 phải dùng đúng nhãn nút bắt đầu');
  // Không được nhắc tab/nút không tồn tại.
  assert.equal(steps.includes('Phó Bản'), false, 'hint còn nhắc "Phó Bản" không có trong UI');
  assert.match(html, /id="btnStartGame"/);
  assert.match(html, /⚔️ BẮT ĐẦU CHIẾN ĐẤU/);
});

test('modal trang bị hiển thị tác động lên TỔNG chỉ số, tính bằng getComputedStats', () => {
  assert.match(html, /id="gearModalTotalImpact"/);
  const fnStart = html.indexOf('function refreshGearDetailModalContent()');
  // Phải tìm trong THÂN hàm: chuỗi 'gearModalTotalImpact' còn xuất hiện ở markup
  // (dòng <div id=...>) nằm TRƯỚC hàm, nếu indexOf toàn file sẽ cắt cửa sổ rỗng.
  const impactIdx = html.indexOf('gearModalTotalImpact', fnStart);
  const fn = html.slice(fnStart, html.indexOf('// ==================== BLACKSMITH', impactIdx));
  const preview = html.slice(html.indexOf('function previewGearDecision('), html.indexOf('function renderGearDecision('));
  assert.match(fn, /previewGearDecision\(item, slotKey, true\)/);
  assert.match(preview, /getComputedStats\(\)/, 'phải dùng hàm tính chỉ số thật');
  assert.match(preview, /finally \{ SaveState\.equippedGear = equipped; \}/, 'bắt buộc khôi phục bộ đang mặc');
  assert.match(preview, /\[slotKey\]: \{ \.\.\.item, level \}/, 'xem trước bằng bản sao, không đổi cấp đồ thật');
  assert.match(fn, /ATK/);
});

// ---------------------------------------------------------------------------
// Hành vi runtime của danh hiệu (VM, không cần browser)
// ---------------------------------------------------------------------------
function rankTitle(save) {
  const start = html.indexOf('const RANK_TITLES = [');
  const end = html.indexOf('function renderRankBadge()');
  const src = html.slice(start, end);
  const ctx = vm.createContext({ SaveState: save });
  vm.runInContext(`${src}\nthis.getRank = getPlayerRankTitle;`, ctx);
  return ctx.getRank();
}

test('danh hiệu: tân thủ -> CUNG THỦ -> LÃO LUYỆN -> BẬC THẦY', () => {
  const base = { beginnerJourney: {}, winsByChapter: {}, lifetimeStats: {} };
  assert.equal(rankTitle({ ...base }).id, 'recruit', 'chưa xong tutorial phải là tân binh');

  const done = { ...base, beginnerJourney: { isCompleted: true } };
  assert.equal(rankTitle({ ...done, winsByChapter: { 1: 1 } }).id, 'archer');
  assert.equal(rankTitle({ ...done, winsByChapter: { 1: 3 } }).id, 'veteran');
  assert.equal(rankTitle({ ...done, winsByChapter: { 1: 2, 2: 3 } }).id, 'master');

  // Chưa xong hành trình thì không được nhảy danh hiệu dù đã thắng nhiều.
  assert.equal(rankTitle({ ...base, winsByChapter: { 1: 9 } }).id, 'recruit');
});
