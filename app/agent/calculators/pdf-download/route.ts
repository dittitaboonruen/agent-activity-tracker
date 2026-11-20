import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel functions accept at most ~4.5 MB request/response payloads.
// Keep a margin for base64 form encoding and HTTP framing.
const MAX_PDF_BYTES = 2_500_000;
const MAX_REQUEST_BYTES = 3_600_000;

function errorResponse(status: number, reason: string) {
  return NextResponse.json(
    { ok: false, error: reason },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function safeFilename(value: string): string {
  const base = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 180);
  return base.toLowerCase().endsWith(".pdf") ? base : base + ".pdf";
}

export async function POST(request: Request) {
  // This route processes the generated PDF in memory and NEVER stores it.
  // Calculator is a public agent tool, so only accept a same-origin form POST.
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== expectedOrigin || (fetchSite && fetchSite !== "same-origin")) {
    return errorResponse(403, "Cross-origin PDF delivery is not allowed");
  }
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("application/x-www-form-urlencoded") &&
      !type.startsWith("multipart/form-data")) {
    return errorResponse(415, "Unsupported PDF form format");
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_REQUEST_BYTES) {
    return errorResponse(413, "PDF exceeds the secure download limit");
  }

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return errorResponse(400, "Invalid PDF form");
  }
  const value = data.get("pdf_base64");
  const requestedFilename = data.get("filename");
  if (typeof value !== "string" || typeof requestedFilename !== "string" ||
      value.length === 0 || value.length > Math.ceil(MAX_PDF_BYTES / 3) * 4 + 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return errorResponse(400, "Invalid or oversized PDF");
  }

  const content = Buffer.from(value, "base64");
  if (content.length < 16 || content.length > MAX_PDF_BYTES ||
      content.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return errorResponse(400, "Not a valid PDF file");
  }

  // ASCII fallback for Safari, RFC 5987 filename* for other browsers.
  const filename = safeFilename(requestedFilename);
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const disposition = `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
  return new Response(new Uint8Array(content), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Length": String(content.length)
    }
  });
}
