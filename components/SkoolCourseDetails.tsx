"use client";

import { courseProgressGroups, selectCourseRows, type CourseLearningRow } from "@/lib/learning-details";
import type { LearningAgentSelection } from "@/lib/learning-filter";

export default function SkoolCourseDetails({ rows, selection }: { rows: CourseLearningRow[] | null; selection: LearningAgentSelection }) {
  const selected = selectCourseRows(rows ?? [], selection);
  return <section aria-label="รายละเอียดความคืบหน้ารายคอร์ส" style={{ marginTop: 16 }}>
    <h3 style={{ margin: "0 0 6px", color: "var(--gold-bright)", fontSize: 16 }}>รายละเอียดการเรียนรายคอร์ส</h3>
    <p style={{ margin: "0 0 10px", color: "var(--cream-muted)", fontSize: 12, lineHeight: 1.7 }}>
      CSV ปัจจุบันบอกความคืบหน้ารายคอร์ส ยังระบุไม่ได้ว่าเรียนจบบทใดภายในคอร์ส
      {!selected.length && " · ยังไม่มีข้อมูลรายคอร์สที่นำเข้าหรือจับคู่ในขอบเขตนี้ จึงยังระบุคอร์สที่ไม่เริ่มเรียนไม่ได้"}
    </p>
    {selected.length > 0 && courseProgressGroups(selected).map(group => <details key={group.key}
      open={selection !== "all" && group.rows.length > 0}
      style={{ border: "1px solid var(--hairline)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
      <summary style={{ cursor: "pointer", color: "var(--cream)", fontWeight: 700, fontSize: 13 }}>{group.label} · {group.rows.length} รายการ</summary>
      {!group.rows.length ? <p style={{ color: "var(--cream-muted)", fontSize: 12 }}>ไม่มีรายการในกลุ่มนี้จากข้อมูลที่นำเข้า</p> : <ul style={{ paddingLeft: 20, margin: "10px 0 0" }}>
        {group.rows.map((row, index) => <li key={`${row.agentId}:${row.courseId}:${index}`} style={{ marginBottom: 7, fontSize: 13, lineHeight: 1.6 }}>
          <strong>{row.courseName}</strong> · {row.progressPercent}%
          {selection === "all" && <span style={{ color: "var(--cream-muted)" }}> · {row.agentName} ({row.agentCode})</span>}
        </li>)}
      </ul>}
    </details>)}
  </section>;
}
