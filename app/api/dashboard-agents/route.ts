import { NextResponse, type NextRequest } from "next/server";
import { DashboardAccessError, getDashboardAccess } from "@/lib/dashboard-access";
import { getSupabaseClient } from "@/lib/supabase";
import type { DashboardAgent } from "@/lib/dashboard-agents";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = { "Cache-Control": "no-store, max-age=0" };
const PAGE_SIZE = 500;

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: HEADERS });
}

export async function GET(request: NextRequest) {
  // Scope comes exclusively from the verified profile, never from the caller.
  if (request.nextUrl.search) return errorResponse("This endpoint does not accept query parameters.", 400);
  try {
    const access = await getDashboardAccess("activity");
    const db = getSupabaseClient();
    const agents: DashboardAgent[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      let query = db.from("agent_master")
        .select("id, agent_name, agent_code, jotform_agent_name")
        .eq("active", true)
        .order("id", { ascending: true });
      if (!access.canSeeAll) query = query.eq("unit_id", access.unitId!);
      const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        console.error("[dashboard-agents] roster query failed:", error.code);
        return errorResponse("ไม่สามารถโหลดทะเบียนตัวแทนได้ กรุณาลองใหม่", 500);
      }
      const page = data ?? [];
      for (const row of page) {
        if (typeof row.agent_name !== "string" || !row.agent_name.trim()) continue;
        agents.push({
          id: row.id,
          agentName: row.agent_name,
          agentCode: row.agent_code ?? null,
          jotformAgentName: row.jotform_agent_name ?? null,
        });
      }
      if (page.length < PAGE_SIZE) break;
    }
    return NextResponse.json({ agents }, { headers: HEADERS });
  } catch (error) {
    if (error instanceof DashboardAccessError) return errorResponse(error.message, error.status);
    console.error("[dashboard-agents] unable to load roster");
    return errorResponse("ไม่สามารถโหลดทะเบียนตัวแทนได้ กรุณาลองใหม่", 500);
  }
}

function methodNotAllowed() {
  return NextResponse.json({ error: "Method not allowed." }, {
    status: 405, headers: { ...HEADERS, Allow: "GET" },
  });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
