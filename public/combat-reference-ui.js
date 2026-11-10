/* Presentation-only adapter. Existing skill buttons and claim/reroll handlers stay authoritative.
 * Install inside the app closure:
 * ArtemisCombatReferenceUI.install({frame:document.getElementById('app'),
 *   getState:()=>({offer:Game.runProgression?.pendingOffer, skills:Game.player?.skills,
 *     catalog:ROGUE_SKILLS, busy:Game.skillClaimBusy, campaign:usesCampaignTuning()})});
 * Call sync() after populateSkillChoices and busy transitions. Never truncate pendingOffer.skillIds.
 * Wrap actual readiness with await withLoading(()=>startNewRun(...), {frame});
 */
(function (root) {
  'use strict';
  const doc = root.document;
  let options = {}, observer, modal, learned, learnedButton, count, banner, instruction, loading, restoreFocus;
  const pending = new Set();
  let serial = 0, preloadPromise;
  function remaining(offer) {
    if (!offer || !Number.isFinite(offer.rerollLimit) || !Number.isFinite(offer.rerollsUsed)) return null;
    return Math.max(0, offer.rerollLimit - offer.rerollsUsed);
  }
  function learnedEntries(skills, catalog) {
    return Object.entries(skills || {}).filter(([, n]) => Number(n) > 0).map(([id, level]) => {
      const item = (catalog || []).find(s => s.id === id);
      return { id, level: Number(level), name: item?.name || id, desc: item?.desc || '' };
    });
  }
  function node(tag, className, text) {
    const el = doc.createElement(tag); el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function frameFor(frame) { return frame || options.frame || modal?.parentElement || doc?.getElementById('app'); }
  function sync(state) {
    if (!doc) return;
    if (!modal) install();
    if (!modal) return;
    state = state || options.getState?.() || {};
    const offer = state.offer;
    const entry = offer?.stageId === 'start';
    banner.textContent = entry ? 'Năng Lực: Vinh Quang' : offer?.provider === 'angel' ? 'Thiên Thần Hộ Mệnh' : 'Bạn đã gặp Valkyrie';
    instruction.textContent = entry ? 'Vui lòng chọn một khả năng mới!' : 'Hãy chọn 1 Chúc Phúc của Valkyrie';
    modal.dataset.referenceOffer = entry ? 'entry' : 'valkyrie';
    const cards = modal.querySelectorAll('.skill-choice-card');
    modal.dataset.referenceCount = String(cards.length);
    cards.forEach(card => {
      const skill = (state.catalog || []).find(s => s.id === card.dataset.skillId);
      if (skill) card.dataset.referenceRarity = skill.rarity || 'common';
    });
    const left = remaining(offer);
    count.textContent = left === null ? '' : 'Số lần làm mới kỹ năng còn: ' + left;
    count.hidden = left === null;
    const reroll = doc.getElementById('btnRerollSkills');
    // Do not change original disabled state or cost outside the campaign rules.
    if (reroll && state.campaign === true) {
      if (reroll.textContent !== 'Làm mới') reroll.textContent = 'Làm mới';
      reroll.setAttribute('aria-disabled', String(left === 0 || !!state.busy));
      if (left !== null) reroll.disabled = left === 0 || !!state.busy;
    }
    if (modal.classList.contains('hidden')) { learned.hidden = true; learnedButton.setAttribute('aria-expanded', 'false'); }
    if (!learned.hidden) renderLearned(state);
  }
  function renderLearned(state) {
    const entries = learnedEntries(state.skills, state.catalog);
    learned.replaceChildren(node('h4', '', 'Năng lực đã học'));
    if (!entries.length) learned.append(node('p', '', 'Chưa học năng lực nào.'));
    entries.forEach(item => {
      const row = node('div', 'acr-learned-row');
      row.append(node('strong', '', item.name + ' · Bậc ' + item.level), node('p', '', item.desc)); learned.append(row);
    });
    const close = node('button', 'acr-learned-close', 'Đóng'); close.type = 'button';
    close.addEventListener('click', closeLearned); learned.append(close);
  }
  function closeLearned() { learned.hidden = true; learnedButton.setAttribute('aria-expanded', 'false'); restoreFocus?.focus(); }
  function install(config) {
    options = Object.assign(options, config || {});
    if (!doc) return api;
    const target = doc.getElementById('skillSelectModal');
    if (!target || target === modal) return api;
    observer?.disconnect(); modal = target; modal.classList.add('acr-skill-modal');
    const panel = modal.firstElementChild;
    banner = node('h3', 'acr-ribbon'); instruction = node('p', 'acr-instruction');
    panel.prepend(banner, instruction);
    learnedButton = node('button', 'acr-learned-button', '▤ Năng lực đã học'); learnedButton.type = 'button';
    learnedButton.setAttribute('aria-expanded', 'false'); learnedButton.setAttribute('aria-controls', 'acrLearned');
    learned = node('section', 'acr-learned'); learned.id = 'acrLearned'; learned.hidden = true;
    learned.setAttribute('role', 'region'); learned.setAttribute('aria-label', 'Năng lực đã học');
    learnedButton.addEventListener('click', () => {
      if (!learned.hidden) return closeLearned();
      restoreFocus = doc.activeElement; renderLearned(options.getState?.() || {});
      learned.hidden = false; learnedButton.setAttribute('aria-expanded', 'true'); learned.querySelector('button')?.focus();
    });
    learned.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeLearned(); } });
    count = node('p', 'acr-reroll-count'); count.setAttribute('aria-live', 'polite');
    const choices = doc.getElementById('skillChoicesContainer'); choices.after(learnedButton, learned);
    panel.append(count);
    if (typeof root.MutationObserver === 'function') {
      observer = new root.MutationObserver(() => sync());
      // Only observe authoritative content/visibility, not our presentation updates.
      observer.observe(choices, { childList: true }); observer.observe(modal, {attributes:true, attributeFilter:['class']});
    }
    sync(); return api;
  }
  function preload() {
    if (preloadPromise) return preloadPromise;
    if (typeof root.Image !== 'function') return Promise.resolve();
    preloadPromise = new Promise((resolve, reject) => {
      const image = new root.Image(); image.onload = () => resolve(image);
      image.onerror = () => { preloadPromise = null; reject(new Error('Không tải được hình chuyển cảnh.')); };
      image.src = '/assets/combat-loading-vampire.svg';
    });
    return preloadPromise;
  }
  function beginLoading(config) {
    const token = ++serial; pending.add(token);
    if (doc && !loading) {
      const frame = frameFor(config?.frame);
      if (!frame) { pending.delete(token); throw new Error('Combat loading requires the portrait app frame.'); }
      loading = node('div', 'acr-loading'); loading.id = 'combatReferenceLoading';
      loading.setAttribute('role','status'); loading.setAttribute('aria-label','Đang chuẩn bị trận đấu');
      const img = node('img', 'acr-loading-mascot'); img.src = '/assets/combat-loading-vampire.svg'; img.alt = '';
      loading.append(img); frame.append(loading);
      loading._frame = frame; loading._previousBusy = frame.getAttribute('aria-busy'); frame.setAttribute('aria-busy','true');
    }
    return token;
  }
  function endLoading(token) {
    if (!pending.delete(token) || pending.size) return;
    if (loading) {
      const frame = loading._frame;
      if (loading._previousBusy === null) frame.removeAttribute('aria-busy'); else frame.setAttribute('aria-busy', loading._previousBusy);
      loading.remove(); loading = null;
    }
  }
  async function withLoading(work, config) {
    const token = beginLoading(config);
    try {
      // Work starts immediately. Wait for actual readiness, never fabricated progress.
      const [result] = await Promise.all([Promise.resolve().then(work), preload().catch(() => null)]);
      return result;
    } finally { endLoading(token); }
  }
  const api = { install, sync, beginLoading, endLoading, withLoading, preload, remaining, learnedEntries };
  root.ArtemisCombatReferenceUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
