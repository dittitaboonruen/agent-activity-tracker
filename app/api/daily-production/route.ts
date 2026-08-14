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

  const aiaCase = Number(data.aiaCase ?? 0);
  const aiaFyp = Number(data.aiaFyp ?? 0);
  const aiaFyc = Number(data.aiaFyc ?? 0);

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

  const numberValues = [
    aiaCase,
    aiaFyp,
    aiaFyc,
    paCase,
    paFyp,
    paFyc,
  ];

  if (numberValues.some((v) => !Number.isFinite(v) || v < 0)) {
    return errorResponse("กรุณากรอกตัวเลขให้ถูกต้อง", 400);
  }

  if (!Number.isInteger(aiaCase) || !Number.isInteger(paCase)) {
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

          aia_case: aiaCase,
          aia_fyp: aiaFyp,
          aia_fyc: aiaFyc,

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
  const params = request.nextUrl.searchParams;

  const date = params.get("date")?.trim() || "";

  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from("daily_production")
      .select("*")
      .order("agent_name", { ascending: true });

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
