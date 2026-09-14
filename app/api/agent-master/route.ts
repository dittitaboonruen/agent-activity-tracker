import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

type Access =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      role: "manager" | "admin";
    }
  | {
      ok: false;
      response: NextResponse;
    };

async function getAccess(): Promise<Access> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: errorResponse("กรุณาเข้าสู่ระบบ", 401),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[agent-master] profile query failed");

    return {
      ok: false,
      response: errorResponse("ไม่สามารถตรวจสอบสิทธิ์ได้", 500),
    };
  }

  if (
    !profile ||
    profile.active !== true ||
    (profile.role !== "manager" && profile.role !== "admin")
  ) {
    return {
      ok: false,
      response: errorResponse("คุณไม่มีสิทธิ์ใช้งานส่วนนี้", 403),
    };
  }

  return {
    ok: true,
    supabase,
    role: profile.role,
  };
}

/*
 * ทะเบียนกลาง:
 * Manager และ Admin ที่ active อ่านตัวแทนทุกคนที่ active ได้
 * ไม่ใช้ manager_user_id กรองใน endpoint นี้
 */
export async function GET() {
  try {
    const access = await getAccess();

    if (!access.ok) {
      return access.response;
    }

    const { data, error } = await access.supabase
      .from("agent_master")
      .select("*")
      .eq("active", true)
      .order("agent_name", { ascending: true });

    if (error) {
      console.error("[agent-master] GET query failed");

      return errorResponse(
        "ไม่สามารถโหลดรายชื่อตัวแทนได้",
        500
      );
    }

    return NextResponse.json(
      { agents: data ?? [] },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    console.error("[agent-master] GET unexpected error");

    return errorResponse(
      "เกิดข้อผิดพลาดในการโหลดรายชื่อตัวแทน",
      500
    );
  }
}

/* เพิ่ม / แก้ทะเบียน: เฉพาะ Admin ที่ active */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request);

  if (!rate.allowed) {
    return errorResponse(
      "กรุณารอสักครู่ก่อนลองใหม่อีกครั้ง",
      429
    );
  }

  try {
    const access = await getAccess();

    if (!access.ok) {
      return access.response;
    }

    if (access.role !== "admin") {
      return errorResponse(
        "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการทะเบียนตัวแทนได้",
        403
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("ข้อมูลที่ส่งมาไม่ถูกต้อง", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return errorResponse("ข้อมูลที่ส่งมาไม่ถูกต้อง", 400);
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
      return errorResponse("กรุณาระบุชื่อตัวแทน", 400);
    }

    if (
      agentCode.length > 100 ||
      agentName.length > 200 ||
      agentNickname.length > 200
    ) {
      return errorResponse("ข้อมูลยาวเกินกำหนด", 400);
    }

    // ใช้ Secret Key เฉพาะงานเขียน หลังตรวจสิทธิ์ Admin แล้ว
    const supabase = getSupabaseClient();

    const payload = {
      agent_code: agentCode || null,
      agent_name: agentName,
      agent_nickname: agentNickname || null,
      active,
      updated_at: new Date().toISOString(),
    };

    const query = agentCode
      ? supabase
          .from("agent_master")
          .upsert(payload, { onConflict: "agent_code" })
      : supabase
          .from("agent_master")
          .insert(payload);

    const { data: saved, error } = await query
      .select()
      .single();

    if (error) {
      console.error("[agent-master] POST query failed");

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
  } catch {
    console.error("[agent-master] POST unexpected error");

    return errorResponse(
      "เกิดข้อผิดพลาดในการบันทึกตัวแทน",
      500
    );
  }
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed." },
    {
      status: 405,
      headers: {
        ...NO_STORE_HEADERS,
        Allow: "GET, POST",
      },
    }
  );
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}

export async function OPTIONS() {
  return methodNotAllowed();
}
