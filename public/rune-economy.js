(function (root) {
  'use strict';
  const TIERS = ['normal','fine','rare','epic','epic_1','epic_2','legendary','legendary_1','legendary_2','legendary_3','mythic'];
  function copies(raw) { const n = Number(raw); return Number.isSafeInteger(n) ? Math.max(0, Math.min(11,n)) : 0; }
  function tier(raw) { return TIERS[Math.max(0,copies(raw)-1)]; }
  function ownedRunes(collection) { return Object.values(collection||{}).filter(v=>copies(v)>0).length; }
  root.RuneEconomy = Object.freeze({ TIERS, copies, tier, ownedRunes });
})(typeof window === 'undefined' ? globalThis : window);
