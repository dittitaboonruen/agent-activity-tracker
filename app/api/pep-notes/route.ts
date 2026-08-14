import { NextResponse, type NextRequest } from "next/server";
import { listPepNotesForAgent, createPepNote } from "@/lib/pep-notes";
import { SupabaseConfigError, SupabaseQueryError } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

// Always execute fresh — PEP notes are managers' live data, never cached here.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const MAX_AGENT_LENGTH = 200;
const MAX_TEXT_LENGTH = 4000;
const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// GET's entire safe query-parameter surface: `agent`, required, exactly once.
const ALLOWED_GET_QUERY_KEYS = new Set(["agent"]);

function errorResponse(message: string, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(
    { error: message },
    { status, headers: { ...NO_STORE_HEADERS, ...extraHeaders } }
  );
}

function methodNotAllowed() {
  return errorResponse("Method not allowed.", 405, { Allow: "GET, POST" });
}

function handleKnownError(err: unknown, fallbackMessage: string) {
  if (err instanceof SupabaseConfigError) {
    // err.message is already a safe, generic string — see lib/supabase.ts.
    return errorResponse(err.message, 500);
  }
  if (err instanceof SupabaseQueryError) {
    // err.message is already a safe, generic string — full detail was
    // logged server-side inside lib/pep-notes.ts, never here.
    return errorResponse(err.message, 502);
  }
  console.error("[api/pep-notes] unexpected error:", err);
  return errorResponse(fallbackMessage, 500);
}

/** GET /api/pep-notes?agent=<name> — returns that agent's PEP note history. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  for (const key of params.keys()) {
    if (!ALLOWED_GET_QUERY_KEYS.has(key)) {
      return errorResponse("This endpoint does not accept that query parameter.", 400);
    }
  }

  const agentValues = params.getAll("agent");
  if (agentValues.length !== 1) {
    return errorResponse("A single 'agent' query parameter is required.", 400);
  }
  const agent = agentValues[0].trim();
  if (!agent || agent.length > MAX_AGENT_LENGTH) {
    return errorResponse("Invalid 'agent' query parameter.", 400);
  }

  const rate = checkRateLimit(request);
  if (!rate.allowed) {
    return errorResponse("Too many requests. Please wait before trying again.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  try {
    const notes = await listPepNotesForAgent(agent);
    return NextResponse.json({ notes }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleKnownError(err, "An unexpected error occurred while loading PEP notes.");
  }
}

/** POST /api/pep-notes — creates one new PEP note history entry. */
export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.toString().length > 0) {
    return errorResponse("This endpoint does not accept query parameters.", 400);
  }

  const rate = checkRateLimit(request);
  if (!rate.allowed) {
    return errorResponse("Too many requests. Please wait before trying again.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  if (typeof body !== "object" || body === null) {
    return errorResponse("Invalid request body.", 400);
  }
  const b = body as Record<string, unknown>;

  const agentName = typeof b.agentName === "string" ? b.agentName.trim() : "";
  const pepDate = typeof b.pepDate === "string" ? b.pepDate.trim() : "";
  const recommendation = typeof b.recommendation === "string" ? b.recommendation.trim() : "";
  const coachingQuestion = typeof b.coachingQuestion === "string" ? b.coachingQuestion.trim() : "";
  const actionPlan = typeof b.actionPlan === "string" ? b.actionPlan.trim() : "";

  if (!agentName || agentName.length > MAX_AGENT_LENGTH) {
    return errorResponse("A valid 'agentName' is required.", 400);
  }
  if (!YMD_REGEX.test(pepDate)) {
    return errorResponse("A valid 'pepDate' (YYYY-MM-DD) is required.", 400);
  }
  if ([recommendation, coachingQuestion, actionPlan].some((t) => t.length > MAX_TEXT_LENGTH)) {
    return errorResponse("One or more fields exceed the maximum allowed length.", 400);
  }

  try {
    const note = await createPepNote({ agentName, pepDate, recommendation, coachingQuestion, actionPlan });
    return NextResponse.json({ note }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleKnownError(err, "An unexpected error occurred while saving the PEP note.");
  }
}

// Explicitly restrict this route to GET and POST, same pattern as /api/jotform.
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

