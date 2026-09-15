import "server-only";

import type { Submission } from "@/types";
import { createClient } from "@/lib/supabase/server";

export type DashboardRole =
  | "admin"
  | "manager";

export interface DashboardAccess {
  userId: string;
  role: DashboardRole;
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
    this.status = status;
  }
}

function normalizeIdentity(
  value: string | null | undefined
) {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("th-TH");
}

export async function getDashboardAccess():
  Promise<DashboardAccess> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

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
    .select("role, active")
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

  if (!profile || profile.active !== true) {
    throw new DashboardAccessError(
      "บัญชีนี้ยังไม่ได้รับอนุญาต",
      403
    );
  }

  const role = String(
    profile.role ?? ""
  ).toLowerCase();

  if (
    role !== "admin" &&
    role !== "manager"
  ) {
    throw new DashboardAccessError(
      "บัญชีนี้ไม่มีสิทธิ์เข้าดู Dashboard",
      403
    );
  }

  if (role === "admin") {
    return {
      userId: user.id,
      role: "admin",
      canSeeAll: true,
      agentNames: new Set(),
      agentCodes: new Set(),
    };
  }

  const {
    data: agents,
    error: agentsError,
  } = await supabase
    .from("agent_master")
    .select("agent_code, agent_name")
    .eq("active", true)
    .eq("manager_user_id", user.id);

  if (agentsError) {
    console.error(
      "[dashboard-access] agents error:",
      agentsError
    );

    throw new DashboardAccessError(
      "ไม่สามารถตรวจสอบรายชื่อตัวแทนได้",
      500
    );
  }

  return {
    userId: user.id,
    role: "manager",
    canSeeAll: false,

    agentNames: new Set(
      (agents ?? [])
        .map((agent) =>
          normalizeIdentity(
            agent.agent_name
          )
        )
        .filter(Boolean)
    ),

    agentCodes: new Set(
      (agents ?? [])
        .map((agent) =>
          normalizeIdentity(
            agent.agent_code
          )
        )
        .filter(Boolean)
    ),
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
