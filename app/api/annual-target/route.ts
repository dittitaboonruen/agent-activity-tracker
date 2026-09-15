import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
}

/* =========================
   AGENT MASTER RESOLVER
========================= */

async function resolveAgentByName(
  supabase: ReturnType<typeof getSupabaseClient>,
  agentName: string
) {
  const { data, error } = await supabase
    .from("agent_master")
    .select("id, agent_name, agent_code")
    .eq("agent_name", agentName)
    .limit(2);

  if (error) {
    console.error(
      "[annual-target] Agent lookup error:",
      error
    );

    return {
      agent: null,
      error: "ไม่สามารถตรวจสอบข้อมูลตัวแทนได้",
      status: 500,
    };
  }

  if (!data || data.length === 0) {
    return {
      agent: null,
      error:
        "ไม่พบชื่อตัวแทนใน Agent Master กรุณาตรวจสอบชื่อให้ตรงกับข้อมูลในระบบ",
      status: 404,
    };
  }

  if (data.length > 1) {
    return {
      agent: null,
      error:
        "พบชื่อตัวแทนซ้ำใน Agent Master กรุณาติดต่อผู้ดูแลระบบ",
      status: 409,
    };
  }

  return {
    agent: data[0],
    error: null,
    status: 200,
  };
}

/* =========================
   GET TARGET
========================= */

export async function GET(
  request: NextRequest
) {
  const params =
    request.nextUrl.searchParams;

  const agent =
    params.get("agent")?.trim() || "";

  const year = Number(
    params.get("year")
  );

  if (!Number.isInteger(year)) {
    return errorResponse(
      "ปีไม่ถูกต้อง",
      400
    );
  }

  try {
    const supabase =
      getSupabaseClient();

    /*
     * ถ้าไม่ได้ระบุ Agent
     * โหลด Target ทั้งหมดของปีนั้น
     */
    if (!agent) {
      const {
        data,
        error,
      } = await supabase
        .from("agent_targets")
        .select("*")
        .eq("target_year", year)
        .order(
          "agent_name",
          { ascending: true }
        );

      if (error) {
        console.error(
          "[annual-target] GET all error:",
          error
        );

        return errorResponse(
          "ไม่สามารถโหลดข้อมูลเป้าหมายได้",
          500
        );
      }

      return NextResponse.json(
        {
          targets:
            data ?? [],
        },
        {
          headers:
            NO_STORE_HEADERS,
        }
      );
    }

    /*
     * ถ้าระบุ Agent
     * resolve Agent Master ก่อน
     */
    const resolved =
      await resolveAgentByName(
        supabase,
        agent
      );

    if (!resolved.agent) {
      /*
       * สำหรับ GET:
       * ถ้าชื่อยังไม่อยู่ใน Master
       * ส่ง target = null
       * เพื่อให้หน้าเว็บไม่พัง
       */
      if (resolved.status === 404) {
        return NextResponse.json(
          {
            target: null,
            agentFound: false,
          },
          {
            headers:
              NO_STORE_HEADERS,
          }
        );
      }

      return errorResponse(
        resolved.error ||
          "ไม่สามารถตรวจสอบตัวแทนได้",
        resolved.status
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("agent_targets")
      .select("*")
      .eq(
        "agent_id",
        resolved.agent.id
      )
      .eq(
        "target_year",
        year
      )
      .limit(1);

    if (error) {
      console.error(
        "[annual-target] GET target error:",
        error
      );

      return errorResponse(
        "ไม่สามารถโหลดข้อมูลเป้าหมายได้",
        500
      );
    }

    return NextResponse.json(
      {
        target:
          data?.[0] ?? null,

        agentFound: true,

        agent: {
          id:
            resolved.agent.id,
          agent_name:
            resolved.agent.agent_name,
          agent_code:
            resolved.agent.agent_code,
        },
      },
      {
        headers:
          NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      "[annual-target] GET unexpected error:",
      error
    );

    return errorResponse(
      "เกิดข้อผิดพลาดในการโหลดข้อมูล",
      500
    );
  }
}

/* =========================
   SAVE TARGET
========================= */

export async function POST(
  request: NextRequest
) {
  const rate =
    checkRateLimit(request);

  if (!rate.allowed) {
    return errorResponse(
      "กรุณารอสักครู่ก่อนลองใหม่อีกครั้ง",
      429
    );
  }

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return errorResponse(
      "ข้อมูลที่ส่งมาไม่ถูกต้อง",
      400
    );
  }

  if (
    typeof body !== "object" ||
    body === null
  ) {
    return errorResponse(
      "ข้อมูลที่ส่งมาไม่ถูกต้อง",
      400
    );
  }

  const data =
    body as Record<
      string,
      unknown
    >;

  const agentName =
    typeof data.agentName ===
    "string"
      ? data.agentName.trim()
      : "";

  const targetYear =
    Number(data.targetYear);

  const targetFyp =
    Number(data.targetFyp);

  const targetFyc =
    Number(data.targetFyc);

  const targetCase =
    Number(data.targetCase);

  if (!agentName) {
    return errorResponse(
      "กรุณาระบุชื่อตัวแทน",
      400
    );
  }

  if (
    !Number.isInteger(
      targetYear
    ) ||
    targetYear < 2025 ||
    targetYear > 2100
  ) {
    return errorResponse(
      "ปีเป้าหมายไม่ถูกต้อง",
      400
    );
  }

  if (
    !Number.isFinite(
      targetFyp
    ) ||
    !Number.isFinite(
      targetFyc
    ) ||
    !Number.isInteger(
      targetCase
    ) ||
    targetFyp < 0 ||
    targetFyc < 0 ||
    targetCase < 0
  ) {
    return errorResponse(
      "กรุณากรอกเป้าหมายให้ถูกต้อง",
      400
    );
  }

  try {
    const supabase =
      getSupabaseClient();

    /*
     * ตรวจว่าตัวแทนมีอยู่จริง
     * ใน Agent Master
     */
    const resolved =
      await resolveAgentByName(
        supabase,
        agentName
      );

    if (!resolved.agent) {
      return errorResponse(
        resolved.error ||
          "ไม่พบข้อมูลตัวแทน",
        resolved.status
      );
    }

    /*
     * ใช้ชื่อจาก Agent Master
     * เป็นชื่อมาตรฐานเสมอ
     */
    const canonicalAgentName =
      resolved.agent.agent_name;

    const agentId =
      resolved.agent.id;

    const {
      data:
        savedTarget,
      error,
    } = await supabase
      .from("agent_targets")
      .upsert(
        {
          agent_id:
            agentId,

          agent_name:
            canonicalAgentName,

          target_year:
            targetYear,

          target_fyp:
            targetFyp,

          target_fyc:
            targetFyc,

          target_case:
            targetCase,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "agent_name,target_year",
        }
      )
      .select()
      .single();

    if (error) {
      console.error(
        "[annual-target] Supabase save error:",
        error
      );

      return errorResponse(
        "ไม่สามารถบันทึกเป้าหมายได้",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,

        target:
          savedTarget,

        agent: {
          id:
            agentId,
          agent_name:
            canonicalAgentName,
          agent_code:
            resolved.agent.agent_code,
        },
      },
      {
        status: 201,
        headers:
          NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      "[annual-target] Unexpected save error:",
      error
    );

    return errorResponse(
      "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
      500
    );
  }
}

/* =========================
   DELETE TARGET
========================= */

export async function DELETE(
  request: NextRequest
) {
  const rate =
    checkRateLimit(request);

  if (!rate.allowed) {
    return errorResponse(
      "กรุณารอสักครู่ก่อนลองใหม่อีกครั้ง",
      429
    );
  }

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return errorResponse(
      "ข้อมูลที่ส่งมาไม่ถูกต้อง",
      400
    );
  }

  if (
    typeof body !== "object" ||
    body === null
  ) {
    return errorResponse(
      "ข้อมูลที่ส่งมาไม่ถูกต้อง",
      400
    );
  }

  const data =
    body as Record<
      string,
      unknown
    >;

  const agentName =
    typeof data.agentName ===
    "string"
      ? data.agentName.trim()
      : "";

  const targetYear =
    Number(data.targetYear);

  if (!agentName) {
    return errorResponse(
      "กรุณาระบุชื่อตัวแทน",
      400
    );
  }

  if (
    !Number.isInteger(
      targetYear
    )
  ) {
    return errorResponse(
      "ปีเป้าหมายไม่ถูกต้อง",
      400
    );
  }

  try {
    const supabase =
      getSupabaseClient();

    /*
     * resolve Agent Master ก่อน
     * เพื่อไม่ลบด้วยชื่ออย่างเดียว
     */
    const resolved =
      await resolveAgentByName(
        supabase,
        agentName
      );

    if (!resolved.agent) {
      return errorResponse(
        resolved.error ||
          "ไม่พบข้อมูลตัวแทน",
        resolved.status
      );
    }

    const {
      data: deleted,
      error,
    } = await supabase
      .from("agent_targets")
      .delete()
      .eq(
        "agent_id",
        resolved.agent.id
      )
      .eq(
        "target_year",
        targetYear
      )
      .select();

    if (error) {
      console.error(
        "[annual-target] DELETE error:",
        error
      );

      return errorResponse(
        "ไม่สามารถลบ Annual Target ได้",
        500
      );
    }

    if (
      !deleted ||
      deleted.length === 0
    ) {
      return errorResponse(
        "ไม่พบ Annual Target ที่ต้องการลบ",
        404
      );
    }

    return NextResponse.json(
      {
        success: true,

        deletedCount:
          deleted.length,
      },
      {
        headers:
          NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      "[annual-target] DELETE unexpected error:",
      error
    );

    return errorResponse(
      "เกิดข้อผิดพลาดในการลบข้อมูล",
      500
    );
  }
}

/* =========================
   BLOCK OTHER METHODS
========================= */

export async function PUT() {
  return errorResponse(
    "Method not allowed.",
    405
  );
}

export async function PATCH() {
  return errorResponse(
    "Method not allowed.",
    405
  );
}
