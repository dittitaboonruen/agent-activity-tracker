import "server-only";

import type {
  Submission,
} from "@/types";

import {
  createClient,
} from "@/lib/supabase/server";

export type DashboardRole =
  | "admin"
  | "manager";

export type DashboardArea =
  | "activity"
  | "monthly-performance";

export interface DashboardAccess {
  userId: string;
  role: DashboardRole;
  unitId: number | null;
  canSeeAll: boolean;
  agentNames: Set<string>;
  agentCodes: Set<string>;
}

export class DashboardAccessError extends Error {
  status: number;

  constructor(
    message: string,
    status: number
  ) {
    super(message);

    this.name =
      "DashboardAccessError";

    this.status = status;
  }
}

function normalizeIdentity(
  value:
    | string
    | null
    | undefined
) {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase(
      "th-TH"
    );
}

export async function getDashboardAccess(
  area: DashboardArea =
    "activity"
): Promise<DashboardAccess> {
  const supabase =
    createClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError || !user) {
    throw new DashboardAccessError(
      "กรุณาเข้าสู่ระบบใหม่",
      401
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("user_profiles")
    .select(`
      role,
      active,
      unit_id,
      can_view_activity_dashboard,
      can_view_monthly_performance,
      can_view_all_data
    `)
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "[dashboard-access] profile error:",
      profileError
    );

    throw new DashboardAccessError(
      "ไม่สามารถตรวจสอบสิทธิ์ผู้ใช้งานได้",
      500
    );
  }

  if (
    !profile ||
    profile.active !== true
  ) {
    throw new DashboardAccessError(
      "บัญชีนี้ยังไม่ได้รับอนุญาต",
      403
    );
  }

  const role = String(
    profile.role ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    role !== "admin" &&
    role !== "manager"
  ) {
    throw new DashboardAccessError(
      "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน",
      403
    );
  }

  const unitId =
    typeof profile.unit_id ===
      "number"
      ? profile.unit_id
      : null;

  /*
    MONTHLY PERFORMANCE

    ผู้ที่ได้รับสิทธิ์
    จะเห็นข้อมูลทั้งหมด
  */

  if (
    area ===
    "monthly-performance"
  ) {
    if (
      profile
        .can_view_monthly_performance !==
      true
    ) {
      throw new DashboardAccessError(
        "บัญชีนี้ไม่มีสิทธิ์ดู Monthly Performance",
        403
      );
    }

    return {
      userId: user.id,
      role:
        role as DashboardRole,
      unitId,
      canSeeAll: true,
      agentNames:
        new Set<string>(),
      agentCodes:
        new Set<string>(),
    };
  }

  /*
    ACTIVITY DASHBOARD
  */

  if (
    profile
      .can_view_activity_dashboard !==
    true
  ) {
    throw new DashboardAccessError(
      "บัญชีนี้ไม่มีสิทธิ์ดู Activity Dashboard",
      403
    );
  }

  /*
    Training หรือผู้ที่ได้รับ
    can_view_all_data
    เห็นทุกหน่วย
  */

  if (
    profile.can_view_all_data ===
    true
  ) {
    return {
      userId: user.id,
      role:
        role as DashboardRole,
      unitId,
      canSeeAll: true,
      agentNames:
        new Set<string>(),
      agentCodes:
        new Set<string>(),
    };
  }

  /*
    Manager ทั่วไป
    ต้องมีหน่วยก่อน
  */

  if (unitId === null) {
    throw new DashboardAccessError(
      "บัญชีนี้ยังไม่ได้กำหนดหน่วย",
      403
    );
  }

  /*
    โหลดตัวแทนทั้งหมด
    ที่อยู่ในหน่วยเดียวกับผู้ใช้
  */

  const {
    data: agents,
    error: agentsError,
  } = await supabase
    .from("agent_master")
    .select(`
      agent_code,
      agent_name,
      jotform_agent_name
    `)
    .eq("active", true)
    .eq("unit_id", unitId);

  if (agentsError) {
    console.error(
      "[dashboard-access] agents error:",
      agentsError
    );

    throw new DashboardAccessError(
      "ไม่สามารถโหลดตัวแทนในหน่วยได้",
      500
    );
  }

  const agentNames =
    new Set<string>(
      (agents ?? [])
        .flatMap((agent) => [
          agent.agent_name,
          agent.jotform_agent_name,
        ])
        .map((value) =>
          normalizeIdentity(
            value
          )
        )
        .filter(Boolean)
    );

  const agentCodes =
    new Set<string>(
      (agents ?? [])
        .map((agent) =>
          normalizeIdentity(
            agent.agent_code
          )
        )
        .filter(Boolean)
    );

  return {
    userId: user.id,
    role:
      role as DashboardRole,
    unitId,
    canSeeAll: false,
    agentNames,
    agentCodes,
  };
}

export function filterSubmissionsForAccess(
  submissions: Submission[],
  access: DashboardAccess
) {
  if (access.canSeeAll) {
    return submissions;
  }

  return submissions.filter(
    (submission) =>
      access.agentNames.has(
        normalizeIdentity(
          submission.agent
        )
      )
  );
}
