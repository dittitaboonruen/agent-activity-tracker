import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AIA Submission Form HS_21 May 2020: official AIA-hosted document.
// Only the claim cover card uses this endpoint; existing form assets stay untouched.
const AIA_CLAIM_COVER_PDF =
  "https://distribution.aia.co.th/content/dam/th/th/docs/application-forms/" +
  "%E0%B9%83%E0%B8%9A%E0%B8%99%E0%B8%B3%E0%B8%AA%E0%B9%88%E0%B8%87%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3%E0%B9%80%E0%B8%A3%E0%B8%B5%E0%B8%A2%E0%B8%81%E0%B8%A3%E0%B9%89%E0%B8%AD%E0%B8%87%E0%B8%AA%E0%B8%B4%E0%B8%99%E0%B9%84%E0%B8%AB%E0%B8%A1%E0%B8%97%E0%B8%B1%E0%B9%88%E0%B8%A7%E0%B9%84%E0%B8%9B.pdf";

export async function GET(request: NextRequest) {
  const isDownload = request.nextUrl.searchParams.get("download") === "1";
  try {
    const response = await fetch(AIA_CLAIM_COVER_PDF, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/pdf" },
    });
    if (!response.ok) throw new Error("AIA PDF HTTP " + response.status);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 4 || !Buffer.from(bytes).subarray(0, 4).equals(Buffer.from("%PDF"))) {
      throw new Error("Invalid PDF response");
    }
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": (isDownload ? "attachment" : "inline") +
          '; filename="AIA-Submission-Claim-HS-21May2020.pdf"',
        "Cache-Control": "public, max-age=0, s-maxage=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Claim cover PDF fetch failed:", error);
    // Use the official AIA document directly if server-side PDF retrieval is blocked.
    return NextResponse.redirect(AIA_CLAIM_COVER_PDF, 307);
  }
}
