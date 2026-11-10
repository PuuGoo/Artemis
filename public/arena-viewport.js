/* Presentation camera only: browser resize must never resize room physics. */
(function (root) {
  'use strict';
  const cameras = new WeakMap();
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const ROOM_WIDTH = 480;
  const ORIGINAL_ROOM_HEIGHT = 1200;
  const SPAWN_BOTTOM_MARGIN = 95;
  const PORTAL_TOP = 12;
  const PORTAL_HEIGHT = 34;
  const PORTAL_CENTER_Y = PORTAL_TOP + PORTAL_HEIGHT / 2;
  const TRAVEL_RETAINED = .6;
  // Retain entrance/portal margins; shorten centerline travel, not total height, by 40%.
  const ROOM_HEIGHT = SPAWN_BOTTOM_MARGIN + PORTAL_CENTER_Y +
    (ORIGINAL_ROOM_HEIGHT - SPAWN_BOTTOM_MARGIN - PORTAL_CENTER_Y) * TRAVEL_RETAINED;
  function beginRun(game) {
    game.width = ROOM_WIDTH;
    game.height = ROOM_HEIGHT;
    game.portalRect = { x: game.width / 2 - 44, y: PORTAL_TOP, w: 88, h: PORTAL_HEIGHT };
    resetCamera(game);
  }
  function viewSize(game) {
    const width = Math.max(1, game.width || ROOM_WIDTH);
    // Short rooms cap the view; fitLayout scales both axes uniformly, without squashing.
    return { width, height: Math.min(game.height || ROOM_HEIGHT, width * 16 / 9) };
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
  function roomFraming(game) {
    const room = Number(game.room) || 0;
    const safe = [5,15,25,35,45].includes(room);
    const expansive = !safe && (room > 0 && room % 10 === 0 || game.roomIsBoss === true);
    // Screen-height occupancy, not fraction of a landscape monitor's area.
    return { occupancy: expansive ? .93 : .78, zoom: room > 0 && !safe && !expansive ? 1.06 : 1,
      kind: expansive ? 'expansive' : 'compact' };
  }
  function syncFrame(game, element) {
    if (!element) return;
    const frame = roomFraming(game);
    element.style.setProperty('--arena-frame-height', `${frame.occupancy * 100}dvh`);
    element.dataset.arenaFrame = frame.kind;
  }
  function resetCamera(game) { cameras.delete(game); }
  function camera(game, nowMs) {
    const base = viewSize(game), zoom = roomFraming(game).zoom;
    const view = { width: base.width / zoom, height: base.height / zoom };
    const maxY = Math.max(0, game.height - view.height);
    const target = clamp((game.player?.y ?? game.height - SPAWN_BOTTOM_MARGIN) - view.height * .63, 0, maxY);
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
    return { x: Math.max(0, (game.width - view.width) / 2), y: state.y, width: view.width, height: view.height };
  }
  function applyWorldTransform(ctx, game, nowMs) {
    const view = camera(game, nowMs);
    ctx.setTransform(ctx.canvas.width / view.width, 0, 0, ctx.canvas.height / view.height, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.translate(-view.x, -view.y);
    return view;
  }
  // Screen-space overlays must reset BOTH zoom and camera translation.
  function applyViewportTransform(ctx, game) {
    const view = viewSize(game);
    ctx.setTransform(ctx.canvas.width / view.width, 0, 0, ctx.canvas.height / view.height, 0, 0);
  }
  function clientToViewport(game, rect, clientX, clientY) {
    const view = viewSize(game);
    return { x: (clientX - rect.left) * view.width / (rect.width || 1), y: (clientY - rect.top) * view.height / (rect.height || 1) };
  }
  function screenToWorld(game, rect, clientX, clientY) {
    const view = camera(game);
    return { x: view.x + (clientX - rect.left) * view.width / (rect.width || 1),
      y: view.y + (clientY - rect.top) * view.height / (rect.height || 1) };
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
    viewSize, roomFraming, syncFrame, camera, resetCamera, applyWorldTransform, applyViewportTransform, clientToViewport, screenToWorld, worldToScreen };
})(globalThis);
