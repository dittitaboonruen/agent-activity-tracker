"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatThaiDateLong } from "@/lib/date-utils";
import type { PepNote } from "@/types";
import type { PepExportContext, PepPdfReport } from "@/lib/pep-pdf";

type Props = {
  context: PepExportContext;
  notes: PepNote[];
  busy: boolean;
  historyLoading: boolean;
  historyError: string | null;
};
type Preview = { url: string; filename: string; report: PepPdfReport; identity: string; imageUrl: string; pages: number };

export default function PepPdfExport({ context, notes, busy, historyLoading, historyError }: Props) {
  const selectId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const chosenId = selectedId ?? (notes[0] ? String(notes[0].id) : "none");
  const note = notes.find(item => String(item.id) === chosenId) ?? null;
  const identity = JSON.stringify([context, chosenId, note?.updatedAt]);
  const latestIdentityRef = useRef(identity);
  latestIdentityRef.current = identity;
  // Immediately hide obsolete previews; cancel pending work and release PDF bytes.
  useEffect(() => {
    controllerRef.current?.abort();
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setPreview(null); setError(null); setPreparing(false);
    return () => {
      controllerRef.current?.abort();
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [identity]);
  const disabled = busy || historyLoading || !!historyError || preparing || context.activityState === "loading";
  const currentPreview = preview?.identity === identity ? preview : null;

  async function prepare() {
    if (disabled) return;
    if (chosenId !== "none" && !note) { setError("บันทึก PEP ที่เลือกถูกลบแล้ว กรุณาเลือกรายการใหม่"); return; }
    const capturedIdentity = identity;
    const controller = new AbortController();
    controllerRef.current?.abort(); controllerRef.current = controller;
    setPreparing(true); setError(null); setPreview(null);
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    try {
      const { loadPepPdfReport, createPepPdf, pepPdfFilename } = await import("@/lib/pep-pdf");
      const report = await loadPepPdfReport(context, note, controller.signal);
      if (controller.signal.aborted || latestIdentityRef.current !== capturedIdentity) return;
      let imageUrl = "", pages = 0;
      const blob = await createPepPdf(report, (image, count) => { imageUrl = image; pages = count; });
      if (controller.signal.aborted || latestIdentityRef.current !== capturedIdentity) return;
      const url = URL.createObjectURL(blob); urlRef.current = url;
      setPreview({ url, report, filename: pepPdfFilename(context), identity: capturedIdentity, imageUrl, pages });
    } catch (err) {
      if (!controller.signal.aborted && latestIdentityRef.current === capturedIdentity) setError(err instanceof Error ? err.message : "สร้าง PDF ไม่สำเร็จ");
    } finally {
      if (!controller.signal.aborted && latestIdentityRef.current === capturedIdentity) setPreparing(false);
    }
  }

  return <section aria-labelledby={`${selectId}-title`} style={{ marginTop: 18, marginBottom: 20, padding: 16, border: "1px solid var(--hairline)", borderRadius: 12, background: "var(--surface-alt)" }}>
    <h3 id={`${selectId}-title`} style={{ margin: "0 0 10px", fontSize: 17 }}>ดาวน์โหลดสรุป PEP (PDF)</h3>
    <p style={{ fontSize: 12, color: "var(--cream-muted)", lineHeight: 1.7 }}>
      สรุปเฉพาะ {context.agentName} และช่วงวันที่ที่เลือก • การเรียนและ Quiz ใช้สถานะล่าสุด
      <br />PDF ใช้คอมเมนต์ที่บันทึกแล้ว หากกำลังแก้ไขให้กดบันทึกก่อนสร้างรายงาน
    </p>
    <label htmlFor={selectId}>บันทึก PEP ที่ต้องการแนบ</label>
    <select id={selectId} value={chosenId} disabled={disabled} onChange={event => setSelectedId(event.target.value)}
      style={{ display: "block", width: "100%", margin: "8px 0 12px", padding: 10, fontFamily: "inherit", color: "var(--cream)", background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
      <option value="none">ไม่แนบคอมเมนต์ PEP</option>
      {notes.map(item => <option key={item.id} value={String(item.id)}>{formatThaiDateLong(item.pepDate)} • รายการ #{item.id}</option>)}
    </select>
    <button type="button" className="dash-refresh-btn" onClick={() => void prepare()} disabled={disabled} style={{ fontFamily: "inherit" }}>
      {preparing ? "กำลังสร้าง PDF…" : "สร้างตัวอย่าง PDF"}
    </button>
    {preparing && <p role="status">กำลังดึงข้อมูลและจัดหน้า PDF ภาษาไทย…</p>}
    {historyError && <p role="alert">โหลดประวัติ PEP ไม่สำเร็จ กรุณากดโหลดประวัติใหม่ด้านล่างก่อนสร้าง PDF</p>}
    {error && <p role="alert" style={{ color: "var(--rp-danger)" }}>{error}</p>}
    {currentPreview && <div style={{ marginTop: 16 }}>
      <p role="status">PDF พร้อมดาวน์โหลดแล้ว</p>
      {(currentPreview.report.skoolError || currentPreview.report.quizError || currentPreview.report.targetError) &&
        <p role="alert">บางส่วนโหลดไม่สำเร็จ รายงานจะระบุสถานะของส่วนนั้น สามารถสร้างตัวอย่างใหม่เพื่อลองโหลดอีกครั้ง</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <a className="dash-save-btn" href={currentPreview.url} download={currentPreview.filename} style={{ fontFamily: "inherit", textDecoration: "none", display: "inline-block" }}>ดาวน์โหลดสรุป PEP (PDF)</a>
        <a className="dash-refresh-btn" href={currentPreview.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "inherit", textDecoration: "none" }}>เปิดตัวอย่างในแท็บใหม่</a>
      </div>
      <p style={{ fontSize: 12 }}>ตัวอย่างหน้า 1 จาก {currentPreview.pages} หน้า • เปิดในแท็บใหม่เพื่อดูรายงานครบทุกหน้า</p>
      <img alt={`ตัวอย่างหน้าแรกของ PDF สรุป PEP ของ ${context.agentName}`} src={currentPreview.imageUrl} style={{ display: "block", width: "100%", height: "auto", background: "white", border: "1px solid var(--hairline)", borderRadius: 8 }} />
    </div>}
  </section>;
}
