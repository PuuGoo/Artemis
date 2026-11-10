/* Presentation only: this module never rolls, purchases, equips, or saves gear. */
(function () {
  'use strict';
  const rarities = {
    common: { label: 'Thường', color: '#bdc9dc', rank: 0 },
    uncommon: { label: 'Tốt', color: '#73e2af', rank: 1 },
    rare: { label: 'Hiếm', color: '#76caff', rank: 2 },
    epic: { label: 'Sử Thi', color: '#d7a5ff', rank: 3 },
    legendary: { label: 'Huyền Thoại', color: '#ffd77a', rank: 4 },
    mythic: { label: 'Thần Thoại', color: '#ff91a4', rank: 5 }
  };
  const slots = { weapon: 'Vũ khí', armor: 'Giáp', helmet: 'Mũ', boots: 'Giày', ring: 'Nhẫn', amulet: 'Dây chuyền', necklace: 'Dây chuyền' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let dialog;
  let restoreFocus;
  function getDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'artemisChestResults';
    dialog.className = 'acr-dialog';
    dialog.setAttribute('aria-labelledby', 'acr-title');
    dialog.setAttribute('aria-describedby', 'acr-description');
    document.body.appendChild(dialog);
    dialog.addEventListener('click', event => {
      if (event.target.closest('[data-acr-close]')) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (typeof restoreFocus === 'function') restoreFocus();
      else if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
      restoreFocus = null;
    });
    return dialog;
  }
  function card(result, index, renderArt) {
    const rarity = rarities[result.quality] || rarities.common;
    const tpl = result.tpl;
    // Namespace the existing SVG helper's IDs: duplicates are common in 100 pulls.
    const prefix = `acr-${index}-`;
    const art = renderArt(result.item.templateId).replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`);
    return `<li class="acr-card ${result.isSTier ? 'acr-card-s' : ''}" style="--rarity:${rarity.color}" data-gear-uid="${esc(result.item.uid)}">
      <div class="acr-card-top"><span>${esc(rarity.label)}</span>${result.isSTier ? '<b class="acr-s-badge">S</b>' : '<span class="acr-index">' + (index + 1) + '</span>'}</div>
      <div class="acr-art" aria-hidden="true">${art}</div>
      <div class="acr-card-name">${esc(tpl.name)}</div>
      <div class="acr-card-detail">${esc(slots[tpl.slot] || tpl.slot)} · Cấp ${esc(result.item.level || 1)}</div>
      ${result.isSTier ? '<div class="acr-locked">S-TIER · Đã khóa bảo vệ</div>' : ''}
    </li>`;
  }
  window.ArtemisChestResults = Object.freeze({
    show({ results, chestName, renderArt, returnFocus }) {
      if (!Array.isArray(results) || !results.length) return;
      const modal = getDialog();
      restoreFocus = returnFocus || document.activeElement;
      const best = results.reduce((a, b) => {
        const rank = r => (r.isSTier ? 100 : 0) + (rarities[r.quality]?.rank || 0);
        return rank(b) > rank(a) ? b : a;
      });
      const bestRarity = rarities[best.quality] || rarities.common;
      const counts = results.reduce((all, r) => { all[r.quality] = (all[r.quality] || 0) + 1; return all; }, {});
      const sCount = results.filter(r => r.isSTier).length;
      modal.innerHTML = `<div class="acr-shell">
        <header class="acr-header"><div><p class="acr-eyebrow">ARTEMIS / KHO BÁU</p><h2 id="acr-title">Chiến lợi phẩm của bạn</h2><p class="acr-chest-name">${esc(chestName)}</p></div><button type="button" class="acr-close" data-acr-close aria-label="Đóng kết quả mở rương">×</button></header>
        <div class="acr-scroll" tabindex="0" aria-label="Danh sách trang bị nhận được">
          <section class="acr-feature" style="--rarity:${bestRarity.color}" aria-label="Trang bị nổi bật">
            <div class="acr-feature-art" aria-hidden="true">${renderArt(best.item.templateId)}</div>
            <div><p class="acr-eyebrow">${best.isSTier ? '✦ S-TIER / TRANG BỊ NỔI BẬT' : '✦ TRANG BỊ NỔI BẬT'}</p><h3>${esc(best.tpl.name)}</h3><p class="acr-feature-rarity">${esc(bestRarity.label)} · ${esc(slots[best.tpl.slot] || best.tpl.slot)} · Cấp ${esc(best.item.level || 1)}</p><p class="acr-feature-note">${best.isSTier ? 'Đã khóa và đánh dấu yêu thích để bảo vệ trang bị quý.' : 'Sẵn sàng trong Kho Trang Bị của bạn.'}</p></div>
          </section>
          <div class="acr-collection-heading"><h3>Đã nhận <strong>${results.length}</strong> trang bị</h3><span>Đúng thứ tự mở rương</span></div>
          <div class="acr-summary" aria-label="Tổng kết độ hiếm">${Object.entries(rarities).filter(([key]) => counts[key]).map(([key, rarity]) => `<span style="--rarity:${rarity.color}"><i aria-hidden="true"></i>${rarity.label} <b>×${counts[key]}</b></span>`).join('')}${sCount ? `<span class="acr-summary-s">Trong đó S-Tier <b>×${sCount}</b></span>` : ''}</div>
          <ol class="acr-grid">${results.map((result, index) => card(result, index, renderArt)).join('')}</ol>
        </div>
        <footer class="acr-footer"><p id="acr-description"><span aria-hidden="true">✓</span> Toàn bộ ${results.length} trang bị đã được thêm vào kho.</p><button type="button" class="acr-done" data-acr-close autofocus>Tiếp tục <span aria-hidden="true">→</span></button></footer>
      </div>`;
      if (!modal.open) modal.showModal();
      modal.querySelector('.acr-scroll').scrollTop = 0;
      modal.querySelector('.acr-done').focus({ preventScroll: true });
    }
  });
})();
