import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  getSupabaseClient,
} from "@/lib/supabase";

import {
  DashboardAccessError,
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

export async function GET(request: NextRequest) {
  try {
    /*
      ตรวจสิทธิ์ Monthly Performance

      อนุญาตเฉพาะผู้ที่มี
      can_view_monthly_performance = true
    */

    await getDashboardAccess(
      "monthly-performance"
    );

    const supabase =
      getSupabaseClient();

    const yearText = request.nextUrl.searchParams.get("year");
    const monthText = request.nextUrl.searchParams.get("month");
    const year = Number(yearText), month = Number(monthText || "12");
    if ((yearText !== null && (!Number.isInteger(year) || year < 2000 || year > 2200)) ||
        (monthText !== null && (!yearText || !Number.isInteger(month) || month < 1 || month > 12))) {
      return errorResponse("เดือนหรือปีรายงานไม่ถูกต้อง", 400);
    }
    const rows: Record<string, unknown>[] = [];
    // PostgREST caps individual responses. Read every page so YTD does not stop at 1,000 rows.
    for (;;) {
      let query = supabase.from("daily_production").select("*")
        .order("production_date", { ascending: true })
        .order("agent_code", { ascending: true }).order("agent_name", { ascending: true });
      if (yearText) {
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        query = query.gte("production_date", `${year}-01-01`)
          .lte("production_date", `${year}-${String(month).padStart(2, "0")}-${lastDay}`);
      }
      const { data, error } = await query.range(rows.length, rows.length + 999);
      if (error) {
        console.error("[monthly-performance] GET error:", error);
        return errorResponse("ไม่สามารถโหลด Monthly Performance ได้", 500);
      }
      if (!data?.length) break;
      rows.push(...data);
    }

    return NextResponse.json(
      {
        rows,
      },
      {
        headers:
          NO_STORE_HEADERS,
      }
    );
  } catch (error) {
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
      "[monthly-performance] unexpected error:",
      error
    );

    return errorResponse(
      "เกิดข้อผิดพลาดในการโหลด Monthly Performance",
      500
    );
  }
}

export async function POST() {
  return errorResponse(
    "Method not allowed.",
    405
  );
}

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

export async function DELETE() {
  return errorResponse(
    "Method not allowed.",
    405
  );
}
