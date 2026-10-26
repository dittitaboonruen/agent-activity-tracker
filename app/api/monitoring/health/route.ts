import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * HQ Monitoring: liveness only.
 *
 * Does not import Supabase, Jotform or synchronization modules.
 * A successful response means only that this route is responding,
 * NOT that its dependencies or background jobs are healthy.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const json = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: NO_STORE });

function authorized(request: NextRequest, secret: string): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  if (!supplied || supplied.length > 2048) return false;

  // Compare equal-length digests to avoid length-dependent timing differences.
  const hash = (value: string) =>
    createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(hash(supplied), hash(secret));
}

export async function GET(request: NextRequest) {
  const secret = process.env.HQ_MONITORING_SECRET;
  if (!secret || secret.length < 32) {
    return json({ status: "unavailable" }, 503);
  }
  if (!authorized(request, secret)) {
    return json({ error: "Unauthorized" }, 401);
  }
  return json({
    service: "agent-activity-tracker",
    status: "responding",
    checkedAtUTC: new Date().toISOString(),
    scope: "application_liveness_only",
  }, 200);
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { ...NO_STORE, Allow: "GET" } }
  );
}
export async function POST() { return methodNotAllowed(); }
export async function PUT() { return methodNotAllowed(); }
export async function PATCH() { return methodNotAllowed(); }
export async function DELETE() { return methodNotAllowed(); }
