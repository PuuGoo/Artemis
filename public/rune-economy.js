(function (root) {
  'use strict';
  const TIERS = ['normal','fine','rare','epic','epic_1','epic_2','legendary','legendary_1','legendary_2','legendary_3','mythic'];
  function copies(raw) { const n = Number(raw); return Number.isSafeInteger(n) ? Math.max(0, Math.min(11,n)) : 0; }
  function tier(raw) { return TIERS[Math.max(0,copies(raw)-1)]; }
  function engravingCost(gearLevel, ownedCount) {
    const level = Math.max(1, Math.min(100, Math.floor(Number(gearLevel)||1)));
    const owned = Math.max(0, Math.min(506, Math.floor(Number(ownedCount)||0)));
    return Math.min(4500, 300 + (level-1)*35 + Math.floor(owned/10)*80);
  }
  function ownedRunes(collection) { return Object.values(collection||{}).filter(v=>copies(v)>0).length; }
  root.RuneEconomy = Object.freeze({ TIERS, copies, tier, engravingCost, ownedRunes });
})(typeof window === 'undefined' ? globalThis : window);
