import Dashboard from "@/components/Dashboard";
import { fetchJotformSubmissions } from "@/lib/jotform";
import type { JotformApiResponse } from "@/types";

// This page must run per-request, not be statically generated at build time —
// the whole point is that it reflects live (cache-bounded) Jotform data.
export const dynamic = "force-dynamic";

/**
 * Server-side prefetch for fast first paint. This reads through the same short
 * in-memory cache as /api/jotform (see lib/jotform.ts), so:
 *   - the very first visitor after a cache expiry triggers one real Jotform call,
 *   - every other visitor within the cache window gets that cached result
 *     rendered directly into the initial HTML — no client-side loading spinner.
 *
 * If this fails (e.g. missing env vars, upstream down), we pass `initialData:
 * null` and let the Dashboard's existing client-side fetch + loading UI take
 * over, exactly as before this change. The error itself is already logged
 * server-side inside fetchJotformSubmissions.
 */
async function getInitialData(): Promise<JotformApiResponse | null> {
  try {
    const { submissions, fetchedAtUTC } = await fetchJotformSubmissions();
    return { submissions, fetchedAtUTC };
  } catch {
    return null;
  }
}

export default async function Page() {
  const initialData = await getInitialData();
  return <Dashboard initialData={initialData} />;
}
