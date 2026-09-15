import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  fetchJotformSubmissions,
  JotformConfigError,
  JotformUpstreamError,
} from "@/lib/jotform";

import {
  DashboardAccessError,
  filterSubmissionsForAccess,
  getDashboardAccess,
} from "@/lib/dashboard-access";

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

const ALLOWED_QUERY_KEYS =
  new Set(["force"]);

function errorResponse(
  message: string,
  status: number,
  extraHeaders:
    Record<string, string> = {}
) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        ...NO_STORE_HEADERS,
        ...extraHeaders,
      },
    }
  );
}

function methodNotAllowed() {
  return errorResponse(
    "Method not allowed.",
    405,
    {
      Allow: "GET",
    }
  );
}

export async function GET(
  request: NextRequest
) {
  const params =
    request.nextUrl.searchParams;

  for (const key of params.keys()) {
    if (
      !ALLOWED_QUERY_KEYS.has(key)
    ) {
      return errorResponse(
        "This endpoint does not accept that query parameter.",
        400
      );
    }
  }

  const forceValues =
    params.getAll("force");

  if (forceValues.length > 1) {
    return errorResponse(
      "Duplicate 'force' query parameter.",
      400
    );
  }

  const forceRaw =
    forceValues[0];

  if (
    forceRaw !== undefined &&
    forceRaw !== "true"
  ) {
    return errorResponse(
      "Invalid value for 'force' query parameter.",
      400
    );
  }

  const rate =
    checkRateLimit(request);

  if (!rate.allowed) {
    return errorResponse(
      "กรุณารอสักครู่ก่อนรีเฟรชอีกครั้ง",
      429,
      {
        "Retry-After": String(
          rate.retryAfterSeconds
        ),
      }
    );
  }

  try {
    const access =
      await getDashboardAccess();

    const {
      submissions,
      fetchedAtUTC,
      cacheHit,
    } =
      await fetchJotformSubmissions({
        force: forceRaw === "true",
      });

    const visibleSubmissions =
      filterSubmissionsForAccess(
        submissions,
        access
      );

    return NextResponse.json(
      {
        submissions:
          visibleSubmissions,

        fetchedAtUTC,
      },
      {
        headers: {
          ...NO_STORE_HEADERS,

          "X-Cache":
            cacheHit
              ? "HIT"
              : "MISS",
        },
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

    if (
      error instanceof
      JotformConfigError
    ) {
      return errorResponse(
        error.message,
        500
      );
    }

    if (
      error instanceof
      JotformUpstreamError
    ) {
      return errorResponse(
        error.message,
        502
      );
    }

    console.error(
      "[api/jotform] unexpected error:",
      error
    );

    return errorResponse(
      "เกิดข้อผิดพลาดในการโหลดข้อมูล",
      500
    );
  }
}

export async function POST() {
  return methodNotAllowed();
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
