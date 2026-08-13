import "server-only";
import type { Submission } from "@/types";

// Field mapping is done by matching each question's localized text against these
// keywords, rather than hardcoded question IDs — this keeps normalization working
// even if questions are reordered or the form is edited in Jotform.
const FIELD_KEYWORDS = {
  customer: "ชื่อลูกค้า",
  source: "แหล่งที่มา",
  channel: "ช่องทาง",
  moneyMap: "money map",
  agent: "ชื่อตัวแทน",
  activities: "กิจกรรมหลัก",
} as const;

// Jotform's `created_at` is returned in UTC. Each submission's usable local date is
// derived from this downstream (see lib/date-utils.ts), converting to Asia/Bangkok
// (UTC+7). If your Jotform account's timezone setting is already Asia/Bangkok,
// set this to false so timestamps aren't shifted twice.
const CREATED_AT_IS_UTC = true;

interface JotformRawAnswer {
  name?: string;
  text?: string;
  type?: string;
  answer?: string | string[];
}

interface JotformRawSubmission {
  id: string;
  created_at: string; // "YYYY-MM-DD HH:MM:SS"
  answers?: Record<string, JotformRawAnswer>;
}

function findAnswer(answers: Record<string, JotformRawAnswer>, keyword: string): JotformRawAnswer | undefined {
  return Object.values(answers).find(
    (a) => typeof a?.text === "string" && a.text.toLowerCase().includes(keyword.toLowerCase())
  );
}

function toStringAnswer(answer: string | string[] | undefined): string {
  if (Array.isArray(answer)) return answer.join(" ");
  return answer ?? "";
}

function toActivitiesArray(answer: string | string[] | undefined): string[] {
  if (Array.isArray(answer)) return answer.filter(Boolean);
  if (typeof answer === "string" && answer.trim().length > 0) {
    return answer.split(/\s{2,}|,\s*/).map((a) => a.trim()).filter(Boolean);
  }
  return [];
}

function toUtcIso(createdAt: string): string {
  const isoLike = createdAt.replace(" ", "T");
  return CREATED_AT_IS_UTC ? `${isoLike}Z` : isoLike;
}

export function normalizeSubmissions(raw: JotformRawSubmission[]): Submission[] {
  return raw
    .map((sub): Submission => {
      const answers = sub.answers ?? {};

      const customerA = findAnswer(answers, FIELD_KEYWORDS.customer);
      const sourceA = findAnswer(answers, FIELD_KEYWORDS.source);
      const channelA = findAnswer(answers, FIELD_KEYWORDS.channel);
      const moneyMapA = findAnswer(answers, FIELD_KEYWORDS.moneyMap);
      const agentA = findAnswer(answers, FIELD_KEYWORDS.agent);
      const activitiesA = findAnswer(answers, FIELD_KEYWORDS.activities);

      return {
        id: String(sub.id),
        customer: toStringAnswer(customerA?.answer),
        source: toStringAnswer(sourceA?.answer),
        channel: toStringAnswer(channelA?.answer),
        moneyMap: toStringAnswer(moneyMapA?.answer),
        agent: toStringAnswer(agentA?.answer),
        activities: toActivitiesArray(activitiesA?.answer),
        createdAtUTC: toUtcIso(sub.created_at),
      };
    })
    .filter((s) => s.agent || s.customer);
}

export interface FetchJotformResult {
  submissions: Submission[];
  fetchedAtUTC: string;
  /** True if this result was served from the short in-memory cache rather than a fresh upstream fetch. Server-side diagnostic only — not part of the public API JSON body. */
  cacheHit: boolean;
}

export interface FetchJotformOptions {
  /** Bypasses the short cache and always hits Jotform. Used by the manual Refresh Data button. */
  force?: boolean;
}

/** Thrown when required server configuration (env vars) is missing. Message is always safe to show to a client. */
export class JotformConfigError extends Error {}

/** Thrown when the upstream Jotform API itself fails. Message is always a sanitized, generic string — never the upstream body. */
export class JotformUpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Short-lived, in-memory, server-side cache for the normalized submissions payload.
 *
 * Purpose: several near-simultaneous requests (multiple managers opening the
 * dashboard around the same time, the SSR prefetch in app/page.tsx plus the
 * client's own background revalidation fetch, etc.) should collapse into a
 * single real Jotform API call rather than one call per request.
 *
 * Caveat: like the rate limiter in lib/rate-limit.ts, this lives in a single
 * serverless function instance's memory — it resets on cold starts and is not
 * shared across concurrently-scaled instances. That's fine for its purpose here
 * (a short debounce window, not a correctness guarantee): worst case, a burst of
 * requests hitting different cold instances simply results in a few real fetches
 * instead of one, never stale-forever data.
 */
const CACHE_TTL_MS = 25_000; // 20–30s, per requirements

interface CacheEntry {
  data: Omit<FetchJotformResult, "cacheHit">;
  expiresAt: number;
}

let cache: CacheEntry | null = null;

/**
 * Fetches submissions directly from Jotform using the server-side API key.
 * This function must only ever run on the server (API routes / server components) —
 * the `server-only` import above throws a build error if it's pulled into client code.
 *
 * Every error path below logs full diagnostic detail with console.error (server-side
 * only, e.g. visible in Vercel's function logs) but only ever throws a short, generic,
 * pre-written message — the upstream response body, the request URL (which contains
 * the API key), and any stack traces never leave this function.
 */
export async function fetchJotformSubmissions(
  options: FetchJotformOptions = {}
): Promise<FetchJotformResult> {
  const { force = false } = options;

  if (!force && cache && Date.now() < cache.expiresAt) {
    return { ...cache.data, cacheHit: true };
  }

  const apiKey = process.env.JOTFORM_API_KEY;
  const formId = process.env.JOTFORM_FORM_ID;

  if (!apiKey || !formId) {
    console.error("[jotform] missing JOTFORM_API_KEY and/or JOTFORM_FORM_ID environment variables.");
    throw new JotformConfigError("Jotform integration is not configured.");
  }

  const url = `https://api.jotform.com/form/${encodeURIComponent(formId)}/submissions?apiKey=${encodeURIComponent(
    apiKey
  )}&limit=1000&orderby=created_at`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (networkErr) {
    // Never log or rethrow `url` itself — it contains the API key.
    console.error("[jotform] network error contacting the upstream API:", networkErr);
    throw new JotformUpstreamError(502, "Unable to reach the upstream data provider.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Full status + body is logged server-side only for debugging; never forwarded.
    console.error(`[jotform] upstream API returned ${res.status}:`, body);
    throw new JotformUpstreamError(res.status, "The upstream data provider returned an error.");
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (parseErr) {
    console.error("[jotform] failed to parse upstream response as JSON:", parseErr);
    throw new JotformUpstreamError(502, "The upstream data provider returned an unexpected response.");
  }

  const rawSubmissions: JotformRawSubmission[] = (json as { content?: JotformRawSubmission[] })?.content ?? [];
  const submissions = normalizeSubmissions(rawSubmissions);
  const data = { submissions, fetchedAtUTC: new Date().toISOString() };

  // A successful fetch (forced or not) always refreshes the cache, so a manual
  // Refresh Data click also resets the debounce window for everyone else.
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };

  return { ...data, cacheHit: false };
}
