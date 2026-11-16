"use client";

import Link from "next/link";
import SkoolLessonOutline from "@/components/SkoolLessonOutline";
import { lessonTree, recommendedCourseIds } from "@/lib/skool-curriculum";
import SkoolCsvImport, { SKOOL_IMPORT_EVENT, type ImportResult } from "@/components/SkoolCsvImport";
import type { CourseImportStats } from "@/lib/skool-import-stats";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type Course = {
  id: number;
  course_code: string | null;
  course_name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

type Lesson = {
  id: number;
  course_id: number;
  parent_lesson_id: number | null;
  lesson_name: string;
  lesson_type: "INFO" | "QUIZ";
  lesson_order: number;
  quiz_url: string | null;
  google_form_id: string | null;
  active: boolean;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  courses?: Course[];
  lessons?: Lesson[];
  importStats?: Record<string, CourseImportStats>;
  warning?: string;
};

const emptyCourse = {
  courseName: "",
  courseCode: "",
  description: "",
  sortOrder: "1",
  active: true,
};

const emptyLesson = {
  courseId: "",
  parentLessonId: "",
  lessonName: "",
  lessonType: "INFO" as "INFO" | "QUIZ",
  lessonOrder: "1",
  quizUrl: "",
  googleFormId: "",
  active: true,
};

export default function SkoolCoursesAdminPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [importStats, setImportStats] = useState<Record<string, CourseImportStats>>({});
  const [warning, setWarning] = useState("");
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const loadGeneration = useRef(0);

  const loadData = useCallback(async (preferredCourseId?: number) => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/skool-courses", {
        cache: "no-store",
      });
      const body = (await response.json()) as ApiResponse;
      if (generation !== loadGeneration.current) return;

      if (!response.ok || body.success !== true) {
        setError(body.error || "ไม่สามารถโหลดข้อมูลได้");
        return;
      }

      const nextCourses = body.courses ?? [];
      setCourses(nextCourses);
      setLessons(body.lessons ?? []);
      setImportStats(body.importStats ?? {});
      setWarning(body.warning ?? "");
      const urlCourseId = Number(new URLSearchParams(window.location.search).get("course"));
      setSelectedCourseId((current) => {
        const preferred = preferredCourseId ?? current ?? urlCourseId;
        return preferred && nextCourses.some((course) => course.id === preferred)
          ? preferred
          : nextCourses[0]?.id ?? null;
      });
    } catch {
      if (generation === loadGeneration.current) setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const refresh = () => { void loadData(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SKOOL_IMPORT_EVENT) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, [loadData]);

  async function onImported(result: ImportResult) {
    const firstId = result.importedCourses[0]?.id;
    await loadData(firstId);
    if (firstId) resetLessonForm(firstId);
  }

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const selectedLessons = useMemo(
    () =>
      lessons
        .filter((lesson) => lesson.course_id === selectedCourseId)
        .sort((a, b) => a.lesson_order - b.lesson_order || a.id - b.id),
    [lessons, selectedCourseId]
  );

  const treeRows = useMemo(() => lessonTree(selectedLessons), [selectedLessons]);

  async function reorder(ids: number[]) {
    if (saving || loading) return;
    clearNotice(); setSaving(true);
    try {
      await request("PATCH", { entity: "reorder", courseIds: ids });
      await loadData(); setMessage("จัดลำดับคอร์สเรียบร้อยแล้ว");
    } catch (error) { setError(error instanceof Error ? error.message : "จัดลำดับไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  function moveCourse(index: number, delta: number) {
    const ids = courses.map(c => c.id);
    const destination = index + delta;
    if (destination < 0 || destination >= ids.length) return;
    [ids[index], ids[destination]] = [ids[destination], ids[index]];
    void reorder(ids);
  }

  function clearNotice() {
    setError("");
    setMessage("");
  }

  function resetCourseForm() {
    setEditingCourseId(null);
    setCourseForm({
      ...emptyCourse,
      sortOrder: String(Math.max(0, ...courses.map((course) => course.sort_order)) + 1),
    });
  }

  function resetLessonForm(courseId = selectedCourseId) {
    setEditingLessonId(null);
    setLessonForm({
      ...emptyLesson,
      courseId: courseId ? String(courseId) : "",
      lessonOrder: String(Math.max(0, ...lessons.filter((lesson) => lesson.course_id === courseId).map((lesson) => lesson.lesson_order)) + 1),
    });
  }

  async function request(method: "POST" | "PATCH" | "DELETE", payload: object) {
    const response = await fetch("/api/admin/skool-courses", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as ApiResponse;

    if (!response.ok || body.success !== true) {
      throw new Error(body.error || "ไม่สามารถบันทึกข้อมูลได้");
    }
  }

  async function saveCourse(event: FormEvent) {
    event.preventDefault();
    clearNotice();
    setSaving(true);

    try {
      await request(editingCourseId ? "PATCH" : "POST", {
        entity: "course",
        id: editingCourseId,
        ...courseForm,
        sortOrder: Number(courseForm.sortOrder),
      });
      setMessage(editingCourseId ? "แก้ไขคอร์สเรียบร้อยแล้ว" : "เพิ่มคอร์สเรียบร้อยแล้ว");
      resetCourseForm();
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกคอร์สได้");
    } finally {
      setSaving(false);
    }
  }

  async function saveLesson(event: FormEvent) {
    event.preventDefault();
    clearNotice();
    setSaving(true);

    try {
      await request(editingLessonId ? "PATCH" : "POST", {
        entity: "lesson",
        id: editingLessonId,
        ...lessonForm,
        courseId: Number(lessonForm.courseId),
        lessonOrder: Number(lessonForm.lessonOrder),
      });
      setMessage(editingLessonId ? "แก้ไขบทเรียนเรียบร้อยแล้ว" : "เพิ่มบทเรียนเรียบร้อยแล้ว");
      resetLessonForm(Number(lessonForm.courseId));
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกบทเรียนได้");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(entity: "course" | "lesson", id: number, label: string) {
    if (!window.confirm(`ต้องการปิดใช้งาน “${label}” ใช่หรือไม่?\nข้อมูลเดิมจะไม่ถูกลบ`)) return;

    clearNotice();
    setSaving(true);

    try {
      await request("DELETE", { entity, id });
      setMessage(`ปิดใช้งาน ${label} เรียบร้อยแล้ว`);
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถปิดใช้งานได้");
    } finally {
      setSaving(false);
    }
  }

  function editCourse(course: Course) {
    clearNotice();
    setEditingCourseId(course.id);
    setCourseForm({
      courseName: course.course_name,
      courseCode: course.course_code ?? "",
      description: course.description ?? "",
      sortOrder: String(course.sort_order),
      active: course.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editLesson(lesson: Lesson) {
    clearNotice();
    setSelectedCourseId(lesson.course_id);
    setEditingLessonId(lesson.id);
    setLessonForm({
      courseId: String(lesson.course_id),
      parentLessonId: lesson.parent_lesson_id ? String(lesson.parent_lesson_id) : "",
      lessonName: lesson.lesson_name,
      lessonType: lesson.lesson_type,
      lessonOrder: String(lesson.lesson_order),
      quizUrl: lesson.quiz_url ?? "",
      googleFormId: lesson.google_form_id ?? "",
      active: lesson.active,
    });
  }

  return (
    <main className="rp-course-v2" style={pageStyle}>
      <style>{`
        .rp-course-v2 .rp-c-panel {border:1px solid var(--hairline);border-radius:18px;background:var(--surface);overflow:hidden}
        .rp-course-v2 .rp-c-panel.gold {box-shadow:0 7px 22px rgba(156,115,44,.07)}
        .rp-course-v2 .rp-c-eyebrow {letter-spacing:1.7px;font-size:11px;font-weight:850;color:var(--gold)}
        .rp-course-v2 .rp-c-hero {position:relative;overflow:hidden;background:linear-gradient(115deg,var(--rp-soft-gold),var(--surface) 72%)}
        .rp-course-v2 .rp-c-hero:after {content:"";position:absolute;right:-55px;top:-65px;width:260px;height:180px;border:3px solid rgba(196,149,55,.12);border-radius:50%;pointer-events:none}
        .rp-course-v2 .rp-c-form-header {display:flex;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid var(--hairline);font-weight:850}
        .rp-course-v2 .rp-c-icon {width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:20px;flex-shrink:0}
        .rp-course-v2 .rp-c-course-list {max-height:540px;overflow:auto;padding:10px}
        .rp-course-v2 .rp-c-course-btn {width:100%;border:1px solid transparent;border-radius:11px;background:transparent;text-align:left;padding:12px;cursor:pointer;color:var(--cream);display:flex;align-items:center;gap:10px}
        .rp-course-v2 .rp-c-course-btn[data-selected="true"] {background:var(--rp-soft-gold);border-color:var(--gold);font-weight:800}
        .rp-course-v2 .rp-c-course-btn:hover {border-color:var(--gold)}
        .rp-course-v2 .rp-c-chip {font-size:11px;font-weight:800;border-radius:999px;padding:5px 9px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
        .rp-course-v2 .rp-c-action {display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--hairline);border-radius:10px;padding:9px 12px;background:var(--surface);color:var(--gold-bright);font-weight:750;text-decoration:none;cursor:pointer}
        .rp-course-v2 .rp-c-action:hover {border-color:var(--gold)}
        .rp-course-v2 .rp-c-bottom {display:grid;grid-template-columns:minmax(230px,.85fr) minmax(0,2fr);gap:16px;margin-top:17px;align-items:start}
        .rp-course-v2 .rp-c-stat-grid {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}
        .rp-course-v2 .rp-c-stat {padding:14px;border-radius:14px;border:1px solid var(--hairline);background:var(--surface)}
        .rp-course-v2 .rp-c-lesson-table {width:100%;min-width:690px;border-collapse:collapse;font-size:13px}
        .rp-course-v2 .rp-c-lesson-table th {padding:12px;background:var(--surface-alt);color:var(--cream-muted);font-size:11px;text-align:left}
        .rp-course-v2 .rp-c-lesson-table td {padding:13px 12px;border-top:1px solid var(--hairline-soft)}
        .rp-course-v2 .rp-c-lesson-table tr:hover td {background:var(--rp-soft-gold)}
        .rp-course-v2 section[aria-label="นำเข้า CSV"]{border:1px solid rgba(199,137,83,.38);background:linear-gradient(110deg,rgba(213,135,74,.09),var(--surface) 55%);border-radius:17px}
        .rp-course-v2 section[aria-label="นำเข้า CSV"] h2{display:flex;align-items:center;gap:11px;font-size:19px!important}
        .rp-course-v2 section[aria-label="นำเข้า CSV"] h2:before{content:"☁";display:inline-flex;align-items:center;justify-content:center;width:43px;height:43px;border-radius:13px;background:rgba(205,128,73,.14);color:#c17b4b;font-size:24px;flex-shrink:0}
        .rp-course-v2 section[aria-label="นำเข้า CSV"] button[type="submit"]{box-shadow:0 4px 10px rgba(170,120,40,.14)}
        .rp-course-v2 .rp-c-form.gold > header {background:linear-gradient(90deg,rgba(183,147,57,.11),transparent)}
        .rp-course-v2 .rp-c-form.blue > header {background:linear-gradient(90deg,rgba(88,147,205,.12),transparent)}
        .rp-course-v2 .rp-c-form.gold {border-top:4px solid #b8892d}
        .rp-course-v2 .rp-c-form.blue {border-top:4px solid #5c91c5}
        @media(max-width:760px){.rp-course-v2 .rp-c-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rp-course-v2 .rp-c-bottom{grid-template-columns:1fr}.rp-course-v2 .rp-c-course-list{max-height:330px}}
      `}</style>
      <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto" }}>
        <nav style={navStyle}>
          <Link href="/" style={outlineLinkStyle}>← หน้าหลัก</Link>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/skool-import" style={outlineLinkStyle}>⇧ Import CSV</Link>
            <Link href="/dashboard/skool" style={outlineLinkStyle}>▦ Dashboard</Link>
          </div>
        </nav>

        <header className="rp-c-hero" style={headerStyle}>
          <div style={eyebrowStyle}>ROYAL PARTNER · LEARNING ADMIN</div>
          <h1 style={titleStyle}>📚 Skool Course & Lesson Manager</h1>
          <p style={subtitleStyle}>
            นำเข้า CSV ให้คอร์สและความคืบหน้าแสดงทันที แล้วค่อยเพิ่มบทเรียนและแก้รายละเอียด
          </p>
        </header>

        {(error || message) && (
          <div style={error ? errorStyle : successStyle}>{error ? `⚠️ ${error}` : `✅ ${message}`}</div>
        )}

        <SkoolCsvImport onImported={onImported} disabled={saving} />
        {warning && <p role="alert" style={noteStyle}>{warning}</p>}

        <div style={formGridStyle}>
          <form onSubmit={saveCourse} className="rp-c-form gold" style={panelStyle}>
            <PanelHeader
              title={editingCourseId ? "📚 แก้ไขคอร์ส" : "📚 เพิ่มคอร์ส"}
              caption="ชื่อคอร์สต้องตรงกับช่อง Classroom ทุกตัวอักษร"
            />
            <div style={panelBodyStyle}>
              <Field label="ชื่อคอร์ส / Classroom *">
                <input
                  style={inputStyle}
                  value={courseForm.courseName}
                  onChange={(event) => setCourseForm({ ...courseForm, courseName: event.target.value })}
                  placeholder="เช่น แผนคุ้มครองรายได้ | Income Protection"
                  required
                />
              </Field>
              <div style={twoFieldStyle}>
                <Field label="รหัสคอร์ส">
                  <input
                    style={inputStyle}
                    value={courseForm.courseCode}
                    onChange={(event) => setCourseForm({ ...courseForm, courseCode: event.target.value })}
                    placeholder="เช่น IP-001"
                  />
                </Field>
                <Field label="ลำดับคอร์ส *">
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    value={courseForm.sortOrder}
                    onChange={(event) => setCourseForm({ ...courseForm, sortOrder: event.target.value })}
                    required
                  />
                </Field>
              </div>
              <Field label="คำอธิบาย">
                <textarea
                  style={{ ...inputStyle, minHeight: 88, paddingTop: 12, resize: "vertical" }}
                  value={courseForm.description}
                  onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })}
                  placeholder="อธิบายวัตถุประสงค์ของคอร์ส"
                />
              </Field>
              <ActiveField
                checked={courseForm.active}
                onChange={(active) => setCourseForm({ ...courseForm, active })}
              />
              <FormActions
                saving={saving}
                editing={editingCourseId !== null}
                onCancel={resetCourseForm}
              />
            </div>
          </form>

          <form onSubmit={saveLesson} className="rp-c-form blue" style={panelStyle}>
            <PanelHeader
              title={editingLessonId ? "▶️ แก้ไขบทเรียน" : "▶️ เพิ่มบทเรียนทีละบท"}
              caption="กดบันทึกครั้งเดียว · INFO ไม่มีแบบทดสอบ · QUIZ ใส่ Google Form"
            />
            <div style={panelBodyStyle}>
              <Field label="คอร์ส *">
                <select
                  style={inputStyle}
                  value={lessonForm.courseId}
                  onChange={(event) => {
                    const courseId = Number(event.target.value) || null;
                    setSelectedCourseId(courseId);
                    resetLessonForm(courseId);
                  }}
                  required
                >
                  <option value="">เลือกคอร์ส</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.course_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="บทหลัก (เว้นว่างถ้าเป็นบทระดับแรก)">
                <select style={inputStyle} value={lessonForm.parentLessonId}
                  onChange={event => setLessonForm({ ...lessonForm, parentLessonId: event.target.value })}>
                  <option value="">บทระดับแรก</option>
                  {treeRows.filter(row => row.lesson.id !== editingLessonId).map(row => (
                    <option key={row.lesson.id} value={row.lesson.id}>{row.number} · {row.lesson.lesson_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="ชื่อบทเรียน *">
                <input
                  style={inputStyle}
                  value={lessonForm.lessonName}
                  onChange={(event) => setLessonForm({ ...lessonForm, lessonName: event.target.value })}
                  placeholder="เช่น Welcome to Royal Partner"
                  required
                />
              </Field>
              <div style={twoFieldStyle}>
                <Field label="ประเภท *">
                  <select
                    style={inputStyle}
                    value={lessonForm.lessonType}
                    onChange={(event) =>
                      setLessonForm({
                        ...lessonForm,
                        lessonType: event.target.value as "INFO" | "QUIZ",
                        quizUrl: event.target.value === "INFO" ? "" : lessonForm.quizUrl,
                      })
                    }
                  >
                    <option value="INFO">INFO</option>
                    <option value="QUIZ">QUIZ</option>
                  </select>
                </Field>
                <Field label="ลำดับบท *">
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    value={lessonForm.lessonOrder}
                    onChange={(event) => setLessonForm({ ...lessonForm, lessonOrder: event.target.value })}
                    required
                  />
                  <small style={{ color: "#a1a1aa" }}>ระบบขยับบทอื่นให้เมื่อแทรกหรือย้ายลำดับ</small>
                </Field>
              </div>
              {lessonForm.lessonType === "QUIZ" && (
                <>
                <Field label="Google Form URL *">
                  <input
                    style={inputStyle}
                    type="url"
                    value={lessonForm.quizUrl}
                    onChange={(event) => setLessonForm({ ...lessonForm, quizUrl: event.target.value })}
                    placeholder="https://forms.gle/..."
                    required
                  />
                </Field>
                <Field label="Google Form ID สำหรับรับคะแนนอัตโนมัติ">
                  <input style={inputStyle} value={lessonForm.googleFormId}
                    onChange={(event) => setLessonForm({ ...lessonForm, googleFormId: event.target.value })}
                    placeholder="รหัสจากลิงก์หน้าแก้ไข Google Form" />
                  <small style={{ color: "#a1a1aa" }}>ใช้รหัสระหว่าง /forms/d/ และ /edit จากหน้าแก้ไขฟอร์ม</small>
                </Field>
                </>
              )}
              <ActiveField
                checked={lessonForm.active}
                onChange={(active) => setLessonForm({ ...lessonForm, active })}
              />
              <FormActions
                saving={saving}
                editing={editingLessonId !== null}
                onCancel={() => resetLessonForm()}
                createLabel="เพิ่มบทเรียน"
                disabled={courses.length === 0}
              />
            </div>
          </form>
        </div>


        <section className="rp-c-stat-grid" aria-label="สรุปคอร์สและบทเรียน">
          {[
            {label:"คอร์สทั้งหมด",value:courses.length,icon:"📚",unit:"คอร์ส",tint:"rgba(200,156,72,.12)",color:"var(--gold-bright)"},
            {label:"บทเรียนทั้งหมด",value:lessons.length,icon:"▶️",unit:"บทเรียน",tint:"rgba(77,139,205,.12)",color:"#5c91c5"},
            {label:"บทเรียนที่ใช้งาน",value:lessons.filter(x=>x.active).length,icon:"✅",unit:"บทเรียน",tint:"rgba(40,145,94,.12)",color:"#318f64"},
            {label:"บทเรียนแบบ QUIZ",value:lessons.filter(x=>x.lesson_type==="QUIZ").length,icon:"📝",unit:"บทเรียน",tint:"rgba(213,133,55,.11)",color:"#c58132"}
          ].map(k=><div key={k.label} className="rp-c-stat">
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span className="rp-c-icon" style={{background:k.tint,color:k.color}} aria-hidden="true">{k.icon}</span>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12,color:"var(--cream-muted)"}}>{k.label}</div>
                <div style={{fontSize:24,fontWeight:900,color:"var(--cream)"}}>{loading?"…":k.value}<span style={{fontSize:11,color:"var(--cream-muted)",fontWeight:600,marginLeft:5}}>{k.unit}</span></div>
              </div>
            </div>
          </div>)}
        </section>

        <div className="rp-c-bottom">
          <section className="rp-c-panel gold">
            <div style={{padding:"17px 16px",borderBottom:"1px solid var(--hairline)"}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <span className="rp-c-icon" style={{background:"rgba(201,156,72,.14)",color:"var(--gold-bright)"}} aria-hidden="true">▤</span>
                <div><h2 style={{fontSize:17,margin:0}}>คอร์สทั้งหมด ({courses.length})</h2><p style={{margin:"3px 0 0",fontSize:11,color:"var(--cream-muted)"}}>เลือกคอร์สเพื่อดูและแก้ไขบทเรียน</p></div>
              </div>
              <label style={{display:"block",marginTop:12}}>
                <span style={{fontSize:11,color:"var(--cream-muted)"}}>ค้นหาคอร์ส</span>
                <input type="search" style={{...inputStyle,marginTop:5}} placeholder="ค้นหาชื่อหรือรหัสคอร์ส" value={courseSearch} onChange={e=>setCourseSearch(e.target.value)}/>
              </label>
            </div>
            {loading?<div style={emptyStyle}>กำลังโหลดคอร์ส...</div>:courses.length===0?<div style={emptyStyle}>ยังไม่มีคอร์ส · นำเข้า CSV เพื่อเริ่มต้น</div>:
              <div className="rp-c-course-list">
                {courses.filter(c=>(c.course_name+" "+(c.course_code??"")).toLocaleLowerCase("th").includes(courseSearch.trim().toLocaleLowerCase("th"))).map((c,index)=><div key={c.id} style={{borderBottom:"1px solid var(--hairline-soft)"}}>
                  <button type="button" className="rp-c-course-btn" data-selected={selectedCourseId===c.id} onClick={()=>{if(saving)return;setSelectedCourseId(c.id);resetLessonForm(c.id);}}>
                    <span style={{width:29,height:29,borderRadius:9,background:"var(--rp-soft-gold)",color:"var(--gold-bright)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,flexShrink:0}}>{c.sort_order}</span>
                    <span style={{flex:1,minWidth:0,overflowWrap:"anywhere",lineHeight:1.45}}>
                      <strong style={{fontSize:13}}>{c.course_name}</strong>
                      <span style={{display:"block",fontSize:11,color:"var(--cream-muted)",marginTop:3}}>{lessons.filter(l=>l.course_id===c.id).length} บทเรียน · {c.course_code??"ไม่มีรหัส"}</span>
                    </span>
                    <span style={{fontWeight:800,color:"var(--gold-bright)"}} aria-hidden="true">›</span>
                  </button>
                  {selectedCourseId===c.id && <div style={{padding:"0 12px 12px",display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
                    <Status active={c.active}/>
                    <button style={textButtonStyle} type="button" disabled={saving} onClick={()=>editCourse(c)}>✎ แก้ไข</button>
                    <button style={textButtonStyle} type="button" disabled={saving || courses.findIndex(v=>v.id===c.id)===0} onClick={()=>moveCourse(courses.findIndex(v=>v.id===c.id),-1)}>↑</button>
                    <button style={textButtonStyle} type="button" disabled={saving || courses.findIndex(v=>v.id===c.id)===courses.length-1} onClick={()=>moveCourse(courses.findIndex(v=>v.id===c.id),1)}>↓</button>
                    {c.active && <button style={dangerButtonStyle} type="button" disabled={saving} onClick={()=>void deactivate("course",c.id,c.course_name)}>ปิดใช้</button>}
                  </div>}
                </div>)}
                {courses.filter(c=>(c.course_name+" "+(c.course_code??"")).toLocaleLowerCase("th").includes(courseSearch.trim().toLocaleLowerCase("th"))).length===0 && <p style={{padding:14,fontSize:12,color:"var(--cream-muted)"}}>ไม่พบคอร์สตามคำค้นหา</p>}
              </div>}
            <div style={{padding:12,borderTop:"1px solid var(--hairline)"}}>
              <button type="button" className="rp-c-action" style={{width:"100%",fontSize:12}} disabled={saving||loading||courses.length===0} onClick={()=>void reorder(recommendedCourseIds(courses))}>⇅ จัดเส้นทางเรียน · About เป็นลำดับ 2</button>
            </div>
          </section>

          <section className="rp-c-panel gold">
            <div style={{padding:"16px 18px",borderBottom:"1px solid var(--hairline)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div>
                <h2 style={{fontSize:18,margin:0}}>🎓 {selectedCourse?"บทเรียน: "+selectedCourse.course_name:"เลือกคอร์สเพื่อดูบทเรียน"}</h2>
                <p style={{fontSize:12,color:"var(--cream-muted)",margin:"5px 0 0"}}>{selectedLessons.length} บทเรียน · เรียงตามลำดับที่กำหนด</p>
              </div>
              {selectedCourse && <span className="rp-c-chip" style={{background:"rgba(40,145,94,.12)",color:"#318f64"}}><Status active={selectedCourse.active}/></span>}
            </div>
            {selectedCourse && <details key={selectedCourse.id} style={{padding:"12px 18px",borderBottom:"1px solid var(--hairline)"}}>
              <summary style={{color:"var(--gold-bright)",cursor:"pointer",fontWeight:800,fontSize:13}}>＋ เพิ่มหลายบทพร้อมกัน</summary>
              <p style={{...noteStyle,margin:"12px 0"}}>ใช้เมื่อต้องเพิ่มบทเรียนหลายบทในครั้งเดียว · ไม่จำเป็นต้องเพิ่มซ้ำ</p>
              <SkoolLessonOutline courseId={selectedCourse.id} courseName={selectedCourse.course_name} disabled={saving||loading} onBusyChange={setSaving} onSaved={()=>loadData(selectedCourse.id)}/>
            </details>}
            {!selectedCourse?<div style={emptyStyle}>เลือกคอร์สทางซ้ายก่อน</div>:selectedLessons.length===0?
              <div style={emptyStyle}>{importStats[String(selectedCourse.id)]?"นำเข้าข้อมูลระดับคอร์สแล้ว · เพิ่มบทเรียนเมื่อพร้อมได้เลย":"คอร์สนี้ยังไม่มีบทเรียน · เพิ่มจากฟอร์มด้านบนได้เลย"}</div>:
              <div style={{overflowX:"auto"}}>
                <table className="rp-c-lesson-table">
                  <thead><tr>{["ลำดับ","บทเรียน","ประเภท","แบบทดสอบ","สถานะ","จัดการ"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{treeRows.map(({lesson,number,depth})=><tr key={lesson.id}>
                    <td style={{fontWeight:800,color:"var(--gold-bright)"}}>{number}</td>
                    <td style={{paddingLeft:12+depth*14,fontWeight:depth?500:750,color:"var(--cream)"}}>{lesson.lesson_type==="QUIZ"?"📝 ":"▶ "}{lesson.lesson_name}</td>
                    <td><TypeBadge type={lesson.lesson_type}/></td>
                    <td>{lesson.quiz_url?<a href={lesson.quiz_url} target="_blank" rel="noreferrer" style={textLinkStyle}>เปิด Form ↗</a>:"—"}</td>
                    <td><Status active={lesson.active}/></td>
                    <td><div style={{display:"flex",gap:11,flexWrap:"wrap"}}>
                      <button style={textButtonStyle} type="button" onClick={()=>editLesson(lesson)}>✎ แก้ไข</button>
                      {lesson.active&&<button style={dangerButtonStyle} type="button" onClick={()=>void deactivate("lesson",lesson.id,lesson.lesson_name)}>⊘ ปิดใช้</button>}
                    </div></td>
                  </tr>)}</tbody>
                </table>
              </div>}
            {selectedCourse && importStats[String(selectedCourse.id)] && <div style={{padding:"12px 18px",background:"var(--rp-soft-gold)",color:"var(--cream-muted)",fontSize:12}}>
              📊 CSV · สมาชิก {importStats[String(selectedCourse.id)].members} · เรียนจบ {importStats[String(selectedCourse.id)].completed} · Progress เฉลี่ย {importStats[String(selectedCourse.id)].averageProgress}%
            </div>}
          </section>
        </div>
        <aside style={noteStyle}>
          <strong>ลำดับการทำงาน:</strong> Export CSV จาก Skool → Import ที่หน้านี้ → คอร์สและความคืบหน้าแสดงทันที → แก้รายละเอียดและเพิ่มบทเรียน/Google Forms ภายหลัง โดยคงชื่อ Classroom ให้ตรงกับ CSV เพื่อให้นำเข้าครั้งต่อไปเข้าคอร์สเดิม
        </aside>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={fieldStyle}><span style={labelStyle}>{label}</span>{children}</label>;
}

function PanelHeader({ title, caption }: { title: string; caption: string }) {
  return <header style={panelHeaderStyle}><strong>{title}</strong><span style={captionStyle}>{caption}</span></header>;
}

function ActiveField({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={checkStyle}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      เปิดใช้งานและแสดงในระบบ
    </label>
  );
}

function FormActions({ saving, editing, disabled = false, createLabel = "เพิ่มข้อมูล", onCancel }: { saving: boolean; editing: boolean; disabled?: boolean; createLabel?: string; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
      <button type="submit" disabled={saving || disabled} style={{ ...primaryButtonStyle, opacity: saving || disabled ? 0.55 : 1 }}>
        {saving ? "กำลังบันทึก..." : editing ? "บันทึกการแก้ไข" : createLabel}
      </button>
      {editing && <button type="button" onClick={onCancel} style={secondaryButtonStyle}>ยกเลิก</button>}
    </div>
  );
}

function Status({ active }: { active: boolean }) {
  return <span style={{ ...statusStyle, color: active ? "#4FAE73" : "var(--cream-faint)" }}>{active ? "● ใช้งาน" : "○ ปิดใช้"}</span>;
}

function TypeBadge({ type }: { type: "INFO" | "QUIZ" }) {
  return <span style={{ ...typeStyle, color: type === "QUIZ" ? "var(--gold-bright)" : "#6EA4D9" }}>{type}</span>;
}

const pageStyle = { minHeight: "100vh", padding: "28px 18px 64px", background: "var(--rp-page-gradient), var(--bg)", color: "var(--cream)" };
const navStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 10, marginBottom: 20 };
const outlineLinkStyle = { display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 14px", border: "1px solid var(--hairline)", borderRadius: 999, color: "var(--gold-bright)", textDecoration: "none", fontWeight: 700, fontSize: 13 };
const headerStyle = { padding: "clamp(24px, 5vw, 38px)", border: "1px solid var(--hairline)", borderRadius: 22, background: "linear-gradient(135deg, var(--rp-soft-gold), transparent 65%), var(--surface)", boxShadow: "0 18px 50px rgba(0,0,0,.12)", marginBottom: 18 };
const eyebrowStyle = { marginBottom: 9, color: "var(--gold)", fontSize: 12, fontWeight: 800, letterSpacing: 2.2 };
const titleStyle = { margin: 0, fontSize: "clamp(29px, 6vw, 44px)", lineHeight: 1.08 };
const subtitleStyle = { margin: "13px 0 0", color: "var(--cream-muted)", lineHeight: 1.7 };
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 430px), 1fr))", gap: 18 };
const panelStyle = { overflow: "hidden", border: "1px solid var(--hairline)", borderRadius: 17, background: "var(--surface)" };
const panelHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8, padding: "16px 18px", borderBottom: "1px solid var(--hairline)" };
const panelBodyStyle = { padding: 18 };
const captionStyle = { color: "var(--cream-faint)", fontSize: 11, lineHeight: 1.5 };
const fieldStyle = { display: "flex", flexDirection: "column" as const, gap: 7, marginBottom: 14 };
const labelStyle = { color: "var(--cream-muted)", fontSize: 12, fontWeight: 800 };
const inputStyle = { width: "100%", minHeight: 43, boxSizing: "border-box" as const, padding: "0 12px", border: "1px solid var(--hairline)", borderRadius: 9, background: "var(--surface-alt)", color: "var(--cream)", fontSize: 14, outline: "none" };
const twoFieldStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 };
const checkStyle = { display: "flex", alignItems: "center", gap: 9, color: "var(--cream-muted)", fontSize: 13 };
const primaryButtonStyle = { flex: 1, minHeight: 43, border: "1px solid var(--gold)", borderRadius: 10, background: "var(--gold)", color: "#18120A", fontWeight: 900, cursor: "pointer" };
const secondaryButtonStyle = { minHeight: 43, padding: "0 15px", border: "1px solid var(--hairline)", borderRadius: 10, background: "transparent", color: "var(--cream-muted)", fontWeight: 700, cursor: "pointer" };
const courseGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, padding: 17 };
const courseCardStyle = { padding: 15, border: "1px solid var(--hairline-soft)", borderRadius: 13, background: "var(--surface-alt)", cursor: "pointer" };
const selectedCardStyle = { borderColor: "var(--gold)", boxShadow: "inset 0 0 0 1px var(--gold)" };
const cardDescriptionStyle = { minHeight: 40, margin: "10px 0", color: "var(--cream-muted)", fontSize: 12, lineHeight: 1.6 };
const cardFooterStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 10, borderTop: "1px solid var(--hairline-soft)", color: "var(--cream-faint)", fontSize: 12 };
const textButtonStyle = { padding: 0, border: 0, background: "transparent", color: "var(--gold-bright)", fontWeight: 800, cursor: "pointer" };
const dangerButtonStyle = { padding: 0, border: 0, background: "transparent", color: "var(--rp-danger)", fontWeight: 800, cursor: "pointer" };
const statusStyle = { whiteSpace: "nowrap" as const, fontSize: 11, fontWeight: 800 };
const typeStyle = { display: "inline-flex", padding: "5px 8px", border: "1px solid var(--hairline)", borderRadius: 999, background: "var(--surface-alt)", fontSize: 10, fontWeight: 900 };
const tableStyle = { width: "100%", minWidth: 760, borderCollapse: "collapse" as const, fontSize: 13 };
const thStyle = { padding: "12px 14px", background: "var(--surface-alt)", color: "var(--cream-faint)", fontSize: 10, fontWeight: 800, textAlign: "left" as const, whiteSpace: "nowrap" as const };
const trStyle = { borderTop: "1px solid var(--hairline-soft)" };
const tdStyle = { padding: 14, color: "var(--cream-muted)", verticalAlign: "middle" as const };
const textLinkStyle = { color: "var(--gold-bright)", fontWeight: 700, textDecoration: "none" };
const emptyStyle = { padding: "42px 20px", color: "var(--cream-muted)", textAlign: "center" as const };
const noteStyle = { marginTop: 18, padding: "14px 16px", border: "1px solid var(--hairline)", borderRadius: 13, background: "var(--rp-soft-gold)", color: "var(--cream-muted)", fontSize: 12, lineHeight: 1.7 };
const errorStyle = { marginBottom: 18, padding: "14px 16px", border: "1px solid var(--rp-danger-border)", borderRadius: 12, background: "rgba(180,55,55,.08)", color: "var(--rp-danger)" };
const successStyle = { marginBottom: 18, padding: "14px 16px", border: "1px solid var(--gold)", borderRadius: 12, background: "var(--rp-soft-gold)", color: "var(--gold-bright)" };
