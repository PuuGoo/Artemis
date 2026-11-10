/* Tiến trình kỹ năng thuần, classic-script global ArtemisCampaignSkills.
 * API:
 * normalizeState(raw, catalog) -> state mới (không sửa đầu vào).
 * skillCap(skill) -> integer 0..10; maxStack của catalogue có thể giảm cap.
 * rarityWeights(segment=0, seraph=false) -> trọng số chưa chuẩn hóa.
 * drawSlot(catalog, {segment,provider,skills,exclude,minRarity,seraph}, seed)
 *   -> {skillId,rarity,seed}; helper lấy mẫu, KHÔNG phải đường cấp kỹ năng.
 * generateOffer(state,catalog,{stageId,segment=0,provider='valkyrie',
 *   starterPriority:ids,seraph=false,heroRerolls=0}) -> {ok,reason,state,offer}.
 * rerollOffer(state,catalog), claimOffer(state,catalog,skillId) -> cùng result;
 * claim thành công thêm skillId. Luôn thay state bằng result.state và lưu checkpoint.
 * stageId là string ổn định hoặc integer; caller giữ cùng kiểu khi resume.
 *
 * Quy ước: segment 0..4 do campaign cung cấp, không suy đoán từ chapter/room.
 * Rarity lấy theo slot, rồi chọn đều id hợp lệ; bỏ rarity rỗng và chuẩn hóa lại.
 * Pool <3 trả số thẻ còn hợp lệ, tuyệt đối không tràn sang provider khác.
 * Sau 4 offer Valkyrie liên tiếp thiếu epic/legend, offer kế bảo đảm epic trở lên.
 * stageId='start' không tính encounter; reroll giữ pity, high offer reset pityCounter.
 * Starter đầu tiên hợp lệ xuất hiện ở ô đầu của offer đầu, không tự cấp.
 * Seraph tăng trọng số epic/legend 10% trên Valkyrie, không bảo đảm rarity.
 * Mỗi offer được reroll 1 lần; heroRerolls được clamp 0..1 (+1 tối đa).
 * Reroll có thể trùng offer cũ, nhưng 3 id trong từng offer luôn khác nhau.
 * Tổng claim mọi provider <=10, không đặt thêm cap tổng legend ngoài ngân sách này.
 * Lower caps dựa resolver hiện tại; không giả định kỹ năng phụ thuộc/mutex mới.
 * Effects chiến đấu chỉ chạy sau claimOffer(...).ok, không gọi drawSlot để cấp thẳng.
 * State client không phải chữ ký chống chỉnh save; server vẫn cần kiểm quyền.
 */
(function (root) {
  'use strict';
  const MAX_RUN_SKILL_LEVEL = 10;
  const MAX_SKILL_STACK = 10;
  // Cap theo resolver thật: multishot tối đa +2; shield tối đa 4; cờ bật/tắt chỉ 1.
  const LOWER_CAPS = Object.freeze({multishot:2, sacred_protection:4, tracking_eye:1,
    pierce:1, wall_piercing_arrow:1, weapon_enchantment:1, energy_beam:1,
    revive:1, sprite_king:1, laser_sprite:1, bomb_sprite:1, circle_web:1, water_walker:1});
  const integer = (value, max, fallback = 0) => typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(0, Math.floor(value))) : fallback;
  const safeId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id)
    && !['__proto__', 'constructor', 'prototype'].includes(id);
  function registry(catalog) {
    const map = new Map();
    for (const skill of Array.isArray(catalog) ? catalog : []) {
      if (skill && safeId(skill.id) && !map.has(skill.id)) map.set(skill.id, skill);
    }
    return map;
  }
  function skillCap(skill) {
    if (!skill) return 0;
    return Math.min(LOWER_CAPS[skill.id] || MAX_SKILL_STACK,
      integer(skill.maxStack, MAX_SKILL_STACK, MAX_SKILL_STACK));
  }
  function normalizeState(raw, catalog) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const map = registry(catalog), skills = {};
    let total = 0;
    for (const [id, skill] of map) {
      const n = Math.min(MAX_RUN_SKILL_LEVEL - total,
        integer(raw.skills && Object.hasOwn(raw.skills, id) ? raw.skills[id] : 0, skillCap(skill)));
      if (n) { skills[id] = n; total += n; }
    }
    const claimedStages = Array.isArray(raw.claimedStages)
      ? Array.from(new Set(raw.claimedStages.filter(validStage))).slice(0,MAX_RUN_SKILL_LEVEL) : [];
    const choicesUsed = Math.max(total, claimedStages.length, integer(raw.choicesUsed, MAX_RUN_SKILL_LEVEL),
      integer(raw.runSkillLevel, MAX_RUN_SKILL_LEVEL));
    const state = {version:1, seed:integer(raw.seed, 0xffffffff, 1), skills, choicesUsed,
      runSkillLevel:choicesUsed, claimedStages, valkyrieOffers:integer(raw.valkyrieOffers,10),
      pityCounter:integer(raw.pityCounter,4), pendingOffer:null};
    state.skippedValkyrieStages = Array.isArray(raw.skippedValkyrieStages)
      ? Array.from(new Set(raw.skippedValkyrieStages.filter(n => Number.isInteger(n) && n>=5 && n<=45 && n%10===5))) : [];
    const pending = raw.pendingOffer;
    if (choicesUsed < MAX_RUN_SKILL_LEVEL && pending && validStage(pending.stageId) && validProviderStage(pending.stageId,pending.provider)
        && !claimedStages.includes(pending.stageId)) {
      const pool = legalPool(catalog,{provider:pending.provider,skills});
      const ids = new Set(pool.map(s => s.id));
      const skillIds = Array.isArray(pending.skillIds)
        ? Array.from(new Set(pending.skillIds.filter(id => ids.has(id)))).slice(0,offerSize(pending)) : [];
      if(skillIds.length) state.pendingOffer = {stageId:pending.stageId, provider:pending.provider || 'valkyrie',
        segment:integer(pending.segment,4), seraph:pending.seraph === true,
        pity:pending.pity === true, skillIds,
        rerollLimit:integer(pending.rerollLimit,2,1), rerollsUsed:integer(pending.rerollsUsed,2)};
    }
    return state;
  }
  const RARITIES = Object.freeze(['common','rare','epic','legend']);
  const RARITY_WEIGHTS = Object.freeze([[65,27,7,1],[55,30,12,3],[48,30,17,5],
    [43,30,20,7],[38,30,24,8]].map(row => Object.freeze(row)));
  function rarityWeights(segment, seraph) {
    return RARITY_WEIGHTS[integer(segment,4)].map((n,i) => n * (seraph && i >= 2 ? 1.1 : 1));
  }
  // LCG uint32: seed=0 hợp lệ; mỗi slot dùng hai bước (rarity rồi id).
  function random(seed) {
    seed = (Math.imul(integer(seed,0xffffffff,1),1664525) + 1013904223) >>> 0;
    return {seed, value:seed / 4294967296};
  }
  function legalPool(catalog, options) {
    const provider = options.provider || 'valkyrie';
    if (!['valkyrie','angel','devil'].includes(provider)) return [];
    const excluded = new Set(options.exclude || []);
    return Array.from(registry(catalog).values()).filter(skill => RARITIES.includes(skill.rarity)
      && (!Array.isArray(skill.providers) || skill.providers.includes(provider))
      && !excluded.has(skill.id)
      && integer(options.skills && options.skills[skill.id],MAX_SKILL_STACK) < skillCap(skill));
  }
  function drawSlot(catalog, options, seed) {
    options = options || {};
    const pool = legalPool(catalog, options);
    const min = Math.max(0,RARITIES.indexOf(options.minRarity));
    const buckets = RARITIES.map((r,i) => i < min ? [] : pool.filter(s => s.rarity === r));
    const weights = rarityWeights(options.segment, options.seraph && (options.provider || 'valkyrie') === 'valkyrie')
      .map((n,i) => buckets[i].length ? n : 0);
    const total = weights.reduce((a,b) => a+b,0);
    if (!total) return {skillId:null, rarity:null, seed:integer(seed,0xffffffff,1)};
    let r = random(seed), threshold = r.value * total, tier = 0;
    for (;tier<3;tier++) { if(threshold < weights[tier]) break; threshold -= weights[tier]; }
    r = random(r.seed);
    return {skillId:buckets[tier][Math.floor(r.value*buckets[tier].length)].id,
      rarity:RARITIES[tier], seed:r.seed};
  }
  const validStage = id => (typeof id === 'string' && /^[a-zA-Z0-9_:-]{1,80}$/.test(id))
    || (typeof id === 'number' && Number.isSafeInteger(id) && id >= 0 && id <= 10000);
  const validProviderStage = (id, provider) => provider && provider !== 'valkyrie' || typeof id !== 'number' || (id >= 5 && id <= 45 && id % 10 === 5);
  const offerSize = offer => (offer.provider || 'valkyrie') === 'valkyrie' && typeof offer.stageId === 'number' ? 2 : 3;
  const result = (state, ok, reason = null) => ({state, ok, reason, offer:state.pendingOffer});
  function buildOffer(state, catalog, options) {
    const skillIds = [], base = {...options, skills:state.skills};
    // Ưu tiên starter ở ô đầu, chỉ offer đầu; không tự cấp, không vượt provider/cap.
    if (options.starterPriority) {
      const legal = new Set(legalPool(catalog,base).map(s => s.id));
      const starter = options.starterPriority.find(id => legal.has(id));
      if (starter) skillIds.push(starter);
    }
    if (options.pity && !skillIds.some(id => ['epic','legend'].includes(registry(catalog).get(id).rarity))) {
      const d = drawSlot(catalog,{...base,exclude:skillIds,minRarity:'epic'},state.seed);
      state.seed = d.seed;
      if (d.skillId) skillIds.push(d.skillId);
    }
    while (skillIds.length < offerSize(options)) {
      const d = drawSlot(catalog,{...base,exclude:skillIds},state.seed);
      state.seed = d.seed;
      if (!d.skillId) break;
      skillIds.push(d.skillId);
    }
    return skillIds;
  }
  function generateOffer(raw, catalog, options) {
    options = options || {};
    const state = normalizeState(raw,catalog);
    if (state.choicesUsed >= MAX_RUN_SKILL_LEVEL) return result(state,false,'budget');
    if (state.pendingOffer) return result(state,true,'pending');
    if (!validStage(options.stageId) || !validProviderStage(options.stageId,options.provider)) return result(state,false,'stage');
    if (state.claimedStages.includes(options.stageId)) return result(state,false,'claimed');
    if (state.skippedValkyrieStages.includes(options.stageId)) return result(state,false,'skipped');
    const provider = options.provider || 'valkyrie';
    const encounter = provider === 'valkyrie' && options.stageId !== 'start';
    const pity = encounter && state.pityCounter === 4;
    const params = {stageId:options.stageId,provider,segment:integer(options.segment,4),
      seraph:options.seraph === true,pity,rerollLimit:1 + integer(options.heroRerolls,1),rerollsUsed:0};
    const skillIds = buildOffer(state,catalog,{...params,
      starterPriority:state.choicesUsed === 0 && Array.isArray(options.starterPriority) ? options.starterPriority : null});
    if (!skillIds.length) return result(state,false,'empty');
    if (encounter) {
      state.valkyrieOffers++;
      state.pityCounter = skillIds.some(id => ['epic','legend'].includes(registry(catalog).get(id).rarity))
        ? 0 : Math.min(4,state.pityCounter + 1);
    }
    state.pendingOffer = {...params,skillIds};
    return result(state,true);
  }
  function rerollOffer(raw, catalog) {
    const state = normalizeState(raw,catalog), offer = state.pendingOffer;
    if (state.choicesUsed >= MAX_RUN_SKILL_LEVEL) return result(state,false,'budget');
    if (!offer) return result(state,false,'offer');
    if (offer.rerollsUsed >= offer.rerollLimit) return result(state,false,'rerolls');
    const skillIds = buildOffer(state,catalog,offer);
    if (!skillIds.length) return result(state,false,'empty');
    // Reroll thuộc cùng encounter: không cộng miss lần nữa; offer high vẫn reset.
    if (offer.provider === 'valkyrie' && offer.stageId !== 'start'
        && skillIds.some(id => ['epic','legend'].includes(registry(catalog).get(id).rarity))) {
      state.pityCounter = 0;
    }
    state.pendingOffer = {...offer,skillIds,rerollsUsed:offer.rerollsUsed + 1};
    return result(state,true);
  }
  function claimOffer(raw, catalog, skillId) {
    const state = normalizeState(raw,catalog), offer = state.pendingOffer;
    if (state.choicesUsed >= MAX_RUN_SKILL_LEVEL) return result(state,false,'budget');
    if (!offer) return result(state,false,'offer');
    if (!offer.skillIds.includes(skillId)) return result(state,false,'choice');
    state.skills[skillId] = (state.skills[skillId] || 0) + 1;
    state.choicesUsed++;
    state.runSkillLevel = state.choicesUsed;
    state.claimedStages.push(offer.stageId);
    state.pendingOffer = null;
    return {...result(state,true),skillId};
  }
  root.ArtemisCampaignSkills = Object.freeze({MAX_RUN_SKILL_LEVEL, MAX_SKILL_STACK,
    LOWER_CAPS, RARITIES, RARITY_WEIGHTS, skillCap, normalizeState, rarityWeights, drawSlot,
    generateOffer, rerollOffer, claimOffer});
})(typeof globalThis !== 'undefined' ? globalThis : window);
