"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PdfDocument = { blob: Blob; filename: string };
type PdfMessage = { type?: string; blob?: unknown; filename?: unknown };

// HTTP attachment: strict safe size under Vercel's 4.5 MB body limits.
// Larger PDFs fall back to existing top-level direct download.
const MAX_HTTP_PDF_BYTES = 2_500_000;
const MAX_PDF_BYTES = 80 * 1024 * 1024;

function safePdfFilename(raw: string): string {
  const cleaned = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 180);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : cleaned + ".pdf";
}

export default function CalculatorPdfDelivery() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const urlRef = useRef<string | null>(null);
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState("");
  const [downloadAttempted, setDownloadAttempted] = useState(false);

  const pdfUrl = useCallback((blob: Blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    return url;
  }, []);

  useEffect(() => {
    const receivePdf = (event: MessageEvent<PdfMessage>) => {
      if (event.origin !== window.location.origin ||
          event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.type !== "royal-partner:pdf-ready") return;
      const blob = data.blob;
      if (!(blob instanceof Blob) || blob.type !== "application/pdf" ||
          blob.size === 0 || blob.size > MAX_PDF_BYTES ||
          typeof data.filename !== "string") {
        setNotice("ไฟล์ PDF ไม่ถูกต้อง กรุณาลองสร้างใบสรุปอีกครั้ง");
        return;
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setPdfBase64(null);
      setDownloadAttempted(false);
      setDocument({ blob, filename: safePdfFilename(data.filename) });
      setNotice("");
    };

    window.addEventListener("message", receivePdf);
    return () => {
      window.removeEventListener("message", receivePdf);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!document || document.blob.size > MAX_HTTP_PDF_BYTES) {
      setPdfBase64(null);
      setPreparing(false);
      return;
    }

    // Convert before button tap so form POST is synchronous user navigation.
    // Do not fetch and re-create a blob on the client: that reintroduces Safari's
    // blob URL issue. Native form navigation receives Content-Disposition.
    const reader = new FileReader();
    setPdfBase64(null);
    setPreparing(true);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const encoded = reader.result.split(",", 2)[1];
        setPdfBase64(encoded || null);
      }
      setPreparing(false);
    };
    reader.onerror = () => {
      setPdfBase64(null);
      setPreparing(false);
    };
    reader.onabort = () => setPreparing(false);
    reader.readAsDataURL(document.blob);
    return () => {
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [document]);

  function closeDialog() {
    setDocument(null);
    setPdfBase64(null);
    setNotice("");
    setDownloadAttempted(false);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  function downloadPdfFallback() {
    if (!document) return;
    try {
      const appleTouch =
        /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const payload = appleTouch
        ? new Blob([document.blob], { type: "application/octet-stream" })
        : document.blob;
      const url = pdfUrl(payload);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = document.filename;
      a.style.display = "none";
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      setNotice("");
    } catch (error) {
      console.error("PDF fallback download error:", error);
      setNotice("ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <>
      {/* Native POST has a private download target: never navigate Safari's top-level tab. */}
      <iframe
        title="ปลายทางดาวน์โหลด PDF"
        name="royal-partner-pdf-download-target"
        style={{ display: "none" }}
      />
      <iframe
        ref={frameRef}
        title="เครื่องมือคำนวณและจัดทำใบสรุปประกอบการเสนอขาย"
        src="/illustrations/royal_partners_illustration_tool.html"
        sandbox="allow-scripts allow-downloads allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        style={{
          display: "block", width: "100%", maxWidth: "100%", boxSizing: "border-box",
          height: "max(1100px, 90dvh)", border: "1px solid #D9D2BF", background: "#FFFDF8"
        }}
      />

      {document && (
        <div role="presentation" style={{
          position: "fixed", inset: 0, zIndex: 2000, background: "rgba(10,20,35,.65)",
          display: "flex", justifyContent: "center", alignItems: "center", padding: 16
        }}>
          <section role="dialog" aria-modal="true" aria-label="ดาวน์โหลด PDF" style={{
            width: "100%", maxWidth: 440, borderRadius: 12, padding: 22,
            background: "#FFFDF8", color: "#0F1B2E", boxShadow: "0 18px 70px #0005",
            fontFamily: "system-ui, sans-serif"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontSize: 20, margin: 0 }}>ไฟล์ PDF พร้อมใช้งาน</h2>
              <button type="button" onClick={closeDialog} aria-label="ปิด" style={{
                border: "1px solid #D9D2BF", borderRadius: 8, background: "transparent",
                cursor: "pointer", padding: "8px 12px"
              }}>ปิด</button>
            </div>
            <p style={{ overflowWrap: "anywhere", fontSize: 12, color: "#5D6470" }}>{document.filename}</p>
            {pdfBase64 ? (
              <form
                method="POST"
                action="/agent/calculators/pdf-download"
                target="royal-partner-pdf-download-target"
                encType="application/x-www-form-urlencoded"
                onSubmit={() => {
                  setDownloadAttempted(true);
                  setNotice("");
                }}
                style={{ display: "grid" }}
              >
                <input type="hidden" name="filename" value={document.filename} />
                <input type="hidden" name="pdf_base64" value={pdfBase64} />
                <button type="submit" style={primaryButton}>ดาวน์โหลด PDF</button>
              </form>
            ) : (
              <button
                type="button"
                onClick={downloadPdfFallback}
                disabled={preparing}
                style={{ ...primaryButton, width: "100%", opacity: preparing ? 0.6 : 1 }}
              >
                {preparing ? "กำลังเตรียม PDF..." : "ดาวน์โหลด PDF"}
              </button>
            )}
            {downloadAttempted && pdfBase64 && (
              <div style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6, color: "#5D6470" }}>
                ไม่พบไฟล์ใน Downloads?{" "}
                <button type="button" onClick={downloadPdfFallback}
                  style={{ border: 0, padding: 0, background: "none", textDecoration: "underline", color: "#0F1B2E", cursor: "pointer", fontSize: 12 }}>
                  ดาวน์โหลดสำรอง
                </button>
              </div>
            )}
            <p style={{ fontSize: 12, color: "#5D6470", marginBottom: 0, lineHeight: 1.6 }}>
              <strong>หมายเหตุสำหรับอีเมล:</strong> กรุณาตั้งหัวข้อให้ชัดเจน เช่น “ใบสรุปข้อเสนอแบบประกัน — Royal Partner” และตรวจสอบไฟล์แนบก่อนส่ง
            </p>
            {notice && <p role="status" style={{ fontSize: 12, color: "#7A2E2E", lineHeight: 1.6 }}>{notice}</p>}
          </section>
        </div>
      )}
    </>
  );
}

const primaryButton = {
  border: 0, borderRadius: 8, background: "#B8985A", color: "#0F1B2E",
  fontSize: 15, padding: "13px 16px", fontWeight: 700, cursor: "pointer"
} as const;
