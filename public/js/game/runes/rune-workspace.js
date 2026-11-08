// Giao diện Ngọc dùng chung ngôn ngữ thiết kế với kho Trang bị; không quyết định thưởng/giá.
(function (root) {
  'use strict';
  const categoryNames = { etched: 'Khắc Ấn', blessing: 'Chúc Phúc', enhancement: 'Tăng Cường', ability: 'Kỹ Năng' };
  const tierNames = { normal: 'Thường', fine: 'Tốt', rare: 'Hiếm', epic: 'Sử Thi', epic_1: 'Sử Thi +1', epic_2: 'Sử Thi +2', legendary: 'Huyền Thoại', legendary_1: 'Huyền Thoại +1', legendary_2: 'Huyền Thoại +2', legendary_3: 'Huyền Thoại +3', mythic: 'Thần Thoại' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const number = value => Number(value || 0).toLocaleString('vi-VN');
  function combatNote(id) {
    return id === 'rune_flame' ? '<div data-rune-combat-note class="rune-reference-note"><b>Tác dụng đã hoạt động trong Artemis</b><p>Khảm đúng nhóm Tăng Cường: Epic (hạng 4+) tăng 50% sát thương cháy; Legendary (hạng 7+) tăng thêm 50% sát thương độc. Cần nguồn gây lửa/độc; chưa triển khai nổ Mythic, bonus phẳng Normal/Fine và phù phép trong bảng tham khảo.</p></div>' : '';
  }
  function create(options) {
    let scope = 'owned', dialog = null;
    const doc = root.document;
    const rank = id => root.RuneEconomy.copies(options.getState().runes?.[id]);
    const get = id => options.data.find(rune => rune.id === id);
    const image = rune => `<img src="${escape(options.image(rune))}" data-rune-id="${escape(rune.id)}" data-rune-type="${escape(rune.type)}" alt="" draggable="false">`;
    const equippedAt = id => Object.entries(options.getSlots()).flatMap(([cat, ids]) => ids.map((value, index) => ({ cat, index, id: value }))).find(slot => slot.id === id);
    function focusCard(id) {
      const card = [...doc.querySelectorAll('[data-equip-wiki-rune]')].find(el => el.dataset.equipWikiRune === id);
      card?.focus({ preventScroll: true });
    }
    function bindImages(container) {
      container.querySelectorAll('img[data-rune-id]').forEach(img => { img.onerror = () => options.fallback(img); });
    }
    function detailMarkup(id, socket) {
      const rune = get(id), wiki = options.wiki[id];
      if (!rune || !wiki) return '';
      const currentRank = rank(id), at = equippedAt(id), tier = options.tier(rune);
      const stats = options.getBaseStats(rune.type, tier.id);
      const target = socket || options.getSelected();
      const targetLabel = target ? `${categoryNames[target.cat]} · ô ${target.index + 1}` : `Ô trống nhóm ${categoryNames[rune.type]}`;
      const tierRanks = { Normal: 1, Fine: 2, Rare: 3, Epic: 4, 'Epic +2': 6, Legendary: 7, 'Legendary +1': 8, 'Legendary +2': 9, 'Legendary +3': 10, Mythic: 11 };
      const table = entries => Object.entries(entries || {}).map(([label, text]) => `<div class="rune-reference-tier"><b>${escape(label)}</b><p>${escape(text || 'Không có thuộc tính riêng ở bậc này')}</p></div>`).join('');
      return `<div class="rune-sheet">
        <header class="rune-sheet-heading"><div class="rune-sheet-icon" style="${tier.style}">${image(rune)}</div><div><span class="rune-eyebrow">${escape(categoryNames[rune.type])}</span><h3 id="rune-workspace-detail-title">${escape(rune.name)}</h3><p>${currentRank ? escape(tierNames[tier.id]) : 'Chưa sở hữu'}${currentRank ? ` · Bậc ${currentRank}/11` : ''}</p></div><button type="button" data-rune-popup-close class="rune-sheet-close" aria-label="Đóng chi tiết ngọc" autofocus>×</button></header>
        <section class="rune-decision"><h4>${at ? 'Đang gắn trên bảng ngọc' : currentRank ? 'Sẵn sàng gắn ngọc' : 'Ngọc chưa có trong kho'}</h4><p>${at ? `${escape(categoryNames[at.cat])} · ô ${at.index + 1}` : currentRank ? `Gắn vào: ${escape(targetLabel)}` : 'Khám phá Tàn Tích để nhận ngọc. Ba viên trùng loại và phẩm chất tự ghép lên một bậc.'}</p>
          ${currentRank ? `<div class="rune-stat-pair"><span>Chỉ số cơ bản của ngọc</span><strong>+${number(stats.atk)} Công · +${number(stats.hp)} Máu</strong></div><p class="rune-muted">${at ? 'Đã tính vào chỉ số ngọc đang gắn.' : 'Chỉ có tác dụng sau khi gắn đúng nhóm. Thay ngọc sẽ thay chỉ số của ô đó.'}</p>` : ''}
        </section>
        ${combatNote(id)}
        <details class="rune-reference"><summary>Thuộc tính theo phẩm chất · Tham khảo</summary><p class="rune-reference-note">Dữ liệu Archero 2 Wiki, bản lưu 16/03/2026; không khẳng định mọi hiệu ứng đã được mô phỏng trong chiến đấu.</p><div class="rune-reference-tier"><b>Chỉ số gốc theo Wiki</b><p>${escape(wiki.base)}</p></div>${Object.entries(wiki.effects || {}).map(([label, text]) => `<div class="rune-reference-tier ${currentRank >= tierRanks[label] ? 'is-active' : ''}"><b>${currentRank >= tierRanks[label] ? '✓ ' : ''}${escape(label)}</b><p>${escape(text && text !== '-' ? text : 'Không có thuộc tính riêng ở bậc này')}</p></div>`).join('')}</details>
        <details class="rune-reference"><summary>Phù phép · Tham khảo</summary>${table(wiki.enchantments)}${table(wiki.sharedEnchantments)}</details>
        <footer class="rune-sheet-actions"><button type="button" data-rune-popup-dismiss>Để sau</button>${at ? '<button type="button" data-rune-popup-unequip class="rune-primary">Tháo ngọc</button>' : currentRank ? `<button type="button" data-rune-popup-equip class="rune-primary"${target && target.cat !== rune.type ? ' disabled' : ''}>Gắn ngọc</button>` : '<button type="button" data-rune-popup-ruins class="rune-primary">Khám phá →</button>'}</footer>
        ${currentRank && !at && target && target.cat !== rune.type ? '<p class="rune-target-warning">Ô đang chọn khác nhóm ngọc. Hãy chọn ô cùng nhóm trước khi gắn.</p>' : ''}
      </div>`;
    }
    function openDetail(id, socket = null) {
      const markup = detailMarkup(id, socket);
      if (!markup) return;
      dialog?.close();
      const modal = doc.createElement('dialog');
      dialog = modal;
      modal.className = 'rune-workspace-detail';
      modal.setAttribute('aria-labelledby', 'rune-workspace-detail-title');
      modal.innerHTML = markup;
      const close = () => modal.close();
      modal.addEventListener('close', () => { modal.remove(); if (dialog === modal) { dialog = null; focusCard(id); } }, { once: true });
      modal.addEventListener('click', event => {
        if (event.target !== modal) return;
        const box = modal.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
      });
      modal.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const controls = [...modal.querySelectorAll('button, summary')].filter(el => !el.disabled && el.getClientRects().length);
        const index = controls.indexOf(doc.activeElement);
        event.preventDefault();
        controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus();
      });
      modal.querySelector('[data-rune-popup-close]').onclick = close;
      modal.querySelector('[data-rune-popup-dismiss]').onclick = close;
      modal.querySelector('[data-rune-popup-equip]')?.addEventListener('click', () => { close(); options.onEquip(id); });
      modal.querySelector('[data-rune-popup-unequip]')?.addEventListener('click', () => { const at = equippedAt(id); if (at) { close(); options.onUnequip(id, at); } });
      modal.querySelector('[data-rune-popup-ruins]')?.addEventListener('click', () => { close(); options.onExplore(); });
      bindImages(modal);
      doc.body.appendChild(modal);
      modal.showModal();
    }
    function render(container) {
      const state = options.getState(), slots = options.getSlots(), selected = options.getSelected();
      const scroller = doc.getElementById('tabEquip'), scrollTop = scroller?.scrollTop || 0;
      const filterLeft = container.querySelector('.rune-filter-row')?.scrollLeft || 0;
      const quickOpen = container.querySelector('.rune-presets')?.open || false;
      const totals = options.getTotals(), hero = options.getHero();
      const owned = options.data.filter(rune => rank(rune.id) > 0).length;
      const active = Object.values(slots).flat().filter(id => rank(id) > 0).length;
      const category = state.runeTypeFilter || 'all';
      const catalog = options.data.filter(rune => (scope === 'all' || rank(rune.id) > 0) && (category === 'all' || rune.type === category)).sort((a, b) => Number(rank(b.id) > 0) - Number(rank(a.id) > 0) || (state.runeSortByQuality ? rank(b.id) - rank(a.id) : 0) || a.name.localeCompare(b.name, 'vi'));
      const positions = { ability: [[14,15],[10,36],[10,58],[15,78]], enhancement: [[86,15],[90,36],[90,58],[85,78]], blessing: [[29,47],[71,47]], etched: [[34,88],[50,88],[66,88]] };
      const placeholders = { ability: '✦', enhancement: '❋', blessing: '✧', etched: '◇' };
      container.innerHTML = `<section class="rune-equipped-section"><div class="rune-section-title"><div><span class="rune-eyebrow">NGỌC ĐANG GẮN</span><h3>${escape(hero.name)}</h3></div><span class="rune-equipped-count">${active}/13 ô</span></div>
        <div class="rune-altar" aria-label="13 ô ngọc theo nhóm"><div class="rune-hero"><img src="${escape(hero.avatar)}" alt="${escape(hero.name)}" draggable="false"></div>${Object.entries(options.categories).flatMap(([cat, meta]) => Array.from({ length: meta.slots }, (_, index) => {
          const id = rank(slots[cat]?.[index]) ? slots[cat][index] : null, rune = get(id), tier = rune ? options.tier(rune) : null, picked = selected?.cat === cat && selected?.index === index;
          const [x, y] = positions[cat][index];
          return `<button type="button" class="rune-socket ${rune ? 'is-filled' : 'is-empty'} ${picked ? 'is-picked' : ''}" style="--x:${x}%;--y:${y}%;${tier ? tier.style : ''}" data-rune-slot="${cat}:${index}" data-rune-cat="${cat}" aria-label="${escape(categoryNames[cat])}, ô ${index + 1}: ${escape(rune?.name || 'trống')}" aria-pressed="${picked}"><span aria-hidden="true">${rune ? image(rune) : placeholders[cat]}</span></button>`;
        })).join('')}</div>
        <div class="rune-altar-summary" aria-label="Chỉ số ngọc đang gắn"><span>Công <strong>+${number(totals.atk)}</strong></span><span>Máu <strong>+${number(totals.hp)}</strong></span></div>
        <details class="rune-board-help"><summary>Vị trí các nhóm ngọc</summary><p>Kỹ Năng: 4 ô bên trái · Tăng Cường: 4 ô bên phải · Chúc Phúc: 2 ô cạnh nhân vật · Khắc Ấn: 3 ô phía dưới.</p></details></section>
        <section class="rune-catalog" id="runeCatalog"><div class="rune-section-title"><div><span class="rune-eyebrow">HÀNH TRANG</span><h3>Kho ngọc</h3></div><span class="rune-muted">${owned}/${options.data.length} loại đã có</span></div>
          <div class="rune-catalog-toolbar"><div class="rune-scope-tabs" aria-label="Phạm vi kho ngọc"><button type="button" data-rune-scope="owned" aria-pressed="${scope === 'owned'}">Đã có (${owned})</button><button type="button" data-rune-scope="all" aria-pressed="${scope === 'all'}">Tất cả</button></div><button type="button" id="btnRuneSortQuality" aria-pressed="${!!state.runeSortByQuality}">↕ Phẩm chất</button></div>
          <div class="rune-filter-row" aria-label="Lọc nhóm ngọc">${[{ id: 'all', label: 'Tất cả' }, ...Object.keys(options.categories).map(id => ({ id, label: categoryNames[id] }))].map(item => `<button type="button" data-rune-cat-filter="${item.id}" class="rune-filter ${category === item.id ? 'is-active' : ''}" aria-pressed="${category === item.id}">${escape(item.label)}</button>`).join('')}</div>
          ${selected ? `<div class="rune-selection-note"><span>Ô ${selected.index + 1} · ${escape(categoryNames[selected.cat])}<small>Chọn viên cùng nhóm để gắn hoặc thay.</small></span><button type="button" data-rune-clear-selection>Bỏ chọn</button></div>` : '<p class="rune-catalog-hint">Chạm ngọc để xem chi tiết. Chạm ô đang gắn để thay hoặc tháo.</p>'}
          <div class="rune-inventory-grid" aria-label="Danh sách ngọc">${catalog.map(rune => {
            const tier = options.tier(rune), value = rank(rune.id), at = equippedAt(rune.id);
            return `<button type="button" data-equip-wiki-rune="${rune.id}" data-type="${rune.type}" class="rune-inventory-card ${at ? 'is-equipped' : ''} ${value ? '' : 'is-locked'}" style="${tier.style}"${value ? ` data-tier="${tier.id}"` : ''} aria-label="${escape(rune.name)}, ${value ? tierNames[tier.id] : 'chưa sở hữu'}${at ? ', đang gắn' : ''}"><span class="rune-inventory-glyph" aria-hidden="true">${image(rune)}</span>${at ? '<span class="rune-count" aria-hidden="true">✓</span>' : ''}<span class="rune-short-name">${escape(rune.name)}</span><span class="rune-rank">${value ? escape(tierNames[tier.id]) : 'Chưa sở hữu'}</span></button>`;
          }).join('') || `<div class="rune-empty-state"><strong>${owned ? 'Chưa có ngọc trong nhóm này' : 'Kho ngọc còn trống'}</strong><p>${owned ? 'Thử chọn nhóm khác hoặc xem Tất cả để tra cứu.' : 'Bấm Khám phá để nhận ngọc tại Tàn Tích. Ngọc nhận trùng sẽ tự ghép theo cơ chế hiện tại.'}</p></div>`}</div>
        </section>
        <details class="rune-presets"${quickOpen ? ' open' : ''}><summary>Bộ khảm nhanh &amp; cách nhận ngọc</summary><p>Ngọc nhận từ Tàn Tích; ba viên trùng loại và phẩm chất tự ghép lên một bậc. Bộ khảm chỉ dùng ngọc đã sở hữu.${state.runeMythicEnchant ? ' Đã mở phù phép.' : ' Phù phép mở tại Epic +2 với 10 Enchantium.'}</p><div>${[['oracle_weapon','Oracle'],['strike_master','Phi kiếm'],['meteor_cataclysm','Thiên thạch'],['circle_sawblade','Cầu xoay'],['sprite_legion','Tinh linh']].map(([id, label]) => `<button type="button" data-rune-preset="${id}">${label}</button>`).join('')}</div></details>`;
      container.querySelectorAll('[data-rune-slot]').forEach(button => { button.onclick = () => { const [cat, index] = button.dataset.runeSlot.split(':'); options.onSelectSlot({ cat, index: Number(index) }); const id = options.getSlots()[cat]?.[Number(index)]; if (rank(id)) openDetail(id, { cat, index: Number(index) }); }; });
      container.querySelectorAll('[data-rune-scope]').forEach(button => { button.onclick = () => { scope = button.dataset.runeScope; render(container); }; });
      container.querySelectorAll('[data-rune-cat-filter]').forEach(button => { button.onclick = () => options.onFilter(button.dataset.runeCatFilter); });
      container.querySelectorAll('[data-equip-wiki-rune]').forEach(button => { button.onclick = () => openDetail(button.dataset.equipWikiRune); });
      container.querySelectorAll('[data-rune-preset]').forEach(button => { button.onclick = () => options.onPreset(button.dataset.runePreset); });
      container.querySelector('[data-rune-clear-selection]')?.addEventListener('click', options.onClearSelection);
      container.querySelector('#btnRuneSortQuality').onclick = options.onSort;
      bindImages(container);
      container.querySelector('.rune-filter-row').scrollLeft = filterLeft;
      if (scroller) scroller.scrollTop = scrollTop;
    }
    return Object.freeze({ render, openDetail, detailMarkup });
  }
  root.ArtemisRuneWorkspace = Object.freeze({ create, combatNote });
})(globalThis);
