import { createClient } from "@/lib/supabase/server";

type AccessResult =
  | {
      allowed: true;
      canSeeAll: boolean;
      unitId: number | null;
    }
  | {
      allowed: false;
      status: number;
      message: string;
    };

export async function getSkoolAccess(): Promise<AccessResult> {
  const authClient = createClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return {
      allowed: false,
      status: 401,
      message: "กรุณาเข้าสู่ระบบใหม่",
    };
  }

  const { data: profile, error: profileError } = await authClient
    .from("user_profiles")
    .select("role, active, unit_id, can_view_all_data")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[skool-access] profile error:", profileError);

    return {
      allowed: false,
      status: 500,
      message: "ไม่สามารถตรวจสอบสิทธิ์ผู้ใช้งานได้",
    };
  }

  if (!profile || profile.active !== true) {
    return {
      allowed: false,
      status: 403,
      message: "บัญชีนี้ยังไม่ได้รับอนุญาต",
    };
  }

  const role = String(profile.role ?? "").trim().toLowerCase();

  if (role !== "manager" && role !== "admin") {
    return {
      allowed: false,
      status: 403,
      message: "บัญชีนี้ไม่มีสิทธิ์ดู Skool Dashboard",
    };
  }

  const unitId =
    typeof profile.unit_id === "number" ? profile.unit_id : null;
  const canSeeAll = profile.can_view_all_data === true;

  if (!canSeeAll && unitId === null) {
    return {
      allowed: false,
      status: 403,
      message: "บัญชีนี้ยังไม่ได้กำหนดหน่วย",
    };
  }

  return {
    allowed: true,
    canSeeAll,
    unitId,
  };
}

