import { NextResponse, type NextRequest } from "next/server";
import { fetchJotformSubmissions, JotformConfigError, JotformUpstreamError } from "@/lib/jotform";
import { checkRateLimit } from "@/lib/rate-limit";

// Always execute this route fresh — never let Next or a CDN cache the HTTP
// response itself. Freshness beyond that is governed by our own short
// in-memory cache inside lib/jotform.ts, not by HTTP caching.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

// This route's entire safe query-parameter surface. `force` is the only
// parameter the dashboard ever needs server-side (manual Refresh Data bypassing
// the short cache — see lib/jotform.ts). Date range, Agent Name, and Contact
// Channel are all applied client-side against the one full submissions payload
// this route returns (see components/Dashboard.tsx / lib/dashboard-calculations.ts)
// and must NEVER be sent to this route or forwarded to Jotform — Jotform has no
// concept of them, and doing so would defeat the short cache (every distinct
// filter combination would become its own cache key / upstream call).
//
// Any key outside this set — and any value for `force` other than the literal
// string "true" — is rejected with 400, not silently ignored. This is
// deliberately strict: it's what stops a future accidental change (e.g. someone
// wiring a filter into the fetch URL) from being forwarded upstream unnoticed.
const ALLOWED_QUERY_KEYS = new Set(["force"]);

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
  const params = request.nextUrl.searchParams;

  for (const key of params.keys()) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      return errorResponse("This endpoint does not accept that query parameter.", 400);
    }
  }

  const forceValues = params.getAll("force");
  if (forceValues.length > 1) {
    return errorResponse("Duplicate 'force' query parameter.", 400);
  }
  const forceRaw = forceValues[0];
  if (forceRaw !== undefined && forceRaw !== "true") {
    return errorResponse("Invalid value for 'force' query parameter.", 400);
  }
  const force = forceRaw === "true";

  // Rate limiting applies regardless of `force` — bypassing the cache must not
  // also bypass abuse protection, or ?force=true would become a way to hammer
  // the upstream Jotform API on every request.
  const rate = checkRateLimit(request);
  if (!rate.allowed) {
    return errorResponse("Too many requests. Please wait before refreshing again.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  try {
    const { submissions, fetchedAtUTC, cacheHit } = await fetchJotformSubmissions({ force });
    return NextResponse.json(
      { submissions, fetchedAtUTC },
      { headers: { ...NO_STORE_HEADERS, "X-Cache": cacheHit ? "HIT" : "MISS" } }
    );
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
