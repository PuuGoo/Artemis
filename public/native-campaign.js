/* Campaign presentation only. Existing renderer, chapter selection and launch own all state. */
(function () {
  'use strict';
  const doc = document;
  function button(label, icon, action, className = '') {
    const node = doc.createElement('button');
    node.type = 'button'; node.className = `native-campaign-shortcut ${className}`;
    node.setAttribute('aria-label', label);
    const image = doc.createElement('img');
    image.src = `/assets/native-campaign-icons.svg#${icon}`;
    image.alt = ''; image.setAttribute('aria-hidden', 'true');
    const text = doc.createElement('span'); text.textContent = label;
    node.append(image, text); node.addEventListener('click', action);
    return node;
  }
  function click(selector) { doc.querySelector(selector)?.click(); }
  function nav(tab) {
    if (typeof window.gotoNavTab === 'function') window.gotoNavTab(tab);
    else click(`#bottomNavBar [data-tab="${tab}"]`);
  }
  function init() {
    const screen = doc.getElementById('tabBattle');
    const map = doc.getElementById('mapSelectPanel');
    if (!screen || !map || screen.dataset.nativeCampaign) return;
    screen.dataset.nativeCampaign = 'true';
    const left = doc.createElement('div'); left.className = 'native-campaign-rail native-campaign-left';
    left.setAttribute('aria-label', 'Lối tắt sự kiện');
    left.append(
      button('Sự kiện', 'events', () => click('#btnTopOpenEventsHub')),
      button('Thẻ Đặc Quyền', 'cards', () => { nav('tabEvents'); doc.getElementById('vipPrivilegeCardsContainer')?.scrollIntoView({block:'start'}); }),
      button('Cửa hàng', 'chest', () => nav('tabShopVn'))
    );
    const right = doc.createElement('div'); right.className = 'native-campaign-rail native-campaign-right';
    right.setAttribute('aria-label', 'Lối tắt hành trình');
    right.append(
      button('Nhiệm vụ', 'quest', () => click('.nav-tab-btn[data-tab="tabTalents"]')),
      button('Thành viên', 'friends', () => { nav('tabGuild'); click('[data-guild-screen="members"]'); }),
      button('Sổ tay quái', 'map', () => click('#msBtnBestiary')),
      button('Thảo phạt Bộ Lạc', 'swords', () => { nav('tabGuild'); click('[data-guild-screen="boss"]'); })
    );
    const banner = button('Khám phá sự kiện', 'events', () => click('#btnTopOpenEventsHub'), 'native-campaign-banner');
    const lower = doc.createElement('div'); lower.className = 'native-campaign-lower';
    lower.append(
      button('Trang bị', 'armor', () => nav('tabEquip')),
      button('Kho vật phẩm', 'chest', () => click('#btnTopOpenItemsVault')),
      button('Bộ Lạc', 'shield', () => nav('tabGuild'))
    );
    const rank = button('Bảng Xếp Hạng', 'trophy', () => { nav('tabGuild'); click('[data-guild-screen="rank"]'); }, 'native-campaign-rank');
    const help = button('Hướng dẫn', 'menu', () => click('#btnOpenGuide'), 'native-campaign-menu');
    const chat = doc.createElement('div'); chat.className = 'native-campaign-chat';
    chat.setAttribute('aria-label', 'Trò chuyện');
    // No multiplayer chat service exists in this build. Never synthesize players/messages.
    chat.innerHTML = '<span aria-hidden="true">▰</span><b>Thế giới</b><span>Trò chuyện chưa khả dụng</span>';
    screen.append(left, right, banner, lower, rank, help, chat);
    const modes = doc.getElementById('gameModePanel');
    if (modes) {
      const chooser = doc.createElement('details'); chooser.className = 'native-campaign-modes';
      const summary = doc.createElement('summary'); summary.textContent = '⚔ Chế độ';
      chooser.append(summary, modes); screen.append(chooser);
    }

    function decorate() {
      const art = map.querySelector('.ms-art');
      screen.classList.toggle('native-campaign-has-map', Boolean(art));
      if (!art || art.querySelector('.native-campaign-island')) return;
      const island = doc.createElement('img');
      island.className = 'native-campaign-island';
      island.src = '/assets/native-campaign-island.svg';
      island.alt = ''; island.setAttribute('aria-hidden', 'true');
      art.append(island);
      const kicker = art.querySelector('.ms-kicker');
      const badge = doc.createElement('span'); badge.className = 'native-campaign-chapter';
      badge.textContent = (kicker?.textContent || '').match(/\d+/)?.[0] || '';
      badge.setAttribute('aria-hidden', 'true'); art.querySelector('.ms-topbar')?.prepend(badge);
      const status = doc.createElement('div'); status.className = 'native-campaign-status';
      const cleared = /ĐÃ PHÁ ĐẢO/.test(kicker?.textContent || '');
      const locked = art.classList.contains('is-locked');
      status.textContent = locked ? 'Chưa mở khóa' : cleared ? 'Đã vượt ải' : (map.querySelector('.ms-prog-main')?.textContent || 'Sẵn sàng khám phá');
      art.append(status);
      if (cleared) {
        const stars = doc.createElement('div'); stars.className = 'native-campaign-stars';
        stars.textContent = '★ ★ ★'; stars.setAttribute('aria-label', 'Đã hoàn thành chương');
        art.append(stars);
      }
    }
    // Observe renderer replacement only, disconnect around our own writes: no feedback loop.
    const observer = new MutationObserver(() => {
      observer.disconnect(); decorate(); observer.observe(map, {childList:true, subtree:true});
    });
    decorate(); observer.observe(map, {childList:true, subtree:true});
    window.ArtemisNativeCampaign = Object.freeze({ refresh: decorate });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
