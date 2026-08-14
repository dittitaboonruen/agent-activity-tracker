import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const agent = params.get("agent")?.trim() || "";
  const year = Number(params.get("year"));

  if (!agent) {
    return errorResponse("กรุณาระบุตัวแทน", 400);
  }

  if (!Number.isInteger(year)) {
    return errorResponse("ปีไม่ถูกต้อง", 400);
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("agent_targets")
      .select("*")
      .eq("agent_name", agent)
      .eq("target_year", year)
      .maybeSingle();

    if (error) {
      console.error("[annual-target] GET error:", error);
      return errorResponse("ไม่สามารถโหลดข้อมูลเป้าหมายได้", 500);
    }

    return NextResponse.json(
      { target: data ?? null },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[annual-target] GET unexpected error:", error);
    return errorResponse("เกิดข้อผิดพลาดในการโหลดข้อมูล", 500);
  }
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request);

  if (!rate.allowed) {
    return errorResponse("กรุณารอสักครู่ก่อนลองใหม่อีกครั้ง", 429);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("ข้อมูลที่ส่งมาไม่ถูกต้อง", 400);
  }

  if (typeof body !== "object" || body === null) {
    return errorResponse("ข้อมูลที่ส่งมาไม่ถูกต้อง", 400);
  }

  const data = body as Record<string, unknown>;

  const agentName =
    typeof data.agentName === "string"
      ? data.agentName.trim()
      : "";

  const targetYear = Number(data.targetYear);
  const targetFyp = Number(data.targetFyp);
  const targetFyc = Number(data.targetFyc);
  const targetCase = Number(data.targetCase);

  if (!agentName) {
    return errorResponse("กรุณาระบุชื่อตัวแทน", 400);
  }

  if (!Number.isInteger(targetYear) || targetYear < 2025 || targetYear > 2100) {
    return errorResponse("ปีเป้าหมายไม่ถูกต้อง", 400);
  }

  if (
    !Number.isFinite(targetFyp) ||
    !Number.isFinite(targetFyc) ||
    !Number.isInteger(targetCase) ||
    targetFyp < 0 ||
    targetFyc < 0 ||
    targetCase < 0
  ) {
    return errorResponse("กรุณากรอกเป้าหมายให้ถูกต้อง", 400);
  }

  try {
    const supabase = getSupabaseClient();

    const { data: savedTarget, error } = await supabase
      .from("agent_targets")
      .upsert(
        {
          agent_name: agentName,
          target_year: targetYear,
          target_fyp: targetFyp,
          target_fyc: targetFyc,
          target_case: targetCase,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "agent_name,target_year",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("[annual-target] Supabase error:", error);
      return errorResponse("ไม่สามารถบันทึกเป้าหมายได้", 500);
    }

    return NextResponse.json(
      {
        success: true,
        target: savedTarget,
      },
      {
        status: 201,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("[annual-target] Unexpected error:", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึกข้อมูล", 500);
  }
}

export async function PUT() {
  return errorResponse("Method not allowed.", 405);
}

export async function PATCH() {
  return errorResponse("Method not allowed.", 405);
}

export async function DELETE() {
  return errorResponse("Method not allowed.", 405);
}
