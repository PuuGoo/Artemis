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
