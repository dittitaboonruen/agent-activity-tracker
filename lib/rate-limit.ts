import type { NextRequest } from "next/server";

/**
 * Best-effort, in-memory rate limiting for /api/jotform.
 *
 * Caveat: this state lives in a single serverless function instance's memory.
 * It resets on cold starts and is NOT shared across concurrently-scaled
 * instances, so it does not give a hard guarantee under high concurrency or
 * distributed abuse. It is intended as a cheap first line of defense against
 * casual scripted hammering of this endpoint (e.g. someone leaving a refresh
 * loop running). For stronger guarantees in production, pair this with an
 * edge-level control such as Vercel's Firewall / rate limiting rules, or a
 * shared store like Upstash Redis / Vercel KV. See README "Security".
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const CLEANUP_INTERVAL_MS = WINDOW_MS * 5;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();
let lastCleanup = Date.now();

function getClientKey(request: NextRequest): string {
  // Vercel sets x-forwarded-for on all incoming requests; fall back safely otherwise.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "";
  return ip || "unknown";
}

function cleanupStaleBuckets(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(request: NextRequest): RateLimitResult {
  const now = Date.now();
  cleanupStaleBuckets(now);

  const key = getClientKey(request);
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count < MAX_REQUESTS_PER_WINDOW) {
    bucket.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000));
  return { allowed: false, retryAfterSeconds };
}

