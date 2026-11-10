/* Presentation camera only: browser resize must never resize room physics. */
(function (root) {
  'use strict';
  const cameras = new WeakMap();
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function beginRun(game) {
    game.width = 480;
    game.height = 1200;
    game.portalRect = { x: game.width / 2 - 44, y: 12, w: 88, h: 34 };
    resetCamera(game);
  }
  function viewSize(game) {
    const width = Math.max(1, game.width || 480);
    return { width, height: Math.min(game.height || 1200, width * 16 / 9) };
  }
  function fitLayout(availableWidth, availableHeight, width, height) {
    const aw = Math.max(0, availableWidth), ah = Math.max(0, availableHeight);
    const view = viewSize({ width, height });
    const scale = Math.min(aw / view.width, ah / view.height);
    const displayWidth = view.width * scale, displayHeight = view.height * scale;
    return { width: displayWidth, height: displayHeight, left: (aw - displayWidth) / 2, top: (ah - displayHeight) / 2 };
  }
  function backingSize(displayWidth, displayHeight, devicePixelRatio) {
    const dpr = Number.isFinite(devicePixelRatio) ? Math.min(2, Math.max(1, devicePixelRatio)) : 1;
    return { width: Math.max(1, Math.ceil(displayWidth * dpr)), height: Math.max(1, Math.ceil(displayHeight * dpr)) };
  }
  function resetCamera(game) { cameras.delete(game); }
  function camera(game, nowMs) {
    const view = viewSize(game), maxY = Math.max(0, game.height - view.height);
    const target = clamp((game.player?.y ?? game.height - 95) - view.height * .63, 0, maxY);
    let state = cameras.get(game);
    // New rooms snap to their entrance; no interpolation across a teleport.
    if (!state || state.room !== game.room || state.worldHeight !== game.height) {
      state = { y: target, time: nowMs, room: game.room, worldHeight: game.height };
      cameras.set(game, state);
    } else if (Number.isFinite(nowMs)) {
      const dt = Number.isFinite(state.time) ? clamp((nowMs - state.time) / 1000, 0, .1) : 0;
      state.y += (target - state.y) * (1 - Math.exp(-12 * dt));
      state.y = clamp(state.y, 0, maxY);
      state.time = nowMs;
    }
    return { x: 0, y: state.y, width: view.width, height: view.height };
  }
  function applyWorldTransform(ctx, game, nowMs) {
    const view = camera(game, nowMs);
    ctx.setTransform(ctx.canvas.width / view.width, 0, 0, ctx.canvas.height / view.height, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.translate(-view.x, -view.y);
    return view;
  }
  function clientToViewport(game, rect, clientX, clientY) {
    const view = viewSize(game);
    return { x: (clientX - rect.left) * view.width / (rect.width || 1), y: (clientY - rect.top) * view.height / (rect.height || 1) };
  }
  function screenToWorld(game, rect, clientX, clientY) {
    const point = clientToViewport(game, rect, clientX, clientY), view = camera(game);
    return { x: point.x + view.x, y: point.y + view.y };
  }
  function worldToScreen(game, rect, x, y) {
    const view = camera(game);
    return { x: rect.left + (x - view.x) * rect.width / view.width, y: rect.top + (y - view.y) * rect.height / view.height };
  }
  // Keep legacy pause-settings handlers compatible; framing is always compact portrait.
  let mode = 'fit';
  function getMode() { return mode; }
  function toggleMode() { mode = mode === 'large' ? 'fit' : 'large'; return mode; }
  function syncButton(button) {
    if (!button) return;
    button.textContent = 'Khung dọc'; button.dataset.mode = mode;
    button.setAttribute('aria-label', 'Khung chiến đấu dọc 9:16');
  }
  root.ArtemisArenaViewport = { beginRun, fitLayout, backingSize, getMode, toggleMode, syncButton,
    viewSize, camera, resetCamera, applyWorldTransform, clientToViewport, screenToWorld, worldToScreen };
})(globalThis);
