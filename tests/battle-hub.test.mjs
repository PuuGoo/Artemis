import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
function functionSource(name) {
  const start = html.indexOf(`      function ${name}(`);
  assert.ok(start >= 0, `Không tìm thấy ${name}`);
  const next = html.indexOf('\n      function ', start + 1);
  const source = html.slice(start, next < 0 ? undefined : next);
  // Dùng parser JS để không cắt nhầm dấu ngoặc trong template literal.
  let end = source.lastIndexOf('\n      }');
  assert.ok(end >= 0, `Không tìm thấy cuối hàm ${name}`);
  return source.slice(0, end + '\n      }'.length);
}

test('bộ chọn chương cũ không được hiện lại sau mỗi lần render lobby', () => {
  const classes = new Set(['hidden']);
  let markup = 'nội dung cũ';
  const el = {
    classList: {
      add(value) { classes.add(value); },
      toggle(value, on) { if (on) classes.add(value); else classes.delete(value); },
    },
    set innerHTML(value) { markup = value; },
    get innerHTML() { return markup; },
    querySelectorAll() { return []; },
  };
  const sandbox = {
    document: { getElementById: () => el },
    getActiveGameMode: () => ({ hasChapters: true }),
    CHAPTERS: [], SaveState: { selectedChapterIdx: 0 },
  };
  vm.runInNewContext(`${functionSource('renderChapterSelectStrip')}\nrenderChapterSelectStrip();`, sandbox);
  assert.equal(classes.has('hidden'), true, 'không được khôi phục bộ chọn chương trùng lặp');
  assert.equal(markup, '', 'không dựng các thẻ chương trùng vào vùng ẩn');
});

function launchHarness({ mode = 'campaign', preview = null, checkpoint = null } = {}) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', disabled: false, style: { setProperty() {} },
      classList: { toggle() {}, add() {}, remove() {} },
    });
    return elements.get(id);
  };
  const chapters = [{ id: 1, themeName: 'Đá Cổ' }, { id: 2, themeName: 'Dung Nham', unlock: { label: 'Thắng chương 1' } }];
  const sandbox = {
    document: { getElementById: get }, CHAPTERS: chapters,
    SaveState: { selectedChapterIdx: 0 }, previewChapterIdx: preview,
    getActiveGameMode: () => ({ id: mode, name: mode === 'campaign' ? 'Chiến Dịch' : 'Luyện Tập', hasChapters: mode === 'campaign' }),
    isChapterLocked: ch => ch.id === 2,
    getUsableCheckpoint: () => checkpoint,
  };
  vm.runInNewContext(`${functionSource('syncContinueButton')}\n${functionSource('syncBattleLaunch')}\nsyncBattleLaunch();`, sandbox);
  return { get };
}

test('xem chương khóa vô hiệu hóa nút bắt đầu và giữ chương thật đang chọn', () => {
  const { get } = launchHarness({ preview: 1 });
  assert.equal(get('btnStartGame').disabled, true);
  assert.match(get('battleLaunchHint').textContent, /Thắng chương 1/);
  assert.match(get('battleLaunchTitle').textContent, /Dung Nham/);
});

test('kỷ lục không được ghi thành tiếp tục; chỉ checkpoint hợp lệ có nút tiếp tục', () => {
  const { get } = launchHarness();
  assert.equal(get('btnStartGame').disabled, false);
  assert.match(get('btnStartGame').textContent, /lượt mới/i);
  assert.match(get('battleLaunchHint').textContent, /phòng 1/);
  assert.doesNotMatch(get('btnStartGame').textContent, /Chơi Tiếp/);
});

test('chế độ ngoài chiến dịch ghi đúng điểm đến, không mượn tên chương', () => {
  const { get } = launchHarness({ mode: 'practice', preview: 1 });
  assert.equal(get('btnStartGame').disabled, false);
  assert.match(get('battleLaunchTitle').textContent, /Luyện Tập/);
  assert.doesNotMatch(get('battleLaunchTitle').textContent, /Dung Nham/);
});

test('briefing luyện tập hiển thị đúng luật và không mượn chương chiến dịch', () => {
  const events = {};
  const card = { style: {}, innerHTML: '' };
  const modal = { dataset: {}, classList: { remove() {}, add() {} } };
  const button = id => ({ addEventListener(type, fn) { events[id] = fn; }, focus() {} });
  const sandbox = {
    document: { activeElement: { id: 'btnStartGame' }, getElementById: id => id === 'runBriefingModal' ? modal : id === 'runBriefingCard' ? card : button(id) },
    getActiveGameMode: () => ({ id: 'practice', name: 'Luyện Tập', icon: '🎯', color: '#22c55e', practice: true, hasChapters: false, rules: 'Không cộng vàng/kinh nghiệm', desc: 'Thử đội hình.' }),
    CHAPTERS: [{ id: 1, name: 'Chương 1: Đá Cổ', themeName: 'Đá Cổ', rooms: 15, accent: '#fff', accent2: '#fff', difficultyLabel: 'Dễ', enemyScale: 1 }],
    SaveState: { selectedChapterIdx: 0, modeBest: {} },
    getComputedStats: () => ({ powerScore: 100, hero: { name: 'Artemis' } }),
    getChapterBest: () => 0, formatCompactNumberVn: String,
    isChapterLocked: () => false, showToast() {}, closeRunBriefing() {}, startNewRun() {},
  };
  vm.runInNewContext(`${functionSource('openRunBriefing')}\nopenRunBriefing();`, sandbox);
  assert.match(card.innerHTML, /Luyện Tập/);
  assert.match(card.innerHTML, /Không cộng vàng\/kinh nghiệm/);
  assert.doesNotMatch(card.innerHTML, /Đá Cổ/);
  assert.equal(typeof events.btnBriefingStart, 'function');
});

test('chỉ giữ một nút bắt đầu thật và biên dịch được mọi script inline', () => {
  assert.equal((html.match(/id="btnStartGame"/g) || []).length, 1);
  assert.doesNotMatch(html, /id="msBtnStart"|id="btnStartModeRun"|data-chapter-card=/);
  assert.doesNotMatch(functionSource('renderMapSelect'), /Chơi Tiếp|renderChapterHeader\(/);
  assert.match(html, /id="battlePrepDetails"/);
  assert.match(html, /id="runBriefingModal" role="dialog" aria-modal="true"/);
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    if (match[1].trim()) new vm.Script(match[1]);
  }
});

test('checkpoint chỉ hiện đúng chiến dịch, không hiện khi xem chương khác', () => {
  function visible(mode, preview, cp) {
    let hidden = true;
    const btn = { classList: { add() { hidden = true; }, remove() { hidden = false; } } };
    const label = { textContent: '' };
    const sandbox = {
      document: { getElementById: id => id === 'btnContinueRun' ? btn : label },
      getUsableCheckpoint: () => cp,
      getActiveGameMode: () => ({ hasChapters: mode === 'campaign' }),
      previewChapterIdx: preview, SaveState: { selectedChapterIdx: 0 },
    };
    vm.runInNewContext(`${functionSource('syncContinueButton')}\nsyncContinueButton();`, sandbox);
    return !hidden;
  }
  assert.equal(visible('campaign', null, null), false);
  assert.equal(visible('campaign', null, { room: 4, maxRooms: 15 }), true);
  assert.equal(visible('campaign', 1, { room: 4, maxRooms: 15 }), false);
  assert.equal(visible('practice', null, { room: 4, maxRooms: 15 }), false);
});
