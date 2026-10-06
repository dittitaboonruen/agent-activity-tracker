"use client";

import { useMemo, useState } from "react";
import { lessonTree, parseLessonOutline, productOutline } from "@/lib/skool-curriculum";

type Props = {
  courseId: number;
  courseName: string;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<void>;
};

export default function SkoolLessonOutline({ courseId, courseName, disabled, onBusyChange, onSaved }: Props) {
  const [outline, setOutline] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const preset = productOutline(courseName);
  const preview = useMemo(() => {
    if (!outline.trim()) return { rows: [], error: "" };
    try {
      const items = parseLessonOutline(outline);
      return { rows: lessonTree(items.map((item, i) => ({ id: i + 1, name: item.name, lesson_order: i + 1, parent_lesson_id: item.parentIndex === null ? null : item.parentIndex + 1 }))), error: "" };
    } catch (error) {
      return { rows: [], error: error instanceof Error ? error.message : "โครงบทเรียนไม่ถูกต้อง" };
    }
  }, [outline]);

  async function save() {
    if (busy || disabled || !preview.rows.length || preview.error) return;
    setBusy(true); onBusyChange(true); setNotice("");
    try {
      const response = await fetch("/api/admin/skool-courses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "lesson-outline", courseId, outline }),
      });
      const body = await response.json();
      if (!response.ok || body.success !== true) throw new Error(body.error || "เพิ่มบทเรียนไม่สำเร็จ");
      setNotice(`เพิ่ม ${body.summary.created} บท · มีอยู่แล้ว ${body.summary.existing} บท`);
      await onSaved();
    } catch (error) { setNotice(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ"); }
    finally { setBusy(false); onBusyChange(false); }
  }

  return (
    <div style={{ padding: 18, borderBottom: "1px solid var(--hairline)" }}>
      <h3 style={{ margin: "0 0 10px" }}>เพิ่มบทเรียนและข้อย่อยพร้อมกัน</h3>
      <p style={{ color: "var(--cream-muted)", lineHeight: 1.7, fontSize: 13 }}>
        วางชื่อจริงจาก Skool บรรทัดละบท ใช้ 2 ช่องว่างหน้าข้อย่อย ระบบแสดงเป็น 1, 1.1, 1.2 รองรับ 5 ระดับ<br />
        เพิ่มเฉพาะรายการที่ยังไม่มี บทเดิมและลิงก์แบบทดสอบคงเดิม บทใหม่เป็น INFO แก้เป็น QUIZ พร้อมใส่ Form ภายหลังได้
      </p>
      {preset && <button type="button" disabled={disabled || busy} onClick={() => {
        if (outline.trim() && !window.confirm("แทนข้อความที่กำลังแก้ด้วยโครงผลิตภัณฑ์?")) return;
        setOutline(preset.outline); setNotice("");
      }} style={buttonStyle}>ใช้โครงชื่อผลิตภัณฑ์: {preset.title}</button>}
      {preset && <p style={{ fontSize: 12, color: "var(--cream-faint)" }}>โครงนี้มาจากไฟล์ผลิตภัณฑ์ของคุณ ตรวจชื่อและเพิ่มข้อย่อยให้ตรงกับ Skool ก่อนบันทึก</p>}
      <label style={{ display: "block", marginTop: 12 }}>
        รายชื่อบทเรียนของ {courseName}
        <textarea value={outline} disabled={disabled || busy} onChange={event => setOutline(event.target.value)}
          placeholder={"ชื่อบทหลักจาก Skool\n  ชื่อข้อย่อยแรก\n  ชื่อข้อย่อยถัดไป\nชื่อบทหลักถัดไป"}
          style={{ display: "block", width: "100%", boxSizing: "border-box", minHeight: 170, padding: 12, marginTop: 8, border: "1px solid var(--hairline)", borderRadius: 9, background: "var(--surface-alt)", color: "var(--cream)", fontFamily: "monospace", lineHeight: 1.8 }} />
      </label>
      {preview.error && <p role="alert">{preview.error}</p>}
      {preview.rows.length > 0 && <div style={{ margin: "14px 0", maxHeight: 250, overflowY: "auto" }}>
        <strong>ตรวจโครงก่อนเพิ่ม ({preview.rows.length} รายการ)</strong>
        <ol style={{ listStyle: "none", padding: 0 }}>
          {preview.rows.map(row => <li key={row.lesson.id} style={{ paddingLeft: row.depth * 20, margin: "6px 0" }}>{row.number} · {row.lesson.name}</li>)}
        </ol>
      </div>}
      <button type="button" disabled={disabled || busy || !preview.rows.length || !!preview.error} onClick={() => void save()} style={buttonStyle}>
        {busy ? "กำลังบันทึก..." : "เพิ่มรายการตามโครงที่ตรวจแล้ว"}
      </button>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
const buttonStyle = { padding: "10px 14px", border: "1px solid var(--hairline)", borderRadius: 9, background: "var(--surface-alt)", color: "var(--gold-bright)", cursor: "pointer", fontWeight: 700 };
