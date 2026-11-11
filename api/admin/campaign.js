import { requireAdmin } from "../../lib/adminAuth.js";
import { json, fail } from "../../lib/http.js";
import { getCampaignSummaries, getCampaignDetail } from "../../lib/campaignCatalog.js";
import * as studio from "../../lib/adminStudioHandler.js";

export const config = { runtime: "nodejs" };

// GET /api/admin/campaign (summary) hoặc ?chapter=8 (đủ 50 phòng từ cấu hình chung).
// Chỉ xem; không ghi database/save, không mở khóa chương.
export async function GET(request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  if(url.searchParams.get('__studio')==='1')return studio.GET(request);
  const requested = url.searchParams.get("chapter");
  if (requested === null) {
    return json({ ok: true, chapters: getCampaignSummaries(), readOnly: true });
  }
  if (!/^[1-9]\d*$/.test(requested)) return fail("Mã chương không hợp lệ.", 400);
  const chapter = getCampaignDetail(Number(requested));
  if (!chapter) return fail("Không tìm thấy chương chiến dịch.", 404);
  return json({ ok: true, chapter, readOnly: true });
}

// Share the existing Admin Campaign lambda with the Content Studio writer.
export async function POST(request){
  if(new URL(request.url).searchParams.get('__studio')==='1')return studio.POST(request);
  return fail('Chỉ hỗ trợ cập nhật Content Studio.',405);
}
