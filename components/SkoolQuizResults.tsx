"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { latestQuizAttempts, type QuizResultRow } from "@/lib/skool-quiz";
import { learningApiUrl, type LearningAgentSelection } from "@/lib/learning-filter";

type ResponseData = { success?: boolean; error?: string; rows?: QuizResultRow[]; scope?: { canSeeAll: boolean } };
const control: CSSProperties = { padding: "10px 12px", minHeight: 42, border: "1px solid var(--hairline)", borderRadius: 9, background: "var(--surface-alt)", color: "var(--cream)", width: "100%" };
const cell: CSSProperties = { padding: "12px 14px", textAlign: "left", borderBottom: "1px solid var(--hairline)", verticalAlign: "top" };
const dateFormat = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
const PAGE_SIZE = 25;

export default function SkoolQuizResults({ refreshKey, agentSelection = "all" }: {
  refreshKey: number;
  agentSelection?: LearningAgentSelection;
}) {
  const [data, setData] = useState<ResponseData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("all");
  const [unit, setUnit] = useState("all");
  const [lesson, setLesson] = useState("all");
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState("latest");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null);
    async function load() {
      try {
        const response = await fetch(learningApiUrl("/api/skool-quiz-results", agentSelection), { cache: "no-store", signal: controller.signal });
        const body: ResponseData = await response.json();
        if (!response.ok || body.success !== true) throw new Error(body.error || "โหลดคะแนนไม่สำเร็จ");
        if (!controller.signal.aborted) setData(body);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "เชื่อมต่อระบบคะแนนไม่สำเร็จ");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey, reload, agentSelection]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const options = useMemo(() => ({
    courses: [...new Map(rows.map(r => [String(r.courseId), r.courseName])).entries()],
    lessons: [...new Map(rows.filter(r => course === "all" || String(r.courseId) === course)
      .map(r => [String(r.lessonId), [r.parentLessonName, r.lessonName].filter(Boolean).join(" / ")])).entries()],
    units: [...new Set(rows.map(r => r.unitName))].sort((a,b) => a.localeCompare(b,"th")),
  }), [rows, course]);
  const filtered = useMemo(() => {
    // Choose latest BEFORE the pass/fail filter: an older pass must not conceal a latest failure.
    const base = mode === "latest" ? latestQuizAttempts(rows) : rows;
    const keyword = search.normalize("NFKC").trim().toLocaleLowerCase("th-TH");
    return base.filter(r =>
      (!keyword || [r.agentCode, r.agentName, r.agentNickname].some(v => v.normalize("NFKC").toLocaleLowerCase("th-TH").includes(keyword))) &&
      (course === "all" || String(r.courseId) === course) &&
      (lesson === "all" || String(r.lessonId) === lesson) &&
      (unit === "all" || r.unitName === unit) &&
      (status === "all" || r.passed === (status === "passed")));
  }, [rows, search, course, lesson, unit, status, mode]);
  const passed = filtered.filter(r => r.passed).length;
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const activePage = Math.min(page, lastPage);
  const shown = filtered.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  function reset() { setSearch(""); setCourse("all"); setUnit("all"); setLesson("all"); setStatus("all"); setMode("latest"); setPage(0); }

  return <section aria-labelledby="quiz-results-title" style={{ marginBottom: 24, padding: 20, border: "1px solid var(--hairline)", borderRadius: 17, background: "var(--surface)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <h2 id="quiz-results-title" style={{ margin: 0, fontSize: 23, color: "var(--gold-bright)" }}>คะแนนข้อสอบ Google Form</h2>
      <button type="button" disabled={loading} onClick={() => setReload(v => v + 1)} style={{ ...control, width: "auto", cursor: "pointer" }}>↻ รีเฟรชคะแนน</button>
    </div>
    <p style={{ color: "var(--cream-muted)", lineHeight: 1.7 }}>ติ๊กเรียนจบใน Skool และผลสอบเป็นคนละข้อมูล ผลสอบผูกกับข้อย่อยที่ตั้งเป็น QUIZ และไม่ต้องรอนำเข้า CSV</p>
    {error ? <p role="alert" style={{ color: "var(--rp-danger)" }}>{error}</p> : loading ? <p role="status">กำลังโหลดคะแนน...</p> : <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 12, marginBottom: 16 }}>
        <label>ค้นหาตัวแทน<input style={control} value={search} placeholder="ชื่อ / ชื่อเล่น / รหัส" onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
        {data?.scope?.canSeeAll ? <label>หน่วย<select style={control} value={unit} onChange={e => { setUnit(e.target.value); setPage(0); }}><option value="all">ทุกหน่วย</option>{options.units.map(u => <option key={u}>{u}</option>)}</select></label> : null}
        <label>คอร์ส<select style={control} value={course} onChange={e => { setCourse(e.target.value); setLesson("all"); setPage(0); }}><option value="all">ทุกคอร์ส</option>{options.courses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>บทเรียน / ข้อย่อย<select style={control} value={lesson} onChange={e => { setLesson(e.target.value); setPage(0); }}><option value="all">ทุกบทเรียน</option>{options.lessons.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>ผลสอบ<select style={control} value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="all">ทุกผลสอบ</option><option value="passed">ผ่าน</option><option value="failed">ไม่ผ่าน</option></select></label>
        <label>ครั้งสอบ<select style={control} value={mode} onChange={e => { setMode(e.target.value); setPage(0); }}><option value="latest">ครั้งล่าสุดต่อคน / บทเรียน</option><option value="all">ประวัติทุกครั้ง</option></select></label>
      </div>
      <button type="button" onClick={reset} style={{ background: "transparent", border: 0, color: "var(--gold-bright)", cursor: "pointer", marginBottom: 14 }}>ล้างตัวกรองคะแนน</button>
      <div aria-live="polite" style={{ marginBottom: 14, color: "var(--cream-muted)" }}>ตัวแทน {new Set(filtered.map(r => r.agentId)).size} คน · ผลสอบ {filtered.length} รายการ · ผ่าน {passed} · ไม่ผ่าน {filtered.length - passed} · เฉลี่ย {filtered.length ? (filtered.reduce((sum, r) => sum + r.scorePercent, 0) / filtered.length).toFixed(1) : "0"}%</div>
      {!filtered.length ? <p style={{ padding: 16 }}> {rows.length ? "ไม่พบคะแนนตามตัวกรอง" : "ยังไม่มีผลสอบในขอบเขตของคุณ เมื่อส่งคำตอบผ่านสคริปต์สำเร็จให้กดรีเฟรชคะแนน"} </p> : <>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["ตัวแทน", "หน่วย", "คอร์ส / บทหลัก", "ข้อสอบ", "คะแนน", "%", "ผลสอบ", "วันที่สอบ (ไทย)"].map(label => <th scope="col" key={label} style={{ ...cell, color: "var(--gold-bright)" }}>{label}</th>)}</tr></thead>
          <tbody>{shown.map(r => <tr key={r.id}>
            <td style={cell}><strong>{r.agentName}</strong><div>{r.agentCode}{r.agentNickname ? ` · ${r.agentNickname}` : ""}</div></td>
            <td style={cell}>{r.unitName}</td><td style={cell}>{r.courseName}<div style={{ marginTop: 4, color: "var(--cream-faint)" }}>{r.parentLessonName}</div></td>
            <td style={cell}>{r.lessonName}{!r.lessonActive ? <div>บทเรียนปิดใช้</div> : null}</td>
            <td style={cell}>{r.score} / {r.maxScore}</td><td style={cell}>{r.scorePercent}%</td>
            <td style={{ ...cell, color: r.passed ? "#70C89A" : "var(--rp-danger)", fontWeight: 700 }}>{r.passed ? "ผ่าน" : "ไม่ผ่าน"}</td>
            <td style={cell}>{dateFormat.format(new Date(r.submittedAt))}</td>
          </tr>)}</tbody>
        </table></div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center", marginTop: 14 }}>
          <button type="button" disabled={activePage === 0} onClick={() => setPage(activePage - 1)} style={{ ...control, width: "auto" }}>ก่อนหน้า</button>
          <span>หน้า {activePage + 1} / {lastPage + 1}</span>
          <button type="button" disabled={activePage === lastPage} onClick={() => setPage(activePage + 1)} style={{ ...control, width: "auto" }}>ถัดไป</button>
        </div>
      </>}
      <p style={{ color: "var(--cream-faint)", fontSize: 12, marginBottom: 0 }}>นับเฉพาะผลสอบที่รับสำเร็จ ยังไม่มีผลสอบไม่ได้หมายถึงสอบไม่ผ่าน คะแนนจากข้อที่ยังไม่ตรวจจะรอในสคริปต์ก่อนส่ง</p>
    </>}
  </section>;
}
