/* Original illustrated navigation skin. Existing buttons and game routing remain authoritative. */
(function () {
  'use strict';
  const tabs = [
    { id: 'tabShopVn', label: 'Cửa Hàng', icon: 'shop' },
    { id: 'tabEquip', label: 'Trang bị', icon: 'armor' },
    { id: 'tabBattle', label: 'Chiến Dịch', icon: 'battle' },
    { id: 'nativeArtifacts', label: 'Vật Sưu Tầm', icon: 'trophy' },
    { id: 'tabEvents', label: 'Sự kiện', icon: 'events' },
  ];
  // Every shape is drawn for Artemis; no remote assets, fonts, or emoji are required.
  const drawings = {
    shop: `<path fill="#673d30" d="M15 52h66v32H15z"/><path fill="#e4ad59" d="M20 46h56v31H20z"/><path fill="#fff0bb" d="M22 48h52v6H22z"/><path fill="#4a8bac" d="M37 57h30v18H37z"/><path fill="#78c8dc" d="M41 59h23v5H41z"/><path fill="#ffe0a1" d="M22 55h10v20H22z"/><path fill="#b2793f" d="M12 76h72v8H12z"/><path fill="#f9cb76" d="M16 75h64v5H16z"/><path fill="#95603c" d="M19 28h5v34h-5zM72 28h5v34h-5z"/><path fill="#f7e9ce" d="M20 22h56l10 23H10z"/><path fill="#e14b47" d="m20 22-10 23h16l5-23zm22 0-2 23h16l-2-23zm23 0 5 23h16L76 22z"/><path fill="#ff7365" d="m20 22 56 0-3-5H23z"/><path fill="#ca3e39" d="M10 44h16v5q-8 9-16 0zm30 0h16v5q-8 9-16 0zm30 0h16v5q-8 9-16 0z"/><path fill="#fff6df" d="M26 44h14v5q-7 9-14 0zm30 0h14v5q-7 9-14 0z"/><path fill="#ffdda0" d="M12 84h72v4H12z"/>`,
    armor: `<path fill="#172842" d="m29 15 12 5h14l12-5 19 16-10 20-7-4 4 32-25 10-25-10 4-32-7 4L10 31z"/><path fill="#7898b6" d="m30 17 11 8h14l11-8 17 15-8 14-10-8 5 39-22 8-22-8 5-39-10 8-8-14z"/><path fill="#cbdbe2" d="m30 17 10 9-6 14-13 6-8-14zm36 0L56 26l6 14 13 6 8-14z"/><path fill="#b2cbd8" d="m34 39 14 5 14-5 6 35-20 8-20-8z"/><path fill="#e5eef0" d="m34 39 14 5v35l-17-8z"/><path fill="#6e8ca9" d="m48 44 14-5 6 35-20 8z"/><path fill="#30465e" d="m35 18 6 8h14l6-8-6 16H41z"/><path fill="#e8b44f" d="m25 73 23 9 23-9 1 8-24 10-24-10z"/><path fill="#fff0b0" d="m25 73 23 8 23-8v4l-23 9-23-9z"/>`,
    battle: `<path fill="#d9922b" d="m48 29 22 9-4 28-18 17-18-17-4-28z"/><path fill="#ffda59" d="m48 34 17 7-4 23-13 12-13-12-4-23z"/><path fill="#f8f4dc" d="m12 10 17 4 42 48-9 9-44-44z"/><path fill="#8ca6ba" d="m12 10 50 61 9-9-42-48z"/><path fill="#fff" d="m12 10 17 4 37 43-7-2-41-38z"/><path fill="#f7c857" d="m55 69 14-14 7 5-16 17z"/><path fill="#966147" d="m64 77 8-8 12 12-8 8z"/><path fill="#ffd565" d="m76 88 8-8 5 5-8 8z"/><path fill="#e2edf1" d="m84 10-17 4-42 48 9 9 44-44z"/><path fill="#fff" d="M84 10 34 71l-9-9 42-48z"/><path fill="#8ca6ba" d="m84 10-6 17-44 44-4-5z"/><path fill="#ffdb68" d="m41 69-14-14-7 5 16 17z"/><path fill="#966147" d="m32 77-8-8-12 12 8 8z"/><path fill="#ffd565" d="m20 88-8-8-5 5 8 8z"/>`,
    trophy: `<path fill="none" stroke="#bd7828" stroke-width="9" d="M29 28H13v13q0 19 23 18m31-31h16v13q0 19-23 18"/><path fill="none" stroke="#ffdc65" stroke-width="5" d="M29 27H13v13q0 16 23 16m31-29h16v13q0 16-23 16"/><path fill="#986ac8" d="m25 21 46 0-5 29q-3 15-18 18-15-3-18-18z"/><path fill="#c393e4" d="m25 21 23 0v47q-15-3-18-18z"/><path fill="#e5a937" d="M21 16h54v11H21zm21 47h12v15H42zM28 78h40v10H28z"/><path fill="#ffe28a" d="M21 16h54v5H21zM32 74h32v8H32z"/><path fill="#ddb746" d="m48 29 14 15-14 17-14-17z"/><path fill="#42d57e" d="m48 32 10 12-10 13-10-13z"/><path fill="#c1ffd5" d="m48 32 0 12H38z"/><path fill="#158e63" d="m48 44 10 0-10 13z"/>`,
    events: `<path fill="#603c32" d="m17 36 58-13 13 45-59 18z"/><path fill="#e7ba79" d="m14 30 59-13 15 46-59 17z"/><path fill="#f8d99b" d="m20 35 49-11 11 34-48 13z"/><path fill="#b17649" d="m29 72 59-17v10L29 84z"/><path fill="#9f343b" d="m31 45 11-3 8 23-12 4z"/><path fill="#ec4f53" d="M31 44V27q0-9 8-9t8 9v15q-6 8-16 2z"/><path fill="#ff8980" d="M34 26q0-5 4-5v20l-4-1z"/><path fill="#b1273b" d="M31 41q8 5 16-1v8q-8 6-16 0z"/><path fill="#315597" d="m56 42 10-3 8 21-12 4z"/><path fill="#4daae6" d="M53 38V23q0-9 8-9t8 9v15q-8 7-16 0z"/><path fill="#a5e6ff" d="M56 22q0-5 4-5v19l-4-1z"/><path fill="#2761ab" d="M53 35q8 5 16-1v8q-8 6-16 0z"/><path fill="#faefbf" d="m27 59 10-3 2 6-10 3zm43-10 6-2 2 6-6 2z"/>`,
  };

  function artwork(icon) {
    return `<svg class="native-nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><g stroke="#263047" stroke-width="2" stroke-linejoin="round" paint-order="stroke fill">${drawings[icon]}</g></svg>`;
  }

  let controller;
  function init() {
    if (controller) return controller;
    const nav = document.getElementById('bottomNavBar');
    const grid = nav && nav.querySelector('.grid');
    if (!grid) return null;
    const originalButtons = Array.from(grid.querySelectorAll('.nav-tab-btn'));
    const equipButton = originalButtons.find(button => button.getAttribute('data-tab') === 'tabEquip');
    const guildButton = originalButtons.find(button => button.getAttribute('data-tab') === 'tabGuild');
    const artifacts = document.getElementById('subpanelArtifacts');
    const artifactTab = document.querySelector('#tabEquip > .gear-subnav [data-gear-subtab="artifacts"]');
    const gearTab = document.querySelector('#tabEquip > .gear-subnav [data-gear-subtab="gear"]');
    if (!equipButton || !guildButton || !artifacts || !artifactTab || !gearTab) return null;
    const shortcut = document.createElement('button');
    shortcut.type = 'button';
    // Deliberately NOT .nav-tab-btn or data-tab: the app router must never
    // discover this button as a second equipment destination.
    const entries = tabs.map(tab => ({ ...tab, button: tab.id === 'nativeArtifacts' ? shortcut : originalButtons.find(button => button.getAttribute('data-tab') === tab.id) }));
    if (entries.some(entry => !entry.button)) return null;
    // gotoNavTab searches inside .grid. Retain this original, bound button there
    // as a hidden non-layout item; moving it outside would break Guild routing.
    guildButton.hidden = true;
    guildButton.setAttribute('data-native-legacy', 'true');
    guildButton.setAttribute('tabindex', '-1');
    nav.setAttribute('data-native-navigation', 'true');
    grid.setAttribute('data-native-nav-grid', 'true');
    for (const entry of entries) {
      const button = entry.button;
      button.setAttribute('data-native-item', entry.id);
      button.setAttribute('aria-label', entry.label);
      button.innerHTML = `${artwork(entry.icon)}<span class="native-nav-label">${entry.label}</span>${entry.id === 'tabEvents' ? '<span class="native-nav-alert" aria-hidden="true">!</span>' : ''}`;
      // Move, rather than clone: game listeners, data-tab, and keyboard activation survive.
      grid.appendChild(button);
    }
    const visible = element => !!element && !element.classList.contains('hidden');
    function sync() {
      const collecting = visible(document.getElementById('tabEquip')) && visible(artifacts);
      for (const entry of entries) {
        const active = entry.id === 'nativeArtifacts' ? collecting
          : visible(document.getElementById(entry.id)) && (entry.id !== 'tabEquip' || !collecting);
        entry.button.setAttribute('data-native-active', String(active));
        entry.button.setAttribute('aria-current', active ? 'page' : 'false');
      }
    }
    // The original router replaces this button's className only on accepted
    // navigation. Mutation records distinguish a rejected Game.running click
    // even when tabEquip was already visible. Game itself is closure-private.
    const observer = new MutationObserver(sync);
    observer.observe(equipButton, { attributes: true, attributeFilter: ['class'] });
    let openingCollection = false;
    let equipmentAccepted = false;
    equipButton.addEventListener('click', () => {
      observer.takeRecords();
      equipmentAccepted = false;
    }, true);
    equipButton.addEventListener('click', () => {
      equipmentAccepted = observer.takeRecords().some(record => record.target === equipButton);
      if (equipmentAccepted && !openingCollection) gearTab.click();
      sync();
    });
    shortcut.addEventListener('click', () => {
      openingCollection = true;
      try {
        equipButton.click();
        if (equipmentAccepted) artifactTab.click();
      } finally {
        openingCollection = false;
        sync();
      }
    });
    const afterClick = () => queueMicrotask(sync);
    for (const entry of entries) entry.button.addEventListener('click', afterClick);
    guildButton.addEventListener('click', afterClick);
    // Read real section/subpanel visibility, including programmatic changes.
    // All skin hooks survive the app's wholesale className replacements.
    for (const id of ['tabShopVn', 'tabEquip', 'tabBattle', 'tabGuild', 'tabEvents', 'tabTalents', 'subpanelArtifacts']) {
      const section = document.getElementById(id);
      if (section) observer.observe(section, { attributes: true, attributeFilter: ['class'] });
    }
    controller = { sync };
    sync();
    return controller;
  }
  window.ArtemisNativeNavigation = { init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
