import { NextResponse, type NextRequest } from "next/server";
import { getSkoolAccess } from "@/lib/skool-access";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, max-age=0" };
const respond = (value: unknown, status = 200) => NextResponse.json(value, { status, headers });

export async function POST(request: NextRequest) {
  const access = await getSkoolAccess();
  if (!access.allowed) return respond({ success: false, error: access.message }, access.status);
  if (!access.canAuditUnlinked) return respond({ success: false, error: "ไม่มีสิทธิ์จัดประเภทสมาชิก" }, 403);
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.nextUrl.host)
      return respond({ success: false, error: "Origin ไม่ถูกต้อง" }, 403);
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json"))
      return respond({ success: false, error: "ต้องส่ง JSON" }, 415);

    const body = await request.json();
    const memberId = Number(body?.memberId);
    const category = typeof body?.category === "string" ? body.category : "";
    const expectedCategory = typeof body?.expectedCategory === "string" ? body.expectedCategory : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    const allowed = ["pending", "staff", "team_leader"];
    if (!Number.isSafeInteger(memberId) || memberId < 1 || !allowed.includes(category)
      || !allowed.includes(expectedCategory) || category === expectedCategory
      || note.length < 8 || note.length > 500)
      return respond({ success: false, error: "กรุณาเลือกประเภทใหม่ พร้อมเหตุผลอย่างน้อย 8 ตัวอักษร" }, 400);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("skool_classify_member_audited", {
      p_member_id: memberId,
      p_expected_category: expectedCategory,
      p_new_category: category,
      p_note: note,
      p_actor_id: access.actorUserId,
      p_actor_email: access.actorEmail,
    });
    if (error) {
      console.error("[skool-classification] RPC", error.code, error.message);
      if (["PGRST202", "42P01", "42883"].includes(error.code))
        return respond({ success: false, error: "ยังไม่ได้ติดตั้ง Classification SQL ใน Supabase" }, 503);
      if (error.message?.startsWith("CLASSIFICATION_"))
        return respond({ success: false, error: "ข้อมูลเปลี่ยนไปแล้วหรือบัญชีนี้เชื่อม Agent Master อยู่ กรุณารีเฟรช" }, 409);
      return respond({ success: false, error: "ไม่สามารถบันทึกประเภทพร้อม Audit Log ได้" }, 500);
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.audit_id || Number(row.member_id) !== memberId)
      return respond({ success: false, error: "บันทึกแล้วแต่ยังยืนยัน Audit ไม่ได้ กรุณารีเฟรชตรวจสอบ" }, 500);
    return respond({ success: true, memberId, category: row.category, auditId: row.audit_id });
  } catch (e) {
    console.error("[skool-classification] unexpected", e);
    return respond({ success: false, error: "ไม่สามารถบันทึกการจัดประเภทได้" }, 500);
  }
}
