/* Presentation only. Supply settled rewards; dismissal never grants, spends, or saves. */
(function () {
  'use strict';
  const tiers = {
    common: ['Thường', '#bdc9dc', 0], uncommon: ['Tốt', '#73e2af', 1],
    rare: ['Hiếm', '#76caff', 2], epic: ['Sử Thi', '#d7a5ff', 3],
    legendary: ['Huyền Thoại', '#ffd77a', 4], mythic: ['Thần Thoại', '#ff91a4', 5]
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tier = rarity => tiers[String(rarity).split('_')[0]] || [String(rarity || 'Phần thưởng'), '#bdc9dc', 0];
  // art is an image URL, never executable HTML/SVG markup.
  function artwork(reward) {
    const art = String(reward.art || '');
    // Existing game renderers return trusted image/SVG markup. Extract only the
    // image source; render SVG as an inert image, never insert supplied HTML.
    const imageSource = /<img\b[^>]*\bsrc="([^"]+)"/i.exec(art);
    const svg = /^\s*<svg\b/i.test(art) && /<\/svg>\s*$/.test(art);
    const url = imageSource ? imageSource[1] : svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art) : art;
    const safe = svg || /^(?:https?:\/\/|\/(?!\/)|\.\/|assets\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(url);
    return safe ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span>${esc(reward.icon || '✦')}</span>`;
  }
  let dialog;
  const queue = [];
  let current;
  function getDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'artemisRewardResults';
    dialog.className = 'arr-dialog';
    dialog.setAttribute('aria-labelledby', 'arr-title');
    dialog.setAttribute('aria-describedby', 'arr-description');
    document.body.appendChild(dialog);
    dialog.addEventListener('click', event => {
      if (event.target.closest('[data-arr-close]')) dialog.close();
      else if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      }
    });
    dialog.addEventListener('close', () => {
      const finished = current;
      current = null;
      try {
        if (typeof finished?.returnFocus === 'function') finished.returnFocus();
        else if (finished?.returnFocus?.isConnected) finished.returnFocus.focus({ preventScroll: true });
      } finally {
        finished?.resolve();
        next();
      }
    });
    return dialog;
  }
  function next() {
    if (current || !queue.length) return;
    current = queue.shift();
    const { title, subtitle, rewards } = current;
    const best = rewards.reduce((a, b) => tier(b.rarity)[2] > tier(a.rarity)[2] ? b : a);
    const modal = getDialog();
    modal.innerHTML = `<div class="arr-shell">
      <header class="arr-header"><div><p class="arr-eyebrow">ARTEMIS / KHO BÁU</p><h2 id="arr-title">${esc(title || 'Phần thưởng của bạn')}</h2><p class="arr-subtitle">${esc(subtitle || 'Khám phá những chiến lợi phẩm vừa nhận được.')}</p></div><button type="button" class="arr-close" data-arr-close aria-label="Đóng kết quả">×</button></header>
      <div class="arr-scroll" tabindex="0" aria-label="Danh sách phần thưởng">
        <section class="arr-feature" style="--arr-rarity:${tier(best.rarity)[1]}" aria-label="Phần thưởng nổi bật"><div class="arr-feature-art" aria-hidden="true">${artwork(best)}</div><div><p class="arr-eyebrow">✦ PHẦN THƯỞNG NỔI BẬT</p><h3>${esc(best.name)}</h3><p>${esc(tier(best.rarity)[0])} · ×${esc(best.amount ?? 1)}</p></div></section>
        <div class="arr-collection"><h3>Đã nhận <strong>${rewards.length}</strong> phần thưởng</h3><span>Theo thứ tự nhận</span></div>
        <ol class="arr-grid">${rewards.map((r, i) => `<li class="arr-card ${tier(r.rarity)[2] >= 4 ? 'arr-exceptional' : ''}" style="--arr-rarity:${tier(r.rarity)[1]}"><div class="arr-card-top"><span>${esc(tier(r.rarity)[0])}</span><span>#${i + 1}</span></div><div class="arr-art" aria-hidden="true">${artwork(r)}</div><h4>${esc(r.name)}</h4><p class="arr-amount">×${esc(r.amount ?? 1)}</p></li>`).join('')}</ol>
      </div>
      <footer class="arr-footer"><p id="arr-description">✓ Kết quả đã được xác định. Đóng không thay đổi phần thưởng.</p><button type="button" class="arr-done" data-arr-close autofocus>Tiếp tục <span aria-hidden="true">→</span></button></footer>
    </div>`;
    modal.showModal();
    modal.querySelector('.arr-scroll').scrollTop = 0;
    modal.querySelector('.arr-done').focus({ preventScroll: true });
  }
  window.ArtemisRewardResults = Object.freeze({
    // Resolves after dismissal. Concurrent reveals are queued, never overwritten.
    show({ title, subtitle, rewards, returnFocus } = {}) {
      if (!Array.isArray(rewards) || !rewards.length) return Promise.resolve();
      return new Promise(resolve => {
        queue.push({ title, subtitle, rewards: rewards.map(r => ({ ...r })), returnFocus: returnFocus || document.activeElement, resolve });
        next();
      });
    }
  });
})();
