import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { DashboardAccessError, getDashboardAccess } from "@/lib/dashboard-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { AiaEntity, AiaScope, validateAiaRows } from "@/lib/aia-monthly";

const headers = { "Cache-Control": "no-store, max-age=0" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const missingSchema = (error: { code?: string } | null) => !!error && ["42P01", "PGRST205", "PGRST202"].includes(error.code ?? "");

function period(year: unknown, month: unknown, scope: unknown) {
  const y = Number(year), m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2200 || !Number.isInteger(m) || m < 1 || m > 12 || (scope !== "person" && scope !== "unit")) throw new Error("เดือน ปี หรือระดับข้อมูลไม่ถูกต้อง");
  return { year: y, month: m, scope: scope as AiaScope };
}

async function roster(scope: AiaScope): Promise<AiaEntity[]> {
  const db = getSupabaseClient();
  const [{ data: agents, error: agentError }, { data: units, error: unitError }] = await Promise.all([
    db.from("agent_master").select("agent_code,agent_name,agent_nickname,unit_id,active").eq("active", true).order("agent_name"),
    db.from("units").select("id,unit_code,unit_name,active").eq("active", true).order("unit_name"),
  ]);
  if (agentError || unitError) throw new Error("ไม่สามารถโหลดทะเบียนตัวแทนและหน่วยได้");
  if (scope === "unit") return (units ?? []).filter(u => u.unit_code).map(u => ({ entity_code: u.unit_code, entity_name: u.unit_name, nickname: null, unit_id: u.id, unit_code: u.unit_code, unit_name: u.unit_name }));
  return (agents ?? []).filter(a => a.agent_code).map(a => {
    const unit = (units ?? []).find(u => u.id === a.unit_id);
    return { entity_code: a.agent_code, entity_name: a.agent_name, nickname: a.agent_nickname, unit_id: a.unit_id, unit_code: unit?.unit_code ?? null, unit_name: unit?.unit_name ?? null };
  });
}

export async function readAiaMonthly(request: NextRequest, area: "daily-production" | "monthly-performance") {
  try {
    await getDashboardAccess(area);
    let selection;
    try { selection = period(request.nextUrl.searchParams.get("year"), request.nextUrl.searchParams.get("month"), request.nextUrl.searchParams.get("scope")); }
    catch (e) { return json({ error: (e as Error).message }, 400); }
    const db = getSupabaseClient();
    const [{ data: batch, error }, entities] = await Promise.all([
      db.from("aia_monthly_batches").select("*").eq("report_year", selection.year).eq("report_month", selection.month).eq("scope", selection.scope).maybeSingle(),
      roster(selection.scope),
    ]);
    if (missingSchema(error)) return json({ configured: false, batch: null, rows: [], entities, history: [] });
    if (error) throw new Error("ไม่สามารถโหลดเดือนรายงานได้");
    if (!batch) return json({ configured: true, batch: null, rows: [], entities, history: [] });
    const [rowsResult, historyResult] = await Promise.all([
      db.from("aia_monthly_rows").select("*").eq("batch_id", batch.id).order("entity_name"),
      db.from("aia_monthly_audit").select("revision,action,changed_at").eq("batch_id", batch.id).order("revision", { ascending: false }).limit(20),
    ]);
    if (rowsResult.error || historyResult.error) throw new Error("ไม่สามารถโหลดรายละเอียดรายงานได้");
    return json({ configured: true, batch, rows: rowsResult.data ?? [], entities, history: historyResult.data ?? [] });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  if (error instanceof DashboardAccessError) return json({ error: error.message }, error.status);
  console.error("[aia-monthly] request failed", error);
  return json({ error: "ไม่สามารถดำเนินการยอด AIA ได้ กรุณาลองใหม่" }, 500);
}

export async function writeAiaMonthly(request: NextRequest) {
  if (!checkRateLimit(request).allowed) return json({ error: "กรุณารอสักครู่ก่อนลองใหม่" }, 429);
  try {
    const access = await getDashboardAccess("daily-production");
    let body;
    try { body = await request.json(); } catch { return json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, 400);
    let selection, rows;
    try {
      selection = period(body.year, body.month, body.scope);
      if (!["draft", "confirm", "reopen"].includes(body.action)) throw new Error("คำสั่งไม่ถูกต้อง");
      if (!Number.isInteger(body.revision) || body.revision < 0) throw new Error("เวอร์ชันข้อมูลไม่ถูกต้อง");
      if (typeof body.as_of_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.as_of_date) || new Date(body.as_of_date + "T00:00:00Z").toISOString().slice(0, 10) !== body.as_of_date) throw new Error("วันที่อ้างอิงไม่ถูกต้อง");
      rows = body.action === "reopen" ? [] : validateAiaRows(body.rows, body.action === "confirm");
    } catch (error) { return json({ error: error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง" }, 400); }
    const db = getSupabaseClient();
    if (body.action !== "reopen") {
      const currentRoster = await roster(selection.scope);
      const { data: existingBatch, error: batchError } = await db.from("aia_monthly_batches").select("id").eq("report_year", selection.year).eq("report_month", selection.month).eq("scope", selection.scope).maybeSingle();
      if (missingSchema(batchError)) return json({ error: "ต้องติดตั้ง SQL ยอด AIA สิ้นเดือนก่อนบันทึก", code: "AIA_SETUP_REQUIRED" }, 503);
      if (batchError) throw batchError;
      const { data: oldRows, error: rowError } = existingBatch ? await db.from("aia_monthly_rows").select("*").eq("batch_id", existingBatch.id) : { data: [], error: null };
      if (rowError) throw rowError;
      const allowed = new Map<string, AiaEntity>([...currentRoster, ...(oldRows ?? [])].map(r => [r.entity_code, r]));
      if (rows!.some(r => !allowed.has(r.entity_code))) return json({ error: "มีรหัสที่ไม่อยู่ในทะเบียน กรุณาโหลดข้อมูลใหม่" }, 400);
      // Full-set writes prevent an accidental paste/filtered view from deleting saved people.
      const required = new Set([...(oldRows ?? []).map(r => r.entity_code), ...currentRoster.map(r => r.entity_code)]);
      if (rows!.length !== required.size || rows!.some(r => !required.has(r.entity_code))) return json({ error: "รายชื่อเปลี่ยนหรือข้อมูลไม่ครบ กรุณาโหลดใหม่ก่อนบันทึก" }, 409);
      rows = rows!.map(r => {
        const entity = allowed.get(r.entity_code)!;
        return { ...r, entity_code: entity.entity_code, entity_name: entity.entity_name,
          nickname: entity.nickname, unit_id: entity.unit_id, unit_code: entity.unit_code, unit_name: entity.unit_name };
      });
    }
    const { data, error } = await db.rpc("save_aia_monthly_batch", {
      p_year: selection.year, p_month: selection.month, p_scope: selection.scope,
      p_as_of_date: body.as_of_date, p_action: body.action, p_expected_revision: body.revision,
      p_rows: rows, p_actor: access.userId,
    });
    if (missingSchema(error)) return json({ error: "ต้องติดตั้ง SQL ยอด AIA สิ้นเดือนก่อนบันทึก", code: "AIA_SETUP_REQUIRED" }, 503);
    if (error?.code === "40001") return json({ error: "มีผู้แก้ไขข้อมูลเดือนนี้แล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก" }, 409);
    if (error?.code === "55000") return json({ error: "ยอดถูกยืนยันแล้ว ต้องเปิดแก้ไขก่อน" }, 409);
    if (error) throw error;
    return json({ batch: data });
  } catch (error) { return failure(error); }
}
