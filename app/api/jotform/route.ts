import { NextResponse, type NextRequest } from "next/server";
import { fetchJotformSubmissions, JotformConfigError, JotformUpstreamError } from "@/lib/jotform";
import { checkRateLimit } from "@/lib/rate-limit";

// Always fetch fresh from Jotform — never cache this route on the server or CDN.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

function errorResponse(message: string, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(
    { error: message },
    { status, headers: { ...NO_STORE_HEADERS, ...extraHeaders } }
  );
}

function methodNotAllowed() {
  return errorResponse("Method not allowed.", 405, { Allow: "GET" });
}

export async function GET(request: NextRequest) {
  // This route accepts no query parameters — reject anything unexpected rather
  // than silently ignoring it, so malformed or probing requests fail closed.
  if (request.nextUrl.searchParams.toString().length > 0) {
    return errorResponse("This endpoint does not accept query parameters.", 400);
  }

  const rate = checkRateLimit(request);
  if (!rate.allowed) {
    return errorResponse("Too many requests. Please wait before refreshing again.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  try {
    const { submissions, fetchedAtUTC } = await fetchJotformSubmissions();
    return NextResponse.json({ submissions, fetchedAtUTC }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    if (err instanceof JotformConfigError) {
      // err.message is already a safe, generic string — see lib/jotform.ts.
      return errorResponse(err.message, 500);
    }
    if (err instanceof JotformUpstreamError) {
      // err.message is already a safe, generic string — full upstream detail
      // was logged server-side inside fetchJotformSubmissions, never here.
      return errorResponse(err.message, 502);
    }
    // Unknown/unexpected error — log full detail server-side, tell the client nothing more.
    console.error("[api/jotform] unexpected error:", err);
    return errorResponse("An unexpected error occurred while fetching data.", 500);
  }
}

// Explicitly restrict this route to GET. Next.js already 405s methods with no
// exported handler, but exporting these makes the restriction explicit and
// ensures a consistent, sanitized error body across all non-GET methods.
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
