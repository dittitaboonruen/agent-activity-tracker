import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Thrown when required server configuration (env vars) is missing. Message is always safe to show to a client. */
export class SupabaseConfigError extends Error {}

/** Thrown when a Supabase query itself fails. Message is always a sanitized, generic string — never the raw Supabase/Postgres error. */
export class SupabaseQueryError extends Error {}

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a server-only Supabase client built from SUPABASE_URL and
 * SUPABASE_SECRET_KEY. This must only ever run on the server — the
 * `server-only` import above throws a build error if this file is ever
 * imported into client code. SUPABASE_SECRET_KEY is never returned, logged,
 * or included in any error message; only the fact that it's missing is
 * logged server-side if that's the case.
 *
 * Used exclusively by lib/pep-notes.ts. Jotform data (lib/jotform.ts) is
 * completely separate and never touches Supabase.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    console.error("[supabase] missing SUPABASE_URL and/or SUPABASE_SECRET_KEY environment variables.");
    throw new SupabaseConfigError("PEP Notes storage is not configured.");
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
