import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type Role = "manager" | "admin";

const PUBLIC_PATHS = [
  "/login",
  "/agent",
  "/annual-target",
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
];

function pathMatches(pathname: string, allowedPath: string) {
  if (allowedPath === "/") {
    return pathname === "/";
  }

  return (
    pathname === allowedPath ||
    pathname.startsWith(`${allowedPath}/`)
  );
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) =>
    pathMatches(pathname, path)
  );
}

function isPublicApiPath(pathname: string) {
  return PUBLIC_API_PATHS.some((path) =>
    pathMatches(pathname, path)
  );
}

function isAdminAllowedPath(pathname: string) {
  return ADMIN_ALLOWED_PATHS.some((path) =>
    pathMatches(pathname, path)
  );
}

function isAdminAllowedApiPath(pathname: string) {
  return ADMIN_ALLOWED_API_PATHS.some((path) =>
    pathMatches(pathname, path)
  );
}

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();

  url.pathname = pathname;
  url.search = "";

  const redirectResponse =
    NextResponse.redirect(url);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(
      cookie.name,
      cookie.value,
      cookie
    );
  });

  return redirectResponse;
}

function jsonWithCookies(
  response: NextResponse,
  body: Record<string, unknown>,
  status: number
) {
  const jsonResponse = NextResponse.json(
    body,
    { status }
  );

  response.cookies.getAll().forEach((cookie) => {
    jsonResponse.cookies.set(
      cookie.name,
      cookie.value,
      cookie
    );
  });

  return jsonResponse;
}

export async function middleware(
  request: NextRequest
) {
  const pathname = request.nextUrl.pathname;

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(name, value);
            }
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
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

  // ตรวจสอบ User จาก Supabase Auth
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // -----------------------------
  // PUBLIC ROUTES
  // -----------------------------

  if (
    isPublicPath(pathname) ||
    isPublicApiPath(pathname)
  ) {
    // ถ้า Login อยู่แล้วและเปิด /login
    // ให้กลับ Performance Hub
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

  // -----------------------------
  // NOT LOGGED IN
  // -----------------------------

  if (!user || userError) {
    // API ต้องตอบ JSON
    if (pathname.startsWith("/api/")) {
      return jsonWithCookies(
        response,
        {
          ok: false,
          error: "Unauthorized",
        },
        401
      );
    }

    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.search = "";

    return redirectWithCookies(
      request,
      response,
      loginUrl.pathname
    );
  }

  // -----------------------------
  // LOAD USER ROLE
  // -----------------------------

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("user_profiles")
    .select("role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.active !== true
  ) {
    if (pathname.startsWith("/api/")) {
      return jsonWithCookies(
        response,
        {
          ok: false,
          error: "Access denied",
        },
        403
      );
    }

    return redirectWithCookies(
      request,
      response,
      "/login"
    );
  }

  const role = profile.role as Role;

  // -----------------------------
  // MANAGER
  // เข้าได้ทุก Back Office
  // -----------------------------

  if (role === "manager") {
    return response;
  }

  // -----------------------------
  // ADMIN
  // -----------------------------

  if (role === "admin") {
    // หน้าเว็บที่ Admin เข้าได้
    if (
      !pathname.startsWith("/api/") &&
      isAdminAllowedPath(pathname)
    ) {
      return response;
    }

    // API ที่ Admin ใช้ได้
    if (
      pathname.startsWith("/api/") &&
      isAdminAllowedApiPath(pathname)
    ) {
      return response;
    }

    // Admin พยายามเรียก API Manager
    if (pathname.startsWith("/api/")) {
      return jsonWithCookies(
        response,
        {
          ok: false,
          error: "Manager access required",
        },
        403
      );
    }

    // Admin พยายามเปิดหน้า Manager
    // ให้กลับหน้า Home
    return redirectWithCookies(
      request,
      response,
      "/"
    );
  }

  // Role อื่นที่ไม่รู้จัก
  if (pathname.startsWith("/api/")) {
    return jsonWithCookies(
      response,
      {
        ok: false,
        error: "Access denied",
      },
      403
    );
  }

  return redirectWithCookies(
    request,
    response,
    "/login"
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
