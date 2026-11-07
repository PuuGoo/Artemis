// Ngân sách kinh tế phía server (chống mint vàng/đá quý bằng snapshot tự khai).
//
// VẤN ĐỀ (P0 đã mở từ đầu audit): snapshot các revision sau vẫn tự khai `gold`/`gems`
// trong hạn mức delta (500.000 vàng, 20.000 đá/revision). Bốn revision giả lập mint
// được 2.000.000 vàng + 80.000 đá quý — không cần chơi một trận nào.
//
// CÁCH LÀM: server giữ một NGÂN SÁCH, nạp dần theo THỜI GIAN THẬT (đồng hồ server).
// Client không thể tua nhanh đồng hồ server, nên trần thu nhập bị chặn theo thời gian
// thay vì theo số revision. Người chơi bình thường không bao giờ chạm trần:
//   - vàng: 300 vàng/giây  (một phòng sạch ~10–20s cho ~1.000–3.000 vàng)
//   - đá quý: 1 đá/4 giây
//   - dự trữ (burst) đủ cho một phiên ngắn: 90 giây vàng, 600 giây đá
// Người bỏ chơi 1 ngày vẫn chỉ được nạp tối đa phần dự trữ — không tích luỹ vô hạn.
//
// ĐÂY KHÔNG PHẢI bằng chứng từng hành động: nó là TRẦN TỐC ĐỘ do server áp. Kẻ gian
// vẫn có thể mint tối đa bằng tốc độ người chơi thật, nhưng không thể mint 500k/lần lưu.
// Muốn chứng minh từng nguồn (battle/quest/chest) cần action ledger — xem
// docs/audit/artemis-new-player/16-ECONOMY-LEDGER.md §"Còn lại".

export const LEDGER_VERSION = 1;

/** Trần thu nhập theo thời gian (server-side, đơn vị mỗi giây). */
export const RATES = {
  goldPerSecond: 300,
  gemsPerSecond: 1 / 4,      // 1 đá mỗi 4 giây
};

/** Dự trữ tối đa (giây) — chặn tích luỹ khi offline lâu. */
export const BURST_SECONDS = {
  gold: 90,
  gems: 600,
};

/** Hạn mức tuyệt đối mỗi lần lưu (vẫn giữ để chặn payload khổng lồ). */
export const MAX_GOLD_GAIN_PER_SAVE = RATES.goldPerSecond * BURST_SECONDS.gold;   // 27.000
export const MAX_GEMS_GAIN_PER_SAVE = Math.floor(RATES.gemsPerSecond * BURST_SECONDS.gems); // 150

/** Khởi tạo trạng thái ngân sách cho save mới (đầy dự trữ để trận đầu không bị chặn). */
export function freshLedger(nowMs = Date.now()) {
  return {
    v: LEDGER_VERSION,
    at: Number(nowMs),
    gold: MAX_GOLD_GAIN_PER_SAVE,
    gems: MAX_GEMS_GAIN_PER_SAVE,
  };
}

/**
 * Nạp lại ngân sách theo thời gian đã trôi (đồng hồ SERVER).
 * Không bao giờ trừ khi thời gian lùi (đồng hồ bị chỉnh) — chỉ giữ nguyên.
 */
export function refillLedger(ledger, nowMs = Date.now()) {
  const base = normalizeLedger(ledger, nowMs);
  const elapsed = Math.max(0, (Number(nowMs) - base.at) / 1000);
  if (elapsed <= 0) return { ...base, at: Number(nowMs) };

  return {
    v: LEDGER_VERSION,
    at: Number(nowMs),
    gold: Math.min(MAX_GOLD_GAIN_PER_SAVE, base.gold + elapsed * RATES.goldPerSecond),
    gems: Math.min(MAX_GEMS_GAIN_PER_SAVE, base.gems + elapsed * RATES.gemsPerSecond),
  };
}

function normalizeLedger(ledger, nowMs) {
  if (!ledger || typeof ledger !== 'object') return freshLedger(nowMs);
  const clamp = (v, max) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return max;   // hỏng -> coi như đầy (không phạt oan)
    return Math.min(max, n);
  };
  return {
    v: LEDGER_VERSION,
    at: Number.isFinite(Number(ledger.at)) && Number(ledger.at) > 0 ? Number(ledger.at) : Number(nowMs),
    gold: clamp(ledger.gold, MAX_GOLD_GAIN_PER_SAVE),
    gems: clamp(ledger.gems, MAX_GEMS_GAIN_PER_SAVE),
  };
}

/**
 * Kiểm tra mức tăng có nằm trong ngân sách không.
 *
 * @param {object} prevState  save đang có trong DB (data), hoặc null
 * @param {object} nextData   data client gửi lên
 * @param {object} ledger     trạng thái ngân sách đã lưu (save.ledger) hoặc null
 * @param {number} nowMs
 * @returns {{ok:boolean, code?:string, message?:string, gold:number, gems:number,
 *            spentGold:number, spentGems:number, ledger:object}}
 */
export function validateEconomyBudget(prevState, nextData, ledger, nowMs = Date.now()) {
  const filled = refillLedger(ledger, nowMs);

  const prev = prevState && typeof prevState === 'object' ? prevState : {};
  const next = nextData && typeof nextData === 'object' ? nextData : {};

  // Số dư client gửi lên phải là số hữu hạn >= 0. NaN/Infinity/chuỗi rác bị TỪ CHỐI
  // thay vì quy về 0 — nếu quy về 0, một payload hỏng sẽ xoá sạch tài sản người chơi.
  for (const [field, value] of [['gold', next.gold], ['gems', next.gems]]) {
    if (value === undefined) continue;   // client cũ không gửi -> giữ nguyên như trước
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 1e15) {
      return {
        ok: false,
        code: 'ECONOMY_INVALID_VALUE',
        message: `Giá trị ${field} không hợp lệ.`,
        gold: filled.gold,
        gems: filled.gems,
        spentGold: 0,
        spentGems: 0,
        ledger: filled,
      };
    }
  }

  const goldBefore = safeNum(prev.gold);
  const gemsBefore = safeNum(prev.gems);
  const goldAfter = safeNum(next.gold);
  const gemsAfter = safeNum(next.gems);

  // Chỉ quan tâm phần TĂNG. Giảm (tiêu) luôn hợp lệ — người chơi có quyền tiêu.
  const goldGain = Math.max(0, goldAfter - goldBefore);
  const gemsGain = Math.max(0, gemsAfter - gemsBefore);

  const result = {
    ok: true,
    gold: filled.gold,
    gems: filled.gems,
    spentGold: 0,
    spentGems: 0,
    ledger: filled,
  };

  if (goldGain > filled.gold + 0.5) {
    return {
      ...result,
      ok: false,
      code: 'ECONOMY_BUDGET_GOLD',
      message: `Vàng tăng ${Math.round(goldGain)} vượt ngân sách còn lại ${Math.round(filled.gold)} — chưa đủ thời gian chơi để đạt mức này.`,
    };
  }
  if (gemsGain > filled.gems + 0.5) {
    return {
      ...result,
      ok: false,
      code: 'ECONOMY_BUDGET_GEMS',
      message: `Đá quý tăng ${Math.round(gemsGain)} vượt ngân sách còn lại ${Math.round(filled.gems)}.`,
    };
  }
  if (goldGain > MAX_GOLD_GAIN_PER_SAVE || gemsGain > MAX_GEMS_GAIN_PER_SAVE) {
    return {
      ...result,
      ok: false,
      code: 'ECONOMY_BUDGET_BURST',
      message: 'Mức tăng vượt trần một lần lưu.',
    };
  }

  return {
    ...result,
    spentGold: goldGain,
    spentGems: gemsGain,
    ledger: {
      ...filled,
      gold: Math.max(0, filled.gold - goldGain),
      gems: Math.max(0, filled.gems - gemsGain),
    },
  };
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
