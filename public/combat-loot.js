/* Chọn trọng số tích lũy đã đối chiếu native; bảng trọng số do Artemis sở hữu. */
(function (root) {
  'use strict';
  function pickWeighted(entries, random = Math.random) {
    if (!Array.isArray(entries) || !entries.length) return null;
    let total = 0;
    for (const entry of entries) {
      if (!entry || !Number.isSafeInteger(entry.weight) || entry.weight < 0) return null;
      total += entry.weight;
      if (!Number.isSafeInteger(total)) return null;
    }
    if (!total) return null;
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) return null;
    const roll = Math.floor(sample * total) + 1;
    let cumulative = 0;
    for (const entry of entries) {
      cumulative += entry.weight;
      if (cumulative >= roll) return entry.value;
    }
    return null;
  }
  function pickScrollSlot(slots, random = Math.random) {
    // Trọng số bằng nhau giữ nguyên phân phối hiện có, không nhập ID thương mại chưa map.
    return pickWeighted(slots.map(value => ({ value, weight: 1 })), random);
  }
  root.CombatLoot = { pickWeighted, pickScrollSlot };
})(globalThis);
