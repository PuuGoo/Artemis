import { validateEconomyDelta, validateSeasonDelta } from '../economy.js';
import { validateEconomyBudget } from '../economyLedger.js';
import { normalizeVipPasses, hasVipPass } from '../privilegeCards.js';

// Client cũ không gửi key; client mới gửi null nếu muốn xoá có chủ đích.
const CARRY_FORWARD_FIELDS = ['gameMode', 'modeBest', 'guild', 'garden', 'plinko'];

/**
 * Áp quyền sở hữu server và tương thích client cũ lên snapshot ĐÃ sanitize.
 * Không sửa input hoặc giữ tham chiếu mutable tới dữ liệu của repository.
 * Đồng hồ do caller cung cấp để cả request dùng cùng một mốc thời gian.
 */
export function prepareSaveData({ sanitizedData, incomingData, previousData, nowMs }) {
  const data = structuredClone(sanitizedData);
  data.vipCoins = Math.max(0, Math.min(1e9, Number(previousData?.vipCoins) || 0));
  data.vipPasses = normalizeVipPasses(previousData?.vipPasses);
  for (const field of ['runes', 'runeStones']) {
    data[field] = previousData?.[field] && typeof previousData[field] === 'object'
      ? structuredClone(previousData[field]) : {};
  }
  data.runeIntroClaimed = previousData?.runeIntroClaimed === true;
  data.runeMythicEnchant = previousData?.runeMythicEnchant === true;
  for (const slots of Object.values(data.equippedRuneSlots || {})) {
    if (!Array.isArray(slots)) continue;
    for (let index = 0; index < slots.length; index++) {
      if (slots[index] && !(Number(data.runes[slots[index]]) > 0)) slots[index] = null;
    }
  }
  if (!hasVipPass(data.vipPasses, 'hunting', nowMs) && data.wikiEventsState?.huntingWarriorCard) {
    data.wikiEventsState.huntingWarriorCard = false;
  }
  for (const key of CARRY_FORWARD_FIELDS) {
    if (!(key in incomingData) && previousData && key in previousData) {
      data[key] = structuredClone(previousData[key]);
    }
  }
  return data;
}

/**
 * Luật domain: delta -> ngân sách theo giờ server -> mùa giải.
 * Không HTTP, không MongoDB; chỉ trả ledger mới khi TẤT CẢ luật chấp nhận.
 */
export function validateSaveTransition({ previous, data, nowMs }) {
  const previousData = previous?.data || null;
  const economy = validateEconomyDelta(previousData, data, 1);
  if (!economy.ok) {
    return { ok: false, error: { error: economy.reason, code: economy.code, detail: economy.detail } };
  }
  const budget = validateEconomyBudget(previousData, data, previous?.ledger || null, nowMs);
  if (!budget.ok) {
    return { ok: false, error: {
      error: 'Kinh tế không hợp lệ so với thời gian chơi.',
      code: budget.code,
      message: budget.message,
    } };
  }
  const season = validateSeasonDelta(previousData, data);
  if (!season.ok) {
    return { ok: false, error: { error: season.reason, code: season.code, detail: season.detail } };
  }
  return { ok: true, ledger: budget.ledger };
}
