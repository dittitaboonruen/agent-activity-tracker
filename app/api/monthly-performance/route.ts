import {
  NextResponse,
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

export async function GET() {
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

    const {
      data,
      error,
    } = await supabase
      .from("daily_production")
      .select("*")
      .order(
        "production_date",
        {
          ascending: true,
        }
      )
      .order(
        "agent_code",
        {
          ascending: true,
        }
      );

    if (error) {
      console.error(
        "[monthly-performance] GET error:",
        error
      );

      return errorResponse(
        "ไม่สามารถโหลด Monthly Performance ได้",
        500
      );
    }

    return NextResponse.json(
      {
        rows: data ?? [],
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
