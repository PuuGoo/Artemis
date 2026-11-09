/* Khung nhìn chỉ đổi kích thước hiển thị, không đổi hình học giữa lượt. */
(function (root) {
  'use strict';
  function beginRun(game, viewportWidth) {
    const mobile = viewportWidth < 768;
    game.width = mobile ? 480 : 800;
    game.height = mobile ? 720 : 600;
    game.portalRect = { x: game.width / 2 - 44, y: 12, w: 88, h: 34 };
  }
  function fitLayout(availableWidth, availableHeight, width, height, mode) {
    const aw = Math.max(0, availableWidth), ah = Math.max(0, availableHeight);
    const scale = Math.min(aw / width, ah / height) * (mode === 'large' ? 1 : 0.88);
    const displayWidth = width * scale, displayHeight = height * scale;
    return { width: displayWidth, height: displayHeight, left: (aw - displayWidth) / 2, top: (ah - displayHeight) / 2 };
  }
  const preferenceKey = 'artemis.arenaSize';
  let mode = 'fit';
  try { if (root.localStorage?.getItem(preferenceKey) === 'large') mode = 'large'; } catch (_) { /* Bộ nhớ riêng tư vẫn chơi được. */ }
  function getMode() { return mode; }
  function toggleMode() {
    mode = mode === 'large' ? 'fit' : 'large';
    try { root.localStorage?.setItem(preferenceKey, mode); } catch (_) { /* Chỉ lưu tuỳ chọn giao diện. */ }
    return mode;
  }
  function syncButton(button) {
    if (!button) return;
    button.textContent = mode === 'large' ? 'Vừa màn hình' : 'Hiển thị lớn';
    button.title = 'Hiện tại: ' + (mode === 'large' ? 'Hiển thị lớn' : 'Vừa màn hình') + ' • Bấm để đổi';
    button.dataset.mode = mode;
    button.setAttribute('aria-label', button.title + ': ' + button.textContent);
  }
  root.ArtemisArenaViewport = { beginRun, fitLayout, getMode, toggleMode, syncButton };
})(globalThis);
