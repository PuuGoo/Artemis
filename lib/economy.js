// ==================== KIỂM TRA KINH TẾ PHÍA SERVER ====================
// Vấn đề: PUT /api/save nhận bất kỳ `gold`/`gems` nào client gửi lên (trần cũ 1e12
// là vô nghĩa). Một người dùng sửa localStorage hoặc gọi thẳng API có thể tự cấp
// 1.000 tỷ vàng trong một request.
//
// Cách chặn: KHÔNG đặt trần tuyệt đối (sẽ phá dữ liệu người chơi hợp lệ đã tích
// luỹ, và không thể biết người chơi cũ có bao nhiêu). Thay vào đó giới hạn
// ĐỘ TĂNG giữa hai lần lưu:
//
//     goldMoi - goldCu  ≤  thuNhapToiDa(revision tăng bao nhiêu lần)
//
// Người chơi hợp lệ kiếm vàng bằng cách chơi trận -> mỗi trận lưu save vài lần,
// nên `revision` tăng theo số trận. Kẻ gian gửi một request với +1000 tỷ vàng
// trong khi revision chỉ tăng 1 -> bị chặn.
//
// Quan trọng: KHÔNG chặn GIẢM (tiêu vàng là hợp lệ), và KHÔNG chặn khi
// goldCu đã lớn hơn goldMoi (người chơi bán đồ, hoàn cấp).

// Mức thu nhập tối đa cho MỘT đơn vị revision.
// Đo từ source: một trận thắng chương 3 cho 350*3 + (tối đa 15 phòng * 28 vàng
// rơi) ≈ 1050 + 420 ≈ 1500 vàng; bán/merge trang bị có thể hoàn tới
// computeTotalUpgradeGoldSpent(100) ≈ 230.000 vàng một lần.
// Lấy 500.000 để thoải mái cho mọi trường hợp hợp lệ, vẫn chặn được leo thang
// kiểu +1000 tỷ.
export const MAX_GOLD_GAIN_PER_REVISION = 500_000;
export const MAX_GEMS_GAIN_PER_REVISION = 20_000;
// Trần tuyệt đối rất rộng: chỉ để chặn tràn số, không phải công cụ cân bằng.
export const HARD_CAP_GOLD = 1e12;
export const HARD_CAP_GEMS = 1e12;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * So sánh save cũ và save mới để phát hiện leo thang bất thường.
 *
 * @param {object|null} prevData  dữ liệu save đang có trong DB (null nếu lần đầu)
 * @param {object} nextData       dữ liệu client vừa gửi, ĐÃ qua sanitizeSave
 * @param {number} revisionDelta  số revision tăng so với bản ghi hiện tại
 * @returns {{ok: true} | {ok: false, code: string, reason: string, detail: object}}
 */
export function validateEconomyDelta(prevData, nextData, revisionDelta = 1) {
  // Lần lưu đầu tiên: không có mốc so sánh. Vẫn áp trần cứng.
  if (!prevData || typeof prevData !== "object") {
    if (num(nextData.gold) > HARD_CAP_GOLD || num(nextData.gems) > HARD_CAP_GEMS) {
      return {
        ok: false,
        code: "ECONOMY_HARD_CAP",
        reason: "Giá trị tài nguyên vượt giới hạn cho phép.",
        detail: { gold: num(nextData.gold), gems: num(nextData.gems) },
      };
    }
    return { ok: true };
  }

  // Số lần lưu được phép tính là mốc. Tối thiểu 1 để trận đầu tiên vẫn qua.
  const steps = Math.max(1, Math.floor(num(revisionDelta)) || 1);

  const prevGold = num(prevData.gold);
  const nextGold = num(nextData.gold);
  const gainGold = nextGold - prevGold;
  if (gainGold > MAX_GOLD_GAIN_PER_REVISION * steps) {
    return {
      ok: false,
      code: "ECONOMY_GOLD_JUMP",
      reason: "Số vàng tăng bất thường so với tiến trình. Tiến trình chưa được lưu.",
      detail: { prev: prevGold, next: nextGold, gain: gainGold, allowed: MAX_GOLD_GAIN_PER_REVISION * steps },
    };
  }

  const prevGems = num(prevData.gems);
  const nextGems = num(nextData.gems);
  const gainGems = nextGems - prevGems;
  if (gainGems > MAX_GEMS_GAIN_PER_REVISION * steps) {
    return {
      ok: false,
      code: "ECONOMY_GEMS_JUMP",
      reason: "Số đá quý tăng bất thường so với tiến trình. Tiến trình chưa được lưu.",
      detail: { prev: prevGems, next: nextGems, gain: gainGems, allowed: MAX_GEMS_GAIN_PER_REVISION * steps },
    };
  }

  // lifetimeStats.goldEarned là bộ đếm CHỈ TĂNG do game tự cộng. Nếu client khai
  // khống nó để hợp thức hoá vàng thì phát hiện ở đây: nó không được vượt quá
  // tổng vàng đang có + đã tiêu (không thể kiểm chính xác đã tiêu bao nhiêu,
  // nên chỉ chặn mức vô lý: lớn hơn gold hiện tại 100 lần + 1 triệu).
  const earned = num(nextData?.lifetimeStats?.goldEarned);
  if (earned > nextGold * 100 + 1_000_000) {
    return {
      ok: false,
      code: "ECONOMY_FAKE_EARNED",
      reason: "Bộ đếm vàng kiếm được không khớp với số vàng hiện có.",
      detail: { earned, gold: nextGold },
    };
  }

  return { ok: true };
}

// ==================== KIỂM TRA TIẾN TRÌNH MÙA GIẢI ====================
// So sánh với save đang lưu trong MongoDB. Không đặt trần tokens đơn thuần:
// chiều tăng chỉ được phép từ hi sinh sức mạnh hoặc hạ trùm đã ghi nhận.
const SEASON_SACRIFICE_STEP = 0.02;
const SEASON_SACRIFICE_REWARD = 60;
const SEASON_BOSS_REWARD = 120;
const SEASON_EMPTY = Object.freeze({
  season: 1, career: null, tokens: 0, boss: null,
  bossHp: 0, bossMaxHp: 0, bossDefeated: false,
  powerSacrificed: 0, log: [],
});

function seasonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : SEASON_EMPTY;
}

function seasonNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function seasonFailure(code, reason, detail = {}) {
  return { ok: false, code, reason, detail };
}

function validateInitialSeason(next) {
  const boss = next.boss || null;
  const hp = seasonNumber(next.bossHp);
  const maxHp = seasonNumber(next.bossMaxHp);
  const tokens = seasonNumber(next.tokens);
  const sacrifice = seasonNumber(next.powerSacrificed);

  if (tokens !== 0 || sacrifice !== 0 || next.bossDefeated === true) {
    return seasonFailure(
      "SEASON_INITIAL_REWARD",
      "Tiến trình Mùa Giải mới không thể tự có Tiền Mùa hoặc phần thưởng.",
      { tokens, sacrifice, bossDefeated: next.bossDefeated === true },
    );
  }
  if (boss && (!(maxHp > 0) || hp !== maxHp || next.bossDefeated === true)) {
    return seasonFailure(
      "SEASON_INITIAL_BOSS",
      "Trùm mùa mới phải bắt đầu với đầy đủ sinh lực.",
      { boss, hp, maxHp },
    );
  }
  if (!boss && (hp !== 0 || maxHp !== 0)) {
    return seasonFailure(
      "SEASON_INITIAL_BOSS",
      "Dữ liệu sinh lực trùm không khớp với trạng thái tuyển trùm.",
      { boss, hp, maxHp },
    );
  }
  return { ok: true };
}

/** Kiểm tra thay đổi Mùa Giải so với dữ liệu server trước đó. */
export function validateSeasonDelta(prevData, nextData) {
  const next = seasonObject(nextData?.season);
  const previousData = prevData && typeof prevData === "object" ? prevData : null;

  // Save cũ chưa từng lưu season hoặc tài khoản mới: cho phép chọn nghề/tuyển
  // trùm ban đầu, nhưng không chấp nhận tự tạo tokens, hi sinh hoặc thắng trùm.
  if (!previousData || !previousData.season) return validateInitialSeason(next);

  const prev = seasonObject(previousData.season);
  const prevTokens = seasonNumber(prev.tokens);
  const nextTokens = seasonNumber(next.tokens);
  const tokenDelta = nextTokens - prevTokens;
  const prevSacrifice = seasonNumber(prev.powerSacrificed);
  const nextSacrifice = seasonNumber(next.powerSacrificed);
  const sacrificeDelta = nextSacrifice - prevSacrifice;

  if (sacrificeDelta < -1e-8) {
    return seasonFailure(
      "SEASON_SACRIFICE_REWIND",
      "Không thể hoàn tác phần sức mạnh đã hi sinh.",
      { previous: prevSacrifice, next: nextSacrifice },
    );
  }

  const sacrificeSteps = Math.round(sacrificeDelta / SEASON_SACRIFICE_STEP);
  if (
    Math.abs(sacrificeDelta - sacrificeSteps * SEASON_SACRIFICE_STEP) > 1e-6 ||
    nextSacrifice > 0.200001 ||
    sacrificeSteps < 0
  ) {
    return seasonFailure(
      "SEASON_SACRIFICE_INVALID",
      "Mức hi sinh chỉ được tăng theo từng nấc 2%, tối đa 20%.",
      { previous: prevSacrifice, next: nextSacrifice },
    );
  }

  const prevCareer = prev.career || null;
  const nextCareer = next.career || null;
  if (prevCareer && !nextCareer) {
    return seasonFailure(
      "SEASON_CAREER_REMOVED",
      "Không thể xóa nghề đã chọn khỏi tiến trình Mùa Giải.",
      { previousCareer: prevCareer },
    );
  }
  const careerChanged = !!prevCareer && !!nextCareer && prevCareer !== nextCareer;
  const careerCost = careerChanged ? 50 : 0;

  const prevBoss = prev.boss || null;
  const nextBoss = next.boss || null;
  const prevBossHp = seasonNumber(prev.bossHp);
  const nextBossHp = seasonNumber(next.bossHp);
  const prevBossMaxHp = seasonNumber(prev.bossMaxHp);
  const nextBossMaxHp = seasonNumber(next.bossMaxHp);
  const prevDefeated = prev.bossDefeated === true;
  const nextDefeated = next.bossDefeated === true;

  if (prevBoss && !prevDefeated && nextBoss !== prevBoss) {
    return seasonFailure(
      "SEASON_BOSS_SWITCH_ACTIVE",
      "Phải hạ trùm mùa hiện tại trước khi tuyển trùm khác.",
      { previousBoss: prevBoss, nextBoss },
    );
  }

  if (nextBoss && nextBoss !== prevBoss) {
    if (!(nextBossMaxHp > 0) || nextBossHp !== nextBossMaxHp || nextDefeated) {
      return seasonFailure(
        "SEASON_BOSS_INITIAL_STATE",
        "Trùm mới phải bắt đầu ở trạng thái đầy sinh lực.",
        { boss: nextBoss, hp: nextBossHp, maxHp: nextBossMaxHp, defeated: nextDefeated },
      );
    }
  }

  if (nextBoss && nextBoss === prevBoss) {
    if (nextBossMaxHp !== prevBossMaxHp) {
      return seasonFailure(
        "SEASON_BOSS_MAX_HP_CHANGED",
        "Không thể tự thay đổi tổng sinh lực của trùm đang được tuyển.",
        { previous: prevBossMaxHp, next: nextBossMaxHp },
      );
    }
    if (prevDefeated && (!nextDefeated || nextBossHp !== 0)) {
      return seasonFailure(
        "SEASON_BOSS_RESURRECTED",
        "Trùm đã bị hạ không thể tự hồi sinh.",
        { previousHp: prevBossHp, nextHp: nextBossHp, nextDefeated },
      );
    }
    if (!prevDefeated && nextDefeated && nextBossHp !== 0) {
      return seasonFailure(
        "SEASON_BOSS_DEFEAT_STATE",
        "Chỉ ghi nhận hạ trùm khi sinh lực trùm bằng 0.",
        { nextHp: nextBossHp },
      );
    }
  }

  const bossDefeatedNow =
    !!prevBoss && nextBoss === prevBoss && !prevDefeated && nextDefeated &&
    prevBossHp > 0 && nextBossHp === 0;

  const maxEarnedTokens =
    sacrificeSteps * SEASON_SACRIFICE_REWARD +
    (bossDefeatedNow ? SEASON_BOSS_REWARD : 0) -
    careerCost;

  if (tokenDelta > maxEarnedTokens) {
    return seasonFailure(
      "SEASON_TOKEN_UNEARNED",
      "Tiền Mùa tăng không khớp với phần hi sinh hoặc phần thưởng hạ trùm đã lưu.",
      {
        previous: prevTokens,
        next: nextTokens,
        increase: tokenDelta,
        allowedIncrease: Math.max(0, maxEarnedTokens),
        sacrificeSteps,
        bossReward: bossDefeatedNow ? SEASON_BOSS_REWARD : 0,
        careerCost,
      },
    );
  }

  return { ok: true };
}

