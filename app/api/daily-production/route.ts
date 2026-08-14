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

  const productionDate =
    typeof data.productionDate === "string"
      ? data.productionDate.trim()
      : "";

  const agentCode =
    typeof data.agentCode === "string"
      ? data.agentCode.trim()
      : "";

  const agentName =
    typeof data.agentName === "string"
      ? data.agentName.trim()
      : "";

  const agentNickname =
    typeof data.agentNickname === "string"
      ? data.agentNickname.trim()
      : "";

  const aiaCaseSubmitted = Number(data.aiaCaseSubmitted ?? 0);
  const aiaCaseApproved = Number(data.aiaCaseApproved ?? 0);

  const aiaFypSubmitted = Number(data.aiaFypSubmitted ?? 0);
  const aiaFypApproved = Number(data.aiaFypApproved ?? 0);

  const aiaFycApproved = Number(data.aiaFycApproved ?? 0);

  const paCase = Number(data.paCase ?? 0);
  const paFyp = Number(data.paFyp ?? 0);
  const paFyc = Number(data.paFyc ?? 0);

  const note =
    typeof data.note === "string"
      ? data.note.trim()
      : "";

  if (!productionDate) {
    return errorResponse("กรุณาระบุวันที่", 400);
  }

  if (!agentName) {
    return errorResponse("กรุณาระบุชื่อตัวแทน", 400);
  }

  const numericValues = [
    aiaCaseSubmitted,
    aiaCaseApproved,
    aiaFypSubmitted,
    aiaFypApproved,
    aiaFycApproved,
    paCase,
    paFyp,
    paFyc,
  ];

  if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
    return errorResponse("กรุณากรอกตัวเลขให้ถูกต้อง", 400);
  }

  if (
    !Number.isInteger(aiaCaseSubmitted) ||
    !Number.isInteger(aiaCaseApproved) ||
    !Number.isInteger(paCase)
  ) {
    return errorResponse("จำนวน CASE ต้องเป็นจำนวนเต็ม", 400);
  }

  try {
    const supabase = getSupabaseClient();

    const { data: saved, error } = await supabase
      .from("daily_production")
      .upsert(
        {
          production_date: productionDate,
          agent_code: agentCode || null,
          agent_name: agentName,
          agent_nickname: agentNickname || null,

          aia_case_submitted: aiaCaseSubmitted,
          aia_case_approved: aiaCaseApproved,
          aia_fyp_submitted: aiaFypSubmitted,
          aia_fyp_approved: aiaFypApproved,
          aia_fyc_approved: aiaFycApproved,

          pa_case: paCase,
          pa_fyp: paFyp,
          pa_fyc: paFyc,

          note: note || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "production_date,agent_name",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("[daily-production] Supabase error:", error);
      return errorResponse("ไม่สามารถบันทึก Production ได้", 500);
    }

    return NextResponse.json(
      {
        success: true,
        production: saved,
      },
      {
        status: 201,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("[daily-production] unexpected error:", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึกข้อมูล", 500);
  }
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date")?.trim() || "";

  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from("daily_production")
      .select("*")
      .order("agent_code", { ascending: true });

    if (date) {
      query = query.eq("production_date", date);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[daily-production] GET error:", error);
      return errorResponse("ไม่สามารถโหลด Production ได้", 500);
    }

    return NextResponse.json(
      {
        rows: data ?? [],
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("[daily-production] GET unexpected error:", error);
    return errorResponse("เกิดข้อผิดพลาดในการโหลดข้อมูล", 500);
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
