import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  DashboardAccessError,
  getDashboardAccess,
} from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

const MAX_MONEY_TARGET = 1_000_000_000_000;
const MAX_CASE_TARGET = 1_000_000;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

function normalizeIdentity(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("th-TH");
}

function normalizeAgentCode(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function isValidMoneyTarget(value: number) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_MONEY_TARGET
  );
}

function isValidCaseTarget(value: number) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_CASE_TARGET
  );
}

/*
  GET ?scope=agents
  Public safe list for the Annual Target form.

  GET ?agent=...&year=...
  Authenticated target data for the Activity Dashboard.
*/
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (params.get("scope") === "agents") {
    const rate = checkRateLimit(request);

    if (!rate.allowed) {
      return errorResponse(
        "กรุณารอสักครู่ก่อนลองใหม่อีกครั้ง",
        429
      );
    }

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("agent_master")
        .select("id, agent_name")
        .eq("active", true)
        .order("agent_name", { ascending: true });

      if (error) {
        console.error("[annual-target] public agent list error:", error);
        return errorResponse("ไม่สามารถโหลดรายชื่อตัวแทนได้", 500);
      }

      return NextResponse.json(
        { agents: data ?? [] },
        { headers: NO_STORE_HEADERS }
      );
    } catch (error) {
      console.error(
        "[annual-target] public agent list unexpected error:",
        error
      );
      return errorResponse(
        "เกิดข้อผิดพลาดในการโหลดรายชื่อตัวแทน",
        500
      );
    }
  }

  const agent = params.get("agent")?.trim() || "";
  const year = Number(params.get("year"));

  if (!Number.isInteger(year) || year < 2025 || year > 2100) {
    return errorResponse("ปีไม่ถูกต้อง", 400);
  }

  try {
    const access = await getDashboardAccess("activity");
    const normalizedAgent = normalizeIdentity(agent);

    if (
      normalizedAgent &&
      !access.canSeeAll &&
      !access.agentNames.has(normalizedAgent)
    ) {
      return errorResponse("คุณไม่มีสิทธิ์ดูข้อมูลตัวแทนคนนี้", 403);
    }

    const supabase = getSupabaseClient();
    const [targetsResult, agentsResult] = await Promise.all([
      supabase
        .from("agent_targets")
        .select(
          "id, agent_id, agent_name, target_year, target_fyp, target_fyc, target_case"
        )
        .eq("target_year", year)
        .order("agent_name", { ascending: true }),
      supabase
        .from("agent_master")
        .select("id, agent_name, jotform_agent_name")
        .eq("active", true),
    ]);

    if (targetsResult.error) {
      console.error("[annual-target] GET targets error:", targetsResult.error);
      return errorResponse("ไม่สามารถโหลดข้อมูลเป้าหมายได้", 500);
    }

    if (agentsResult.error) {
      console.error("[annual-target] GET agents error:", agentsResult.error);
      return errorResponse("ไม่สามารถตรวจสอบรายชื่อตัวแทนได้", 500);
    }

    const targets = targetsResult.data ?? [];
    const agents = agentsResult.data ?? [];

    if (normalizedAgent) {
      const matchedAgent = agents.find(
        (item) =>
          normalizeIdentity(item.agent_name) === normalizedAgent ||
          normalizeIdentity(item.jotform_agent_name) === normalizedAgent
      );

      const target =
        targets.find(
          (item) =>
            (matchedAgent && item.agent_id === matchedAgent.id) ||
            normalizeIdentity(item.agent_name) === normalizedAgent ||
            (matchedAgent &&
              normalizeIdentity(item.agent_name) ===
                normalizeIdentity(matchedAgent.agent_name))
        ) ?? null;

      return NextResponse.json(
        { target },
        { headers: NO_STORE_HEADERS }
      );
    }

    const allowedTargets = access.canSeeAll
      ? targets
      : targets.filter((item) =>
          access.agentNames.has(normalizeIdentity(item.agent_name))
        );

    return NextResponse.json(
      { targets: allowedTargets },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof DashboardAccessError) {
      return errorResponse(error.message, error.status);
    }

    console.error("[annual-target] GET unexpected error:", error);
    return errorResponse("เกิดข้อผิดพลาดในการโหลดข้อมูล", 500);
  }
}

/* Public one-time Annual Target submission. */
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
  const agentId = Number(data.agentId);
  const agentCode =
    typeof data.agentCode === "string"
      ? normalizeAgentCode(data.agentCode)
      : "";
  const targetYear = Number(data.targetYear);
  const targetFyp = Number(data.targetFyp);
  const targetFyc = Number(data.targetFyc);
  const targetCase = Number(data.targetCase);

  if (!Number.isSafeInteger(agentId) || agentId <= 0) {
    return errorResponse("กรุณาเลือกชื่อตัวแทน", 400);
  }

  if (!agentCode) {
    return errorResponse("กรุณากรอก Agent Code", 400);
  }

  if (
    !Number.isInteger(targetYear) ||
    targetYear < 2025 ||
    targetYear > 2100
  ) {
    return errorResponse("ปีเป้าหมายไม่ถูกต้อง", 400);
  }

  if (
    !isValidMoneyTarget(targetFyp) ||
    !isValidMoneyTarget(targetFyc) ||
    !isValidCaseTarget(targetCase)
  ) {
    return errorResponse("กรุณากรอกเป้าหมายเป็นจำนวนเต็มที่ถูกต้อง", 400);
  }

  try {
    const supabase = getSupabaseClient();

    const { data: agent, error: agentError } = await supabase
      .from("agent_master")
      .select("id, agent_code, agent_name, active")
      .eq("id", agentId)
      .eq("active", true)
      .maybeSingle();

    if (agentError) {
      console.error("[annual-target] agent lookup error:", agentError);
      return errorResponse("ไม่สามารถตรวจสอบข้อมูลตัวแทนได้", 500);
    }

    if (!agent) {
      return errorResponse(
        "ไม่พบตัวแทนที่เลือก หรือบัญชีไม่ได้ใช้งานแล้ว",
        404
      );
    }

    const savedAgentCode = normalizeAgentCode(agent.agent_code);

    if (!savedAgentCode) {
      return errorResponse(
        "ตัวแทนคนนี้ยังไม่มี Agent Code กรุณาติดต่อผู้ดูแลระบบ",
        409
      );
    }

    if (savedAgentCode !== agentCode) {
      return errorResponse("Agent Code ไม่ตรงกับชื่อที่เลือก", 403);
    }

    const { data: existingTargets, error: existingError } = await supabase
      .from("agent_targets")
      .select("id, agent_id, agent_name")
      .eq("target_year", targetYear);

    if (existingError) {
      console.error("[annual-target] duplicate check error:", existingError);
      return errorResponse("ไม่สามารถตรวจสอบข้อมูลเป้าหมายเดิมได้", 500);
    }

    const hasExistingTarget = (existingTargets ?? []).some(
      (item) =>
        item.agent_id === agent.id ||
        normalizeIdentity(item.agent_name) === normalizeIdentity(agent.agent_name)
    );

    if (hasExistingTarget) {
      return errorResponse(
        `มี Annual Target ปี ${targetYear + 543} ของตัวแทนคนนี้แล้ว หากต้องการแก้ไขกรุณาติดต่อผู้ดูแลระบบ`,
        409
      );
    }

    const { data: savedTarget, error } = await supabase
      .from("agent_targets")
      .insert({
        agent_id: agent.id,
        agent_name: agent.agent_name,
        target_year: targetYear,
        target_fyp: targetFyp,
        target_fyc: targetFyc,
        target_case: targetCase,
        updated_at: new Date().toISOString(),
      })
      .select(
        "id, agent_id, agent_name, target_year, target_fyp, target_fyc, target_case"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return errorResponse(
          `มี Annual Target ปี ${targetYear + 543} ของตัวแทนคนนี้แล้ว`,
          409
        );
      }

      console.error("[annual-target] INSERT error:", error);
      return errorResponse("ไม่สามารถบันทึกเป้าหมายได้", 500);
    }

    return NextResponse.json(
      { success: true, target: savedTarget },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[annual-target] POST unexpected error:", error);
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
