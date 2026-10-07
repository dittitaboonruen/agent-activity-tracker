import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseClient } from "@/lib/supabase";
import { getSkoolAccess } from "@/lib/skool-access";
import { LearningFilterError, readLearningAgentId } from "@/lib/learning-filter";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

type ProgressStatus = "not_started" | "in_progress" | "completed";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getStatus(
  progressPercent: number,
  started: boolean,
  completed: boolean
): ProgressStatus {
  if (completed || progressPercent >= 100) {
    return "completed";
  }

  if (started || progressPercent > 0) {
    return "in_progress";
  }

  return "not_started";
}

export async function GET(request: NextRequest) {
  const access = await getSkoolAccess();

  if (!access.allowed) {
    return errorResponse(access.message, access.status);
  }

  try {
    const selectedAgentId = readLearningAgentId(request?.url);
    const supabase = getSupabaseClient();

    let agentsQuery = supabase
      .from("agent_master")
      .select("id, agent_code, agent_name, agent_nickname, unit_id")
      .eq("active", true)
      .order("agent_name", { ascending: true });

    if (!access.canSeeAll && access.unitId !== null) {
      agentsQuery = agentsQuery.eq("unit_id", access.unitId);
    }
    if (selectedAgentId !== null) agentsQuery = agentsQuery.eq("id", selectedAgentId);

    const { data: agents, error: agentsError } = await agentsQuery;

    if (agentsError) {
      console.error("[skool-progress] agents error:", agentsError);
      return errorResponse("ไม่สามารถโหลดรายชื่อตัวแทนได้", 500);
    }

    const agentRows = agents ?? [];
    if (selectedAgentId !== null && agentRows.length === 0) {
      return errorResponse("ไม่พบตัวแทนที่เลือกในข้อมูลที่คุณมีสิทธิ์ดู", 404);
    }
    const agentIds = agentRows.map((agent) => agent.id);
    const unitIds = Array.from(
      new Set(
        agentRows
          .map((agent) => agent.unit_id)
          .filter((unitId): unitId is number => typeof unitId === "number")
      )
    );

    if (agentIds.length === 0) {
      return NextResponse.json(
        {
          success: true,
          scope: {
            canSeeAll: access.canSeeAll,
            unitId: access.unitId,
            unitName: null,
          },
          summary: {
            linkedAgents: 0,
            courses: 0,
            records: 0,
            completed: 0,
            inProgress: 0,
            notStarted: 0,
            averageProgress: 0,
            syncedAt: null,
          },
          rows: [],
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const [membersResult, unitsResult] = await Promise.all([
      supabase
        .from("skool_members")
        .select(
          "id, agent_id, first_name, last_name, skool_profile_url, last_active_at, active"
        )
        .in("agent_id", agentIds),
      unitIds.length > 0
        ? supabase
            .from("units")
            .select("id, unit_code, unit_name")
            .in("id", unitIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (membersResult.error) {
      console.error("[skool-progress] members error:", membersResult.error);
      return errorResponse("ไม่สามารถโหลดสมาชิก Skool ได้", 500);
    }

    if (unitsResult.error) {
      console.error("[skool-progress] units error:", unitsResult.error);
      return errorResponse("ไม่สามารถโหลดข้อมูลหน่วยได้", 500);
    }

    const members = membersResult.data ?? [];
    const memberIds = members.map((member) => member.id);

    if (memberIds.length === 0) {
      const selectedUnit = (unitsResult.data ?? []).find(
        (unit) => unit.id === access.unitId
      );

      return NextResponse.json(
        {
          success: true,
          scope: {
            canSeeAll: access.canSeeAll,
            unitId: access.unitId,
            unitName: selectedUnit?.unit_name ?? null,
          },
          summary: {
            linkedAgents: 0,
            courses: 0,
            records: 0,
            completed: 0,
            inProgress: 0,
            notStarted: 0,
            averageProgress: 0,
            syncedAt: null,
          },
          rows: [],
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const { data: progressRows, error: progressError } = await supabase
      .from("learning_course_progress")
      .select(
        "skool_member_id, course_id, has_access, progress_percent, started, completed, synced_at"
      )
      .in("skool_member_id", memberIds);

    if (progressError) {
      console.error("[skool-progress] progress error:", progressError);
      return errorResponse("ไม่สามารถโหลดความคืบหน้าการเรียนได้", 500);
    }

    const courseIds = Array.from(
      new Set((progressRows ?? []).map((progress) => progress.course_id))
    );

    const { data: courses, error: coursesError } =
      courseIds.length > 0
        ? await supabase
            .from("learning_courses")
            .select("id, course_name")
            .in("id", courseIds)
        : { data: [], error: null };

    if (coursesError) {
      console.error("[skool-progress] courses error:", coursesError);
      return errorResponse("ไม่สามารถโหลดข้อมูลคอร์สได้", 500);
    }

    const agentById = new Map(agentRows.map((agent) => [agent.id, agent]));
    const memberById = new Map(members.map((member) => [member.id, member]));
    const unitById = new Map(
      (unitsResult.data ?? []).map((unit) => [unit.id, unit])
    );
    const courseById = new Map(
      (courses ?? []).map((course) => [course.id, course])
    );

    const rows = (progressRows ?? [])
      .map((progress) => {
        const member = memberById.get(progress.skool_member_id);
        const agent = member ? agentById.get(member.agent_id) : undefined;
        const course = courseById.get(progress.course_id);

        if (!member || !agent || !course) {
          return null;
        }

        const unit = unitById.get(agent.unit_id);
        const progressPercent = Math.min(
          100,
          Math.max(0, toNumber(progress.progress_percent))
        );
        const started = progress.started === true;
        const completed = progress.completed === true;

        return {
          agentId: agent.id,
          agentCode: agent.agent_code ?? "",
          agentName: agent.agent_name ?? "",
          agentNickname: agent.agent_nickname ?? "",
          unitId: agent.unit_id ?? null,
          unitCode: unit?.unit_code ?? "",
          unitName: unit?.unit_name ?? "ไม่ระบุหน่วย",
          skoolMemberId: member.id,
          skoolName: [member.first_name, member.last_name]
            .filter(Boolean)
            .join(" "),
          skoolProfileUrl: member.skool_profile_url ?? "",
          memberActive: member.active === true,
          lastActiveAt: member.last_active_at ?? null,
          courseId: course.id,
          courseName: course.course_name ?? "",
          hasAccess: progress.has_access === true,
          progressPercent,
          status: getStatus(progressPercent, started, completed),
          syncedAt: progress.synced_at ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((left, right) => {
        const unitOrder = left.unitName.localeCompare(right.unitName, "th");
        if (unitOrder !== 0) return unitOrder;

        const agentOrder = left.agentName.localeCompare(right.agentName, "th");
        if (agentOrder !== 0) return agentOrder;

        return left.courseName.localeCompare(right.courseName, "th");
      });

    const linkedAgents = new Set(rows.map((row) => row.agentId)).size;
    const completed = rows.filter((row) => row.status === "completed").length;
    const inProgress = rows.filter(
      (row) => row.status === "in_progress"
    ).length;
    const notStarted = rows.filter(
      (row) => row.status === "not_started"
    ).length;
    const averageProgress =
      rows.length > 0
        ? Math.round(
            rows.reduce((sum, row) => sum + row.progressPercent, 0) /
              rows.length
          )
        : 0;
    const syncedAt = rows.reduce<string | null>((latest, row) => {
      if (!row.syncedAt) return latest;
      if (!latest || row.syncedAt > latest) return row.syncedAt;
      return latest;
    }, null);
    const selectedUnit = (unitsResult.data ?? []).find(
      (unit) => unit.id === access.unitId
    );

    return NextResponse.json(
      {
        success: true,
        scope: {
          canSeeAll: access.canSeeAll,
          unitId: access.unitId,
          unitName: selectedUnit?.unit_name ?? null,
        },
        summary: {
          linkedAgents,
          courses: new Set(rows.map((row) => row.courseId)).size,
          records: rows.length,
          completed,
          inProgress,
          notStarted,
          averageProgress,
          syncedAt,
        },
        rows,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof LearningFilterError) return errorResponse(error.message, 400);
    console.error("[skool-progress] unexpected error:", error);
    return errorResponse("เกิดข้อผิดพลาดในการโหลด Skool Dashboard", 500);
  }
}

export async function POST() {
  return errorResponse("Method not allowed.", 405);
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
