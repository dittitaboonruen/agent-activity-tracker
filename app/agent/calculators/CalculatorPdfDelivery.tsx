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
      // iOS Safari sometimes opens a PDF Blob in a viewer instead of downloading it.
      // Only the download copy uses octet-stream; the original PDF remains intact
      // for LINE/Mail file sharing and keeps the .pdf filename.
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
      setNotice("ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่ หรือส่งไฟล์ผ่าน LINE / อีเมล");
    }
  }

  function openPdfInSafari() {
    if (!document) return;
    try {
      // Triggered by a direct tap: Safari is more likely to allow this than
      // an automatic popup after asynchronous PDF rendering.
      const url = pdfUrl(document.blob);
      const opened = window.open(url, "_blank");
      if (!opened) {
        setNotice("หาก PDF ไม่เปิด กรุณาอนุญาตหน้าต่างใหม่ใน Safari หรือลองปุ่มดาวน์โหลด");
      } else {
        setNotice("");
      }
    } catch (error) {
      console.error("PDF open error:", error);
      setNotice("เปิด PDF ไม่สำเร็จ กรุณาลองดาวน์โหลดหรือแชร์ไฟล์แทน");
    }
  }

  async function sharePdf() {
    if (!document || busy) return;
    if (!navigator.share || typeof File === "undefined") {
      setNotice("อุปกรณ์นี้ไม่มีเมนูแชร์ไฟล์ กรุณาใช้ “ดาวน์โหลด PDF” แล้วส่งผ่าน LINE หรืออีเมลจากแอปโดยตรง");
      return;
    }

    const file = new File([document.blob], document.filename, { type: "application/pdf" });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      setNotice("เบราว์เซอร์นี้ไม่รองรับการแชร์ไฟล์ PDF กรุณาใช้ “ดาวน์โหลด PDF” แทน");
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      // Attach a human-readable message alongside the actual PDF file.
      // The receiving app (including LINE) controls whether it displays
      // the text; iPad/LINE device-level verification is still required.
      await navigator.share({
        files: [file],
        title: "ใบสรุปกรมธรรม์",
        text: "ขอส่งใบสรุปกรมธรรม์ค่ะ/ครับ",
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setNotice("เมนูแชร์ไม่พร้อมใช้งาน กรุณาใช้ “ดาวน์โหลด PDF” แล้วแชร์ไฟล์จากอุปกรณ์แทน");
      }
    } finally {
      setBusy(false);
    }
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
              <button type="button" onClick={downloadPdf} style={primaryButton}>
                ดาวน์โหลด PDF
              </button>
              <button type="button" onClick={openPdfInSafari} style={secondaryButton}>
                เปิด PDF ใน Safari (สำหรับ iPad)
              </button>
              <button type="button" onClick={sharePdf} disabled={busy} style={secondaryButton}>
                {busy ? "กำลังเปิดเมนูแชร์..." : "ส่งผ่าน LINE / อีเมล"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#5D6470", marginBottom: 0, lineHeight: 1.6 }}>
              <strong>หมายเหตุสำหรับอีเมล:</strong> ก่อนกดส่ง กรุณาตั้งหัวข้ออีเมลให้ชัดเจน
              เช่น “ใบสรุปข้อเสนอแบบประกัน — Royal Partner” และตรวจสอบว่าแนบไฟล์ PDF แล้ว
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
