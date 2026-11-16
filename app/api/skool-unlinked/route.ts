import { NextResponse, type NextRequest } from "next/server";
import { getSkoolAccess } from "@/lib/skool-access";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, max-age=0" };
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });

/**
 * Unlinked Skool accounts are deliberately NOT included in Agent 360 / PEP
 * aggregates until an admin confirms a unique Agent Master identity.
 * Only a full-scope admin may audit or link them.
 */
async function authorize() {
  const access = await getSkoolAccess();
  if (!access.allowed) return { status: access.status, message: access.message };
  if (!access.canAuditUnlinked) return { status: 403, message: "เฉพาะ Admin ที่มีสิทธิ์ดูทุกหน่วยเท่านั้น" };
  return null;
}

export async function GET() {
  const denied = await authorize();
  if (denied) return respond({ success: false, error: denied.message }, denied.status);
  try {
    const supabase = getSupabaseClient();
    const members: Array<{
      id: number; first_name: string; last_name: string; skool_profile_url: string;
      active: boolean; last_active_at: string | null;
    }> = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await supabase.from("skool_members")
        .select("id, first_name, last_name, skool_profile_url, active, last_active_at")
        .is("agent_id", null).order("id", { ascending: true })
        .range(offset, offset + size - 1);
      if (error) throw error;
      members.push(...(data ?? []));
      if (!data || data.length < size) break;
    }
    const byId = new Map(members.map(m => [m.id, { ...m, courses: 0, started: 0, completed: 0, lastSyncedAt: null as string | null }]));
    const ids = members.map(m => m.id);
    // Batch by member IDs; do not accidentally stop at PostgREST's row cap.
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      for (let offset = 0; ; offset += size) {
        const { data, error } = await supabase.from("learning_course_progress")
          .select("skool_member_id, started, completed, progress_percent, synced_at")
          .in("skool_member_id", batch)
          .order("skool_member_id", { ascending: true })
          .order("course_id", { ascending: true })
          .range(offset, offset + size - 1);
        if (error) throw error;
        for (const row of data ?? []) {
          const m = byId.get(row.skool_member_id);
          if (!m) continue;
          m.courses++;
          if (row.started || Number(row.progress_percent) > 0) m.started++;
          if (row.completed || Number(row.progress_percent) >= 100) m.completed++;
          if (row.synced_at && (!m.lastSyncedAt || row.synced_at > m.lastSyncedAt)) m.lastSyncedAt = row.synced_at;
        }
        if (!data || data.length < size) break;
      }
    }
    // Classification is independent of Agent Master; unresolved accounts remain
    // visible while staff/leader accounts are not treated as missing Agent Codes.
    const classifications = await supabase.from("skool_member_classification")
      .select("skool_member_id, category");
    const classReady = !classifications.error;
    if (classifications.error) console.error("[skool-unlinked] classification not installed", classifications.error.code);
    const classMap = new Map((classifications.data ?? []).map(x => [x.skool_member_id, x.category]));
    const typedMembers = Array.from(byId.values()).map(m => ({
      ...m, category: (classMap.get(m.id) ?? "pending") as string,
    }));
    const classHistory = classReady
      ? await supabase.from("skool_member_classification_audit")
          .select("id, created_at, skool_member_id, skool_name_snapshot, old_category, new_category, actor_email")
          .order("created_at", { ascending: false }).limit(50)
      : null;
    const classificationReady = classReady && !classHistory?.error;
    const classificationAudit = classificationReady ? (classHistory?.data ?? []) : [];
    // History is read-only and limited to authorized full-scope Training/Admin.
    // Missing SQL disables new matching rather than allowing unaudited writes.
    const history = await supabase.from("skool_member_match_audit")
      .select("id, created_at, skool_member_id, skool_name, agent_code_snapshot, agent_name_snapshot, actor_email, verification_method")
      .order("created_at", { ascending: false }).limit(50);
    const auditReady = !history.error;
    if (history.error) console.error("[skool-unlinked] audit setup check:", history.error.code);
    return respond({ success: true, count: members.length, members: typedMembers, classificationReady, classificationAudit,
      auditReady, auditHistory: auditReady ? (history.data ?? []) : [],
      auditNotice: auditReady ? null : "ยังไม่ได้ติดตั้ง Matching Safety + Audit Log ใน Supabase จึงปิดการจับคู่ใหม่ไว้ก่อน" });
  } catch (e) {
    console.error("[skool-unlinked] GET", e);
    return respond({ success: false, error: "โหลดรายชื่อ Skool ที่ยังไม่เชื่อมไม่สำเร็จ" }, 500);
  }
}

/** Only the atomic, auditable SQL function may link accounts. Fail closed if absent. */
export async function POST(request: NextRequest) {
  const access = await getSkoolAccess();
  if (!access.allowed) return respond({ success: false, error: access.message }, access.status);
  if (!access.canAuditUnlinked) return respond({ success: false, error: "บัญชีนี้ไม่มีสิทธิ์จับคู่สมาชิก" }, 403);

  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.nextUrl.host) {
      return respond({ success: false, error: "Origin ไม่ถูกต้อง" }, 403);
    }
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) {
      return respond({ success: false, error: "Content-Type ต้องเป็น JSON" }, 415);
    }
    const body = await request.json();
    const memberId = Number(body?.memberId);
    const agentCode = typeof body?.agentCode === "string" ? body.agentCode.trim() : "";
    const confirmedName = typeof body?.confirmedName === "string" ? body.confirmedName.trim() : "";
    const confirmedAgentName = typeof body?.confirmedAgentName === "string" ? body.confirmedAgentName.trim() : "";
    const verificationMethod = typeof body?.verificationMethod === "string" ? body.verificationMethod : "";
    const verificationNote = typeof body?.verificationNote === "string" ? body.verificationNote.trim() : "";
    if (!Number.isSafeInteger(memberId) || memberId < 1 || agentCode.length < 1 || agentCode.length > 40
      || !confirmedName || confirmedName.length > 200 || !confirmedAgentName || confirmedAgentName.length > 200
      || !["company_roster", "skool_owner_confirmation", "other_verified"].includes(verificationMethod)
      || verificationNote.length < 8 || verificationNote.length > 500 || body?.identityConfirmed !== true) {
      return respond({ success: false, error: "โปรดยืนยันชื่อทั้งสองฝั่ง วิธีตรวจสอบ และหลักฐานการยืนยันตัวตน" }, 400);
    }
    // No read-check-update sequence. A single Postgres transaction locks the
    // Agent Master row and writes both the link and its immutable audit record.
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("skool_link_member_audited", {
      p_member_id: memberId,
      p_agent_code: agentCode,
      p_expected_skool_name: confirmedName,
      p_expected_agent_name: confirmedAgentName,
      p_actor_user_id: access.actorUserId,
      p_actor_email: access.actorEmail,
      p_verification_method: verificationMethod,
      p_verification_note: verificationNote,
    });
    if (error) {
      console.error("[skool-unlinked] atomic audit link failed:", error.code, error.message);
      if (error.code === "PGRST202" || error.code === "42P01" || error.code === "42883")
        return respond({ success: false, error: "ยังไม่ได้ติดตั้ง Matching Safety + Audit Log ใน Supabase จึงไม่บันทึกการจับคู่" }, 503);
      if (error.message?.startsWith("MATCH_"))
        return respond({ success: false, error: "ข้อมูลสมาชิกหรือ Agent Master เปลี่ยนไป หรือรหัสนี้ถูกจับคู่แล้ว กรุณาตรวจสอบใหม่" }, 409);
      return respond({ success: false, error: "ไม่สามารถบันทึกการจับคู่พร้อม Audit Log ได้ จึงยกเลิกการเปลี่ยนแปลงทั้งหมด" }, 500);
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.audit_id || Number(row.member_id) !== memberId) {
      return respond({ success: false, error: "ไม่สามารถยืนยันผล Audit Log ได้ กรุณาติดต่อผู้ดูแลก่อนลองซ้ำ" }, 500);
    }
    return respond({
      success: true, memberId, agentCode: row.matched_agent_code,
      agentName: row.matched_agent_name, auditId: row.audit_id,
    });
  } catch (e) {
    console.error("[skool-unlinked] POST unexpected:", e);
    return respond({ success: false, error: "เกิดข้อผิดพลาด ไม่ได้อนุญาตให้ข้าม Audit Log" }, 500);
  }
}
