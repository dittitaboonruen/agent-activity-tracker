import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getSupabaseClient,
} from "@/lib/supabase";

import {
  checkRateLimit,
} from "@/lib/rate-limit";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0",
};

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
      headers:
        NO_STORE_HEADERS,
    }
  );
}

type Access =
  | {
      ok: true;
      userId: string;
      role:
        | "manager"
        | "admin";
      canManage: boolean;
    }
  | {
      ok: false;
      response: NextResponse;
    };

async function getAccess(): Promise<Access> {
  const supabase =
    createClient();

  const {
    data: { user },
    error: authError,
  } =
    await supabase.auth.getUser();

  if (
    authError ||
    !user
  ) {
    return {
      ok: false,
      response:
        errorResponse(
          "กรุณาเข้าสู่ระบบ",
          401
        ),
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("user_profiles")
    .select(`
      role,
      active,
      can_manage_agent_master
    `)
    .eq(
      "user_id",
      user.id
    )
    .maybeSingle();

  if (profileError) {
    console.error(
      "[agent-master] profile query failed:",
      profileError
    );

    return {
      ok: false,
      response:
        errorResponse(
          "ไม่สามารถตรวจสอบสิทธิ์ได้",
          500
        ),
    };
  }

  if (
    !profile ||
    profile.active !== true ||
    (
      profile.role !==
        "manager" &&
      profile.role !==
        "admin"
    )
  ) {
    return {
      ok: false,
      response:
        errorResponse(
          "คุณไม่มีสิทธิ์ใช้งานส่วนนี้",
          403
        ),
    };
  }

  return {
    ok: true,
    userId: user.id,
    role: profile.role,
    canManage:
      profile
        .can_manage_agent_master ===
      true,
  };
}

/*
  GET AGENT MASTER

  Manager และ Admin ที่ active
  อ่านทะเบียนตัวแทนทั้งหมดได้

  ส่งกลับ:
  - agents
  - units
  - managers
  - canManage
*/

export async function GET() {
  try {
    const access =
      await getAccess();

    if (!access.ok) {
      return access.response;
    }

    /*
      ใช้ Secret Key หลังตรวจสอบ
      Login และสิทธิ์แล้วเท่านั้น
    */

    const supabase =
      getSupabaseClient();

    const [
      agentsResult,
      unitsResult,
      managersResult,
    ] = await Promise.all([
      supabase
        .from("agent_master")
        .select("*")
        .eq(
          "active",
          true
        )
        .order(
          "agent_name",
          {
            ascending: true,
          }
        ),

      supabase
        .from("units")
        .select(`
          id,
          unit_code,
          unit_name,
          active
        `)
        .eq(
          "active",
          true
        )
        .order(
          "unit_name",
          {
            ascending: true,
          }
        ),

      supabase
        .from("user_profiles")
        .select(`
          user_id,
          email,
          full_name,
          role,
          active,
          unit_id
        `)
        .eq(
          "active",
          true
        )
        .in(
          "role",
          [
            "manager",
            "admin",
          ]
        )
        .order(
          "full_name",
          {
            ascending: true,
          }
        ),
    ]);

    if (agentsResult.error) {
      console.error(
        "[agent-master] agents query failed:",
        agentsResult.error
      );

      return errorResponse(
        "ไม่สามารถโหลดรายชื่อตัวแทนได้",
        500
      );
    }

    if (unitsResult.error) {
      console.error(
        "[agent-master] units query failed:",
        unitsResult.error
      );

      return errorResponse(
        "ไม่สามารถโหลดรายชื่อหน่วยได้",
        500
      );
    }

    if (
      managersResult.error
    ) {
      console.error(
        "[agent-master] managers query failed:",
        managersResult.error
      );

      return errorResponse(
        "ไม่สามารถโหลดรายชื่อหัวหน้าได้",
        500
      );
    }

    return NextResponse.json(
      {
        agents:
          agentsResult.data ??
          [],

        units:
          unitsResult.data ??
          [],

        managers:
          managersResult.data ??
          [],

        canManage:
          access.canManage,
      },
      {
        headers:
          NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      "[agent-master] GET unexpected error:",
      error
    );

    return errorResponse(
      "เกิดข้อผิดพลาดในการโหลด Agent Master",
      500
    );
  }
}

/*
  ADD / UPDATE AGENT

  เฉพาะ NewAgent หรือบัญชีที่มี
  can_manage_agent_master = true
*/

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

  try {
    const access =
      await getAccess();

    if (!access.ok) {
      return access.response;
    }

    if (
      !access.canManage
    ) {
      return errorResponse(
        "เฉพาะ NewAgent เท่านั้นที่สามารถจัดการ Agent Master ได้",
        403
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
      typeof body !==
        "object" ||
      body === null ||
      Array.isArray(body)
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

    const agentCode =
      typeof data.agentCode ===
      "string"
        ? data.agentCode.trim()
        : "";

    const agentName =
      typeof data.agentName ===
      "string"
        ? data.agentName.trim()
        : "";

    const agentNickname =
      typeof data.agentNickname ===
      "string"
        ? data.agentNickname.trim()
        : "";

    const agentEmail =
      typeof data.agentEmail ===
      "string"
        ? data.agentEmail
            .trim()
            .toLowerCase()
        : "";

    const jotformAgentName =
      typeof data
        .jotformAgentName ===
      "string"
        ? data
            .jotformAgentName
            .trim()
        : "";

    const managerUserId =
      typeof data.managerUserId ===
      "string"
        ? data.managerUserId.trim()
        : "";

    const unitId =
      Number(data.unitId);

    const active =
      typeof data.active ===
      "boolean"
        ? data.active
        : true;

    if (!agentName) {
      return errorResponse(
        "กรุณาระบุชื่อตัวแทน",
        400
      );
    }

    if (
      !Number.isInteger(
        unitId
      ) ||
      unitId <= 0
    ) {
      return errorResponse(
        "กรุณาเลือกหน่วย",
        400
      );
    }

    if (
      !managerUserId ||
      !UUID_REGEX.test(
        managerUserId
      )
    ) {
      return errorResponse(
        "กรุณาเลือกหัวหน้าที่ดูแล",
        400
      );
    }

    if (
      agentEmail &&
      !EMAIL_REGEX.test(
        agentEmail
      )
    ) {
      return errorResponse(
        "รูปแบบอีเมลตัวแทนไม่ถูกต้อง",
        400
      );
    }

    if (
      agentCode.length >
        100 ||
      agentName.length >
        200 ||
      agentNickname.length >
        200 ||
      agentEmail.length >
        320 ||
      jotformAgentName.length >
        200
    ) {
      return errorResponse(
        "ข้อมูลยาวเกินกำหนด",
        400
      );
    }

    /*
      หลังตรวจสอบสิทธิ์แล้ว
      จึงใช้ Secret Key เขียนข้อมูล
    */

    const supabase =
      getSupabaseClient();

    const [
      unitResult,
      managerResult,
    ] = await Promise.all([
      supabase
        .from("units")
        .select(`
          id,
          unit_code,
          unit_name,
          active
        `)
        .eq(
          "id",
          unitId
        )
        .eq(
          "active",
          true
        )
        .maybeSingle(),

      supabase
        .from("user_profiles")
        .select(`
          user_id,
          email,
          role,
          active,
          unit_id
        `)
        .eq(
          "user_id",
          managerUserId
        )
        .eq(
          "active",
          true
        )
        .maybeSingle(),
    ]);

    if (
      unitResult.error
    ) {
      console.error(
        "[agent-master] unit validation failed:",
        unitResult.error
      );

      return errorResponse(
        "ไม่สามารถตรวจสอบหน่วยได้",
        500
      );
    }

    if (
      !unitResult.data
    ) {
      return errorResponse(
        "ไม่พบหน่วยที่เลือก",
        400
      );
    }

    if (
      managerResult.error
    ) {
      console.error(
        "[agent-master] manager validation failed:",
        managerResult.error
      );

      return errorResponse(
        "ไม่สามารถตรวจสอบหัวหน้าได้",
        500
      );
    }

    const manager =
      managerResult.data;

    if (
      !manager ||
      (
        manager.role !==
          "manager" &&
        manager.role !==
          "admin"
      )
    ) {
      return errorResponse(
        "ไม่พบบัญชีหัวหน้าที่เลือก",
        400
      );
    }

    if (
      manager.unit_id !==
      unitId
    ) {
      return errorResponse(
        "หัวหน้าที่เลือกไม่ได้อยู่ในหน่วยนี้",
        400
      );
    }

    /*
      ป้องกัน Agent Email ซ้ำ
      เพื่อใช้เป็น Key เชื่อม Skool
    */

    if (agentEmail) {
      const {
        data:
          existingEmail,
        error:
          emailCheckError,
      } = await supabase
        .from("agent_master")
        .select(`
          id,
          agent_code,
          agent_email
        `)
        .ilike(
          "agent_email",
          agentEmail
        )
        .maybeSingle();

      if (
        emailCheckError
      ) {
        console.error(
          "[agent-master] email check failed:",
          emailCheckError
        );

        return errorResponse(
          "ไม่สามารถตรวจสอบอีเมลตัวแทนได้",
          500
        );
      }

      if (
        existingEmail &&
        existingEmail
          .agent_code !==
          (
            agentCode ||
            null
          )
      ) {
        return errorResponse(
          "อีเมลนี้ถูกใช้กับตัวแทนคนอื่นแล้ว",
          409
        );
      }
    }

    const payload = {
      agent_code:
        agentCode || null,

      agent_name:
        agentName,

      agent_nickname:
        agentNickname ||
        null,

      agent_email:
        agentEmail ||
        null,

      jotform_agent_name:
        jotformAgentName ||
        null,

      unit_id:
        unitId,

      manager_user_id:
        managerUserId,

      active,

      updated_at:
        new Date()
          .toISOString(),
    };

    const query =
      agentCode
        ? supabase
            .from(
              "agent_master"
            )
            .upsert(
              payload,
              {
                onConflict:
                  "agent_code",
              }
            )
        : supabase
            .from(
              "agent_master"
            )
            .insert(
              payload
            );

    const {
      data: saved,
      error,
    } = await query
      .select()
      .single();

    if (error) {
      console.error(
        "[agent-master] POST query failed:",
        error
      );

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
        headers:
          NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      "[agent-master] POST unexpected error:",
      error
    );

    return errorResponse(
      "เกิดข้อผิดพลาดในการบันทึกตัวแทน",
      500
    );
  }
}

function methodNotAllowed() {
  return NextResponse.json(
    {
      error:
        "Method not allowed.",
    },
    {
      status: 405,
      headers: {
        ...NO_STORE_HEADERS,
        Allow:
          "GET, POST",
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
