/* Server-authoritative patrol UI. Cloud owns flush, transaction lock and save reload. */
(function () {
  'use strict';
  var root, view = null, screen = 'main', busy = false, loading = false, error = '', received = [], returnFocus, timer, loadedAt = 0, pending = null;
  var names = { gold: 'Vàng', exp: 'Kinh nghiệm', playerExp: 'Kinh nghiệm', aurocite: 'Aurocite', necklace: 'Cuộn dây chuyền', gems: 'Đá quý', diamonds: 'Kim cương', energy: 'Năng lượng', runeDust: 'Bụi rune', equipmentDust: 'Bụi trang bị', gearScrolls: 'Cuộn nâng cấp', scrolls: 'Cuộn nâng cấp', rune: 'Rune', gear: 'Trang bị' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function number(n) { return Math.max(0, Number(n) || 0).toLocaleString('vi-VN'); }
  function time(n) { n = Math.max(0, Math.floor(Number(n) || 0)); return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(function (x) { return String(x).padStart(2, '0'); }).join(':'); }
  function rewards(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.map(function (r) { return Object.assign({}, r, { key: r.key || r.type || r.resource || r.id, amount: r.amount == null ? (r.quantity == null ? r.count : r.quantity) : r.amount }); });
    return Object.keys(input).flatMap(function (key) { var value = input[key]; if (value && typeof value === 'object') { if (value.amount != null || value.quantity != null) return [Object.assign({ key: key }, value)]; return rewards(value).map(function (r) { return Object.assign({}, r, { category: key }); }); } return [{ key: key, amount: value }]; });
  }
  function icon(r) {
    var key = r.key || '', img = '';
    if (r.icon && /^\/?assets\/[a-zA-Z0-9_/.-]+\.(png|svg|webp)$/.test(r.icon)) img = r.icon;
    else if (key === 'runeDust' || key === 'rune') img = 'assets/runes/crystals/Rune_bless_10.png';
    else if (key === 'gear' || key === 'equipmentDust') img = 'assets/gear/oracle-armor.png';
    else if (r.category === 'gearScrolls' || r.category === 'scrolls' || /scroll/i.test(key)) return '<span class="patrol-scroll" aria-hidden="true">' + ({ weapon: '➶', armor: '◆', helmet: '♜', boots: '♟', ring: '◉', amulet: '✦' }[key] || '✦') + '</span>';
    if (img) return '<img src="' + esc(img) + '" alt="" loading="lazy">';
    if (key === 'gold') return '<span class="patrol-coin" aria-hidden="true">✦</span>';
    if (key === 'exp' || key === 'playerExp') return '<span class="patrol-exp" aria-hidden="true">EXP</span>';
    return '<span class="patrol-gem" aria-hidden="true">' + (key === 'energy' ? 'ϟ' : '✧') + '</span>';
  }
  function tiles(input) {
    var list = rewards(input).filter(function (r) { return Number(r.amount) > 0; });
    if (!list.length) return '<p class="patrol-empty">Chưa có phần thưởng tích lũy.<br>Hãy quay lại sau ít phút!</p>';
    return list.map(function (r) { var label = r.name || r.label || names[r.key] || ({ weapon: 'Cuộn vũ khí', armor: 'Cuộn giáp', helmet: 'Cuộn mũ', boots: 'Cuộn giày', ring: 'Cuộn nhẫn', amulet: 'Cuộn dây chuyền' }[r.key]) || r.key; return '<div class="patrol-tile" title="' + esc(label) + '"><span class="patrol-sr">' + esc(label) + ': </span>' + icon(r) + '<strong>' + number(r.amount) + '</strong></div>'; }).join('');
  }
  function button(label, action, disabled, extra) { return '<button type="button" class="patrol-button ' + (extra || '') + '" data-patrol="' + action + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>'; }
  function elapsed() { return Math.min(Number(view && view.capSeconds) || 86400, (Number(view && view.elapsedSeconds) || 0) + Math.floor((Date.now() - loadedAt) / 1000)); }
  function main() {
    var rates = view.ratesPerHour || view.hourlyRates || view.rates || view.perHour || {};
    return '<div class="patrol-scene" role="img" aria-label="Cung thủ tuần tra xuyên khu rừng, dưới ánh nắng ban mai"></div>' + title('Thu Nhập Tuần Tra') + '<div class="patrol-body"><p class="patrol-intro">Tự động tích lũy phần thưởng</p><p class="patrol-elapsed">Đã Tuần Tra <span data-patrol-time>' + time(elapsed()) + '</span></p><div class="patrol-rates"><span>' + icon({ key: 'gold' }) + '<b>' + number(rates.gold == null ? view.goldPerHour : rates.gold) + ' / h</b></span><span>' + icon({ key: 'exp' }) + '<b>' + number(rates.exp == null ? (rates.playerExp == null ? view.expPerHour : rates.playerExp) : rates.exp) + ' / h</b></span></div><div class="patrol-grid">' + tiles(view.rewards || view.pendingRewards) + '</div><p class="patrol-note">Tích lũy tối đa 24h · Chương cao, thưởng nhiều hơn</p><p class="patrol-chapter">Chương cao nhất đã vượt: ' + number(view.bestClearedChapter) + '</p><div class="patrol-actions">' + button('Tuần Tra Nhanh', 'quick', busy, '') + button(busy ? 'Đang nhận…' : 'Nhận', 'claim', busy || !view.canClaim, 'is-green') + '</div>' + (!view.canClaim ? '<p class="patrol-note">' + (view.claimInSeconds ? 'Có thể nhận sau ' + time(view.claimInSeconds) : 'Phần thưởng chưa đủ để nhận') + '</p>' : '') + '</div>';
  }
  function title(s) { return '<h2 class="patrol-ribbon" id="patrol-title">' + s + '</h2>'; }
  function quick() {
    var q = view.quickEnergy || (view.quick && view.quick.energy) || {}, ad = view.quickAd || (view.quick && view.quick.ad) || {};
    var cost = q.cost == null ? q.energyCost : q.cost; if (cost && typeof cost === 'object') cost = cost.energy;
    var remaining = q.remaining == null ? q.remainingUses : q.remaining, adRemaining = ad.remaining == null ? ad.remainingUses : ad.remaining;
    var canEnergy = q.available !== false && q.canUse !== false && Number(remaining) > 0 && cost != null;
    return title('Tuần Tra Nhanh') + '<div class="patrol-body"><p class="patrol-quick-copy">Ngay lập tức nhận phần thưởng tuần tra.<br>Danh sách thưởng có thể nhận:</p><div class="patrol-grid">' + tiles(q.rewards || view.quickRewards || (view.quick && view.quick.rewards)) + '</div><div class="patrol-actions patrol-quick-actions"><div><p>Số lần khả dụng: ' + (adRemaining == null ? '—' : number(adRemaining)) + '</p>' + button('▷ Miễn Phí', 'quickAd', busy || ad.available !== true, '') + '</div><div><p>Số lần khả dụng: ' + (remaining == null ? '—' : number(remaining)) + '</p>' + button(cost == null ? 'Chưa có dữ liệu' : 'ϟ × ' + number(cost), 'quickEnergy', busy || !canEnergy, '') + '</div></div><p class="patrol-note">' + (ad.available === true ? 'Quảng cáo được xác minh bởi máy chủ.' : 'Quảng cáo thưởng hiện chưa khả dụng.') + '</p>' + button('Quay lại', 'back', busy, 'patrol-back') + '</div>';
  }
  function render() {
    if (!root || root.hidden) return;
    var active = document.activeElement, key = active && active.getAttribute && active.getAttribute('data-patrol');
    var html = loading && !view ? title('Thu Nhập Tuần Tra') + '<div class="patrol-state" role="status"><span class="patrol-spinner"></span>Đang tải tuần tra…</div>' : view ? (screen === 'quick' ? quick() : main()) : title('Thu Nhập Tuần Tra');
    if (screen === 'reward') html = title('Thưởng đã nhận') + '<div class="patrol-body"><p class="patrol-received">Đã thêm vào túi đồ của bạn</p><div class="patrol-grid">' + tiles(received) + '</div><p class="patrol-note">Nhấn chỗ trống để tiếp tục</p>' + button('Tiếp tục', 'back', false, 'is-green') + '</div>';
    root.innerHTML = '<section class="patrol-panel ' + (screen === 'main' && view ? 'has-scene' : '') + '" role="dialog" aria-modal="true" aria-labelledby="patrol-title" tabindex="-1" aria-busy="' + (busy || loading) + '">' + html + (error ? '<div class="patrol-error" role="alert">' + esc(error) + button('Thử lại', 'retry', busy || loading, '') + '</div>' : '') + '<button class="patrol-close" type="button" aria-label="Đóng tuần tra" data-patrol="close"' + (busy ? ' disabled' : '') + '>×</button></section><p class="patrol-dismiss">Nhấn chỗ trống để đóng</p>';
    var next = key && root.querySelector('[data-patrol="' + key + '"]:not(:disabled)');
    if (next) next.focus(); else if (!root.contains(document.activeElement)) root.querySelector('[role="dialog"]').focus();
  }
  function unwrap(body) { if (body && !body.patrol && body.data && body.data.patrol) body = body.data; if (!body || body.ok === false || !body.patrol) throw new Error(body && (body.message || body.error) || 'Không tải được tuần tra. Vui lòng thử lại.'); return body; }
  async function load() {
    if (loading || busy) return; loading = true; error = ''; render();
    try {
      var cloud = window.ArtemisCloud;
      var body = cloud && typeof cloud.patrolPreview === 'function' ? await cloud.patrolPreview() : await fetch('/api/patrol', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('Không thể kết nối máy chủ (' + r.status + ').'); return r.json(); });
      view = unwrap(body).patrol; loadedAt = Date.now();
    } catch (e) { error = e.message || 'Lỗi kết nối. Vui lòng thử lại.'; }
    finally { loading = false; render(); }
  }
  async function request(action) {
    if (busy || loading || !view) return;
    var cloud = window.ArtemisCloud;
    if (!cloud || typeof cloud.patrolRequest !== 'function') { error = 'Chưa thể đồng bộ phần thưởng. Vui lòng tải lại trò chơi.'; render(); return; }
    if (pending && pending.action !== action) { error = 'Hãy thử lại giao dịch trước để xác nhận kết quả.'; render(); return; }
    pending = pending || { action: action, id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16); }) };
    busy = true; error = ''; render();
    try {
      var body = unwrap(await cloud.patrolRequest(action, pending.id));
      view = body.patrol; loadedAt = Date.now(); received = body.rewards || body.grantedRewards || []; pending = null; screen = 'reward';
    } catch (e) { if (e.definitive) pending = null; error = e.message || 'Chưa xác nhận được giao dịch. Thử lại không nhận trùng thưởng.'; }
    finally { busy = false; render(); }
  }
  function close() { if (busy) return; if (screen !== 'main') { screen = 'main'; error = ''; render(); return; } root.hidden = true; clearInterval(timer); if (returnFocus && returnFocus.isConnected) returnFocus.focus(); }
  function init() {
    if (root) return;
    root = document.createElement('div'); root.className = 'patrol-overlay'; root.id = 'artemis-patrol'; root.hidden = true; document.body.appendChild(root);
    root.addEventListener('click', function (e) {
      if (e.target === root || e.target.classList.contains('patrol-dismiss')) return close();
      var b = e.target.closest('[data-patrol]'); if (!b || b.disabled) return;
      var action = b.getAttribute('data-patrol');
      if (action === 'close') close(); else if (action === 'quick' || action === 'back') { screen = action === 'quick' ? 'quick' : 'main'; error = ''; render(); } else if (action === 'retry') { if (pending) request(pending.action); else load(); } else request(action);
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === 'Tab') { var buttons = Array.from(root.querySelectorAll('button:not(:disabled)')); var first = buttons[0], last = buttons[buttons.length - 1]; if (!first) { e.preventDefault(); return; } if (e.shiftKey && (document.activeElement === first || document.activeElement === root.querySelector('[role="dialog"]'))) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); } }
    });
  }
  function open() { init(); if (!root.hidden) return; returnFocus = document.activeElement; root.hidden = false; screen = 'main'; view = null; render(); clearInterval(timer); timer = setInterval(function () { var n = root.querySelector('[data-patrol-time]'); if (n && view) n.textContent = time(elapsed()); if (view && screen === 'main' && !pending && !error && Date.now() - loadedAt >= 30000) load(); }, 1000); return load(); }
  window.ArtemisPatrol = { init: init, open: open, close: close };
})();
