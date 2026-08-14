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

/* GET AGENTS */
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("agent_master")
      .select("*")
      .eq("active", true)
      .order("agent_name", { ascending: true });

    if (error) {
      console.error("[agent-master] GET error:", error);

      return errorResponse(
        "ไม่สามารถโหลดรายชื่อตัวแทนได้",
        500
      );
    }

    return NextResponse.json(
      {
        agents: data ?? [],
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("[agent-master] GET unexpected error:", error);

    return errorResponse(
      "เกิดข้อผิดพลาดในการโหลดรายชื่อตัวแทน",
      500
    );
  }
}

/* ADD / UPDATE AGENT */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request);

  if (!rate.allowed) {
    return errorResponse(
      "กรุณารอสักครู่ก่อนลองใหม่อีกครั้ง",
      429
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "ข้อมูลที่ส่งมาไม่ถูกต้อง",
      400
    );
  }

  if (typeof body !== "object" || body === null) {
    return errorResponse(
      "ข้อมูลที่ส่งมาไม่ถูกต้อง",
      400
    );
  }

  const data = body as Record<string, unknown>;

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

  const active =
    typeof data.active === "boolean"
      ? data.active
      : true;

  if (!agentName) {
    return errorResponse(
      "กรุณาระบุชื่อตัวแทน",
      400
    );
  }

  try {
    const supabase = getSupabaseClient();

    let query;

    if (agentCode) {
      query = supabase
        .from("agent_master")
        .upsert(
          {
            agent_code: agentCode,
            agent_name: agentName,
            agent_nickname: agentNickname || null,
            active,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "agent_code",
          }
        )
        .select()
        .single();
    } else {
      query = supabase
        .from("agent_master")
        .insert({
          agent_code: null,
          agent_name: agentName,
          agent_nickname: agentNickname || null,
          active,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
    }

    const { data: saved, error } = await query;

    if (error) {
      console.error("[agent-master] POST error:", error);

      return errorResponse(
        "ไม่สามารถบันทึกตัวแทนได้",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        agent: saved,
      },
      {
        status: 201,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("[agent-master] POST unexpected error:", error);

    return errorResponse(
      "เกิดข้อผิดพลาดในการบันทึกตัวแทน",
      500
    );
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
