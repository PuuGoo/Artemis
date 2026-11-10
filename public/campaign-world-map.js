/* Presentation adapter: the original hidden picker remains the only selection writer. */
(function () {
  'use strict';
  if (window.ArtemisWorldMap) { window.ArtemisWorldMap.init(); return; }
  const doc = document;
  let chapters, observer, queued = false, panel, root, viewport, returnButton;
  let savedScroll = null, pendingCenter = false, lastFocused = null;
  const api = () => window.Archero2FusionAPI;

  function getChapters() {
    if (api()?.getCampaignChapters) return api().getCampaignChapters().map((chapter, index) => ({ ...chapter, index }));
    if (chapters?.length) return chapters;
    // CHAPTERS is closure-private, not exported by Archero2FusionAPI. Read its literal
    // metadata without eval; all eligibility and selection still come from live game APIs.
    const script = Array.from(doc.scripts).find(s => s.textContent.includes('const CHAPTERS = ['));
    const text = script?.textContent || '';
    const start = text.indexOf('const CHAPTERS = [');
    const end = text.indexOf('const CampaignConfig', start);
    const blocks = text.slice(start, end < 0 ? undefined : end).split(/\{\s*id:\s*(\d+),/).slice(1);
    chapters = [];
    for (let i = 0; i < blocks.length; i += 2) {
      const id = Number(blocks[i]), block = blocks[i + 1];
      const field = name => block.match(new RegExp('\\b' + name + ":\\s*'([^']*)'"))?.[1] || '';
      const unlock = block.match(/unlock:\s*\{\s*type:\s*'([^']+)'\s*,\s*chapterId:\s*(\d+)\s*,\s*label:\s*'([^']+)'/);
      chapters.push({ id, index: chapters.length, themeName: field('themeName'), name: field('name'),
        accent: field('accent'), mapAsset: field('mapAsset'),
        unlock: unlock ? {type:unlock[1], chapterId:Number(unlock[2]), label:unlock[3]} : null });
    }
    return chapters;
  }

  function requirements(chapter) {
    if (!chapter.unlock) return [];
    return [chapter.unlock.label, chapter.unlock.type === 'chapterWin'
      ? `Hạ trùm cuối Chương ${chapter.unlock.chapterId}` : 'Hoàn thành điều kiện mở khóa'];
  }
  function element(tag, className, text) {
    const node = doc.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function sourceButton(index) { return panel?.querySelector(`[data-map-tab="${index}"]`); }
  function selectedId() { return getChapters()[api()?.SaveState?.selectedChapterIdx || 0]?.id; }
  function centerCurrent() {
    if (!viewport) return;
    const target = viewport.querySelector(`[data-world-chapter="${selectedId()}"]`);
    if (!target || !viewport.clientHeight) { pendingCenter = true; return; }
    viewport.scrollTop = Math.max(0, target.offsetTop + target.offsetHeight / 2 - viewport.clientHeight / 2);
    savedScroll = viewport.scrollTop;
    pendingCenter = false;
    updateRegion();
  }
  function updateRegion() {
    if (!viewport || !root) return;
    const middle = viewport.scrollTop + viewport.clientHeight / 2;
    const nodes = Array.from(viewport.querySelectorAll('[data-world-chapter]'));
    const nearest = nodes.reduce((best, n) => !best || Math.abs(n.offsetTop + n.offsetHeight / 2 - middle) < Math.abs(best.offsetTop + best.offsetHeight / 2 - middle) ? n : best, null);
    root.classList.toggle('is-locked-region', !!nearest?.classList.contains('is-locked'));
    const current = viewport.querySelector(`[data-world-chapter="${selectedId()}"]`);
    if (returnButton && current) {
      const above = current.offsetTop < viewport.scrollTop;
      returnButton.dataset.direction = above ? 'up' : 'down';
      const exploring = Math.abs(current.offsetTop + current.offsetHeight / 2 - middle) >= 140 || !!panel.querySelector('#btnBattleReturnChapter');
      returnButton.classList.toggle('is-near-current', !exploring);
      doc.getElementById('tabBattle')?.classList.toggle('world-map-exploring', exploring);
    }
  }
  function activate(id) {
    const chapter = getChapters().find(ch => ch.id === id);
    const original = chapter && sourceButton(chapter.index);
    if (!original) return;
    lastFocused = id;
    savedScroll = viewport.scrollTop;
    original.click(); // Locked preview and CTA disable are owned by renderMapSelect.
    refresh();
    viewport?.querySelector(`[data-world-chapter="${id}"]`)?.focus({preventScroll:true});
  }
  function returnCurrent() {
    panel?.querySelector('#btnBattleReturnChapter')?.click();
    refresh(); centerCurrent();
    viewport?.querySelector(`[data-world-chapter="${selectedId()}"]`)?.focus({preventScroll:true});
  }
  function bindScroll() {
    let drag = null, suppressUntil = 0;
    viewport.addEventListener('scroll', () => { savedScroll = viewport.scrollTop; updateRegion(); }, {passive:true});
    viewport.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      suppressUntil = 0;
      drag = {id:e.pointerId, x:e.clientX, y:e.clientY, top:viewport.scrollTop, moved:false};
    });
    viewport.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!(e.buttons & 1)) { drag = null; viewport.classList.remove('is-dragging'); return; }
      if (!drag.moved && Math.hypot(e.clientX-drag.x,e.clientY-drag.y) > 7) {
        drag.moved = true; viewport.setPointerCapture(e.pointerId); viewport.classList.add('is-dragging');
      }
      if (drag.moved) { e.preventDefault(); viewport.scrollTop = drag.top - (e.clientY-drag.y); }
    });
    function finish(e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) suppressUntil = performance.now() + 450;
      if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
      drag = null; viewport.classList.remove('is-dragging');
    }
    viewport.addEventListener('pointerup', finish);
    viewport.addEventListener('pointercancel', finish);
    viewport.addEventListener('lostpointercapture', () => { drag = null; viewport.classList.remove('is-dragging'); });
    viewport.addEventListener('click', e => {
      if (performance.now() < suppressUntil && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); return; }
      const button = e.target.closest('[data-world-chapter]');
      if (button) activate(Number(button.dataset.worldChapter));
    });
    viewport.addEventListener('keydown', e => {
      const nodes = Array.from(viewport.querySelectorAll('[data-world-chapter]'));
      const index = nodes.indexOf(e.target.closest('[data-world-chapter]'));
      if (index < 0) return;
      let next;
      if (e.key === 'ArrowDown') next = Math.min(nodes.length-1,index+1);
      if (e.key === 'ArrowUp') next = Math.max(0,index-1);
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = nodes.length-1;
      if (next !== undefined) { e.preventDefault(); nodes[next].focus({preventScroll:true}); viewport.scrollTop = nodes[next].offsetTop + nodes[next].offsetHeight/2 - viewport.clientHeight/2; }
      if (e.key === 'Escape') { e.preventDefault(); returnCurrent(); }
    });
  }
  function makeNode(chapter) {
    const original = sourceButton(chapter.index);
    const locked = original?.dataset.locked === '1';
    const won = !!api()?.isChapterWon?.(chapter.id);
    const active = original?.getAttribute('aria-current') === 'true';
    const button = element('button', `world-map-chapter${locked?' is-locked':''}${active?' is-active':''}${won?' is-completed':''}`);
    button.type = 'button'; button.dataset.worldChapter = chapter.id;
    button.style.setProperty('--chapter-accent',chapter.accent || '#7cddfa');
    button.setAttribute('aria-label', `Chương ${chapter.id}: ${chapter.themeName}${locked?' — Xem trước, chưa mở. '+requirements(chapter).join('. '):won?' — Đã hoàn thành':' — Chưa hoàn thành'}`);
    button.setAttribute('aria-pressed',String(active));
    if (chapter.id === selectedId()) button.setAttribute('aria-current','step');
    const title = element('span','world-map-title');
    title.append(element('span','world-map-shield',String(chapter.id)),element('span','world-map-name',chapter.themeName));
    const art = element('span','world-map-island');
    const image = element('img','world-map-art');
    const asset = window.ArtemisWorldMapArt?.get(chapter);
    image.src = typeof asset === 'string' ? asset : asset?.src || '/assets/native-campaign-island.svg';
    image.alt = ''; image.draggable = false;
    image.addEventListener('error', () => { if (!image.src.endsWith('/assets/native-campaign-island.svg')) image.src = '/assets/native-campaign-island.svg'; },{once:true});
    art.append(image);
    if (locked) {
      const lock = element('span','world-map-lock'); lock.setAttribute('aria-hidden','true');
      art.append(lock);
      const lines = element('span','world-map-requirements');
      requirements(chapter).forEach((line,i) => lines.append(element('span',i?'world-map-requirement-detail':'world-map-requirement',line)));
      art.append(lines);
    }
    button.append(title,art);
    if (won) {
      // The game records clear/no-clear, not a graded three-star score.
      const stars = element('span','world-map-stars','★ ★ ★');
      stars.setAttribute('aria-hidden','true'); button.append(stars);
    }
    return button;
  }
  function render() {
    const nextPanel = doc.getElementById('mapSelectPanel');
    const screen = doc.getElementById('tabBattle');
    if (!nextPanel || !screen || !api()) return;
    panel = nextPanel;
    const campaign = api().getActiveGameMode?.().hasChapters !== false && !!panel.querySelector('[data-map-tab]');
    screen.classList.toggle('has-world-map',campaign);
    if (!campaign) { root?.remove(); root = viewport = returnButton = null; return; }
    if (!root?.isConnected || root.parentNode !== panel) {
      root = element('div','campaign-world-map');
      viewport = element('div','world-map-scroll'); viewport.dataset.worldMapScroll = '';
      viewport.setAttribute('role','region'); viewport.setAttribute('aria-label','Bản đồ các chương Chiến Dịch. Cuộn để khám phá.'); viewport.tabIndex = 0;
      returnButton = element('button','world-map-return','Nhấn Về Chương hiện tại');
      returnButton.type = 'button'; returnButton.dataset.worldMapReturn = '';
      returnButton.addEventListener('click',returnCurrent);
      root.append(viewport,returnButton); panel.append(root); bindScroll();
    }
    const focused = viewport.contains(doc.activeElement) ? doc.activeElement?.dataset.worldChapter : null;
    const fragment = doc.createDocumentFragment();
    getChapters().slice().sort((a,b)=>b.id-a.id).forEach(ch => fragment.append(makeNode(ch)));
    viewport.replaceChildren(fragment);
    if (savedScroll === null || pendingCenter) centerCurrent();
    else viewport.scrollTop = savedScroll;
    if (focused) viewport.querySelector(`[data-world-chapter="${focused}"]`)?.focus({preventScroll:true});
    updateRegion();
  }
  function observe() {
    const screen = doc.getElementById('tabBattle');
    if (screen) observer.observe(screen,{childList:true,subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
  }
  function refresh() {
    observer?.disconnect();
    try { render(); } finally { if (observer) observe(); }
  }
  function schedule() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; refresh(); });
  }
  function init() {
    if (!observer) {
      observer = new MutationObserver(records => {
        // Native artwork decorator writes inside the hidden stage. Ignore it and
        // our own scrolling/focus classes; only actual renderer replacements count.
        if (records.some(r => (r.type === 'childList' && (r.target.id === 'mapSelectPanel' || r.target.id === 'tabBattle' || Array.from(r.addedNodes).some(n=>n.id==='mapSelectPanel'))) || (r.type==='attributes' && r.target.id==='tabBattle' && (r.oldValue || '').split(/\s+/).includes('hidden') !== r.target.classList.contains('hidden')))) schedule();
      });
      window.addEventListener('resize', () => { if (pendingCenter) centerCurrent(); updateRegion(); }, {passive:true});
    }
    refresh();
  }
  window.ArtemisWorldMap = Object.freeze({init,refresh,getChapters,requirements,returnToCurrent:returnCurrent});
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
