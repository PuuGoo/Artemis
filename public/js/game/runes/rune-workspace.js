// Giao diện Ngọc theo ảnh mẫu: đài tròn, bốn dáng ngọc, kho vuông 5 cột; không sửa cơ chế.
(function (root) {
  'use strict';
  const categoryNames = { etched: 'Khắc Ấn', blessing: 'Chúc Phúc', enhancement: 'Tăng Cường', ability: 'Kỹ Năng' };
  const tierNames = { normal: 'Thường', fine: 'Tốt', rare: 'Hiếm', epic: 'Sử Thi', epic_1: 'Sử Thi +1', epic_2: 'Sử Thi +2', legendary: 'Huyền Thoại', legendary_1: 'Huyền Thoại +1', legendary_2: 'Huyền Thoại +2', legendary_3: 'Huyền Thoại +3', mythic: 'Thần Thoại' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const number = value => Number(value || 0).toLocaleString('vi-VN');
  function combatNote(id) {
    return id === 'rune_flame' ? '<div data-rune-combat-note class="rune-reference-note"><b>Tác dụng đã hoạt động trong Artemis</b><p>Khảm đúng nhóm Tăng Cường: Epic (hạng 4+) tăng 50% sát thương cháy; Legendary (hạng 7+) tăng thêm 50% sát thương độc. Cần nguồn gây lửa/độc; chưa triển khai nổ Mythic, bonus phẳng Normal/Fine và phù phép trong bảng tham khảo.</p></div>' : '';
  }
  const crystalShapes = {
    ability: 'M50 3 Q55 3 60 7 L88 23 Q94 26 94 33 V70 Q94 76 88 80 L60 96 Q50 102 40 96 L12 80 Q6 76 6 70 V33 Q6 26 12 23 L40 7 Q45 3 50 3Z',
    enhancement: 'M50 3 Q54 2 60 14 L68 21 L85 20 Q96 19 92 32 L88 48 L95 65 Q99 76 86 78 L70 81 L59 94 Q51 103 44 93 L34 83 L17 81 Q4 80 9 67 L14 50 L8 34 Q4 22 17 22 L34 20 L44 7 Q47 3 50 3Z',
    blessing: 'M31 5 H69 L94 30 V70 L70 95 H30 L6 70 V30Z',
    etched: 'M50 4 Q58 4 67 16 L92 44 Q98 50 92 58 L65 89 Q50 105 35 89 L8 58 Q2 50 8 44 L33 16 Q42 4 50 4Z',
  };
  const navIcons = {
    characters: '<path d="M4 13 6 6l5-3 5 1 4 4 1 7-3 1v5H8v-5Zm5-1v4h2v-4Zm6 0v4h2v-4Z"/>',
    gear: '<path d="m8 3-6 5 4 5 2-2v10h8V11l2 2 4-5-6-5-4 3Zm2 1 2 2 2-2v6l-2 3-2-3Z"/>',
    runes: '<path fill-rule="evenodd" d="m12 1 10 6v10l-10 6L2 17V7Zm0 4L6 9v6l6 4 6-4V9Zm0 2 5 8-5-2-5 2Z"/>',
  };
  function crystal(type, id, tier = 'epic') {
    const source = root.RuneArt?.crystalSrc(type, tier);
    if (source) return `<img class="rune-crystal rune-crystal-art" src="${source}" alt="" draggable="false">`;
    const path = crystalShapes[type] || crystalShapes.ability;
    return `<svg class="rune-crystal" viewBox="0 0 100 104" aria-hidden="true"><defs><linearGradient id="${id}-rim" x2=".5" y2="1"><stop stop-color="#ead4ff"/><stop offset=".45" stop-color="#b17acb"/><stop offset="1" stop-color="#7f479e"/></linearGradient><linearGradient id="${id}-face" x2=".3" y2="1"><stop stop-color="#65068b"/><stop offset=".45" stop-color="#9905bb"/><stop offset=".8" stop-color="#ee16f4"/><stop offset="1" stop-color="#ff82ff"/></linearGradient><radialGradient id="${id}-core" cy=".25" r=".8"><stop stop-color="#4e006c"/><stop offset=".65" stop-color="#9302b9"/><stop offset="1" stop-color="#d619ee"/></radialGradient></defs><path d="${path}" fill="url(#${id}-rim)" stroke="#3e2c60" stroke-width="3"/><path d="${path}" transform="translate(5 5) scale(.9)" fill="url(#${id}-face)" stroke="#efafff" stroke-width="1.5"/><path d="${path}" transform="translate(12 12) scale(.76)" fill="url(#${id}-core)"/><path d="M33 15 L49 7 L49 20 L36 25Z" fill="#ffe4ff" opacity=".28"/></svg>`;
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
      container.querySelectorAll('svg.rune-crystal').forEach(svg => {
        const tier = svg.closest('[data-tier]')?.dataset.tier;
        if (!tier || !root.RuneArt) return;
        const [mid, light, dark] = root.RuneArt.crystalPalette(tier);
        svg.querySelectorAll('stop').forEach((stop, index) => stop.setAttribute('stop-color', [light, mid, dark][index % 3]));
      });
      container.querySelectorAll('img[data-rune-id]').forEach(img => { img.onerror = () => options.fallback(img); });
    }
    function mergeMarkup(onlyId = null) {
      const state = options.getState();
      const rows = options.data.filter(rune => !onlyId || rune.id === onlyId).flatMap(rune => root.RuneEconomy.TIERS.map((tier, index) => {
        const count = Number(state.runeStones?.[rune.id]?.[tier]) || 0;
        if (!count) return '';
        const next = root.RuneEconomy.TIERS[index + 1];
        return `<div class="rune-merge-row" data-tier="${tier}"><span class="rune-merge-art">${crystal(rune.type, `merge-${rune.id}-${tier}`, tier)}</span><div><b>${escape(rune.name)}</b><p>${escape(tierNames[tier])} ×${count}${next ? ` → ${escape(tierNames[next])}` : ' · Tối đa'}</p></div><button type="button" data-rune-merge="${escape(rune.id)}" data-merge-tier="${tier}"${count < 3 || !next ? ' disabled' : ''}>${next ? 'Ghép 3 → 1' : 'Tối đa'}</button></div>`;
      })).join('');
      return `<section class="rune-merge-panel"><h3>Ghép ngọc</h3><p>1 viên chính + 2 viên trùng loại, cùng bậc → 1 viên bậc tiếp theo. Không tốn vàng hoặc đá quý. Thần Thoại là bậc tối đa.</p>${rows || '<p>Chưa có ngọc nguyên liệu. Khám phá Tàn Tích để nhận thêm.</p>'}<p data-rune-merge-error role="status"></p></section>`;
    }
    function bindMerge(container) {
      container.querySelectorAll('[data-rune-merge]').forEach(button => { button.onclick = async () => {
        if (container.dataset.merging === 'true') return;
        container.dataset.merging = 'true';
        button.disabled = true;
        try { await options.onMerge(button.dataset.runeMerge, button.dataset.mergeTier); dialog?.close(); }
        catch (error) { container.querySelector('[data-rune-merge-error]').textContent = error.message; button.disabled = false; }
        finally { container.dataset.merging = 'false'; }
      }; });
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
        <section class="rune-decision"><h4>${at ? 'Đang gắn trên bảng ngọc' : currentRank ? 'Sẵn sàng gắn ngọc' : 'Ngọc chưa có trong kho'}</h4><p>${at ? `${escape(categoryNames[at.cat])} · ô ${at.index + 1}` : currentRank ? `Gắn vào: ${escape(targetLabel)}` : 'Khám phá Tàn Tích để nhận ngọc. Ba viên trùng loại và phẩm chất ghép tại Xưởng Ngọc lên một bậc.'}</p>
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
      modal.innerHTML = markup + mergeMarkup(id);
      bindMerge(modal);
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
      const qualitySort = state.runeSortByQuality !== false;
      const catalog = options.data.filter(rune => (scope === 'all' || rank(rune.id) > 0) && (category === 'all' || rune.type === category)).sort((a, b) => Number(rank(b.id) > 0) - Number(rank(a.id) > 0) || (qualitySort ? rank(b.id) - rank(a.id) : 0) || a.name.localeCompare(b.name, 'vi'));
      const positions = { ability: [[17.5,14.5],[10.5,36],[10.5,61],[17.5,83]], enhancement: [[82.5,14.5],[90,36],[90,61],[82.5,83]], blessing: [[26,48],[74,48]], etched: [[34,84],[50,84],[66,84]] };
      const placeholders = { ability: '✦', enhancement: '❋', blessing: '✧', etched: '◇' };
      container.innerHTML = `<section class="rune-equipped-section" aria-label="Bảng ngọc của ${escape(hero.name)}">
        <div class="rune-altar" aria-label="13 ô ngọc theo nhóm"><img class="rune-altar-art" src="/assets/ui/rune-altar.svg" alt="" aria-hidden="true"><div class="rune-hero"><img src="${escape(hero.avatar)}" alt="${escape(hero.name)}" draggable="false"></div>${Object.entries(options.categories).flatMap(([cat, meta]) => Array.from({ length: meta.slots }, (_, index) => {
          const id = rank(slots[cat]?.[index]) ? slots[cat][index] : null, rune = get(id), tier = rune ? options.tier(rune) : null, picked = selected?.cat === cat && selected?.index === index;
          const [x, y] = positions[cat][index];
          return `<button type="button" class="rune-socket ${rune ? 'is-filled' : 'is-empty'} ${picked ? 'is-picked' : ''}" style="--x:${x}%;--y:${y}%;${tier ? tier.style : ''}"${tier ? ` data-tier="${tier.id}"` : ''} data-rune-slot="${cat}:${index}" data-rune-cat="${cat}" title="${escape(categoryNames[cat])} · ô ${index + 1}: ${escape(rune?.name || 'Trống')}" aria-label="${escape(categoryNames[cat])}, ô ${index + 1}: ${escape(rune?.name || 'trống')}" aria-pressed="${picked}">${crystal(cat, `socket-${cat}-${index}`, tier?.id || 'empty')}<span class="rune-socket-symbol" aria-hidden="true">${rune ? image(rune) : cat === 'etched' ? '' : placeholders[cat]}</span></button>`;
        })).join('')}</div>
        <details class="rune-board-help"><summary aria-label="Thông tin bảng ngọc">i</summary><div><b>${escape(hero.name)} · ${active}/13 ô đã gắn</b><div class="rune-altar-summary"><span>Công <strong>+${number(totals.atk)}</strong></span><span>Máu <strong>+${number(totals.hp)}</strong></span></div><p>Kỹ Năng: 4 ô trái · Tăng Cường: 4 ô phải · Chúc Phúc: 2 ô cạnh nhân vật · Khắc Ấn: 3 ô dưới. Ô trống vẫn gắn được, không tự khóa theo ảnh mẫu.</p></div></details></section>
        <nav class="rune-reference-tabs" aria-label="Chuyển mục trang bị">${[['characters','Anh hùng'],['gear','Trang bị'],['runes','Ngọc']].map(([id, label]) => `<button type="button" data-rune-nav="${id}"${id === 'runes' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${navIcons[id]}</svg>${label}</button>`).join('')}</nav>
        <section class="rune-catalog" id="runeCatalog" aria-label="Kho ngọc"><div class="rune-catalog-toolbar"><button type="button" id="btnRuneSortQuality" aria-pressed="${qualitySort}">Theo phẩm chất</button><button type="button" id="btnRuneWorkshop">Xưởng<br>Ngọc</button></div>
          ${selected ? `<div class="rune-selection-note"><span>Ô ${selected.index + 1} · ${escape(categoryNames[selected.cat])}</span><button type="button" data-rune-clear-selection>Bỏ chọn ×</button></div>` : ''}
          <div class="rune-inventory-grid" aria-label="Danh sách ngọc">${catalog.map(rune => {
            const tier = options.tier(rune), value = rank(rune.id), at = equippedAt(rune.id);
            return `<button type="button" data-equip-wiki-rune="${rune.id}" data-type="${rune.type}" class="rune-inventory-card ${at ? 'is-equipped' : ''} ${value ? '' : 'is-locked'}" style="${tier.style}" data-tier="${tier.id}" title="${escape(rune.name)} · ${value ? tierNames[tier.id] : 'Chưa sở hữu'}" aria-label="${escape(rune.name)}, ${value ? tierNames[tier.id] : 'chưa sở hữu'}${at ? ', đang gắn' : ''}"><span class="rune-inventory-glyph" aria-hidden="true">${crystal(rune.type, `card-${rune.id}`, tier.id)}${image(rune)}</span>${at ? '<span class="rune-count" aria-hidden="true">✓</span>' : ''}<span class="rune-short-name">${escape(rune.name)}</span><span class="rune-rank">${value ? escape(tierNames[tier.id]) : 'Chưa sở hữu'}</span>${value > 1 ? `<span class="rune-tier-badge" aria-hidden="true">${value}</span>` : ''}</button>`;
          }).join('') || `<div class="rune-empty-state"><strong>${owned ? 'Chưa có ngọc trong nhóm này' : 'Kho ngọc còn trống'}</strong><p>${owned ? 'Thử chọn nhóm khác hoặc xem Tất cả để tra cứu.' : 'Bấm Khám phá để nhận ngọc tại Tàn Tích. Ngọc nhận trùng sẽ ghép tại Xưởng Ngọc theo cơ chế hiện tại.'}</p></div>`}</div>
        </section>
        <details class="rune-presets"${quickOpen ? ' open' : ''}><summary>Xưởng Ngọc · Lọc kho &amp; bộ khảm</summary><p>${owned}/${options.data.length} loại đã sở hữu. Ngọc nhận từ Tàn Tích; ba viên trùng loại và phẩm chất ghép tại Xưởng Ngọc lên một bậc. Bộ khảm chỉ dùng ngọc đã sở hữu.${state.runeMythicEnchant ? ' Đã mở phù phép.' : ' Phù phép mở tại Epic +2 với 10 Enchantium.'}</p><button type="button" data-rune-explore class="rune-primary">Khám phá Tàn Tích →</button><div class="rune-scope-tabs" aria-label="Phạm vi kho ngọc"><button type="button" data-rune-scope="owned" aria-pressed="${scope === 'owned'}">Đã có (${owned})</button><button type="button" data-rune-scope="all" aria-pressed="${scope === 'all'}">Tất cả</button></div><div class="rune-filter-row" aria-label="Lọc nhóm ngọc">${[{ id: 'all', label: 'Tất cả' }, ...Object.keys(options.categories).map(id => ({ id, label: categoryNames[id] }))].map(item => `<button type="button" data-rune-cat-filter="${item.id}" class="rune-filter ${category === item.id ? 'is-active' : ''}" aria-pressed="${category === item.id}">${escape(item.label)}</button>`).join('')}</div><div>${[['oracle_weapon','Oracle'],['strike_master','Phi kiếm'],['meteor_cataclysm','Thiên thạch'],['circle_sawblade','Cầu xoay'],['sprite_legion','Tinh linh']].map(([id, label]) => `<button type="button" data-rune-preset="${id}">${label}</button>`).join('')}</div></details>`;
      container.querySelectorAll('[data-rune-slot]').forEach(button => { button.onclick = () => { const [cat, index] = button.dataset.runeSlot.split(':'); options.onSelectSlot({ cat, index: Number(index) }); const id = options.getSlots()[cat]?.[Number(index)]; if (rank(id)) openDetail(id, { cat, index: Number(index) }); }; });
      container.querySelectorAll('[data-rune-scope]').forEach(button => { button.onclick = () => { scope = button.dataset.runeScope; render(container); }; });
      container.querySelectorAll('[data-rune-cat-filter]').forEach(button => { button.onclick = () => options.onFilter(button.dataset.runeCatFilter); });
      container.querySelectorAll('[data-equip-wiki-rune]').forEach(button => { button.onclick = () => openDetail(button.dataset.equipWikiRune); });
      container.querySelectorAll('[data-rune-preset]').forEach(button => { button.onclick = () => options.onPreset(button.dataset.runePreset); });
      container.querySelectorAll('[data-rune-nav]').forEach(button => { button.onclick = () => options.onNavigate(button.dataset.runeNav); });
      container.querySelectorAll('[data-rune-explore]').forEach(button => { button.onclick = options.onExplore; });
      const workshop = container.querySelector('.rune-presets');
      workshop.insertAdjacentHTML?.('beforeend', mergeMarkup());
      bindMerge(container);
      container.querySelector('#btnRuneWorkshop').onclick = () => { const panel = container.querySelector('.rune-presets'); panel.open = true; panel.scrollIntoView({ behavior: 'auto', block: 'start' }); };
      container.querySelector('[data-rune-clear-selection]')?.addEventListener('click', options.onClearSelection);
      container.querySelector('#btnRuneSortQuality').onclick = options.onSort;
      bindImages(container);
      container.querySelector('.rune-filter-row').scrollLeft = filterLeft;
      if (scroller) scroller.scrollTop = scrollTop;
    }
    return Object.freeze({ render, openDetail, detailMarkup, mergeMarkup });
  }
  function navigationMarkup(active) {
    return `<nav class="rune-reference-tabs" aria-label="Chuyển mục trang bị">${[['characters','Anh hùng'],['gear','Trang bị'],['runes','Ngọc']].map(([id, label]) => `<button type="button" data-equipment-nav="${id}"${id === active ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${navIcons[id]}</svg>${label}</button>`).join('')}</nav><details class="equipment-extra-nav"><summary>Mục khác</summary><button type="button" data-equipment-nav="artifacts">Thánh vật</button><button type="button" data-equipment-nav="items">Vật phẩm</button></details>`;
  }
  root.ArtemisRuneWorkspace = Object.freeze({ create, combatNote, navigationMarkup });
})(globalThis);
