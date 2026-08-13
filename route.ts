import { NextResponse } from "next/server";
import { fetchJotformSubmissions } from "@/lib/jotform";

// Always fetch fresh from Jotform — never cache this route on the server or CDN.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { submissions, fetchedAtUTC } = await fetchJotformSubmissions();
    return NextResponse.json(
      { submissions, fetchedAtUTC },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching Jotform submissions.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
