import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

type Role =
  | "manager"
  | "admin";

const PUBLIC_PATHS = [
  "/login",
  "/agent",
  "/annual-target",
  "/illustrations",
  "/vendor",
  "/auth/confirm",
];

const PUBLIC_API_PATHS = [
  "/api/auth/magic-link",
  "/api/annual-target",
];

const ADMIN_ALLOWED_PATHS = [
  "/",
  "/admin/production",
  "/admin/agents",
  "/dashboard/performance",
];

const ADMIN_ALLOWED_API_PATHS = [
  "/api/daily-production",
  "/api/agent-master",
  "/api/monthly-performance",
];

function pathMatches(
  pathname: string,
  allowedPath: string
) {
  if (allowedPath === "/") {
    return pathname === "/";
  }

  return (
    pathname === allowedPath ||
    pathname.startsWith(
      `${allowedPath}/`
    )
  );
}

function isPublicPath(
  pathname: string
) {
  return PUBLIC_PATHS.some(
    (path) =>
      pathMatches(
        pathname,
        path
      )
  );
}

function isPublicApiPath(
  pathname: string
) {
  return PUBLIC_API_PATHS.some(
    (path) =>
      pathMatches(
        pathname,
        path
      )
  );
}

function isAdminAllowedPath(
  pathname: string
) {
  return ADMIN_ALLOWED_PATHS.some(
    (path) =>
      pathMatches(
        pathname,
        path
      )
  );
}

function isAdminAllowedApiPath(
  pathname: string
) {
  return ADMIN_ALLOWED_API_PATHS.some(
    (path) =>
      pathMatches(
        pathname,
        path
      )
  );
}

function isActivityDashboardPath(
  pathname: string
) {
  return (
    pathMatches(
      pathname,
      "/dashboard/activity"
    ) ||
    pathMatches(
      pathname,
      "/api/jotform"
    )
  );
}

function isMonthlyPerformancePath(
  pathname: string
) {
  return (
    pathMatches(
      pathname,
      "/dashboard/performance"
    ) ||
    pathMatches(
      pathname,
      "/api/monthly-performance"
    )
  );
}

function isDailyProductionPath(
  pathname: string
) {
  return (
    pathMatches(
      pathname,
      "/admin/production"
    ) ||
    pathMatches(
      pathname,
      "/api/daily-production"
    )
  );
}

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string
) {
  const url =
    request.nextUrl.clone();

  url.pathname = pathname;
  url.search = "";

  const redirectResponse =
    NextResponse.redirect(
      url
    );

  response.cookies
    .getAll()
    .forEach(
      (cookie) => {
        redirectResponse.cookies.set(
          cookie.name,
          cookie.value,
          cookie
        );
      }
    );

  return redirectResponse;
}

function jsonWithCookies(
  response: NextResponse,
  body: Record<
    string,
    unknown
  >,
  status: number
) {
  const jsonResponse =
    NextResponse.json(
      body,
      {
        status,
      }
    );

  response.cookies
    .getAll()
    .forEach(
      (cookie) => {
        jsonResponse.cookies.set(
          cookie.name,
          cookie.value,
          cookie
        );
      }
    );

  return jsonResponse;
}

function denyAccess(
  request: NextRequest,
  response: NextResponse,
  message: string
) {
  if (
    request.nextUrl.pathname
      .startsWith("/api/")
  ) {
    return jsonWithCookies(
      response,
      {
        ok: false,
        error: message,
      },
      403
    );
  }

  return redirectWithCookies(
    request,
    response,
    "/"
  );
}

export async function middleware(
  request: NextRequest
) {
  const pathname =
    request.nextUrl.pathname;

  let response =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value
                );
              }
            );

            response =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                response.cookies.set(
                  name,
                  value,
                  options
                );
              }
            );
          },
        },
      }
    );

  /*
    ตรวจสอบ Supabase User
  */

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  /*
    Public Routes
  */

  if (
    isPublicPath(
      pathname
    ) ||
    isPublicApiPath(
      pathname
    )
  ) {
    if (
      pathname === "/login" &&
      user &&
      !userError
    ) {
      return redirectWithCookies(
        request,
        response,
        "/"
      );
    }

    return response;
  }

  /*
    ยังไม่ได้ Login
  */

  if (
    !user ||
    userError
  ) {
    if (
      pathname.startsWith(
        "/api/"
      )
    ) {
      return jsonWithCookies(
        response,
        {
          ok: false,
          error:
            "Unauthorized",
        },
        401
      );
    }

    return redirectWithCookies(
      request,
      response,
      "/login"
    );
  }

  /*
    โหลดสิทธิ์จาก user_profiles
  */

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
      can_view_all_data,
      can_manage_daily_production
    `)
    .eq(
      "user_id",
      user.id
    )
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.active !== true
  ) {
    return denyAccess(
      request,
      response,
      "บัญชีนี้ยังไม่ได้รับอนุญาต"
    );
  }

  const role =
    profile.role as Role;

  if (
    role !== "manager" &&
    role !== "admin"
  ) {
    return denyAccess(
      request,
      response,
      "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน"
    );
  }

  /*
    Activity Dashboard

    NewAgent เข้าไม่ได้
    Training เห็นทั้งหมด
    Manager อื่นเห็นตามหน่วย
  */

  if (
    isActivityDashboardPath(
      pathname
    ) &&
    profile
      .can_view_activity_dashboard !==
      true
  ) {
    return denyAccess(
      request,
      response,
      "บัญชีนี้ไม่มีสิทธิ์ดู Activity Dashboard"
    );
  }

  /*
    Monthly Performance

    อนุญาตเฉพาะ:
    - NewAgent
    - Executive
    - Training
  */

  if (
    isMonthlyPerformancePath(
      pathname
    ) &&
    profile
      .can_view_monthly_performance !==
      true
  ) {
    return denyAccess(
      request,
      response,
      "บัญชีนี้ไม่มีสิทธิ์ดู Monthly Performance"
    );
  }

  /*
    Daily Production

    เพิ่ม แก้ไข และลบได้เฉพาะ NewAgent
  */

  if (
    isDailyProductionPath(
      pathname
    ) &&
    profile
      .can_manage_daily_production !==
      true
  ) {
    return denyAccess(
      request,
      response,
      "บัญชีนี้ไม่มีสิทธิ์จัดการ Daily Production"
    );
  }

  /*
    Manager
  */

  if (role === "manager") {
    return response;
  }

  /*
    Admin
  */

  if (role === "admin") {
    /*
      หน้าเว็บที่ Admin เข้าได้
    */

    if (
      !pathname.startsWith(
        "/api/"
      ) &&
      isAdminAllowedPath(
        pathname
      )
    ) {
      return response;
    }

    /*
      API ที่ Admin ใช้ได้
    */

    if (
      pathname.startsWith(
        "/api/"
      ) &&
      isAdminAllowedApiPath(
        pathname
      )
    ) {
      return response;
    }

    /*
      Admin เรียก API
      ที่ไม่ได้รับอนุญาต
    */

    if (
      pathname.startsWith(
        "/api/"
      )
    ) {
      return jsonWithCookies(
        response,
        {
          ok: false,
          error:
            "Access denied",
        },
        403
      );
    }

    /*
      Admin เปิดหน้า
      ที่ไม่ได้รับอนุญาต
    */

    return redirectWithCookies(
      request,
      response,
      "/"
    );
  }

  return denyAccess(
    request,
    response,
    "Access denied"
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
