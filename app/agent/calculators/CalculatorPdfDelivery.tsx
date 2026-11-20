"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PdfDocument = { blob: Blob; filename: string };
type PdfMessage = { type?: string; blob?: unknown; filename?: unknown };

const MAX_PDF_BYTES = 80 * 1024 * 1024;

function safePdfFilename(raw: string): string {
  const cleaned = raw.replace(/[\/\\:*?"<>|\u0000-\u001f]/g, "-").slice(0, 190);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : cleaned + ".pdf";
}

export default function CalculatorPdfDelivery() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const urlRef = useRef<string | null>(null);
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

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
      setDocument({ blob, filename: safePdfFilename(data.filename) });
      setNotice("");
      setBusy(false);
    };

    window.addEventListener("message", receivePdf);
    return () => {
      window.removeEventListener("message", receivePdf);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  function closeDialog() {
    setDocument(null);
    setNotice("");
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  function downloadPdf() {
    if (!document) return;
    try {
      // Download is the safe fallback on browsers without file-share support.
      // Keep the same top-level download implementation used in production.
      const appleTouch =
        /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const downloadBlob = appleTouch
        ? new Blob([document.blob], { type: "application/octet-stream" })
        : document.blob;
      const url = pdfUrl(downloadBlob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.filename;
      anchor.style.display = "none";
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setNotice("");
    } catch (error) {
      console.error("PDF download error:", error);
      setNotice("บันทึก PDF ไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  async function saveOrSharePdf() {
    if (!document || busy) return;

    const appleTouch =
      /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const mobileTouch = appleTouch || /Android/i.test(navigator.userAgent);

    // Use the native file share sheet on mobile. Sending ONLY the File is
    // essential: title/text/URL produce an extra LINE chat bubble.
    // iOS decides which share extensions appear; no website can force LINE.
    if (mobileTouch && typeof File !== "undefined" && navigator.share) {
      const file = new File([document.blob], document.filename, { type: "application/pdf" });
      const shareData: ShareData = { files: [file] };
      if (!navigator.canShare || navigator.canShare(shareData)) {
        setBusy(true);
        setNotice("");
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return; // User dismissed share sheet; do not silently save a file.
          }
          console.warn("Native file sharing unavailable, using PDF download:", error);
          // An unexpected share failure may remove user activation, so explain
          // fallback instead of attempting a download that Safari could block.
          setNotice("เปิดเมนูแชร์ไม่สำเร็จ กรุณากดอีกครั้ง หรือเปิดจาก Safari");
          return;
        } finally {
          setBusy(false);
        }
      }
    }

    // Desktop and devices without native file-sharing use a real PDF download.
    downloadPdf();
  }

  return (
    <>
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
        <div
          role="presentation"
          style={{
            position: "fixed", inset: 0, zIndex: 2000, background: "rgba(10,20,35,.65)",
            display: "flex", justifyContent: "center", alignItems: "center", padding: 16
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="บันทึกหรือแชร์ PDF"
            style={{
              width: "100%", maxWidth: 440, borderRadius: 12, padding: 22,
              background: "#FFFDF8", color: "#0F1B2E", boxShadow: "0 18px 70px #0005",
              fontFamily: "system-ui, sans-serif"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontSize: 20, margin: 0 }}>ไฟล์ PDF พร้อมใช้งาน</h2>
              <button type="button" onClick={closeDialog} aria-label="ปิด" style={{
                border: "1px solid #D9D2BF", borderRadius: 8, background: "transparent",
                cursor: "pointer", padding: "8px 12px"
              }}>ปิด</button>
            </div>
            <p style={{ overflowWrap: "anywhere", fontSize: 12, color: "#5D6470" }}>{document.filename}</p>
            <div style={{ display: "grid", gap: 10 }}>
              <button type="button" onClick={saveOrSharePdf} disabled={busy} style={primaryButton}>
                {busy ? "กำลังเปิดเมนูแชร์..." : "ดาวน์โหลด / แชร์ PDF"}
              </button>
            </div>
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

const secondaryButton = {
  border: "1px solid #B8985A", borderRadius: 8, background: "#FFFDF8", color: "#0F1B2E",
  fontSize: 15, padding: "13px 16px", fontWeight: 600, cursor: "pointer"
} as const;
