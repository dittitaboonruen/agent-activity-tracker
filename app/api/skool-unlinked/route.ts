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
    return respond({ success: true, count: members.length, members: Array.from(byId.values()) });
  } catch (e) {
    console.error("[skool-unlinked] GET", e);
    return respond({ success: false, error: "โหลดรายชื่อ Skool ที่ยังไม่เชื่อมไม่สำเร็จ" }, 500);
  }
}

/** Explicit, idempotent admin-controlled identity match. Never change Agent Master. */
export async function POST(request: NextRequest) {
  const denied = await authorize();
  if (denied) return respond({ success: false, error: denied.message }, denied.status);
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.nextUrl.host) {
      return respond({ success: false, error: "Origin ไม่ถูกต้อง" }, 403);
    }
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) {
      return respond({ success: false, error: "Content-Type ต้องเป็น JSON" }, 415);
    }
    const body = await request.json();
    const memberId = Number(body?.memberId);
    const agentCode = typeof body?.agentCode === "string" ? body.agentCode.trim() : "";
    const confirmedName = typeof body?.confirmedName === "string" ? body.confirmedName.trim() : "";
    if (!Number.isSafeInteger(memberId) || memberId < 1 || !agentCode || agentCode.length > 40 || !confirmedName || confirmedName.length > 200) {
      return respond({ success: false, error: "โปรดระบุบัญชี Skool, Agent Code และยืนยันชื่อให้ครบ" }, 400);
    }
    const supabase = getSupabaseClient();
    const [memberResult, agentResult] = await Promise.all([
      supabase.from("skool_members").select("id, agent_id, first_name, last_name").eq("id", memberId).maybeSingle(),
      supabase.from("agent_master").select("id, agent_code, agent_name, active").eq("agent_code", agentCode).eq("active", true).limit(2),
    ]);
    if (memberResult.error || agentResult.error) throw memberResult.error ?? agentResult.error;
    const member = memberResult.data;
    const agents = agentResult.data ?? [];
    if (!member || agents.length !== 1) return respond({ success: false, error: "ไม่พบบัญชี Skool หรือ Agent Code ไม่ตรงกับตัวแทนที่ใช้งานอยู่เพียงคนเดียว" }, 404);
    if (member.agent_id !== null) return respond({ success: false, error: "บัญชี Skool นี้มีการเชื่อมแล้ว กรุณารีเฟรช" }, 409);
    const normalize = (s: string) => s.normalize("NFKC").replace(/\\s+/g, " ").trim();
    const fullName = normalize([member.first_name, member.last_name].filter(Boolean).join(" "));
    if (normalize(confirmedName) !== fullName) return respond({ success: false, error: "ชื่อที่ยืนยันไม่ตรงกับบัญชี Skool" }, 400);
    const agent = agents[0];
    const existing = await supabase.from("skool_members").select("id").eq("agent_id", agent.id).limit(1);
    if (existing.error) throw existing.error;
    if ((existing.data ?? []).length) return respond({ success: false, error: "Agent Code นี้เชื่อมกับบัญชี Skool อื่นแล้ว ต้องตรวจสอบก่อน" }, 409);
    const { data, error } = await supabase.from("skool_members").update({ agent_id: agent.id, updated_at: new Date().toISOString() })
      .eq("id", memberId).is("agent_id", null).select("id, agent_id").maybeSingle();
    if (error) throw error;
    if (!data) return respond({ success: false, error: "มีผู้แก้ไขบัญชีนี้แล้ว กรุณารีเฟรช" }, 409);
    console.info("[skool-unlinked] admin linked member", { memberId, agentId: agent.id });
    return respond({ success: true, memberId, agentCode: agent.agent_code, agentName: agent.agent_name });
  } catch (e) {
    console.error("[skool-unlinked] POST", e);
    return respond({ success: false, error: "จับคู่บัญชีไม่สำเร็จ ไม่มีการแก้ข้อมูล Production หรือ Quiz" }, 500);
  }
}
