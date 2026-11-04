import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  getSupabaseClient,
} from "@/lib/supabase";

import {
  DashboardAccessError,
  type DashboardAccess,
  getDashboardAccess,
} from "@/lib/dashboard-access";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0",
};

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers:
        NO_STORE_HEADERS,
    }
  );
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

function canAccessAgent(
  access: DashboardAccess,
  agentName:
    | string
    | null
    | undefined,
  agentCode?:
    | string
    | null
) {
  if (access.canSeeAll) {
    return true;
  }

  const normalizedName =
    normalizeIdentity(
      agentName
    );

  const normalizedCode =
    normalizeIdentity(
      agentCode
    );

  return (
    Boolean(
      normalizedName &&
        access.agentNames.has(
          normalizedName
        )
    ) ||
    Boolean(
      normalizedCode &&
        access.agentCodes.has(
          normalizedCode
        )
    )
  );
}

function accessErrorResponse(
  error: unknown
) {
  if (
    error instanceof
    DashboardAccessError
  ) {
    return errorResponse(
      error.message,
      error.status
    );
  }

  console.error(
    "[daily-production] unexpected error:",
    error
  );

  return errorResponse(
    "เกิดข้อผิดพลาดในการดำเนินการ",
    500
  );
}

/* =========================
   GET PRODUCTION
========================= */

export async function GET(
  request: NextRequest
) {
  const date =
    request.nextUrl.searchParams
      .get("date")
      ?.trim() || "";

  try {
    const access =
      await getDashboardAccess(
        "daily-production"
      );

    const supabase =
      getSupabaseClient();

    let query = supabase
      .from("daily_production")
      .select("*")
      .order("agent_code", {
        ascending: true,
      });

    if (date) {
      query = query.eq(
        "production_date",
        date
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      console.error(
        "[daily-production] GET error:",
        error
      );

      return errorResponse(
        "ไม่สามารถโหลด Production ได้",
        500
      );
    }

    const visibleRows =
      (data ?? []).filter(
        (row) =>
          canAccessAgent(
            access,
            row.agent_name,
            row.agent_code
          )
      );

    return NextResponse.json(
      {
        rows: visibleRows,
      },
      {
        headers:
          NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    return accessErrorResponse(
      error
    );
  }
}

// This legacy table is read-only. The future daily system will have its own workflow/storage.
async function legacyWritesClosed() {
  try { await getDashboardAccess("daily-production"); }
  catch (error) { return accessErrorResponse(error); }
  return errorResponse("ส่วนนี้เก็บข้อมูลเดิมสำหรับดูย้อนหลัง กรุณาบันทึกยอดรวมเดือนที่หน้าบันทึกผลงานรายเดือน", 410);
}
export const POST = legacyWritesClosed;
export const PUT = legacyWritesClosed;
export const PATCH = legacyWritesClosed;
export const DELETE = legacyWritesClosed;
